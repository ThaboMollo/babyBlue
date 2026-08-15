-- ============================================================
-- BabyBlue — Phase 4: Discovery + Booking
-- ============================================================
-- Demand-side front door. Adds the supply catalogue (practitioners, services),
-- per-practice booking mode + live-mode availability, and booking columns on
-- appointments. A confirmed booking is appointments.status='scheduled' (an
-- unused enum value until now) + slot_start; the promoter flips it to 'waiting'
-- at T−2h. No status-enum migration — the Seam 2 machine bridges it.
--
-- Discovery tables are PUBLIC-READ (crawlable, like `clinics`); writes are
-- staff (auth_clinic_id, SECURITY DEFINER) or the API service role.
-- ============================================================

-- ─────────────────────────────────────────
-- 1. practitioners — a bookable/searchable person at a practice
-- ─────────────────────────────────────────
CREATE TABLE practitioners (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id   UUID NOT NULL REFERENCES clinics (id) ON DELETE CASCADE,
  first_name  TEXT NOT NULL,
  last_name   TEXT NOT NULL,
  slug        TEXT NOT NULL,                 -- URL segment, e.g. 'jane-smith'
  title       TEXT,                          -- 'Dr', 'Prof', …
  specialty   TEXT,                          -- 'Dermatology' (discovery dimension)
  bio         TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, slug)
);
CREATE INDEX idx_practitioners_clinic ON practitioners (clinic_id) WHERE is_active;
CREATE INDEX idx_practitioners_specialty ON practitioners (specialty) WHERE is_active;

-- ─────────────────────────────────────────
-- 2. services — what a practice offers
-- ─────────────────────────────────────────
CREATE TABLE services (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id        UUID NOT NULL REFERENCES clinics (id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  slug             TEXT NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 15,
  description      TEXT,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, slug)
);
CREATE INDEX idx_services_clinic ON services (clinic_id) WHERE is_active;

-- ─────────────────────────────────────────
-- 3. clinics — booking mode + discovery location
-- ─────────────────────────────────────────
ALTER TABLE clinics
  ADD COLUMN booking_mode TEXT NOT NULL DEFAULT 'request' CHECK (booking_mode IN ('request','live')),
  ADD COLUMN city         TEXT,
  ADD COLUMN suburb       TEXT;

COMMENT ON COLUMN clinics.booking_mode IS 'request = submit-and-accept (default); live = real-time slot booking with capacity.';

-- ─────────────────────────────────────────
-- 4. clinic_availability — recurring weekly rules (live mode)
-- ─────────────────────────────────────────
CREATE TABLE clinic_availability (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id    UUID NOT NULL REFERENCES clinics (id) ON DELETE CASCADE,
  weekday      SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6),  -- 0 = Sunday
  start_time   TIME NOT NULL,
  end_time     TIME NOT NULL,
  slot_minutes INT NOT NULL DEFAULT 15 CHECK (slot_minutes > 0),
  capacity     INT NOT NULL DEFAULT 1 CHECK (capacity > 0),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_time > start_time)
);
CREATE INDEX idx_clinic_availability_clinic ON clinic_availability (clinic_id, weekday);

-- ─────────────────────────────────────────
-- 5. appointments — booking columns
-- ─────────────────────────────────────────
ALTER TABLE appointments
  ADD COLUMN slot_start      TIMESTAMPTZ,                              -- booked slot (live) / preferred (request)
  ADD COLUMN reason          TEXT,
  ADD COLUMN practitioner_id UUID REFERENCES practitioners (id) ON DELETE SET NULL,
  ADD COLUMN booking_mode    TEXT CHECK (booking_mode IN ('request','live','walk_in')),
  ADD COLUMN confirmed_at    TIMESTAMPTZ;                             -- null = request pending; set = confirmed/live

COMMENT ON COLUMN appointments.confirmed_at IS 'When the booking became confirmed. NULL for an unaccepted request; promoter only queues confirmed bookings.';

CREATE INDEX idx_appointments_slot ON appointments (clinic_id, slot_start) WHERE slot_start IS NOT NULL;

-- ─────────────────────────────────────────
-- 6. RLS — public read of the catalogue; staff manage their own
-- ─────────────────────────────────────────
ALTER TABLE practitioners       ENABLE ROW LEVEL SECURITY;
ALTER TABLE services            ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read active practitioners" ON practitioners FOR SELECT USING (is_active);
CREATE POLICY "Staff manage practitioners" ON practitioners FOR ALL
  USING (clinic_id = auth_clinic_id()) WITH CHECK (clinic_id = auth_clinic_id());

CREATE POLICY "Public read active services" ON services FOR SELECT USING (is_active);
CREATE POLICY "Staff manage services" ON services FOR ALL
  USING (clinic_id = auth_clinic_id()) WITH CHECK (clinic_id = auth_clinic_id());

CREATE POLICY "Public read availability" ON clinic_availability FOR SELECT USING (true);
CREATE POLICY "Staff manage availability" ON clinic_availability FOR ALL
  USING (clinic_id = auth_clinic_id()) WITH CHECK (clinic_id = auth_clinic_id());
