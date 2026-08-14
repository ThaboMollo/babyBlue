// ============================================================
// HPCSA record-retention rules (SystemOfRecordSpec.md §8).
//
// Guideline: keep records at least 6 years from the last consultation.
// For minors, keep until the patient turns 21 (and at least the 6 years).
// A POPIA erasure request does NOT override a legal retention obligation —
// so hard-delete is refused while a record is inside its retention window.
// ============================================================

export const ADULT_RETENTION_YEARS = 6;
export const MINOR_RETAIN_UNTIL_AGE = 21;

export interface RetentionInput {
  dob: string | null; // ISO YYYY-MM-DD
  lastActivity: string | null; // ISO date/timestamp of the last consultation / record activity
  now?: Date;
}

export interface RetentionResult {
  retainUntil: string | null; // ISO date; null when it can't be determined
  eligible: boolean; // true ⇒ past the window, safe to delete
  reason: string;
}

function addYears(d: Date, years: number): Date {
  const r = new Date(d);
  r.setUTCFullYear(r.getUTCFullYear() + years);
  return r;
}

function fullYearsBetween(from: Date, to: Date): number {
  let years = to.getUTCFullYear() - from.getUTCFullYear();
  const m = to.getUTCMonth() - from.getUTCMonth();
  if (m < 0 || (m === 0 && to.getUTCDate() < from.getUTCDate())) years--;
  return years;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Compute the earliest date a patient's record may be hard-deleted, and
 * whether that date has passed. Conservative when data is missing: with no
 * recorded activity we can't date the window, so deletion is not eligible.
 */
export function computeRetention(input: RetentionInput): RetentionResult {
  const now = input.now ?? new Date();

  if (!input.lastActivity) {
    return {
      retainUntil: null,
      eligible: false,
      reason: "No recorded activity to measure the retention window from.",
    };
  }

  const last = new Date(input.lastActivity);
  let retainUntil = addYears(last, ADULT_RETENTION_YEARS);
  let reason = `${ADULT_RETENTION_YEARS} years from last activity (${isoDate(last)}).`;

  if (input.dob) {
    const dob = new Date(input.dob);
    const ageAtLast = fullYearsBetween(dob, last);
    if (ageAtLast < 18) {
      const minorUntil = addYears(dob, MINOR_RETAIN_UNTIL_AGE);
      if (minorUntil.getTime() > retainUntil.getTime()) {
        retainUntil = minorUntil;
        reason = `Minor at last visit — retain until age ${MINOR_RETAIN_UNTIL_AGE} (${isoDate(minorUntil)}).`;
      }
    }
  }

  return {
    retainUntil: isoDate(retainUntil),
    eligible: now.getTime() >= retainUntil.getTime(),
    reason,
  };
}
