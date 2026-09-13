-- ============================================================================
-- FYLYMPITCH - Migration 076: community counts for the homepage metrics band
-- Run once in the Supabase SQL Editor.
--
-- The homepage band currently counts the catalogue: opportunities, partner
-- organisations, festivals, markets, funding tracked. Adding the community
-- side - filmmakers, projects submitted, verified producers - cannot be done
-- with a plain count from the page, because of RLS:
--
--   projects  - an anonymous visitor can only see public, non-exclusive rows,
--               so counting from the page would report the public subset and
--               call it the total. Private and exclusively-pitched projects
--               would be silently missing.
--   profiles  - rows are readable, so those counts would work, but they belong
--               with the project count rather than being fetched a different
--               way.
--
-- This returns the three totals and nothing else. No row, name, email or
-- project title leaves the function - only integers - so it is safe to expose
-- to anonymous visitors, which is what a homepage needs.
-- ============================================================================

create or replace function public.community_metrics()
  returns table (
    registered_filmmakers int,
    projects_submitted    int,
    verified_producers    int
  )
  language sql stable security definer set search_path = public
as $$
  select
    (select count(*)::int from public.profiles
      where role::text = 'filmmaker')                       as registered_filmmakers,

    -- Every project ever submitted, including private ones and exclusive
    -- pitches. The point of this number is total work entrusted to the
    -- platform, not what happens to be publicly browsable.
    (select count(*)::int from public.projects)             as projects_submitted,

    (select count(*)::int from public.profiles
      where is_producer_verified = true
        and approval_status = 'approved')                   as verified_producers;
$$;

revoke all on function public.community_metrics() from public;
grant execute on function public.community_metrics() to anon, authenticated;


-- ---------- Check ----------
-- These are the numbers that will appear on the homepage. If any of them is
-- small enough to undercut the catalogue figures beside it, say so before
-- shipping rather than after.
select * from public.community_metrics();
