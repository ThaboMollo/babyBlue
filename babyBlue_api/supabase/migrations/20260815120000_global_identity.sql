-- ============================================================
-- BabyBlue — Restructure Seam 1: Global Patient Identity
-- ============================================================
-- Introduces a GLOBAL `people` identity (one row per human, spanning
-- practices) above the existing per-practice `patients` record. This is
-- the additive form of the restructure spec's Seam 1: `patients` stays the
-- per-practice clinical file (unchanged) and now links up to a person via
-- patients.person_id.
--
-- Naming note: the spec (§6) calls the global table `patients` and the
-- per-practice one `practice_patients`. We invert this — global = `people`,
-- per-practice = `patients` (unchanged) — to avoid re-pointing the five
-- clinical tables (visit_notes, patient_documents, patient_consent,
-- record_access_log, record_deletion_log) and rewriting their RLS.
--
-- Identity / dedupe precedence: confirmed whatsapp_number -> phone ->
-- (id_type, id_number). The phone a person gives is NOT assumed to be their
-- WhatsApp number; the two are stored separately and reconciled at capture.
-- ============================================================

-- ─────────────────────────────────────────
-- 1. people — the global human identity
--    Cross-practice PII. Reached ONLY via the API's service-role key: RLS
--    is enabled but NO client policies are defined, so every anon /
--    authenticated read is denied by default. The service role bypasses RLS.
-- ─────────────────────────────────────────
CREATE TABLE people (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name         TEXT NOT NULL,
  last_name          TEXT NOT NULL,
  phone              TEXT,                    -- contact number as given (E.164), NOT assumed WhatsApp
  whatsapp_number    TEXT,                    -- WhatsApp-reachable number once confirmed (E.164)
  whatsapp_confirmed BOOLEAN NOT NULL DEFAULT false,
  id_type            TEXT CHECK (id_type IN ('rsa_id','passport','asylum')),
  id_number          TEXT,
  dob                DATE,
  nationality        TEXT,
  email              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  people                  IS 'Global patient identity — one row per human across all practices. Service-role access only (no client RLS policies).';
COMMENT ON COLUMN people.phone            IS 'Contact number as given; NOT assumed to be WhatsApp-reachable.';
COMMENT ON COLUMN people.whatsapp_number  IS 'WhatsApp-reachable number once confirmed; may differ from phone, null until confirmed.';
COMMENT ON COLUMN people.id_number        IS 'National ID (RSA 13-digit / passport / asylum) — secondary global dedupe key.';

-- Dedupe keys. Postgres treats NULLs as distinct, so a partial unique index
-- enforces uniqueness only over the rows that actually carry the key.
CREATE UNIQUE INDEX ux_people_whatsapp ON people (whatsapp_number)   WHERE whatsapp_number IS NOT NULL;
CREATE UNIQUE INDEX ux_people_phone    ON people (phone)             WHERE phone IS NOT NULL;
CREATE UNIQUE INDEX ux_people_idnum    ON people (id_type, id_number) WHERE id_number IS NOT NULL;

ALTER TABLE people ENABLE ROW LEVEL SECURITY;
-- (intentionally no policies — see header)

-- ─────────────────────────────────────────
-- 2. Link the per-practice record to the global identity
--    ON DELETE SET NULL: deleting a person must never cascade-delete a
--    practice's clinical file (HPCSA retention). The file survives, unlinked.
-- ─────────────────────────────────────────
ALTER TABLE patients
  ADD COLUMN person_id UUID REFERENCES people (id) ON DELETE SET NULL;

COMMENT ON COLUMN patients.person_id IS 'Link to the global people identity. Nullable during rollout; every write path resolves-or-creates a person and sets this.';

-- One per-practice record per person per clinic.
CREATE UNIQUE INDEX ux_patients_clinic_person
  ON patients (clinic_id, person_id) WHERE person_id IS NOT NULL;

CREATE INDEX idx_patients_person ON patients (person_id);
