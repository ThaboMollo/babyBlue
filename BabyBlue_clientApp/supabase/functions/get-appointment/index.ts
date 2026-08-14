import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Tokens are valid on the appointment day and the following day (§6.2)
const TOKEN_MAX_AGE_MS = 2 * 24 * 60 * 60 * 1000;

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

  // 1. Fetch appointment and verify token
  const { data: appointment, error: apptError } = await supabase
    .from("appointments")
    .select(`
      id,
      clinic_id,
      status,
      appointment_date,
      entered_queue_at,
      consultation_started_at,
      completed_at,
      access_token,
      clinics (
        name,
        address,
        avg_consultation_minutes
      )
    `)
    .eq("id", appointment_id)
    .single();

  if (apptError || !appointment) {
    return new Response(JSON.stringify({ error: "Appointment not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 2. Verify access token
  if (appointment.access_token !== access_token) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 2b. Expire tokens after the day following the appointment (§6.2)
  const apptDateMs = new Date(`${appointment.appointment_date}T00:00:00Z`).getTime();
  if (Date.now() - apptDateMs > TOKEN_MAX_AGE_MS) {
    return new Response(JSON.stringify({ error: "Session expired" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const clinic = appointment.clinics as {
    name: string;
    address: string | null;
    avg_consultation_minutes: number;
  };

  // 3. Compute queue position (only meaningful when waiting)
  let position = 0;
  if (appointment.status === "waiting") {
    const { count } = await supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("clinic_id", appointment.clinic_id)
      .eq("appointment_date", appointment.appointment_date)
      .eq("status", "waiting")
      .lt("entered_queue_at", appointment.entered_queue_at);

    position = (count ?? 0) + 1;
  }

  // 3b. Wait estimate from today's actual throughput (§3.2):
  // average start-to-start interval of recent consultations, falling back to
  // the clinic's configured constant when there aren't enough samples yet.
  let intervalMinutes = clinic.avg_consultation_minutes;
  if (position > 1) {
    const { data: recentStarts } = await supabase
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
      const mins = (starts[i] - starts[i - 1]) / 60000;
      // Ignore breaks (lunch, doctor stepping out) that would skew the pace
      if (mins > 0 && mins <= 120) intervals.push(mins);
    }

    if (intervals.length >= 3) {
      intervalMinutes = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    }
  }

  const rawWait = position > 1 ? intervalMinutes * (position - 1) : 0;
  const roundTo5 = (n: number) => Math.max(5, Math.round(n / 5) * 5);
  const estimatedWaitMinutes = Math.round(rawWait);
  // A range is honest; a point estimate is a promise we can't keep
  const estimatedWaitRange =
    rawWait > 0
      ? { min: roundTo5(rawWait * 0.8), max: roundTo5(rawWait * 1.4) }
      : null;

  // 4. Check if intake already submitted
  const { count: intakeCount } = await supabase
    .from("intake_responses")
    .select("*", { count: "exact", head: true })
    .eq("appointment_id", appointment_id);

  const intakeSubmitted = (intakeCount ?? 0) > 0;

  // 4b. Check if feedback already submitted (only relevant once done)
  let feedbackSubmitted = false;
  if (appointment.status === "done") {
    const { count: feedbackCount } = await supabase
      .from("visit_feedback")
      .select("*", { count: "exact", head: true })
      .eq("appointment_id", appointment_id);
    feedbackSubmitted = (feedbackCount ?? 0) > 0;
  }

  // 5. Fetch clinic's active intake questions (resolved with templates)
  const { data: clinicQuestions } = await supabase
    .from("clinic_intake_questions")
    .select(`
      id,
      inherit_global,
      question_text,
      question_type,
      options,
      sort_order,
      template_id,
      intake_question_templates (
        question_key,
        question_text,
        question_type,
        options
      )
    `)
    .eq("clinic_id", appointment.clinic_id)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  type QuestionRow = {
    id: string;
    inherit_global: boolean;
    question_text: string | null;
    question_type: string | null;
    options: string[] | null;
    sort_order: number;
    template_id: string | null;
    intake_question_templates: {
      question_key: string;
      question_text: string;
      question_type: string;
      options: string[] | null;
    } | null;
  };

  const questions = (clinicQuestions as QuestionRow[] ?? []).map((q) => {
    const tmpl = q.intake_question_templates;
    return {
      id: q.id,
      question_key: tmpl?.question_key ?? q.id,
      question_text: q.inherit_global && tmpl ? tmpl.question_text : (q.question_text ?? ""),
      question_type: q.inherit_global && tmpl ? tmpl.question_type : (q.question_type ?? "text"),
      options: q.inherit_global && tmpl ? tmpl.options : q.options,
      sort_order: q.sort_order,
    };
  });

  return new Response(
    JSON.stringify({
      appointment: {
        id: appointment.id,
        status: appointment.status,
        entered_queue_at: appointment.entered_queue_at,
        consultation_started_at: appointment.consultation_started_at,
        completed_at: appointment.completed_at,
      },
      position,
      estimated_wait_minutes: estimatedWaitMinutes,
      estimated_wait_range: estimatedWaitRange,
      clinic: {
        name: clinic.name,
        address: clinic.address,
      },
      intake_submitted: intakeSubmitted,
      feedback_submitted: feedbackSubmitted,
      questions,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
});
