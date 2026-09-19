-- ============================================================================
-- FYLYMPITCH - Migration 081: make admin_hidden and exclusive pitches real
--
-- RLS policies are OR'd. public.projects has two carefully written policies:
--
--   public readable non-hidden        is_public AND NOT admin_hidden
--                                     AND target_producer_id IS NULL
--   verified producer reads non-hidden  is_verified_producer() AND ...same
--
-- and two that quietly defeat both of them:
--
--   projects_select              owner OR is_admin() OR is_public
--                                OR is_approved_industry()
--   anon_browse_public_projects  is_public              (role: anon)
--
-- Because the most permissive policy wins, is_public alone has been enough to
-- read any row. Two consequences:
--
--   * "Admin hide" hides nothing. The admin UI sets admin_hidden, the badge
--     appears in /admin/projects, and the project stays fully readable.
--   * An exclusive pitch — a project a filmmaker addressed to ONE producer,
--     which applyToOpportunity also sets automatically — is readable by
--     anyone while is_public is true. Migration 072 closed this on the storage
--     side, so the script and deck are protected; the row itself was not.
--
-- The fix is subtraction. Every legitimate reader already has a narrower
-- policy of their own:
--
--   owner            -> owner reads own projects
--   admin            -> admin reads all projects
--   target producer  -> producer reads own pitched projects
--   verified producer-> verified producer reads non-hidden
--   public and anon  -> public readable non-hidden   (role {public} covers anon)
--
-- so projects_select's only unique contribution is is_approved_industry(),
-- which is re-added below with the same two conditions the others carry.
-- anon_browse_public_projects is simply redundant.
-- ============================================================================

-- ---------- 1. Look before you leap ----------
-- How many rows change visibility? Run this FIRST. Anything counted here is
-- currently public and will stop being so — which is the intent, but you
-- should know the number before it happens rather than after.
--
-- select count(*) filter (where admin_hidden)                   as hidden_but_visible,
--        count(*) filter (where target_producer_id is not null) as exclusive_but_visible,
--        count(*)                                               as affected_total
-- from   public.projects
-- where  is_public = true
--   and  (admin_hidden = true or target_producer_id is not null);


-- ---------- 2. Remove the two policies that override the others ----------
drop policy if exists "projects_select"             on public.projects;
drop policy if exists "anon_browse_public_projects" on public.projects;


-- ---------- 3. Give approved industry its own, correctly scoped policy ----------
-- is_approved_industry() is producer / investor / organization with
-- approval_status = 'approved'. They browse /dashboard/discover. They have no
-- business seeing a project an admin hid, or one pitched exclusively to a
-- different producer — the producer it WAS pitched to still sees it through
-- "producer reads own pitched projects".
drop policy if exists "approved industry reads non-hidden" on public.projects;
create policy "approved industry reads non-hidden" on public.projects
  for select using (
    public.is_approved_industry()
    and admin_hidden = false
    and target_producer_id is null
  );


-- ---------- 4. Confirm ----------
select policyname, cmd, roles, qual
from   pg_policies
where  schemaname = 'public' and tablename = 'projects' and cmd = 'SELECT'
order  by policyname;

-- Expected SELECT policies afterwards, and nothing else:
--   admin reads all projects              is_admin()
--   approved industry reads non-hidden    industry + not hidden + not exclusive
--   owner reads own projects              owner_id = auth.uid()
--   producer reads own pitched projects   target_producer_id = auth.uid()
--   public readable non-hidden            public + not hidden + not exclusive
--   verified producer reads non-hidden    verified + not hidden + not exclusive


-- ---------- 5. Verify the hole is closed ----------
-- Run as an anonymous reader (a logged-out browser, or the anon key). An
-- admin-hidden or exclusively-pitched project must not come back.
--
-- select id, title, is_public, admin_hidden, target_producer_id
-- from   public.projects
-- where  admin_hidden = true or target_producer_id is not null;
