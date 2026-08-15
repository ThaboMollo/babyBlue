// Global patient identity (restructure Seam 1) for the admin portal.
// `people` has NO client RLS policies, so resolve-or-create MUST run on the
// service-role client from a server action. Self-contained (mirrors
// @babyblue/core) because the standalone admin portal doesn't yet share the
// monorepo module graph.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { IdType } from "@/types";

export function normalisePhone(
  raw: string | null | undefined,
  defaultCc = "27"
): string | null {
  if (raw === null || raw === undefined) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;
  if (hasPlus) return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  if (digits.startsWith("0") && digits.length === 10) return `+${defaultCc}${digits.slice(1)}`;
  if (digits.startsWith(defaultCc) && digits.length === defaultCc.length + 9) return `+${digits}`;
  if (digits.length === 9) return `+${defaultCc}${digits}`;
  if (digits.length >= 10 && digits.length <= 15) return `+${digits}`;
  return null;
}

function normaliseIdNumber(idType: IdType, raw: string): string {
  const trimmed = (raw ?? "").trim();
  if (idType === "rsa_id") return trimmed.replace(/\s/g, "");
  return trimmed.replace(/[\s-]/g, "").toUpperCase();
}

export interface PersonInput {
  firstName: string;
  lastName: string;
  phone?: string | null;
  phoneIsWhatsapp?: boolean;
  whatsappNumber?: string | null;
  idType?: IdType | null;
  idNumber?: string | null;
  nationality?: string | null;
  dob?: string | null;
  email?: string | null;
}

function resolvePersonNumbers(input: PersonInput) {
  const phone = normalisePhone(input.phone ?? null);
  const explicitWa = normalisePhone(input.whatsappNumber ?? null);
  if (input.phoneIsWhatsapp && phone) {
    return { phone, whatsapp_number: phone, whatsapp_confirmed: true };
  }
  if (explicitWa) return { phone, whatsapp_number: explicitWa, whatsapp_confirmed: true };
  return { phone, whatsapp_number: null, whatsapp_confirmed: false };
}

type MatchKey =
  | { by: "number"; value: string }
  | { by: "id"; idType: IdType; idNumber: string };

function personMatchKeys(input: PersonInput): MatchKey[] {
  const keys: MatchKey[] = [];
  const seen = new Set<string>();
  const pushNumber = (raw?: string | null) => {
    const n = normalisePhone(raw);
    if (n && !seen.has(n)) {
      seen.add(n);
      keys.push({ by: "number", value: n });
    }
  };
  if (input.phoneIsWhatsapp) pushNumber(input.phone);
  pushNumber(input.whatsappNumber);
  pushNumber(input.phone);
  if (input.idType && input.idNumber) {
    keys.push({ by: "id", idType: input.idType, idNumber: normaliseIdNumber(input.idType, input.idNumber) });
  }
  return keys;
}

interface FoundPerson {
  id: string;
  whatsapp_number: string | null;
  whatsapp_confirmed: boolean;
  dob: string | null;
}

/** Resolve-or-create the global `people` identity; returns its id. Service-role only. */
export async function resolveOrCreatePerson(
  service: SupabaseClient,
  input: PersonInput
): Promise<string> {
  const keys = personMatchKeys(input);
  const numbers = resolvePersonNumbers(input);

  let found: FoundPerson | null = null;
  for (const key of keys) {
    let q = service.from("people").select("id, whatsapp_number, whatsapp_confirmed, dob");
    if (key.by === "number") {
      q = q.or(`phone.eq.${key.value},whatsapp_number.eq.${key.value}`);
    } else {
      q = q.eq("id_type", key.idType).eq("id_number", key.idNumber);
    }
    const { data } = await q.limit(1).maybeSingle<FoundPerson>();
    if (data) {
      found = data;
      break;
    }
  }

  if (found) {
    const patch: Record<string, unknown> = {};
    if (numbers.whatsapp_confirmed && !found.whatsapp_confirmed && numbers.whatsapp_number) {
      patch.whatsapp_number = numbers.whatsapp_number;
      patch.whatsapp_confirmed = true;
    }
    if (input.dob && !found.dob) patch.dob = input.dob;
    if (Object.keys(patch).length) await service.from("people").update(patch).eq("id", found.id);
    return found.id;
  }

  const idNumber =
    input.idType && input.idNumber ? normaliseIdNumber(input.idType, input.idNumber) : null;

  const { data: created, error } = await service
    .from("people")
    .insert({
      first_name: input.firstName,
      last_name: input.lastName,
      phone: numbers.phone,
      whatsapp_number: numbers.whatsapp_number,
      whatsapp_confirmed: numbers.whatsapp_confirmed,
      id_type: input.idType ?? null,
      id_number: idNumber,
      dob: input.dob ?? null,
      nationality: input.nationality ?? null,
      email: input.email ?? null,
    })
    .select("id")
    .single();
  if (error || !created) throw new Error(`Failed to create person: ${error?.message ?? "unknown"}`);
  return created.id as string;
}
