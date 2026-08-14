import type { SupabaseClient } from "@supabase/supabase-js";

export type AccessAction = "view" | "edit" | "document_view" | "export";

/**
 * Append a POPIA access-audit row under the caller's own session client, so
 * RLS enforces clinic_id = auth_clinic_id() and actor_user_id = auth.uid().
 * Best-effort: a logging failure must not break the operation it audits.
 */
export async function logRecordAccess(
  db: SupabaseClient,
  params: {
    clinicId: string;
    patientId: string;
    actorUserId: string;
    action: AccessAction;
    context?: string;
  }
): Promise<void> {
  const { error } = await db.from("record_access_log").insert({
    clinic_id: params.clinicId,
    patient_id: params.patientId,
    actor_user_id: params.actorUserId,
    action: params.action,
    context: params.context ?? null,
  });
  if (error) {
    console.error("[record_access_log] failed to write audit entry:", error.message);
  }
}
