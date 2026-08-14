import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/Sidebar";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*, clinics(name, slug)")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/onboarding");
  }

  return (
    <div className="flex min-h-screen bg-[#F7FAFC]">
      <Sidebar profile={profile} clinic={profile.clinics} />
      <main className="flex-1 min-w-0 overflow-auto">
        <div className="max-w-[1400px] mx-auto p-6">{children}</div>
      </main>
    </div>
  );
}
