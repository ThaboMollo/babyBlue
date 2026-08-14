import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import JoinQueueForm from "./JoinQueueForm";
import Image from "next/image";
import Link from "next/link";
import { MapPin, Phone } from "lucide-react";
import PageShell from "@/components/ui/PageShell";
import type { Clinic } from "@/lib/supabase/types";

interface PageProps {
  params: Promise<{ clinicSlug: string }>;
}

export default async function ClinicLandingPage({ params }: PageProps) {
  const { clinicSlug } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("clinics")
    .select("id, name, slug, address, phone")
    .eq("slug", clinicSlug)
    .single();

  const clinic = data as Pick<Clinic, "id" | "name" | "slug" | "address" | "phone"> | null;

  if (!clinic) {
    notFound();
  }

  return (
    <PageShell>
      {/* Header */}
      <header className="flex items-center gap-3 px-md py-md border-b border-border">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/icon.png"
            alt="BabyBlue"
            width={32}
            height={32}
            className="rounded-lg"
          />
          <span className="text-sm font-semibold text-text-secondary">BabyBlue</span>
        </Link>
      </header>

      {/* Content */}
      <div className="flex flex-col flex-1 px-md py-lg gap-lg">
        {/* Clinic info */}
        <div>
          <h1 className="text-2xl font-bold text-text-primary leading-tight">
            {clinic.name}
          </h1>
          <div className="mt-sm flex flex-col gap-1">
            {clinic.address && (
              <span className="flex items-center gap-1.5 text-sm text-text-secondary">
                <MapPin size={14} className="shrink-0" />
                {clinic.address}
              </span>
            )}
            {clinic.phone && (
              <span className="flex items-center gap-1.5 text-sm text-text-secondary">
                <Phone size={14} className="shrink-0" />
                {clinic.phone}
              </span>
            )}
          </div>
        </div>

        {/* Join queue form */}
        <JoinQueueForm clinicSlug={clinic.slug} clinicName={clinic.name} />
      </div>
    </PageShell>
  );
}
