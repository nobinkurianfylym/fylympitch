-- ============================================================================
-- FYLYMPITCH - Migration 074: tell the producer an exclusive pitch arrived
-- Run once in the Supabase SQL Editor.
--
-- A filmmaker can send a project to one producer and no one else. Until now
-- nothing told that producer: broadcast_new_project skips exclusive pitches by
-- design (no other producer should hear about it), and nothing was ever added
-- in its place. The pitch simply waited in Discover until the producer
-- happened to open the page. For the one feature where a specific named person
-- is expected to respond, silence is the wrong default.
--
-- notifications has no INSERT policy at all, so a filmmaker cannot write a row
-- for somebody else - which is correct, and why every notification in this
-- codebase is created by a SECURITY DEFINER function. This adds one for the
-- exclusive-pitch case. It also returns the addresses the caller needs to send
-- the email, so the server action does not have to go fishing for them.
-- ============================================================================

create or replace function public.notify_exclusive_pitch(p_project_id uuid)
  returns table (
    producer_email text,
    producer_name  text,
    project_title  text,
    filmmaker_name text
  )
  language plpgsql security definer set search_path = public
as $$
declare
  v_owner    uuid;
  v_target   uuid;
  v_title    text;
  v_logline  text;
  v_filmmaker text;
begin
  select p.owner_id, p.target_producer_id, p.title, p.logline
    into v_owner, v_target, v_title, v_logline
  from   public.projects p
  where  p.id = p_project_id;

  -- Only the filmmaker who owns it can trigger this, and only when the project
  -- is actually addressed to somebody.
  if v_owner is null or v_owner <> auth.uid() then return; end if;
  if v_target is null then return; end if;

  select coalesce(company, full_name, 'A filmmaker') into v_filmmaker
  from   public.profiles where id = v_owner;

  -- Never notify twice for the same pitch. A filmmaker editing and re-saving a
  -- project should not ring the producer's bell again.
  if exists (
    select 1 from public.notifications
    where  user_id = v_target
      and  kind = 'exclusive_pitch'
      and  project_id = p_project_id
  ) then
    return;
  end if;

  insert into public.notifications (user_id, kind, title, body, link, project_id)
  values (
    v_target,
    'exclusive_pitch',
    v_filmmaker || ' pitched "' || v_title || '" directly to you',
    coalesce(nullif(trim(coalesce(v_logline, '')), ''),
             'Sent to you and nobody else. Open Producer Studio to read it.'),
    '/producerstudio/projects/' || p_project_id::text,
    p_project_id
  );

  return query
    select pr.email, coalesce(pr.full_name, pr.company), v_title, v_filmmaker
    from   public.profiles pr
    where  pr.id = v_target;
end $$;

revoke all on function public.notify_exclusive_pitch(uuid) from public;
grant execute on function public.notify_exclusive_pitch(uuid) to authenticated;


-- ---------- Check ----------
select count(*) as exclusive_pitch_notifs
from   public.notifications
where  kind = 'exclusive_pitch';
