// Booking client — the discovery app reads Supabase directly (public SSR) but
// all WRITES go through the BabyBlue API (the single write path).

import type { Slot } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

export async function getAvailability(clinicSlug: string, date: string): Promise<Slot[]> {
  const res = await fetch(
    `${API_URL}/v1/booking/availability?clinic=${encodeURIComponent(clinicSlug)}&date=${date}`
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data.slots ?? []) as Slot[];
}

export interface BookInput {
  clinic_slug: string;
  first_name: string;
  last_name: string;
  phone: string;
  phone_is_whatsapp: boolean;
  whatsapp_number?: string;
  reason?: string;
  slot_start?: string;
  practitioner_slug?: string;
}

export interface BookResult {
  appointment_id: string;
  access_token: string;
  clinic_name: string;
  status: "confirmed" | "requested";
  slot_start: string | null;
}

export async function book(input: BookInput): Promise<BookResult> {
  const res = await fetch(`${API_URL}/v1/booking/book`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? `Booking failed (${res.status})`);
  return data as BookResult;
}
