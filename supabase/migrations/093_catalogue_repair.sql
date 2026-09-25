-- ============================================================
-- FYLYMPITCH — Migration 093: Catalogue repair
--
-- Two problems, both structural rather than cosmetic.
--
-- 1. 450 of 662 active opportunities have no organization_name.
--    417 of those can be recovered by joining back to the
--    funding_source that produced them, so this is a backfill,
--    not a re-crawl.
--
-- 2. `deadline` is being asked to express three different things.
--    Only 64 records have a fixed date. Roughly 70 are rolling
--    programmes with no deadline at all, and roughly 80 are
--    annual programmes whose exact date was not on the page.
--    A nullable date can only say the first, so the other 150
--    look like missing data when they are in fact the most
--    actionable entries in the catalogue: open right now.
--
--    deadline_type makes that difference explicit.
-- ============================================================

-- ── 1. Drop the crawler's fake organisations ──────────────────
-- "Film Grants Directory", "Documentary Grants Directory" and
-- friends are listicle page titles the extractor filed as the
-- funding body. Clearing them first means the backfill below
-- gives those records a real organisation instead of leaving a
-- plausible-looking invention in place.

update public.opportunities
set    organization_name = null
where  organization_name ilike '%grants directory%'
   or  organization_name ilike '%funding directory%'
   or  organization_name ilike '%directory - 20%';

-- ── 2. Backfill organization_name from the source ─────────────
-- funding_sources.url is unique and opportunities.source_url is
-- indexed, so this is a straight keyed update.

update public.opportunities o
set    organization_name = s.organization_name
from   public.funding_sources s
where  s.url = o.source_url
  and  nullif(trim(o.organization_name), '') is null
  and  nullif(trim(s.organization_name), '') is not null;

-- ── 3. Cadence as a first-class field ─────────────────────────

alter table public.opportunities
  add column if not exists deadline_type text not null default 'unknown',
  add column if not exists typical_month smallint;

do $do$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'opportunities_deadline_type_chk'
  ) then
    alter table public.opportunities
      add constraint opportunities_deadline_type_chk
      check (deadline_type in ('fixed','rolling','annual','windows','unknown'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'opportunities_typical_month_chk'
  ) then
    alter table public.opportunities
      add constraint opportunities_typical_month_chk
      check (typical_month is null or typical_month between 1 and 12);
  end if;
end
$do$;

create index if not exists idx_opps_deadline_type
  on public.opportunities (deadline_type)
  where is_active;

comment on column public.opportunities.deadline_type is
  'fixed: a real date in deadline. rolling: open continuously. annual: recurs yearly, exact date unconfirmed. windows: several cycles a year. unknown: no cadence established.';
comment on column public.opportunities.typical_month is
  'For annual and windows only. The month a deadline usually falls in, read from the source text. Indicative, never presented as confirmed.';

-- ── 4. First month named in a piece of text ───────────────────
-- Long names are listed before their abbreviations so "march"
-- matches as march and not as "mar".

create or replace function public.month_from_text(p_text text)
returns smallint
language plpgsql
immutable
set search_path = public
as $fn$
declare
  m text;
begin
  if p_text is null then
    return null;
  end if;

  m := substring(
    lower(p_text)
    from '(january|february|march|april|august|september|october|november|december|june|july|jan|feb|mar|apr|may|jun|jul|aug|sept|sep|oct|nov|dec)'
  );

  if m is null then
    return null;
  end if;

  return case
    when m like 'jan%' then 1
    when m like 'feb%' then 2
    when m like 'mar%' then 3
    when m like 'apr%' then 4
    when m = 'may'     then 5
    when m like 'jun%' then 6
    when m like 'jul%' then 7
    when m like 'aug%' then 8
    when m like 'sep%' then 9
    when m like 'oct%' then 10
    when m like 'nov%' then 11
    when m like 'dec%' then 12
    else null
  end;
end;
$fn$;

-- ── 5. Clear notes that are not about timing ──────────────────
-- Award ranges were landing in deadline_note, which had quietly
-- become the field for anything the extractor could not place.

update public.opportunities
set    deadline_note = null
where  deadline_note is not null
  and  deadline_note ~* '^\s*(eur|usd|gbp|chf|cad|aud|inr|[$€£₹])\s*[0-9]';

-- ── 5b. Recover the few notes that ARE dates ──────────────────
-- Only alphabetic-month formats (23-Apr-2026). Numeric slash
-- dates stay as notes on purpose: 03/04/2026 is March in the US
-- and April almost everywhere else, and a wrong date inside a red
-- urgent notification is the one mistake that costs a filmmaker's
-- trust outright. A date already in the past is also left alone,
-- since a closed programme should not be resurrected as live.

update public.opportunities
set    deadline      = to_date(trim(deadline_note), 'DD-Mon-YYYY'),
       deadline_note = null
where  deadline is null
  and  deadline_note ~* '^\s*[0-9]{1,2}-(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*-[0-9]{4}\s*$'
  and  to_date(trim(deadline_note), 'DD-Mon-YYYY') >= current_date;

-- ── 6. Classify ───────────────────────────────────────────────
-- A real date always wins; the note only decides the rest.
-- Order matters: "Annual (rolling)" is rolling, and a note that
-- names cycles is windows before it is annual.

update public.opportunities
set    deadline_type = 'fixed'
where  deadline is not null;

update public.opportunities
set    deadline_type = case
         when note ~ '(rolling|year[- ]?round|continuous|always open|ongoing|any time|anytime|open call)'
           then 'rolling'
         when note ~ '(window|cycle|[0-9]+\s*rounds?|quarterly|monthly|biannual|twice a year|two rounds)'
           then 'windows'
         when note ~ 'annual|yearly|each year|every year'
           then 'annual'
         else 'unknown'
       end
from   (
  select id, lower(trim(deadline_note)) as note
  from   public.opportunities
  where  deadline is null
    and  nullif(trim(deadline_note), '') is not null
) src
where  src.id = public.opportunities.id;

update public.opportunities
set    typical_month = public.month_from_text(deadline_note)
where  deadline_type in ('annual','windows')
  and  typical_month is null;

-- ── 7. What the repair actually did ───────────────────────────
-- Read these numbers before deploying anything that depends on
-- them. no_org should have fallen from 450 to around 33, and
-- rolling should be the second largest bucket after unknown.

select
  count(*)                                                            as active,
  count(*) filter (where nullif(trim(organization_name), '') is null) as no_org,
  count(*) filter (where deadline_type = 'fixed')                     as fixed,
  count(*) filter (where deadline_type = 'rolling')                   as rolling,
  count(*) filter (where deadline_type = 'annual')                    as annual,
  count(*) filter (where deadline_type = 'windows')                   as windows,
  count(*) filter (where deadline_type = 'unknown')                   as unknown,
  count(*) filter (where typical_month is not null)                   as with_month
from public.opportunities
where is_active;
