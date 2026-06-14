-- ============================================================
-- FYLYMPITCH — Migration 010: Messaging System
-- Run once in Supabase SQL Editor (after 009).
-- ============================================================

-- ── Conversations ─────────────────────────────────────────────
create table if not exists public.conversations (
  id                    uuid primary key default gen_random_uuid(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  last_message_at       timestamptz default now(),
  last_message_text     text,
  last_message_sender   uuid references public.profiles(id) on delete set null,
  project_id            uuid references public.projects(id) on delete set null
);

create trigger trg_conversations_touch
  before update on public.conversations
  for each row execute function public.touch_updated_at();

alter table public.conversations enable row level security;

create policy "participant sees conversation"
  on public.conversations for select
  using (exists (
    select 1 from public.conversation_participants cp
    where cp.conversation_id = id and cp.user_id = auth.uid()
  ));

create policy "participant updates conversation"
  on public.conversations for update
  using (exists (
    select 1 from public.conversation_participants cp
    where cp.conversation_id = id and cp.user_id = auth.uid()
  ));

-- ── Conversation participants ─────────────────────────────────
create table if not exists public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  unread_count    int not null default 0,
  joined_at       timestamptz not null default now(),
  archived_at     timestamptz,
  primary key (conversation_id, user_id)
);

alter table public.conversation_participants enable row level security;

create policy "participant sees participants"
  on public.conversation_participants for select
  using (exists (
    select 1 from public.conversation_participants cp2
    where cp2.conversation_id = conversation_participants.conversation_id
      and cp2.user_id = auth.uid()
  ));

create policy "participant updates own row"
  on public.conversation_participants for update
  using (user_id = auth.uid());

create policy "system inserts participants"
  on public.conversation_participants for insert
  with check (auth.uid() is not null);

-- ── Messages ──────────────────────────────────────────────────
create table if not exists public.messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.conversations(id) on delete cascade,
  sender_id        uuid not null references public.profiles(id) on delete cascade,
  body             text,
  attachment_path  text,
  attachment_name  text,
  attachment_type  text,
  attachment_size  int,
  status           text not null default 'sent'
                   check (status in ('sent','delivered','read')),
  created_at       timestamptz not null default now(),
  constraint has_content check (body is not null or attachment_path is not null)
);

alter table public.messages enable row level security;

create policy "participant sees messages"
  on public.messages for select
  using (exists (
    select 1 from public.conversation_participants cp
    where cp.conversation_id = messages.conversation_id and cp.user_id = auth.uid()
  ));

create policy "participant sends message"
  on public.messages for insert
  with check (
    sender_id = auth.uid() and
    exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = conversation_id and cp.user_id = auth.uid()
    )
  );

create policy "update own message status"
  on public.messages for update
  using (
    exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = conversation_id and cp.user_id = auth.uid()
    )
  );

-- Trigger: update conversation summary + increment unread counts on new message
create or replace function public.handle_new_message()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Update conversation summary
  update public.conversations set
    last_message_text   = coalesce(new.body, '[' || coalesce(new.attachment_name, 'Attachment') || ']'),
    last_message_sender = new.sender_id,
    last_message_at     = new.created_at,
    updated_at          = now()
  where id = new.conversation_id;

  -- Increment unread for all other participants
  update public.conversation_participants set
    unread_count = unread_count + 1
  where conversation_id = new.conversation_id
    and user_id <> new.sender_id;

  return new;
end $$;

create trigger trg_handle_new_message
  after insert on public.messages
  for each row execute function public.handle_new_message();

-- ── Blocks ────────────────────────────────────────────────────
create table if not exists public.user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

alter table public.user_blocks enable row level security;

create policy "own blocks"
  on public.user_blocks for all
  using (blocker_id = auth.uid());

-- ── Find or create conversation (RPC) ─────────────────────────
create or replace function public.find_or_create_conversation(
  other_user_id uuid,
  p_project_id  uuid default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  conv_id uuid;
begin
  -- Check existing direct conversation
  select cp1.conversation_id into conv_id
  from public.conversation_participants cp1
  join public.conversation_participants cp2
    on cp1.conversation_id = cp2.conversation_id
  where cp1.user_id = auth.uid()
    and cp2.user_id = other_user_id
  limit 1;

  if conv_id is not null then
    return conv_id;
  end if;

  -- Create new conversation
  insert into public.conversations (project_id)
  values (p_project_id)
  returning id into conv_id;

  -- Add both participants
  insert into public.conversation_participants (conversation_id, user_id)
  values (conv_id, auth.uid()), (conv_id, other_user_id);

  return conv_id;
end $$;

-- ── Attachments storage bucket ─────────────────────────────────
insert into storage.buckets (id, name, public)
  values ('attachments', 'attachments', false)
  on conflict (id) do nothing;

create policy "sender uploads attachment"
  on storage.objects for insert
  with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "participant reads attachment"
  on storage.objects for select
  using (bucket_id = 'attachments' and auth.uid() is not null);

-- ── Supabase Realtime ─────────────────────────────────────────
-- Enable realtime on messaging tables so clients receive live updates.
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.conversations;
alter publication supabase_realtime add table public.conversation_participants;
