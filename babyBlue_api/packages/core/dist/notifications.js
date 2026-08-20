// ============================================================
// Notification mapping (restructure Seam 3) — PURE LOGIC: which Visit moments
// produce a patient message, and what it says. No I/O. The dispatcher (in the
// API) takes these and handles idempotency + delivery behind a provider.
//
// WhatsApp is the primary SA channel; SMS is the fallback via the same
// provider seam. Message bodies are the plain-text form — WhatsApp template
// mapping happens at the provider once templates are approved.
// ============================================================
const DEFAULT_CHANNEL = "whatsapp";
function withLink(body, trackUrl) {
    return trackUrl ? `${body} Track your place: ${trackUrl}` : body;
}
/**
 * The message to send when a visit ENTERS a status, or null if that status
 * doesn't warrant one. Position-threshold messages come from
 * {@link positionNotification} instead (they fire on movement, not on a
 * status change).
 */
export function notificationForStatus(status, ctx) {
    switch (status) {
        case "queued":
            return {
                kind: "joined",
                channel: DEFAULT_CHANNEL,
                body: withLink(ctx.position != null
                    ? `You're #${ctx.position} at ${ctx.clinicName}.`
                    : `You've joined the queue at ${ctx.clinicName}.`, ctx.trackUrl),
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
export function positionNotification(position, ctx) {
    if (position <= 0)
        return null;
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
            body: withLink(`You're #${position} at ${ctx.clinicName} — nearly your turn.`, ctx.trackUrl),
        };
    }
    return null;
}
//# sourceMappingURL=notifications.js.map