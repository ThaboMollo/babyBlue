-- ============================================================
-- Fix: profiles RLS infinite recursion (Postgres 42P17)
-- ============================================================
-- The original "Staff can read relevant profiles" policy (from
-- 20260223000000_admin_portal_policies.sql) self-references `profiles`
-- inside its own SELECT policy:
--   USING (id = auth.uid() OR clinic_id IN (SELECT clinic_id FROM profiles ...))
-- Evaluating the policy re-triggers the policy → infinite recursion, which
-- blocks EVERY staff profile read (the API's requireStaff and the admin
-- portal alike). Surfaced by the live end-to-end verification.
--
-- Fix: resolve the caller's clinic via auth_clinic_id() — a SECURITY DEFINER
-- function (from 20260809120000_patient_file.sql) that bypasses RLS, so it
-- does not recurse.
-- ============================================================

DROP POLICY IF EXISTS "Staff can read relevant profiles" ON profiles;

CREATE POLICY "Staff can read relevant profiles" ON profiles FOR SELECT
  USING (id = auth.uid() OR clinic_id = auth_clinic_id());
