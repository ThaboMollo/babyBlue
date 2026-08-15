import type { JoinQueueResponse, AppointmentView } from "./supabase/types";

// The API is the single write path (spec §7.3): the client app no longer calls
// Supabase Edge Functions directly, it goes through the Hono API.
const API_URL = process.env.NEXT_PUBLIC_API_URL!;

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = "ApiError";
  }
}

/** True when the server rejected the session itself (gone/invalid), not a network blip. */
export function isSessionInvalidError(err: unknown): boolean {
  return err instanceof ApiError && [401, 403, 404].includes(err.status);
}

function apiUrl(path: string) {
  return `${API_URL}/v1/patient/${path}`;
}

async function callApi<T>(
  path: string,
  body: Record<string, unknown>
): Promise<T> {
  const res = await fetch(apiUrl(path), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new ApiError(data?.error ?? `Request failed (${res.status})`, res.status);
  }

  return data as T;
}

export async function joinQueue(params: {
  clinic_slug: string;
  first_name: string;
  last_name: string;
  phone: string;
  phone_is_whatsapp: boolean; // phone is NOT assumed to be the WhatsApp number (Seam 1)
  whatsapp_number?: string; // captured only when the phone is not WhatsApp
  nationality: string;
  id_type: "rsa_id" | "passport" | "asylum";
  id_number: string;
  dob?: string | null; // derived from an RSA ID on the client; re-derived server-side
  consent_records_storage?: boolean; // optional records-storage consent (method='patient_app')
}): Promise<JoinQueueResponse> {
  return callApi<JoinQueueResponse>("join-queue", params);
}

export async function getAppointment(params: {
  appointment_id: string;
  access_token: string;
}): Promise<AppointmentView> {
  return callApi<AppointmentView>("get-appointment", params);
}

export async function cancelAppointment(params: {
  appointment_id: string;
  access_token: string;
}): Promise<void> {
  await callApi("cancel-appointment", params);
}

export async function submitFeedback(params: {
  appointment_id: string;
  access_token: string;
  rating: number;
  comment?: string;
}): Promise<void> {
  await callApi("submit-feedback", params);
}

export async function submitIntake(params: {
  appointment_id: string;
  access_token: string;
  answers: {
    question_id: string;
    question_key: string;
    question_text: string;
    answer: string;
  }[];
}): Promise<void> {
  await callApi("submit-intake", params);
}
