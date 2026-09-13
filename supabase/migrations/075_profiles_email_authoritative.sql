-- ============================================================================
-- FYLYMPITCH - Migration 075: profiles.email cannot be spoofed
-- Run once in the Supabase SQL Editor.
--
-- profiles.email is a cached copy of auth.users.email, kept so transactional
-- mail does not need a privileged read on every send. Reading it is already
-- locked down: migration 013 revoked SELECT (email) from anon and
-- authenticated, so only the service role can see the column.
--
-- Writing it is not. Both roles still hold UPDATE on the column - and they
-- need it, because onboarding (lib/actions.ts) writes the address as the
-- authenticated user. But the RLS update policy only checks WHICH row you
-- touch, not WHAT you put in it, so a user can PATCH profiles?id=eq.<self>
-- straight at PostgREST and set the column to any string. Several things send
-- mail to that value: admin broadcasts, and the exclusive-pitch notification.
-- Setting it to somebody else's address makes that person receive the
-- platform's mail.
--
-- A revoke would be the obvious fix and is the wrong one: it breaks the two
-- legitimate writes. The column does not need to be unwritable, it needs to be
-- unspoofable. So the value is re-derived from auth.users on every update and
-- whatever was submitted is discarded. The app's own writes already send this
-- exact value, so nothing there changes.
--
-- Side benefit: the drift that migration 061 had to repair by hand - rows
-- where the user changed their address in Supabase Auth and the cache went
-- stale - now self-corrects on the next profile update.
--
-- Checked before writing this: auth.users has no rows with a null email, so
-- re-deriving cannot null the column for anyone.
-- ============================================================================

create or replace function public.profiles_email_stays_authoritative()
  returns trigger
  language plpgsql security definer set search_path = public
as $$
begin
  -- auth.users is the source of truth. Ignore the submitted value entirely.
  select u.email into new.email
  from   auth.users u
  where  u.id = new.id;

  -- Never let a missing auth row blank an address that is already on file.
  if new.email is null then
    new.email := old.email;
  end if;

  return new;
end $$;

drop trigger if exists trg_profiles_email_authoritative on public.profiles;
create trigger trg_profiles_email_authoritative
  before update on public.profiles
  for each row execute function public.profiles_email_stays_authoritative();


-- ---------- Check ----------
-- 1. The trigger is in place.
select tgname, tgenabled
from   pg_trigger
where  tgrelid = 'public.profiles'::regclass
  and  tgname = 'trg_profiles_email_authoritative';

-- 2. Nothing is out of sync any more, and nothing was blanked.
select count(*)                                            as profiles,
       count(*) filter (where p.email is null)             as null_email,
       count(*) filter (where p.email is distinct from u.email) as still_drifted
from   public.profiles p
join   auth.users u on u.id = p.id;
