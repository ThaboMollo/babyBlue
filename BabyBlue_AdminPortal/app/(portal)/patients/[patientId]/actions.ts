"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logRecordAccess } from "@/lib/access-log";
import { computeRetention } from "@/lib/retention";
import type {
  ConsentMethod,
  Patient,
  Appointment,
  IntakeResponse,
  AppointmentEvent,
  VisitFeedback,
  VisitNote,
  PatientDocument,
  PatientConsent,
} from "@/types";

type ActionResult = { ok: true } | { error: string };

/**
 * Resolve the caller's clinic + role, or an error. Shared guard for the
 * consent mutations below (both are reception/admin only per the §5 matrix).
 */
type StaffCtx = Awaited<ReturnType<typeof createClient>>;
type StaffResult =
  | { ok: false; error: string }
  | { ok: true; supabase: StaffCtx; userId: string; clinicId: string; role: string };

async function requireStaff(): Promise<StaffResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();
  if (!profile) return { ok: false, error: "No clinic profile." };

  return {
    ok: true,
    supabase,
    userId: user.id,
    clinicId: profile.clinic_id,
    role: profile.role,
  };
}

/** Record records-storage consent (reception/admin). Unblocks clinical writes. */
export async function captureRecordsConsent(
  patientId: string,
  method: ConsentMethod
): Promise<ActionResult> {
  const ctx = await requireStaff();
  if (!ctx.ok) return { error: ctx.error };
  if (ctx.role !== "reception" && ctx.role !== "admin") {
    return { error: "Only reception or admin can capture consent." };
  }

  // Tenant check (RLS would also reject, but we want a friendly message).
  const { data: patient } = await ctx.supabase
    .from("patients")
    .select("id")
    .eq("id", patientId)
    .eq("clinic_id", ctx.clinicId)
    .maybeSingle();
  if (!patient) return { error: "Patient not found." };

  const { error } = await ctx.supabase.from("patient_consent").insert({
    clinic_id: ctx.clinicId,
    patient_id: patientId,
    consent_type: "records_storage",
    granted: true,
    method,
    captured_by: ctx.userId,
  });
  if (error) return { error: error.message };

  revalidatePath(`/patients/${patientId}`);
  return { ok: true };
}

/** Revoke any active records-storage consent (reception/admin). */
export async function revokeRecordsConsent(patientId: string): Promise<ActionResult> {
  const ctx = await requireStaff();
  if (!ctx.ok) return { error: ctx.error };
  if (ctx.role !== "reception" && ctx.role !== "admin") {
    return { error: "Only reception or admin can revoke consent." };
  }

  const { error } = await ctx.supabase
    .from("patient_consent")
    .update({ revoked_at: new Date().toISOString() })
    .eq("patient_id", patientId)
    .eq("clinic_id", ctx.clinicId)
    .eq("consent_type", "records_storage")
    .eq("granted", true)
    .is("revoked_at", null);
  if (error) return { error: error.message };

  revalidatePath(`/patients/${patientId}`);
  return { ok: true };
}

/**
 * Upsert the consult note for a visit (doctor only, one note per
 * appointment). clinic_id / patient_id are derived from the appointment,
 * never trusted from the client. The consent hard-block is enforced by the
 * DB (visit_notes WITH CHECK → has_active_records_consent); a row-level
 * security rejection is surfaced as a friendly "consent required" message.
 */
export async function saveVisitNote(input: {
  appointmentId: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}): Promise<{ ok: true; updatedAt: string } | { error: string }> {
  const ctx = await requireStaff();
  if (!ctx.ok) return { error: ctx.error };
  if (ctx.role !== "doctor") return { error: "Only a doctor can write consult notes." };

  const { data: appt } = await ctx.supabase
    .from("appointments")
    .select("id, clinic_id, patient_id")
    .eq("id", input.appointmentId)
    .eq("clinic_id", ctx.clinicId)
    .maybeSingle();
  if (!appt) return { error: "Visit not found." };

  const { data, error } = await ctx.supabase
    .from("visit_notes")
    .upsert(
      {
        clinic_id: appt.clinic_id,
        appointment_id: appt.id,
        patient_id: appt.patient_id,
        author_id: ctx.userId,
        subjective: input.subjective.trim() || null,
        objective: input.objective.trim() || null,
        assessment: input.assessment.trim() || null,
        plan: input.plan.trim() || null,
      },
      { onConflict: "appointment_id" }
    )
    .select("updated_at")
    .single();

  if (error) {
    const denied = /row-level security|violates/i.test(error.message);
    return {
      error: denied
        ? "Records-storage consent is required before writing clinical notes."
        : error.message,
    };
  }

  // Touch the patient record timestamp (app-level, via SECURITY DEFINER fn).
  await ctx.supabase.rpc("touch_patient_record", { p_patient_id: appt.patient_id });

  revalidatePath(`/patients/${appt.patient_id}`);
  return { ok: true, updatedAt: data.updated_at };
}

const EXPORT_URL_TTL_SECONDS = 3600; // 1h so the data subject can download

/**
 * Assemble a patient's full record for a POPIA data-subject access request
 * (admin only — admins can read visit_notes, so the export is complete).
 * Documents are included as short-lived signed URLs. Logs `export`.
 */
export async function exportPatientRecord(
  patientId: string
): Promise<{ record: unknown } | { error: string }> {
  const ctx = await requireStaff();
  if (!ctx.ok) return { error: ctx.error };
  if (ctx.role !== "admin") return { error: "Only an admin can export a patient record." };
  const supabase = ctx.supabase;

  const { data: patientRow } = await supabase
    .from("patients")
    .select("*")
    .eq("id", patientId)
    .eq("clinic_id", ctx.clinicId)
    .maybeSingle();
  if (!patientRow) return { error: "Patient not found." };
  const patient = patientRow as Patient;

  const [appts, consents] = await Promise.all([
    supabase
      .from("appointments")
      .select("*")
      .eq("patient_id", patientId)
      .order("appointment_date", { ascending: false })
      .returns<Appointment[]>(),
    supabase
      .from("patient_consent")
      .select("*")
      .eq("patient_id", patientId)
      .order("granted_at", { ascending: false })
      .returns<PatientConsent[]>(),
  ]);

  const apptIds = (appts.data ?? []).map((a) => a.id);
  const [intake, events, feedback, notes, documents] = await Promise.all([
    supabase.from("intake_responses").select("*").in("appointment_id", apptIds).returns<IntakeResponse[]>(),
    supabase.from("appointment_events").select("*").in("appointment_id", apptIds).returns<AppointmentEvent[]>(),
    supabase.from("visit_feedback").select("*").in("appointment_id", apptIds).returns<VisitFeedback[]>(),
    supabase.from("visit_notes").select("*").in("appointment_id", apptIds).returns<VisitNote[]>(),
    supabase
      .from("patient_documents")
      .select("*")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false })
      .returns<PatientDocument[]>(),
  ]);

  // Sign document URLs with the service role (no direct staff SELECT on storage).
  const service = createServiceClient();
  const docs: (PatientDocument & { download_url: string | null })[] = [];
  for (const d of documents.data ?? []) {
    const { data: signed } = await service.storage
      .from("patient-documents")
      .createSignedUrl(d.storage_path, EXPORT_URL_TTL_SECONDS);
    docs.push({ ...d, download_url: signed?.signedUrl ?? null });
  }

  const groupBy = <T extends { appointment_id: string }>(rows: T[] | null) => {
    const m = new Map<string, T[]>();
    for (const r of rows ?? []) m.set(r.appointment_id, [...(m.get(r.appointment_id) ?? []), r]);
    return m;
  };
  const intakeBy = groupBy(intake.data);
  const eventsBy = groupBy(events.data);
  const fbBy = new Map((feedback.data ?? []).map((f) => [f.appointment_id, f]));
  const noteBy = new Map((notes.data ?? []).map((n) => [n.appointment_id, n]));

  const visits = (appts.data ?? []).map((a) => ({
    appointment: a,
    intake_responses: intakeBy.get(a.id) ?? [],
    appointment_events: eventsBy.get(a.id) ?? [],
    visit_feedback: fbBy.get(a.id) ?? null,
    visit_note: noteBy.get(a.id) ?? null,
  }));

  await logRecordAccess(supabase, {
    clinicId: ctx.clinicId,
    patientId,
    actorUserId: ctx.userId,
    action: "export",
    context: "patient_file",
  });

  return {
    record: {
      exported_at: new Date().toISOString(),
      exported_by: ctx.userId,
      patient,
      consent: consents.data ?? [],
      visits,
      documents: docs,
    },
  };
}

/**
 * Guarded hard-delete for a POPIA erasure request (admin only). Refuses
 * while the record is inside its HPCSA retention window. Writes a surviving
 * audit row, cascade-deletes the patient, then removes the storage objects.
 */
export async function deletePatientRecord(
  patientId: string,
  opts: { confirmName: string; reason: string }
): Promise<ActionResult> {
  const ctx = await requireStaff();
  if (!ctx.ok) return { error: ctx.error };
  if (ctx.role !== "admin") return { error: "Only an admin can delete a patient record." };
  const supabase = ctx.supabase;

  const { data: patient } = await supabase
    .from("patients")
    .select("id, name, dob, record_updated_at")
    .eq("id", patientId)
    .eq("clinic_id", ctx.clinicId)
    .maybeSingle();
  if (!patient) return { error: "Patient not found." };

  if (opts.confirmName.trim() !== (patient.name ?? "").trim()) {
    return { error: "The name you typed doesn't match this patient." };
  }
  if (!opts.reason?.trim()) return { error: "A reason is required to delete a record." };

  // Last activity = latest of (last appointment, latest note, record touch).
  const [lastAppt, lastNote] = await Promise.all([
    supabase
      .from("appointments")
      .select("appointment_date, completed_at")
      .eq("patient_id", patientId)
      .order("appointment_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("visit_notes")
      .select("updated_at")
      .eq("patient_id", patientId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const candidates = [
    lastAppt.data?.completed_at ?? lastAppt.data?.appointment_date ?? null,
    lastNote.data?.updated_at ?? null,
    patient.record_updated_at ?? null,
  ].filter((v): v is string => Boolean(v));
  const lastActivity = candidates.length ? candidates.sort().at(-1)! : null;

  const retention = computeRetention({ dob: patient.dob, lastActivity });
  if (!retention.eligible) {
    return {
      error: `Cannot delete: this record must be retained until ${
        retention.retainUntil ?? "an undetermined date"
      }. ${retention.reason}`,
    };
  }

  const service = createServiceClient();
  // Capture storage paths before the row (and its documents) cascade away.
  const { data: docs } = await service
    .from("patient_documents")
    .select("storage_path")
    .eq("patient_id", patientId);

  // Surviving audit entry first (no FK to patients, so it outlives the delete).
  await service.from("record_deletion_log").insert({
    clinic_id: ctx.clinicId,
    patient_id: patientId,
    patient_name: patient.name,
    deleted_by: ctx.userId,
    reason: opts.reason.trim(),
    last_activity: lastActivity,
    retain_until: retention.retainUntil,
  });

  const { error: delErr } = await service
    .from("patients")
    .delete()
    .eq("id", patientId)
    .eq("clinic_id", ctx.clinicId);
  if (delErr) return { error: delErr.message };

  const paths = (docs ?? []).map((d: { storage_path: string }) => d.storage_path);
  if (paths.length) await service.storage.from("patient-documents").remove(paths);

  revalidatePath("/patients");
  return { ok: true };
}

const SIGNED_URL_TTL_SECONDS = 60;

type SignResult = { url: string } | { error: string };

/**
 * Mint a short-lived signed URL for a private patient document.
 *
 * Flow:
 *  1. Load the document via the caller's SESSION client — RLS guarantees
 *     it belongs to the caller's clinic (cross-tenant reads return null).
 *  2. Log a `document_view` audit entry under the caller's identity.
 *  3. Sign the object with the SERVICE-ROLE client, because staff are
 *     deliberately NOT granted a direct SELECT on storage.objects (every
 *     view must go through this logged path).
 */
export async function signDocumentUrl(documentId: string): Promise<SignResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();
  if (!profile) return { error: "No clinic profile." };

  // RLS scopes this to the caller's clinic.
  const { data: doc } = await supabase
    .from("patient_documents")
    .select("id, patient_id, clinic_id, storage_path")
    .eq("id", documentId)
    .single();

  if (!doc) return { error: "Document not found." };

  await logRecordAccess(supabase, {
    clinicId: doc.clinic_id,
    patientId: doc.patient_id,
    actorUserId: user.id,
    action: "document_view",
    context: "patient_file",
  });

  const service = createServiceClient();
  const { data: signed, error } = await service.storage
    .from("patient-documents")
    .createSignedUrl(doc.storage_path, SIGNED_URL_TTL_SECONDS);

  if (error || !signed) {
    return { error: error?.message ?? "Could not sign document URL." };
  }
  return { url: signed.signedUrl };
}
