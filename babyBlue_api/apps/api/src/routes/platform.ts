// Platform-tier (Super Admin) endpoints. All gated by requirePlatformAdmin and
// served with the service role: a platform admin has no clinic scope, so RLS
// can't serve cross-clinic reads/writes. This is the clinic approval console's
// backend.

import { Hono, type Context } from "hono";
import { serviceClient } from "../supabase.js";
import { requirePlatformAdmin } from "../middleware/auth.js";
import { badRequest, notFound, serverError } from "../http.js";
import type { AppEnv } from "../types.js";

export const platformRoutes = new Hono<AppEnv>();

platformRoutes.use("*", requirePlatformAdmin);

// ── GET /clinics ─────────────────────────────────────────────
// Every clinic with its status and its admin (first/last + email), newest first.
platformRoutes.get("/clinics", async (c) => {
  const db = serviceClient();
  const { data: clinics, error } = await db
    .from("clinics")
    .select("id, name, slug, city, suburb, status, booking_mode, created_at")
    .order("created_at", { ascending: false });
  if (error) throw serverError(error.message);

  // Attach each clinic's admin profile (role='admin') + auth email.
  const ids = (clinics ?? []).map((c) => c.id as string);
  const { data: admins } = await db
    .from("profiles")
    .select("clinic_id, first_name, last_name, id")
    .in("clinic_id", ids)
    .eq("role", "admin");

  const emailById = new Map<string, string>();
  for (const a of admins ?? []) {
    const { data: u } = await db.auth.admin.getUserById(a.id as string);
    if (u?.user?.email) emailById.set(a.id as string, u.user.email);
  }
  const adminByClinic = new Map<string, { name: string; email: string | null }>();
  for (const a of admins ?? []) {
    adminByClinic.set(a.clinic_id as string, {
      name: `${a.first_name ?? ""} ${a.last_name ?? ""}`.trim(),
      email: emailById.get(a.id as string) ?? null,
    });
  }

  return c.json({
    clinics: (clinics ?? []).map((cl) => ({
      ...cl,
      admin: adminByClinic.get(cl.id as string) ?? null,
    })),
  });
});

// ── POST /clinics/:id/approve ────────────────────────────────
platformRoutes.post("/clinics/:id/approve", async (c) => {
  return setStatus(c.req.param("id"), "active", c);
});

// ── POST /clinics/:id/suspend ────────────────────────────────
platformRoutes.post("/clinics/:id/suspend", async (c) => {
  return setStatus(c.req.param("id"), "suspended", c);
});

async function setStatus(
  clinicId: string,
  status: "active" | "suspended",
  c: Context<AppEnv>
) {
  if (!clinicId) throw badRequest("A clinic id is required.");
  const db = serviceClient();
  const { data, error } = await db
    .from("clinics")
    .update({ status })
    .eq("id", clinicId)
    .select("id, status")
    .maybeSingle();
  if (error) throw serverError(error.message);
  if (!data) throw notFound("Clinic not found.");
  return c.json({ ok: true, status: data.status });
}
