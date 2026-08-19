import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Platform (Super Admin) console shell. Gated on is_platform_admin — regular
// clinic staff never reach it.
export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: isPlatformAdmin } = await supabase.rpc("is_platform_admin");
  if (!isPlatformAdmin) redirect("/");

  return (
    <div className="min-h-screen bg-[#F7FAFC]">
      <header className="bg-white border-b border-[#E2E8F0]">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#0B5AA8]">BabyBlue</span>
            <span className="text-xs font-semibold uppercase tracking-wider text-[#475569] bg-[#EEF2FF] px-2 py-0.5 rounded">
              Platform
            </span>
          </div>
          <span className="text-sm text-[#475569]">{user.email}</span>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
