import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import AppointmentDetailClient from "./AppointmentDetailClient";

export default async function AppointmentDetailPage({
  params,
}: {
  params: Promise<{ appointmentId: string }>;
}) {
  const { appointmentId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/onboarding");

  const { data: appointment } = await supabase
    .from("appointments")
    .select("*, patients(id, name, phone, dob, email)")
    .eq("id", appointmentId)
    .eq("clinic_id", profile.clinic_id)
    .single();

  if (!appointment) notFound();

  const { data: intakeResponses } = await supabase
    .from("intake_responses")
    .select("*")
    .eq("appointment_id", appointmentId)
    .order("created_at", { ascending: true });

  const { data: events } = await supabase
    .from("appointment_events")
    .select("*")
    .eq("appointment_id", appointmentId)
    .order("created_at", { ascending: true });

  const canViewIntake = profile.role === "admin" || profile.role === "doctor";

  return (
    <AppointmentDetailClient
      appointment={appointment}
      intakeResponses={canViewIntake ? (intakeResponses ?? []) : null}
      events={events ?? []}
      profile={profile}
    />
  );
}
