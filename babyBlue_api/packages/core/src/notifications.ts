// ============================================================
// Notification mapping (restructure Seam 3) — PURE LOGIC: which Visit moments
// produce a patient message, and what it says. No I/O. The dispatcher (in the
// API) takes these and handles idempotency + delivery behind a provider.
//
// WhatsApp is the primary SA channel; SMS is the fallback via the same
// provider seam. Message bodies are the plain-text form — WhatsApp template
// mapping happens at the provider once templates are approved.
// ============================================================

import type { VisitStatus } from "./visit.js";

export type NotificationChannel = "sms" | "whatsapp";

/**
 * The distinct messages a visit can produce. Each `kind` is sent at most once
 * per visit — the DB's UNIQUE (appointment_id, kind) enforces it, so these
 * double as idempotency keys.
 */
export type NotificationKind =
  | "joined" //      you're in the queue (also recovers a lost tracking link)
  | "confirmed" //   your booking is confirmed
  | "almost_up" //   position has fallen to ≤ 3 — get close
  | "youre_next" //  position 1 — head back now
  | "consult_ended"; //  wrap-up / feedback prompt

export interface NotificationContext {
  clinicName: string;
  /** Current queue position, when relevant. */
  position?: number;
  /** Magic link back to the thin presence page. */
  trackUrl?: string;
}

export interface BuiltNotification {
  kind: NotificationKind;
  channel: NotificationChannel;
  body: string;
}

const DEFAULT_CHANNEL: NotificationChannel = "whatsapp";

function withLink(body: string, trackUrl?: string): string {
  return trackUrl ? `${body} Track your place: ${trackUrl}` : body;
}

/**
 * The message to send when a visit ENTERS a status, or null if that status
 * doesn't warrant one. Position-threshold messages come from
 * {@link positionNotification} instead (they fire on movement, not on a
 * status change).
 */
export function notificationForStatus(
  status: VisitStatus,
  ctx: NotificationContext
): BuiltNotification | null {
  switch (status) {
    case "queued":
      return {
        kind: "joined",
        channel: DEFAULT_CHANNEL,
        body: withLink(
          ctx.position != null
            ? `You're #${ctx.position} at ${ctx.clinicName}.`
            : `You've joined the queue at ${ctx.clinicName}.`,
          ctx.trackUrl
        ),
      };
    case "confirmed":
      return {
        kind: "confirmed",
        channel: DEFAULT_CHANNEL,
        body: withLink(`Your booking at ${ctx.clinicName} is confirmed.`, ctx.trackUrl),
      };
    case "consult_ended":
      return {
        kind: "consult_ended",
        channel: DEFAULT_CHANNEL,
        body: `Thanks for visiting ${ctx.clinicName}. Tap to tell us how it went.`,
      };
    default:
      // booked/arrived/checked_in/in_consult/completed/off-ramps: no message.
      return null;
  }
}

/**
 * Throttled position-change message: only the meaningful threshold crossings
 * get a message (≤ 3 "almost up", = 1 "you're next"), never every step. The
 * once-per-kind idempotency guard means a patient gets at most one of each as
 * they move up.
 */
export function positionNotification(
  position: number,
  ctx: NotificationContext
): BuiltNotification | null {
  if (position <= 0) return null;
  if (position === 1) {
    return {
      kind: "youre_next",
      channel: DEFAULT_CHANNEL,
      body: `You're next at ${ctx.clinicName}. Please head back now.`,
    };
  }
  if (position <= 3) {
    return {
      kind: "almost_up",
      channel: DEFAULT_CHANNEL,
      body: withLink(
        `You're #${position} at ${ctx.clinicName} — nearly your turn.`,
        ctx.trackUrl
      ),
    };
  }
  return null;
}
