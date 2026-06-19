-- ============================================================
-- FYLYMPITCH — Migration 029: Notification functions
-- Run once in Supabase SQL Editor.
--
-- Three SECURITY DEFINER RPCs callable from anon/user session:
-- 1. notify_producer_interest  — producer saves project → notify filmmaker
-- 2. broadcast_new_fund        — admin adds fund → notify all filmmakers
-- 3. broadcast_new_project     — project published → notify matched producers
-- ============================================================

-- 1. Producer saves a project → notify the filmmaker
create or replace function public.notify_producer_interest(p_project_id uuid)
  returns void language plpgsql security definer set search_path = public
as $$
declare
  v_title        text;
  v_owner_id     uuid;
  v_producer_name text;
begin
  if not public.is_approved_industry() then return; end if;

  select p.title, p.owner_id into v_title, v_owner_id
  from public.projects p where p.id = p_project_id;

  if v_owner_id is null then return; end if;
  if v_owner_id = auth.uid() then return; end if;

  select coalesce(company, full_name) into v_producer_name
  from public.profiles where id = auth.uid();

  insert into public.notifications (user_id, kind, title, body, link)
  values (
    v_owner_id,
    'producer_interest',
    v_producer_name || ' is interested in "' || v_title || '"',
    'They added your project to their pipeline.',
    '/dashboard/projects'
  );
end;
$$;

-- 2. Admin adds a new opportunity → bulk notify all filmmakers
create or replace function public.broadcast_new_fund(p_opp_id uuid, p_title text)
  returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then return; end if;

  insert into public.notifications (user_id, kind, title, body, link)
  select id,
    'new_fund',
    'New opportunity: ' || p_title,
    'A new funding opportunity has been added. Check your matches.',
    '/dashboard/opportunities'
  from public.profiles
  where approval_status = 'approved'
  limit 1000;
end;
$$;

-- 3. Filmmaker publishes a project → notify all approved producers
create or replace function public.broadcast_new_project(p_project_id uuid)
  returns void language plpgsql security definer set search_path = public
as $$
declare
  v_title         text;
  v_genre         text;
  v_format        text;
  v_filmmaker     text;
begin
  select p.title, p.genre, p.format, pr.full_name
  into v_title, v_genre, v_format, v_filmmaker
  from public.projects p
  join public.profiles pr on pr.id = p.owner_id
  where p.id = p_project_id and p.owner_id = auth.uid();

  if v_title is null then return; end if;

  insert into public.notifications (user_id, kind, title, body, link)
  select pp.user_id,
    'new_project',
    'New project: ' || v_title,
    v_filmmaker || ' submitted a new ' || v_genre || ' ' || v_format || '. Discover it in your feed.',
    '/producer/projects'
  from public.producer_profiles pp
  join public.profiles pr on pr.id = pp.user_id
  where pr.approval_status = 'approved'
  limit 1000;
end;
$$;
