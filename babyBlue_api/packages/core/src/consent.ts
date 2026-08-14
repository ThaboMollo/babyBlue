// ============================================================
// Records-storage consent (POPIA) — the settled model.
//
// Consent is a DB-enforced HARD BLOCK: has_active_records_consent(patient_id)
// gates every clinical write (visit_notes / patient_documents). These
// constants/types keep the API, both apps, and the ingest on-ramp aligned
// on the same vocabulary the `patient_consent` table uses.
// ============================================================

export type ConsentType = "records_storage" | "data_processing";
export type ConsentMethod = "patient_app" | "reception_verbal" | "signed_form";

export const CONSENT_METHODS: readonly ConsentMethod[] = [
  "patient_app",
  "reception_verbal",
  "signed_form",
] as const;

export function isConsentMethod(value: unknown): value is ConsentMethod {
  return typeof value === "string" && (CONSENT_METHODS as readonly string[]).includes(value);
}
