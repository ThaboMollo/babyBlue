-- ============================================================
-- Phase 4: record_deletion_log — a POPIA accountability trail for
-- hard-deletes. It deliberately has NO FK to patients (the patient row is
-- being deleted) so the audit entry survives the deletion. Rows are written
-- via the service role during a guarded delete; admins can read within
-- their clinic. Append-only (no update/delete policies).
-- ============================================================

CREATE TABLE record_deletion_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id     UUID NOT NULL REFERENCES clinics (id) ON DELETE CASCADE,
  patient_id    UUID NOT NULL,                 -- no FK: the patient is gone
  patient_name  TEXT,
  deleted_by    UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  reason        TEXT,
  last_activity TIMESTAMPTZ,
  retain_until  DATE,
  deleted_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_record_deletion_log_clinic ON record_deletion_log (clinic_id, deleted_at DESC);

ALTER TABLE record_deletion_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin reads deletion log"
  ON record_deletion_log FOR SELECT
  USING (clinic_id = auth_clinic_id() AND auth_role() = 'admin');
