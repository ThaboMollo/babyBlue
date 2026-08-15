// ============================================================
// Booking slot generation (Phase 4) — PURE LOGIC. Given a practice's recurring
// weekly availability rules and a date, produce the candidate slot start times.
// The API subtracts already-booked counts (capacity) to get open slots.
//
// South Africa observes no DST, so clinic-local time is a fixed +02:00. Slot
// starts are emitted as ISO strings with that offset; the DB stores them as
// timestamptz.
// ============================================================

export const SA_TZ_OFFSET = "+02:00"; // Africa/Johannesburg, no DST

export interface AvailabilityRule {
  weekday: number; // 0 = Sunday … 6 = Saturday
  start_time: string; // 'HH:MM' or 'HH:MM:SS'
  end_time: string;
  slot_minutes: number;
  capacity: number;
}

export interface CandidateSlot {
  /** ISO start, e.g. '2026-08-20T09:15:00+02:00'. */
  start: string;
  capacity: number;
}

/** Weekday (0=Sun … 6=Sat) of an ISO date 'YYYY-MM-DD' in SA local time. */
export function weekdayOf(dateISO: string): number {
  return new Date(`${dateISO}T12:00:00${SA_TZ_OFFSET}`).getUTCDay();
}

function toMinutes(t: string): number {
  const [h = 0, m = 0] = t.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Candidate slots for a date: every rule whose weekday matches, stepped by
 * slot_minutes from start_time while a full slot fits before end_time. Sorted
 * ascending; carries each slot's capacity from its rule.
 */
export function candidateSlots(rules: AvailabilityRule[], dateISO: string): CandidateSlot[] {
  const wd = weekdayOf(dateISO);
  const out: CandidateSlot[] = [];
  for (const r of rules) {
    if (r.weekday !== wd) continue;
    const start = toMinutes(r.start_time);
    const end = toMinutes(r.end_time);
    for (let m = start; m + r.slot_minutes <= end; m += r.slot_minutes) {
      const hh = String(Math.floor(m / 60)).padStart(2, "0");
      const mm = String(m % 60).padStart(2, "0");
      out.push({ start: `${dateISO}T${hh}:${mm}:00${SA_TZ_OFFSET}`, capacity: r.capacity });
    }
  }
  return out.sort((a, b) => a.start.localeCompare(b.start));
}
