-- ============================================================
-- FYLYMPITCH — Migration 095: Application outcomes
--
-- Everything on the platform is an input. Nothing records whether
-- any of it worked. Applications sit at their initial status
-- forever, because no filmmaker returns to a dashboard to update
-- a field, so the single most important fact about PITCH.FYLYM —
-- has anyone actually been funded through it — is unknowable.
--
-- This asks. Once, three weeks after the deadline passed, in the
-- notification tab, as three buttons. Never twice, and a dismiss
-- means never again for that application.
--
-- The answer feeds two things: the admin outcomes page, which is
-- where a fundable success story becomes visible, and the
-- historical-success criterion in the match engine, which is
-- currently guessing.
-- ============================================================

alter table public.applications
  add column if not exists outcome_reported_at  timestamptz,
  add column if not exists outcome_dismissed_at timestamptz;

create index if not exists idx_applications_outcome_open
  on public.applications (opportunity_id)
  where outcome_reported_at is null and outcome_dismissed_at is null;

-- Asked once, ever. A rejected filmmaker being nudged a second
-- time is worse than never asking at all.
create table if not exists public.application_outcome_asks (
  application_id uuid primary key references public.applications(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  asked_at       timestamptz not null default now()
);

create table if not exists public.application_outcome_runs (
  id           uuid primary key default gen_random_uuid(),
  triggered_by uuid references auth.users(id) on delete set null,
  triggered_at timestamptz not null default now(),
  weeks_after  int not null,
  dry_run      boolean not null default false,
  filmmakers   int not null default 0,
  asks         int not null default 0
);

alter table public.application_outcome_asks enable row level security;
alter table public.application_outcome_runs enable row level security;

revoke all on public.application_outcome_asks from anon, authenticated;
revoke all on public.application_outcome_runs from anon, authenticated;

grant select on public.application_outcome_runs to authenticated;

drop policy if exists "admins read outcome runs" on public.application_outcome_runs;
create policy "admins read outcome runs" on public.application_outcome_runs
  for select
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ));

-- ── Ask ───────────────────────────────────────────────────────
-- SECURITY DEFINER because public.notifications has no INSERT
-- policy, so an app-side insert for another user fails silently.

create or replace function public.application_outcome_run(
  p_weeks_after int     default 3,
  p_dry_run     boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  is_admin boolean;
  payload  jsonb;
  n_people int := 0;
  n_asks   int := 0;
  run_id   uuid;
begin
  select (role = 'admin') into is_admin
  from public.profiles where id = auth.uid();

  if coalesce(is_admin, false) is not true then
    raise exception 'application_outcome_run: admin only';
  end if;

  if p_weeks_after is null or p_weeks_after < 1 or p_weeks_after > 52 then
    raise exception 'weeks_after must be between 1 and 52';
  end if;

  create temporary table tmp_ask on commit drop as
  select
    a.id                                  as application_id,
    a.applicant_id                        as user_id,
    a.project_id                          as project_id,
    p.title                               as project_title,
    coalesce(nullif(trim(o.organization_name), ''), o.title) as fund_name,
    o.deadline                            as deadline,
    a.created_at::date                    as applied_on
  from public.applications a
  join public.opportunities o on o.id = a.opportunity_id
  join public.projects p      on p.id = a.project_id
  where a.status not in ('accepted', 'rejected', 'withdrawn')
    and a.outcome_reported_at  is null
    and a.outcome_dismissed_at is null
    and not exists (
      select 1 from public.application_outcome_asks k
      where k.application_id = a.id
    )
    and (
      (o.deadline is not null
        and o.deadline <= current_date - make_interval(weeks => p_weeks_after))
      or
      (o.deadline is null
        and a.created_at <= now() - make_interval(weeks => p_weeks_after + 4))
    );

  select count(distinct user_id), count(*) into n_people, n_asks from tmp_ask;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'application_id', t.application_id,
        'name',           coalesce(nullif(trim(pr.full_name), ''), 'there'),
        'project',        t.project_title,
        'fund',           t.fund_name,
        'applied_on',     t.applied_on,
        'deadline',       t.deadline
      ) order by t.fund_name asc
    ),
    '[]'::jsonb
  )
  into payload
  from tmp_ask t
  join public.profiles pr on pr.id = t.user_id;

  if p_dry_run then
    insert into public.application_outcome_runs
      (triggered_by, weeks_after, dry_run, filmmakers, asks)
    values (auth.uid(), p_weeks_after, true, n_people, n_asks)
    returning id into run_id;

    return jsonb_build_object(
      'run_id', run_id, 'dry_run', true,
      'filmmakers', n_people, 'asks', n_asks, 'items', payload
    );
  end if;

  insert into public.notifications (user_id, kind, title, body, link, project_id)
  select
    t.user_id,
    'outcome_ask',
    'How did ' || t.fund_name || ' go for ' || t.project_title || '?',
    'You applied on ' || to_char(t.applied_on, 'DD Mon YYYY')
      || '. One tap and we will not ask again.',
    '/dashboard/applications?ask=' || t.application_id,
    t.project_id
  from tmp_ask t;

  insert into public.application_outcome_asks (application_id, user_id)
  select application_id, user_id from tmp_ask
  on conflict (application_id) do nothing;

  insert into public.application_outcome_runs
    (triggered_by, weeks_after, dry_run, filmmakers, asks)
  values (auth.uid(), p_weeks_after, false, n_people, n_asks)
  returning id into run_id;

  return jsonb_build_object(
    'run_id', run_id, 'dry_run', false,
    'filmmakers', n_people, 'asks', n_asks, 'items', payload
  );
end;
$fn$;

-- ── Answer ────────────────────────────────────────────────────
-- Runs as the filmmaker. The applicant_id check is the whole
-- authorisation: you can only answer for your own application.

create or replace function public.record_application_outcome(
  p_application_id uuid,
  p_outcome        text
)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  n int;
begin
  if p_outcome not in ('accepted', 'rejected', 'waiting', 'dismiss') then
    raise exception 'unknown outcome';
  end if;

  if p_outcome = 'dismiss' then
    update public.applications
    set    outcome_dismissed_at = now(),
           updated_at = now()
    where  id = p_application_id
      and  applicant_id = auth.uid();
  elsif p_outcome = 'waiting' then
    update public.applications
    set    status = 'under_review',
           outcome_reported_at = now(),
           updated_at = now()
    where  id = p_application_id
      and  applicant_id = auth.uid();
  else
    update public.applications
    set    status = p_outcome::application_status,
           outcome_reported_at = now(),
           updated_at = now()
    where  id = p_application_id
      and  applicant_id = auth.uid();
  end if;

  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'not your application';
  end if;
end;
$fn$;

-- ── Read ──────────────────────────────────────────────────────
-- Everything the admin outcomes page shows, in one call.

create or replace function public.application_outcome_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  is_admin boolean;
  result   jsonb;
begin
  select (role = 'admin') into is_admin
  from public.profiles where id = auth.uid();

  if coalesce(is_admin, false) is not true then
    raise exception 'application_outcome_stats: admin only';
  end if;

  select jsonb_build_object(
    'tracked',  (select count(*) from public.applications),
    'asked',    (select count(*) from public.application_outcome_asks),
    'reported', (select count(*) from public.applications where outcome_reported_at is not null),
    'funded',   (select count(*) from public.applications where status = 'accepted'),
    'declined', (select count(*) from public.applications where status = 'rejected'),
    'waiting',  (select count(*) from public.applications where status = 'under_review'),
    'wins', (
      select coalesce(jsonb_agg(w order by w->>'reported_at' desc), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'project',    p.title,
          'filmmaker',  coalesce(nullif(trim(pr.full_name), ''), 'Unnamed'),
          'country',    nullif(trim(p.country), ''),
          'fund',       coalesce(nullif(trim(o.organization_name), ''), o.title),
          'programme',  o.title,
          'award_usd',  o.max_award_usd,
          'reported_at', a.outcome_reported_at
        ) as w
        from public.applications a
        join public.projects p      on p.id = a.project_id
        join public.opportunities o on o.id = a.opportunity_id
        join public.profiles pr     on pr.id = a.applicant_id
        where a.status = 'accepted'
      ) wins_q
    ),
    'by_fund', (
      select coalesce(jsonb_agg(f order by (f->>'funded')::int desc), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'fund',     coalesce(nullif(trim(o.organization_name), ''), o.title),
          'applied',  count(*),
          'funded',   count(*) filter (where a.status = 'accepted'),
          'declined', count(*) filter (where a.status = 'rejected')
        ) as f
        from public.applications a
        join public.opportunities o on o.id = a.opportunity_id
        group by coalesce(nullif(trim(o.organization_name), ''), o.title)
        having count(*) filter (where a.status in ('accepted','rejected')) > 0
      ) fund_q
    )
  ) into result;

  return result;
end;
$fn$;

revoke all on function public.application_outcome_run(int, boolean)         from anon;
revoke all on function public.record_application_outcome(uuid, text)        from anon;
revoke all on function public.application_outcome_stats()                   from anon;
grant execute on function public.application_outcome_run(int, boolean)      to authenticated;
grant execute on function public.record_application_outcome(uuid, text)     to authenticated;
grant execute on function public.application_outcome_stats()                to authenticated;
