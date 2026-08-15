-- ============================================================
-- BabyBlue — Initial Schema
-- Shared by: patient mobile web app + admin portal
-- ============================================================

-- ─────────────────────────────────────────
-- 1. CLINICS
-- ─────────────────────────────────────────
CREATE TABLE clinics (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                       TEXT NOT NULL,
  slug                       TEXT NOT NULL UNIQUE,
  address                    TEXT,
  phone                      TEXT,
  avg_consultation_minutes   INT NOT NULL DEFAULT 10,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON COLUMN clinics.slug IS 'URL-safe identifier used in /c/:clinicSlug QR links';
COMMENT ON COLUMN clinics.avg_consultation_minutes IS 'Used for estimated wait time heuristic on patient queue view';

-- ─────────────────────────────────────────
-- 2. PROFILES  (clinic staff — auth users)
-- ─────────────────────────────────────────
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  clinic_id   UUID NOT NULL REFERENCES clinics (id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('admin', 'reception', 'doctor')),
  full_name   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────
-- 3. PATIENTS
-- ─────────────────────────────────────────
CREATE TABLE patients (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id   UUID NOT NULL REFERENCES clinics (id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  phone       TEXT NOT NULL,
  email       TEXT,
  dob         DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, phone)
);

-- ─────────────────────────────────────────
-- 4. APPOINTMENTS
-- ─────────────────────────────────────────
CREATE TABLE appointments (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id                 UUID NOT NULL REFERENCES clinics (id) ON DELETE CASCADE,
  patient_id                UUID NOT NULL REFERENCES patients (id) ON DELETE CASCADE,
  status                    TEXT NOT NULL DEFAULT 'waiting'
                              CHECK (status IN ('scheduled', 'waiting', 'in_consultation', 'done', 'cancelled')),
  appointment_date          DATE NOT NULL DEFAULT CURRENT_DATE,
  access_token              UUID NOT NULL DEFAULT gen_random_uuid(),
  entered_queue_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  consultation_started_at   TIMESTAMPTZ,
  completed_at              TIMESTAMPTZ,
  notes                     TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON COLUMN appointments.access_token IS 'Short-lived patient access token (Option A security model)';
COMMENT ON COLUMN appointments.entered_queue_at IS 'When the patient joined the queue — used for position ordering';
COMMENT ON COLUMN appointments.consultation_started_at IS 'Set when status transitions to in_consultation';
COMMENT ON COLUMN appointments.completed_at IS 'Set when status transitions to done';

-- ─────────────────────────────────────────
-- 5. INTAKE QUESTION TEMPLATES  (global defaults)
-- ─────────────────────────────────────────
CREATE TABLE intake_question_templates (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_key   TEXT NOT NULL UNIQUE,
  question_text  TEXT NOT NULL,
  question_type  TEXT NOT NULL CHECK (question_type IN ('text', 'dropdown', 'scale', 'boolean')),
  options        JSONB,
  sort_order     INT NOT NULL DEFAULT 0,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON COLUMN intake_question_templates.question_key IS 'Stable key used for historical reference in responses';
COMMENT ON COLUMN intake_question_templates.options IS 'Array of strings for dropdown type, e.g. ["Headache","Fever"]';

-- ─────────────────────────────────────────
-- 6. CLINIC INTAKE QUESTIONS  (per-clinic config)
-- ─────────────────────────────────────────
CREATE TABLE clinic_intake_questions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id      UUID NOT NULL REFERENCES clinics (id) ON DELETE CASCADE,
  template_id    UUID REFERENCES intake_question_templates (id) ON DELETE SET NULL,
  inherit_global BOOLEAN NOT NULL DEFAULT true,
  question_text  TEXT,
  question_type  TEXT CHECK (question_type IN ('text', 'dropdown', 'scale', 'boolean')),
  options        JSONB,
  sort_order     INT NOT NULL DEFAULT 0,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON COLUMN clinic_intake_questions.template_id IS 'Links to global template; NULL for fully custom questions';
COMMENT ON COLUMN clinic_intake_questions.inherit_global IS 'If true, use question_text/type/options from template; if false, use local overrides';

-- ─────────────────────────────────────────
-- 7. INTAKE RESPONSES
-- ─────────────────────────────────────────
CREATE TABLE intake_responses (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES appointments (id) ON DELETE CASCADE,
  clinic_id      UUID NOT NULL REFERENCES clinics (id) ON DELETE CASCADE,
  question_id    UUID REFERENCES clinic_intake_questions (id) ON DELETE SET NULL,
  question_key   TEXT NOT NULL,
  question_text  TEXT NOT NULL,
  answer         TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON COLUMN intake_responses.question_key IS 'Snapshot of key at time of answer (historical reference)';
COMMENT ON COLUMN intake_responses.question_text IS 'Snapshot of question text at time of answer';

-- ─────────────────────────────────────────
-- 8. APPOINTMENT EVENTS  (audit log)
-- ─────────────────────────────────────────
CREATE TABLE appointment_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id        UUID NOT NULL REFERENCES clinics (id) ON DELETE CASCADE,
  appointment_id   UUID NOT NULL REFERENCES appointments (id) ON DELETE CASCADE,
  actor_type       TEXT NOT NULL CHECK (actor_type IN ('patient', 'staff')),
  actor_user_id    UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  event_type       TEXT NOT NULL,
  from_status      TEXT CHECK (from_status IN ('scheduled','waiting','in_consultation','done','cancelled')),
  to_status        TEXT CHECK (to_status IN ('scheduled','waiting','in_consultation','done','cancelled')),
  metadata         JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────
-- 9. INDEXES
-- ─────────────────────────────────────────
CREATE INDEX idx_appointments_clinic_date_status
  ON appointments (clinic_id, appointment_date, status, entered_queue_at);

CREATE INDEX idx_appointments_token
  ON appointments (id, access_token);

CREATE INDEX idx_patients_clinic_phone
  ON patients (clinic_id, phone);

CREATE INDEX idx_profiles_clinic_role
  ON profiles (clinic_id, role);

CREATE INDEX idx_intake_responses_appointment
  ON intake_responses (appointment_id);

CREATE INDEX idx_appointment_events_appointment
  ON appointment_events (appointment_id);

CREATE INDEX idx_clinic_intake_questions_clinic
  ON clinic_intake_questions (clinic_id, sort_order) WHERE is_active = true;

-- ─────────────────────────────────────────
-- 10. ROW LEVEL SECURITY
-- ─────────────────────────────────────────
ALTER TABLE clinics                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments             ENABLE ROW LEVEL SECURITY;
ALTER TABLE intake_question_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_intake_questions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE intake_responses         ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_events       ENABLE ROW LEVEL SECURITY;

-- clinics: public read of non-sensitive fields (for patient app landing pages)
CREATE POLICY "Public can read clinic info"
  ON clinics FOR SELECT
  USING (true);

-- clinics: only admin staff can insert/update their clinic
CREATE POLICY "Staff can manage their clinic"
  ON clinics FOR ALL
  USING (
    id IN (
      SELECT clinic_id FROM profiles WHERE id = auth.uid()
    )
  );

-- profiles: users read/update their own profile
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid());

-- patients: clinic staff only
CREATE POLICY "Staff can manage clinic patients"
  ON patients FOR ALL
  USING (
    clinic_id IN (
      SELECT clinic_id FROM profiles WHERE id = auth.uid()
    )
  );

-- appointments: clinic staff only (patient access is via Edge Functions only)
CREATE POLICY "Staff can manage clinic appointments"
  ON appointments FOR ALL
  USING (
    clinic_id IN (
      SELECT clinic_id FROM profiles WHERE id = auth.uid()
    )
  );

-- intake_question_templates: public read (needed by get-appointment Edge Function)
CREATE POLICY "Public can read active question templates"
  ON intake_question_templates FOR SELECT
  USING (is_active = true);

-- intake_question_templates: only super-admin can write (service role key)
-- (No authenticated user policy — managed via Supabase dashboard / service role)

-- clinic_intake_questions: public read (needed by get-appointment Edge Function)
CREATE POLICY "Public can read clinic questions"
  ON clinic_intake_questions FOR SELECT
  USING (is_active = true);

-- clinic_intake_questions: staff can manage their clinic's questions
CREATE POLICY "Staff can manage clinic intake questions"
  ON clinic_intake_questions FOR ALL
  USING (
    clinic_id IN (
      SELECT clinic_id FROM profiles WHERE id = auth.uid()
    )
  );

-- intake_responses: staff read only (written by Edge Function via service role)
CREATE POLICY "Staff can read clinic intake responses"
  ON intake_responses FOR SELECT
  USING (
    clinic_id IN (
      SELECT clinic_id FROM profiles WHERE id = auth.uid()
    )
  );

-- appointment_events: staff read only
CREATE POLICY "Staff can read clinic appointment events"
  ON appointment_events FOR SELECT
  USING (
    clinic_id IN (
      SELECT clinic_id FROM profiles WHERE id = auth.uid()
    )
  );

-- ─────────────────────────────────────────
-- 11. SEED — Global intake question templates
-- ─────────────────────────────────────────
INSERT INTO intake_question_templates (question_key, question_text, question_type, options, sort_order)
VALUES
  ('primary_symptom',
   'What is your main reason for visiting today?',
   'dropdown',
   '["Headache","Fever","Cough","Chest pain","Abdominal pain","Back pain","Skin issue","Eye/Ear concern","Other"]',
   1),
  ('pain_level',
   'On a scale of 0–10, how would you rate your discomfort?',
   'scale',
   NULL,
   2),
  ('duration',
   'How long have you been experiencing this?',
   'dropdown',
   '["Today","A few days","About a week","More than a week","More than a month"]',
   3),
  ('fever',
   'Do you currently have a fever?',
   'boolean',
   NULL,
   4),
  ('allergies',
   'Do you have any known allergies?',
   'boolean',
   NULL,
   5),
  ('current_medications',
   'Are you currently taking any medication?',
   'boolean',
   NULL,
   6);
