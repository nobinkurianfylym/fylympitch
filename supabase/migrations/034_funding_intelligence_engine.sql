-- ============================================================
-- FYLYMPITCH — Migration 034: Funding Intelligence Engine
-- Run once in Supabase SQL Editor.
--
-- 1. Add intelligence columns to opportunities
-- 2. Create funding_sources (50 orgs, seed included)
-- 3. Create funding_crawl_runs (daily crawl log)
-- 4. Create funding_crawl_items (per-source results)
-- 5. Create opportunity_versions (full change history)
-- 6. Create admin_review_queue (low-confidence items)
-- 7. Create auto_broadcast_new_fund() for service-role use
-- 8. RLS policies
-- ============================================================

-- ============================================================
-- 1. EXTEND OPPORTUNITIES TABLE
-- ============================================================

alter table public.opportunities
  add column if not exists source_url         text,
  add column if not exists organization_name  text,
  add column if not exists last_verified_at   timestamptz,
  add column if not exists version_number     int not null default 1,
  add column if not exists auto_crawled       boolean not null default false,
  add column if not exists crawl_confidence   int check (crawl_confidence between 0 and 100),
  add column if not exists submission_status  text not null default 'open'
    check (submission_status in ('open','closing_soon','closed','archived','cancelled'));

-- index for status management
create index if not exists idx_opps_submission_status
  on public.opportunities (submission_status, deadline);

create index if not exists idx_opps_source_url
  on public.opportunities (source_url)
  where source_url is not null;

-- ============================================================
-- 2. FUNDING SOURCES TABLE
-- ============================================================

create table if not exists public.funding_sources (
  id                uuid primary key default gen_random_uuid(),
  organization_name text not null,
  program_name      text not null,
  url               text not null,
  country           text,
  region            text,
  expected_opp_type text,          -- hint for AI: 'grant','fund','lab' etc
  crawl_active      boolean not null default true,
  crawl_depth       int not null default 1,
  notes             text,          -- special extraction instructions
  last_crawled_at   timestamptz,
  last_success_at   timestamptz,
  fail_count        int not null default 0,
  created_at        timestamptz not null default now()
);

create unique index if not exists funding_sources_url_idx
  on public.funding_sources (url);

-- ============================================================
-- 3. FUNDING CRAWL RUNS TABLE
-- ============================================================

create table if not exists public.funding_crawl_runs (
  id                      uuid primary key default gen_random_uuid(),
  started_at              timestamptz not null default now(),
  finished_at             timestamptz,
  status                  text not null default 'running'
    check (status in ('running','complete','failed')),
  sources_crawled         int not null default 0,
  pages_visited           int not null default 0,
  new_opportunities       int not null default 0,
  updated_opportunities   int not null default 0,
  expired_opportunities   int not null default 0,
  archived_opportunities  int not null default 0,
  failed_crawls           int not null default 0,
  pending_review          int not null default 0,
  duplicates_prevented    int not null default 0,
  avg_confidence          numeric(5,2),
  error_summary           text
);

-- ============================================================
-- 4. FUNDING CRAWL ITEMS TABLE
-- ============================================================

create table if not exists public.funding_crawl_items (
  id              uuid primary key default gen_random_uuid(),
  run_id          uuid not null references public.funding_crawl_runs(id) on delete cascade,
  source_id       uuid not null references public.funding_sources(id) on delete cascade,
  opportunity_id  uuid references public.opportunities(id) on delete set null,
  action          text check (action in ('inserted','updated','skipped','queued_review','failed')),
  confidence      int check (confidence between 0 and 100),
  raw_extraction  jsonb,
  changed_fields  text[],
  error_message   text,
  crawled_at      timestamptz not null default now()
);

create index if not exists idx_crawl_items_run
  on public.funding_crawl_items (run_id);

-- ============================================================
-- 5. OPPORTUNITY VERSIONS TABLE
-- ============================================================

create table if not exists public.opportunity_versions (
  id              uuid primary key default gen_random_uuid(),
  opportunity_id  uuid not null references public.opportunities(id) on delete cascade,
  version_number  int not null,
  changed_fields  text[] not null default '{}',
  previous_values jsonb not null default '{}',
  new_values      jsonb not null default '{}',
  change_source   text not null default 'auto_crawl'
    check (change_source in ('auto_crawl','admin_edit','manual_import')),
  changed_at      timestamptz not null default now()
);

create index if not exists idx_opp_versions_opportunity
  on public.opportunity_versions (opportunity_id, version_number desc);

-- ============================================================
-- 6. ADMIN REVIEW QUEUE TABLE
-- ============================================================

create table if not exists public.admin_review_queue (
  id              uuid primary key default gen_random_uuid(),
  run_id          uuid references public.funding_crawl_runs(id) on delete set null,
  source_id       uuid references public.funding_sources(id) on delete set null,
  source_url      text not null,
  extracted_data  jsonb not null default '{}',
  confidence      int check (confidence between 0 and 100),
  status          text not null default 'pending'
    check (status in ('pending','approved','rejected')),
  reviewed_by     uuid references public.profiles(id) on delete set null,
  reviewed_at     timestamptz,
  opportunity_id  uuid references public.opportunities(id) on delete set null,
  reject_reason   text,
  created_at      timestamptz not null default now()
);

create index if not exists idx_review_queue_status
  on public.admin_review_queue (status, created_at desc);

-- ============================================================
-- 7. AUTO BROADCAST (callable with service role key)
--    No is_admin() check — the edge function is trusted.
-- ============================================================

create or replace function public.auto_broadcast_new_fund(
  p_opp_id    uuid,
  p_title     text,
  p_opp_type  text default null
)
  returns int language plpgsql security definer set search_path = public
as $$
declare
  v_count int;
begin
  insert into public.notifications (user_id, kind, title, body, link)
  select
    pr.id,
    'new_fund',
    'New ' || coalesce(p_opp_type, 'funding') || ': ' || p_title,
    'A newly discovered funding opportunity may match your project.',
    '/dashboard/opportunities'
  from public.profiles pr
  where pr.approval_status = 'approved'
    and pr.role in ('filmmaker', 'admin')
  limit 2000;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ============================================================
-- 8. STATUS AUTO-MANAGEMENT FUNCTION
--    Called by cron or the edge function after each crawl.
-- ============================================================

create or replace function public.sync_opportunity_statuses()
  returns int language plpgsql security definer set search_path = public
as $$
declare
  v_count int := 0;
begin
  -- Mark closing_soon (deadline within 14 days)
  update public.opportunities
  set submission_status = 'closing_soon'
  where submission_status = 'open'
    and deadline is not null
    and deadline > current_date
    and deadline <= current_date + interval '14 days';
  get diagnostics v_count = row_count;

  -- Mark closed (deadline passed)
  update public.opportunities
  set submission_status = 'closed',
      is_active = false
  where submission_status in ('open','closing_soon')
    and deadline is not null
    and deadline < current_date;
  get diagnostics v_count = v_count + row_count;

  return v_count;
end;
$$;

-- ============================================================
-- 9. RLS POLICIES
-- ============================================================

alter table public.funding_sources    enable row level security;
alter table public.funding_crawl_runs enable row level security;
alter table public.funding_crawl_items enable row level security;
alter table public.opportunity_versions enable row level security;
alter table public.admin_review_queue  enable row level security;

-- funding_sources — admin read/write, public read-only for active sources
create policy "admin manage funding_sources"
  on public.funding_sources for all using (public.is_admin());

create policy "public read active funding_sources"
  on public.funding_sources for select using (crawl_active = true);

-- crawl runs — admin only
create policy "admin manage crawl_runs"
  on public.funding_crawl_runs for all using (public.is_admin());

-- crawl items — admin only
create policy "admin manage crawl_items"
  on public.funding_crawl_items for all using (public.is_admin());

-- versions — admin only
create policy "admin manage opp_versions"
  on public.opportunity_versions for all using (public.is_admin());

-- review queue — admin only
create policy "admin manage review_queue"
  on public.admin_review_queue for all using (public.is_admin());

-- ============================================================
-- 10. SEED: 50 CURATED FUNDING SOURCES
-- ============================================================

insert into public.funding_sources
  (organization_name, program_name, url, country, region, expected_opp_type, notes)
values

-- ─── NORTH AMERICA ────────────────────────────────────────────
('Sundance Institute',
 'Documentary Fund',
 'https://www.sundance.org/programs/documentary-film-program/',
 'United States', 'North America', 'fund',
 'Look for open grant cycles, deadlines, and award amounts on this page'),

('Sundance Institute',
 'Feature Film Program',
 'https://www.sundance.org/programs/feature-film-program/',
 'United States', 'North America', 'lab',
 'Extract lab dates, eligibility, and application deadlines'),

('ITVS',
 'Open Call',
 'https://itvs.org/funding/apply/open-call',
 'United States', 'North America', 'fund',
 'US public media funder. Focus on deadline and award amount'),

('Catapult Film Fund',
 'Development Fund',
 'https://www.catapultfilmfund.org/apply',
 'United States', 'North America', 'fund',
 'Documentary development grants. Check for open/closed status'),

('Chicken & Egg Pictures',
 'Egg Grants',
 'https://www.chickeneggpics.org/grants/',
 'United States', 'North America', 'grant',
 'Women and non-binary documentary filmmakers. Extract eligibility carefully'),

('Gotham Film & Media Institute',
 'Filmmaker Support',
 'https://thegotham.org/filmmaker-support/',
 'United States', 'North America', 'grant',
 'Grants, labs, and fellowship programs for independent filmmakers'),

('SFFILM',
 'Filmmaker Grants',
 'https://www.sffilm.org/filmmaker-resources/grants/',
 'United States', 'North America', 'grant',
 'Multiple grant programs. Extract each as separate opportunity if found'),

('True/False Film Fest',
 'True Life Fund',
 'https://truefalse.org/grants/',
 'United States', 'North America', 'grant',
 'Documentary grant. Check deadline and award amount'),

('Points North Institute',
 'Points North Forum',
 'https://ptsnorth.com/forum/',
 'United States', 'North America', 'market',
 'Documentary forum at Camden International Film Festival'),

('Film Independent',
 'Spirit Awards Fellowships & Labs',
 'https://www.filmindependent.org/programs/',
 'United States', 'North America', 'lab',
 'Multiple labs and grants. List each program if multiple found'),

('Telefilm Canada',
 'Canada Feature Film Fund',
 'https://telefilm.ca/en/financing',
 'Canada', 'North America', 'fund',
 'Largest Canadian film fund. Extract feature film stream details'),

('Canada Media Fund',
 'Rogers Documentary Fund',
 'https://cmf-fmc.ca/en/programs-and-deadlines/',
 'Canada', 'North America', 'fund',
 'Documentary production funding. Check for open programs and deadlines'),

('Ontario Creates',
 'Film Fund',
 'https://www.ontariocreates.ca/funding-programs',
 'Canada', 'North America', 'fund',
 'Ontario provincial film fund. Extract deadline and award details'),

-- ─── EUROPE ───────────────────────────────────────────────────
('Creative Europe MEDIA',
 'Film Development & Co-Production',
 'https://culture.ec.europa.eu/creative-europe/creative-europe-media-programme',
 null, 'Europe', 'co_production',
 'EU flagship film programme. Multiple strands — extract main development and co-production calls'),

('Eurimages',
 'Co-Production Support',
 'https://www.coe.int/en/web/eurimages/co-production',
 null, 'Europe', 'co_production',
 'Council of Europe co-production fund. Extract deadline and funding amounts'),

('BFI Film Fund',
 'Film Fund',
 'https://www.bfi.org.uk/get-funding-support/film',
 'United Kingdom', 'Europe', 'fund',
 'UK national film fund. Multiple strands. Extract each separately if possible'),

('Doc Society',
 'Good Pitch / Britdoc',
 'https://docsociety.org/funding/',
 'United Kingdom', 'Europe', 'fund',
 'Impact documentary funder. Extract deadlines and award details'),

('Whickers',
 'Whickers Film Award',
 'https://www.whickers.co.uk/apply/',
 'United Kingdom', 'Europe', 'grant',
 'UK documentary award. Check current cycle deadline and amount'),

('Screen Ireland',
 'Film Development & Production',
 'https://www.screenireland.ie/funding/',
 'Ireland', 'Europe', 'fund',
 'Irish national film fund. Extract development and production strands'),

('Film i Väst',
 'International Co-Production',
 'https://filmivast.se/en/co-production/',
 'Sweden', 'Europe', 'co_production',
 'Swedish regional fund with strong international co-production track'),

('Nordic Film & TV Fund',
 'Production Support',
 'https://www.nordiskfilmogtvfond.com/en/apply/',
 null, 'Europe', 'fund',
 'Nordic co-production fund covering Denmark, Finland, Iceland, Norway, Sweden'),

('CNC',
 'Aide aux cinémas du monde',
 'https://www.cnc.fr/professionnels/aides-et-financements/cinema/aides-a-la-creation/aide-aux-cinemas-du-monde_191564',
 'France', 'Europe', 'fund',
 'French international film support. Extract deadline and country eligibility'),

('Film Fund Luxembourg',
 'Film Production Aid',
 'https://www.filmfund.lu/en/aid-and-incentives/',
 'Luxembourg', 'Europe', 'fund',
 'Luxembourg film fund and tax incentive. Extract both if present'),

('Torino Film Lab',
 'TFL Extended',
 'https://www.torinofilmlab.it/programmes/',
 'Italy', 'Europe', 'lab',
 'Italian script and project development lab. Extract multiple programmes'),

('Croatian Audiovisual Centre',
 'Project Development Fund',
 'https://havc.hr/financiranje/javni-pozivi',
 'Croatia', 'Europe', 'fund',
 'Croatian film fund calls. Page may be in Croatian — extract key fields'),

-- ─── FESTIVALS WITH CO-PRO / INDUSTRY ARMS ────────────────────
('Berlinale',
 'World Cinema Fund',
 'https://www.berlinale.de/en/industry/world_cinema_fund/world-cinema-fund.html',
 'Germany', 'Europe', 'fund',
 'Berlinale development and production fund for films from Africa, Latin America, Middle East, Central Asia, Southeast Asia'),

('Berlinale',
 'Co-Production Market',
 'https://www.berlinale.de/en/industry/berlinale-coproduction-market/',
 'Germany', 'Europe', 'market',
 'Annual co-production market. Extract application deadlines and project requirements'),

('Cannes',
 "L'Atelier",
 'https://www.festival-cannes.com/en/cannes-pro/l-atelier',
 'France', 'Europe', 'lab',
 "Cannes L'Atelier development lab. Extract deadline and eligibility"),

('Venice Film Festival',
 'Venice Production Bridge',
 'https://www.labiennale.org/en/cinema/production-bridge',
 'Italy', 'Europe', 'market',
 'Venice financing forum. Extract market sessions and submission deadlines'),

('IDFA',
 'IDFA Forum',
 'https://industry.idfa.nl/activities/idfa-forum/',
 'Netherlands', 'Europe', 'market',
 'International Documentary Film Festival Amsterdam co-production forum'),

('IFFR',
 'Hubert Bals Fund',
 'https://www.iffr.com/en/professionals/hubert-bals-fund',
 'Netherlands', 'Europe', 'fund',
 'Rotterdam film fund for filmmakers from developing countries. Two annual deadlines'),

('IFFR',
 'Jan Vrijman Fund',
 'https://industry.idfa.nl/activities/jan-vrijman-fund/',
 'Netherlands', 'Europe', 'grant',
 'Documentary training and development grants'),

('Hot Docs',
 'Hot Docs Forum',
 'https://hotdocs.ca/industry/hot-docs-forum',
 'Canada', 'North America', 'market',
 'Canadian documentary forum and pitching event. Extract submission deadlines'),

('Sheffield DocFest',
 'MeetMarket',
 'https://sheffdocfest.com/industry/meetmarket',
 'United Kingdom', 'Europe', 'market',
 'Sheffield documentary market. Extract application open/close dates'),

('Thessaloniki IFF',
 'Agora Co-Production Forum',
 'https://www.filmfestival.gr/en/industry/agora/',
 'Greece', 'Europe', 'market',
 'Greek festival industry platform with co-production forum'),

('Visions du Réel',
 'Pitching du Réel',
 'https://visionsdureel.ch/en/industry/pitching-du-reel/',
 'Switzerland', 'Europe', 'market',
 'Swiss documentary pitching forum. Extract submission deadline'),

('San Sebastián IFF',
 'Co-Production Forum',
 'https://www.sansebastianfestival.com/industry/coproduction_forum/1/6',
 'Spain', 'Europe', 'market',
 'Spanish festival co-production market'),

-- ─── MENA ─────────────────────────────────────────────────────
('Doha Film Institute',
 'Grants Program',
 'https://dohafilminstitute.com/programs/grants',
 'Qatar', 'Middle East', 'grant',
 'Qatari film grants. Two annual cycles. Extract both if present'),

('Doha Film Institute',
 'SANAD Development & Post-Production Fund',
 'https://dohafilminstitute.com/programs/sanad-film-fund',
 'Qatar', 'Middle East', 'fund',
 'SANAD fund specifically. Extract development and post-production strands separately'),

('AFAC',
 'Annual Grants Program',
 'https://www.arabculturefund.org/Programs/4',
 null, 'Middle East', 'grant',
 'Arab Fund for Arts and Culture annual grants. Open to Arab filmmakers'),

('Jerusalem Cinematheque',
 'Co-Production Lab',
 'https://www.jer-cin.org.il/en/industry/coproduction-lab/',
 'Israel', 'Middle East', 'lab',
 'Jerusalem industry lab and co-production meetings'),

-- ─── AFRICA ───────────────────────────────────────────────────
('Durban FilmMart',
 'Industry Programme',
 'https://www.durbanfilmmart.co.za',
 'South Africa', 'Africa', 'market',
 'South African co-production market. Extract project submission deadline'),

('NFVF',
 'Film Production and Development Fund',
 'https://www.nfvf.co.za/funding/film-funds',
 'South Africa', 'Africa', 'fund',
 'National Film and Video Foundation South Africa. Extract open funding calls'),

-- ─── ASIA-PACIFIC ─────────────────────────────────────────────
('Busan International Film Festival',
 'Asian Cinema Fund',
 'https://www.busaniff.com/en/industry/asian-cinema-fund',
 'South Korea', 'Asia-Pacific', 'fund',
 'BIFF development and post-production grants. Multiple streams'),

('Busan International Film Festival',
 'Asian Project Market',
 'https://www.busaniff.com/en/industry/asian-project-market',
 'South Korea', 'Asia-Pacific', 'market',
 'APM co-production forum. Extract submission deadlines'),

('Media Development Authority',
 'Singapore Film Commission',
 'https://www.imda.gov.sg/how-we-can-help/singapore-film-commission',
 'Singapore', 'Asia-Pacific', 'fund',
 'Singapore film development grants and incentives'),

('Tokyo International Film Festival',
 'Tokyo Gap-Financing Market',
 'https://tiffcom.jp/en',
 'Japan', 'Asia-Pacific', 'market',
 'Tokyo financing market and content sales. Extract submission details'),

-- ─── LATIN AMERICA ────────────────────────────────────────────
('CINELATINO / INCAA',
 'MERCOSUR Audiovisual Fund',
 'https://www.incaa.gov.ar/financiacion-internacional',
 null, 'Latin America', 'fund',
 'Latin American audiovisual co-production fund. Page may be in Spanish'),

('Guadalajara International Film Festival',
 'Ibero-American Film Market (MIFF)',
 'https://www.ficg.mx/industria/',
 'Mexico', 'Latin America', 'market',
 'Mexican film market and co-production forum. Extract submission deadlines')

on conflict (url) do nothing;
