// Supabase client factories. Three trust levels:
//
//   serviceClient()          — service-role, BYPASSES RLS. For privileged
//                              patient-tier ops (the old edge-function role)
//                              and for signed-URL / delete flows. Every
//                              caller MUST re-check tenant + role itself.
//   userClient(accessToken)  — anon key + the caller's JWT. RLS applies as
//                              that user; the safe default for staff reads
//                              and audited writes.
//
// The service-role key lives ONLY in this process (never in a browser).

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getEnv } from "./env.js";

let serviceSingleton: SupabaseClient | null = null;

/** Memoised service-role client. ⚠️ Bypasses Row-Level Security. */
export function serviceClient(): SupabaseClient {
  if (serviceSingleton) return serviceSingleton;
  const env = getEnv();
  serviceSingleton = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return serviceSingleton;
}

/**
 * A client that acts as the authenticated caller: anon key + their access
 * token in the Authorization header, so Postgres RLS sees `auth.uid()` and
 * every policy applies. Not memoised — one per request/token.
 */
export function userClient(accessToken: string): SupabaseClient {
  const env = getEnv();
  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}
