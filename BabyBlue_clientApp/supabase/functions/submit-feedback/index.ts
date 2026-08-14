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

  let body: {
    appointment_id?: string;
    access_token?: string;
    rating?: number;
    comment?: string;
  };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { appointment_id, access_token, rating, comment } = body;

  if (!appointment_id || !access_token || typeof rating !== "number") {
    return new Response(
      JSON.stringify({ error: "appointment_id, access_token, and rating are required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return new Response(JSON.stringify({ error: "rating must be an integer from 1 to 5" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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

  // 2. Feedback only makes sense after the visit
  if (appointment.status !== "done") {
    return new Response(
      JSON.stringify({ error: "Feedback can only be submitted after the visit is complete" }),
      { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // 3. Insert — the UNIQUE constraint on appointment_id is the duplicate guard
  const { error: insertError } = await supabase.from("visit_feedback").insert({
    appointment_id,
    clinic_id: appointment.clinic_id,
    rating,
    comment: comment?.trim() ? comment.trim().slice(0, 1000) : null,
  });

  if (insertError) {
    const duplicate = insertError.code === "23505";
    return new Response(
      JSON.stringify({
        error: duplicate
          ? "Feedback already submitted for this visit"
          : "Failed to save feedback",
      }),
      {
        status: duplicate ? 409 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  await supabase.from("appointment_events").insert({
    clinic_id: appointment.clinic_id,
    appointment_id,
    actor_type: "patient",
    event_type: "feedback_submitted",
    metadata: { rating },
  });

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
