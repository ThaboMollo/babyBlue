-- §4.1 Post-visit feedback — one row per appointment, written by submit-feedback Edge Function
CREATE TABLE visit_feedback (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL UNIQUE REFERENCES appointments (id) ON DELETE CASCADE,
  clinic_id      UUID NOT NULL REFERENCES clinics (id) ON DELETE CASCADE,
  rating         INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment        TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_visit_feedback_clinic ON visit_feedback (clinic_id, created_at);

ALTER TABLE visit_feedback ENABLE ROW LEVEL SECURITY;

-- Staff read only; patient writes go through the Edge Function (service role)
CREATE POLICY "Staff can read clinic feedback"
  ON visit_feedback FOR SELECT
  USING (
    clinic_id IN (
      SELECT clinic_id FROM profiles WHERE id = auth.uid()
    )
  );
