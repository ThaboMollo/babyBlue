// Staff-authenticated endpoints (require `Authorization: Bearer <jwt>`).
// Ports of the admin portal's server actions. Enforcement rules preserved:
//   - reads/audited writes go through the caller's RLS-scoped client (ctx.db)
//   - the service client is used ONLY where RLS can't express the op
//     (signing storage URLs, guarded delete) and role/tenant is re-checked
//   - the consent hard-block is enforced by the DB; we surface it friendlily
//   - HPCSA retention (@babyblue/core) gates hard-delete

import { Hono } from "hono";
import {
  computeRetention,
  isConsentMethod,
  validatePatientIdentity,
  appointmentToVisitStatus,
  notificationForStatus,
  type Patient,
  type IdType,
  type AppointmentStatus,
  type VisitStatus,
} from "@babyblue/core";
import { serviceClient } from "../supabase.js";
import { requireStaff, requireRole, staff } from "../middleware/auth.js";
import { resolveOrCreatePerson } from "../lib/people.js";
import { dispatchNotification } from "../lib/notifications/dispatch.js";
import { badRequest, forbidden, notFound, serverError } from "../http.js";
import { logRecordAccess } from "../lib/access-log.js";
import type { AppEnv } from "../types.js";

export const adminRoutes = new Hono<AppEnv>();

adminRoutes.use("*", requireStaff);

const EXPORT_URL_TTL_SECONDS = 3600; // 1h so the data subject can download
const SIGNED_URL_TTL_SECONDS = 60;

// Legacy status transitions the staff UI performs — the coarse legacy
// projection of the Seam 2 Visit machine (the granular arrived/checked_in
// double-confirm flow lands with the patient surfaces). A move is legal iff
// the target is in the source's list; empty lists are terminal.
const LEGACY_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  scheduled: ["waiting", "cancelled"],
  waiting: ["in_consultation", "done", "cancelled"],
  in_consultation: ["done", "cancelled"],
  done: [],
  cancelled: [],
};

// ── POST /patients/:patientId/consent ────────────────────────
adminRoutes.post("/patients/:patientId/consent", async (c) => {
  const ctx = requireRole(c, "reception", "admin");
  const patientId = c.req.param("patientId");
  const { method } = await c.req.json<{ method?: string }>().catch(() => ({ method: undefined }));
  if (!isConsentMethod(method)) throw badRequest("A valid consent method is required.");

  const { data: patient } = await ctx.db
    .from("patients")
    .select("id")
    .eq("id", patientId)
    .eq("clinic_id", ctx.clinicId)
    .maybeSingle();
  if (!patient) throw notFound("Patient not found.");

  const { error } = await ctx.db.from("patient_consent").insert({
    clinic_id: ctx.clinicId,
    patient_id: patientId,
    consent_type: "records_storage",
    granted: true,
    method,
    captured_by: ctx.userId,
  });
  if (error) throw serverError(error.message);

  return c.json({ ok: true });
});

// ── DELETE /patients/:patientId/consent (revoke) ─────────────
adminRoutes.delete("/patients/:patientId/consent", async (c) => {
  const ctx = requireRole(c, "reception", "admin");
  const patientId = c.req.param("patientId");

  const { error } = await ctx.db
    .from("patient_consent")
    .update({ revoked_at: new Date().toISOString() })
    .eq("patient_id", patientId)
    .eq("clinic_id", ctx.clinicId)
    .eq("consent_type", "records_storage")
    .eq("granted", true)
    .is("revoked_at", null);
  if (error) throw serverError(error.message);

  return c.json({ ok: true });
});

// ── PUT /appointments/:appointmentId/visit-note ──────────────
adminRoutes.put("/appointments/:appointmentId/visit-note", async (c) => {
  const ctx = requireRole(c, "doctor");
  const appointmentId = c.req.param("appointmentId");
  type VisitNoteInput = {
    subjective?: string;
    objective?: string;
    assessment?: string;
    plan?: string;
  };
  const input = await c.req.json<VisitNoteInput>().catch((): VisitNoteInput => ({}));

  const { data: appt } = await ctx.db
    .from("appointments")
    .select("id, clinic_id, patient_id")
    .eq("id", appointmentId)
    .eq("clinic_id", ctx.clinicId)
    .maybeSingle();
  if (!appt) throw notFound("Visit not found.");

  const { data, error } = await ctx.db
    .from("visit_notes")
    .upsert(
      {
        clinic_id: appt.clinic_id,
        appointment_id: appt.id,
        patient_id: appt.patient_id,
        author_id: ctx.userId,
        subjective: input.subjective?.trim() || null,
        objective: input.objective?.trim() || null,
        assessment: input.assessment?.trim() || null,
        plan: input.plan?.trim() || null,
      },
      { onConflict: "appointment_id" }
    )
    .select("updated_at")
    .single();

  if (error) {
    // The consent hard-block surfaces as an RLS/CHECK violation.
    const denied = /row-level security|violates/i.test(error.message);
    throw denied
      ? forbidden("Records-storage consent is required before writing clinical notes.")
      : serverError(error.message);
  }

  // App-level record touch (SECURITY DEFINER fn) — reception has read-only
  // on the clinical summary, so a direct UPDATE would fail RLS.
  await ctx.db.rpc("touch_patient_record", { p_patient_id: appt.patient_id });

  return c.json({ ok: true, updatedAt: data.updated_at });
});

// ── GET /documents/:documentId/signed-url ────────────────────
adminRoutes.get("/documents/:documentId/signed-url", async (c) => {
  const ctx = staff(c);
  const documentId = c.req.param("documentId");

  // RLS scopes this read to the caller's clinic.
  const { data: doc } = await ctx.db
    .from("patient_documents")
    .select("id, patient_id, clinic_id, storage_path")
    .eq("id", documentId)
    .single();
  if (!doc) throw notFound("Document not found.");

  await logRecordAccess(ctx.db, {
    clinicId: doc.clinic_id,
    patientId: doc.patient_id,
    actorUserId: ctx.userId,
    action: "document_view",
    context: "patient_file",
  });

  // Staff are deliberately NOT granted a direct SELECT on storage; sign
  // with the service role after the read + audit above.
  const { data: signed, error } = await serviceClient()
    .storage.from("patient-documents")
    .createSignedUrl(doc.storage_path, SIGNED_URL_TTL_SECONDS);
  if (error || !signed) throw serverError(error?.message ?? "Could not sign document URL.");

  return c.json({ url: signed.signedUrl });
});

// ── GET /patients/:patientId/export ──────────────────────────
adminRoutes.get("/patients/:patientId/export", async (c) => {
  const ctx = requireRole(c, "admin");
  const patientId = c.req.param("patientId");
  const db = ctx.db;

  const { data: patientRow } = await db
    .from("patients")
    .select("*")
    .eq("id", patientId)
    .eq("clinic_id", ctx.clinicId)
    .maybeSingle();
  if (!patientRow) throw notFound("Patient not found.");
  const patient = patientRow as Patient;

  const [appts, consents] = await Promise.all([
    db.from("appointments").select("*").eq("patient_id", patientId).order("appointment_date", { ascending: false }),
    db.from("patient_consent").select("*").eq("patient_id", patientId).order("granted_at", { ascending: false }),
  ]);

  const apptIds = (appts.data ?? []).map((a) => a.id as string);
  const [intake, events, feedback, notes, documents] = await Promise.all([
    db.from("intake_responses").select("*").in("appointment_id", apptIds),
    db.from("appointment_events").select("*").in("appointment_id", apptIds),
    db.from("visit_feedback").select("*").in("appointment_id", apptIds),
    db.from("visit_notes").select("*").in("appointment_id", apptIds),
    db.from("patient_documents").select("*").eq("patient_id", patientId).order("created_at", { ascending: false }),
  ]);

  // Sign document URLs with the service role (no direct staff SELECT on storage).
  const service = serviceClient();
  const docs: Record<string, unknown>[] = [];
  for (const d of documents.data ?? []) {
    const { data: signed } = await service.storage
      .from("patient-documents")
      .createSignedUrl(d.storage_path as string, EXPORT_URL_TTL_SECONDS);
    docs.push({ ...d, download_url: signed?.signedUrl ?? null });
  }

  const groupBy = <T extends { appointment_id: string }>(rows: T[] | null) => {
    const m = new Map<string, T[]>();
    for (const r of rows ?? []) m.set(r.appointment_id, [...(m.get(r.appointment_id) ?? []), r]);
    return m;
  };
  const intakeBy = groupBy(intake.data as { appointment_id: string }[] | null);
  const eventsBy = groupBy(events.data as { appointment_id: string }[] | null);
  const fbBy = new Map((feedback.data ?? []).map((f) => [f.appointment_id as string, f]));
  const noteBy = new Map((notes.data ?? []).map((n) => [n.appointment_id as string, n]));

  const visits = (appts.data ?? []).map((a) => ({
    appointment: a,
    intake_responses: intakeBy.get(a.id as string) ?? [],
    appointment_events: eventsBy.get(a.id as string) ?? [],
    visit_feedback: fbBy.get(a.id as string) ?? null,
    visit_note: noteBy.get(a.id as string) ?? null,
  }));

  await logRecordAccess(db, {
    clinicId: ctx.clinicId,
    patientId,
    actorUserId: ctx.userId,
    action: "export",
    context: "patient_file",
  });

  return c.json({
    record: {
      exported_at: new Date().toISOString(),
      exported_by: ctx.userId,
      patient,
      consent: consents.data ?? [],
      visits,
      documents: docs,
    },
  });
});

// ── DELETE /patients/:patientId ──────────────────────────────
adminRoutes.delete("/patients/:patientId", async (c) => {
  const ctx = requireRole(c, "admin");
  const patientId = c.req.param("patientId");
  const { confirmName, reason } = await c.req
    .json<{ confirmName?: string; reason?: string }>()
    .catch(() => ({ confirmName: undefined, reason: undefined }));

  const { data: patient } = await ctx.db
    .from("patients")
    .select("id, name, dob, record_updated_at")
    .eq("id", patientId)
    .eq("clinic_id", ctx.clinicId)
    .maybeSingle();
  if (!patient) throw notFound("Patient not found.");

  if ((confirmName ?? "").trim() !== (patient.name ?? "").trim()) {
    throw badRequest("The name you typed doesn't match this patient.");
  }
  if (!reason?.trim()) throw badRequest("A reason is required to delete a record.");

  // Last activity = latest of (last appointment, latest note, record touch).
  const [lastAppt, lastNote] = await Promise.all([
    ctx.db
      .from("appointments")
      .select("appointment_date, completed_at")
      .eq("patient_id", patientId)
      .order("appointment_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    ctx.db
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
    throw forbidden(
      `Cannot delete: this record must be retained until ${
        retention.retainUntil ?? "an undetermined date"
      }. ${retention.reason}`
    );
  }

  const service = serviceClient();
  // Capture storage paths before the cascade removes the document rows.
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
    reason: reason.trim(),
    last_activity: lastActivity,
    retain_until: retention.retainUntil,
  });

  const { error: delErr } = await service
    .from("patients")
    .delete()
    .eq("id", patientId)
    .eq("clinic_id", ctx.clinicId);
  if (delErr) throw serverError(delErr.message);

  const paths = (docs ?? []).map((d) => d.storage_path as string);
  if (paths.length) await service.storage.from("patient-documents").remove(paths);

  return c.json({ ok: true });
});

// ── POST /walk-in ─────────────────────────────────────────────
// Staff add a walk-in. Resolves the global identity (Seam 1) — `people` is
// service-role only — then find-or-creates the per-practice patient and
// today's appointment. Clinic comes from the caller's JWT, not the body.
adminRoutes.post("/walk-in", async (c) => {
  const ctx = staff(c);
  type WalkInBody = {
    firstName?: string;
    lastName?: string;
    nationality?: string;
    idType?: IdType;
    idNumber?: string;
    phone?: string;
    phoneIsWhatsapp?: boolean;
    whatsappNumber?: string;
    email?: string;
    dob?: string;
  };
  const body = await c.req.json<WalkInBody>().catch((): WalkInBody => ({}));

  const firstName = body.firstName?.trim();
  const lastName = body.lastName?.trim() ?? "";
  const phone = body.phone?.replace(/[^\d+]/g, "");
  if (!firstName || !phone) throw badRequest("First name and phone are required.");
  if (!body.idType || !body.idNumber?.trim()) throw badRequest("ID type and number are required.");

  const identity = validatePatientIdentity({
    idType: body.idType,
    idNumber: body.idNumber,
    nationality: body.nationality ?? "",
  });
  if (!identity.valid) throw badRequest(identity.errors[0] ?? "Invalid ID details.");
  const effectiveDob = body.idType === "rsa_id" ? identity.derivedDob : body.dob?.trim() || null;

  const service = serviceClient();

  const personId = await resolveOrCreatePerson(service, {
    firstName,
    lastName,
    phone,
    phoneIsWhatsapp: body.phoneIsWhatsapp,
    whatsappNumber: body.whatsappNumber,
    idType: body.idType,
    idNumber: body.idNumber,
    nationality: body.nationality?.trim() || null,
    dob: effectiveDob,
    email: body.email?.trim() || null,
  });

  const patientFields = {
    person_id: personId,
    name: `${firstName} ${lastName}`.trim(),
    phone,
    email: body.email?.trim() || null,
    dob: effectiveDob,
    nationality: body.nationality?.trim() || null,
    id_type: body.idType,
    id_number: body.idNumber.trim(),
  };

  let patientId: string;
  const { data: existing } = await service
    .from("patients")
    .select("id")
    .eq("clinic_id", ctx.clinicId)
    .eq("person_id", personId)
    .maybeSingle();
  if (existing) {
    patientId = existing.id as string;
    await service.from("patients").update(patientFields).eq("id", patientId);
  } else {
    const { data: created, error } = await service
      .from("patients")
      .insert({ clinic_id: ctx.clinicId, ...patientFields })
      .select("id")
      .single();
    if (error || !created) throw serverError(error?.message ?? "Failed to create patient.");
    patientId = created.id as string;
  }

  const today = new Date().toISOString().split("T")[0];
  const { data: activeAppt } = await service
    .from("appointments")
    .select("id")
    .eq("clinic_id", ctx.clinicId)
    .eq("patient_id", patientId)
    .eq("appointment_date", today)
    .in("status", ["waiting", "in_consultation"])
    .maybeSingle();
  if (activeAppt) throw badRequest("This patient is already active in today's queue.");

  const { data: appt, error: apptError } = await service
    .from("appointments")
    .insert({ clinic_id: ctx.clinicId, patient_id: patientId, status: "waiting", appointment_date: today })
    .select("id, entered_queue_at")
    .single();
  if (apptError || !appt) throw serverError(apptError?.message ?? "Failed to create appointment.");

  await service.from("appointment_events").insert({
    clinic_id: ctx.clinicId,
    appointment_id: appt.id,
    actor_type: "staff",
    actor_user_id: ctx.userId,
    event_type: "queue_joined",
    to_status: "waiting",
  });

  const { count } = await service
    .from("appointments")
    .select("*", { count: "exact", head: true })
    .eq("clinic_id", ctx.clinicId)
    .eq("appointment_date", today)
    .eq("status", "waiting")
    .lt("entered_queue_at", appt.entered_queue_at as string);

  return c.json({ ok: true, position: (count ?? 0) + 1 });
});

// ── POST /appointments/:appointmentId/transition ──────────────
// The single write path for a Visit status change: validate against the
// legacy transition table (Seam 2 projection), update via the RLS-scoped
// client (the DB trigger sets the timestamps), audit, then dispatch the
// resulting notification (Seam 3).
adminRoutes.post("/appointments/:appointmentId/transition", async (c) => {
  const ctx = staff(c);
  const appointmentId = c.req.param("appointmentId");
  const { to_status } = await c.req
    .json<{ to_status?: AppointmentStatus }>()
    .catch(() => ({ to_status: undefined }));

  if (!to_status) throw badRequest("A target status is required.");

  const { data: appt } = await ctx.db
    .from("appointments")
    .select("id, status, patient_id, clinic_id")
    .eq("id", appointmentId)
    .eq("clinic_id", ctx.clinicId)
    .maybeSingle();
  if (!appt) throw notFound("Appointment not found.");

  const from = appt.status as AppointmentStatus;
  if (!LEGACY_TRANSITIONS[from].includes(to_status)) {
    throw badRequest(`Cannot move a visit from "${from}" to "${to_status}".`);
  }

  const { error: updateError } = await ctx.db
    .from("appointments")
    .update({ status: to_status })
    .eq("id", appointmentId);
  if (updateError) throw serverError(updateError.message);

  await ctx.db.from("appointment_events").insert({
    clinic_id: ctx.clinicId,
    appointment_id: appointmentId,
    actor_type: "staff",
    actor_user_id: ctx.userId,
    event_type: "status_change",
    from_status: from,
    to_status,
  });

  // Notify (Seam 3), best-effort. "done" maps to the consult-ended feedback
  // prompt rather than the silent "completed".
  const notifStatus: VisitStatus =
    to_status === "done" ? "consult_ended" : appointmentToVisitStatus(to_status);
  const { data: patient } = await serviceClient()
    .from("patients")
    .select("phone, clinics(name)")
    .eq("id", appt.patient_id)
    .maybeSingle<{ phone: string | null; clinics: { name: string } | null }>();
  if (patient?.phone && patient.clinics?.name) {
    const notification = notificationForStatus(notifStatus, { clinicName: patient.clinics.name });
    if (notification) {
      try {
        await dispatchNotification(serviceClient(), {
          appointmentId,
          clinicId: ctx.clinicId,
          to: patient.phone,
          notification,
        });
      } catch (err) {
        console.error("[api] transition notification failed:", err);
      }
    }
  }

  return c.json({ ok: true, status: to_status });
});
