-- ============================================================
-- FYLYMPITCH — Migration 002: Certificates & Moderation
-- Run once in Supabase SQL Editor (after schema.sql).
-- Adds the data model for the admin "Certificates" and
-- "Moderation" modules.
-- ============================================================

create type certificate_type as enum ('incorporation','accreditation','id_proof','tax','other');
create type certificate_status as enum ('pending','approved','rejected');
create type report_status as enum ('open','resolved','dismissed');
create type report_target as enum ('profile','project','offer','opportunity');

-- ---------- CERTIFICATES ----------
-- Verification / accreditation documents uploaded by producers,
-- investors and organizations as part of FYLYMPITCH's approval flow.
create table public.certificates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  cert_type certificate_type not null default 'other',
  label text not null,
  file_path text not null,           -- Supabase Storage path ('certificates' bucket)
  status certificate_status not null default 'pending',
  notes text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_certs_user on public.certificates(user_id);
create index idx_certs_status on public.certificates(status, created_at desc);

alter table public.certificates enable row level security;
create policy "own certificates read" on public.certificates for select
  using (user_id = auth.uid() or public.is_admin());
create policy "owner upload certificate" on public.certificates for insert
  with check (user_id = auth.uid());
create policy "admin review certificate" on public.certificates for update
  using (public.is_admin());
create policy "admin delete certificate" on public.certificates for delete
  using (public.is_admin());

insert into storage.buckets (id, name, public) values ('certificates','certificates', false)
  on conflict (id) do nothing;
create policy "owner uploads certificates" on storage.objects for insert
  with check (bucket_id = 'certificates' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "certificate read access" on storage.objects for select
  using (bucket_id = 'certificates' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
create policy "owner deletes own certificates" on storage.objects for delete
  using (bucket_id = 'certificates' and (storage.foldername(name))[1] = auth.uid()::text);

-- Notify the user when their certificate is reviewed
create or replace function public.notify_certificate_review() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status and new.status <> 'pending' then
    insert into public.notifications (user_id, kind, title, body, link)
    values (
      new.user_id, 'system',
      case when new.status = 'approved' then 'Certificate verified' else 'Certificate needs attention' end,
      case when new.status = 'approved' then '"' || new.label || '" has been verified.'
           else '"' || new.label || '" was rejected' || coalesce(' — ' || new.notes, '.') end,
      '/dashboard/profile'
    );
  end if;
  return new;
end $$;
create trigger trg_certificate_review after update on public.certificates
  for each row execute function public.notify_certificate_review();

-- ---------- MODERATION REPORTS ----------
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles(id) on delete set null,
  target_type report_target not null,
  target_id uuid not null,
  reason text not null check (char_length(reason) <= 1000),
  status report_status not null default 'open',
  resolved_by uuid references public.profiles(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_reports_status on public.reports(status, created_at desc);

alter table public.reports enable row level security;
create policy "create report" on public.reports for insert
  with check (auth.uid() is not null and (reporter_id = auth.uid() or reporter_id is null));
create policy "admin read reports" on public.reports for select using (public.is_admin());
create policy "admin update reports" on public.reports for update using (public.is_admin());

-- ============================================================
-- AFTER RUNNING:
-- The admin sidebar now has working "Certificates" and
-- "Moderation" pages backed by these tables.
-- ============================================================
