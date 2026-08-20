export declare const SA_TZ_OFFSET = "+02:00";
export interface AvailabilityRule {
    weekday: number;
    start_time: string;
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
export declare function weekdayOf(dateISO: string): number;
/**
 * Candidate slots for a date: every rule whose weekday matches, stepped by
 * slot_minutes from start_time while a full slot fits before end_time. Sorted
 * ascending; carries each slot's capacity from its rule.
 */
export declare function candidateSlots(rules: AvailabilityRule[], dateISO: string): CandidateSlot[];
//# sourceMappingURL=booking.d.ts.map