-- ============================================================
-- FYLYMPITCH — Migration 033: Messaging v2
-- Replaces the old participant-based messaging schema with a
-- project-scoped triplet model: (project_id, producer_id, filmmaker_id).
--
-- Run ONCE in Supabase SQL Editor after migration 032.
-- ============================================================

-- ── 0. Teardown old system ────────────────────────────────────
-- Trigger drops must be guarded by table existence — IF EXISTS on the trigger
-- does not protect against a missing table.

do $$ begin
  if exists (select 1 from information_schema.tables
             where table_schema = 'public' and table_name = 'messages') then
    drop trigger if exists trg_handle_new_message on public.messages;
  end if;
  if exists (select 1 from information_schema.tables
             where table_schema = 'public' and table_name = 'conversations') then
    drop trigger if exists trg_conversations_touch on public.conversations;
  end if;
end $$;

drop function if exists public.handle_new_message()                    cascade;
drop function if exists public.find_or_create_conversation(uuid, uuid) cascade;

-- Drop in dependency order (messages → participants → conversations)
drop table if exists public.messages                   cascade;
drop table if exists public.conversation_participants  cascade;
drop table if exists public.conversations              cascade;

-- Drop old storage policies (bucket retained; policies replaced)
drop policy if exists "sender uploads attachment"    on storage.objects;
drop policy if exists "participant reads attachment" on storage.objects;

-- ── 1. conversations ──────────────────────────────────────────

create table public.conversations (
  id                      uuid        primary key default gen_random_uuid(),
  project_id              uuid        not null references public.projects(id)  on delete cascade,
  producer_id             uuid        not null references public.profiles(id)  on delete cascade,
  filmmaker_id            uuid        not null references public.profiles(id)  on delete cascade,
  last_message            text,
  last_message_at         timestamptz,
  producer_last_read_at   timestamptz,
  filmmaker_last_read_at  timestamptz,
  conversation_type       text        not null default 'project',
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  created_by              uuid        references public.profiles(id) on delete set null,
  updated_by              uuid        references public.profiles(id) on delete set null,

  constraint uq_project_producer_filmmaker unique (project_id, producer_id, filmmaker_id),
  constraint chk_conversation_type check (conversation_type = 'project'),
  constraint chk_not_self_message  check (producer_id <> filmmaker_id)
);

create trigger trg_conversations_touch
  before update on public.conversations
  for each row execute function public.touch_updated_at();

-- Performance indexes
create index idx_conversations_producer    on public.conversations(producer_id);
create index idx_conversations_filmmaker   on public.conversations(filmmaker_id);
create index idx_conversations_project     on public.conversations(project_id);
create index idx_conversations_last_msg_at on public.conversations(last_message_at desc nulls last);
-- Cursor index for inbox pagination
create index idx_conversations_cursor
  on public.conversations(last_message_at desc nulls last, id desc);

-- FTS search vector (project title + last message)
alter table public.conversations
  add column search_vector tsvector;

create index idx_conversations_search on public.conversations using gin(search_vector);

-- RLS
alter table public.conversations enable row level security;

create policy "participant selects conversation"
  on public.conversations for select
  using (producer_id = auth.uid() or filmmaker_id = auth.uid());

create policy "participant updates conversation"
  on public.conversations for update
  using (producer_id = auth.uid() or filmmaker_id = auth.uid());

-- INSERT is handled exclusively by the initiate_project_conversation RPC (security definer)
-- No direct INSERT policy — all creation goes through the function.

-- ── 2. messages ───────────────────────────────────────────────

create table public.messages (
  id                   uuid        primary key default gen_random_uuid(),
  conversation_id      uuid        not null references public.conversations(id) on delete cascade,
  sender_id            uuid        not null references public.profiles(id)      on delete cascade,
  message              text,
  -- Attachment metadata (never public URLs; always signed)
  attachment_name      text,
  attachment_size      bigint,
  attachment_extension text,
  attachment_mime      text,
  storage_bucket       text,
  storage_path         text,
  -- Delivery timestamps (status is COMPUTED, never stored as enum)
  sent_at              timestamptz not null default now(),
  delivered_at         timestamptz,
  read_at              timestamptz,
  -- Audit
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  deleted_at           timestamptz,
  deleted_by           uuid        references public.profiles(id) on delete set null,
  created_by           uuid        references public.profiles(id) on delete set null,
  updated_by           uuid        references public.profiles(id) on delete set null,

  -- Never trust the client: sender_id must match auth.uid() (enforced in INSERT policy)
  constraint chk_message_has_content check (
    (message is not null and trim(message) <> '') or storage_path is not null
  ),
  constraint chk_attachment_size check (
    attachment_size is null or attachment_size <= 52428800  -- 50 MB
  ),
  constraint chk_attachment_extension check (
    attachment_extension is null or
    lower(attachment_extension) in ('pdf', 'docx', 'xlsx', 'zip')
  )
);

create trigger trg_messages_touch
  before update on public.messages
  for each row execute function public.touch_updated_at();

-- Performance indexes
create index idx_messages_conversation_sent
  on public.messages(conversation_id, sent_at desc, id desc);
create index idx_messages_sender          on public.messages(sender_id);
create index idx_messages_read_at         on public.messages(read_at) where read_at is null;
create index idx_messages_soft_delete     on public.messages(deleted_at) where deleted_at is null;

-- RLS
alter table public.messages enable row level security;

create policy "participant selects messages"
  on public.messages for select
  using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (c.producer_id = auth.uid() or c.filmmaker_id = auth.uid())
    )
  );

-- Never trust sender_id from client — enforce auth.uid()
create policy "participant inserts own message"
  on public.messages for insert
  with check (
    sender_id   = auth.uid() and
    created_by  = auth.uid() and
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (c.producer_id = auth.uid() or c.filmmaker_id = auth.uid())
    )
  );

-- Only allow updating read_at and soft-delete fields (no message editing)
create policy "participant updates message timestamps"
  on public.messages for update
  using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (c.producer_id = auth.uid() or c.filmmaker_id = auth.uid())
    )
  );

-- ── 3. Rate limiting trigger ───────────────────────────────────

create or replace function public.enforce_message_rate_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (
    select count(*)
    from   public.messages
    where  created_by = new.created_by
      and  created_at > now() - interval '10 seconds'
      and  deleted_at is null
  ) >= 5 then
    raise exception 'rate_limit_exceeded'
      using hint = 'You are sending messages too quickly. Please wait a moment.';
  end if;
  return new;
end $$;

create trigger trg_message_rate_limit
  before insert on public.messages
  for each row execute function public.enforce_message_rate_limit();

-- ── 4. New message trigger (update conversation summary + FTS) ──

create or replace function public.handle_new_project_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_preview text;
begin
  -- Build last_message preview
  v_preview := case
    when new.message is not null then new.message
    else '[' || coalesce(new.attachment_name, 'Attachment') || ']'
  end;

  -- Update conversation summary AND advance the sender's own last_read_at.
  -- Without this, the sender's nav badge would light up on their own message
  -- because last_message_at > sender_last_read_at immediately after send.
  update public.conversations
  set
    last_message            = v_preview,
    last_message_at         = new.sent_at,
    updated_at              = now(),
    updated_by              = new.sender_id,
    -- Sender has implicitly "read" the conversation by writing to it
    producer_last_read_at   = case
                                when producer_id  = new.sender_id then now()
                                else producer_last_read_at
                              end,
    filmmaker_last_read_at  = case
                                when filmmaker_id = new.sender_id then now()
                                else filmmaker_last_read_at
                              end
  where id = new.conversation_id;

  return new;
end $$;

create trigger trg_handle_new_project_message
  after insert on public.messages
  for each row execute function public.handle_new_project_message();

-- ── 5. FTS update trigger ──────────────────────────────────────

create or replace function public.update_conversation_search_vector()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_project_title text;
begin
  select title into v_project_title
  from public.projects
  where id = new.project_id;

  new.search_vector := to_tsvector('english',
    coalesce(v_project_title, '') || ' ' ||
    coalesce(new.last_message, '')
  );
  return new;
end $$;

create trigger trg_conversation_search_vector
  before insert or update of last_message, project_id
  on public.conversations
  for each row execute function public.update_conversation_search_vector();

-- ── 6. initiate_project_conversation RPC ──────────────────────
-- Entry point: called from MessageButton (project context only).
-- Validates: caller is producer or filmmaker, project ownership.
-- Enforces: no self-conversations, no duplicate conversations.

create or replace function public.initiate_project_conversation(
  p_project_id   uuid,
  p_producer_id  uuid,
  p_filmmaker_id uuid
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_caller  uuid := auth.uid();
  v_conv_id uuid;
begin
  -- Caller must be one of the two parties
  if v_caller is null then
    raise exception 'unauthenticated';
  end if;
  if v_caller <> p_producer_id and v_caller <> p_filmmaker_id then
    raise exception 'unauthorized: caller is not a participant';
  end if;
  -- No self-conversations
  if p_producer_id = p_filmmaker_id then
    raise exception 'invalid: producer and filmmaker cannot be the same user';
  end if;
  -- Validate project exists and filmmaker is the owner
  if not exists (
    select 1 from public.projects
    where id = p_project_id and owner_id = p_filmmaker_id
  ) then
    raise exception 'invalid: project not found or filmmaker mismatch';
  end if;

  -- Find existing conversation (UNIQUE constraint guarantees at most one)
  select id into v_conv_id
  from public.conversations
  where project_id   = p_project_id
    and producer_id  = p_producer_id
    and filmmaker_id = p_filmmaker_id;

  if v_conv_id is not null then
    return v_conv_id;
  end if;

  -- Create new conversation
  insert into public.conversations (
    project_id, producer_id, filmmaker_id, created_by, updated_by
  ) values (
    p_project_id, p_producer_id, p_filmmaker_id, v_caller, v_caller
  )
  returning id into v_conv_id;

  return v_conv_id;
end $$;

-- ── 7. mark_conversation_read RPC ─────────────────────────────
-- Batches: updates producer_last_read_at or filmmaker_last_read_at
-- AND sets read_at on all unread messages from the counterparty.

create or replace function public.mark_conversation_read(
  p_conversation_id uuid
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_caller uuid := auth.uid();
  v_conv   record;
begin
  select * into v_conv
  from public.conversations
  where id = p_conversation_id;

  if not found then
    raise exception 'conversation not found';
  end if;

  if v_conv.producer_id = v_caller then
    update public.conversations
    set producer_last_read_at = now(), updated_at = now()
    where id = p_conversation_id;
  elsif v_conv.filmmaker_id = v_caller then
    update public.conversations
    set filmmaker_last_read_at = now(), updated_at = now()
    where id = p_conversation_id;
  else
    raise exception 'unauthorized';
  end if;

  -- Batch-mark individual messages as read (from counterparty only)
  update public.messages
  set read_at    = now(),
      updated_at = now()
  where conversation_id = p_conversation_id
    and sender_id <> v_caller
    and read_at  is null
    and deleted_at is null;
end $$;

-- ── 8. get_inbox_unread_count RPC ─────────────────────────────
-- Used by both layouts to compute nav badge without loading all messages.

create or replace function public.get_inbox_unread_count()
returns int language sql security definer set search_path = public as $$
  select count(*)::int
  from   public.conversations
  where
    last_message_at is not null
    and (
      (filmmaker_id = auth.uid()
        and (filmmaker_last_read_at is null or last_message_at > filmmaker_last_read_at))
      or
      (producer_id = auth.uid()
        and (producer_last_read_at is null or last_message_at > producer_last_read_at))
    )
$$;

-- ── 9. Storage bucket (message-attachments) ───────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'message-attachments',
  'message-attachments',
  false,
  52428800,  -- 50 MB
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip',
    'application/x-zip-compressed'
  ]
)
on conflict (id) do update set
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Upload: caller must be a participant in the conversation (conversation_id is first path segment)
create policy "participant uploads message attachment"
  on storage.objects for insert
  with check (
    bucket_id = 'message-attachments' and
    auth.uid() is not null and
    exists (
      select 1 from public.conversations c
      where c.id = (storage.foldername(name))[1]::uuid
        and (c.producer_id = auth.uid() or c.filmmaker_id = auth.uid())
    )
  );

-- Download: participants only, via signed URL (bucket is private)
create policy "participant reads message attachment"
  on storage.objects for select
  using (
    bucket_id = 'message-attachments' and
    auth.uid() is not null and
    exists (
      select 1 from public.conversations c
      where c.id = (storage.foldername(name))[1]::uuid
        and (c.producer_id = auth.uid() or c.filmmaker_id = auth.uid())
    )
  );

-- ── 10. Realtime publications ──────────────────────────────────
-- Tables are dropped and recreated above, so they were auto-removed from the
-- publication. Re-add them. Using DO block so a re-run doesn't raise an error.

do $$ begin
  alter publication supabase_realtime add table public.messages;
exception when others then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.conversations;
exception when others then null;
end $$;
