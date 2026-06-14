-- ============================================================
-- Migration 016: Dual roles — one signup covers filmmaker AND
-- producer access. Everyone is approved on signup.
-- ============================================================

-- Update trigger: all new users default to filmmaker, approved,
-- with access to both filmmaker dashboard and producer studio.
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

-- Approve all existing pending users — no one should be gated
update public.profiles
set approval_status = 'approved',
    onboarded_at    = coalesce(onboarded_at, created_at, now())
where approval_status = 'pending'
   or onboarded_at is null;
