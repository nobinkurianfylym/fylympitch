-- 048_producer_profile_enhancements.sql
-- Additional producer profile fields for the redesigned profile page.

-- On profiles table (shared identity)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS linkedin_url text;

-- On producer_profiles (producer-specific)
ALTER TABLE public.producer_profiles
  ADD COLUMN IF NOT EXISTS years_experience  integer,
  ADD COLUMN IF NOT EXISTS accepting_pitches boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS response_time     text,   -- e.g. "Within 2 weeks"
  ADD COLUMN IF NOT EXISTS looking_for       text[]  NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.profiles.linkedin_url             IS 'LinkedIn profile URL';
COMMENT ON COLUMN public.producer_profiles.years_experience  IS 'Years of producing experience';
COMMENT ON COLUMN public.producer_profiles.accepting_pitches IS 'Whether producer is currently accepting project pitches';
COMMENT ON COLUMN public.producer_profiles.response_time     IS 'Typical response time e.g. "Within 2 weeks"';
COMMENT ON COLUMN public.producer_profiles.looking_for       IS 'What the producer is currently seeking, e.g. debut filmmakers, co-productions';
