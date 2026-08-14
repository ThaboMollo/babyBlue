"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { LayoutList, Settings, LogOut, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Profile, Clinic } from "@/types";

interface Props {
  profile: Profile;
  clinic: Pick<Clinic, "name" | "slug"> | null;
}

const navItems = [
  { href: "/queue", label: "Queue", icon: LayoutList },
  { href: "/patients", label: "Patients", icon: Users },
];

const adminNavItems = [
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar({ profile, clinic }: Props) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="w-60 shrink-0 bg-white border-r border-[#E2E8F0] flex flex-col min-h-screen sticky top-0">
      {/* Logo */}
      <div className="px-5 py-4 border-b border-[#E2E8F0]">
        <Image
          src="/BabyBlue_logo.png"
          alt="BabyBlue"
          width={130}
          height={34}
          priority
        />
        {clinic && (
          <p className="text-xs text-[#475569] mt-2 truncate">{clinic.name}</p>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
                active
                  ? "bg-[#0B5AA8] text-white"
                  : "text-[#475569] hover:bg-[#F7FAFC] hover:text-[#0F172A]"
              }`}
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}

        {profile.role === "admin" && (
          <>
            <div className="pt-3 pb-1">
              <p className="text-xs font-semibold text-[#475569] uppercase tracking-wider px-3">
                Admin
              </p>
            </div>
            {adminNavItems.map(({ href, label, icon: Icon }) => {
              const active = pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
                    active
                      ? "bg-[#0B5AA8] text-white"
                      : "text-[#475569] hover:bg-[#F7FAFC] hover:text-[#0F172A]"
                  }`}
                >
                  <Icon size={16} />
                  {label}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      {/* User + logout */}
      <div className="px-3 py-4 border-t border-[#E2E8F0]">
        <div className="px-3 py-2 mb-1">
          <p className="text-sm font-medium text-[#0F172A] truncate">
            {profile.full_name ?? "Staff"}
          </p>
          <p className="text-xs text-[#475569] capitalize">{profile.role}</p>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-[#475569] hover:bg-red-50 hover:text-[#EF4444] transition-colors w-full min-h-[44px]"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
