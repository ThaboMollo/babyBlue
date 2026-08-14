import { createClient } from "@/lib/supabase/server";
import { logRecordAccess } from "@/lib/access-log";
import { redirect, notFound } from "next/navigation";
import PatientFileClient from "./PatientFileClient";
import type {
  Patient,
  Appointment,
  IntakeResponse,
  AppointmentEvent,
  VisitFeedback,
  VisitNote,
  PatientDocument,
  PatientConsent,
  TimelineVisit,
} from "@/types";

export default async function PatientFilePage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  const { patientId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/onboarding");

  // Patient (RLS scopes to clinic; belt-and-braces clinic_id filter).
  const { data: patientRow } = await supabase
    .from("patients")
    .select("*")
    .eq("id", patientId)
    .eq("clinic_id", profile.clinic_id)
    .single();
  if (!patientRow) notFound();
  const patient = patientRow as Patient;

  // Visit timeline — appointments newest first.
  const { data: appointments } = await supabase
    .from("appointments")
    .select("*")
    .eq("patient_id", patientId)
    .eq("clinic_id", profile.clinic_id)
    .order("appointment_date", { ascending: false })
    .order("entered_queue_at", { ascending: false })
    .returns<Appointment[]>();

  const appts = appointments ?? [];
  const apptIds = appts.map((a) => a.id);

  // Per-visit children + patient-level documents & consent, in parallel.
  // visit_notes returns rows only for doctor/admin (RLS); reception sees none.
  const [intake, events, feedback, notes, documents, consents] = await Promise.all([
    supabase.from("intake_responses").select("*").in("appointment_id", apptIds).returns<IntakeResponse[]>(),
    supabase
      .from("appointment_events")
      .select("*")
      .in("appointment_id", apptIds)
      .order("created_at", { ascending: true })
      .returns<AppointmentEvent[]>(),
    supabase.from("visit_feedback").select("*").in("appointment_id", apptIds).returns<VisitFeedback[]>(),
    supabase.from("visit_notes").select("*").in("appointment_id", apptIds).returns<VisitNote[]>(),
    supabase
      .from("patient_documents")
      .select("*")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false })
      .returns<PatientDocument[]>(),
    supabase
      .from("patient_consent")
      .select("*")
      .eq("patient_id", patientId)
      .eq("consent_type", "records_storage")
      .order("granted_at", { ascending: false })
      .returns<PatientConsent[]>(),
  ]);

  // Group children by appointment for the timeline.
  const byAppt = <T extends { appointment_id: string }>(rows: T[] | null) => {
    const map = new Map<string, T[]>();
    for (const r of rows ?? []) {
      const list = map.get(r.appointment_id) ?? [];
      list.push(r);
      map.set(r.appointment_id, list);
    }
    return map;
  };
  const intakeByAppt = byAppt(intake.data);
  const eventsByAppt = byAppt(events.data);
  const feedbackByAppt = new Map((feedback.data ?? []).map((f) => [f.appointment_id, f]));
  const notesByAppt = new Map((notes.data ?? []).map((n) => [n.appointment_id, n]));

  const timeline: TimelineVisit[] = appts.map((a) => ({
    ...a,
    intake_responses: intakeByAppt.get(a.id) ?? [],
    appointment_events: eventsByAppt.get(a.id) ?? [],
    visit_feedback: feedbackByAppt.get(a.id) ?? null,
    visit_note: notesByAppt.get(a.id) ?? null,
  }));

  // Consent state: latest records_storage row, active if granted & not revoked.
  const latestConsent = (consents.data ?? [])[0] ?? null;
  const hasActiveConsent = !!latestConsent?.granted && !latestConsent?.revoked_at;

  // POPIA: log the record view SERVER-SIDE so it can't be skipped.
  await logRecordAccess(supabase, {
    clinicId: profile.clinic_id,
    patientId,
    actorUserId: user.id,
    action: "view",
    context: "patient_file",
  });

  return (
    <PatientFileClient
      patient={patient}
      role={profile.role}
      timeline={timeline}
      documents={documents.data ?? []}
      consent={latestConsent}
      hasActiveConsent={hasActiveConsent}
    />
  );
}
