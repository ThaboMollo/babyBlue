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

import type { AppointmentStatus } from "./types.js";

export type VisitStatus =
  | "booked" //         online booking created, not yet confirmed
  | "confirmed" //      confirmed (live mode: auto; request mode: practice accepted)
  | "queued" //         in the live queue (walk-in directly, or a booking promoted at T−2h)
  | "arrived" //        patient claimed arrival
  | "checked_in" //     practice confirmed the arrival
  | "in_consult" //     consultation in progress
  | "consult_ended" //  practice ended the consult
  | "completed" //      patient confirmed completion (terminal)
  | "cancelled" //      off-ramp (terminal)
  | "no_show" //        off-ramp (terminal)
  | "expired"; //       off-ramp (terminal)

export type VisitEvent =
  | "book"
  | "walk_in_join"
  | "confirm"
  | "window_open"
  | "claim_arrival"
  | "confirm_arrival"
  | "start_consult"
  | "end_consult"
  | "confirm_complete"
  | "cancel"
  | "no_show"
  | "expire";

export type VisitActor = "patient" | "practice" | "system";

/** States before the consult, from which a Visit may still be cancelled. */
export const PRE_CONSULT_STATUSES: readonly VisitStatus[] = [
  "booked",
  "confirmed",
  "queued",
  "arrived",
  "checked_in",
] as const;

/** Terminal states — no transitions leave these. */
export const TERMINAL_STATUSES: readonly VisitStatus[] = [
  "completed",
  "cancelled",
  "no_show",
  "expired",
] as const;

interface Transition {
  /** `null` = an entry event that creates the Visit (no prior state). */
  from: VisitStatus | null;
  event: VisitEvent;
  to: VisitStatus;
  /** Which actors may legally fire this event. */
  actors: readonly VisitActor[];
}

// The canonical transition table (Appendix A). Off-ramps that apply to a set
// of states are expanded below rather than hand-listed per state.
const CORE_TRANSITIONS: Transition[] = [
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

const OFF_RAMP_TRANSITIONS: Transition[] = [
  // cancel: any pre-consult state, by patient or practice.
  ...PRE_CONSULT_STATUSES.map(
    (from): Transition => ({ from, event: "cancel", to: "cancelled", actors: ["patient", "practice"] })
  ),
  // no_show: a booked-but-uncollected slot or an un-arrived queue entry.
  ...(["queued", "confirmed"] as VisitStatus[]).map(
    (from): Transition => ({ from, event: "no_show", to: "no_show", actors: ["system", "practice"] })
  ),
  // expire: an unconfirmed / uncollected booking that aged out.
  ...(["booked", "confirmed"] as VisitStatus[]).map(
    (from): Transition => ({ from, event: "expire", to: "expired", actors: ["system"] })
  ),
];

const TRANSITIONS: Transition[] = [...CORE_TRANSITIONS, ...OFF_RAMP_TRANSITIONS];

export interface TransitionResult {
  ok: boolean;
  to?: VisitStatus;
  reason?: string;
}

/**
 * Resolve a transition. Pass `actor` to also enforce who may fire the event;
 * omit it to check only that the state/event pairing is legal.
 */
export function transition(
  from: VisitStatus | null,
  event: VisitEvent,
  actor?: VisitActor
): TransitionResult {
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
export function canTransition(
  from: VisitStatus | null,
  event: VisitEvent,
  actor?: VisitActor
): boolean {
  return transition(from, event, actor).ok;
}

/** Like {@link transition} but throws on an illegal move — for call sites that have already validated. */
export function nextStatus(
  from: VisitStatus | null,
  event: VisitEvent,
  actor?: VisitActor
): VisitStatus {
  const result = transition(from, event, actor);
  if (!result.ok || !result.to) throw new Error(result.reason ?? "Illegal transition");
  return result.to;
}

/** Every event legally fireable from a state (optionally by a given actor). */
export function legalEvents(from: VisitStatus | null, actor?: VisitActor): VisitEvent[] {
  return TRANSITIONS.filter(
    (t) => t.from === from && (!actor || t.actors.includes(actor))
  ).map((t) => t.event);
}

export function isTerminal(status: VisitStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

// ── Flow-data derivations (§4.2) ─────────────────────────────
// Callers pass the timestamps captured at each transition. Returns null when
// either bound is missing.

function diffMs(from: string | null | undefined, to: string | null | undefined): number | null {
  if (!from || !to) return null;
  const a = Date.parse(from);
  const b = Date.parse(to);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return b - a;
}

/** True wait: the gap the patient actually waited, queued → checked_in. */
export function trueWaitMs(queuedAt: string | null, checkedInAt: string | null): number | null {
  return diffMs(queuedAt, checkedInAt);
}

/** True consultation length: in_consult → consult_ended. */
export function trueConsultMs(inConsultAt: string | null, consultEndedAt: string | null): number | null {
  return diffMs(inConsultAt, consultEndedAt);
}

// ── Legacy bridge (appointments.status ↔ VisitStatus) ─────────
// The DB still uses the 5-value enum. These map both ways so surfaces can
// reason in Visit terms while persisting to the current column, until the
// status migration lands.

/** Map a legacy appointment status to its Visit equivalent. */
export function appointmentToVisitStatus(status: AppointmentStatus): VisitStatus {
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
export function visitToAppointmentStatus(status: VisitStatus): AppointmentStatus {
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
