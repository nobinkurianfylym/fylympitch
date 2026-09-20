-- ============================================================================
-- FYLYMPITCH - Migration 087: a notification must name someone
--
-- Three of the four producer-interest rows in the database read
--
--     " is interested in "Dissolution""
--
-- coalesce(company, full_name) skips NULL. It does not skip ''. A producer
-- whose company field holds an empty string -- typed and cleared, or saved
-- blank by a form that posts "" rather than omitting the field -- sends a
-- filmmaker a notification from nobody. 086 carried the expression forward
-- unchanged; the data caught it, not the review.
--
-- nullif(trim(x), '') turns "" and "   " into NULL so coalesce does the job it
-- looks like it is doing. "A producer" is a deliberate last resort: a
-- notification naming nobody is worse than a generic one.
--
-- NOTE ON THE $fn$ TAG, and on the comments being out here rather than in the
-- body. The Supabase SQL editor runs a helper that appends
--     ALTER TABLE <x> ENABLE ROW LEVEL SECURITY;
-- when it believes a script created a table. It misreads the DECLARE block --
-- "v_title text;" looks like a table to it -- and splices that statement into
-- the middle of the function, which breaks $$ quoting:
--     ERROR: 42601: unterminated dollar-quoted string
-- A distinctive tag and a comment-free body keep it out.
-- ============================================================================

create or replace function public.notify_producer_interest(p_project_id uuid)
  returns void language plpgsql security definer set search_path = public
as $fn$
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
  if not coalesce(v_is_public, false) then return; end if;
  if v_target_producer_id is not null then return; end if;

  select coalesce(
           nullif(trim(company),   ''),
           nullif(trim(full_name), ''),
           'A producer'
         )
    into v_producer_name
  from public.profiles
  where id = v_actor;

  v_producer_name := coalesce(v_producer_name, 'A producer');

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
$fn$;


-- ---------- Check ----------
select 'nullif guard present' as check,
       case when prosrc like '%nullif(trim(company)%' then 'yes' else 'NO' end as detail
from   pg_proc where proname = 'notify_producer_interest';


-- ---------- Where else the same mistake lives ----------
--   select proname
--   from   pg_proc
--   where  pronamespace = 'public'::regnamespace
--     and  prosrc ilike '%coalesce(company%';
