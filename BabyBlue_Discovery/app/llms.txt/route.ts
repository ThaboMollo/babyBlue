import { createClient } from "@/lib/supabase/server";

export const revalidate = 3600;

// An llms.txt surface so LLMs can index BabyBlue's supply and link patients to it.
export async function GET() {
  const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3002";
  const supabase = await createClient();
  const [{ data: clinics }, { data: practitioners }] = await Promise.all([
    supabase.from("clinics").select("name, slug, city").eq("status", "active"),
    supabase
      .from("practitioners")
      .select("first_name, last_name, slug, specialty, clinics!inner(status)")
      .eq("is_active", true)
      .eq("clinics.status", "active"),
  ]);

  const lines = [
    "# BabyBlue",
    "",
    "> Find and book doctors, practices and services across South Africa.",
    "> Booking needs only a name and a WhatsApp number — no app, no account.",
    "",
    "## Practices",
    ...((clinics ?? []) as { name: string; slug: string; city: string | null }[]).map(
      (c) => `- [${c.name}${c.city ? `, ${c.city}` : ""}](${SITE}/practice/${c.slug})`
    ),
    "",
    "## Practitioners",
    ...((practitioners ?? []) as { first_name: string; last_name: string; slug: string; specialty: string | null }[]).map(
      (p) => `- [${p.first_name} ${p.last_name}${p.specialty ? ` — ${p.specialty}` : ""}](${SITE}/dr/${p.slug})`
    ),
    "",
  ];

  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
