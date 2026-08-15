# BabyBlue — canonical database schema

`migrations/` here is the **single source of truth** for the BabyBlue database
(the new environment). The API (`apps/api`) holds the only service-role key and
is the intended single write path, so the schema lives with the spine.

The order is lexicographic by filename; the pre-restructure migrations were
consolidated here from the two app repos (which interleave by timestamp):

```
001_initial_schema.sql              core tables, RLS            (from client app)
20260221132724_seed_demo_clinic.sql demo clinic seed           (from client app)
20260223000000_admin_portal_policies.sql onboarding + triggers (from admin portal)
20260716140000_visit_feedback.sql   post-visit feedback        (from client app)
20260716140100_analytics_views.sql  clinic flow views          (from client app)
20260809120000_patient_file.sql     patient file / SoR + RLS   (from admin portal)
20260810120000_patients_phone_nullable.sql                     (from admin portal)
20260810130000_record_deletion_log.sql POPIA delete trail      (from admin portal)
20260815120000_global_identity.sql  Seam 1 — global `people`   (restructure)
```

## Legacy

`BabyBlue_clientApp/supabase/migrations/` and
`BabyBlue_AdminPortal/supabase/migrations/` are **legacy** — kept for history
but no longer the source of truth. Apply migrations for the new environment from
this directory only. (They will be reconciled when the apps are absorbed into the
monorepo in Phase 5.)
