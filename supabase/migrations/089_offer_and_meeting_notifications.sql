-- ============================================================================
-- FYLYMPITCH - Migration 089: tell the filmmaker about offers and meetings
--
-- A producer could make a financing offer on a film, or request a meeting
-- about it, and the filmmaker was never told. The rows were written; nobody
-- was notified.
--
-- WHY THE OBVIOUS FIX WOULD NOT HAVE WORKED
--
-- public.notifications has SELECT, UPDATE and DELETE policies and NO INSERT
-- policy. So an insert from the ordinary server client, for any user other
-- than -- well, for anyone -- is refused by RLS. The app does this in several
-- places and never checks the error, so every one fails silently:
--
--   respondToOffer              producer never learns an offer was answered
--   requestProducerIntroduction filmmaker never learns of the request
--   adminSetApproval            "Your producer account is approved"
--   adminVerifyProducer         "Your account has been verified"
--   completeOnboarding          admins never hear of a new producer
--   createProducerOpportunity   filmmakers never hear of a producer brief
--
-- Adding an INSERT policy is the wrong fix. Any policy loose enough to let a
-- producer write a row into a filmmaker's notifications lets anyone write any
-- text into anyone's notifications -- spam and phishing, in the most trusted
-- UI on the site.
--
-- So each notification is a SECURITY DEFINER function that takes an id, not
-- free text. It re-reads the row, checks the caller is who they must be, and
-- composes the message itself. The caller controls nothing but which of their
-- own offers or meetings to announce. Same shape as 074 and 086.
--
-- $fn$ and comment-free bodies: the Supabase SQL editor misreads a DECLARE
-- block as a table and splices an ALTER TABLE into the middle of $$ bodies.
-- ============================================================================


-- ---------- 1. Producer makes an offer -> filmmaker ----------
create or replace function public.notify_offer_made(p_offer_id uuid)
  returns void language plpgsql security definer set search_path = public
as $fn$
declare
  v_project uuid;
  v_from    uuid;
  v_amount  numeric;
  v_message text;
  v_owner   uuid;
  v_title   text;
  v_name    text;
begin
  select o.project_id, o.from_user_id, o.amount_usd, o.message, p.owner_id, p.title
    into v_project, v_from, v_amount, v_message, v_owner, v_title
  from public.offers o
  join public.projects p on p.id = o.project_id
  where o.id = p_offer_id;

  if v_from is null or v_from <> auth.uid() then return; end if;
  if v_owner is null or v_owner = v_from then return; end if;

  select coalesce(nullif(trim(company), ''), nullif(trim(full_name), ''), 'A producer')
    into v_name
  from public.profiles where id = v_from;
  v_name := coalesce(v_name, 'A producer');

  insert into public.notifications (user_id, kind, title, body, link, project_id, actor_id)
  values (
    v_owner,
    'offer_received',
    v_name || ' made an offer on "' || v_title || '"',
    case when v_amount is not null
         then 'US$' || to_char(v_amount, 'FM999,999,999,990') || ' — '
         else '' end
      || left(coalesce(nullif(trim(v_message), ''), 'Open the conversation to reply.'), 240),
    '/dashboard/messages/open?project=' || v_project::text || '&producer=' || v_from::text,
    v_project,
    v_from
  );
end;
$fn$;

grant execute on function public.notify_offer_made(uuid) to authenticated;


-- ---------- 2. Producer requests a meeting -> filmmaker ----------
create or replace function public.notify_meeting_request(p_meeting_id uuid)
  returns void language plpgsql security definer set search_path = public
as $fn$
declare
  v_producer  uuid;
  v_filmmaker uuid;
  v_project   uuid;
  v_message   text;
  v_owner     uuid;
  v_title     text;
  v_name      text;
begin
  select m.producer_id, m.filmmaker_id, m.project_id, m.message, p.owner_id, p.title
    into v_producer, v_filmmaker, v_project, v_message, v_owner, v_title
  from public.meeting_requests m
  join public.projects p on p.id = m.project_id
  where m.id = p_meeting_id;

  if v_producer is null or v_producer <> auth.uid() then return; end if;
  if v_owner is null or v_owner = v_producer then return; end if;
  if v_filmmaker is distinct from v_owner then return; end if;

  select coalesce(nullif(trim(company), ''), nullif(trim(full_name), ''), 'A producer')
    into v_name
  from public.profiles where id = v_producer;
  v_name := coalesce(v_name, 'A producer');

  insert into public.notifications (user_id, kind, title, body, link, project_id, actor_id)
  values (
    v_owner,
    'meeting_request',
    v_name || ' wants to meet about "' || v_title || '"',
    left(coalesce(nullif(trim(v_message), ''), 'Open the conversation to arrange a time.'), 240),
    '/dashboard/messages/open?project=' || v_project::text || '&producer=' || v_producer::text,
    v_project,
    v_producer
  );
end;
$fn$;

grant execute on function public.notify_meeting_request(uuid) to authenticated;


-- ---------- 3. Filmmaker answers an offer -> producer ----------
-- The other half of the offer loop, and one of the silent failures above.
-- Links to the producer's own view of the project rather than the /open
-- route, which is written for the filmmaker's side of a conversation.
create or replace function public.notify_offer_response(p_offer_id uuid)
  returns void language plpgsql security definer set search_path = public
as $fn$
declare
  v_project uuid;
  v_from    uuid;
  v_status  text;
  v_owner   uuid;
  v_title   text;
begin
  select o.project_id, o.from_user_id, o.status::text, p.owner_id, p.title
    into v_project, v_from, v_status, v_owner, v_title
  from public.offers o
  join public.projects p on p.id = o.project_id
  where o.id = p_offer_id;

  if v_owner is null or v_owner <> auth.uid() then return; end if;
  if v_status not in ('accepted', 'declined') then return; end if;

  insert into public.notifications (user_id, kind, title, body, link, project_id, actor_id)
  values (
    v_from,
    'offer_update',
    'Your offer on "' || v_title || '" was ' || v_status,
    case when v_status = 'accepted'
         then 'The filmmaker accepted. Open the project to take it from here.'
         else 'The filmmaker declined this offer.' end,
    '/producerstudio/projects/' || v_project::text,
    v_project,
    v_owner
  );
end;
$fn$;

grant execute on function public.notify_offer_response(uuid) to authenticated;


-- ---------- Check ----------
select proname,
       case when prosecdef then 'security definer' else 'INVOKER - WRONG' end as mode
from   pg_proc
where  pronamespace = 'public'::regnamespace
  and  proname in ('notify_offer_made', 'notify_meeting_request', 'notify_offer_response')
order  by proname;

-- Expected: three rows, all "security definer".


-- ---------- Confirm the silent failures were real ----------
-- If the first number is 0 while the second is not, "Your producer account
-- is approved" has never once reached a producer's notifications.
--
--   select
--     (select count(*) from public.notifications
--       where kind = 'system' and title like 'Your producer account is approved%') as approval_notifs,
--     (select count(*) from public.profiles
--       where role = 'producer' and approval_status = 'approved')                 as approved_producers;
