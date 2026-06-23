-- 045_apply_method.sql
-- Add apply method fields to opportunities table
-- apply_method: how a filmmaker applies to this fund
-- form_url:     direct URL to the application form (for one_click)
-- form_field_map: JSONB map of fund form field names to FYLYM project field names

ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS apply_method text NOT NULL DEFAULT 'manual'
    CHECK (apply_method IN ('one_click', 'export_packet', 'manual', 'api')),
  ADD COLUMN IF NOT EXISTS form_url text,
  ADD COLUMN IF NOT EXISTS form_field_map jsonb;

COMMENT ON COLUMN opportunities.apply_method IS
  'one_click = FYLYM browser extension can auto-fill; export_packet = pre-filled PDF/print; manual = visit site; api = direct API submission';
COMMENT ON COLUMN opportunities.form_url IS
  'Direct URL to the application form (used for one_click and export_packet)';
COMMENT ON COLUMN opportunities.form_field_map IS
  'Maps fund form field selectors to FYLYM project fields e.g. {"input[name=title]": "title", "textarea[name=synopsis]": "synopsis"}';
