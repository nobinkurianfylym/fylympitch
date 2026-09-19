-- ============================================================================
-- FYLYMPITCH - Migration 083: revoke every anon write grant in public
--
-- 082 enabled RLS everywhere and revoked anon writes on three tables. The
-- check then showed anon still holds INSERT/UPDATE/DELETE on ~35 more --
-- Supabase's default grant, applied to every table created in public.
--
-- Traced every write in the codebase first:
--   server actions (lib/actions.ts, proof-actions, activity-actions)  authenticated
--   Edge Functions + createServiceClient()                            service_role
--   client components: 2 writes, both proof_notifications.is_read     authenticated
--   public write endpoints: none (no waitlist/contact form/open route)
-- Nothing writes as anon. Revoking costs nothing and removes RLS as the
-- single point of failure on 35 tables.
-- ============================================================================

do $$
declare t record;
begin
  for t in
    select distinct table_name
    from   information_schema.role_table_grants
    where  table_schema = 'public'
      and  grantee = 'anon'
      and  privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES')
  loop
    execute format(
      'revoke insert, update, delete, truncate, references on public.%I from anon',
      t.table_name);
  end loop;
end $$;

-- Without this, the NEXT table any migration creates inherits the grant again.
alter default privileges in schema public
  revoke insert, update, delete, truncate, references on tables from anon;

-- Sequences: anon cannot insert, so it has no use for nextval either.
alter default privileges in schema public
  revoke usage, update on sequences from anon;

-- ---------- Check ----------
select 'anon write grants remaining' as check,
       coalesce(string_agg(distinct table_name, ', '), 'none') as detail
from   information_schema.role_table_grants
where  table_schema = 'public' and grantee = 'anon'
  and  privilege_type in ('INSERT','UPDATE','DELETE')

union all

select 'anon SELECT grants kept (unchanged)',
       count(distinct table_name)::text
from   information_schema.role_table_grants
where  table_schema = 'public' and grantee = 'anon'
  and  privilege_type = 'SELECT';

-- Expected: row 1 = "none". Row 2 should be unchanged from before; public
-- browsing reads through anon and must keep working.
--
-- ROLLBACK (if any logged-out flow breaks):
--   grant insert, update, delete on all tables in public schema to anon;
