-- Migration 019: Fix meeting_requests INSERT policy
-- Under dual roles (migration 016), everyone has role='filmmaker'.
-- The old policy checked is_approved_industry() which required role='producer'.
-- Now any authenticated, approved user can create meeting requests.

drop policy if exists "producer creates meeting" on public.meeting_requests;

create policy "authenticated user creates meeting"
  on public.meeting_requests for insert
  with check (
    producer_id = auth.uid()
    and exists (
      select 1 from public.profiles
      where id = auth.uid()
        and approval_status = 'approved'
    )
  );
