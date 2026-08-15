// Client for the BabyBlue API — the single write path (spec §7.3). The admin
// portal no longer writes to Supabase for Visit/clinical operations or holds a
// service-role key; it calls the API with the staff member's Supabase access
// token, which the API validates and acts under (RLS-scoped).
//
// Token-agnostic on purpose: the caller supplies the access token, since a
// client component reads it from the browser Supabase client and a server
// action reads it from the server one — this file stays importable by both.

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = "ApiError";
  }
}

export async function callApi<T = unknown>(
  path: string,
  opts: { token: string; method?: string; body?: unknown }
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: opts.method ?? "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.token}`,
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(data?.error ?? `Request failed (${res.status})`, res.status);
  }
  return data as T;
}
