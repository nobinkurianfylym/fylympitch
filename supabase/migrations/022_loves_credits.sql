-- ============================================================
-- Migration 022: Project loves + filmmaker credits
-- ============================================================

-- project_loves
create table public.project_loves (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, project_id)
);

create index on public.project_loves (project_id);

alter table public.project_loves enable row level security;
create policy "loves visible to all"   on public.project_loves for select using (true);
create policy "users can love"         on public.project_loves for insert with check (user_id = auth.uid());
create policy "users can unlove"       on public.project_loves for delete using (user_id = auth.uid());

-- love_count cached column on projects
alter table public.projects add column if not exists love_count integer not null default 0;

-- trigger to keep love_count in sync
create or replace function public.sync_project_love_count()
returns trigger language plpgsql as $$
begin
  if TG_OP = 'INSERT' then
    update public.projects set love_count = love_count + 1 where id = NEW.project_id;
  elsif TG_OP = 'DELETE' then
    update public.projects set love_count = greatest(0, love_count - 1) where id = OLD.project_id;
  end if;
  return null;
end;
$$;

create trigger trg_sync_love_count
  after insert or delete on public.project_loves
  for each row execute function public.sync_project_love_count();

-- filmmaker_credits
create table public.filmmaker_credits (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  title       text not null,
  year        integer,
  format      text,
  festivals   text[] not null default '{}',
  awards      text[] not null default '{}',
  is_featured boolean not null default false,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create index on public.filmmaker_credits (user_id);

alter table public.filmmaker_credits enable row level security;
create policy "credits visible to all"  on public.filmmaker_credits for select using (true);
create policy "owner manages credits"   on public.filmmaker_credits for all using (user_id = auth.uid());

-- career_stage on profiles
alter table public.profiles
  add column if not exists career_stage text
  check (career_stage in ('debut','second_film','established','veteran'));
