// Hono app factory. Framework-agnostic of the runtime: the same app is
// served by the Node entry (src/index.ts) and can be adapted to Vercel.

import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { getEnv } from "./env.js";
import { patientRoutes } from "./routes/patient.js";
import { adminRoutes } from "./routes/admin.js";
import type { AppEnv } from "./types.js";

export function createApp() {
  const env = getEnv();
  const app = new Hono<AppEnv>();

  app.use(
    "*",
    cors({
      origin: (origin) =>
        env.allowedOrigins.length === 0 || env.allowedOrigins.includes(origin)
          ? origin
          : env.allowedOrigins[0] ?? "",
      allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"],
    })
  );

  app.get("/health", (c) => c.json({ ok: true, service: "babyblue-api" }));

  app.route("/v1/patient", patientRoutes);
  app.route("/v1/admin", adminRoutes);

  // Uniform error rendering. ApiError/HTTPException carry their own JSON
  // response; anything else is an unexpected 500 (logged, not leaked).
  app.onError((err, c) => {
    if (err instanceof HTTPException) return err.getResponse();
    console.error("[api] unhandled error:", err);
    return c.json({ error: "Internal error" }, 500);
  });

  app.notFound((c) => c.json({ error: "Not found" }, 404));

  return app;
}
