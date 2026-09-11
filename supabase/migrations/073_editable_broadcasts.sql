-- ============================================================================
-- FYLYMPITCH - Migration 073: edit a broadcast after it has been sent
-- Run once in the Supabase SQL Editor.
--
-- A broadcast fans out into one notification row per recipient, and those rows
-- were never linked back to the broadcast that created them - which is why
-- repairing their links in migration 068 had to guess by matching titles.
-- Editing needs a real link, so notifications.broadcast_id is added here and
-- stamped on every future fan-out.
--
-- What editing can and cannot reach:
--   in-app notifications  - yes, every copy is updated in place
--   /support announcements - yes, same rows
--   email already sent     - NO. It is in people's inboxes and nothing can
--                            recall it. The composer says so.
--
-- Recipients saw one text and will now see another, so both the broadcast and
-- every notification carry edited_at, and the reader is shown an "Edited"
-- marker rather than being quietly rewritten.
-- ============================================================================

-- ---------- 1. Link notifications to their broadcast ----------
alter table public.notifications
  add column if not exists broadcast_id uuid references public.admin_broadcasts(id) on delete set null,
  add column if not exists edited_at    timestamptz;

create index if not exists idx_notifications_broadcast_id
  on public.notifications(broadcast_id) where broadcast_id is not null;

alter table public.admin_broadcasts
  add column if not exists edited_at timestamptz;


-- ---------- 2. Stamp broadcast_id on every future fan-out ----------
-- Same function as migration 071, with the id carried through. p_include_self
-- keeps its default so a three-argument caller still binds.
create or replace function public.send_admin_broadcast(
  p_audience     text,
  p_subject      text,
  p_body         text,
  p_include_self boolean default false
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_caller uuid := auth.uid();
  v_id     uuid;
  v_count  int;
begin
  if not public.is_admin() then
    raise exception 'unauthorized';
  end if;
  if p_audience not in ('all','filmmakers','producers') then
    raise exception 'invalid audience';
  end if;
  if p_body is null or trim(p_body) = '' then
    raise exception 'empty body';
  end if;

  insert into public.admin_broadcasts (sender_id, audience, subject, body)
  values (v_caller, p_audience, nullif(trim(coalesce(p_subject, '')), ''), trim(p_body))
  returning id into v_id;

  insert into public.notifications (user_id, kind, title, body, link, broadcast_id)
  select a.user_id,
         'admin_broadcast',
         coalesce(nullif(trim(coalesce(p_subject, '')), ''), 'A message from PITCH.FYLYM'),
         trim(p_body),
         '/support',
         v_id
  from   public.admin_broadcast_audience(p_audience, p_include_self) a;

  get diagnostics v_count = row_count;
  update public.admin_broadcasts set recipient_count = v_count where id = v_id;
  return v_id;
end $$;

revoke all on function public.send_admin_broadcast(text, text, text, boolean) from public;
grant execute on function public.send_admin_broadcast(text, text, text, boolean) to authenticated;


-- ---------- 3. Edit in place ----------
-- Updates the broadcast and every delivered copy. Does NOT re-notify: nobody
-- gets a second alert, and read state is left alone - correcting a typo should
-- not mark a message unread for two thousand people.
create or replace function public.edit_admin_broadcast(
  p_id      uuid,
  p_subject text,
  p_body    text
) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_count int;
  v_title text;
begin
  if not public.is_admin() then
    raise exception 'unauthorized';
  end if;
  if p_body is null or trim(p_body) = '' then
    raise exception 'empty body';
  end if;
  if not exists (select 1 from public.admin_broadcasts where id = p_id) then
    raise exception 'no such broadcast';
  end if;

  v_title := coalesce(nullif(trim(coalesce(p_subject, '')), ''), 'A message from PITCH.FYLYM');

  update public.admin_broadcasts
     set subject   = nullif(trim(coalesce(p_subject, '')), ''),
         body      = trim(p_body),
         edited_at = now()
   where id = p_id;

  update public.notifications
     set title     = v_title,
         body      = trim(p_body),
         edited_at = now()
   where broadcast_id = p_id;

  get diagnostics v_count = row_count;
  return v_count;
end $$;

revoke all on function public.edit_admin_broadcast(uuid, text, text) from public;
grant execute on function public.edit_admin_broadcast(uuid, text, text) to authenticated;


-- ---------- 4. Backfill the link for broadcasts already sent ----------
-- Older notifications carry no broadcast_id. Match them back by title and by
-- landing within a minute of the broadcast - the fan-out is a single
-- statement, so every copy shares its timestamp. Only unambiguous matches are
-- linked; anything that matches two broadcasts is left alone and simply will
-- not be editable.
with pairs as (
  select n.id as notif_id,
         (
           select b.id
           from   public.admin_broadcasts b
           where  coalesce(nullif(trim(coalesce(b.subject,'')),''), 'A message from PITCH.FYLYM') = n.title
             and  n.created_at between b.created_at - interval '1 minute'
                                   and b.created_at + interval '1 minute'
           limit 2
         ) as broadcast_id,
         (
           select count(*)
           from   public.admin_broadcasts b
           where  coalesce(nullif(trim(coalesce(b.subject,'')),''), 'A message from PITCH.FYLYM') = n.title
             and  n.created_at between b.created_at - interval '1 minute'
                                   and b.created_at + interval '1 minute'
         ) as matches
  from   public.notifications n
  where  n.kind = 'admin_broadcast'
    and  n.broadcast_id is null
)
update public.notifications n
   set broadcast_id = p.broadcast_id
  from pairs p
 where n.id = p.notif_id
   and p.matches = 1
   and p.broadcast_id is not null;


-- ---------- 5. Check ----------
select count(*)                                        as admin_broadcast_notifs,
       count(*) filter (where broadcast_id is not null) as linked_and_editable,
       count(*) filter (where broadcast_id is null)     as unlinked_legacy
from   public.notifications
where  kind = 'admin_broadcast';
