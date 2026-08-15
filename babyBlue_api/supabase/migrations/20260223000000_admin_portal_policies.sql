-- ─────────────────────────────────────────
-- Admin portal additional policies + trigger
-- ─────────────────────────────────────────

-- Allow authenticated users to create a new clinic (onboarding flow)
CREATE POLICY "Authenticated users can create clinics"
  ON clinics FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow users to create their own profile (onboarding flow)
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- Admins can read all profiles in their clinic (staff management)
-- Drop the restrictive existing read policy and replace with a broader one
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
CREATE POLICY "Staff can read relevant profiles"
  ON profiles FOR SELECT
  USING (
    id = auth.uid()
    OR clinic_id IN (
      SELECT clinic_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Staff can insert appointment events (audit log on status changes)
CREATE POLICY "Staff can insert appointment events"
  ON appointment_events FOR INSERT
  TO authenticated
  WITH CHECK (
    clinic_id IN (
      SELECT clinic_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Trigger: auto-set timestamps when appointment status changes
CREATE OR REPLACE FUNCTION handle_appointment_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'in_consultation' AND (OLD.status IS DISTINCT FROM 'in_consultation') THEN
    NEW.consultation_started_at = now();
  END IF;
  IF NEW.status = 'done' AND (OLD.status IS DISTINCT FROM 'done') THEN
    NEW.completed_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_appointment_status_change
  BEFORE UPDATE ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION handle_appointment_status_change();
