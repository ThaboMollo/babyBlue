// ============================================================
// Patient identity validation — shared by the walk-in modal and the
// patient-app join form (copy this file into the BabyBlue patient repo
// too; the two apps don't share a package yet).
//
// id_type is one of: 'rsa_id' | 'passport' | 'asylum'  (matches the
// patients.id_type CHECK constraint). RSA IDs are fully validated:
// 13 digits, Luhn checksum on the 13th digit, and a derivable DOB.
// ============================================================

export type IdType = "rsa_id" | "passport" | "asylum";

// ─────────────────────────────────────────
// Luhn checksum (mod-10). The 13th digit of a South African ID is the
// check digit; a valid number makes the whole sequence sum to a multiple
// of 10. Doubling every second digit from the right, subtracting 9 when
// the doubled value exceeds 9, is the standard formulation.
// ─────────────────────────────────────────
export function isValidLuhn(digits: string): boolean {
  if (!/^\d+$/.test(digits)) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = digits.charCodeAt(i) - 48; // fast parseInt for a single digit
    if (double) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    double = !double;
  }
  return sum % 10 === 0;
}

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
export function validateSAIdNumber(raw: string): SAIdResult {
  const errors: string[] = [];
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
  if (!dob) errors.push("The date of birth encoded in the ID number is not a valid date.");

  // Gender (digits 7–10)
  const genderSeq = Number(id.slice(6, 10));
  const gender: SAIdResult["gender"] = genderSeq >= 5000 ? "male" : "female";

  // Citizenship (digit 11)
  const citDigit = id.charAt(10);
  const citizenship: SAIdResult["citizenship"] =
    citDigit === "0" ? "citizen" : citDigit === "1" ? "permanent_resident" : null;

  // Checksum (digit 13)
  if (!isValidLuhn(id)) errors.push("The ID number's checksum digit is invalid.");

  return { valid: errors.length === 0, errors, dob, gender, citizenship };
}

/**
 * Derive an ISO date from the YYMMDD prefix. The two-digit year is
 * disambiguated with a pivot on the current year: a value at or below the
 * current two-digit year is read as 20xx, otherwise 19xx. A resulting
 * future date (or an impossible calendar date) yields null.
 */
function deriveDob(yy: number, mm: number, dd: number): string | null {
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;

  const now = new Date();
  const currentYY = now.getUTCFullYear() % 100;
  const century = yy <= currentYY ? 2000 : 1900;
  const year = century + yy;

  // Round-trip through Date to reject impossible dates (e.g. 31 Feb).
  const d = new Date(Date.UTC(year, mm - 1, dd));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== mm - 1 || d.getUTCDate() !== dd) {
    return null;
  }
  if (d.getTime() > now.getTime()) return null; // DOB can't be in the future

  const mmStr = String(mm).padStart(2, "0");
  const ddStr = String(dd).padStart(2, "0");
  return `${year}-${mmStr}-${ddStr}`;
}

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
export function validatePatientIdentity(input: IdentityInput): IdentityResult {
  const idNumber = (input.idNumber ?? "").trim();
  const errors: string[] = [];

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
    errors.push(
      input.idType === "passport"
        ? "Enter a valid passport number (5–20 letters and digits)."
        : "Enter a valid asylum/permit number (5–20 letters and digits)."
    );
  }

  return { valid: errors.length === 0, errors, derivedDob: null };
}
