import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, CalendarClock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Clinic, Practitioner } from "@/lib/types";

export const revalidate = 300;

type Row = Practitioner & { clinics: Clinic | null };

// NB: practitioner slug is unique per-clinic, not globally. For the MVP we
// resolve the first active match; production adds the clinic to the path.
async function loadPractitioner(slug: string): Promise<Row | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("practitioners")
    .select("*, clinics(*)")
    .eq("slug", slug)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  return (data as Row) ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ practitionerSlug: string }>;
}): Promise<Metadata> {
  const { practitionerSlug } = await params;
  const p = await loadPractitioner(practitionerSlug);
  if (!p) return { title: "Practitioner not found" };
  const name = `${p.title ? p.title + " " : ""}${p.first_name} ${p.last_name}`;
  const city = p.clinics?.city;
  return {
    title: `${name}${p.specialty ? ` — ${p.specialty}` : ""}${city ? `, ${city}` : ""}`,
    description: `Book an appointment with ${name}${p.specialty ? `, ${p.specialty}` : ""}${
      p.clinics?.name ? ` at ${p.clinics.name}` : ""
    }${city ? ` in ${city}` : ""} on BabyBlue.`,
    alternates: { canonical: `/dr/${p.slug}` },
  };
}

export default async function PractitionerPage({
  params,
}: {
  params: Promise<{ practitionerSlug: string }>;
}) {
  const { practitionerSlug } = await params;
  const p = await loadPractitioner(practitionerSlug);
  if (!p) notFound();
  const name = `${p.title ? p.title + " " : ""}${p.first_name} ${p.last_name}`;
  const clinic = p.clinics;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Physician",
    name,
    medicalSpecialty: p.specialty ?? undefined,
    description: p.bio ?? undefined,
    url: `${process.env.NEXT_PUBLIC_SITE_URL}/dr/${p.slug}`,
    worksFor: clinic
      ? {
          "@type": "MedicalClinic",
          name: clinic.name,
          address: {
            "@type": "PostalAddress",
            addressLocality: clinic.city ?? undefined,
            addressCountry: "ZA",
          },
        }
      : undefined,
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <h1 className="text-3xl font-extrabold text-text-primary">{name}</h1>
      <p className="mt-1 text-text-secondary">{p.specialty ?? "General practice"}</p>

      {clinic && (
        <Link
          href={`/practice/${clinic.slug}`}
          className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          <MapPin size={15} /> {clinic.name}
          {clinic.city ? ` · ${clinic.city}` : ""}
        </Link>
      )}

      {p.bio && <p className="mt-6 text-text-secondary leading-relaxed">{p.bio}</p>}

      {clinic && (
        <div className="mt-6 flex items-center gap-3">
          <Link
            href={`/book/${clinic.slug}?dr=${p.slug}`}
            className="px-6 py-3 rounded-input bg-primary hover:bg-primary-dark text-white font-medium"
          >
            Book with {p.first_name}
          </Link>
          <span className="inline-flex items-center gap-1 text-sm text-accent-dark">
            <CalendarClock size={15} />
            {clinic.booking_mode === "live" ? "Instant slots" : "Request to book"}
          </span>
        </div>
      )}
    </div>
  );
}
