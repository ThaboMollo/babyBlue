"use server";

// Patient-file mutations. These are now thin wrappers over the BabyBlue API
// (the single write path, spec §7.3): the admin portal holds no service-role
// key. Each action forwards the staff member's Supabase access token; the API
// re-verifies role + tenant, enforces the consent hard-block and HPCSA
// retention, signs storage URLs, and audits access.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { callApi, ApiError } from "@/lib/api";
import type { ConsentMethod } from "@/types";

type ActionResult = { ok: true } | { error: string };
type SignResult = { url: string } | { error: string };

async function accessToken(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

function errMessage(e: unknown): string {
  return e instanceof ApiError || e instanceof Error ? e.message : "Request failed.";
}

/** Record records-storage consent (reception/admin — enforced by the API). */
export async function captureRecordsConsent(
  patientId: string,
  method: ConsentMethod
): Promise<ActionResult> {
  const token = await accessToken();
  if (!token) return { error: "Not authenticated." };
  try {
    await callApi(`/v1/admin/patients/${patientId}/consent`, { token, body: { method } });
    revalidatePath(`/patients/${patientId}`);
    return { ok: true };
  } catch (e) {
    return { error: errMessage(e) };
  }
}

/** Revoke any active records-storage consent (reception/admin). */
export async function revokeRecordsConsent(patientId: string): Promise<ActionResult> {
  const token = await accessToken();
  if (!token) return { error: "Not authenticated." };
  try {
    await callApi(`/v1/admin/patients/${patientId}/consent`, { token, method: "DELETE" });
    revalidatePath(`/patients/${patientId}`);
    return { ok: true };
  } catch (e) {
    return { error: errMessage(e) };
  }
}

/** Upsert the consult note for a visit (doctor only; consent hard-block in the API). */
export async function saveVisitNote(input: {
  appointmentId: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}): Promise<{ ok: true; updatedAt: string } | { error: string }> {
  const token = await accessToken();
  if (!token) return { error: "Not authenticated." };
  try {
    const r = await callApi<{ ok: true; updatedAt: string }>(
      `/v1/admin/appointments/${input.appointmentId}/visit-note`,
      {
        token,
        method: "PUT",
        body: {
          subjective: input.subjective,
          objective: input.objective,
          assessment: input.assessment,
          plan: input.plan,
        },
      }
    );
    return { ok: true, updatedAt: r.updatedAt };
  } catch (e) {
    return { error: errMessage(e) };
  }
}

/** Assemble a patient's full record for a POPIA data-subject request (admin only). */
export async function exportPatientRecord(
  patientId: string
): Promise<{ record: unknown } | { error: string }> {
  const token = await accessToken();
  if (!token) return { error: "Not authenticated." };
  try {
    return await callApi<{ record: unknown }>(`/v1/admin/patients/${patientId}/export`, {
      token,
      method: "GET",
    });
  } catch (e) {
    return { error: errMessage(e) };
  }
}

/** Guarded hard-delete for a POPIA erasure request (admin only; retention checked in the API). */
export async function deletePatientRecord(
  patientId: string,
  opts: { confirmName: string; reason: string }
): Promise<ActionResult> {
  const token = await accessToken();
  if (!token) return { error: "Not authenticated." };
  try {
    await callApi(`/v1/admin/patients/${patientId}`, {
      token,
      method: "DELETE",
      body: { confirmName: opts.confirmName, reason: opts.reason },
    });
    revalidatePath("/patients");
    return { ok: true };
  } catch (e) {
    return { error: errMessage(e) };
  }
}

/** Short-TTL signed URL for a private document (view is logged by the API). */
export async function signDocumentUrl(documentId: string): Promise<SignResult> {
  const token = await accessToken();
  if (!token) return { error: "Not authenticated." };
  try {
    return await callApi<{ url: string }>(`/v1/admin/documents/${documentId}/signed-url`, {
      token,
      method: "GET",
    });
  } catch (e) {
    return { error: errMessage(e) };
  }
}
