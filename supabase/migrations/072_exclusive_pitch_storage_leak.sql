-- ============================================================================
-- FYLYMPITCH - Migration 072: close the exclusive-pitch leak in Storage
-- Run once in the Supabase SQL Editor. SECURITY FIX - run it promptly.
--
-- Migration 050 locked the projects TABLE so an exclusively-pitched project
-- (target_producer_id is not null) is visible only to its filmmaker, the one
-- targeted producer, and admins. The FILES were never locked. schema.sql still
-- carries the original policy:
--
--   using (bucket_id = 'scripts' and (
--            (storage.foldername(name))[1] = auth.uid()::text
--            or public.is_approved_industry()      <-- ANY approved producer
--            or public.is_admin()))
--
-- There is no project-level condition in it at all, so every approved
-- producer, investor or organization can read every script and every pitch
-- deck in those buckets - including material a filmmaker sent exclusively to a
-- different producer. pitch-decks carries the identical policy.
--
-- This is not only about the app's screens. SELECT on storage.objects also
-- governs LISTING, so a producer with a valid session can enumerate both
-- buckets through the Storage API, collect every path, and fetch any file
-- without ever touching the site.
--
-- The fix derives file access from the project that owns the file:
--
--   owner             - always (first path segment is their user id)
--   admin             - always (unchanged, by decision)
--   target producer   - when the project was pitched to them (migration 049)
--   approved industry - only when the project is NOT an exclusive pitch, and
--                       is not admin-hidden
--
-- Deliberately minimal. The industry predicate stays is_approved_industry(),
-- exactly as today, so no legitimate access is removed. The projects table
-- uses the stricter is_verified_producer() for browsing and the two are worth
-- aligning - but doing that here would silently cut script access on
-- /dashboard/discover, which gates on approved rather than verified. That is a
-- product decision, not part of this leak.
-- ============================================================================

-- ---------- 1. One rule, used by both buckets ----------
-- SECURITY DEFINER so the policy can consult projects without going through
-- that table's own RLS. STABLE so the planner can cache it per statement.
create or replace function public.can_read_project_file(p_bucket text, p_path text)
  returns boolean
  language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from   public.projects p
    where  (
             (p_bucket = 'scripts'     and p.script_path     = p_path)
          or (p_bucket = 'pitch-decks' and p.pitch_deck_path = p_path)
           )
      and  (
             -- The producer this was pitched to. Migration 049 deliberately
             -- lets them see it regardless of is_public / admin_hidden, so the
             -- file has to follow the row or their page breaks.
             p.target_producer_id = auth.uid()

             -- Everyone else in the industry: non-exclusive projects only, and
             -- never an admin-hidden one - the table already refuses to show
             -- them that row, so the file should not be readable either.
             or (
               p.target_producer_id is null
               and p.admin_hidden = false
               and public.is_approved_industry()
             )
           )
  );
$$;

revoke all on function public.can_read_project_file(text, text) from public;
grant execute on function public.can_read_project_file(text, text) to authenticated;

-- The policy looks a file up by path on every read, so index those columns.
create index if not exists idx_projects_script_path
  on public.projects(script_path) where script_path is not null;
create index if not exists idx_projects_pitch_deck_path
  on public.projects(pitch_deck_path) where pitch_deck_path is not null;


-- ---------- 2. Replace the two leaking policies ----------
drop policy if exists "script read access" on storage.objects;
create policy "script read access" on storage.objects for select
  using (
    bucket_id = 'scripts'
    and (
      (storage.foldername(name))[1] = auth.uid()::text   -- the filmmaker
      or public.is_admin()                               -- admin: full read
      or public.can_read_project_file('scripts', name)
    )
  );

drop policy if exists "deck read access" on storage.objects;
create policy "deck read access" on storage.objects for select
  using (
    bucket_id = 'pitch-decks'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
      or public.can_read_project_file('pitch-decks', name)
    )
  );

-- INSERT and DELETE policies are untouched: both are already owner-only.


-- ---------- 3. Check ----------
-- Both policies should now route through the project rule, and neither should
-- still grant blanket industry access in its own predicate.
select policyname,
       qual like '%can_read_project_file%' as uses_project_rule,
       qual like '%is_approved_industry%'  as blanket_industry_grant
from   pg_policies
where  schemaname = 'storage' and tablename = 'objects'
  and  policyname in ('script read access', 'deck read access');

-- How much material was exposed.
select count(*) filter (where target_producer_id is not null)                                 as exclusive_pitches,
       count(*) filter (where target_producer_id is not null and script_path     is not null)  as exclusive_with_script,
       count(*) filter (where target_producer_id is not null and pitch_deck_path is not null)  as exclusive_with_deck
from   public.projects;
