-- ============================================================
-- FYLYMPITCH — Migration 098: Admin pitch overview
--
-- An admin can already read every project, but nothing in the
-- admin UI ever reads target_producer_id, so a private pitch was
-- visible as "a private project" without showing who it was sent
-- to. Producer applications had no admin surface at all.
--
-- This returns both in one call: exclusive pitches (a project
-- assigned to one producer) and applications to opportunities a
-- producer posted.
--
-- SECURITY DEFINER because the shape of RLS on applications is
-- not something this page should depend on, and a permissions
-- gap here would show an empty list rather than an error, which
-- is the worst possible failure for an oversight tool.
-- ============================================================

create or replace function public.admin_pitch_overview(p_limit int default 200)
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
    raise exception 'admin_pitch_overview: admin only';
  end if;

  select jsonb_build_object(
    'exclusive', (
      select coalesce(jsonb_agg(x order by x->>'created_at' desc), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'project_id',   p.id,
          'slug',         p.slug,
          'title',        p.title,
          'format',       p.format,
          'country',      nullif(trim(p.country), ''),
          'is_public',    p.is_public,
          'admin_hidden', p.admin_hidden,
          'created_at',   p.created_at,
          'filmmaker',    coalesce(nullif(trim(fm.full_name), ''), 'Unnamed'),
          'filmmaker_id', fm.id,
          'producer',     coalesce(nullif(trim(pr.company), ''), nullif(trim(pr.full_name), ''), 'Unknown'),
          'producer_id',  pr.id,
          'producer_username', pr.username
        ) as x
        from public.projects p
        join public.profiles fm on fm.id = p.owner_id
        left join public.profiles pr on pr.id = p.target_producer_id
        where p.target_producer_id is not null
        order by p.created_at desc
        limit p_limit
      ) q
    ),
    'applications', (
      select coalesce(jsonb_agg(y order by y->>'created_at' desc), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'application_id', a.id,
          'created_at',     a.created_at,
          'status',         a.status,
          'match_score',    a.match_score,
          'project_id',     p.id,
          'project',        p.title,
          'is_public',      p.is_public,
          'filmmaker',      coalesce(nullif(trim(fm.full_name), ''), 'Unnamed'),
          'filmmaker_id',   fm.id,
          'opportunity',    o.title,
          'opportunity_id', o.id,
          'producer',       coalesce(nullif(trim(pr.company), ''), nullif(trim(pr.full_name), ''), 'Unknown'),
          'producer_id',    pr.id,
          'producer_username', pr.username
        ) as y
        from public.applications a
        join public.opportunities o on o.id = a.opportunity_id
        join public.projects p      on p.id = a.project_id
        join public.profiles fm     on fm.id = a.applicant_id
        left join public.profiles pr on pr.id = o.posted_by_producer_id
        where o.posted_by_producer_id is not null
        order by a.created_at desc
        limit p_limit
      ) q
    ),
    'counts', jsonb_build_object(
      'exclusive_total',   (select count(*) from public.projects where target_producer_id is not null),
      'exclusive_private', (select count(*) from public.projects where target_producer_id is not null and is_public = false),
      'applications_total',(select count(*) from public.applications a
                            join public.opportunities o on o.id = a.opportunity_id
                            where o.posted_by_producer_id is not null),
      'unread_producers',  (select count(distinct target_producer_id) from public.projects where target_producer_id is not null)
    )
  ) into result;

  return result;
end;
$fn$;

revoke all on function public.admin_pitch_overview(int) from anon;
grant execute on function public.admin_pitch_overview(int) to authenticated;
