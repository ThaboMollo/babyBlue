export type ConsentType = "records_storage" | "data_processing";
export type ConsentMethod = "patient_app" | "reception_verbal" | "signed_form";
export declare const CONSENT_METHODS: readonly ConsentMethod[];
export declare function isConsentMethod(value: unknown): value is ConsentMethod;
//# sourceMappingURL=consent.d.ts.map