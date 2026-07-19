-- ============================================================
-- FYLYMPITCH — Migration 063: Admin messaging
--
-- Admins can (1) broadcast an announcement to all users or a segment
-- (filmmakers / producers), and (2) hold a 1:1 conversation with any
-- individual user, which the user can reply to (support-inbox style).
--
-- This is built as a SEPARATE system on purpose. The project-scoped
-- filmmaker<->producer messaging tables (conversations / messages) are
-- deliberately hardened: 2-party triplet model, content immutability,
-- participant-only RLS, no admin path. Injecting an admin third actor
-- into that schema would weaken the "verifiable record between a filmmaker
-- and a producer" premise. So admin messaging lives in its own tables.
--
-- Admin identity: public.is_admin()  (profiles.role = 'admin').
-- Audience mapping:
--   'filmmakers' -> role = 'filmmaker'
--   'producers'  -> role in ('producer','investor','organization')  (industry side)
--   'all'        -> every non-admin profile
-- Adjust the segment predicates below if the platform's role semantics change.
--
-- Run ONCE in the Supabase SQL Editor after migration 062.
-- ============================================================

-- ============================================================
-- 1. BROADCASTS  (announce-only, one -> many)
-- ============================================================

create table if not exists public.admin_broadcasts (
  id              uuid        primary key default gen_random_uuid(),
  sender_id       uuid        references public.profiles(id) on delete set null,
  audience        text        not null check (audience in ('all','filmmakers','producers')),
  subject         text,
  body            text        not null check (trim(body) <> ''),
  recipient_count int         not null default 0,
  created_at      timestamptz not null default now()
);

create index if not exists idx_admin_broadcasts_created
  on public.admin_broadcasts(created_at desc);

alter table public.admin_broadcasts enable row level security;

-- Admins read their broadcast history. Creation is via RPC only (no INSERT policy).
drop policy if exists "admin selects broadcasts" on public.admin_broadcasts;
create policy "admin selects broadcasts"
  on public.admin_broadcasts for select
  using (public.is_admin());

-- send_admin_broadcast: verify admin, record the broadcast, fan out delivery
-- through the existing notifications table (same pattern as broadcast_new_fund).
create or replace function public.send_admin_broadcast(
  p_audience text,
  p_subject  text,
  p_body     text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_caller uuid := auth.uid();
  v_id     uuid;
  v_count  int;
begin
  if not public.is_admin() then
    raise exception 'unauthorized';
  end if;
  if p_audience not in ('all','filmmakers','producers') then
    raise exception 'invalid audience';
  end if;
  if p_body is null or trim(p_body) = '' then
    raise exception 'empty body';
  end if;

  insert into public.admin_broadcasts (sender_id, audience, subject, body)
  values (v_caller, p_audience, nullif(trim(coalesce(p_subject, '')), ''), trim(p_body))
  returning id into v_id;

  -- Fan out to matching users via the notifications table.
  insert into public.notifications (user_id, kind, title, body, link)
  select p.id,
         'admin_broadcast',
         coalesce(nullif(trim(coalesce(p_subject, '')), ''), 'A message from PITCH.FYLYM'),
         trim(p_body),
         '/support'
  from public.profiles p
  where p.role <> 'admin'
    and (
      p_audience = 'all'
      or (p_audience = 'filmmakers' and p.role = 'filmmaker')
      or (p_audience = 'producers'  and p.role in ('producer','investor','organization'))
    );

  -- No inline math in GET DIAGNOSTICS — assign to an intermediate variable.
  get diagnostics v_count = row_count;

  update public.admin_broadcasts set recipient_count = v_count where id = v_id;
  return v_id;
end $$;

-- ============================================================
-- 2. DIRECT THREADS  (1:1 admin <-> user, user may reply)
-- ============================================================

create table if not exists public.admin_threads (
  id                    uuid        primary key default gen_random_uuid(),
  user_id               uuid        not null unique references public.profiles(id) on delete cascade,
  subject               text,
  last_message          text,
  last_message_at       timestamptz,
  last_sender_is_admin  boolean,
  user_last_read_at     timestamptz,
  admin_last_read_at    timestamptz,
  created_by            uuid        references public.profiles(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists idx_admin_threads_last_msg
  on public.admin_threads(last_message_at desc nulls last);

drop trigger if exists trg_admin_threads_touch on public.admin_threads;
create trigger trg_admin_threads_touch
  before update on public.admin_threads
  for each row execute function public.touch_updated_at();

alter table public.admin_threads enable row level security;

-- The user sees their own thread; admins see all. Writes go through RPCs only.
drop policy if exists "user or admin selects admin_thread" on public.admin_threads;
create policy "user or admin selects admin_thread"
  on public.admin_threads for select
  using (user_id = auth.uid() or public.is_admin());

create table if not exists public.admin_messages (
  id          uuid        primary key default gen_random_uuid(),
  thread_id   uuid        not null references public.admin_threads(id) on delete cascade,
  sender_id   uuid        not null references public.profiles(id)      on delete cascade,
  is_admin    boolean     not null,   -- true = sent by an admin, false = sent by the user
  body        text        not null check (trim(body) <> ''),
  sent_at     timestamptz not null default now(),
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists idx_admin_messages_thread
  on public.admin_messages(thread_id, sent_at);

alter table public.admin_messages enable row level security;

-- The thread's user and any admin may read the messages. Inserts via RPC only.
drop policy if exists "user or admin selects admin_messages" on public.admin_messages;
create policy "user or admin selects admin_messages"
  on public.admin_messages for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.admin_threads t
      where t.id = admin_messages.thread_id and t.user_id = auth.uid()
    )
  );

-- admin_open_thread: admin-only find-or-create of a user's support thread.
create or replace function public.admin_open_thread(p_user_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'unauthorized';
  end if;
  if p_user_id is null then
    raise exception 'invalid user';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id and role <> 'admin') then
    raise exception 'invalid target user';
  end if;

  select id into v_id from public.admin_threads where user_id = p_user_id;
  if v_id is not null then
    return v_id;
  end if;

  insert into public.admin_threads (user_id, created_by)
  values (p_user_id, auth.uid())
  returning id into v_id;
  return v_id;
end $$;

-- send_admin_message: an admin (any thread) or the thread's own user may post.
create or replace function public.send_admin_message(p_thread_id uuid, p_body text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_caller   uuid    := auth.uid();
  v_is_admin boolean := public.is_admin();
  v_thread   record;
  v_msg_id   uuid;
  v_preview  text;
begin
  if v_caller is null then
    raise exception 'unauthenticated';
  end if;
  if p_body is null or trim(p_body) = '' then
    raise exception 'empty body';
  end if;

  select * into v_thread from public.admin_threads where id = p_thread_id;
  if not found then
    raise exception 'thread not found';
  end if;
  if not (v_is_admin or v_thread.user_id = v_caller) then
    raise exception 'unauthorized';
  end if;

  insert into public.admin_messages (thread_id, sender_id, is_admin, body)
  values (p_thread_id, v_caller, v_is_admin, trim(p_body))
  returning id into v_msg_id;

  v_preview := left(trim(p_body), 200);

  update public.admin_threads
  set last_message         = v_preview,
      last_message_at      = now(),
      last_sender_is_admin = v_is_admin,
      updated_at           = now(),
      admin_last_read_at   = case when v_is_admin      then now() else admin_last_read_at end,
      user_last_read_at    = case when not v_is_admin  then now() else user_last_read_at  end
  where id = p_thread_id;

  -- Notify the user when an admin writes. (Admins are alerted via the admin
  -- Messages inbox unread count, so no per-admin notification on user replies.)
  if v_is_admin then
    insert into public.notifications (user_id, kind, title, body, link)
    values (v_thread.user_id, 'admin_message', 'A message from PITCH.FYLYM',
            left(trim(p_body), 140), '/support');
  end if;

  return v_msg_id;
end $$;

-- mark_admin_thread_read: advance the caller's read pointer + stamp read_at
-- on the counterparty's unread messages.
create or replace function public.mark_admin_thread_read(p_thread_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_caller uuid := auth.uid();
  v_thread record;
begin
  select * into v_thread from public.admin_threads where id = p_thread_id;
  if not found then
    raise exception 'thread not found';
  end if;

  if public.is_admin() then
    update public.admin_threads
      set admin_last_read_at = now(), updated_at = now()
      where id = p_thread_id;
    update public.admin_messages
      set read_at = now()
      where thread_id = p_thread_id and is_admin = false and read_at is null;
  elsif v_thread.user_id = v_caller then
    update public.admin_threads
      set user_last_read_at = now(), updated_at = now()
      where id = p_thread_id;
    update public.admin_messages
      set read_at = now()
      where thread_id = p_thread_id and is_admin = true and read_at is null;
  else
    raise exception 'unauthorized';
  end if;
end $$;

-- count_admin_unread_threads: sidebar badge — threads whose latest message is
-- from the user and unread by admins.
create or replace function public.count_admin_unread_threads()
returns int
language sql security definer set search_path = public as $$
  select count(*)::int
  from public.admin_threads t
  where public.is_admin()
    and t.last_message_at is not null
    and t.last_sender_is_admin = false
    and (t.admin_last_read_at is null or t.last_message_at > t.admin_last_read_at)
$$;

-- ============================================================
-- 3. Grants  (functions enforce authorization internally)
-- ============================================================
grant execute on function public.send_admin_broadcast(text, text, text) to authenticated;
grant execute on function public.admin_open_thread(uuid)               to authenticated;
grant execute on function public.send_admin_message(uuid, text)        to authenticated;
grant execute on function public.mark_admin_thread_read(uuid)          to authenticated;
grant execute on function public.count_admin_unread_threads()          to authenticated;

-- ============================================================
-- 4. Realtime (optional; harmless if the publication already has them)
-- ============================================================
do $$ begin
  alter publication supabase_realtime add table public.admin_messages;
exception when others then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.admin_threads;
exception when others then null;
end $$;

-- ============================================================
-- Verification (run manually after applying)
-- ============================================================
-- -- As an admin:
-- select public.send_admin_broadcast('all', 'Welcome', 'Thanks for joining PITCH.FYLYM.');
-- -- Expected: a uuid; notifications rows created for every non-admin profile.
--
-- select public.admin_open_thread('<user-uuid>');   -- returns a thread id
-- select public.send_admin_message('<thread-id>', 'Hi there');  -- returns a message id
-- select public.count_admin_unread_threads();        -- badge count
--
-- -- As the target user:
-- select public.send_admin_message('<thread-id>', 'Thanks!');   -- reply works
-- select public.mark_admin_thread_read('<thread-id>');          -- clears unread
