import Link from "next/link";
import { Search, MapPin, Stethoscope } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Clinic, Practitioner } from "@/lib/types";

export const revalidate = 300; // ISR — crawlable, cached 5 min

type PractitionerRow = Practitioner & { clinics: Pick<Clinic, "name" | "slug" | "city"> | null };

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const supabase = await createClient();

  let practitioners: PractitionerRow[] = [];
  let clinics: Clinic[] = [];

  // Only active (approved) clinics are public. For practitioners we use an inner
  // join on clinics filtered to active, so a practitioner at a pending clinic
  // stays hidden too.
  if (query) {
    const like = `%${query}%`;
    const [pr, cl] = await Promise.all([
      supabase
        .from("practitioners")
        .select("*, clinics!inner(name, slug, city, status)")
        .eq("is_active", true)
        .eq("clinics.status", "active")
        .or(`first_name.ilike.${like},last_name.ilike.${like},specialty.ilike.${like}`)
        .limit(20),
      supabase
        .from("clinics")
        .select("*")
        .eq("status", "active")
        .or(`name.ilike.${like},city.ilike.${like},suburb.ilike.${like}`)
        .limit(20),
    ]);
    practitioners = (pr.data as PractitionerRow[]) ?? [];
    clinics = (cl.data as Clinic[]) ?? [];
  } else {
    const [pr, cl] = await Promise.all([
      supabase
        .from("practitioners")
        .select("*, clinics!inner(name, slug, city, status)")
        .eq("is_active", true)
        .eq("clinics.status", "active")
        .limit(12),
      supabase.from("clinics").select("*").eq("status", "active").limit(12),
    ]);
    practitioners = (pr.data as PractitionerRow[]) ?? [];
    clinics = (cl.data as Clinic[]) ?? [];
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <section className="text-center py-10">
        <h1 className="text-4xl font-extrabold tracking-tight text-text-primary text-balance">
          Find a doctor. Book in seconds.
        </h1>
        <p className="mt-3 text-text-secondary max-w-xl mx-auto">
          Search practitioners, practices and services across South Africa — then book with
          just your name and WhatsApp number. No app, no account.
        </p>
        <form action="/" method="get" className="mt-6 flex max-w-xl mx-auto gap-2">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
            <input
              name="q"
              defaultValue={query}
              placeholder="Doctor, specialty, practice or city"
              className="w-full h-12 pl-10 pr-4 rounded-input border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <button className="h-12 px-6 rounded-input bg-primary hover:bg-primary-dark text-white font-medium">
            Search
          </button>
        </form>
      </section>

      {practitioners.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary mb-3">
            {query ? "Practitioners" : "Featured practitioners"}
          </h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {practitioners.map((p) => (
              <Link
                key={p.id}
                href={`/dr/${p.slug}`}
                className="flex items-start gap-3 p-4 rounded-xl border border-border bg-surface hover:border-primary/40 transition-colors"
              >
                <div className="mt-0.5 h-10 w-10 rounded-full bg-primary/10 text-primary grid place-items-center shrink-0">
                  <Stethoscope size={18} />
                </div>
                <div>
                  <div className="font-semibold text-text-primary">
                    {p.title ? `${p.title} ` : ""}
                    {p.first_name} {p.last_name}
                  </div>
                  <div className="text-sm text-text-secondary">
                    {p.specialty ?? "General practice"}
                    {p.clinics?.name ? ` · ${p.clinics.name}` : ""}
                    {p.clinics?.city ? ` · ${p.clinics.city}` : ""}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {clinics.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary mb-3">
            {query ? "Practices" : "Practices"}
          </h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {clinics.map((c) => (
              <Link
                key={c.id}
                href={`/practice/${c.slug}`}
                className="p-4 rounded-xl border border-border bg-surface hover:border-primary/40 transition-colors"
              >
                <div className="font-semibold text-text-primary">{c.name}</div>
                <div className="text-sm text-text-secondary flex items-center gap-1 mt-0.5">
                  <MapPin size={14} />
                  {[c.suburb, c.city].filter(Boolean).join(", ") || c.address || "South Africa"}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {query && practitioners.length === 0 && clinics.length === 0 && (
        <p className="text-center text-text-secondary mt-10">
          No results for “{query}”. Try a different name, specialty or city.
        </p>
      )}
    </div>
  );
}
