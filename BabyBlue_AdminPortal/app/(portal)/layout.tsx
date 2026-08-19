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

  // Super Admins operate the platform console, not a clinic — send them there
  // before the "no profile → onboarding" rule (they intentionally have none).
  const { data: isPlatformAdmin } = await supabase.rpc("is_platform_admin");
  if (isPlatformAdmin) {
    redirect("/platform");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*, clinics(name, slug, status)")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/onboarding");
  }

  const clinic = profile.clinics as { name: string; slug: string; status: string } | null;
  const pending = clinic?.status !== "active";

  return (
    <div className="flex min-h-screen bg-[#F7FAFC]">
      <Sidebar profile={profile} clinic={profile.clinics} />
      <main className="flex-1 min-w-0 overflow-auto">
        {pending && (
          <div className="bg-[#FEF3C7] border-b border-[#FCD34D] px-6 py-3 text-sm text-[#92400E]">
            <strong>Awaiting approval.</strong> Your clinic isn&apos;t public yet — patients
            can&apos;t find or book it until a BabyBlue admin approves it. You can still set
            things up in the meantime.
          </div>
        )}
        <div className="max-w-[1400px] mx-auto p-6">{children}</div>
      </main>
    </div>
  );
}
