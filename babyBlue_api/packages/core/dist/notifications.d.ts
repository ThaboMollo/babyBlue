import type { VisitStatus } from "./visit.js";
export type NotificationChannel = "sms" | "whatsapp";
/**
 * The distinct messages a visit can produce. Each `kind` is sent at most once
 * per visit — the DB's UNIQUE (appointment_id, kind) enforces it, so these
 * double as idempotency keys.
 */
export type NotificationKind = "joined" | "confirmed" | "almost_up" | "youre_next" | "consult_ended";
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
/**
 * The message to send when a visit ENTERS a status, or null if that status
 * doesn't warrant one. Position-threshold messages come from
 * {@link positionNotification} instead (they fire on movement, not on a
 * status change).
 */
export declare function notificationForStatus(status: VisitStatus, ctx: NotificationContext): BuiltNotification | null;
/**
 * Throttled position-change message: only the meaningful threshold crossings
 * get a message (≤ 3 "almost up", = 1 "you're next"), never every step. The
 * once-per-kind idempotency guard means a patient gets at most one of each as
 * they move up.
 */
export declare function positionNotification(position: number, ctx: NotificationContext): BuiltNotification | null;
//# sourceMappingURL=notifications.d.ts.map