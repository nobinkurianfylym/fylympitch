-- ============================================================================
-- FYLYMPITCH - Migration 079: triage the funding source list
--
-- Context. A run warned "7/8 sources failed". The per-source reasons in
-- funding_crawl_items show the crawler is mostly doing its job; the source
-- list is what is wrong. Over 30 days:
--
--   593  Firecrawl returned no content        47 sources
--   224  HTTP 402 Insufficient credits       224 sources   <- the real event
--    57  AI extraction returned no programmes 57 sources
--    22  Firecrawl 200 but empty markdown     22 sources
--    11  Origin returned HTTP 404              11 sources
--     3  Origin returned HTTP 403               3 sources
--
-- The 402s are a Firecrawl billing problem, not a data problem, and nothing
-- here addresses them — check the plan's credit balance. This migration deals
-- with the rest: rows that can never succeed no matter how many credits exist.
--
-- Nothing is deleted. Sources are set crawl_active = false and stamped in
-- notes, so every decision is visible and reversible with one UPDATE.
-- ============================================================================

-- ---------- 1. Look before touching anything ----------
-- Run this on its own first. Every source that has failed, with its most
-- recent reason and whether it has EVER succeeded.
--
-- select s.organization_name, s.program_name, s.url, s.fail_count,
--        s.last_success_at,
--        (select ci.error_message
--           from public.funding_crawl_items ci
--          where ci.source_id = s.id and ci.action = 'failed'
--          order by ci.crawled_at desc limit 1) as latest_error,
--        (select count(*) from public.funding_crawl_items ci
--          where ci.source_id = s.id and ci.action = 'failed')        as fails,
--        (select count(*) from public.funding_crawl_items ci
--          where ci.source_id = s.id and ci.action in ('inserted','updated')) as wins
-- from   public.funding_sources s
-- where  s.crawl_active
-- order  by wins asc, fails desc;


-- ---------- 2. Malformed URLs ----------
-- "https://100" is a real row in this table (Creative Europe MEDIA Slate
-- Development). Firecrawl rejects it with "URL must have a valid top-level
-- domain", and it will do so forever. A host with no dot is not an address.
update public.funding_sources
set    crawl_active = false,
       notes = concat_ws(E'\n', notes,
               '[079] Deactivated: malformed URL (' || url || '). Fix the URL and set crawl_active = true.')
where  crawl_active
  and (
        url !~* '^https?://'
     or split_part(split_part(regexp_replace(url, '^https?://', ''), '/', 1), ':', 1) not like '%.%'
  );


-- ---------- 3. URLs the origin says are gone ----------
-- Only where the source has NEVER produced an opportunity. A 404 on a source
-- that used to work may be a temporary redirect, and is left alone.
update public.funding_sources s
set    crawl_active = false,
       notes = concat_ws(E'\n', s.notes,
               '[079] Deactivated: origin returns 404/403/410 and this source has never yielded an opportunity.')
where  s.crawl_active
  and  s.last_success_at is null
  and  exists (
         select 1 from public.funding_crawl_items ci
         where  ci.source_id = s.id
           and  ci.action = 'failed'
           and  ci.error_message ~ 'Origin returned HTTP (404|403|410)'
       )
  and  not exists (
         select 1 from public.funding_crawl_items ci
         where  ci.source_id = s.id
           and  ci.action in ('inserted', 'updated')
       );


-- ---------- 4. Duplicate targets ----------
-- funding_sources has a UNIQUE index on url, so byte-identical rows cannot
-- exist; this catches only the variants that index does not consider equal —
-- http vs https, a www. prefix, a trailing slash.
--
-- It deliberately does NOT deduplicate by HOST. Berlinale legitimately has two
-- rows (berlinale.de/en/wcf and berlinale.de/copromarket) which are different
-- programmes at one organisation, and host-level dedupe would silently delete
-- one of them. By the same rule MUBI's two rows (mubi.com and
-- mubi.com/en/films) are left alone here — they are two different URLs, and
-- they belong in the manual review in section 5, not in an automatic rule.
with ranked as (
  select id,
         row_number() over (
           partition by lower(regexp_replace(regexp_replace(url, '^https?://(www\.)?', ''), '/+$', ''))
           order by created_at asc
         ) as rn
  from   public.funding_sources
  where  crawl_active
)
update public.funding_sources s
set    crawl_active = false,
       notes = concat_ws(E'\n', s.notes, '[079] Deactivated: duplicate of an earlier source with the same URL.')
from   ranked r
where  s.id = r.id and r.rn > 1;


-- ---------- 5. Report only: sources pointed at a homepage ----------
-- MUBI, A24, ARTE and Al Jazeera are set to their company homepages, where no
-- funding programme is listed — so "AI extraction returned no programmes" is
-- the correct answer, not a failure. These are NOT deactivated automatically:
-- the right fix is usually to re-point the URL at the actual programme page,
-- and only to disable it if no such page exists. Review by hand.
--
-- select s.organization_name, s.url, s.fail_count
-- from   public.funding_sources s
-- where  s.crawl_active
--   and  s.last_success_at is null
--   and  s.url ~ '^https?://[^/]+/?$'          -- bare domain, no path
--   and  exists (select 1 from public.funding_crawl_items ci
--                where ci.source_id = s.id
--                  and ci.error_message = 'AI extraction returned no programmes')
-- order  by s.organization_name;


-- ---------- 6. What changed ----------
select count(*) filter (where notes like '%[079] Deactivated: malformed URL%')   as malformed_url,
       count(*) filter (where notes like '%[079] Deactivated: origin returns%')  as dead_url,
       count(*) filter (where notes like '%[079] Deactivated: duplicate%')       as duplicates,
       count(*) filter (where crawl_active)                                      as still_active,
       count(*)                                                                  as total
from   public.funding_sources;
