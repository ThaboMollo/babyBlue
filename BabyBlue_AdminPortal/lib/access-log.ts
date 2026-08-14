import type { SupabaseClient } from "@supabase/supabase-js";

export type AccessAction = "view" | "edit" | "document_view" | "export";

/**
 * Append a POPIA access-audit row. Logged SERVER-SIDE (in server
 * components / server actions) so the entry can't be skipped by the
 * client. The insert runs under the caller's session, so RLS enforces
 * clinic_id = auth_clinic_id() and actor_user_id = auth.uid().
 *
 * Best-effort: a logging failure must not break the read it's auditing,
 * so errors are swallowed after being surfaced to the server console.
 */
export async function logRecordAccess(
  supabase: SupabaseClient,
  params: {
    clinicId: string;
    patientId: string;
    actorUserId: string;
    action: AccessAction;
    context?: string;
  }
): Promise<void> {
  const { error } = await supabase.from("record_access_log").insert({
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
