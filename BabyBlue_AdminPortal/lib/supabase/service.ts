// ============================================================
// Service-role Supabase client — ⚠️ BYPASSES Row-Level Security.
//
// This client authenticates with SUPABASE_SERVICE_ROLE_KEY and can read
// and write EVERY clinic's data. It exists only for the few privileged
// server operations that RLS cannot express:
//   - signDocumentUrl()      → mint short-TTL signed URLs + log the view
//   - exportPatientRecord()  → assemble a data-subject export
//   - ingest-document        → digitisation on-ramp
//
// RULES:
//   1. Import ONLY from server code (server actions, route handlers,
//      server components). NEVER from a Client Component or shared lib
//      that a client bundle can reach.
//   2. Because RLS is bypassed, every caller MUST re-verify role + tenant
//      itself (check auth_role() / clinic_id) before acting. The database
//      will not stop a cross-tenant mistake here.
//
// Recommended hardening: `npm i server-only` and add `import "server-only"`
// at the top of this file for a *build-time* guarantee it never ships to
// the browser. Until then we enforce it at runtime below.
// ============================================================

import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

if (typeof window !== "undefined") {
  throw new Error(
    "lib/supabase/service.ts was imported in the browser. The service-role key must never reach the client."
  );
}

let cached: SupabaseClient | null = null;

/**
 * Returns a memoised service-role client. Throws if the required env vars
 * are absent so a misconfiguration fails loudly rather than silently
 * falling back to anon access.
 */
export function createServiceClient(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Service client unavailable: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  cached = createSupabaseClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return cached;
}
