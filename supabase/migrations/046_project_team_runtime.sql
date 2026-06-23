-- Migration 046: structured team fields + runtime on projects

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS runtime_minutes  integer,
  ADD COLUMN IF NOT EXISTS director_name    text,
  ADD COLUMN IF NOT EXISTS director_email   text,
  ADD COLUMN IF NOT EXISTS director_phone   text,
  ADD COLUMN IF NOT EXISTS producer_name    text,
  ADD COLUMN IF NOT EXISTS producer_company text;

COMMENT ON COLUMN projects.runtime_minutes  IS 'Expected runtime in minutes';
COMMENT ON COLUMN projects.director_name    IS 'Director / writer full name (structured, separate from director_statement)';
COMMENT ON COLUMN projects.director_email   IS 'Director contact email';
COMMENT ON COLUMN projects.director_phone   IS 'Director contact phone';
COMMENT ON COLUMN projects.producer_name    IS 'Attached producer full name';
COMMENT ON COLUMN projects.producer_company IS 'Producer production company';
