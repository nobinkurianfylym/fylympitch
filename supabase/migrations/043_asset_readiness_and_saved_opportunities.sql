-- ── Asset readiness declaration columns ──────────────────────────────────
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS has_script_doc  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_budget_doc  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_lookbook    boolean NOT NULL DEFAULT false;

-- Back-fill: existing projects with a script_path count as has_script_doc
UPDATE projects SET has_script_doc = true WHERE script_path IS NOT NULL;

-- ── Saved Opportunities (bookmarks) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS saved_opportunities (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  opportunity_id uuid        NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  project_id     uuid        REFERENCES projects(id) ON DELETE SET NULL,
  created_at     timestamptz DEFAULT now(),
  UNIQUE (user_id, opportunity_id)
);

ALTER TABLE saved_opportunities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "saved_opps_own"
  ON saved_opportunities FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
