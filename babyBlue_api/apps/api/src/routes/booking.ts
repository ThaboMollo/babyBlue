// Booking-tier (public) endpoints — the demand-side front door (Phase 4).
// No user session: like the patient tier, authority for a created Visit is its
// access_token. Runs on the service-role client (people is service-role only).
//
//   GET  /availability  — open slots for a live-mode practice on a date
//   POST /book          — create a Visit from a booking (live or request)
//   POST /promote       — flip confirmed bookings into the queue at T−2h
//                         (invoked by pg_cron / a scheduled function)

import { Hono } from "hono";
import {
  candidateSlots,
  notificationForStatus,
  type AvailabilityRule,
} from "@babyblue/core";
import { serviceClient } from "../supabase.js";
import { resolveOrCreatePerson } from "../lib/people.js";
import { dispatchNotification } from "../lib/notifications/dispatch.js";
import { badRequest, conflict, notFound, readJson, serverError } from "../http.js";
import type { AppEnv } from "../types.js";

export const bookingRoutes = new Hono<AppEnv>();

/** Confirmed, non-cancelled bookings occupying each slot_start for a clinic+date. */
async function bookedCountsBySlot(
  db: ReturnType<typeof serviceClient>,
  clinicId: string,
  dateISO: string
): Promise<Map<string, number>> {
  const { data } = await db
    .from("appointments")
    .select("slot_start")
    .eq("clinic_id", clinicId)
    .not("slot_start", "is", null)
    .not("confirmed_at", "is", null)
    .neq("status", "cancelled")
    .gte("slot_start", `${dateISO}T00:00:00+02:00`)
    .lte("slot_start", `${dateISO}T23:59:59+02:00`);
  const m = new Map<string, number>();
  for (const r of data ?? []) {
    const key = new Date(r.slot_start as string).toISOString();
    m.set(key, (m.get(key) ?? 0) + 1);
  }
  return m;
}

// ── GET /availability?clinic=<slug>&date=YYYY-MM-DD ──────────
bookingRoutes.get("/availability", async (c) => {
  const db = serviceClient();
  const slug = c.req.query("clinic");
  const date = c.req.query("date");
  if (!slug || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw badRequest("clinic (slug) and date (YYYY-MM-DD) are required.");
  }

  const { data: clinic } = await db
    .from("clinics")
    .select("id, booking_mode")
    .eq("slug", slug)
    .maybeSingle();
  if (!clinic) throw notFound("Clinic not found.");
  if (clinic.booking_mode !== "live") {
    return c.json({ mode: clinic.booking_mode, slots: [] });
  }

  const { data: rules } = await db
    .from("clinic_availability")
    .select("weekday, start_time, end_time, slot_minutes, capacity")
    .eq("clinic_id", clinic.id);

  const candidates = candidateSlots((rules ?? []) as AvailabilityRule[], date);
  const booked = await bookedCountsBySlot(db, clinic.id as string, date);
  const now = Date.now();
  const slots = candidates
    .map((s) => {
      const taken = booked.get(new Date(s.start).toISOString()) ?? 0;
      return { start: s.start, remaining: s.capacity - taken };
    })
    .filter((s) => s.remaining > 0 && new Date(s.start).getTime() > now);

  return c.json({ mode: "live", slots });
});

// ── POST /book ───────────────────────────────────────────────
bookingRoutes.post("/book", async (c) => {
  const db = serviceClient();
  const body = await readJson<{
    clinic_slug?: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
    phone_is_whatsapp?: boolean;
    whatsapp_number?: string;
    reason?: string;
    slot_start?: string; // required for live; optional preferred time for request
    practitioner_slug?: string;
  }>(c);

  const firstName = body.first_name?.trim();
  const lastName = body.last_name?.trim() ?? "";
  const phone = body.phone?.replace(/[^\d+]/g, "");
  if (!body.clinic_slug || !firstName || !phone) {
    throw badRequest("clinic_slug, first_name, and phone are required.");
  }

  const { data: clinic } = await db
    .from("clinics")
    .select("id, name, booking_mode")
    .eq("slug", body.clinic_slug)
    .maybeSingle();
  if (!clinic) throw notFound("Clinic not found.");
  const isLive = clinic.booking_mode === "live";

  // Optional practitioner (must belong to this clinic).
  let practitionerId: string | null = null;
  if (body.practitioner_slug) {
    const { data: pr } = await db
      .from("practitioners")
      .select("id")
      .eq("clinic_id", clinic.id)
      .eq("slug", body.practitioner_slug)
      .maybeSingle();
    practitionerId = (pr?.id as string) ?? null;
  }

  // Live bookings need a real, still-open slot; capacity re-checked here.
  if (isLive) {
    if (!body.slot_start) throw badRequest("slot_start is required for live booking.");
    const date = new Date(body.slot_start).toLocaleDateString("en-CA", { timeZone: "Africa/Johannesburg" });
    const { data: rules } = await db
      .from("clinic_availability")
      .select("weekday, start_time, end_time, slot_minutes, capacity")
      .eq("clinic_id", clinic.id);
    const candidate = candidateSlots((rules ?? []) as AvailabilityRule[], date).find(
      (s) => new Date(s.start).getTime() === new Date(body.slot_start!).getTime()
    );
    if (!candidate) throw badRequest("That time is not a bookable slot.");
    const booked = await bookedCountsBySlot(db, clinic.id as string, date);
    const taken = booked.get(new Date(body.slot_start).toISOString()) ?? 0;
    if (taken >= candidate.capacity) throw conflict("That slot is fully booked.");
  }

  // Global identity (Seam 1) — booking needs no national ID, just name + number.
  const personId = await resolveOrCreatePerson(db, {
    firstName,
    lastName,
    phone,
    phoneIsWhatsapp: body.phone_is_whatsapp,
    whatsappNumber: body.whatsapp_number,
  });

  // Per-practice patient for (clinic, person).
  const patientFields = { person_id: personId, name: `${firstName} ${lastName}`.trim(), phone };
  let patientId: string;
  const { data: existing } = await db
    .from("patients")
    .select("id")
    .eq("clinic_id", clinic.id)
    .eq("person_id", personId)
    .maybeSingle();
  if (existing) {
    patientId = existing.id as string;
    await db.from("patients").update(patientFields).eq("id", patientId);
  } else {
    const { data: created, error } = await db
      .from("patients")
      .insert({ clinic_id: clinic.id, ...patientFields })
      .select("id")
      .single();
    if (error || !created) throw serverError("Failed to create patient.");
    patientId = created.id as string;
  }

  // The Visit: a booking is 'scheduled' (unused legacy value) until the promoter
  // queues it. Live auto-confirms; request waits for the practice to accept.
  const { data: appt, error: apptError } = await db
    .from("appointments")
    .insert({
      clinic_id: clinic.id,
      patient_id: patientId,
      status: "scheduled",
      appointment_date: isLive
        ? new Date(body.slot_start!).toLocaleDateString("en-CA", { timeZone: "Africa/Johannesburg" })
        : new Date().toISOString().split("T")[0],
      slot_start: body.slot_start ?? null,
      reason: body.reason?.trim() || null,
      practitioner_id: practitionerId,
      booking_mode: isLive ? "live" : "request",
      confirmed_at: isLive ? new Date().toISOString() : null,
    })
    .select("id, access_token")
    .single();
  if (apptError || !appt) throw serverError(apptError?.message ?? "Failed to create booking.");

  await db.from("appointment_events").insert({
    clinic_id: clinic.id,
    appointment_id: appt.id,
    actor_type: "patient",
    event_type: isLive ? "booking_confirmed" : "booking_requested",
    to_status: "scheduled",
  });

  // Notify: a confirmed (live) booking gets the confirmation message now.
  if (isLive) {
    const notification = notificationForStatus("confirmed", { clinicName: clinic.name as string });
    if (notification) {
      try {
        await dispatchNotification(db, {
          appointmentId: appt.id as string,
          clinicId: clinic.id as string,
          to: phone,
          notification,
        });
      } catch (err) {
        console.error("[api] booking notification failed:", err);
      }
    }
  }

  return c.json({
    appointment_id: appt.id,
    access_token: appt.access_token,
    clinic_name: clinic.name,
    status: isLive ? "confirmed" : "requested",
    slot_start: body.slot_start ?? null,
  });
});

// ── POST /promote ────────────────────────────────────────────
// Flip confirmed bookings whose slot is within the next 2h into the live queue.
// Idempotent: once a row becomes 'waiting' it is no longer scanned.
bookingRoutes.post("/promote", async (c) => {
  const db = serviceClient();
  const horizon = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

  const { data: due } = await db
    .from("appointments")
    .select("id, clinic_id, patient_id, clinics(name), patients(phone)")
    .eq("status", "scheduled")
    .not("confirmed_at", "is", null)
    .not("slot_start", "is", null)
    .lte("slot_start", horizon);

  let promoted = 0;
  for (const row of due ?? []) {
    const { error } = await db
      .from("appointments")
      .update({ status: "waiting", entered_queue_at: new Date().toISOString() })
      .eq("id", row.id)
      .eq("status", "scheduled"); // guard against a concurrent promote
    if (error) continue;
    promoted++;

    await db.from("appointment_events").insert({
      clinic_id: row.clinic_id,
      appointment_id: row.id,
      actor_type: "staff",
      event_type: "promoted_to_queue",
      from_status: "scheduled",
      to_status: "waiting",
    });

    const clinics = row.clinics as unknown as { name: string } | null;
    const patients = row.patients as unknown as { phone: string | null } | null;
    if (clinics?.name && patients?.phone) {
      const notification = notificationForStatus("queued", { clinicName: clinics.name });
      if (notification) {
        try {
          await dispatchNotification(db, {
            appointmentId: row.id as string,
            clinicId: row.clinic_id as string,
            to: patients.phone,
            notification,
          });
        } catch (err) {
          console.error("[api] promote notification failed:", err);
        }
      }
    }
  }

  return c.json({ ok: true, promoted });
});
