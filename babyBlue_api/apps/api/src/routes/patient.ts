// Patient-tier (public) endpoints — the port of the five Supabase edge
// functions the patient app calls. No user session: authority comes from
// the appointment's `access_token` capability, exactly as before. Runs on
// the service-role client (RLS-bypassing) like the edge functions did.
//
// Identity validation now comes from @babyblue/core instead of the copy
// that used to be inlined here.

import { Hono } from "hono";
import {
  validatePatientIdentity,
  normaliseIdNumber,
  notificationForStatus,
  type IdType,
  type AppointmentView,
  type JoinQueueResponse,
  type ResolvedQuestion,
} from "@babyblue/core";
import { serviceClient } from "../supabase.js";
import { resolveOrCreatePerson, splitName } from "../lib/people.js";
import { dispatchNotification } from "../lib/notifications/dispatch.js";
import { badRequest, conflict, forbidden, notFound, readJson, serverError, tooMany } from "../http.js";
import type { AppEnv } from "../types.js";

export const patientRoutes = new Hono<AppEnv>();

// Tokens are valid on the appointment day and the following day (§6.2)
const TOKEN_MAX_AGE_MS = 2 * 24 * 60 * 60 * 1000;

/** Verify an appointment id + access token, returning the row or throwing. */
async function authorizeAppointment(
  appointmentId: string,
  accessToken: string,
  columns: string
) {
  const db = serviceClient();
  const { data: appt, error } = await db
    .from("appointments")
    .select(columns)
    .eq("id", appointmentId)
    .single<Record<string, unknown>>();
  if (error || !appt) throw notFound("Appointment not found");
  if (appt.access_token !== accessToken) throw forbidden();
  return appt;
}

// ── POST /join-queue ─────────────────────────────────────────
patientRoutes.post("/join-queue", async (c) => {
  const db = serviceClient();
  const body = await readJson<{
    clinic_slug?: string;
    name?: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
    phone_is_whatsapp?: boolean;
    whatsapp_number?: string;
    nationality?: string;
    id_type?: string;
    id_number?: string;
    consent_records_storage?: boolean;
  }>(c);

  const clinicSlug = body.clinic_slug;
  // Prefer explicit first/last name; fall back to splitting a single `name`.
  const firstName = (body.first_name ?? "").trim();
  const lastName = (body.last_name ?? "").trim();
  const split = splitName(body.name ?? "");
  const resolvedFirst = firstName || split.firstName;
  const resolvedLast = lastName || split.lastName;
  const name = `${resolvedFirst} ${resolvedLast}`.trim();
  // Normalize so "082 123 4567" and "0821234567" match the same patient.
  const phone = body.phone?.replace(/[^\d+]/g, "");
  const nationality = (body.nationality ?? "").trim();
  const idType = body.id_type as IdType | undefined;
  const rawIdNumber = (body.id_number ?? "").trim();

  if (!clinicSlug || !resolvedFirst || !phone) {
    throw badRequest("clinic_slug, name, and phone are required");
  }
  if (!idType || !["rsa_id", "passport", "asylum"].includes(idType) || !rawIdNumber) {
    throw badRequest("A valid ID type and number are required");
  }

  const identity = validatePatientIdentity({ idType, idNumber: rawIdNumber, nationality });
  if (!identity.valid) throw badRequest(identity.errors[0] ?? "Invalid identity details");
  const idNumber = normaliseIdNumber(idType, rawIdNumber);
  const derivedDob = identity.derivedDob;

  // 1. Clinic by slug
  const { data: clinic, error: clinicError } = await db
    .from("clinics")
    .select("id, name, slug")
    .eq("slug", clinicSlug)
    .single();
  if (clinicError || !clinic) throw notFound("Clinic not found");

  // 1b. Per-IP rate limit: 20 joins/hour (§6.1)
  const clientIp =
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: ipJoins } = await db
    .from("appointment_events")
    .select("*", { count: "exact", head: true })
    .eq("event_type", "queue_joined")
    .eq("metadata->>ip", clientIp)
    .gt("created_at", oneHourAgo);
  if ((ipJoins ?? 0) >= 20) throw tooMany();

  // 2. Resolve the GLOBAL identity first (Seam 1), then find-or-create the
  //    per-practice patient record for (this clinic, this person).
  const personId = await resolveOrCreatePerson(db, {
    firstName: resolvedFirst,
    lastName: resolvedLast,
    phone,
    phoneIsWhatsapp: body.phone_is_whatsapp,
    whatsappNumber: body.whatsapp_number,
    idType,
    idNumber,
    nationality,
    dob: derivedDob,
  });

  const identityFields: Record<string, string> = {
    person_id: personId,
    name,
    phone,
    nationality,
    id_type: idType,
    id_number: idNumber,
  };
  if (derivedDob) identityFields.dob = derivedDob; // don't wipe an existing dob with null

  let patientId: string;
  const { data: existing } = await db
    .from("patients")
    .select("id")
    .eq("clinic_id", clinic.id)
    .eq("person_id", personId)
    .maybeSingle();

  if (existing) {
    patientId = existing.id as string;
    await db.from("patients").update(identityFields).eq("id", patientId);
  } else {
    const { data: newPatient, error: createError } = await db
      .from("patients")
      .insert({ clinic_id: clinic.id, ...identityFields })
      .select("id")
      .single();
    if (createError || !newPatient) throw serverError("Failed to create patient");
    patientId = newPatient.id as string;
  }

  // 2b. Optional records-storage consent (method='patient_app').
  if (body.consent_records_storage === true) {
    const { data: activeConsent } = await db
      .from("patient_consent")
      .select("id")
      .eq("patient_id", patientId)
      .eq("consent_type", "records_storage")
      .eq("granted", true)
      .is("revoked_at", null)
      .maybeSingle();
    if (!activeConsent) {
      await db.from("patient_consent").insert({
        clinic_id: clinic.id,
        patient_id: patientId,
        consent_type: "records_storage",
        granted: true,
        method: "patient_app",
      });
    }
  }

  const today = new Date().toISOString().split("T")[0];

  // 3. Reconnect to an active appointment today, else create one.
  const { data: activeAppointment } = await db
    .from("appointments")
    .select("id, access_token, status, entered_queue_at")
    .eq("clinic_id", clinic.id)
    .eq("patient_id", patientId)
    .eq("appointment_date", today)
    .in("status", ["waiting", "in_consultation"])
    .order("entered_queue_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let appointmentId: string;
  let accessToken: string;
  let isReconnect: boolean;
  let enteredQueueAt: string;

  if (activeAppointment) {
    appointmentId = activeAppointment.id as string;
    accessToken = activeAppointment.access_token as string;
    enteredQueueAt = activeAppointment.entered_queue_at as string;
    isReconnect = true;
  } else {
    // Per-phone rate limit: 3 new appointments/hour (§6.1).
    const { count: recentJoins } = await db
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("patient_id", patientId)
      .gt("created_at", oneHourAgo);
    if ((recentJoins ?? 0) >= 3) {
      throw tooMany("Too many attempts with this phone number. Please try again later.");
    }

    const { data: newAppointment, error: apptError } = await db
      .from("appointments")
      .insert({
        clinic_id: clinic.id,
        patient_id: patientId,
        status: "waiting",
        appointment_date: today,
        entered_queue_at: new Date().toISOString(),
      })
      .select("id, access_token, entered_queue_at")
      .single();
    if (apptError || !newAppointment) throw serverError("Failed to create appointment");

    appointmentId = newAppointment.id as string;
    accessToken = newAppointment.access_token as string;
    enteredQueueAt = newAppointment.entered_queue_at as string;
    isReconnect = false;

    await db.from("appointment_events").insert({
      clinic_id: clinic.id,
      appointment_id: appointmentId,
      actor_type: "patient",
      event_type: "queue_joined",
      to_status: "waiting",
      metadata: { ip: clientIp },
    });
  }

  // 4. Queue position.
  const { count } = await db
    .from("appointments")
    .select("*", { count: "exact", head: true })
    .eq("clinic_id", clinic.id)
    .eq("appointment_date", today)
    .eq("status", "waiting")
    .lt("entered_queue_at", enteredQueueAt);

  const position = (count ?? 0) + 1;

  // 5. Fire the "joined" notification once, on a fresh join (not a reconnect).
  //    Idempotency + delivery are the dispatcher's job; a failure here must
  //    never break the join, so it's best-effort.
  if (!isReconnect) {
    const notification = notificationForStatus("queued", {
      clinicName: clinic.name,
      position,
    });
    if (notification) {
      try {
        await dispatchNotification(db, {
          appointmentId,
          clinicId: clinic.id,
          to: phone,
          notification,
        });
      } catch (err) {
        console.error("[api] notification dispatch failed:", err);
      }
    }
  }

  const response: JoinQueueResponse = {
    appointment_id: appointmentId,
    access_token: accessToken,
    clinic_name: clinic.name,
    position,
    is_reconnect: isReconnect,
  };
  return c.json(response);
});

// ── POST /get-appointment ────────────────────────────────────
patientRoutes.post("/get-appointment", async (c) => {
  const db = serviceClient();
  const { appointment_id, access_token } = await readJson<{
    appointment_id?: string;
    access_token?: string;
  }>(c);
  if (!appointment_id || !access_token) {
    throw badRequest("appointment_id and access_token are required");
  }

  const { data: appointment, error } = await db
    .from("appointments")
    .select(
      `id, clinic_id, status, appointment_date, entered_queue_at,
       consultation_started_at, completed_at, access_token,
       clinics ( name, address, avg_consultation_minutes )`
    )
    .eq("id", appointment_id)
    .single<{
      id: string;
      clinic_id: string;
      status: AppointmentView["appointment"]["status"];
      appointment_date: string;
      entered_queue_at: string;
      consultation_started_at: string | null;
      completed_at: string | null;
      access_token: string;
      clinics: { name: string; address: string | null; avg_consultation_minutes: number };
    }>();
  if (error || !appointment) throw notFound("Appointment not found");
  if (appointment.access_token !== access_token) throw forbidden();

  // Expire tokens after the day following the appointment (§6.2).
  const apptDateMs = new Date(`${appointment.appointment_date}T00:00:00Z`).getTime();
  if (Date.now() - apptDateMs > TOKEN_MAX_AGE_MS) throw forbidden("Session expired");

  const clinic = appointment.clinics;

  // Queue position (only meaningful while waiting).
  let position = 0;
  if (appointment.status === "waiting") {
    const { count } = await db
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("clinic_id", appointment.clinic_id)
      .eq("appointment_date", appointment.appointment_date)
      .eq("status", "waiting")
      .lt("entered_queue_at", appointment.entered_queue_at);
    position = (count ?? 0) + 1;
  }

  // Wait estimate from today's actual throughput (§3.2).
  let intervalMinutes = clinic.avg_consultation_minutes;
  if (position > 1) {
    const { data: recentStarts } = await db
      .from("appointments")
      .select("consultation_started_at")
      .eq("clinic_id", appointment.clinic_id)
      .eq("appointment_date", appointment.appointment_date)
      .not("consultation_started_at", "is", null)
      .order("consultation_started_at", { ascending: false })
      .limit(6);

    const starts = (recentStarts ?? [])
      .map((r) => new Date(r.consultation_started_at as string).getTime())
      .sort((a, b) => a - b);

    const intervals: number[] = [];
    for (let i = 1; i < starts.length; i++) {
      const mins = (starts[i]! - starts[i - 1]!) / 60000;
      if (mins > 0 && mins <= 120) intervals.push(mins);
    }
    if (intervals.length >= 3) {
      intervalMinutes = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    }
  }

  const rawWait = position > 1 ? intervalMinutes * (position - 1) : 0;
  const roundTo5 = (n: number) => Math.max(5, Math.round(n / 5) * 5);
  const estimatedWaitRange =
    rawWait > 0 ? { min: roundTo5(rawWait * 0.8), max: roundTo5(rawWait * 1.4) } : null;

  // Intake / feedback status.
  const { count: intakeCount } = await db
    .from("intake_responses")
    .select("*", { count: "exact", head: true })
    .eq("appointment_id", appointment_id);
  const intakeSubmitted = (intakeCount ?? 0) > 0;

  let feedbackSubmitted = false;
  if (appointment.status === "done") {
    const { count: feedbackCount } = await db
      .from("visit_feedback")
      .select("*", { count: "exact", head: true })
      .eq("appointment_id", appointment_id);
    feedbackSubmitted = (feedbackCount ?? 0) > 0;
  }

  // Active intake questions, resolved against templates.
  const { data: clinicQuestions } = await db
    .from("clinic_intake_questions")
    .select(
      `id, inherit_global, question_text, question_type, options, sort_order, template_id,
       intake_question_templates ( question_key, question_text, question_type, options )`
    )
    .eq("clinic_id", appointment.clinic_id)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  type QuestionRow = {
    id: string;
    inherit_global: boolean;
    question_text: string | null;
    question_type: ResolvedQuestion["question_type"] | null;
    options: string[] | null;
    sort_order: number;
    template_id: string | null;
    intake_question_templates: {
      question_key: string;
      question_text: string;
      question_type: ResolvedQuestion["question_type"];
      options: string[] | null;
    } | null;
  };

  // The client isn't typed with a Database generic, so the embedded relation
  // is inferred as an array; cast through unknown (it is a to-one join).
  const questions: ResolvedQuestion[] = ((clinicQuestions as unknown as QuestionRow[]) ?? []).map((q) => {
    const tmpl = q.intake_question_templates;
    return {
      id: q.id,
      question_key: tmpl?.question_key ?? q.id,
      question_text: q.inherit_global && tmpl ? tmpl.question_text : q.question_text ?? "",
      question_type: q.inherit_global && tmpl ? tmpl.question_type : q.question_type ?? "text",
      options: q.inherit_global && tmpl ? tmpl.options : q.options,
      sort_order: q.sort_order,
    };
  });

  const view: AppointmentView = {
    appointment: {
      id: appointment.id,
      status: appointment.status,
      entered_queue_at: appointment.entered_queue_at,
      consultation_started_at: appointment.consultation_started_at,
      completed_at: appointment.completed_at,
    },
    position,
    estimated_wait_minutes: Math.round(rawWait),
    estimated_wait_range: estimatedWaitRange,
    clinic: { name: clinic.name, address: clinic.address },
    intake_submitted: intakeSubmitted,
    feedback_submitted: feedbackSubmitted,
    questions,
  };
  return c.json(view);
});

// ── POST /cancel-appointment ─────────────────────────────────
patientRoutes.post("/cancel-appointment", async (c) => {
  const db = serviceClient();
  const { appointment_id, access_token } = await readJson<{
    appointment_id?: string;
    access_token?: string;
  }>(c);
  if (!appointment_id || !access_token) {
    throw badRequest("appointment_id and access_token are required");
  }

  const appt = await authorizeAppointment(
    appointment_id,
    access_token,
    "id, clinic_id, access_token, status"
  );

  // Patients may only leave while still waiting.
  if (appt.status !== "waiting") throw conflict("Only a waiting appointment can be cancelled");

  const { error: updateError } = await db
    .from("appointments")
    .update({ status: "cancelled" })
    .eq("id", appointment_id)
    .eq("status", "waiting");
  if (updateError) throw serverError("Failed to cancel appointment");

  await db.from("appointment_events").insert({
    clinic_id: appt.clinic_id,
    appointment_id,
    actor_type: "patient",
    event_type: "queue_left",
    from_status: "waiting",
    to_status: "cancelled",
  });

  return c.json({ success: true });
});

// ── POST /submit-feedback ────────────────────────────────────
patientRoutes.post("/submit-feedback", async (c) => {
  const db = serviceClient();
  const { appointment_id, access_token, rating, comment } = await readJson<{
    appointment_id?: string;
    access_token?: string;
    rating?: number;
    comment?: string;
  }>(c);

  if (!appointment_id || !access_token || typeof rating !== "number") {
    throw badRequest("appointment_id, access_token, and rating are required");
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw badRequest("rating must be an integer from 1 to 5");
  }

  const appt = await authorizeAppointment(
    appointment_id,
    access_token,
    "id, clinic_id, access_token, status"
  );
  if (appt.status !== "done") {
    throw conflict("Feedback can only be submitted after the visit is complete");
  }

  const { error: insertError } = await db.from("visit_feedback").insert({
    appointment_id,
    clinic_id: appt.clinic_id,
    rating,
    comment: comment?.trim() ? comment.trim().slice(0, 1000) : null,
  });
  if (insertError) {
    if (insertError.code === "23505") throw conflict("Feedback already submitted for this visit");
    throw serverError("Failed to save feedback");
  }

  await db.from("appointment_events").insert({
    clinic_id: appt.clinic_id,
    appointment_id,
    actor_type: "patient",
    event_type: "feedback_submitted",
    metadata: { rating },
  });

  return c.json({ success: true });
});

// ── POST /submit-intake ──────────────────────────────────────
patientRoutes.post("/submit-intake", async (c) => {
  const db = serviceClient();
  const { appointment_id, access_token, answers } = await readJson<{
    appointment_id?: string;
    access_token?: string;
    answers?: {
      question_id: string;
      question_key: string;
      question_text: string;
      answer: string;
    }[];
  }>(c);

  if (!appointment_id || !access_token || !answers?.length) {
    throw badRequest("appointment_id, access_token, and answers are required");
  }

  const appt = await authorizeAppointment(
    appointment_id,
    access_token,
    "id, clinic_id, access_token, status, appointment_date"
  );

  const apptDateMs = new Date(`${appt.appointment_date}T00:00:00Z`).getTime();
  if (Date.now() - apptDateMs > TOKEN_MAX_AGE_MS) throw forbidden("Session expired");

  if (!["waiting", "in_consultation"].includes(appt.status as string)) {
    throw conflict("Intake can only be submitted for active appointments");
  }

  const { count } = await db
    .from("intake_responses")
    .select("*", { count: "exact", head: true })
    .eq("appointment_id", appointment_id);
  if ((count ?? 0) > 0) throw conflict("Intake already submitted for this appointment");

  const rows = answers.map((a) => ({
    appointment_id,
    clinic_id: appt.clinic_id,
    question_id: a.question_id || null,
    question_key: a.question_key,
    question_text: a.question_text,
    answer: String(a.answer),
  }));

  const { error: insertError } = await db.from("intake_responses").insert(rows);
  if (insertError) throw serverError("Failed to save intake responses");

  await db.from("appointment_events").insert({
    clinic_id: appt.clinic_id,
    appointment_id,
    actor_type: "patient",
    event_type: "intake_submitted",
  });

  return c.json({ success: true });
});
