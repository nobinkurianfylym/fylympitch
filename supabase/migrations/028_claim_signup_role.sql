-- ============================================================
-- FYLYMPITCH — Migration 028: claim_signup_role()
-- Run once in Supabase SQL Editor.
--
-- Allows a brand-new Google OAuth user to claim 'producer' role
-- during the auth callback. Bypasses the "no self-promote" RLS
-- check, but is guarded by a 5-minute window from account creation.
-- ============================================================

create or replace function public.claim_signup_role(desired_role text)
  returns void
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_profile record;
begin
  -- Validate input
  if desired_role not in ('filmmaker', 'producer') then return; end if;

  select * into v_profile from public.profiles where id = auth.uid();
  if v_profile is null then return; end if;

  -- Only within 5 minutes of account creation
  if v_profile.created_at < now() - interval '5 minutes' then return; end if;

  update public.profiles
  set
    role             = desired_role::user_role,
    approval_status  = case
                         when desired_role = 'producer' then 'pending'::approval_status
                         else 'approved'::approval_status
                       end
  where id = auth.uid();
end;
$$;
