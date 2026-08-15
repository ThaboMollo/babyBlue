"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { resolveOrCreatePerson } from "@/lib/people";
import { validatePatientIdentity } from "@/lib/identity";
import type { IdType } from "@/types";

export interface WalkInInput {
  firstName: string;
  lastName: string;
  nationality: string;
  idType: IdType;
  idNumber: string;
  phone: string;
  phoneIsWhatsapp: boolean;
  whatsappNumber?: string;
  email?: string;
  dob?: string;
}

export type WalkInResult = { ok: true; position: number } | { error: string };

/**
 * Add a walk-in. Runs server-side with the service role because Seam 1's
 * global `people` identity has no client RLS policies — the browser cannot
 * create a person. We re-verify the caller is staff of their clinic first,
 * then: resolve-or-create the person → find-or-create the per-practice
 * patient (clinic, person) → guard + create today's appointment → audit.
 */
export async function createWalkIn(input: WalkInInput): Promise<WalkInResult> {
  // 1. Auth: who is calling, and for which clinic?
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();
  if (!profile) return { error: "No clinic profile." };
  const clinicId = profile.clinic_id as string;

  // 2. Server-authoritative identity validation.
  const firstName = input.firstName?.trim();
  const lastName = input.lastName?.trim() ?? "";
  const phone = input.phone?.replace(/[^\d+]/g, "");
  if (!firstName || !phone) return { error: "First name and phone are required." };

  const identity = validatePatientIdentity({
    idType: input.idType,
    idNumber: input.idNumber,
    nationality: input.nationality,
  });
  if (!identity.valid) return { error: identity.errors[0] ?? "Invalid ID details." };
  const derivedDob = identity.derivedDob;
  const effectiveDob = input.idType === "rsa_id" ? derivedDob : input.dob?.trim() || null;

  const service = createServiceClient();

  // 3. Global identity (Seam 1).
  let personId: string;
  try {
    personId = await resolveOrCreatePerson(service, {
      firstName,
      lastName,
      phone,
      phoneIsWhatsapp: input.phoneIsWhatsapp,
      whatsappNumber: input.whatsappNumber,
      idType: input.idType,
      idNumber: input.idNumber,
      nationality: input.nationality?.trim() || null,
      dob: effectiveDob,
      email: input.email?.trim() || null,
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to resolve identity." };
  }

  // 4. Per-practice patient for (clinic, person).
  const patientFields = {
    person_id: personId,
    name: `${firstName} ${lastName}`.trim(),
    phone,
    email: input.email?.trim() || null,
    dob: effectiveDob,
    nationality: input.nationality?.trim() || null,
    id_type: input.idType,
    id_number: input.idNumber.trim(),
  };

  let patientId: string;
  const { data: existing } = await service
    .from("patients")
    .select("id")
    .eq("clinic_id", clinicId)
    .eq("person_id", personId)
    .maybeSingle();

  if (existing) {
    patientId = existing.id as string;
    await service.from("patients").update(patientFields).eq("id", patientId);
  } else {
    const { data: created, error } = await service
      .from("patients")
      .insert({ clinic_id: clinicId, ...patientFields })
      .select("id")
      .single();
    if (error || !created) return { error: error?.message ?? "Failed to create patient." };
    patientId = created.id as string;
  }

  const today = new Date().toISOString().split("T")[0];

  // 5. Guard a duplicate active appointment today.
  const { data: activeAppt } = await service
    .from("appointments")
    .select("id")
    .eq("clinic_id", clinicId)
    .eq("patient_id", patientId)
    .eq("appointment_date", today)
    .in("status", ["waiting", "in_consultation"])
    .maybeSingle();
  if (activeAppt) return { error: "This patient is already active in today's queue." };

  // 6. Create the appointment + audit event.
  const { data: appt, error: apptError } = await service
    .from("appointments")
    .insert({
      clinic_id: clinicId,
      patient_id: patientId,
      status: "waiting",
      appointment_date: today,
    })
    .select("id, entered_queue_at")
    .single();
  if (apptError || !appt) return { error: apptError?.message ?? "Failed to create appointment." };

  await service.from("appointment_events").insert({
    clinic_id: clinicId,
    appointment_id: appt.id,
    actor_type: "staff",
    actor_user_id: user.id,
    event_type: "queue_joined",
    from_status: null,
    to_status: "waiting",
  });

  // 7. Position = waiting entries ahead of this one.
  const { count } = await service
    .from("appointments")
    .select("*", { count: "exact", head: true })
    .eq("clinic_id", clinicId)
    .eq("appointment_date", today)
    .eq("status", "waiting")
    .lt("entered_queue_at", appt.entered_queue_at as string);

  return { ok: true, position: (count ?? 0) + 1 };
}
