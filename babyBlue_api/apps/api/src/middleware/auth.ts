// Staff authentication for /v1/admin/* routes.
//
// The caller sends `Authorization: Bearer <supabase access token>` (the same
// session the admin portal already holds). We verify it, load the profile to
// resolve clinic_id + role, and stash a per-request StaffContext. Handlers
// then use `ctx.db` (a user-scoped, RLS-enforced client) for reads/audited
// writes, and reach for the service client only where RLS can't express the
// operation (signing storage URLs, guarded delete) — re-checking role/tenant.

import type { Context, MiddlewareHandler } from "hono";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserRole } from "@babyblue/core";
import { userClient } from "../supabase.js";
import { ApiError, forbidden } from "../http.js";

export interface StaffContext {
  userId: string;
  clinicId: string;
  role: UserRole;
  /** RLS-enforced client acting as this staff user. */
  db: SupabaseClient;
}

const KEY = "staff";

export const requireStaff: MiddlewareHandler = async (c, next) => {
  const header = c.req.header("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) throw new ApiError(401, "Not authenticated.");

  const db = userClient(token);
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user) throw new ApiError(401, "Not authenticated.");

  const { data: profile } = await db
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();
  if (!profile) throw forbidden("No clinic profile.");

  const staff: StaffContext = {
    userId: user.id,
    clinicId: profile.clinic_id as string,
    role: profile.role as UserRole,
    db,
  };
  c.set(KEY, staff);
  await next();
};

/** Read the authenticated staff context set by `requireStaff`. */
export function staff(c: Context): StaffContext {
  const s = c.get(KEY) as StaffContext | undefined;
  if (!s) throw new ApiError(401, "Not authenticated.");
  return s;
}

/** Guard: the caller's role must be one of `roles`, else 403. */
export function requireRole(c: Context, ...roles: UserRole[]): StaffContext {
  const s = staff(c);
  if (!roles.includes(s.role)) {
    throw forbidden(`This action requires role: ${roles.join(" or ")}.`);
  }
  return s;
}
