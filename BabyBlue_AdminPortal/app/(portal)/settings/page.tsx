import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import SettingsClient from "./SettingsClient";

export default async function SettingsPage() {
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
  if (profile.role !== "admin") redirect("/queue");

  const { data: clinic } = await supabase
    .from("clinics")
    .select("*")
    .eq("id", profile.clinic_id)
    .single();

  return <SettingsClient clinic={clinic} />;
}
