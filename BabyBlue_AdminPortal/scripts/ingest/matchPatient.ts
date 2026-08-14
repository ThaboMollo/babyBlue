import type { SupabaseClient } from "@supabase/supabase-js";
import { validateSAIdNumber, type IdType } from "../../lib/identity";

/** Identity fields the scan/OCR step extracted for one document. */
export interface IngestIdentity {
  name: string;
  nationality?: string | null;
  idType?: IdType | null;
  idNumber?: string | null;
  phone?: string | null;
  dob?: string | null; // ISO YYYY-MM-DD
}

export type MatchStatus = "matched" | "matched_low" | "ambiguous" | "not_found";

export interface Candidate {
  id: string;
  name: string;
}

export interface MatchResult {
  status: MatchStatus;
  patientId: string | null;
  /** How the match was made — 'id' and 'phone' are high-confidence. */
  by: "id" | "phone" | "name_dob" | null;
  candidates: Candidate[];
  note?: string;
}

function normalizePhone(phone?: string | null): string | null {
  if (!phone) return null;
  const p = phone.replace(/[^\d+]/g, "");
  return p || null;
}

function normalizeIdNumber(idType: IdType, idNumber: string): string {
  return idType === "rsa_id" ? idNumber.replace(/\s/g, "") : idNumber.trim();
}

/**
 * Resolve a scanned file's identity to an existing patient.
 * Precedence: ID number (high) → unique phone (high) → name+dob (low,
 * reviewer must confirm). Multiple hits at any tier ⇒ ambiguous (never
 * a silent merge).
 */
export async function matchPatient(
  supabase: SupabaseClient,
  clinicId: string,
  identity: IngestIdentity
): Promise<MatchResult> {
  // 1. ID number — the reliable key.
  if (identity.idType && identity.idNumber) {
    const idNum = normalizeIdNumber(identity.idType, identity.idNumber);
    const { data } = await supabase
      .from("patients")
      .select("id, name")
      .eq("clinic_id", clinicId)
      .eq("id_type", identity.idType)
      .eq("id_number", idNum)
      .maybeSingle();
    if (data) return { status: "matched", patientId: data.id, by: "id", candidates: [] };
  }

  // 2. Phone — high confidence only when it resolves to exactly one patient.
  const phone = normalizePhone(identity.phone);
  if (phone) {
    const { data } = await supabase
      .from("patients")
      .select("id, name")
      .eq("clinic_id", clinicId)
      .eq("phone", phone);
    if (data && data.length === 1) {
      return { status: "matched", patientId: data[0].id, by: "phone", candidates: [] };
    }
    if (data && data.length > 1) {
      return {
        status: "ambiguous",
        patientId: null,
        by: "phone",
        candidates: data,
        note: "multiple patients share this phone",
      };
    }
  }

  // 3. Name + DOB — low confidence; flagged for a human, never auto-attached.
  if (identity.name && identity.dob) {
    const { data } = await supabase
      .from("patients")
      .select("id, name")
      .eq("clinic_id", clinicId)
      .eq("dob", identity.dob)
      .ilike("name", identity.name.trim());
    if (data && data.length === 1) {
      return { status: "matched_low", patientId: data[0].id, by: "name_dob", candidates: data };
    }
    if (data && data.length > 1) {
      return {
        status: "ambiguous",
        patientId: null,
        by: "name_dob",
        candidates: data,
        note: "multiple patients share this name + DOB",
      };
    }
  }

  return { status: "not_found", patientId: null, by: null, candidates: [] };
}

/**
 * Create a new patient from a scanned file's identity. Requires a name plus
 * at least one identifier (ID or phone). RSA IDs are validated and the DOB
 * back-filled from the ID when absent.
 */
export async function createPatient(
  supabase: SupabaseClient,
  clinicId: string,
  identity: IngestIdentity
): Promise<{ id: string } | { error: string }> {
  const phone = normalizePhone(identity.phone);
  const hasId = !!(identity.idType && identity.idNumber);
  if (!identity.name?.trim() || (!hasId && !phone)) {
    return { error: "insufficient identity to create a patient (need name + ID or phone)" };
  }

  let dob = identity.dob ?? null;
  let idNumber = identity.idNumber ?? null;
  if (identity.idType === "rsa_id" && idNumber) {
    const v = validateSAIdNumber(idNumber);
    if (!v.valid) return { error: `invalid RSA ID: ${v.errors[0]}` };
    idNumber = idNumber.replace(/\s/g, "");
    dob = dob ?? v.dob;
  }

  const { data, error } = await supabase
    .from("patients")
    .insert({
      clinic_id: clinicId,
      name: identity.name.trim(),
      phone, // may be null (phone-nullable migration)
      dob,
      nationality: identity.nationality ?? null,
      id_type: identity.idType ?? null,
      id_number: idNumber,
    })
    .select("id")
    .single();

  if (error || !data) return { error: error?.message ?? "patient insert failed" };
  return { id: data.id };
}
