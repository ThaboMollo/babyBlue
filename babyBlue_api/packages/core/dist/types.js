// ============================================================
// Canonical BabyBlue domain types — the superset of what the patient app
// and the admin portal each used to declare separately. Both apps and the
// HTTP API import these so a schema change is made in exactly one place.
//
// NOTE: a fully-generated Supabase `Database` type belongs here too
// (via `supabase gen types typescript`), but is intentionally left to the
// data layer for now — route handlers cast rows to the interfaces below,
// mirroring the existing `.returns<T>()` / `as Patient` usage.
// ============================================================
export {};
//# sourceMappingURL=types.js.map