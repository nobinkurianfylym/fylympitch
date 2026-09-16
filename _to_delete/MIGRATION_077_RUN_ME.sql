-- ============================================================================
-- FYLYMPITCH - Migration 077: like an announcement, and share it
-- Run once in the Supabase SQL Editor. Requires migration 073 (it adds
-- notifications.broadcast_id); the guard below adds that column if 073 has not
-- been run yet, so this migration is safe either way - but 073 still has to run
-- for the fan-out to STAMP the id on new rows.
--
-- Two features, one migration, because they share the same problem: an
-- announcement has no identity of its own. It fans out into one notification
-- row per recipient, so "97 people liked it" cannot be counted from the
-- notifications table - every row belongs to exactly one person. Likes are
-- therefore keyed to admin_broadcasts.id, which is the announcement itself.
--
-- Sharing has the mirror-image problem: there is no URL to send. This adds a
-- public slug and a public read path, but ONLY for audience = 'all'. A
-- producers-only or filmmakers-only announcement is not public and never gets
-- a slug - sharing it would leak a segment message to the open web.
-- ============================================================================

-- ---------- 0. Guard: the link this all hangs off ----------
alter table public.notifications
  add column if not exists broadcast_id uuid references public.admin_broadcasts(id) on delete set null;

create index if not exists idx_notifications_broadcast_id
  on public.notifications(broadcast_id) where broadcast_id is not null;


-- ---------- 1. Columns on the broadcast ----------
alter table public.admin_broadcasts
  add column if not exists like_count  int  not null default 0,
  add column if not exists public_slug text,
  add column if not exists is_public   boolean not null default false;

-- A slug is a public identifier, so it has to be unique where it exists.
create unique index if not exists idx_admin_broadcasts_public_slug
  on public.admin_broadcasts(public_slug) where public_slug is not null;

-- Belt and braces: only an 'all' broadcast may ever be public. Enforced in the
-- column, not just in the code that writes it.
alter table public.admin_broadcasts
  drop constraint if exists admin_broadcasts_public_requires_all;
alter table public.admin_broadcasts
  add constraint admin_broadcasts_public_requires_all
  check (not is_public or (audience = 'all' and public_slug is not null));


-- ---------- 2. Slug generation ----------
-- Readable, stable, and not guessable in bulk: title words + a short random
-- tail. Random rather than sequential so nobody can walk /announcements/1,2,3.
create or replace function public.generate_broadcast_slug(p_subject text, p_id uuid)
returns text
language plpgsql immutable as $$
declare
  v_base text;
begin
  v_base := lower(coalesce(nullif(trim(p_subject), ''), 'announcement'));
  v_base := regexp_replace(v_base, '[^a-z0-9]+', '-', 'g');
  v_base := trim(both '-' from v_base);
  v_base := left(nullif(v_base, ''), 60);
  if v_base is null or v_base = '' then
    v_base := 'announcement';
  end if;
  -- 8 hex chars off the broadcast's own uuid: deterministic, so re-running
  -- this never produces a second slug for the same announcement.
  return v_base || '-' || left(replace(p_id::text, '-', ''), 8);
end;
$$;


-- ---------- 3. Likes ----------
create table if not exists public.broadcast_likes (
  broadcast_id uuid        not null references public.admin_broadcasts(id) on delete cascade,
  user_id      uuid        not null references public.profiles(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (broadcast_id, user_id)
);

create index if not exists idx_broadcast_likes_broadcast
  on public.broadcast_likes(broadcast_id);

alter table public.broadcast_likes enable row level security;

-- Anyone signed in may read the likes (the count is public by design).
drop policy if exists "read broadcast likes" on public.broadcast_likes;
create policy "read broadcast likes"
  on public.broadcast_likes for select
  to authenticated
  using (true);

-- You may only like as yourself, and only an announcement that was actually
-- sent to you. This is what stops a producer liking a filmmakers-only message
-- they were never shown, and stops anyone inflating a count for a broadcast
-- they never received.
drop policy if exists "like own received broadcast" on public.broadcast_likes;
create policy "like own received broadcast"
  on public.broadcast_likes for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.notifications n
      where  n.broadcast_id = broadcast_likes.broadcast_id
        and  n.user_id      = auth.uid()
    )
  );

drop policy if exists "unlike own" on public.broadcast_likes;
create policy "unlike own"
  on public.broadcast_likes for delete
  to authenticated
  using (user_id = auth.uid());


-- ---------- 4. Counter trigger ----------
-- SECURITY DEFINER, exactly as migration 060 had to do for project loves: the
-- liking user has no UPDATE right on admin_broadcasts, so an invoker-rights
-- trigger would silently match zero rows and the count would never move.
create or replace function public.sync_broadcast_like_count()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.admin_broadcasts
      set like_count = like_count + 1
    where id = new.broadcast_id;
  elsif tg_op = 'DELETE' then
    update public.admin_broadcasts
      set like_count = greatest(0, like_count - 1)
    where id = old.broadcast_id;
  end if;
  return null;
end;
$$;

revoke all on function public.sync_broadcast_like_count() from public;

drop trigger if exists trg_sync_broadcast_like_count on public.broadcast_likes;
create trigger trg_sync_broadcast_like_count
  after insert or delete on public.broadcast_likes
  for each row execute function public.sync_broadcast_like_count();


-- ---------- 5. Reading a broadcast you received ----------
-- admin_broadcasts is admin-only for select (migration 063). Recipients need
-- the like count and the slug, but must not get the whole table. A SECURITY
-- DEFINER function returning only the safe columns, only for broadcasts the
-- caller actually received, is the narrow way to do that.
create or replace function public.broadcast_social(p_broadcast_ids uuid[])
returns table (
  broadcast_id uuid,
  like_count   int,
  liked_by_me  boolean,
  public_slug  text,
  is_public    boolean
)
language sql security definer set search_path = public stable as $$
  select b.id,
         b.like_count,
         exists (
           select 1 from public.broadcast_likes l
           where l.broadcast_id = b.id and l.user_id = auth.uid()
         ),
         b.public_slug,
         b.is_public
  from   public.admin_broadcasts b
  where  b.id = any(p_broadcast_ids)
    and  exists (
           select 1 from public.notifications n
           where  n.broadcast_id = b.id and n.user_id = auth.uid()
         );
$$;

revoke all on function public.broadcast_social(uuid[]) from public;
grant execute on function public.broadcast_social(uuid[]) to authenticated;


-- ---------- 6. Toggling a like ----------
-- Done in one round trip rather than select-then-write, so a double-click
-- cannot produce two inserts racing each other.
create or replace function public.toggle_broadcast_like(p_broadcast_id uuid)
returns table (liked boolean, like_count int)
language plpgsql security definer set search_path = public as $$
declare
  v_user  uuid := auth.uid();
  v_had   boolean;
  v_count int;
begin
  if v_user is null then
    raise exception 'unauthorized';
  end if;

  -- The same rule as the RLS policy: you can only like what was sent to you.
  -- Repeated here because SECURITY DEFINER bypasses RLS.
  if not exists (
    select 1 from public.notifications n
    where  n.broadcast_id = p_broadcast_id and n.user_id = v_user
  ) then
    raise exception 'not a recipient';
  end if;

  delete from public.broadcast_likes
  where broadcast_id = p_broadcast_id and user_id = v_user;

  if found then
    v_had := true;
  else
    insert into public.broadcast_likes (broadcast_id, user_id)
    values (p_broadcast_id, v_user)
    on conflict do nothing;
    v_had := false;
  end if;

  select b.like_count into v_count
  from   public.admin_broadcasts b where b.id = p_broadcast_id;

  return query select (not v_had), coalesce(v_count, 0);
end;
$$;

revoke all on function public.toggle_broadcast_like(uuid) from public;
grant execute on function public.toggle_broadcast_like(uuid) to authenticated;


-- ---------- 7. The public page ----------
-- Read by anon and authenticated alike, by slug, and ONLY for a broadcast the
-- admin published. Returns the body and the count - never the sender id, the
-- audience, or the recipient count.
create or replace function public.public_announcement(p_slug text)
returns table (
  id         uuid,
  subject    text,
  body       text,
  like_count int,
  created_at timestamptz,
  edited_at  timestamptz
)
language sql security definer set search_path = public stable as $$
  select b.id, b.subject, b.body, b.like_count, b.created_at,
         -- edited_at arrives with migration 073; tolerate its absence.
         (to_jsonb(b) ->> 'edited_at')::timestamptz
  from   public.admin_broadcasts b
  where  b.public_slug = p_slug
    and  b.is_public
    and  b.audience = 'all';
$$;

revoke all on function public.public_announcement(text) from public;
grant execute on function public.public_announcement(text) to anon, authenticated;


-- ---------- 8. Publishing (admin only) ----------
create or replace function public.set_broadcast_public(p_broadcast_id uuid, p_public boolean)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_audience text;
  v_subject  text;
  v_slug     text;
begin
  if not public.is_admin() then
    raise exception 'unauthorized';
  end if;

  select b.audience, b.subject, b.public_slug
    into v_audience, v_subject, v_slug
  from public.admin_broadcasts b where b.id = p_broadcast_id;

  if v_audience is null then
    raise exception 'no such broadcast';
  end if;

  if p_public and v_audience <> 'all' then
    raise exception 'only an announcement sent to everyone can be made public';
  end if;

  if p_public and v_slug is null then
    v_slug := public.generate_broadcast_slug(v_subject, p_broadcast_id);
  end if;

  update public.admin_broadcasts
    set public_slug = case when p_public then v_slug else public_slug end,
        is_public   = p_public
  where id = p_broadcast_id;

  return case when p_public then v_slug else null end;
end;
$$;

revoke all on function public.set_broadcast_public(uuid, boolean) from public;
grant execute on function public.set_broadcast_public(uuid, boolean) to authenticated;


-- ---------- 9. Reconcile the cached count ----------
update public.admin_broadcasts b
set    like_count = coalesce(l.c, 0)
from  (select id from public.admin_broadcasts) ids
left  join (
        select broadcast_id, count(*)::int c
        from   public.broadcast_likes group by broadcast_id
      ) l on l.broadcast_id = ids.id
where b.id = ids.id
  and b.like_count is distinct from coalesce(l.c, 0);


-- ---------- 10. Verify (run by hand) ----------
-- select count(*) filter (where broadcast_id is not null) as linked,
--        count(*) filter (where broadcast_id is null)     as unlinked
-- from   public.notifications where kind = 'admin_broadcast';
-- If "unlinked" is large, migration 073 has not been run and older
-- announcements cannot be liked. Newer ones will be fine.


-- ---------- 11. Publish 'all' announcements automatically ----------
-- Without this the share button would never appear: it only shows when there
-- is a public URL to send, and nothing would ever create one. An announcement
-- sent to every account holder is already as public as it gets, so it gets a
-- slug on the way in. Segment announcements (filmmakers / producers) never do.
-- An admin can still withdraw one with set_broadcast_public(id, false).
create or replace function public.auto_publish_all_broadcast()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.audience = 'all' then
    new.public_slug := coalesce(new.public_slug,
                                public.generate_broadcast_slug(new.subject, new.id));
    new.is_public   := true;
  end if;
  return new;
end;
$$;

revoke all on function public.auto_publish_all_broadcast() from public;

drop trigger if exists trg_auto_publish_all_broadcast on public.admin_broadcasts;
create trigger trg_auto_publish_all_broadcast
  before insert on public.admin_broadcasts
  for each row execute function public.auto_publish_all_broadcast();

-- Backfill the ones already sent.
update public.admin_broadcasts
set    public_slug = coalesce(public_slug, public.generate_broadcast_slug(subject, id)),
       is_public   = true
where  audience = 'all'
  and  (public_slug is null or is_public = false);
