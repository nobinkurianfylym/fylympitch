-- ============================================================================
-- FYLYMPITCH — Migration 068: second pass on the notification links
-- Run once in the Supabase SQL Editor, after 067.
--
-- 067 repaired 4,094 rows and left 2,227. It was deliberately strict: it only
-- rewrote a notification when the title matched exactly ONE opportunity that
-- was still is_active. Two things that strictness excluded, both safe to
-- resolve:
--
--   1. The opportunity has since been de-activated. The link is still correct
--      and /dashboard/opportunities/{id} renders it — it selects by id and does
--      not filter on is_active. Sending someone to the fund they were told
--      about, closed or not, beats sending them to a list of 598.
--
--   2. Several opportunities share the title (SFFILM alone has five grants on
--      one page). Ambiguity is resolved by time: these functions broadcast
--      immediately after the row is inserted, so the right one is the
--      opportunity created closest to the notification. That is a much better
--      discriminator than "give up".
--
-- What is still left alone: notifications whose title cannot be parsed back to
-- an opportunity title at all, and titles that match nothing in the table
-- (renamed or deleted since). Those keep pointing at the list, which is
-- correct-but-unhelpful rather than wrong.
-- ============================================================================

-- ── 1. Before: what is actually left, and why ──────────────────────────────
with base as (
  select
    n.id, n.created_at, n.title,
    case
      when n.title like 'New opportunity: %' then substring(n.title from 18)
      when n.title like 'New %: %'           then substring(n.title from position(': ' in n.title) + 2)
    end as opp_title
  from public.notifications n
  where n.kind in ('new_fund', 'new_opportunity')
    and n.link = '/dashboard/opportunities'
)
select
  count(*)                                                                  as remaining,
  count(*) filter (where opp_title is null)                                 as title_unparseable,
  count(*) filter (where opp_title is not null and (
    select count(*) from public.opportunities o where o.title = base.opp_title) = 0)  as matches_nothing,
  count(*) filter (where opp_title is not null and (
    select count(*) from public.opportunities o where o.title = base.opp_title) = 1)  as one_match_now_inactive,
  count(*) filter (where opp_title is not null and (
    select count(*) from public.opportunities o where o.title = base.opp_title) > 1)  as several_same_title
from base;


-- ── 2. Repair ──────────────────────────────────────────────────────────────
-- DISTINCT ON keeps one opportunity per notification: with a single match that
-- is simply the match; with several, the one created nearest the notification.
with base as (
  select
    n.id, n.created_at,
    case
      when n.title like 'New opportunity: %' then substring(n.title from 18)
      when n.title like 'New %: %'           then substring(n.title from position(': ' in n.title) + 2)
    end as opp_title
  from public.notifications n
  where n.kind in ('new_fund', 'new_opportunity')
    and n.link = '/dashboard/opportunities'
),
best as (
  select distinct on (b.id)
         b.id  as notif_id,
         o.id  as opp_id
  from base b
  join public.opportunities o on o.title = b.opp_title
  where b.opp_title is not null
  order by b.id, abs(extract(epoch from (o.created_at - b.created_at)))
)
update public.notifications n
   set link = '/dashboard/opportunities/' || best.opp_id::text
  from best
 where n.id = best.notif_id;


-- ── 3. After ───────────────────────────────────────────────────────────────
select count(*) filter (where link = '/dashboard/opportunities')      as still_generic,
       count(*) filter (where link like '/dashboard/opportunities/%') as now_specific,
       count(*) filter (where link like '/opportunities/%')           as public_page_links
from   public.notifications
where  kind in ('new_fund', 'new_opportunity');
