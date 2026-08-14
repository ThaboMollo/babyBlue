import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import IntakeClient from "./IntakeClient";

export default async function IntakePage() {
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

  const { data: clinicQuestions } = await supabase
    .from("clinic_intake_questions")
    .select("*, intake_question_templates(question_text, question_type, options)")
    .eq("clinic_id", profile.clinic_id)
    .order("sort_order", { ascending: true });

  const { data: globalTemplates } = await supabase
    .from("intake_question_templates")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  // Filter out templates already added
  const linkedTemplateIds = new Set(
    (clinicQuestions ?? [])
      .map((q) => q.template_id)
      .filter(Boolean)
  );
  const unlinkedTemplates = (globalTemplates ?? []).filter(
    (t) => !linkedTemplateIds.has(t.id)
  );

  return (
    <IntakeClient
      clinicId={profile.clinic_id}
      clinicQuestions={clinicQuestions ?? []}
      unlinkedTemplates={unlinkedTemplates}
    />
  );
}
