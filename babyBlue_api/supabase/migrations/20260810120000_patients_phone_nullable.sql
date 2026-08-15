-- ============================================================
-- Phase 3 (digitisation ingest): scanned historical files frequently
-- carry only a name + ID number, no phone. Relax patients.phone NOT NULL
-- so ingest can create such patients.
--
-- UNIQUE (clinic_id, phone) still holds — Postgres treats NULLs as
-- distinct, so multiple phone-less patients per clinic are allowed.
-- The join flow and walk-in modal still REQUIRE phone at the app layer.
-- ============================================================

ALTER TABLE patients ALTER COLUMN phone DROP NOT NULL;
