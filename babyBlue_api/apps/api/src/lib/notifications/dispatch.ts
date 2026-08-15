// Notification dispatcher (restructure Seam 3). Ties the pure mapping
// (@babyblue/core) to the outbox + a provider, with idempotency:
//
//   1. INSERT a 'pending' row keyed (appointment_id, kind). A unique-violation
//      means this kind was already handled for this visit → skip (never send
//      twice). This insert-as-guard is the whole idempotency mechanism.
//   2. Send via the channel's provider.
//   3. Record the outcome (sent/failed + provider id).
//
// Runs on the service-role client (the outbox has no client write policies).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { BuiltNotification } from "@babyblue/core";
import { getProvider } from "./provider.js";

export type DispatchOutcome = "sent" | "failed" | "skipped";

export interface DispatchInput {
  appointmentId: string;
  clinicId: string;
  /** The number to message — the confirmed WhatsApp number if any, else phone. */
  to: string;
  notification: BuiltNotification;
}

/** A Postgres unique-violation (duplicate (appointment_id, kind)). */
function isUniqueViolation(error: { code?: string } | null): boolean {
  return error?.code === "23505";
}

export async function dispatchNotification(
  db: SupabaseClient,
  input: DispatchInput
): Promise<DispatchOutcome> {
  const { appointmentId, clinicId, to, notification } = input;

  // 1. Idempotency guard — insert 'pending' keyed on (appointment_id, kind).
  const { data: row, error: insertError } = await db
    .from("notifications")
    .insert({
      appointment_id: appointmentId,
      clinic_id: clinicId,
      kind: notification.kind,
      channel: notification.channel,
      phone: to,
      status: "pending",
    })
    .select("id")
    .single<{ id: string }>();

  if (insertError) {
    if (isUniqueViolation(insertError)) return "skipped"; // already handled
    throw new Error(`Notification enqueue failed: ${insertError.message}`);
  }

  // 2. Deliver.
  const provider = getProvider(notification.channel);
  const result = await provider.send({
    to,
    body: notification.body,
    channel: notification.channel,
  });

  // 3. Record the outcome.
  await db
    .from("notifications")
    .update({ status: result.status, provider_id: result.providerId })
    .eq("id", row.id);

  return result.status === "sent" ? "sent" : "failed";
}
