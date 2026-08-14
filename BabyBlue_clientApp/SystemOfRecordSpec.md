# BabyBlue — Patient File / System of Record (Plan A) — Implementation Spec

> Status: **Proposed (2026-08-07)** — the strategic pivot from a walk-in queue tool to the practice's clinical system of record.
> Scope: new **Patient File** capability across the admin portal + Supabase backend. The patient mobile web app changes only where it must (consent capture). Builds directly on the existing schema (`BabyBlue/supabase/migrations/001_initial_schema.sql`).

---

## 1. Thesis — what we are building and why

**The one-line strategy.** The digitised paper file is the *on-ramp*; the living patient record the practice works out of every day is the *product*.

BabyBlue today is a walk-in **queue** tool — valuable, but a "nice-to-have" the practice can cancel. Plan A turns it into the practice's **system of record**: the surface every consultation runs on. Once a practice runs its day out of BabyBlue and its patient history lives here, leaving means re-learning the workflow and migrating live clinical data. That is durable retention — *workflow dependence*, not habit.

**Plan A vs Plan B (why this one).** Plan B (a searchable filing cabinet of scanned PDFs) sits *beside* the practice's workflow — low willingness-to-pay, trivially cancellable, competes with Dropbox. Plan A sits *inside* the workflow — the doctor writes the consult note here, so the practice cannot leave without disruption. We use Plan B's cheap digitisation only as the front door that fills the Patient File on day one.

**Non-negotiable:** Plan A holds *active clinical data*, which moves BabyBlue into POPIA "special personal information" and HPCSA record-keeping territory. §8 is a hard prerequisite, not a follow-up.

---

## 2. The rails we already have (build on these)

The record is ~80% captured already and shown to no one. Plan A is mostly *surfacing existing data* plus three new write surfaces.

| Already captured | Table | Reused as |
|---|---|---|
| The person | `patients` (name, phone, email, dob) | Patient File header — extended with clinical summary |
| Every visit + timestamps | `appointments` | The visit timeline |
| Why they came, per visit | `intake_responses` | Per-visit intake snapshot |
| Full audit trail | `appointment_events` | Timeline events |
| Post-visit rating | `visit_feedback` | Experience signal on the timeline |

**New write surfaces Plan A adds:** consult notes, document store (the digitised file lands here), consent capture, and record-access auditing.

---

## 3. The feature — Patient File

A new **Patients → Patient File** area in the admin portal. Opening a patient shows one screen:

1. **Header** — demographics + structured **clinical summary** (allergies, chronic conditions, current medications, blood type).
2. **Timeline** — reverse-chronological list of every visit (`appointments`), each expandable to its intake answers (`intake_responses`), status events (`appointment_events`), feedback, and the **consult note** for that visit.
3. **Consult note editor** (doctor role) — write/edit a note attached to the visit. *This is the feature that pulls the workflow inside the system; without it we have Plan B.*
4. **Documents** — scanned historical file + any uploads, viewable inline (`patient_documents` → Supabase Storage).
5. **Consent status** — whether the patient has granted records consent, when, and how.
6. Every open/edit/export writes to the **access log** (§8) — a feature *and* a POPIA requirement.

---

## 4. Data model changes

All new tables are `clinic_id`-scoped and follow the existing multi-tenant + RLS pattern. New migration: `supabase/migrations/<ts>_patient_file.sql`.

### 4.1 Extend `patients` with a clinical summary

```sql
ALTER TABLE patients
  ADD COLUMN allergies           TEXT,
  ADD COLUMN chronic_conditions  TEXT,
  ADD COLUMN current_medications TEXT,
  ADD COLUMN blood_type          TEXT,
  ADD COLUMN clinical_notes       TEXT,          -- free-form summary (not per-visit)
  ADD COLUMN record_updated_at   TIMESTAMPTZ;    -- touched on any file edit
```

### 4.2 `visit_notes` — the consult note (the workflow hook)

```sql
CREATE TABLE visit_notes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id      UUID NOT NULL REFERENCES clinics (id)      ON DELETE CASCADE,
  appointment_id UUID NOT NULL REFERENCES appointments (id) ON DELETE CASCADE,
  patient_id     UUID NOT NULL REFERENCES patients (id)     ON DELETE CASCADE,
  author_id      UUID NOT NULL REFERENCES auth.users (id)   ON DELETE SET NULL,
  -- SOAP structure keeps notes usable later; all optional
  subjective     TEXT,
  objective      TEXT,
  assessment     TEXT,
  plan           TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (appointment_id)                                    -- one note per visit
);
CREATE INDEX idx_visit_notes_patient ON visit_notes (patient_id, created_at DESC);
```

### 4.3 `patient_documents` — where the digitised file lands

```sql
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
```

**Storage:** a **private** Supabase Storage bucket `patient-documents`. No public URLs — files are served via short-lived signed URLs minted server-side after an RLS/role check. Path convention: `clinic_id/patient_id/<uuid>-<filename>`.

### 4.4 `patient_consent` — lawful basis (POPIA)

```sql
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
```

### 4.5 `record_access_log` — POPIA access auditing

```sql
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
```

### 4.6 Future (design now, build later)

`prescriptions` and `claims` (medical-aid submission) — the expansion revenue. Not in this spec; the model above is forward-compatible (visit-scoped, patient-scoped).

---

## 5. Row-level security & roles

Extend the existing `profiles.role` model (`admin`, `reception`, `doctor`). Clinical vs admin separation matters for POPIA minimisation.

| Table | reception | doctor | admin |
|---|---|---|---|
| `patients` clinical summary | read | read/write | read/write |
| `visit_notes` | none | read/write (own clinic) | read |
| `patient_documents` | read + upload | read | read/write |
| `patient_consent` | read/write | read | read/write |
| `record_access_log` | none | none | read |

- All policies keep the existing `clinic_id IN (SELECT clinic_id FROM profiles WHERE id = auth.uid())` tenant guard.
- `visit_notes` and `patient_documents` are **written via the client with RLS** (staff are authenticated) — no Edge Function needed, unlike the patient app.
- `record_access_log` is **append-only** (insert policy for staff, select for admin only, no update/delete).

---

## 6. API & admin-portal surfaces

Mostly authenticated Supabase client calls under RLS; two server actions need service-role logic.

**Admin portal (Next.js) — new/changed screens**
- `app/(portal)/patients/[patientId]/page.tsx` — the Patient File (header + timeline + documents + consent).
- `PatientFileClient.tsx` — timeline rendering, note editor, document viewer, consent panel.
- Note editor autosaves to `visit_notes` (upsert on `appointment_id`).
- On file open and on document open → fire an access-log insert.

**Server actions / route handlers**
- `signDocumentUrl(documentId)` — verifies role + tenant, logs `document_view`, returns a short-TTL signed URL from the private bucket.
- `exportPatientRecord(patientId)` — assembles summary + notes + documents into a ZIP/PDF, logs `export`. (POPIA data-subject access.)

**Patient app (minimal change)**
- One optional consent line on join ("Store my visit records with {clinic} — [learn more]"), writing `patient_consent(method='patient_app')`. No new required fields (respects the "never add friction to joining" principle).

---

## 7. The digitisation on-ramp (operational)

A **productised onboarding service**, run once per practice, priced to roughly break even — an acquisition on-ramp, not a profit centre.

```
Paper files → Scan → OCR → Structure/index → Ingest → QA
```

1. **Scan** the practice's paper files to per-patient PDFs.
2. **OCR** to extract `ocr_text` (searchability).
3. **Match** each file to an existing `patients` row (by name/phone/dob) or create the patient.
4. **Ingest** via a service-role script/Edge Function `ingest-document`: uploads to the `patient-documents` bucket, inserts `patient_documents(source='digitised', doc_type='historical_file', original_date=...)`.
5. **QA** — a reviewer spot-checks matches before the practice goes live.

The ongoing record then grows for free: every queue visit already appends to the timeline (§2).

---

## 8. Compliance requirements (hard prerequisites)

**POPIA**
- [ ] Lawful basis: capture patient consent (`patient_consent`) before storing clinical records.
- [ ] **Operator/Data-Processing Agreement** with each practice (BabyBlue is the operator; the practice is the responsible party).
- [ ] Encryption at rest (Supabase default) + private bucket with signed-URL-only access.
- [ ] **Access auditing** (`record_access_log`) — who viewed/edited each record.
- [ ] Data-subject rights: **export** and **delete** a patient's record on request (§6 export; add a guarded hard-delete).
- [ ] Breach-notification process (Information Regulator + affected parties).
- [ ] Retention policy job: HPCSA minimum ~6 years (longer for minors) — do **not** auto-delete inside that window.

**HPCSA**
- [ ] Note content and retention align with HPCSA record-keeping guidelines.
- [ ] Author + timestamp integrity on `visit_notes` (append-only edit history is a later hardening item).

**Data residency**
- [ ] Confirm Supabase region and whether SA data-residency is required for the target practices.

> This compliance surface is real cost — and it is also the moat: it is exactly what stops a competitor cloning BabyBlue in a weekend.

---

## 9. Rollout phases

| Phase | Ship | Outcome |
|---|---|---|
| **0 — Compliance foundation** | consent capture, `record_access_log`, DPA template, private bucket, signed-URL access | Legally allowed to hold clinical data |
| **1 — Read the record** | Patient File screen: header + timeline over existing data + documents viewer | The record becomes *visible* (mostly surfacing existing data) |
| **2 — Write the record** | `visit_notes` editor (doctor) | Workflow moves *inside* BabyBlue — the retention hook |
| **3 — Digitisation on-ramp** | `ingest-document` + operational pipeline | Historical files land in the file; practices onboard |
| **4 — Data-subject rights** | export + guarded delete + retention job | POPIA-complete |
| **Future** | prescriptions → **claims/billing** | Expansion revenue / highest willingness-to-pay |

**Sequencing note:** Phase 2 (`visit_notes`) is the single most important build — it is what makes BabyBlue a system of record rather than a filing cabinet. Everything before it is a prerequisite; everything after it is expansion.

---

## 10. Explicitly out of scope (this spec)

Prescriptions, medical-aid claims/billing, lab integrations, video consults, AI triage. Each is a deliberate later bet; the data model above is designed to accept them without rework.
