import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import QueueClient from "./QueueClient";

export default async function QueuePage() {
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

  const today = new Date().toISOString().split("T")[0];

  const { data: appointments } = await supabase
    .from("appointments")
    .select("*, patients(id, name, phone)")
    .eq("clinic_id", profile.clinic_id)
    .eq("appointment_date", today)
    .order("entered_queue_at", { ascending: true });

  return (
    <QueueClient
      initialAppointments={appointments ?? []}
      profile={profile}
      today={today}
    />
  );
}
