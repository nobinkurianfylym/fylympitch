-- ============================================================================
-- FYLYMPITCH - Migration 082: database hardening
--
-- Three things, each independent. Run the checks; nothing here is destructive.
-- ============================================================================

-- ---------- 1. anon holds DELETE on projects ----------
-- Confirmed earlier:
--   grantee     privilege
--   anon        DELETE
--   anon        INSERT / UPDATE / REFERENCES
--
-- Today RLS blocks it, because the only DELETE policy is
-- "owner delete project" (owner_id = auth.uid() OR is_admin()) and an
-- anonymous caller satisfies neither. So this is not currently exploitable.
--
-- It is still the wrong shape. The anon key ships inside the JavaScript
-- bundle — it is public by design — so the ONLY thing standing between an
-- anonymous visitor and deleting every filmmaker's project is one RLS policy.
-- Disable RLS for five minutes to debug something, or add one permissive
-- "for all" policy, and the platform is one request away from empty.
--
-- anon has no business writing to projects at all. Revoke the grant so the
-- policy is a second line of defence instead of the only one.
revoke delete, insert, update, references on public.projects from anon;

-- Same reasoning for the other tables an anonymous reader only ever reads.
revoke delete, insert, update on public.opportunities  from anon;
revoke delete, insert, update on public.profiles       from anon;


-- ---------- 2. Tables with no RLS ----------
-- funding_sources and admin_review_queue have no "enable row level security"
-- anywhere in the migration history. If RLS was never enabled, the grants
-- above are the ONLY access control on them — and funding_sources holds the
-- crawl target list, admin_review_queue holds opportunities awaiting an
-- admin decision. Neither should be readable or writable by the public.
--
-- Enabling RLS with no policy means "deny all except service_role", which is
-- correct here: both tables are touched only by Edge Functions (service role)
-- and by admins (through admin_* RPCs that are SECURITY DEFINER).
alter table public.funding_sources    enable row level security;
alter table public.admin_review_queue enable row level security;

-- Policies have to cover every real caller, not just the obvious one. Traced
-- through the code before writing these:
--
--   funding_sources
--     read    app/admin/intelligence/page.tsx          normal client -> needs policy
--     write   Edge Function recordAttempt()            service_role  -> bypasses RLS
--
--   admin_review_queue
--     read    app/admin/intelligence/page.tsx          normal client -> needs policy
--     read    app/admin/layout.tsx (the badge count)   normal client -> needs policy
--     update  app/admin/intelligence/actions.ts:151    normal client -> needs policy
--     update  app/admin/intelligence/actions.ts:179    normal client -> needs policy
--     insert  app/admin/intelligence/crawl-site-action.ts:175  normal -> needs policy
--
-- A select-only policy would have enabled RLS and then silently broken
-- approving and rejecting crawled opportunities, and admin-triggered crawls.
-- Every admin surface here uses the ordinary server client, not service_role.

drop policy if exists "admin reads funding sources" on public.funding_sources;
create policy "admin reads funding sources" on public.funding_sources
  for select using (public.is_admin());

drop policy if exists "admin manages review queue" on public.admin_review_queue;
create policy "admin manages review queue" on public.admin_review_queue
  for all
  using      (public.is_admin())
  with check (public.is_admin());


-- ---------- 3. Check ----------
select 'anon write grants remaining' as check,
       coalesce(string_agg(table_name || '.' || privilege_type, ', '), 'none') as detail
from   information_schema.role_table_grants
where  table_schema = 'public' and grantee = 'anon'
  and  privilege_type in ('INSERT','UPDATE','DELETE')

union all

select 'RLS disabled on', coalesce(string_agg(relname, ', '), 'none')
from   pg_class c join pg_namespace n on n.oid = c.relnamespace
where  n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity = false;

-- Expected: "none" for the first row.
-- The second row lists any remaining table without RLS — review each; a
-- lookup table of public reference data may legitimately be there, a table
-- holding user data may not.
