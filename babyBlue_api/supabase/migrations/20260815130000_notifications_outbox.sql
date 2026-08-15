-- ============================================================
-- BabyBlue — Restructure Seam 3: event-driven notification outbox
-- ============================================================
-- State transitions emit typed events; a dispatcher maps event → message →
-- channel and delivers behind a provider interface (SMS today → WhatsApp as
-- the primary SA channel). This table is BOTH the send-log and the
-- idempotency guard: UNIQUE (appointment_id, kind) means the same message is
-- never sent twice per visit (spec §8; generalises the ValueRoadmap §3.1
-- notifications design).
--
-- Keyed on appointment_id because the Visit is still persisted as an
-- `appointments` row (Seam 2's state machine is pure core logic, not yet a
-- `visits` table). Becomes visit_id when that entity lands.
--
-- Written only by the service-role dispatcher; staff may read their clinic's
-- log. No client insert/update/delete policies.
-- ============================================================

CREATE TABLE notifications (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES appointments (id) ON DELETE CASCADE,
  clinic_id      UUID NOT NULL REFERENCES clinics (id)      ON DELETE CASCADE,
  kind           TEXT NOT NULL,                                     -- 'joined' | 'confirmed' | 'almost_up' | 'youre_next' | …
  channel        TEXT NOT NULL CHECK (channel IN ('sms', 'whatsapp')),
  phone          TEXT NOT NULL,                                     -- the number actually messaged (WhatsApp if confirmed, else phone)
  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'sent', 'failed')),
  provider_id    TEXT,                                             -- id returned by the SMS/WhatsApp provider
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Idempotency: at most one message of each kind per visit. The dispatcher
  -- inserts-as-guard; a conflict means "already handled — skip".
  UNIQUE (appointment_id, kind)
);

CREATE INDEX idx_notifications_appointment ON notifications (appointment_id);
CREATE INDEX idx_notifications_clinic_created ON notifications (clinic_id, created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Staff may read their own clinic's send-log (a future "messages sent" view).
-- Writes are service-role only (the dispatcher) — no insert/update policies.
CREATE POLICY "Staff read clinic notifications"
  ON notifications FOR SELECT
  USING (clinic_id = auth_clinic_id());
