import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, Phone, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Clinic } from "@/lib/supabase/types";
import SiteNav from "@/components/marketing/SiteNav";
import SiteFooter from "@/components/marketing/SiteFooter";
import ResumeBanner from "../ResumeBanner";

export const metadata: Metadata = {
  title: "Find your clinic",
  description:
    "Find your clinic on BabyBlue and join its walk-in queue from your phone — no app, no account.",
};

type ClinicListItem = Pick<Clinic, "id" | "name" | "slug" | "address" | "phone">;

export default async function FindAClinic() {
  let clinics: ClinicListItem[] = [];
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("clinics")
      .select("id, name, slug, address, phone")
      .order("name");
    clinics = (data ?? []) as ClinicListItem[];
  } catch {
    // Directory is unavailable without Supabase config — render the empty state.
  }

  return (
    <>
      <SiteNav />
      <main className="mx-auto w-full max-w-5xl px-md py-lg sm:px-lg sm:py-xl">
        <header>
          <h1 className="text-3xl font-extrabold tracking-tight text-text-primary">
            Find your clinic
          </h1>
          <p className="mt-2 text-base text-text-secondary">
            Pick your clinic below to join its queue — or scan the QR poster at
            reception to land there directly.
          </p>
        </header>

        <ResumeBanner />

        {clinics.length === 0 ? (
          <p className="mt-xl text-center text-sm text-text-secondary">
            No clinics are available yet. Open your clinic&apos;s link or scan its QR
            poster to join the queue.
          </p>
        ) : (
          <div className="mt-lg grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-3">
            {clinics.map((clinic) => (
              <Link
                key={clinic.id}
                href={`/c/${clinic.slug}`}
                className="group flex flex-col gap-sm rounded-2xl border border-border bg-surface p-md shadow-sm transition-colors hover:border-primary/40 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-sm">
                  <h2 className="text-base font-semibold leading-snug text-text-primary">
                    {clinic.name}
                  </h2>
                  <ChevronRight
                    size={18}
                    className="mt-0.5 shrink-0 text-text-secondary transition-colors group-hover:text-primary"
                  />
                </div>

                <div className="flex flex-col gap-1">
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

                <span className="mt-auto pt-sm text-sm font-medium text-primary">
                  Join the queue
                </span>
              </Link>
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
