-- ============================================================
-- Migration 025: Usernames for profiles + slugs for projects
-- ============================================================

-- ── 1. Add columns (nullable first for back-fill) ─────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE public.projects  ADD COLUMN IF NOT EXISTS slug     text;

-- ── 2. Username generator (collision-safe) ────────────────────
CREATE OR REPLACE FUNCTION public.generate_unique_username(base_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base      text;
  candidate text;
  counter   int := 0;
BEGIN
  -- Strip everything except a-z 0-9, lowercase, max 25 chars
  base := left(lower(regexp_replace(COALESCE(base_name,'user'), '[^a-zA-Z0-9]', '', 'g')), 25);
  IF base = '' THEN base := 'user'; END IF;
  candidate := base;
  LOOP
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE username = candidate);
    counter   := counter + 1;
    candidate := base || counter::text;
  END LOOP;
  RETURN candidate;
END;
$$;

-- ── 3. Project slug generator (collision-safe) ────────────────
CREATE OR REPLACE FUNCTION public.generate_unique_slug(base_title text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base      text;
  candidate text;
  counter   int := 0;
BEGIN
  -- lowercase, keep a-z 0-9 spaces, replace spaces with hyphens, max 60 chars
  base := left(
    regexp_replace(
      lower(regexp_replace(COALESCE(base_title,'project'), '[^a-zA-Z0-9\s]', '', 'g')),
      '\s+', '-', 'g'
    ), 60
  );
  -- trim trailing hyphens
  base := regexp_replace(base, '-+$', '');
  IF base = '' OR base IS NULL THEN base := 'project'; END IF;
  candidate := base;
  LOOP
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.projects WHERE slug = candidate);
    counter   := counter + 1;
    candidate := base || '-' || counter::text;
  END LOOP;
  RETURN candidate;
END;
$$;

-- ── 4. Back-fill existing profiles ────────────────────────────
UPDATE public.profiles
SET    username = public.generate_unique_username(COALESCE(full_name, SPLIT_PART(email, '@', 1), 'user'))
WHERE  username IS NULL;

-- ── 5. Back-fill existing projects ────────────────────────────
UPDATE public.projects
SET    slug = public.generate_unique_slug(COALESCE(title, 'project'))
WHERE  slug IS NULL;

-- ── 6. Enforce NOT NULL + UNIQUE ──────────────────────────────
ALTER TABLE public.profiles ALTER COLUMN username SET NOT NULL;
ALTER TABLE public.projects  ALTER COLUMN slug     SET NOT NULL;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_username_key,
  ADD  CONSTRAINT profiles_username_key UNIQUE (username);

ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_slug_key,
  ADD  CONSTRAINT projects_slug_key UNIQUE (slug);

CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles (username);
CREATE INDEX IF NOT EXISTS idx_projects_slug     ON public.projects  (slug);

-- ── 7. Update handle_new_user to include username ─────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_full_name text;
BEGIN
  v_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    SPLIT_PART(NEW.email, '@', 1)
  );
  INSERT INTO public.profiles (
    id, role, full_name, email,
    approval_status, onboarded_at, profile_completed, username
  )
  VALUES (
    NEW.id,
    'filmmaker',
    v_full_name,
    NEW.email,
    'approved',
    NOW(),
    false,
    public.generate_unique_username(v_full_name)
  )
  ON CONFLICT (id) DO UPDATE SET
    email    = EXCLUDED.email,
    full_name = COALESCE(profiles.full_name, EXCLUDED.full_name),
    username  = COALESCE(profiles.username,  EXCLUDED.username);
  RETURN NEW;
END;
$$;

-- ── 8. RLS: username is public read, owner-only write ─────────
-- (profiles already has RLS; username follows same rules)
-- No new policies needed — existing profile policies cover it.

-- Grant execute on new RPC functions
GRANT EXECUTE ON FUNCTION public.generate_unique_username(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.generate_unique_slug(text)     TO authenticated, anon;
