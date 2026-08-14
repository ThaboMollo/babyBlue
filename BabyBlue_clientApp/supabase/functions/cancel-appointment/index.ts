import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

  let body: { appointment_id?: string; access_token?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { appointment_id, access_token } = body;

  if (!appointment_id || !access_token) {
    return new Response(
      JSON.stringify({ error: "appointment_id and access_token are required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // 1. Verify appointment + token
  const { data: appointment, error: apptError } = await supabase
    .from("appointments")
    .select("id, clinic_id, access_token, status")
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

  // 2. Patients may only leave while still waiting — once in consultation,
  // status is the clinic's to manage
  if (appointment.status !== "waiting") {
    return new Response(
      JSON.stringify({ error: "Only a waiting appointment can be cancelled" }),
      { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const { error: updateError } = await supabase
    .from("appointments")
    .update({ status: "cancelled" })
    .eq("id", appointment_id)
    .eq("status", "waiting");

  if (updateError) {
    return new Response(JSON.stringify({ error: "Failed to cancel appointment" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 3. Log as a distinct event so clinics can tell patient abandonment
  // apart from staff cancellations in analytics
  await supabase.from("appointment_events").insert({
    clinic_id: appointment.clinic_id,
    appointment_id,
    actor_type: "patient",
    event_type: "queue_left",
    from_status: "waiting",
    to_status: "cancelled",
  });

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
