-- ============================================================================
-- FYLYMPITCH - Migration 088: name the filmmaker on an exclusive pitch
--
-- The sweep after 087 found one more function with the same pattern:
-- notify_exclusive_pitch. Two spots, and they are NOT equally serious.
--
-- REAL BUG -- the in-app notification title:
--
--     coalesce(company, full_name, 'A filmmaker')
--
-- A filmmaker whose company field holds '' gets past coalesce, because
-- coalesce skips NULL and not ''. The producer's notification then reads
--
--     " pitched "Dissolution" directly to you"
--
-- with no name. This is the moment a producer decides whether to open a
-- pitch, and it arrives from nobody. Same failure that showed up in three of
-- four producer_interest rows.
--
-- COSMETIC -- the producer_name returned for the email:
--
--     coalesce(pr.full_name, pr.company)
--
-- Same '' problem, and no final fallback either, so it can return '' or NULL.
-- But lib/email.ts line 441 already guards it:
--     ${first ? `Hi ${first},` : "Hello,"}
-- so a blank name renders "Hello," and nothing looks broken. Tidied here
-- because returning '' where a name is expected is a trap for the next caller
-- that does not guard, not because anything is visibly wrong today.
--
-- Worth noting: line 64 of 074 already used nullif(trim(...), '') for the
-- logline. The technique was known in one place in the same function and not
-- applied in the other two.
--
-- $fn$ rather than $$, and no comments in the body: the Supabase SQL editor
-- misreads a DECLARE block as a table and splices
-- "ALTER TABLE v_title ENABLE ROW LEVEL SECURITY;" into the middle of it.
-- ============================================================================

create or replace function public.notify_exclusive_pitch(p_project_id uuid)
  returns table (
    producer_email text,
    producer_name  text,
    project_title  text,
    filmmaker_name text
  )
  language plpgsql security definer set search_path = public
as $fn$
declare
  v_owner     uuid;
  v_target    uuid;
  v_title     text;
  v_logline   text;
  v_filmmaker text;
begin
  select p.owner_id, p.target_producer_id, p.title, p.logline
    into v_owner, v_target, v_title, v_logline
  from   public.projects p
  where  p.id = p_project_id;

  if v_owner is null or v_owner <> auth.uid() then return; end if;
  if v_target is null then return; end if;

  select coalesce(
           nullif(trim(company),   ''),
           nullif(trim(full_name), ''),
           'A filmmaker'
         )
    into v_filmmaker
  from   public.profiles
  where  id = v_owner;

  v_filmmaker := coalesce(v_filmmaker, 'A filmmaker');

  if exists (
    select 1 from public.notifications
    where  user_id = v_target
      and  kind = 'exclusive_pitch'
      and  project_id = p_project_id
  ) then
    return;
  end if;

  insert into public.notifications (user_id, kind, title, body, link, project_id)
  values (
    v_target,
    'exclusive_pitch',
    v_filmmaker || ' pitched "' || v_title || '" directly to you',
    coalesce(nullif(trim(coalesce(v_logline, '')), ''),
             'Sent to you and nobody else. Open Producer Studio to read it.'),
    '/producerstudio/projects/' || p_project_id::text,
    p_project_id
  );

  return query
    select pr.email,
           coalesce(nullif(trim(pr.full_name), ''), nullif(trim(pr.company), '')),
           v_title,
           v_filmmaker
    from   public.profiles pr
    where  pr.id = v_target;
end;
$fn$;

grant execute on function public.notify_exclusive_pitch(uuid) to authenticated;


-- ---------- Check ----------
select proname,
       case when prosrc ilike '%nullif(trim(company)%' then 'guarded' else 'STILL BARE' end as company_guard
from   pg_proc
where  pronamespace = 'public'::regnamespace
  and  prosrc ilike '%coalesce(company%' or proname in ('notify_producer_interest','notify_exclusive_pitch')
order  by proname;

-- Expected: both functions listed, both "guarded", and no other rows.
