import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface AnswerPayload {
  question_id: string;
  question_key: string;
  question_text: string;
  answer: string;
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
    appointment_id?: string;
    access_token?: string;
    answers?: AnswerPayload[];
  };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { appointment_id, access_token, answers } = body;

  if (!appointment_id || !access_token || !answers?.length) {
    return new Response(
      JSON.stringify({ error: "appointment_id, access_token, and answers are required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // 1. Verify appointment + token
  const { data: appointment, error: apptError } = await supabase
    .from("appointments")
    .select("id, clinic_id, access_token, status, appointment_date")
    .eq("id", appointment_id)
    .single();

  if (apptError || !appointment) {
    return new Response(JSON.stringify({ error: "Appointment not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (appointment.access_token !== access_token) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 1b. Expire tokens after the day following the appointment (§6.2)
  const apptDateMs = new Date(`${appointment.appointment_date}T00:00:00Z`).getTime();
  if (Date.now() - apptDateMs > 2 * 24 * 60 * 60 * 1000) {
    return new Response(JSON.stringify({ error: "Session expired" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 2. Guard: only allow while active
  if (!["waiting", "in_consultation"].includes(appointment.status)) {
    return new Response(
      JSON.stringify({ error: "Intake can only be submitted for active appointments" }),
      { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // 3. Guard: prevent duplicate submissions
  const { count } = await supabase
    .from("intake_responses")
    .select("*", { count: "exact", head: true })
    .eq("appointment_id", appointment_id);

  if ((count ?? 0) > 0) {
    return new Response(
      JSON.stringify({ error: "Intake already submitted for this appointment" }),
      { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // 4. Insert all responses
  const rows = answers.map((a) => ({
    appointment_id,
    clinic_id: appointment.clinic_id,
    question_id: a.question_id || null,
    question_key: a.question_key,
    question_text: a.question_text,
    answer: String(a.answer),
  }));

  const { error: insertError } = await supabase
    .from("intake_responses")
    .insert(rows);

  if (insertError) {
    return new Response(JSON.stringify({ error: "Failed to save intake responses" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 5. Log the event
  await supabase.from("appointment_events").insert({
    clinic_id: appointment.clinic_id,
    appointment_id,
    actor_type: "patient",
    event_type: "intake_submitted",
  });

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
