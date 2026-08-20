// ============================================================
// Patient identity validation — the single source of truth.
//
// This used to be copy-pasted into ClinicOS/lib/identity.ts,
// ClinicOS_AdminPortal/lib/identity.ts, AND re-inlined inside the
// join-queue Edge Function (three drifting copies). It now lives here and
// is imported by both apps and the HTTP API.
//
// id_type is one of: 'rsa_id' | 'passport' | 'asylum'  (matches the
// patients.id_type CHECK constraint). RSA IDs are fully validated:
// 13 digits, Luhn checksum on the 13th digit, and a derivable DOB.
// ============================================================
// ─────────────────────────────────────────
// Luhn checksum (mod-10). The 13th digit of a South African ID is the
// check digit; a valid number makes the whole sequence sum to a multiple
// of 10. Doubling every second digit from the right, subtracting 9 when
// the doubled value exceeds 9, is the standard formulation.
// ─────────────────────────────────────────
export function isValidLuhn(digits) {
    if (!/^\d+$/.test(digits))
        return false;
    let sum = 0;
    let double = false;
    for (let i = digits.length - 1; i >= 0; i--) {
        let n = digits.charCodeAt(i) - 48; // fast parseInt for a single digit
        if (double) {
            n *= 2;
            if (n > 9)
                n -= 9;
        }
        sum += n;
        double = !double;
    }
    return sum % 10 === 0;
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
export function validateSAIdNumber(raw) {
    const errors = [];
    const id = (raw ?? "").replace(/\s/g, "");
    if (!/^\d{13}$/.test(id)) {
        errors.push("A South African ID number must be exactly 13 digits.");
        return { valid: false, errors, dob: null, gender: null, citizenship: null };
    }
    // DOB (digits 1–6)
    const yy = Number(id.slice(0, 2));
    const mm = Number(id.slice(2, 4));
    const dd = Number(id.slice(4, 6));
    const dob = deriveDob(yy, mm, dd);
    if (!dob)
        errors.push("The date of birth encoded in the ID number is not a valid date.");
    // Gender (digits 7–10)
    const genderSeq = Number(id.slice(6, 10));
    const gender = genderSeq >= 5000 ? "male" : "female";
    // Citizenship (digit 11)
    const citDigit = id.charAt(10);
    const citizenship = citDigit === "0" ? "citizen" : citDigit === "1" ? "permanent_resident" : null;
    // Checksum (digit 13)
    if (!isValidLuhn(id))
        errors.push("The ID number's checksum digit is invalid.");
    return { valid: errors.length === 0, errors, dob, gender, citizenship };
}
/**
 * Derive an ISO date from the YYMMDD prefix. The two-digit year is
 * disambiguated with a pivot on the current year: a value at or below the
 * current two-digit year is read as 20xx, otherwise 19xx. A resulting
 * future date (or an impossible calendar date) yields null.
 */
function deriveDob(yy, mm, dd) {
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31)
        return null;
    const now = new Date();
    const currentYY = now.getUTCFullYear() % 100;
    const century = yy <= currentYY ? 2000 : 1900;
    const year = century + yy;
    // Round-trip through Date to reject impossible dates (e.g. 31 Feb).
    const d = new Date(Date.UTC(year, mm - 1, dd));
    if (d.getUTCFullYear() !== year || d.getUTCMonth() !== mm - 1 || d.getUTCDate() !== dd) {
        return null;
    }
    if (d.getTime() > now.getTime())
        return null; // DOB can't be in the future
    const mmStr = String(mm).padStart(2, "0");
    const ddStr = String(dd).padStart(2, "0");
    return `${year}-${mmStr}-${ddStr}`;
}
/**
 * Front-door validator both forms call. Dispatches on id_type: RSA IDs get
 * the full checksum + DOB validation; passport/asylum numbers get lenient
 * format checks (documents from many jurisdictions, no single spec).
 */
export function validatePatientIdentity(input) {
    const idNumber = (input.idNumber ?? "").trim();
    const errors = [];
    if (!idNumber) {
        return { valid: false, errors: ["An ID number is required."], derivedDob: null };
    }
    if (input.idType === "rsa_id") {
        const r = validateSAIdNumber(idNumber);
        return { valid: r.valid, errors: r.errors, derivedDob: r.dob };
    }
    // passport / asylum — no universal checksum; sanity-check shape only.
    if (!input.nationality || !input.nationality.trim()) {
        errors.push("Nationality is required for a passport or asylum number.");
    }
    const normalized = idNumber.replace(/[\s-]/g, "");
    if (!/^[A-Za-z0-9]{5,20}$/.test(normalized)) {
        errors.push(input.idType === "passport"
            ? "Enter a valid passport number (5–20 letters and digits)."
            : "Enter a valid asylum/permit number (5–20 letters and digits).");
    }
    return { valid: errors.length === 0, errors, derivedDob: null };
}
/**
 * Normalise an ID number for storage and dedupe. RSA IDs strip whitespace;
 * passport/asylum strip whitespace and hyphens and upper-case (so "ab-123"
 * and "AB123" collide on the (id_type, id_number) unique index).
 */
export function normaliseIdNumber(idType, raw) {
    const trimmed = (raw ?? "").trim();
    if (idType === "rsa_id")
        return trimmed.replace(/\s/g, "");
    return trimmed.replace(/[\s-]/g, "").toUpperCase();
}
// ============================================================
// Global identity (restructure Seam 1)
//
// A person's durable, cross-practice identity is a phone number (ideally the
// WhatsApp number) plus, secondarily, their national ID. These helpers are
// the single home for two rules:
//   1. the entered phone is NOT assumed to be the WhatsApp number
//      (resolvePersonNumbers), and
//   2. the resolve-or-create dedupe precedence (personMatchKeys).
// ============================================================
/**
 * Normalise a phone / WhatsApp number to E.164 (best-effort, South-Africa
 * default — the target market). Returns null when it can't be made into a
 * plausible E.164 string. This is deliberately not a full libphonenumber; it
 * handles the shapes the join / booking forms actually produce:
 *   "082 123 4567" / "0821234567"     → "+27821234567"
 *   "27821234567"  / "+27 82 123 4567"→ "+27821234567"
 *   "+2547…" (other country code)      → kept, digits-only after the +
 */
export function normalisePhone(raw, defaultCc = "27") {
    if (raw === null || raw === undefined)
        return null;
    const trimmed = String(raw).trim();
    if (!trimmed)
        return null;
    const hasPlus = trimmed.startsWith("+");
    const digits = trimmed.replace(/\D/g, "");
    if (!digits)
        return null;
    if (hasPlus) {
        return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
    }
    // Local SA form: leading 0 + 9 national digits (10 total).
    if (digits.startsWith("0") && digits.length === 10) {
        return `+${defaultCc}${digits.slice(1)}`;
    }
    // Country code without the + (e.g. 27XXXXXXXXX).
    if (digits.startsWith(defaultCc) && digits.length === defaultCc.length + 9) {
        return `+${digits}`;
    }
    // Bare 9-digit national number (no leading 0).
    if (digits.length === 9) {
        return `+${defaultCc}${digits}`;
    }
    // Otherwise keep it if it's a plausible international length.
    if (digits.length >= 10 && digits.length <= 15) {
        return `+${digits}`;
    }
    return null;
}
/**
 * Reconcile a front door's phone/WhatsApp inputs into the `people` number
 * columns — the one place the "phone ≠ WhatsApp" rule lives.
 *   - phoneIsWhatsapp    → whatsapp_number = phone, confirmed
 *   - explicit whatsappNumber → stored + confirmed
 *   - neither            → whatsapp_number null, unconfirmed (reconciled later)
 */
export function resolvePersonNumbers(input) {
    const phone = normalisePhone(input.phone ?? null);
    const explicitWa = normalisePhone(input.whatsappNumber ?? null);
    if (input.phoneIsWhatsapp && phone) {
        return { phone, whatsapp_number: phone, whatsapp_confirmed: true };
    }
    if (explicitWa) {
        return { phone, whatsapp_number: explicitWa, whatsapp_confirmed: true };
    }
    return { phone, whatsapp_number: null, whatsapp_confirmed: false };
}
/**
 * Ordered dedupe keys: confirmed WhatsApp number → phone → national ID.
 * De-duplicates identical normalised numbers so we don't query twice.
 */
export function personMatchKeys(input) {
    const keys = [];
    const seen = new Set();
    const pushNumber = (raw) => {
        const n = normalisePhone(raw);
        if (n && !seen.has(n)) {
            seen.add(n);
            keys.push({ by: "number", value: n });
        }
    };
    // 1. A confirmed WhatsApp number is the strongest key.
    if (input.phoneIsWhatsapp)
        pushNumber(input.phone);
    pushNumber(input.whatsappNumber);
    // 2. The plain phone.
    pushNumber(input.phone);
    // 3. National ID.
    if (input.idType && input.idNumber) {
        const idNumber = normaliseIdNumber(input.idType, input.idNumber);
        if (idNumber)
            keys.push({ by: "id", idType: input.idType, idNumber });
    }
    return keys;
}
//# sourceMappingURL=identity.js.map