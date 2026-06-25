-- 056_fix_proof_rls_owner_id.sql
-- Fix filmmaker_select_own_proofs policy: references filmmaker_id which
-- does not exist on projects table — correct column is owner_id

DROP POLICY IF EXISTS "filmmaker_select_own_proofs" ON project_proofs;

CREATE POLICY "filmmaker_select_own_proofs"
  ON project_proofs FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM projects WHERE owner_id = auth.uid()
    )
  );
