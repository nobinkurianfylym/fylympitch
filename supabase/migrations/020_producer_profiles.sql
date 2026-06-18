-- ============================================================
-- Migration 020: Producer profiles + introduction requests
-- ============================================================

-- producer_profiles: taste/identity data collected at onboarding
create table public.producer_profiles (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null unique references public.profiles(id) on delete cascade,
  contact_email            text,                -- stored at signup for notification emails
  country                  text not null default '',
  role_type                text not null default 'independent_producer',
  imdb_url                 text,
  credits                  text,
  genres                   text[] not null default '{}',
  formats                  text[] not null default '{}',
  territories              text[] not null default '{}',
  budget_range             text check (budget_range in ('micro','low','mid','high')),
  festivals                text[] not null default '{}',
  open_to_coproduction     boolean not null default false,
  open_to_ep               boolean not null default false,
  bringing_territory_funding boolean not null default false,
  is_public                boolean not null default false,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index on public.producer_profiles (is_public);
create index on public.producer_profiles using gin (genres);
create index on public.producer_profiles (country);

create trigger trg_producer_profiles_touch
  before update on public.producer_profiles
  for each row execute function public.touch_updated_at();

alter table public.producer_profiles enable row level security;

create policy "public profiles visible to all"
  on public.producer_profiles for select
  using (is_public = true or user_id = auth.uid() or public.is_admin());

create policy "owner can insert"
  on public.producer_profiles for insert
  with check (user_id = auth.uid());

create policy "owner can update"
  on public.producer_profiles for update
  using (user_id = auth.uid());

-- introduction_requests: filmmaker → producer connection requests
create table public.introduction_requests (
  id                uuid primary key default gen_random_uuid(),
  filmmaker_id      uuid not null references public.profiles(id) on delete cascade,
  producer_user_id  uuid not null references public.profiles(id) on delete cascade,
  project_id        uuid not null references public.projects(id) on delete cascade,
  status            text not null default 'sent'
                    check (status in ('sent','viewed','accepted','declined')),
  created_at        timestamptz not null default now(),
  unique (filmmaker_id, producer_user_id, project_id)
);

alter table public.introduction_requests enable row level security;

create policy "participants can read"
  on public.introduction_requests for select
  using (filmmaker_id = auth.uid() or producer_user_id = auth.uid() or public.is_admin());

create policy "filmmaker can request"
  on public.introduction_requests for insert
  with check (filmmaker_id = auth.uid());

create policy "participants can update"
  on public.introduction_requests for update
  using (filmmaker_id = auth.uid() or producer_user_id = auth.uid());
