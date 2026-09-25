-- ============================================================
-- FYLYMPITCH — Migration 094: Deadline Radar sees "open now"
--
-- 093 revealed 115 rolling programmes that are open today. The
-- Radar could not see any of them, because it filtered on
-- `deadline >= current_date` and a rolling fund has no deadline.
-- It was alerting on 64 records out of 662.
--
-- Now it sends two kinds of alert:
--   closing — a fixed date inside the window, urgent, red
--   open    — rolling, accepting applications today, not urgent
--
-- Annual programmes are deliberately NOT alerted. Their month is
-- inferred from last year's page and moves; presenting that as a
-- date a filmmaker can plan around would be the one thing that
-- makes this feature untrustworthy. They stay visible in the
-- catalogue, they just do not generate a notification.
--
-- The alerts ledger needs no schema change. A rolling fund is
-- recorded against the sentinel date 0001-01-01, meaning "no
-- date", so it alerts once per project and never repeats. If it
-- later gains a real deadline it alerts again under that date,
-- which is correct: that is new information.
-- ============================================================

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
  with candidate as (
    select
      p.owner_id                            as user_id,
      p.id                                  as project_id,
      p.title                               as project_title,
      o.id                                  as opportunity_id,
      o.title                               as opp_title,
      nullif(trim(o.organization_name), '') as org_name,
      o.deadline                            as deadline,
      case when o.deadline is not null
           then (o.deadline - current_date) end as days_left,
      coalesce(m.hybrid_score, m.score)     as score,
      case when o.deadline_type = 'fixed' then 'closing' else 'open' end as alert_kind,
      case when o.deadline_type = 'fixed'
           then o.deadline
           else date '0001-01-01' end       as ledger_key
    from public.matches m
    join public.projects p       on p.id = m.project_id
    join public.opportunities o  on o.id = m.opportunity_id
    join public.profiles pr      on pr.id = p.owner_id
    where o.is_active = true
      and pr.role = 'filmmaker'
      and coalesce(m.hybrid_score, m.score) >= p_min_score
      and (
        (o.deadline_type = 'fixed'
          and o.deadline is not null
          and o.deadline >= current_date
          and o.deadline <= current_date + make_interval(days => p_window_days))
        or
        (o.deadline_type = 'rolling')
      )
  ),
  fresh as (
    select c.*
    from candidate c
    where not exists (
      select 1
      from public.deadline_radar_alerts a
      where a.project_id     = c.project_id
        and a.opportunity_id = c.opportunity_id
        and a.deadline       = c.ledger_key
    )
  ),
  ranked as (
    select f.*,
      row_number() over (
        partition by f.project_id, f.alert_kind
        order by f.deadline asc nulls last, f.score desc
      ) as rn
    from fresh f
  )
  select * from ranked where rn <= 5;

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
          'score',          score,
          'kind',           alert_kind
        ) order by alert_kind asc, deadline asc nulls last
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
    case when g.alert_kind = 'closing' then 'deadline_radar' else 'radar_open' end,
    case
      when g.alert_kind = 'closing' and g.n = 1
        then '1 deadline closing for ' || g.project_title
      when g.alert_kind = 'closing'
        then g.n || ' deadlines closing for ' || g.project_title
      when g.n = 1
        then '1 fund open now for ' || g.project_title
      else g.n || ' funds open now for ' || g.project_title
    end,
    g.body,
    '/dashboard/projects/' || g.project_id,
    g.project_id
  from (
    select
      user_id,
      project_id,
      project_title,
      alert_kind,
      count(*) as n,
      string_agg(
        coalesce(org_name, opp_title)
          || case
               when alert_kind = 'open' then ' accepts applications year-round'
               when days_left = 0 then ' closes today'
               when days_left = 1 then ' closes tomorrow'
               else ' closes in ' || days_left || ' days'
             end
          || ' (match ' || score || ')',
        '. ' order by deadline asc nulls last, score desc
      ) || '.' as body
    from tmp_radar
    group by user_id, project_id, project_title, alert_kind
  ) g;

  insert into public.deadline_radar_alerts (project_id, opportunity_id, deadline, user_id)
  select project_id, opportunity_id, ledger_key, user_id from tmp_radar
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

revoke all on function public.deadline_radar_run(int, int, boolean) from anon;
grant execute on function public.deadline_radar_run(int, int, boolean) to authenticated;
