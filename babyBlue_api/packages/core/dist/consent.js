// ============================================================
// Records-storage consent (POPIA) — the settled model.
//
// Consent is a DB-enforced HARD BLOCK: has_active_records_consent(patient_id)
// gates every clinical write (visit_notes / patient_documents). These
// constants/types keep the API, both apps, and the ingest on-ramp aligned
// on the same vocabulary the `patient_consent` table uses.
// ============================================================
export const CONSENT_METHODS = [
    "patient_app",
    "reception_verbal",
    "signed_form",
];
export function isConsentMethod(value) {
    return typeof value === "string" && CONSENT_METHODS.includes(value);
}
//# sourceMappingURL=consent.js.map