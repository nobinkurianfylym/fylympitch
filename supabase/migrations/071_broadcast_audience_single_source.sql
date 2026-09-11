-- ============================================================================
-- FYLYMPITCH — Migration 071: one definition of a broadcast audience,
--                             plus "send me a copy"
-- Run once in the Supabase SQL Editor.
--
-- Two problems, same root.
--
-- 1. The audience was defined twice. send_admin_broadcast() decided who gets
--    the in-app notification; lib/admin-messaging.ts decided separately, in
--    TypeScript, who gets the email. They disagreed: the RPC excluded admins
--    and counted 'organization' as a producer, the email path included admins
--    and did not. One action, two answers.
--
-- 2. An admin never received their own broadcast, so the only way to see what
--    you actually sent was to log in as somebody else. That is what made a
--    working send look like a failure.
--
-- admin_broadcast_audience() is now the single definition. The RPC uses it for
-- the fan-out and the server action uses it to build the email list, so the two
-- cannot drift apart again.
--
-- Also hardened: role is an enum (user_role), and `role in ('producer',
-- 'investor','organization')` raises 22P02 if any literal is not a member of
-- that enum — aborting the entire broadcast. Every comparison now casts to
-- text first, so an unknown label simply does not match.
-- NULL role is handled explicitly too: `role <> 'admin'` is NULL rather than
-- true, which silently dropped those accounts from every audience, "Everyone"
-- included.
-- ============================================================================

-- ── 1. The single definition of an audience ─────────────────────────────────
create or replace function public.admin_broadcast_audience(
  p_audience     text,
  p_include_self boolean default false
)
  returns table (user_id uuid, email text, full_name text)
  language sql security definer set search_path = public
as $$
  select p.id, p.email, p.full_name
  from   public.profiles p
  where  (
           -- The sender is an admin and is otherwise excluded; include them
           -- only when they asked for a copy.
           (p_include_self and p.id = auth.uid())
           or (
             coalesce(p.role::text, '') <> 'admin'
             and (
               p_audience = 'all'
               or (p_audience = 'filmmakers' and p.role::text = 'filmmaker')
               or (p_audience = 'producers'
                   and p.role::text in ('producer','investor','organization'))
             )
           )
         );
$$;

revoke all on function public.admin_broadcast_audience(text, boolean) from public;
grant execute on function public.admin_broadcast_audience(text, boolean) to authenticated;

-- ── 2. The broadcast itself, now audience-consistent ───────────────────────
-- The old three-argument version is dropped so there is no overload to resolve
-- against. p_include_self carries a default, so a caller passing only three
-- arguments still binds to this function — the currently deployed app keeps
-- working whichever order these two land in.
drop function if exists public.send_admin_broadcast(text, text, text);

create or replace function public.send_admin_broadcast(
  p_audience     text,
  p_subject      text,
  p_body         text,
  p_include_self boolean default false
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

  insert into public.notifications (user_id, kind, title, body, link)
  select a.user_id,
         'admin_broadcast',
         coalesce(nullif(trim(coalesce(p_subject, '')), ''), 'A message from PITCH.FYLYM'),
         trim(p_body),
         '/support'
  from   public.admin_broadcast_audience(p_audience, p_include_self) a;

  get diagnostics v_count = row_count;
  update public.admin_broadcasts set recipient_count = v_count where id = v_id;
  return v_id;
end $$;

revoke all on function public.send_admin_broadcast(text, text, text, boolean) from public;
grant execute on function public.send_admin_broadcast(text, text, text, boolean) to authenticated;


-- ── 3. Check ───────────────────────────────────────────────────────────────
-- Sizes each audience through the one definition. Run as an admin to see real
-- numbers; in the SQL editor auth.uid() is null, so the include_self column
-- will read the same as the plain one, which is expected.
select 'all'        as audience, count(*) from public.admin_broadcast_audience('all')
union all
select 'filmmakers', count(*) from public.admin_broadcast_audience('filmmakers')
union all
select 'producers',  count(*) from public.admin_broadcast_audience('producers');
