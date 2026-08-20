export type IdType = "rsa_id" | "passport" | "asylum";
export declare function isValidLuhn(digits: string): boolean;
export interface SAIdResult {
    valid: boolean;
    errors: string[];
    /** ISO 'YYYY-MM-DD' derived from digits 1–6, or null if unparseable. */
    dob: string | null;
    gender: "male" | "female" | null;
    citizenship: "citizen" | "permanent_resident" | null;
}
/**
 * Validate a South African ID number and derive what it encodes.
 * Format: YYMMDD SSSS C A Z
 *   1–6   date of birth (YYMMDD)
 *   7–10  gender sequence (>= 5000 male, else female)
 *   11    citizenship (0 = citizen, 1 = permanent resident)
 *   12    usually 8 or 9 (legacy field, not validated)
 *   13    Luhn check digit
 */
export declare function validateSAIdNumber(raw: string): SAIdResult;
export interface IdentityInput {
    idType: IdType;
    idNumber: string;
    /** Country of nationality; required for passport/asylum, informational for rsa_id. */
    nationality?: string | null;
}
export interface IdentityResult {
    valid: boolean;
    errors: string[];
    /** Populated only for rsa_id — use to auto-fill the DOB field. */
    derivedDob: string | null;
}
/**
 * Front-door validator both forms call. Dispatches on id_type: RSA IDs get
 * the full checksum + DOB validation; passport/asylum numbers get lenient
 * format checks (documents from many jurisdictions, no single spec).
 */
export declare function validatePatientIdentity(input: IdentityInput): IdentityResult;
/**
 * Normalise an ID number for storage and dedupe. RSA IDs strip whitespace;
 * passport/asylum strip whitespace and hyphens and upper-case (so "ab-123"
 * and "AB123" collide on the (id_type, id_number) unique index).
 */
export declare function normaliseIdNumber(idType: IdType, raw: string): string;
/**
 * Normalise a phone / WhatsApp number to E.164 (best-effort, South-Africa
 * default — the target market). Returns null when it can't be made into a
 * plausible E.164 string. This is deliberately not a full libphonenumber; it
 * handles the shapes the join / booking forms actually produce:
 *   "082 123 4567" / "0821234567"     → "+27821234567"
 *   "27821234567"  / "+27 82 123 4567"→ "+27821234567"
 *   "+2547…" (other country code)      → kept, digits-only after the +
 */
export declare function normalisePhone(raw: string | null | undefined, defaultCc?: string): string | null;
/** What a front door captured about a person's contact + identity. */
export interface PersonIdentityInput {
    /** The contact number the patient typed. NOT assumed to be WhatsApp. */
    phone?: string | null;
    /** True when the patient confirmed the phone IS their WhatsApp number. */
    phoneIsWhatsapp?: boolean;
    /** A distinct WhatsApp number, when they said the phone is not it. */
    whatsappNumber?: string | null;
    idType?: IdType | null;
    idNumber?: string | null;
}
/** The three `people` number columns, reconciled. */
export interface PersonNumbers {
    phone: string | null;
    whatsapp_number: string | null;
    whatsapp_confirmed: boolean;
}
/**
 * Reconcile a front door's phone/WhatsApp inputs into the `people` number
 * columns — the one place the "phone ≠ WhatsApp" rule lives.
 *   - phoneIsWhatsapp    → whatsapp_number = phone, confirmed
 *   - explicit whatsappNumber → stored + confirmed
 *   - neither            → whatsapp_number null, unconfirmed (reconciled later)
 */
export declare function resolvePersonNumbers(input: PersonIdentityInput): PersonNumbers;
/**
 * A dedupe key for resolve-or-create against `people`, in precedence order.
 * A `number` key must be matched against EITHER the phone OR the
 * whatsapp_number column (a person may have booked with a WhatsApp number and
 * later walked in giving the same number as a plain phone, or vice-versa).
 */
export type PersonMatchKey = {
    by: "number";
    value: string;
} | {
    by: "id";
    idType: IdType;
    idNumber: string;
};
/**
 * Ordered dedupe keys: confirmed WhatsApp number → phone → national ID.
 * De-duplicates identical normalised numbers so we don't query twice.
 */
export declare function personMatchKeys(input: PersonIdentityInput): PersonMatchKey[];
//# sourceMappingURL=identity.d.ts.map