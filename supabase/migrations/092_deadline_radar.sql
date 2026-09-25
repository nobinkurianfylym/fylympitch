-- ============================================================
-- FYLYMPITCH — Migration 092: Deadline Radar
--
-- Per filmmaker, per project: the funds they already match that
-- close soon. Written to the notification tab under its own kind
-- so it can carry its own colour.
--
-- Admin-triggered only. Nothing here runs on a schedule.
--
-- public.notifications has no INSERT policy, so every app-side
-- insert for another user fails silently. The send function is
-- SECURITY DEFINER for exactly that reason, and gates on the
-- caller's admin role itself rather than trusting the caller.
--
-- deadline_radar_alerts is the de-duplication ledger: the same
-- (project, opportunity, deadline) is never alerted twice, so an
-- admin can click the button repeatedly without spamming anyone.
-- The deadline is part of the key, so next year's edition of the
-- same fund alerts again.
-- ============================================================

create table if not exists public.deadline_radar_alerts (
  project_id     uuid not null references public.projects(id)      on delete cascade,
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  deadline       date not null,
  user_id        uuid not null references auth.users(id)           on delete cascade,
  notified_at    timestamptz not null default now(),
  primary key (project_id, opportunity_id, deadline)
);

create index if not exists deadline_radar_alerts_user_idx
  on public.deadline_radar_alerts (user_id, notified_at desc);

create table if not exists public.deadline_radar_runs (
  id            uuid primary key default gen_random_uuid(),
  triggered_by  uuid references auth.users(id) on delete set null,
  triggered_at  timestamptz not null default now(),
  window_days   int  not null,
  min_score     int  not null,
  dry_run       boolean not null default false,
  filmmakers    int  not null default 0,
  projects      int  not null default 0,
  alerts        int  not null default 0,
  emailed       int  not null default 0
);

create index if not exists deadline_radar_runs_recent_idx
  on public.deadline_radar_runs (triggered_at desc);

alter table public.deadline_radar_alerts enable row level security;
alter table public.deadline_radar_runs   enable row level security;

revoke all on public.deadline_radar_alerts from anon, authenticated;
revoke all on public.deadline_radar_runs   from anon, authenticated;

-- The alerts ledger stays closed to everyone: it is written only by the
-- SECURITY DEFINER function and never read by the app. The run log is read
-- by the admin panel, so admins get SELECT and nobody else does.
grant select on public.deadline_radar_runs to authenticated;

drop policy if exists "admins read radar runs" on public.deadline_radar_runs;
create policy "admins read radar runs" on public.deadline_radar_runs
  for select
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ));

-- ── The one query, shared by preview and send ─────────────────
-- p_dry_run = true computes and returns the payload without
-- writing notifications or marking anything as alerted.

create or replace function public.deadline_radar_run(
  p_window_days int     default 60,
  p_min_score   int     default 70,
  p_dry_run     boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  is_admin   boolean;
  payload    jsonb;
  n_people   int := 0;
  n_projects int := 0;
  n_alerts   int := 0;
  run_id     uuid;
begin
  select (role = 'admin') into is_admin
  from public.profiles where id = auth.uid();

  if coalesce(is_admin, false) is not true then
    raise exception 'deadline_radar_run: admin only';
  end if;

  if p_window_days is null or p_window_days < 1 or p_window_days > 365 then
    raise exception 'window_days must be between 1 and 365';
  end if;

  if p_min_score is null or p_min_score < 0 or p_min_score > 100 then
    raise exception 'min_score must be between 0 and 100';
  end if;

  create temporary table tmp_radar on commit drop as
  with due as (
    select
      p.owner_id                          as user_id,
      p.id                                as project_id,
      p.title                             as project_title,
      o.id                                as opportunity_id,
      o.title                             as opp_title,
      nullif(trim(o.organization_name), '') as org_name,
      o.deadline                          as deadline,
      (o.deadline - current_date)         as days_left,
      coalesce(m.hybrid_score, m.score)   as score,
      row_number() over (
        partition by p.id
        order by o.deadline asc, coalesce(m.hybrid_score, m.score) desc
      ) as rn
    from public.matches m
    join public.projects p       on p.id = m.project_id
    join public.opportunities o  on o.id = m.opportunity_id
    join public.profiles pr      on pr.id = p.owner_id
    where o.is_active = true
      and o.deadline is not null
      and o.deadline >= current_date
      and o.deadline <= current_date + make_interval(days => p_window_days)
      and coalesce(m.hybrid_score, m.score) >= p_min_score
      and pr.role = 'filmmaker'
      and not exists (
        select 1
        from public.deadline_radar_alerts a
        where a.project_id     = m.project_id
          and a.opportunity_id = m.opportunity_id
          and a.deadline       = o.deadline
      )
  )
  select * from due where rn <= 5;

  select
    count(distinct user_id),
    count(distinct project_id),
    count(*)
  into n_people, n_projects, n_alerts
  from tmp_radar;

  with per_project as (
    select
      user_id,
      project_id,
      project_title,
      jsonb_agg(
        jsonb_build_object(
          'opportunity_id', opportunity_id,
          'title',          opp_title,
          'organization',   org_name,
          'deadline',       deadline,
          'days_left',      days_left,
          'score',          score
        ) order by deadline asc
      ) as items
    from tmp_radar
    group by user_id, project_id, project_title
  ),
  per_person as (
    select
      user_id,
      jsonb_agg(
        jsonb_build_object(
          'project_id', project_id,
          'title',      project_title,
          'items',      items
        ) order by project_title asc
      ) as projects
    from per_project
    group by user_id
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'user_id',  pp.user_id,
        'name',     coalesce(nullif(trim(pr.full_name), ''), 'there'),
        'projects', pp.projects
      ) order by pr.full_name asc
    ),
    '[]'::jsonb
  )
  into payload
  from per_person pp
  join public.profiles pr on pr.id = pp.user_id;

  if p_dry_run then
    insert into public.deadline_radar_runs
      (triggered_by, window_days, min_score, dry_run, filmmakers, projects, alerts)
    values (auth.uid(), p_window_days, p_min_score, true, n_people, n_projects, n_alerts)
    returning id into run_id;

    return jsonb_build_object(
      'run_id', run_id, 'dry_run', true,
      'filmmakers', n_people, 'projects', n_projects, 'alerts', n_alerts,
      'recipients', payload
    );
  end if;

  insert into public.notifications (user_id, kind, title, body, link, project_id)
  select
    g.user_id,
    'deadline_radar',
    case when g.n = 1
      then '1 deadline closing for ' || g.project_title
      else g.n || ' deadlines closing for ' || g.project_title
    end,
    g.body,
    '/dashboard/projects/' || g.project_id,
    g.project_id
  from (
    select
      user_id,
      project_id,
      project_title,
      count(*) as n,
      string_agg(
        coalesce(org_name, opp_title)
          || ' closes '
          || case
               when days_left = 0 then 'today'
               when days_left = 1 then 'tomorrow'
               else 'in ' || days_left || ' days'
             end
          || ' (match ' || score || ')',
        '. ' order by deadline asc
      ) || '.' as body
    from tmp_radar
    group by user_id, project_id, project_title
  ) g;

  insert into public.deadline_radar_alerts (project_id, opportunity_id, deadline, user_id)
  select project_id, opportunity_id, deadline, user_id from tmp_radar
  on conflict (project_id, opportunity_id, deadline) do nothing;

  insert into public.deadline_radar_runs
    (triggered_by, window_days, min_score, dry_run, filmmakers, projects, alerts)
  values (auth.uid(), p_window_days, p_min_score, false, n_people, n_projects, n_alerts)
  returning id into run_id;

  return jsonb_build_object(
    'run_id', run_id, 'dry_run', false,
    'filmmakers', n_people, 'projects', n_projects, 'alerts', n_alerts,
    'recipients', payload
  );
end;
$fn$;

create or replace function public.deadline_radar_mark_emailed(
  p_run_id uuid,
  p_count  int
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  is_admin boolean;
begin
  select (role = 'admin') into is_admin
  from public.profiles where id = auth.uid();

  if coalesce(is_admin, false) is not true then
    raise exception 'deadline_radar_mark_emailed: admin only';
  end if;

  update public.deadline_radar_runs
  set emailed = greatest(0, coalesce(p_count, 0))
  where id = p_run_id;
end;
$fn$;

revoke all on function public.deadline_radar_run(int, int, boolean)   from anon;
revoke all on function public.deadline_radar_mark_emailed(uuid, int)  from anon;
grant execute on function public.deadline_radar_run(int, int, boolean)  to authenticated;
grant execute on function public.deadline_radar_mark_emailed(uuid, int) to authenticated;
