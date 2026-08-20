// ============================================================
// Visit state machine (restructure Seam 2) — the single source of truth for
// legal Visit transitions. PURE LOGIC: no I/O, no DB, no time. Every surface
// (booking, queue, presence, WhatsApp, practice portal) imports this so they
// all agree on what is legal. See BabyBlueRestructureSpec §4.2 + Appendix A.
//
// The Visit generalises today's Appointment. Its richer lifecycle exists to
// produce the flow data the tagline promises, as a by-product of a
// double-confirmation UX (patient claims arrival / practice confirms it;
// practice ends the consult / patient confirms it):
//   true wait              = queued      → checked_in
//   true consultation time = in_consult  → consult_ended
//
// This module is deliberately not wired to the DB yet: the `appointments`
// table still uses the legacy 5-value status enum. `visitToAppointmentStatus`
// / `appointmentToVisitStatus` bridge the two until the surfaces (Phase 4)
// and a status migration land.
// ============================================================
/** States before the consult, from which a Visit may still be cancelled. */
export const PRE_CONSULT_STATUSES = [
    "booked",
    "confirmed",
    "queued",
    "arrived",
    "checked_in",
];
/** Terminal states — no transitions leave these. */
export const TERMINAL_STATUSES = [
    "completed",
    "cancelled",
    "no_show",
    "expired",
];
// The canonical transition table (Appendix A). Off-ramps that apply to a set
// of states are expanded below rather than hand-listed per state.
const CORE_TRANSITIONS = [
    { from: null, event: "book", to: "booked", actors: ["patient"] },
    { from: null, event: "walk_in_join", to: "queued", actors: ["patient"] },
    { from: "booked", event: "confirm", to: "confirmed", actors: ["system", "practice"] },
    { from: "confirmed", event: "window_open", to: "queued", actors: ["system"] },
    { from: "queued", event: "claim_arrival", to: "arrived", actors: ["patient"] },
    { from: "arrived", event: "confirm_arrival", to: "checked_in", actors: ["practice"] },
    { from: "checked_in", event: "start_consult", to: "in_consult", actors: ["practice"] },
    { from: "in_consult", event: "end_consult", to: "consult_ended", actors: ["practice"] },
    { from: "consult_ended", event: "confirm_complete", to: "completed", actors: ["patient"] },
];
const OFF_RAMP_TRANSITIONS = [
    // cancel: any pre-consult state, by patient or practice.
    ...PRE_CONSULT_STATUSES.map((from) => ({ from, event: "cancel", to: "cancelled", actors: ["patient", "practice"] })),
    // no_show: a booked-but-uncollected slot or an un-arrived queue entry.
    ...["queued", "confirmed"].map((from) => ({ from, event: "no_show", to: "no_show", actors: ["system", "practice"] })),
    // expire: an unconfirmed / uncollected booking that aged out.
    ...["booked", "confirmed"].map((from) => ({ from, event: "expire", to: "expired", actors: ["system"] })),
];
const TRANSITIONS = [...CORE_TRANSITIONS, ...OFF_RAMP_TRANSITIONS];
/**
 * Resolve a transition. Pass `actor` to also enforce who may fire the event;
 * omit it to check only that the state/event pairing is legal.
 */
export function transition(from, event, actor) {
    const match = TRANSITIONS.find((t) => t.from === from && t.event === event);
    if (!match) {
        return { ok: false, reason: `Illegal transition: ${from ?? "—"} --(${event})-->` };
    }
    if (actor && !match.actors.includes(actor)) {
        return { ok: false, reason: `A ${actor} may not fire "${event}" from "${from ?? "—"}".` };
    }
    return { ok: true, to: match.to };
}
/** Boolean form of {@link transition}. */
export function canTransition(from, event, actor) {
    return transition(from, event, actor).ok;
}
/** Like {@link transition} but throws on an illegal move — for call sites that have already validated. */
export function nextStatus(from, event, actor) {
    const result = transition(from, event, actor);
    if (!result.ok || !result.to)
        throw new Error(result.reason ?? "Illegal transition");
    return result.to;
}
/** Every event legally fireable from a state (optionally by a given actor). */
export function legalEvents(from, actor) {
    return TRANSITIONS.filter((t) => t.from === from && (!actor || t.actors.includes(actor))).map((t) => t.event);
}
export function isTerminal(status) {
    return TERMINAL_STATUSES.includes(status);
}
// ── Flow-data derivations (§4.2) ─────────────────────────────
// Callers pass the timestamps captured at each transition. Returns null when
// either bound is missing.
function diffMs(from, to) {
    if (!from || !to)
        return null;
    const a = Date.parse(from);
    const b = Date.parse(to);
    if (Number.isNaN(a) || Number.isNaN(b))
        return null;
    return b - a;
}
/** True wait: the gap the patient actually waited, queued → checked_in. */
export function trueWaitMs(queuedAt, checkedInAt) {
    return diffMs(queuedAt, checkedInAt);
}
/** True consultation length: in_consult → consult_ended. */
export function trueConsultMs(inConsultAt, consultEndedAt) {
    return diffMs(inConsultAt, consultEndedAt);
}
// ── Legacy bridge (appointments.status ↔ VisitStatus) ─────────
// The DB still uses the 5-value enum. These map both ways so surfaces can
// reason in Visit terms while persisting to the current column, until the
// status migration lands.
/** Map a legacy appointment status to its Visit equivalent. */
export function appointmentToVisitStatus(status) {
    switch (status) {
        case "scheduled":
            return "confirmed";
        case "waiting":
            return "queued";
        case "in_consultation":
            return "in_consult";
        case "done":
            return "completed";
        case "cancelled":
            return "cancelled";
    }
}
/**
 * Collapse a Visit status onto the legacy enum for persistence. Several new
 * states share a legacy bucket (arrived/checked_in are still "waiting";
 * consult_ended is still "done"; no_show/expired collapse to "cancelled").
 */
export function visitToAppointmentStatus(status) {
    switch (status) {
        case "booked":
        case "confirmed":
            return "scheduled";
        case "queued":
        case "arrived":
        case "checked_in":
            return "waiting";
        case "in_consult":
            return "in_consultation";
        case "consult_ended":
        case "completed":
            return "done";
        case "cancelled":
        case "no_show":
        case "expired":
            return "cancelled";
    }
}
//# sourceMappingURL=visit.js.map