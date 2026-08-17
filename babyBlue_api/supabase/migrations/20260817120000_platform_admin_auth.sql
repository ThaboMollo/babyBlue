-- ============================================================
-- BabyBlue — Platform tier + gated admin registration + profile names
-- ============================================================
-- Adds a Super Admin tier (platform-level, orthogonal to the clinic RLS model),
-- a clinic approval gate (clinics start 'pending' until a Super Admin approves),
-- and first/last name on profiles (consistent with the patient identity split).
-- ============================================================

-- ─────────────────────────────────────────
-- 1. platform_admins — the Super Admin tier
--    A platform admin has NO clinic-scoped profile; they operate the platform
--    console via the service-role API. RLS lets a platform admin read the table
--    (to self-verify); all writes are service-role only (no write policies).
-- ─────────────────────────────────────────
CREATE TABLE platform_admins (
  user_id    UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;

-- SECURITY DEFINER so a policy can call it without recursing into this table's RLS.
CREATE OR REPLACE FUNCTION is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid());
$$;
GRANT EXECUTE ON FUNCTION is_platform_admin() TO authenticated;

CREATE POLICY "Platform admins read platform_admins"
  ON platform_admins FOR SELECT
  USING (is_platform_admin());

-- ─────────────────────────────────────────
-- 2. clinics.status — the approval gate
--    New clinics start 'pending'; existing clinics are grandfathered to 'active'
--    so the demo data keeps working.
-- ─────────────────────────────────────────
ALTER TABLE clinics
  ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'suspended'));

UPDATE clinics SET status = 'active';   -- grandfather all pre-existing clinics

COMMENT ON COLUMN clinics.status IS 'pending until a Super Admin approves; only active clinics are public (discoverable + bookable).';

-- ─────────────────────────────────────────
-- 3. profiles — first/last name (backfill from full_name)
-- ─────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN first_name TEXT,
  ADD COLUMN last_name  TEXT;

UPDATE profiles
SET first_name = NULLIF(split_part(coalesce(full_name, ''), ' ', 1), ''),
    last_name  = NULLIF(trim(substr(coalesce(full_name, ''), strpos(coalesce(full_name, '') || ' ', ' ') + 1)), '')
WHERE full_name IS NOT NULL;

-- ─────────────────────────────────────────
-- 4. Seed the Super Admin (mollodagod@gmail.com)
-- ─────────────────────────────────────────
INSERT INTO platform_admins (user_id)
SELECT id FROM auth.users WHERE email = 'mollodagod@gmail.com'
ON CONFLICT (user_id) DO NOTHING;
