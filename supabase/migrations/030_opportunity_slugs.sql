-- ============================================================
-- FYLYMPITCH — Migration 030: Opportunity slugs + public RLS
-- Run once in Supabase SQL Editor.
--
-- 1. slugify() helper
-- 2. opportunities.slug column
-- 3. Backfill slugs for all existing rows
-- 4. NOT NULL + unique index
-- 5. Auto-generate slug on insert trigger
-- 6. Fix RLS — active opportunities publicly readable
-- ============================================================

-- ---------- 1. slugify() ----------
create or replace function public.slugify(val text)
  returns text
  language sql immutable strict
as $$
  select trim('-' from
    regexp_replace(
      regexp_replace(
        regexp_replace(lower(val), '[^a-z0-9\s-]', '', 'g'),
        '\s+', '-', 'g'
      ),
      '-+', '-', 'g'
    )
  )
$$;

-- ---------- 2. Add slug column (nullable for backfill) ----------
alter table public.opportunities
  add column if not exists slug text;

-- ---------- 3. Backfill: deduplicate by appending short id suffix ----------
update public.opportunities
set slug = sub.final_slug
from (
  with ranked as (
    select
      id,
      public.slugify(title) as base_slug,
      row_number() over (partition by public.slugify(title) order by created_at) as rn
    from public.opportunities
  )
  select id,
    case
      when rn = 1 then base_slug
      else base_slug || '-' || substr(id::text, 1, 8)
    end as final_slug
  from ranked
) sub
where public.opportunities.id = sub.id
  and public.opportunities.slug is null;

-- ---------- 4. NOT NULL + unique index ----------
alter table public.opportunities
  alter column slug set not null;

create unique index if not exists opportunities_slug_idx
  on public.opportunities (slug);

-- ---------- 5. Auto-slug trigger for future inserts ----------
create or replace function public.set_opportunity_slug()
  returns trigger
  language plpgsql
as $$
declare
  v_base   text;
  v_slug   text;
  v_suffix int := 0;
begin
  if new.slug is not null and trim(new.slug) != '' then
    return new;
  end if;

  v_base := public.slugify(new.title);
  v_slug := v_base;

  loop
    exit when not exists (
      select 1 from public.opportunities where slug = v_slug
    );
    v_suffix := v_suffix + 1;
    v_slug   := v_base || '-' || v_suffix;
  end loop;

  new.slug := v_slug;
  return new;
end;
$$;

drop trigger if exists trg_opportunity_slug on public.opportunities;
create trigger trg_opportunity_slug
  before insert on public.opportunities
  for each row execute function public.set_opportunity_slug();

-- ---------- 6. Fix RLS — active ops publicly readable ----------
-- Old policy gated on auth.uid() — broke the public /funds page
drop policy if exists "opps readable" on public.opportunities;

-- Active opportunities: everyone (including anon) can read
create policy "active opps public" on public.opportunities
  for select using (is_active = true);

-- Admins see everything (including inactive / draft)
create policy "admin reads all opps" on public.opportunities
  for select using (public.is_admin());
