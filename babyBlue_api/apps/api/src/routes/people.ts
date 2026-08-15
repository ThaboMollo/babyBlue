// Cross-practice identity search (restructure Seam 1). Reads the GLOBAL
// `people` table via the service role — `people` carries no client RLS
// policies, so this endpoint is the controlled read surface for it.
//
// ⚠️ PROVISIONAL AUTH: gated behind staff auth for now. The consumer
// Discovery/Booking surface (Phase 4) is the real caller and will define its
// own auth + per-IP/per-phone rate limiting before this is exposed to
// unauthenticated patients. It deliberately returns MINIMAL demographics —
// never clinical data, and never the full ID number.

import { Hono } from "hono";
import { normalisePhone } from "@babyblue/core";
import { serviceClient } from "../supabase.js";
import { requireStaff } from "../middleware/auth.js";
import { badRequest } from "../http.js";
import type { AppEnv } from "../types.js";

export const peopleRoutes = new Hono<AppEnv>();

peopleRoutes.use("*", requireStaff);

// ── GET /people/search?phone=…  |  ?id_type=…&id_number=… ─────
peopleRoutes.get("/search", async (c) => {
  const db = serviceClient();
  const phone = normalisePhone(c.req.query("phone"));
  const idType = c.req.query("id_type");
  const idNumber = c.req.query("id_number");

  let query = db
    .from("people")
    .select("id, first_name, last_name, whatsapp_number, whatsapp_confirmed");

  if (phone) {
    query = query.or(`phone.eq.${phone},whatsapp_number.eq.${phone}`);
  } else if (idType && idNumber) {
    query = query.eq("id_type", idType).eq("id_number", idNumber);
  } else {
    throw badRequest("Provide a phone, or an id_type + id_number, to search.");
  }

  const { data, error } = await query.limit(10);
  if (error) throw badRequest(error.message);

  // Minimal demographics only.
  const results = (data ?? []).map((p) => ({
    id: p.id as string,
    first_name: p.first_name as string,
    last_name: p.last_name as string,
    has_whatsapp: Boolean(p.whatsapp_confirmed && p.whatsapp_number),
  }));
  return c.json({ results });
});
