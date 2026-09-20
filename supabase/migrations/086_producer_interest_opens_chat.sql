-- ============================================================================
-- FYLYMPITCH - Migration 086: a producer-interest notification opens the chat
--
-- "<Producer> is interested in <your film>" linked to /filmprojects/<id> --
-- the filmmaker's own project page. It told them nothing they did not already
-- know, and the one thing they actually want to do, reply, was nowhere on it.
--
-- Two problems to solve:
--
--   1. The notification never recorded WHO the producer was. Without that
--      there is nothing to open a conversation with.
--   2. Opening a conversation cannot be a plain link, because the
--      conversation may not exist yet.
--
-- (1) is an actor_id column. (2) is /dashboard/messages/open, a route that
-- resolves (project, producer) to a conversation and forwards to the inbox,
-- so the notification row stays a single ordinary link.
-- ============================================================================

-- ---------- 1. Who caused the notification ----------
-- Generic on purpose. Several notification kinds have an actor and none of
-- them could name one; producer_interest is simply the first to need it.
alter table public.notifications
  add column if not exists actor_id uuid references public.profiles(id) on delete set null;

create index if not exists idx_notifications_actor
  on public.notifications (actor_id) where actor_id is not null;


-- ---------- 2. Write it, and link to the conversation ----------
-- Everything else about this function is unchanged from 051: still skips
-- private projects and exclusive pitches, still refuses to notify a filmmaker
-- about their own action, still requires an approved industry caller.
create or replace function public.notify_producer_interest(p_project_id uuid)
  returns void language plpgsql security definer set search_path = public
as $$
declare
  v_title              text;
  v_owner_id           uuid;
  v_producer_name      text;
  v_is_public          boolean;
  v_target_producer_id uuid;
  v_actor              uuid := auth.uid();
begin
  if not public.is_approved_industry() then return; end if;

  select p.title, p.owner_id, p.is_public, p.target_producer_id
    into v_title, v_owner_id, v_is_public, v_target_producer_id
  from public.projects p
  where p.id = p_project_id;

  if v_owner_id is null then return; end if;
  if v_owner_id = v_actor then return; end if;

  -- Never notify for private or exclusive-pitch projects
  if not coalesce(v_is_public, false) then return; end if;
  if v_target_producer_id is not null then return; end if;

  select coalesce(company, full_name) into v_producer_name
  from public.profiles where id = v_actor;

  insert into public.notifications (user_id, kind, title, body, link, project_id, actor_id)
  values (
    v_owner_id,
    'producer_interest',
    v_producer_name || ' is interested in "' || v_title || '"',
    'They added your project to their pipeline. Open the conversation to reply.',
    '/dashboard/messages/open?project=' || p_project_id::text
      || '&producer=' || v_actor::text,
    p_project_id,
    v_actor
  );
end;
$$;


-- ---------- 3. Existing rows ----------
-- Deliberately NOT backfilled. Rows written before this migration have no
-- actor_id, and guessing one from producer_projects would be a guess: several
-- producers may have saved the same project, and picking the wrong one would
-- open a conversation with someone who never expressed interest. Old
-- notifications keep their project link and still work as they did.
--
-- How many are affected:
--   select count(*) from public.notifications
--   where  kind = 'producer_interest' and actor_id is null;


-- ---------- 4. Check ----------
select 'actor_id column' as check,
       count(*)::text    as detail
from   information_schema.columns
where  table_schema = 'public' and table_name = 'notifications' and column_name = 'actor_id'

union all

select 'function links to chat',
       case when prosrc like '%/dashboard/messages/open%' then 'yes' else 'NO' end
from   pg_proc where proname = 'notify_producer_interest';

-- Expected: actor_id column 1, function links to chat yes.
