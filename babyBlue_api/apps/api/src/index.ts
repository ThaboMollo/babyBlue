// Node entry point. Loads .env, then serves the Hono app.
import { serve } from "@hono/node-server";
import { getEnv } from "./env.js";
import { createApp } from "./app.js";

const env = getEnv();
const app = createApp();

serve({ fetch: app.fetch, port: env.port }, (info) => {
  console.log(`babyblue-api listening on http://localhost:${info.port}`);
});
