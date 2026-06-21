-- ============================================================
-- FYLYMPITCH — Migration 035: Smart crawl frequency
-- Run once in Supabase SQL Editor.
--
-- 1. Add crawl_frequency to funding_sources
--    daily   — active grant/fund programs (deadlines change)
--    weekly  — markets, labs, festivals (annual cycles)
--    monthly — large institutional / rarely-changing sources
--
-- 2. Assign frequencies to all 50 seeded sources
-- ============================================================

-- ── 1. Add column ──────────────────────────────────────────────
alter table public.funding_sources
  add column if not exists crawl_frequency text not null default 'weekly'
    check (crawl_frequency in ('daily', 'weekly', 'monthly'));

-- ── 2. DAILY — active grant/fund programs ─────────────────────
-- These post deadlines, open/close application windows frequently.

update public.funding_sources set crawl_frequency = 'daily' where url in (
  -- Sundance
  'https://www.sundance.org/programs/documentary-film-program/',
  'https://www.sundance.org/programs/feature-film-program/',
  -- US funders
  'https://itvs.org/funding/apply/open-call',
  'https://www.catapultfilmfund.org/apply',
  'https://www.chickeneggpics.org/grants/',
  'https://thegotham.org/filmmaker-support/',
  'https://www.sffilm.org/filmmaker-resources/grants/',
  'https://truefalse.org/grants/',
  'https://www.arts.gov/grants',
  -- Canada
  'https://telefilm.ca/en/financing',
  'https://cmf-fmc.ca/en/programs-and-deadlines/',
  'https://www.ontariocreates.ca/funding-programs',
  -- Europe — funds with rolling/annual deadlines
  'https://culture.ec.europa.eu/creative-europe/creative-europe-media-programme',
  'https://www.coe.int/en/web/eurimages/co-production',
  'https://www.bfi.org.uk/get-funding-support/film',
  'https://docsociety.org/funding/',
  'https://www.whickers.co.uk/apply/',
  'https://www.screenireland.ie/funding/',
  'https://filmivast.se/en/co-production/',
  'https://www.nordiskfilmogtvfond.com/en/apply/',
  'https://www.cnc.fr/professionnels/aides-et-financements/cinema/aides-a-la-creation/aide-aux-cinemas-du-monde_191564',
  'https://www.filmfund.lu/en/aid-and-incentives/',
  -- MENA
  'https://dohafilminstitute.com/programs/grants',
  'https://dohafilminstitute.com/programs/sanad-film-fund',
  'https://www.arabculturefund.org/Programs/4',
  -- Africa
  'https://www.nfvf.co.za/funding/film-funds',
  -- Asia
  'https://www.imda.gov.sg/how-we-can-help/singapore-film-commission',
  'https://www.busaniff.com/en/industry/asian-cinema-fund'
);

-- ── 3. WEEKLY — markets, labs, festivals (annual open periods) ─
-- Submissions open/close over weeks. Weekly crawl is sufficient.

update public.funding_sources set crawl_frequency = 'weekly' where url in (
  -- Labs
  'https://www.torinofilmlab.it/programmes/',
  'https://www.filmindependent.org/programs/',
  'https://ptsnorth.com/forum/',
  -- Festival markets
  'https://industry.idfa.nl/activities/idfa-forum/',
  'https://www.iffr.com/en/professionals/hubert-bals-fund',
  'https://industry.idfa.nl/activities/jan-vrijman-fund/',
  'https://hotdocs.ca/industry/hot-docs-forum',
  'https://sheffdocfest.com/industry/meetmarket',
  'https://www.filmfestival.gr/en/industry/agora/',
  'https://visionsdureel.ch/en/industry/pitching-du-reel/',
  'https://www.sansebastianfestival.com/industry/coproduction_forum/1/6',
  -- Berlinale / Cannes / Venice (annual)
  'https://www.berlinale.de/en/industry/world_cinema_fund/world-cinema-fund.html',
  'https://www.berlinale.de/en/industry/berlinale-coproduction-market/',
  'https://www.festival-cannes.com/en/cannes-pro/l-atelier',
  'https://www.labiennale.org/en/cinema/production-bridge',
  -- Asia markets
  'https://www.busaniff.com/en/industry/asian-project-market',
  'https://tiffcom.jp/en',
  -- Latin America
  'https://www.ficg.mx/industria/',
  -- MENA / Africa
  'https://www.jer-cin.org.il/en/industry/coproduction-lab/',
  'https://www.durbanfilmmart.co.za'
);

-- ── 4. MONTHLY — institutional / rarely-changing sources ───────
-- Large bodies whose programme info changes at most a few times a year.

update public.funding_sources set crawl_frequency = 'monthly' where url in (
  'https://havc.hr/financiranje/javni-pozivi',
  'https://www.incaa.gov.ar/financiacion-internacional'
);

-- ── 5. Verify distribution ─────────────────────────────────────
select crawl_frequency, count(*) as sources
from public.funding_sources
group by crawl_frequency
order by crawl_frequency;
