// Global patient identity (restructure Seam 1) — resolve-or-create against
// the `people` table. `people` has no client RLS policies, so this MUST run
// on the service-role client; every caller already re-checks tenant/role.
//
// Matching precedence (see @babyblue/core personMatchKeys): confirmed
// WhatsApp → phone → national ID. A number is matched against EITHER the
// phone or whatsapp_number column, so a person who booked with a WhatsApp
// number and later walked in with the same number as a plain phone (or vice
// versa) resolves to one identity.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  personMatchKeys,
  resolvePersonNumbers,
  normaliseIdNumber,
  type PersonIdentityInput,
} from "@babyblue/core";

export interface PersonUpsertInput extends PersonIdentityInput {
  firstName: string;
  lastName: string;
  dob?: string | null;
  nationality?: string | null;
  email?: string | null;
}

interface FoundPerson {
  id: string;
  whatsapp_number: string | null;
  whatsapp_confirmed: boolean;
  dob: string | null;
}

/**
 * Resolve-or-create the global `people` identity and return its id. Enriches
 * an existing row with a newly-confirmed WhatsApp number and a backfilled DOB,
 * but never overwrites data that is already there.
 */
export async function resolveOrCreatePerson(
  db: SupabaseClient,
  input: PersonUpsertInput
): Promise<string> {
  const keys = personMatchKeys(input);
  const numbers = resolvePersonNumbers(input);

  let found: FoundPerson | null = null;
  for (const key of keys) {
    let q = db
      .from("people")
      .select("id, whatsapp_number, whatsapp_confirmed, dob");
    if (key.by === "number") {
      // Match the number against either contact column.
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
    if (
      numbers.whatsapp_confirmed &&
      !found.whatsapp_confirmed &&
      numbers.whatsapp_number
    ) {
      patch.whatsapp_number = numbers.whatsapp_number;
      patch.whatsapp_confirmed = true;
    }
    if (input.dob && !found.dob) patch.dob = input.dob;
    if (Object.keys(patch).length > 0) {
      await db.from("people").update(patch).eq("id", found.id);
    }
    return found.id;
  }

  const idNumber =
    input.idType && input.idNumber
      ? normaliseIdNumber(input.idType, input.idNumber)
      : null;

  const { data: created, error } = await db
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
    .single<{ id: string }>();
  if (error || !created) {
    throw new Error(`Failed to create person: ${error?.message ?? "unknown"}`);
  }
  return created.id;
}

/**
 * Best-effort split of a single "name" field into first/last, for the legacy
 * join form that hasn't moved to separate fields yet. First token is the
 * first name; the remainder is the last name (empty if only one token).
 */
export function splitName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/);
  const firstName = parts.shift() ?? "";
  return { firstName, lastName: parts.join(" ") };
}
