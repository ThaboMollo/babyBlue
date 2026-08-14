import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type IdType = "rsa_id" | "passport" | "asylum";

// ── Identity validation (mirrors lib/identity.ts; kept inline because Edge
//    Functions run on Deno and don't share the app's module graph). ──────
function isValidLuhn(digits: string): boolean {
  if (!/^\d+$/.test(digits)) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = digits.charCodeAt(i) - 48;
    if (double) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    double = !double;
  }
  return sum % 10 === 0;
}

/** ISO 'YYYY-MM-DD' from an RSA ID's YYMMDD prefix, or null if invalid. */
function deriveRsaDob(id: string): string | null {
  const yy = Number(id.slice(0, 2));
  const mm = Number(id.slice(2, 4));
  const dd = Number(id.slice(4, 6));
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  const now = new Date();
  const century = yy <= now.getUTCFullYear() % 100 ? 2000 : 1900;
  const year = century + yy;
  const d = new Date(Date.UTC(year, mm - 1, dd));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== mm - 1 || d.getUTCDate() !== dd) {
    return null;
  }
  if (d.getTime() > now.getTime()) return null;
  return `${year}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

/** Returns { ok, dob } or { ok:false, error }. Server is authoritative. */
function validateIdentity(
  idType: IdType,
  idNumber: string,
  nationality: string
): { ok: true; dob: string | null } | { ok: false; error: string } {
  if (idType === "rsa_id") {
    const clean = idNumber.replace(/\s/g, "");
    if (!/^\d{13}$/.test(clean)) {
      return { ok: false, error: "A South African ID number must be 13 digits." };
    }
    if (!isValidLuhn(clean)) {
      return { ok: false, error: "The ID number's checksum is invalid." };
    }
    const dob = deriveRsaDob(clean);
    if (!dob) return { ok: false, error: "The ID number's date of birth is invalid." };
    return { ok: true, dob };
  }
  if (!nationality.trim()) {
    return { ok: false, error: "Nationality is required for a passport or asylum number." };
  }
  const normalized = idNumber.replace(/[\s-]/g, "");
  if (!/^[A-Za-z0-9]{5,20}$/.test(normalized)) {
    return { ok: false, error: "Enter a valid passport or asylum/permit number." };
  }
  return { ok: true, dob: null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  let body: {
    clinic_slug?: string;
    name?: string;
    phone?: string;
    nationality?: string;
    id_type?: string;
    id_number?: string;
    consent_records_storage?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { clinic_slug, name } = body;
  // Normalize so "082 123 4567" and "0821234567" match the same patient
  const phone = body.phone?.replace(/[^\d+]/g, "");
  const nationality = (body.nationality ?? "").trim();
  const idType = body.id_type as IdType | undefined;
  const idNumber = (body.id_number ?? "").trim();

  if (!clinic_slug || !name?.trim() || !phone) {
    return new Response(
      JSON.stringify({ error: "clinic_slug, name, and phone are required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (!idType || !["rsa_id", "passport", "asylum"].includes(idType) || !idNumber) {
    return new Response(
      JSON.stringify({ error: "A valid ID type and number are required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const identity = validateIdentity(idType, idNumber, nationality);
  if (!identity.ok) {
    return new Response(JSON.stringify({ error: identity.error }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const derivedDob = identity.dob;

  // 1. Look up clinic by slug
  const { data: clinic, error: clinicError } = await supabase
    .from("clinics")
    .select("id, name, slug")
    .eq("slug", clinic_slug)
    .single();

  if (clinicError || !clinic) {
    return new Response(JSON.stringify({ error: "Clinic not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 1b. Per-IP rate limit: 20 joins/hour, counted from queue_joined events (§6.1)
  const clientIp =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { count: ipJoins } = await supabase
    .from("appointment_events")
    .select("*", { count: "exact", head: true })
    .eq("event_type", "queue_joined")
    .eq("metadata->>ip", clientIp)
    .gt("created_at", oneHourAgo);

  if ((ipJoins ?? 0) >= 20) {
    return new Response(
      JSON.stringify({ error: "Too many requests. Please try again later." }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // 2. Find-or-create patient — dedupe on ID number first, then phone.
  //    Identity fields are (re)persisted from the authoritative server values.
  const identityFields: Record<string, string> = {
    name: name.trim(),
    phone,
    nationality,
    id_type: idType,
    id_number: idNumber,
  };
  if (derivedDob) identityFields.dob = derivedDob; // don't wipe an existing dob with null

  let patientId: string;
  const { data: byId } = await supabase
    .from("patients")
    .select("id")
    .eq("clinic_id", clinic.id)
    .eq("id_type", idType)
    .eq("id_number", idNumber)
    .maybeSingle();

  let existing = byId;
  if (!existing) {
    const { data: byPhone } = await supabase
      .from("patients")
      .select("id")
      .eq("clinic_id", clinic.id)
      .eq("phone", phone)
      .maybeSingle();
    existing = byPhone;
  }

  if (existing) {
    patientId = existing.id;
    await supabase.from("patients").update(identityFields).eq("id", patientId);
  } else {
    const { data: newPatient, error: createPatientError } = await supabase
      .from("patients")
      .insert({ clinic_id: clinic.id, ...identityFields })
      .select("id")
      .single();

    if (createPatientError || !newPatient) {
      return new Response(JSON.stringify({ error: "Failed to create patient" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    patientId = newPatient.id;
  }

  // 2b. Optional records-storage consent (method='patient_app'). Insert only
  //     if there isn't already an active grant, to avoid duplicate rows.
  if (body.consent_records_storage === true) {
    const { data: activeConsent } = await supabase
      .from("patient_consent")
      .select("id")
      .eq("patient_id", patientId)
      .eq("consent_type", "records_storage")
      .eq("granted", true)
      .is("revoked_at", null)
      .maybeSingle();

    if (!activeConsent) {
      await supabase.from("patient_consent").insert({
        clinic_id: clinic.id,
        patient_id: patientId,
        consent_type: "records_storage",
        granted: true,
        method: "patient_app",
      });
    }
  }

  const today = new Date().toISOString().split("T")[0];

  // 3. Check for an active appointment today (waiting or in_consultation)
  const { data: activeAppointment } = await supabase
    .from("appointments")
    .select("id, access_token, status, entered_queue_at")
    .eq("clinic_id", clinic.id)
    .eq("patient_id", patientId)
    .eq("appointment_date", today)
    .in("status", ["waiting", "in_consultation"])
    .order("entered_queue_at", { ascending: false })
    .limit(1)
    .single();

  let appointmentId: string;
  let accessToken: string;
  let isReconnect: boolean;
  let enteredQueueAt: string;

  if (activeAppointment) {
    // Reconnect to existing appointment
    appointmentId = activeAppointment.id;
    accessToken = activeAppointment.access_token;
    enteredQueueAt = activeAppointment.entered_queue_at;
    isReconnect = true;
  } else {
    // Per-phone rate limit: 3 new appointments/hour (§6.1) — reconnects above
    // never reach this, so a patient re-scanning the QR is unaffected
    const { count: recentJoins } = await supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("patient_id", patientId)
      .gt("created_at", oneHourAgo);

    if ((recentJoins ?? 0) >= 3) {
      return new Response(
        JSON.stringify({ error: "Too many attempts with this phone number. Please try again later." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create a fresh appointment (previous one was done/cancelled or none existed)
    const { data: newAppointment, error: apptError } = await supabase
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

    if (apptError || !newAppointment) {
      return new Response(JSON.stringify({ error: "Failed to create appointment" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    appointmentId = newAppointment.id;
    accessToken = newAppointment.access_token;
    enteredQueueAt = newAppointment.entered_queue_at;
    isReconnect = false;

    // Log the event; the ip in metadata feeds the per-IP rate limit
    await supabase.from("appointment_events").insert({
      clinic_id: clinic.id,
      appointment_id: appointmentId,
      actor_type: "patient",
      event_type: "queue_joined",
      to_status: "waiting",
      metadata: { ip: clientIp },
    });
  }

  // 4. Compute queue position
  const { count } = await supabase
    .from("appointments")
    .select("*", { count: "exact", head: true })
    .eq("clinic_id", clinic.id)
    .eq("appointment_date", today)
    .eq("status", "waiting")
    .lt("entered_queue_at", enteredQueueAt);

  const position = (count ?? 0) + 1;

  return new Response(
    JSON.stringify({
      appointment_id: appointmentId,
      access_token: accessToken,
      clinic_name: clinic.name,
      position,
      is_reconnect: isReconnect,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
});
