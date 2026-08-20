// Vercel serverless entry for the BabyBlue API.
//
// Local dev still uses apps/api/src/index.ts (@hono/node-server `serve()`).
// On Vercel this file is the function: the same Hono app, wrapped with the
// Web-standard `hono/vercel` adapter. `vercel.json` rewrites every path to
// this function, so the app matches on the original pathname (/health, /v1/*).

import { handle } from "hono/vercel";
import { createApp } from "@babyblue/api/app";

// Runs on Vercel's Node runtime (the default for functions in `api/`) — the app
// uses the Supabase service-role client and node:crypto, so it can't be Edge.

const app = createApp();

export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const DELETE = handle(app);
export const PATCH = handle(app);
export const OPTIONS = handle(app);
