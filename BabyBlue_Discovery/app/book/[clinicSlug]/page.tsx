import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import BookingFunnel from "./BookingFunnel";
import type { Clinic, Practitioner } from "@/lib/types";

export const dynamic = "force-dynamic"; // interactive booking, not cached

export async function generateMetadata({
  params,
}: {
  params: Promise<{ clinicSlug: string }>;
}): Promise<Metadata> {
  const { clinicSlug } = await params;
  return { title: "Book an appointment", alternates: { canonical: `/book/${clinicSlug}` } };
}

export default async function BookPage({
  params,
  searchParams,
}: {
  params: Promise<{ clinicSlug: string }>;
  searchParams: Promise<{ dr?: string }>;
}) {
  const { clinicSlug } = await params;
  const { dr } = await searchParams;
  const supabase = await createClient();
  const { data: clinic } = await supabase.from("clinics").select("*").eq("slug", clinicSlug).maybeSingle();
  if (!clinic) notFound();
  const { data: practitioners } = await supabase
    .from("practitioners")
    .select("*")
    .eq("clinic_id", clinic.id)
    .eq("is_active", true);

  return (
    <BookingFunnel
      clinic={clinic as Clinic}
      practitioners={(practitioners as Practitioner[]) ?? []}
      preselectedDr={dr ?? null}
    />
  );
}
