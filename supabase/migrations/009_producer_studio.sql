-- ============================================================
-- FYLYMPITCH — Migration 009: Producer Studio
-- Run once in Supabase SQL Editor (after 008).
-- ============================================================

-- Producer CRM: one row per (producer, project) relationship
create table if not exists public.producer_projects (
  id             uuid primary key default gen_random_uuid(),
  producer_id    uuid not null references public.profiles(id) on delete cascade,
  project_id     uuid not null references public.projects(id) on delete cascade,
  status         text not null default 'saved'
                 check (status in ('saved','shortlisted','in_review','meeting_set','deal_active','passed')),
  rating         smallint check (rating is null or rating between 1 and 5),
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (producer_id, project_id)
);

create trigger trg_producer_projects_touch
  before update on public.producer_projects
  for each row execute function public.touch_updated_at();

alter table public.producer_projects enable row level security;

-- Producer owns their own CRM rows exclusively
create policy "producer crm owner"
  on public.producer_projects for all
  using (producer_id = auth.uid());

-- ── Meeting requests ──────────────────────────────────────────

create table if not exists public.meeting_requests (
  id               uuid primary key default gen_random_uuid(),
  producer_id      uuid not null references public.profiles(id) on delete cascade,
  filmmaker_id     uuid not null references public.profiles(id),
  project_id       uuid not null references public.projects(id) on delete cascade,
  status           text not null default 'pending'
                   check (status in ('pending','accepted','declined','completed')),
  message          text,
  proposed_times   jsonb not null default '[]',
  confirmed_time   timestamptz,
  meeting_notes    text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create trigger trg_meeting_requests_touch
  before update on public.meeting_requests
  for each row execute function public.touch_updated_at();

alter table public.meeting_requests enable row level security;

create policy "meeting visibility"
  on public.meeting_requests for select
  using (producer_id = auth.uid() or filmmaker_id = auth.uid() or public.is_admin());

create policy "producer creates meeting"
  on public.meeting_requests for insert
  with check (producer_id = auth.uid() and public.is_approved_industry());

create policy "participants update meeting"
  on public.meeting_requests for update
  using (producer_id = auth.uid() or filmmaker_id = auth.uid() or public.is_admin());

-- ── Projects RLS: approved industry sees ALL projects ─────────
-- (previously only public projects; approved producers need full
--  visibility for the review queue and CRM)
drop policy if exists "owner full read" on public.projects;

create policy "owner full read" on public.projects for select
  using (
    owner_id = auth.uid()
    or public.is_admin()
    or is_public
    or public.is_approved_industry()
  );
