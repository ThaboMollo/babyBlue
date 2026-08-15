-- Seed demo clinic for testing
INSERT INTO clinics (name, slug, address, phone, avg_consultation_minutes)
VALUES (
  'BabyBlue Demo Clinic',
  'demo-clinic',
  '123 Main Street, Johannesburg',
  '011 000 0000',
  10
)
ON CONFLICT (slug) DO NOTHING;

-- Inherit all global intake questions for the demo clinic
INSERT INTO clinic_intake_questions (clinic_id, template_id, inherit_global, sort_order)
SELECT
  (SELECT id FROM clinics WHERE slug = 'demo-clinic'),
  id,
  true,
  sort_order
FROM intake_question_templates
WHERE is_active = true
ON CONFLICT DO NOTHING;
