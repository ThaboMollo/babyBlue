-- ============================================================
-- BabyBlue — Patient File / System of Record (Plan A) — Phase 0
-- Compliance foundation + schema for the Patient File feature.
-- Spec: BabyBlue/SystemOfRecordSpec.md  (§4, §5, §8)
--
-- This migration is the single source of truth for the Patient File
-- schema. It lives in the ADMIN PORTAL repo (the app that owns the
-- feature); the patient app's migrations dir is treated as legacy.
--
-- Deviations from the spec (intentional, see inline notes):
--   * visit_notes.author_id is NULLABLE (spec wrote NOT NULL + ON
--     DELETE SET NULL, which is self-contradictory). Author-name
--     snapshotting is the real integrity fix and is deferred (§8 HPCSA).
--   * patients get identity columns (nationality/id_type/id_number) —
--     added per the "ID required everywhere" dedupe decision.
--   * Reception's "read-only on the clinical summary" (matrix §5) is
--     enforced at the APP layer, not RLS: the clinical summary lives on
--     the patients row (spec §4.1) and Postgres row-level policies can't
--     restrict a subset of columns, while Supabase puts every staff role
--     in the single `authenticated` DB role (so column GRANTs can't tell
--     reception from doctor either). The write affordance is gated in the
--     server action by auth_role().
-- ============================================================

-- ─────────────────────────────────────────
-- 1. HELPER FUNCTIONS
--    SECURITY DEFINER so policies don't recurse into profiles' own RLS.
-- ─────────────────────────────────────────

-- Caller's clinic (tenant guard used by every policy below).
CREATE OR REPLACE FUNCTION auth_clinic_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT clinic_id FROM profiles WHERE id = auth.uid();
$$;

-- Caller's role ('admin' | 'reception' | 'doctor').
CREATE OR REPLACE FUNCTION auth_role()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

-- POPIA hard-block: is there live records_storage consent for this patient?
-- Referenced in the WITH CHECK of every clinical write (notes, documents).
-- plpgsql (not sql): its body is resolved at first call, so it may
-- reference patient_consent, which is created further down this migration.
CREATE OR REPLACE FUNCTION has_active_records_consent(p_patient_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM patient_consent
    WHERE patient_id   = p_patient_id
      AND consent_type = 'records_storage'
      AND granted
      AND revoked_at IS NULL
  );
END;
$$;

-- App-level "touch" of record_updated_at. SECURITY DEFINER so reception
-- (read-only on the clinical summary) can still bump the timestamp when
-- they upload a document, without holding a broad UPDATE on patients.
-- Tenant-guarded: a staffer can only touch patients in their own clinic.
CREATE OR REPLACE FUNCTION touch_patient_record(p_patient_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE patients
     SET record_updated_at = now()
   WHERE id = p_patient_id
     AND clinic_id = auth_clinic_id();
END;
$$;

-- Generic updated_at trigger fn (attached to visit_notes below).
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION auth_clinic_id()                     TO authenticated;
GRANT EXECUTE ON FUNCTION auth_role()                         TO authenticated;
GRANT EXECUTE ON FUNCTION has_active_records_consent(UUID)    TO authenticated;
GRANT EXECUTE ON FUNCTION touch_patient_record(UUID)          TO authenticated;

-- ─────────────────────────────────────────
-- 2. EXTEND patients — identity + clinical summary
-- ─────────────────────────────────────────
ALTER TABLE patients
  ADD COLUMN nationality         TEXT,                     -- 'South Africa' ⇒ rsa_id path
  ADD COLUMN id_type             TEXT CHECK (id_type IN ('rsa_id','passport','asylum')),
  ADD COLUMN id_number           TEXT,
  ADD COLUMN allergies           TEXT,
  ADD COLUMN chronic_conditions  TEXT,
  ADD COLUMN current_medications TEXT,
  ADD COLUMN blood_type          TEXT,
  ADD COLUMN clinical_notes      TEXT,                     -- free-form summary (not per-visit)
  ADD COLUMN record_updated_at   TIMESTAMPTZ;              -- touched on any file edit

COMMENT ON COLUMN patients.id_number IS 'RSA ID (13-digit, Luhn-checked, DOB-derivable), passport, or asylum number — the primary dedupe key.';

-- Primary identity key for dedupe/matching (nullable: legacy + digitised
-- rows may lack an ID; NULLs are exempt from the uniqueness constraint).
CREATE UNIQUE INDEX ux_patients_idnum
  ON patients (clinic_id, id_type, id_number)
  WHERE id_number IS NOT NULL;

-- ─────────────────────────────────────────
-- 3. visit_notes — the consult note (the workflow hook)
-- ─────────────────────────────────────────
CREATE TABLE visit_notes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id      UUID NOT NULL REFERENCES clinics (id)      ON DELETE CASCADE,
  appointment_id UUID NOT NULL REFERENCES appointments (id) ON DELETE CASCADE,
  patient_id     UUID NOT NULL REFERENCES patients (id)     ON DELETE CASCADE,
  -- Nullable + DEFAULT auth.uid(): the client need not pass the author,
  -- and deleting an auth user won't violate the column (SET NULL).
  author_id      UUID DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE SET NULL,
  -- SOAP structure keeps notes usable later; all optional.
  subjective     TEXT,
  objective      TEXT,
  assessment     TEXT,
  plan           TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (appointment_id)                                    -- one note per visit
);
CREATE INDEX idx_visit_notes_patient ON visit_notes (patient_id, created_at DESC);

CREATE TRIGGER trg_visit_notes_updated
  BEFORE UPDATE ON visit_notes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────
-- 4. patient_documents — where the digitised file lands
-- ─────────────────────────────────────────
CREATE TABLE patient_documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id     UUID NOT NULL REFERENCES clinics (id)  ON DELETE CASCADE,
  patient_id    UUID NOT NULL REFERENCES patients (id) ON DELETE CASCADE,
  storage_path  TEXT NOT NULL,                          -- object key in the private bucket
  file_name     TEXT NOT NULL,
  mime_type     TEXT,
  doc_type      TEXT CHECK (doc_type IN ('historical_file','referral','lab_result','id_document','other')),
  source        TEXT NOT NULL CHECK (source IN ('digitised','uploaded')),
  original_date DATE,                                    -- date on the original paper doc
  uploaded_by   UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  ocr_text      TEXT,                                    -- searchable text from OCR (nullable)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_patient_documents_patient ON patient_documents (patient_id, created_at DESC);

-- ─────────────────────────────────────────
-- 5. patient_consent — lawful basis (POPIA)
-- ─────────────────────────────────────────
CREATE TABLE patient_consent (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id     UUID NOT NULL REFERENCES clinics (id)  ON DELETE CASCADE,
  patient_id    UUID NOT NULL REFERENCES patients (id) ON DELETE CASCADE,
  consent_type  TEXT NOT NULL CHECK (consent_type IN ('records_storage','data_processing')),
  granted       BOOLEAN NOT NULL,
  method        TEXT CHECK (method IN ('patient_app','reception_verbal','signed_form')),
  captured_by   UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  granted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at    TIMESTAMPTZ
);
CREATE INDEX idx_patient_consent_patient ON patient_consent (patient_id, consent_type);

-- ─────────────────────────────────────────
-- 6. record_access_log — POPIA access auditing (append-only)
-- ─────────────────────────────────────────
CREATE TABLE record_access_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id     UUID NOT NULL REFERENCES clinics (id)  ON DELETE CASCADE,
  patient_id    UUID NOT NULL REFERENCES patients (id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  action        TEXT NOT NULL CHECK (action IN ('view','edit','document_view','export')),
  context       TEXT,                                    -- e.g. 'patient_file', 'timeline'
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_record_access_log_patient ON record_access_log (patient_id, created_at DESC);

-- ─────────────────────────────────────────
-- 7. ROW LEVEL SECURITY  (role matrix, spec §5)
-- ─────────────────────────────────────────
ALTER TABLE visit_notes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_documents  ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_consent    ENABLE ROW LEVEL SECURITY;
ALTER TABLE record_access_log  ENABLE ROW LEVEL SECURITY;

-- ---- visit_notes: reception none | doctor read/write | admin read ----
CREATE POLICY "Doctor+admin read visit notes"
  ON visit_notes FOR SELECT
  USING (clinic_id = auth_clinic_id() AND auth_role() IN ('doctor','admin'));

CREATE POLICY "Doctor inserts visit notes"
  ON visit_notes FOR INSERT
  WITH CHECK (
    clinic_id = auth_clinic_id()
    AND auth_role() = 'doctor'
    AND has_active_records_consent(patient_id)              -- POPIA hard-block
    AND EXISTS (SELECT 1 FROM patients p                    -- patient belongs to clinic
               WHERE p.id = patient_id AND p.clinic_id = auth_clinic_id())
  );

CREATE POLICY "Doctor updates visit notes"
  ON visit_notes FOR UPDATE
  USING (clinic_id = auth_clinic_id() AND auth_role() = 'doctor')
  WITH CHECK (
    clinic_id = auth_clinic_id()
    AND auth_role() = 'doctor'
    AND has_active_records_consent(patient_id)
  );
-- (no DELETE policy — notes are not client-deletable)

-- ---- patient_documents: reception read+upload | doctor read | admin read/write ----
CREATE POLICY "Clinic staff read patient documents"
  ON patient_documents FOR SELECT
  USING (clinic_id = auth_clinic_id());

CREATE POLICY "Reception+admin upload patient documents"
  ON patient_documents FOR INSERT
  WITH CHECK (
    clinic_id = auth_clinic_id()
    AND auth_role() IN ('reception','admin')
    AND has_active_records_consent(patient_id)              -- POPIA hard-block
    AND EXISTS (SELECT 1 FROM patients p
               WHERE p.id = patient_id AND p.clinic_id = auth_clinic_id())
  );

CREATE POLICY "Admin updates patient documents"
  ON patient_documents FOR UPDATE
  USING (clinic_id = auth_clinic_id() AND auth_role() = 'admin')
  WITH CHECK (clinic_id = auth_clinic_id() AND auth_role() = 'admin');
-- (no DELETE policy — hard-delete is a guarded service-role path in Phase 4)

-- ---- patient_consent: reception read/write | doctor read | admin read/write ----
-- (not consent-gated — that would be circular)
CREATE POLICY "Clinic staff read consent"
  ON patient_consent FOR SELECT
  USING (clinic_id = auth_clinic_id());

CREATE POLICY "Reception+admin insert consent"
  ON patient_consent FOR INSERT
  WITH CHECK (
    clinic_id = auth_clinic_id()
    AND auth_role() IN ('reception','admin')
    AND EXISTS (SELECT 1 FROM patients p
               WHERE p.id = patient_id AND p.clinic_id = auth_clinic_id())
  );

CREATE POLICY "Reception+admin revoke consent"
  ON patient_consent FOR UPDATE
  USING (clinic_id = auth_clinic_id() AND auth_role() IN ('reception','admin'))
  WITH CHECK (clinic_id = auth_clinic_id() AND auth_role() IN ('reception','admin'));

-- ---- record_access_log: append-only | any staff insert | admin read ----
CREATE POLICY "Staff append access log"
  ON record_access_log FOR INSERT
  WITH CHECK (
    clinic_id = auth_clinic_id()
    AND actor_user_id = auth.uid()                          -- no spoofing another actor
  );

CREATE POLICY "Admin reads access log"
  ON record_access_log FOR SELECT
  USING (clinic_id = auth_clinic_id() AND auth_role() = 'admin');
-- (no UPDATE/DELETE policies — append-only by omission)

-- ─────────────────────────────────────────
-- 8. PRIVATE STORAGE BUCKET  patient-documents
--    No public URLs. Views go through a service-role signed-URL action
--    that logs document_view — so we deliberately do NOT grant staff a
--    direct SELECT on objects (every read stays audited). Uploads by
--    reception/admin go through the client, so they need INSERT.
--    Path convention: clinic_id/patient_id/<uuid>-<filename>
-- ─────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('patient-documents', 'patient-documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Reception+admin upload to patient-documents"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'patient-documents'
    AND (storage.foldername(name))[1] = auth_clinic_id()::text
    AND auth_role() IN ('reception','admin')
  );
