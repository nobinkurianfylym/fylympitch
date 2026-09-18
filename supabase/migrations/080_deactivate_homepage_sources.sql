-- ============================================================================
-- FYLYMPITCH - Migration 080: stop crawling company homepages
--
-- Migration 079 removed rows that could never work (malformed URLs, dead
-- origins, duplicates): 3 + 14 + 21, leaving 426 active of 465.
--
-- This handles a different category: URLs that resolve perfectly and contain
-- no programme, because they are a company's front page rather than a funding
-- page. A24, MUBI, Wild Bunch, Magnolia, XYZ Films, Yash Raj, Participant,
-- Working Title, IFC Films, ZDF and about forty more. "AI extraction returned
-- no programmes" is the CORRECT answer for mubi.com — there is no grant on it.
--
-- These are distributors, studios and sales agents. They belong in the
-- opportunities catalogue as records; they just are not crawlable sources.
-- Every run spends a Firecrawl credit on each of them to be told, accurately,
-- that nothing is there.
--
-- Deactivating crawling does NOT remove them from public.opportunities. It
-- only stops the crawler visiting them. Reverse any row by setting
-- crawl_active = true after pointing url at a real programme page.
--
-- The rule is deliberately narrow: bare domain (no path), never succeeded, and
-- has actually failed with "no programmes" at least once. A source with a path
-- like /funding/ or /grants/ is left alone even if it has failed, because a
-- path suggests someone aimed it at something real.
-- ============================================================================

-- ---------- Review first ----------
-- select s.organization_name, s.url, s.fail_count
-- from   public.funding_sources s
-- where  s.crawl_active
--   and  s.last_success_at is null
--   and  s.url ~ '^https?://[^/]+/?$'
--   and  exists (select 1 from public.funding_crawl_items ci
--                where ci.source_id = s.id
--                  and ci.error_message = 'AI extraction returned no programmes')
-- order  by s.organization_name;

update public.funding_sources s
set    crawl_active = false,
       notes = concat_ws(E'\n', s.notes,
               '[080] Crawling stopped: URL is a company homepage with no programme listing. '
            || 'Point url at the actual funding/submissions page and set crawl_active = true to resume.')
where  s.crawl_active
  and  s.last_success_at is null
  and  s.url ~ '^https?://[^/]+/?$'
  and  exists (
         select 1 from public.funding_crawl_items ci
         where  ci.source_id = s.id
           and  ci.action = 'failed'
           and  ci.error_message = 'AI extraction returned no programmes'
       );

-- ---------- Result ----------
select count(*) filter (where notes like '%[080] Crawling stopped%') as homepages_stopped,
       count(*) filter (where crawl_active)                          as still_active,
       count(*)                                                      as total
from   public.funding_sources;

-- ---------- Still worth your attention ----------
-- Sources that scrape and extract fine but never yield a record, because every
-- programme is either a duplicate (skipped) or below the confidence gate
-- (queued_review). These are NOT failures and none of the cleanup touches
-- them — but if a source only ever produces queued_review, its extraction is
-- not trusted and someone should look at why.
--
-- select s.organization_name, s.url,
--        count(*) filter (where ci.action = 'skipped')        as skipped,
--        count(*) filter (where ci.action = 'queued_review')  as queued,
--        count(*) filter (where ci.action = 'inserted')       as inserted,
--        count(*) filter (where ci.action = 'updated')        as updated
-- from   public.funding_sources s
-- join   public.funding_crawl_items ci on ci.source_id = s.id
-- where  s.crawl_active
-- group  by s.id, s.organization_name, s.url
-- having count(*) filter (where ci.action in ('inserted','updated')) = 0
--    and count(*) filter (where ci.action in ('skipped','queued_review')) > 0
-- order  by queued desc, skipped desc;
