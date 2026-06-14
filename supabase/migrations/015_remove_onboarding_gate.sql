-- ============================================================
-- Migration 015: Remove onboarding gate.
--
-- Google sign-in already provides the user's name via
-- raw_user_meta_data->>'full_name'. Setting onboarded_at in
-- the trigger means new users go straight to the dashboard
-- without an extra onboarding screen.
--
-- Producers can request a role upgrade from their profile page.
-- ============================================================

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, role, full_name, approval_status, onboarded_at)
  values (
    new.id,
    'filmmaker',
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    'approved',
    now()
  );
  return new;
end $$;

-- Back-fill existing users who never completed onboarding
-- (they're already filmmakers in the DB, just missing the timestamp)
update public.profiles
set onboarded_at = coalesce(onboarded_at, created_at, now())
where onboarded_at is null;
