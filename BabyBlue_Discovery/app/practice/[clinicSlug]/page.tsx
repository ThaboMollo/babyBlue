import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, Phone, CalendarClock, Stethoscope } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Clinic, Practitioner, Service } from "@/lib/types";

export const revalidate = 300;

async function loadClinic(slug: string) {
  const supabase = await createClient();
  const { data: clinic } = await supabase
    .from("clinics")
    .select("*")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();
  if (!clinic) return null;
  const [{ data: practitioners }, { data: services }] = await Promise.all([
    supabase.from("practitioners").select("*").eq("clinic_id", clinic.id).eq("is_active", true),
    supabase.from("services").select("*").eq("clinic_id", clinic.id).eq("is_active", true),
  ]);
  return {
    clinic: clinic as Clinic,
    practitioners: (practitioners as Practitioner[]) ?? [],
    services: (services as Service[]) ?? [],
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ clinicSlug: string }>;
}): Promise<Metadata> {
  const { clinicSlug } = await params;
  const data = await loadClinic(clinicSlug);
  if (!data) return { title: "Practice not found" };
  const { clinic } = data;
  const where = [clinic.suburb, clinic.city].filter(Boolean).join(", ");
  return {
    title: `${clinic.name}${where ? ` — ${where}` : ""}`,
    description: `Book an appointment at ${clinic.name}${where ? ` in ${where}` : ""} on BabyBlue.`,
    alternates: { canonical: `/practice/${clinic.slug}` },
  };
}

export default async function PracticePage({
  params,
}: {
  params: Promise<{ clinicSlug: string }>;
}) {
  const { clinicSlug } = await params;
  const data = await loadClinic(clinicSlug);
  if (!data) notFound();
  const { clinic, practitioners, services } = data;
  const where = [clinic.suburb, clinic.city].filter(Boolean).join(", ");

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "MedicalClinic",
    name: clinic.name,
    address: {
      "@type": "PostalAddress",
      streetAddress: clinic.address ?? undefined,
      addressLocality: clinic.city ?? undefined,
      addressCountry: "ZA",
    },
    telephone: clinic.phone ?? undefined,
    url: `${process.env.NEXT_PUBLIC_SITE_URL}/practice/${clinic.slug}`,
    employee: practitioners.map((p) => ({
      "@type": "Physician",
      name: `${p.title ? p.title + " " : ""}${p.first_name} ${p.last_name}`,
      medicalSpecialty: p.specialty ?? undefined,
    })),
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <h1 className="text-3xl font-extrabold text-text-primary">{clinic.name}</h1>
      <div className="mt-2 flex flex-wrap gap-4 text-sm text-text-secondary">
        {where && (
          <span className="flex items-center gap-1">
            <MapPin size={15} /> {where}
          </span>
        )}
        {clinic.phone && (
          <span className="flex items-center gap-1">
            <Phone size={15} /> {clinic.phone}
          </span>
        )}
        <span className="inline-flex items-center gap-1 text-accent-dark">
          <CalendarClock size={15} />
          {clinic.booking_mode === "live" ? "Instant slot booking" : "Request an appointment"}
        </span>
      </div>

      <Link
        href={`/book/${clinic.slug}`}
        className="inline-block mt-6 px-6 py-3 rounded-input bg-primary hover:bg-primary-dark text-white font-medium"
      >
        Book an appointment
      </Link>

      {practitioners.length > 0 && (
        <section className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary mb-3">
            Practitioners
          </h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {practitioners.map((p) => (
              <Link
                key={p.id}
                href={`/dr/${p.slug}`}
                className="flex items-start gap-3 p-4 rounded-xl border border-border bg-surface hover:border-primary/40"
              >
                <div className="mt-0.5 h-10 w-10 rounded-full bg-primary/10 text-primary grid place-items-center shrink-0">
                  <Stethoscope size={18} />
                </div>
                <div>
                  <div className="font-semibold">
                    {p.title ? `${p.title} ` : ""}
                    {p.first_name} {p.last_name}
                  </div>
                  <div className="text-sm text-text-secondary">{p.specialty ?? "General practice"}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {services.length > 0 && (
        <section className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary mb-3">
            Services
          </h2>
          <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
            {services.map((s) => (
              <li key={s.id} className="px-4 py-3 flex justify-between text-sm">
                <span className="font-medium text-text-primary">{s.name}</span>
                <span className="text-text-secondary">{s.duration_minutes} min</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
