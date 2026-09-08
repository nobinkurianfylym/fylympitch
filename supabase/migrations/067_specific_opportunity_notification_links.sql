-- ============================================================================
-- FYLYMPITCH — Migration 067: point fund notifications at the actual fund
-- Run once in the Supabase SQL Editor.
--
-- broadcast_new_fund() and auto_broadcast_new_fund() both take p_opp_id and
-- then ignore it, linking every notification to the generic list at
-- /dashboard/opportunities. A filmmaker told "New grant: <name>" lands on a
-- page of 598 opportunities and has to find it by hand.
--
-- Both now link to /dashboard/opportunities/{id} — the in-dashboard detail
-- page, which is the right destination for these recipients: it scores the
-- opportunity against their project and carries Apply and Save. The public
-- /opportunities/{slug} page has none of that.
--
-- Access: recipients are approved filmmakers/admins and the page is theirs,
-- so no new exposure. The one real guard is that a de-activated opportunity
-- should not be broadcast at all, which is now enforced in both functions.
-- (Project notifications already carry their own privacy guards — private and
-- exclusive-pitch projects are skipped — see migration 052. Untouched here.)
-- ============================================================================

-- ── 1. Admin adds an opportunity → notify approved filmmakers ───────────────
create or replace function public.broadcast_new_fund(p_opp_id uuid, p_title text)
  returns void language plpgsql security definer set search_path = public
as $$
declare
  v_active boolean;
begin
  if not public.is_admin() then return; end if;

  -- Never broadcast something that is not live.
  select is_active into v_active from public.opportunities where id = p_opp_id;
  if not coalesce(v_active, false) then return; end if;

  insert into public.notifications (user_id, kind, title, body, link)
  select id,
    'new_fund',
    'New opportunity: ' || p_title,
    'A new funding opportunity has been added. Check your matches.',
    '/dashboard/opportunities/' || p_opp_id::text
  from public.profiles
  where approval_status = 'approved'
  limit 1000;
end;
$$;

-- ── 2. Crawler discovers a fund → notify approved filmmakers ───────────────
-- Called by the funding-intelligence edge function with the service role, so
-- there is no is_admin() check by design.
create or replace function public.auto_broadcast_new_fund(
  p_opp_id    uuid,
  p_title     text,
  p_opp_type  text default null
)
  returns int language plpgsql security definer set search_path = public
as $$
declare
  v_count  int;
  v_active boolean;
begin
  select is_active into v_active from public.opportunities where id = p_opp_id;
  if not coalesce(v_active, false) then return 0; end if;

  insert into public.notifications (user_id, kind, title, body, link)
  select
    pr.id,
    'new_fund',
    'New ' || coalesce(p_opp_type, 'funding') || ': ' || p_title,
    'A newly discovered funding opportunity may match your project.',
    '/dashboard/opportunities/' || p_opp_id::text
  from public.profiles pr
  where pr.approval_status = 'approved'
    and pr.role in ('filmmaker', 'admin')
  limit 2000;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ── 3. Repair the notifications already sent ───────────────────────────────
-- The old rows stored no opportunity id, so the only handle is the title the
-- function wrote into the notification. Strip the prefix, match it back, and
-- rewrite the link — but ONLY where exactly one active opportunity has that
-- title, so an ambiguous match is left pointing at the list rather than sent
-- to the wrong fund.
with candidate as (
  select
    n.id as notif_id,
    case
      when n.title like 'New opportunity: %' then substring(n.title from 18)
      when n.title like 'New %: %'           then substring(n.title from position(': ' in n.title) + 2)
    end as opp_title
  from public.notifications n
  where n.kind = 'new_fund'
    and n.link = '/dashboard/opportunities'
),
resolved as (
  select c.notif_id, min(o.id::text) as opp_id
  from candidate c
  join public.opportunities o
    on o.title = c.opp_title
   and o.is_active
  where c.opp_title is not null
  group by c.notif_id
  having count(*) = 1          -- unambiguous only
)
update public.notifications n
   set link = '/dashboard/opportunities/' || r.opp_id
  from resolved r
 where n.id = r.notif_id;

-- ── 4. Check ───────────────────────────────────────────────────────────────
select count(*) filter (where link = '/dashboard/opportunities')      as still_generic,
       count(*) filter (where link like '/dashboard/opportunities/%') as now_specific
from   public.notifications
where  kind in ('new_fund', 'new_opportunity');
