-- ============================================================
-- FYLYMPITCH — Migration 039: opportunity public submissions
-- Adds opp_approval_status, submitted_by_name, submitted_by_email
-- to opportunities so public users can submit for admin review.
-- Run once in Supabase SQL Editor.
-- ============================================================

alter table public.opportunities
  add column if not exists opp_approval_status text not null default 'approved'
    check (opp_approval_status in ('pending', 'approved', 'rejected')),
  add column if not exists submitted_by_name  text,
  add column if not exists submitted_by_email text;

comment on column public.opportunities.opp_approval_status is
  'approved = live; pending = awaiting admin review; rejected = dismissed';
comment on column public.opportunities.submitted_by_name  is 'Name of public submitter (non-admin)';
comment on column public.opportunities.submitted_by_email is 'Email of public submitter for follow-up';

-- Allow unauthenticated users to insert pending submissions
create policy "public_submit_opportunity"
  on public.opportunities
  for insert
  to anon
  with check (opp_approval_status = 'pending' and is_active = false);

-- Existing approved opportunities already have opp_approval_status = 'approved' via default
-- Index for admin pending queue
create index if not exists idx_opps_pending
  on public.opportunities(opp_approval_status)
  where opp_approval_status = 'pending';
