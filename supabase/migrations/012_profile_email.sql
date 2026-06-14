-- ============================================================
-- FYLYMPITCH — Migration 012: Email on profiles
-- Run once in Supabase SQL Editor (after 011).
--
-- Adds email column to profiles so transactional emails (producer
-- approval, etc.) can be sent without needing the service role key
-- to query auth.users. Populated during onboarding and kept in sync
-- via the handle_new_user trigger update below.
-- ============================================================

alter table public.profiles
  add column if not exists email text;

-- Back-fill from auth.users for existing profiles
update public.profiles p
  set email = u.email
  from auth.users u
  where u.id = p.id
    and p.email is null;

-- Update handle_new_user to include email going forward
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_role user_role := coalesce((new.raw_user_meta_data->>'role')::user_role, 'filmmaker');
begin
  insert into public.profiles (id, role, full_name, approval_status, email)
  values (
    new.id,
    v_role,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    case when v_role in ('producer','investor','organization') then 'pending'::approval_status
         else 'approved'::approval_status end,
    new.email
  )
  on conflict (id) do update set
    email = excluded.email;
  return new;
end $$;
