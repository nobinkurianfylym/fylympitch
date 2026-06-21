-- ============================================================
-- FYLYMPITCH — Migration 035: Fix broadcast_new_project link
-- Run once in Supabase SQL Editor.
--
-- Fixes: notifications sent to producers (and any admin/filmmaker
-- who also appears in producer_profiles) used /producer/projects
-- as the CTA link. Filmmakers have no access to Producer Studio,
-- so redirect to the public /projects landing page instead.
-- ============================================================

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
    '/projects'                          -- ← was /producer/projects (producer-only route)
  from public.producer_profiles pp
  join public.profiles pr on pr.id = pp.user_id
  where pr.approval_status = 'approved'
  limit 1000;
end;
$$;
