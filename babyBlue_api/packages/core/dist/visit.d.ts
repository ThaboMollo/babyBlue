import type { AppointmentStatus } from "./types.js";
export type VisitStatus = "booked" | "confirmed" | "queued" | "arrived" | "checked_in" | "in_consult" | "consult_ended" | "completed" | "cancelled" | "no_show" | "expired";
export type VisitEvent = "book" | "walk_in_join" | "confirm" | "window_open" | "claim_arrival" | "confirm_arrival" | "start_consult" | "end_consult" | "confirm_complete" | "cancel" | "no_show" | "expire";
export type VisitActor = "patient" | "practice" | "system";
/** States before the consult, from which a Visit may still be cancelled. */
export declare const PRE_CONSULT_STATUSES: readonly VisitStatus[];
/** Terminal states — no transitions leave these. */
export declare const TERMINAL_STATUSES: readonly VisitStatus[];
export interface TransitionResult {
    ok: boolean;
    to?: VisitStatus;
    reason?: string;
}
/**
 * Resolve a transition. Pass `actor` to also enforce who may fire the event;
 * omit it to check only that the state/event pairing is legal.
 */
export declare function transition(from: VisitStatus | null, event: VisitEvent, actor?: VisitActor): TransitionResult;
/** Boolean form of {@link transition}. */
export declare function canTransition(from: VisitStatus | null, event: VisitEvent, actor?: VisitActor): boolean;
/** Like {@link transition} but throws on an illegal move — for call sites that have already validated. */
export declare function nextStatus(from: VisitStatus | null, event: VisitEvent, actor?: VisitActor): VisitStatus;
/** Every event legally fireable from a state (optionally by a given actor). */
export declare function legalEvents(from: VisitStatus | null, actor?: VisitActor): VisitEvent[];
export declare function isTerminal(status: VisitStatus): boolean;
/** True wait: the gap the patient actually waited, queued → checked_in. */
export declare function trueWaitMs(queuedAt: string | null, checkedInAt: string | null): number | null;
/** True consultation length: in_consult → consult_ended. */
export declare function trueConsultMs(inConsultAt: string | null, consultEndedAt: string | null): number | null;
/** Map a legacy appointment status to its Visit equivalent. */
export declare function appointmentToVisitStatus(status: AppointmentStatus): VisitStatus;
/**
 * Collapse a Visit status onto the legacy enum for persistence. Several new
 * states share a legacy bucket (arrived/checked_in are still "waiting";
 * consult_ended is still "done"; no_show/expired collapse to "cancelled").
 */
export declare function visitToAppointmentStatus(status: VisitStatus): AppointmentStatus;
//# sourceMappingURL=visit.d.ts.map