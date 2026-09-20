-- ============================================================================
-- FYLYMPITCH - Migration 085: exclusivity and visibility are different things
--
-- 081 gave every public-facing policy three conditions:
--
--     is_public AND admin_hidden = false AND target_producer_id IS NULL
--
-- The third one was aimed at a real hole: an exclusive pitch addressed to ONE
-- producer was readable by anyone. But it treated "addressed to a producer"
-- and "not for the public" as the same fact, and they are not.
--
-- The project form asks the filmmaker directly:
--
--     Public   - "Shown on the Projects showcase."
--     Private
--
-- A filmmaker who picked Public and then pitched a producer was silently
-- removed from the showcase they had just been promised. Nothing told them.
-- The setting still read Public on their own dashboard.
--
-- So: target_producer_id decides WHO IT IS ADDRESSED TO. is_public decides
-- WHO MAY SEE IT. One policy changes; the filmmaker's own choice is the gate.
--
--   public  + pitched  -> showcase, and the producer's dashboard
--   private + pitched  -> that producer, the owner, and admins. Nobody else.
-- ============================================================================

-- ---------- 1. Look before you leap ----------
-- Run this FIRST, on its own. Every row it counts is public today in the
-- filmmaker's own settings but missing from the showcase, and will appear
-- there the moment the policy below is replaced. That is the intent -- but
-- know the number, and glance at the titles, before it happens.
--
--   select count(*) as will_become_visible
--   from   public.projects
--   where  is_public = true
--     and  admin_hidden = false
--     and  target_producer_id is not null;
--
--   select id, title, created_at
--   from   public.projects
--   where  is_public = true and admin_hidden = false
--     and  target_producer_id is not null
--   order  by created_at desc;


-- ---------- 2. The one policy that changes ----------
-- Role {public} covers anon and authenticated alike, so this single policy is
-- what puts a public project in front of everyone.
--
-- admin_hidden stays. An admin hiding a project still hides it.
drop policy if exists "public readable non-hidden" on public.projects;
create policy "public readable non-hidden" on public.projects
  for select using (
    is_public = true
    and admin_hidden = false
  );


-- ---------- 3. What deliberately does NOT change ----------
-- These keep "target_producer_id is null", and must:
--
--   verified producer reads non-hidden
--   approved industry reads non-hidden
--
-- Both grant reads BEYOND what is public -- that is their whole purpose, and
-- it is how a verified producer sees private projects at all. Dropping the
-- condition there would hand every verified producer every PRIVATE pitch
-- addressed to a competitor. A public pitch already reaches them through the
-- policy above, because policies are OR'd.
--
-- Also unchanged, and the reason a private pitch still works:
--   producer reads own pitched projects   target_producer_id = auth.uid()
--   owner reads own projects              owner_id = auth.uid()
--   admin reads all projects              is_admin()


-- ---------- 4. Confirm ----------
select policyname, qual
from   pg_policies
where  schemaname = 'public' and tablename = 'projects' and cmd = 'SELECT'
order  by policyname;

-- Expected: "public readable non-hidden" no longer mentions
-- target_producer_id. Every other policy is untouched.


-- ---------- 5. Verify the private case is still shut ----------
-- Run as an anonymous reader (logged out, or the anon key). This must return
-- NOTHING. If a private pitch comes back, stop and revert section 2.
--
--   select id, title from public.projects
--   where  is_public = false and target_producer_id is not null;
