-- ============================================================
-- FYLYMPITCH — Production Schema v1.0
-- Run this entire file once in Supabase SQL Editor.
-- Auth users live in auth.users (managed by Supabase Auth).
-- Every table below has Row Level Security ENABLED and policies.
-- ============================================================

-- ---------- ENUMS ----------
create type user_role as enum ('filmmaker','producer','investor','organization','admin');
create type project_stage as enum ('development','pre_production','production','post_production','completed');
create type project_format as enum ('feature','short','documentary','series','animation');
create type opportunity_type as enum ('grant','fund','lab','co_production','market','distribution','investor','broadcaster','streamer','sales_agent');
create type application_status as enum ('draft','submitted','under_review','shortlisted','accepted','rejected','withdrawn');
create type offer_status as enum ('pending','accepted','declined','withdrawn');
create type approval_status as enum ('pending','approved','rejected');

-- ---------- PROFILES (1:1 with auth.users) ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null default 'filmmaker',
  approval_status approval_status not null default 'approved', -- producers/investors set to 'pending' by trigger
  full_name text not null default '',
  company text,
  country text,
  bio text,
  website text,
  imdb_url text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint website_len check (char_length(coalesce(website,'')) <= 300)
);

-- ---------- ORGANIZATIONS ----------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  org_type text,            -- fund, studio, festival, distributor...
  country text,
  website text,
  description text,
  verified boolean not null default false,
  created_at timestamptz not null default now()
);
create index idx_orgs_owner on public.organizations(owner_id);

-- ---------- PROJECTS ----------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  genre text not null,
  format project_format not null default 'feature',
  language text not null default 'English',
  country text not null,
  budget_usd numeric(14,2) check (budget_usd is null or budget_usd >= 0),
  funding_needed_usd numeric(14,2) check (funding_needed_usd is null or funding_needed_usd >= 0),
  stage project_stage not null default 'development',
  logline text not null check (char_length(logline) <= 500),
  synopsis text,
  director_statement text,
  producer_info text,
  pitch_deck_path text,     -- Supabase Storage path (private bucket)
  script_path text,         -- Supabase Storage path (private bucket)
  is_public boolean not null default true,  -- visible to approved producers/investors
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_projects_owner on public.projects(owner_id);
create index idx_projects_match on public.projects(genre, stage, country);
create index idx_projects_public on public.projects(is_public) where is_public = true;

-- ---------- OPPORTUNITIES ----------
create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references public.profiles(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete set null,
  title text not null,
  opp_type opportunity_type not null,
  description text,
  country text,              -- null = worldwide
  region text,               -- e.g. Europe, Asia-Pacific
  genres text[] not null default '{}',          -- empty = all genres
  formats project_format[] not null default '{}',
  stages project_stage[] not null default '{}',
  languages text[] not null default '{}',
  min_budget_usd numeric(14,2),
  max_budget_usd numeric(14,2),
  max_award_usd numeric(14,2),
  deadline date,
  url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index idx_opps_active on public.opportunities(is_active, deadline);
create index idx_opps_type on public.opportunities(opp_type);

-- ---------- APPLICATIONS ----------
create table public.applications (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  applicant_id uuid not null references public.profiles(id) on delete cascade,
  status application_status not null default 'submitted',
  cover_note text,
  match_score int check (match_score between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, opportunity_id)
);
create index idx_apps_applicant on public.applications(applicant_id);
create index idx_apps_opportunity on public.applications(opportunity_id);

-- ---------- SAVED OPPORTUNITIES ----------
create table public.saved_opportunities (
  user_id uuid not null references public.profiles(id) on delete cascade,
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, opportunity_id)
);

-- ---------- MATCHES (computed, cached) ----------
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  score int not null check (score between 0 and 100),
  confidence text not null default 'medium',
  reasons jsonb not null default '[]',
  created_at timestamptz not null default now(),
  unique (project_id, opportunity_id)
);
create index idx_matches_project on public.matches(project_id, score desc);

-- ---------- OFFERS (producers/investors -> projects) ----------
create table public.offers (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  from_user_id uuid not null references public.profiles(id) on delete cascade,
  amount_usd numeric(14,2) check (amount_usd is null or amount_usd >= 0),
  offer_type text not null default 'investment',  -- investment, co_production, distribution, acquisition
  message text not null check (char_length(message) <= 4000),
  status offer_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_offers_project on public.offers(project_id);
create index idx_offers_from on public.offers(from_user_id);

-- ---------- NOTIFICATIONS ----------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,         -- offer_received, application_update, match_found, system
  title text not null,
  body text,
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index idx_notif_user on public.notifications(user_id, read, created_at desc);

-- ---------- ACTIVITY LOGS (user-visible) ----------
create table public.activity_logs (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) on delete set null,
  action text not null,       -- project_created, application_sent, offer_made...
  entity text,
  entity_id uuid,
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index idx_activity_user on public.activity_logs(user_id, created_at desc);

-- ---------- AUDIT LOGS (admin-only) ----------
create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,       -- role_changed, user_approved, opportunity_edited...
  target text,
  target_id text,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index idx_audit_time on public.audit_logs(created_at desc);

-- ============================================================
-- HELPER FUNCTIONS (SECURITY DEFINER — server-enforced roles)
-- ============================================================
create or replace function public.current_role() returns user_role
language sql stable security definer set search_path = public as
$$ select role from public.profiles where id = auth.uid() $$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin') $$;

create or replace function public.is_approved_industry() returns boolean
language sql stable security definer set search_path = public as
$$ select exists(
     select 1 from public.profiles
     where id = auth.uid()
       and role in ('producer','investor','organization')
       and approval_status = 'approved'
   ) $$;

-- ---------- AUTO-CREATE PROFILE ON SIGNUP ----------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_role user_role := coalesce((new.raw_user_meta_data->>'role')::user_role, 'filmmaker');
begin
  insert into public.profiles (id, role, full_name, approval_status)
  values (
    new.id,
    v_role,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    case when v_role in ('producer','investor','organization') then 'pending'::approval_status
         else 'approved'::approval_status end
  );
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- updated_at maintenance ----------
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
create trigger trg_profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger trg_projects_touch before update on public.projects for each row execute function public.touch_updated_at();
create trigger trg_apps_touch before update on public.applications for each row execute function public.touch_updated_at();
create trigger trg_offers_touch before update on public.offers for each row execute function public.touch_updated_at();

-- ---------- Notify filmmaker when an offer arrives ----------
create or replace function public.notify_offer() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, kind, title, body, link)
  select p.owner_id, 'offer_received',
         'New offer on "' || p.title || '"',
         'A verified producer/investor sent you an offer.',
         '/dashboard/projects/' || p.id
  from public.projects p where p.id = new.project_id;
  return new;
end $$;
create trigger trg_offer_notify after insert on public.offers
  for each row execute function public.notify_offer();

-- ============================================================
-- ROW LEVEL SECURITY  (every table — audit finding resolved)
-- ============================================================
alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.projects enable row level security;
alter table public.opportunities enable row level security;
alter table public.applications enable row level security;
alter table public.saved_opportunities enable row level security;
alter table public.matches enable row level security;
alter table public.offers enable row level security;
alter table public.notifications enable row level security;
alter table public.activity_logs enable row level security;
alter table public.audit_logs enable row level security;

-- PROFILES
create policy "read own profile" on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "read public industry identity" on public.profiles for select using (true); -- names/companies are public identity; sensitive data is not stored here
create policy "update own profile" on public.profiles for update using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid())); -- users cannot self-promote role
create policy "admin manage profiles" on public.profiles for update using (public.is_admin());

-- ORGANIZATIONS
create policy "orgs readable" on public.organizations for select using (true);
create policy "owner insert org" on public.organizations for insert with check (owner_id = auth.uid());
create policy "owner update org" on public.organizations for update using (owner_id = auth.uid() or public.is_admin());
create policy "owner delete org" on public.organizations for delete using (owner_id = auth.uid() or public.is_admin());

-- PROJECTS — filmmakers own; approved industry can view public ones
create policy "owner full read" on public.projects for select
  using (owner_id = auth.uid() or public.is_admin() or (is_public and public.is_approved_industry()));
create policy "owner insert project" on public.projects for insert with check (owner_id = auth.uid());
create policy "owner update project" on public.projects for update using (owner_id = auth.uid() or public.is_admin());
create policy "owner delete project" on public.projects for delete using (owner_id = auth.uid() or public.is_admin());

-- OPPORTUNITIES — readable by any signed-in user; managed by admin
create policy "opps readable" on public.opportunities for select using (auth.uid() is not null);
create policy "admin insert opps" on public.opportunities for insert with check (public.is_admin());
create policy "admin update opps" on public.opportunities for update using (public.is_admin());
create policy "admin delete opps" on public.opportunities for delete using (public.is_admin());

-- APPLICATIONS
create policy "own applications" on public.applications for select
  using (applicant_id = auth.uid() or public.is_admin());
create policy "create own application" on public.applications for insert
  with check (applicant_id = auth.uid()
    and exists (select 1 from public.projects pr where pr.id = project_id and pr.owner_id = auth.uid()));
create policy "update own application" on public.applications for update
  using (applicant_id = auth.uid() or public.is_admin());
create policy "delete own application" on public.applications for delete using (applicant_id = auth.uid());

-- SAVED OPPORTUNITIES
create policy "own saved" on public.saved_opportunities for select using (user_id = auth.uid());
create policy "save" on public.saved_opportunities for insert with check (user_id = auth.uid());
create policy "unsave" on public.saved_opportunities for delete using (user_id = auth.uid());

-- MATCHES — visible to project owner
create policy "own matches" on public.matches for select
  using (exists (select 1 from public.projects pr where pr.id = project_id and pr.owner_id = auth.uid()) or public.is_admin());
create policy "owner write matches" on public.matches for insert
  with check (exists (select 1 from public.projects pr where pr.id = project_id and pr.owner_id = auth.uid()));
create policy "owner update matches" on public.matches for update
  using (exists (select 1 from public.projects pr where pr.id = project_id and pr.owner_id = auth.uid()));

-- OFFERS — sender + project owner can read; only approved industry can send
create policy "offer visibility" on public.offers for select
  using (from_user_id = auth.uid()
     or exists (select 1 from public.projects pr where pr.id = project_id and pr.owner_id = auth.uid())
     or public.is_admin());
create policy "approved industry can offer" on public.offers for insert
  with check (from_user_id = auth.uid() and public.is_approved_industry());
create policy "sender or owner update offer" on public.offers for update
  using (from_user_id = auth.uid()
     or exists (select 1 from public.projects pr where pr.id = project_id and pr.owner_id = auth.uid()));

-- NOTIFICATIONS
create policy "own notifications" on public.notifications for select using (user_id = auth.uid());
create policy "mark read" on public.notifications for update using (user_id = auth.uid());

-- ACTIVITY LOGS
create policy "own activity" on public.activity_logs for select using (user_id = auth.uid() or public.is_admin());
create policy "write own activity" on public.activity_logs for insert with check (user_id = auth.uid());

-- AUDIT LOGS — admin only
create policy "admin read audit" on public.audit_logs for select using (public.is_admin());
create policy "admin write audit" on public.audit_logs for insert with check (public.is_admin());

-- ============================================================
-- STORAGE BUCKETS (private — script & deck security)
-- ============================================================
insert into storage.buckets (id, name, public) values ('pitch-decks','pitch-decks', false)
  on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('scripts','scripts', false)
  on conflict (id) do nothing;

create policy "owner uploads decks" on storage.objects for insert
  with check (bucket_id = 'pitch-decks' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "deck read access" on storage.objects for select
  using (bucket_id = 'pitch-decks' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_approved_industry() or public.is_admin()));
create policy "owner uploads scripts" on storage.objects for insert
  with check (bucket_id = 'scripts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "script read access" on storage.objects for select
  using (bucket_id = 'scripts' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_approved_industry() or public.is_admin()));
create policy "owner deletes own files" on storage.objects for delete
  using (bucket_id in ('pitch-decks','scripts') and (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================
-- SEED — starter opportunities (verified, public sources)
-- ============================================================
insert into public.opportunities (title, opp_type, description, country, region, genres, formats, stages, languages, max_award_usd, url, is_active) values
('Hubert Bals Fund — Script & Project Development','fund','IFFR fund for feature projects from Africa, Asia, Latin America, Middle East and parts of Eastern Europe.',null,'Global South','{}','{feature}','{development}','{}',11000,'https://iffr.com/en/professionals/hubert-bals-fund',true),
('NFDC Film Bazaar Co-Production Market','market','India''s leading co-production market connecting South Asian projects with global producers and financiers.','India','Asia-Pacific','{}','{feature,documentary}','{development,pre_production}','{}',null,'https://filmbazaarindia.com',true),
('Sundance Institute Feature Film Program','lab','Year-round labs and grants for independent fiction features.',null,'Americas','{drama}','{feature}','{development}','{English}',null,'https://www.sundance.org/programs/feature-film-program',true),
('Eurimages Co-Production Support','fund','Council of Europe fund supporting co-productions between member states.',null,'Europe','{}','{feature,documentary,animation}','{pre_production,production}','{}',550000,'https://www.coe.int/en/web/eurimages',true),
('Berlinale World Cinema Fund','fund','Supports feature films from regions with weak film infrastructure; strong fit for South Asian arthouse.',null,'Europe','{}','{feature,documentary}','{production,post_production}','{}',88000,'https://www.berlinale.de/en/world-cinema-fund/home.html',true),
('Asian Cinema Fund — Busan IFF','fund','Script development, post-production and documentary funds for Asian filmmakers.',null,'Asia-Pacific','{}','{feature,documentary}','{development,post_production}','{}',45000,'https://acf.biff.kr',true),
('Doha Film Institute Grants','grant','Grants for first- and second-time filmmakers from the MENA region and beyond.',null,'Middle East','{}','{feature,short,documentary}','{development,production,post_production}','{}',75000,'https://www.dohafilminstitute.com/financing/grants',true),
('Rotterdam Lab — Producer Training','lab','Five-day training for emerging producers attending CineMart.',null,'Europe','{}','{feature}','{development}','{}',null,'https://iffr.com/en/professionals/rotterdam-lab',true),
('Cannes Marché du Film — Producers Network','market','Matchmaking platform for active producers at the world''s largest film market.','France','Europe','{}','{feature,documentary}','{development,pre_production,production}','{}',null,'https://www.marchedufilm.com',true),
('Visions Sud Est','fund','Swiss fund supporting production and post-production in Asia, Africa, Latin America and Eastern Europe.','Switzerland','Europe','{}','{feature,documentary}','{production,post_production}','{}',55000,'https://www.visionssudest.ch',true);

-- ============================================================
-- AFTER RUNNING:
-- 1) Create your own account via the app, then promote it:
--    update public.profiles set role='admin' where id = 'YOUR-USER-UUID';
-- 2) Auth > URL Configuration: add your Cloudflare domain + /auth/callback
-- 3) Auth > Providers: enable Google (paste OAuth client ID/secret)
-- ============================================================
