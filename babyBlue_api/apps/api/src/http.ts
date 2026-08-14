// Shared HTTP helpers. Handlers throw `ApiError` for expected failures;
// the error handler renders them as `{ error }` with the right status —
// exactly the shape the apps' `lib/api.ts` already parses.

import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";

export class ApiError extends HTTPException {
  constructor(status: number, message: string) {
    super(status as never, {
      res: new Response(JSON.stringify({ error: message }), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
    });
  }
}

export const badRequest = (m: string) => new ApiError(400, m);
export const forbidden = (m = "Forbidden") => new ApiError(403, m);
export const notFound = (m = "Not found") => new ApiError(404, m);
export const conflict = (m: string) => new ApiError(409, m);
export const tooMany = (m = "Too many requests. Please try again later.") =>
  new ApiError(429, m);
export const serverError = (m = "Internal error") => new ApiError(500, m);

/** Parse + shallow-validate a JSON body, or 400. */
export async function readJson<T = Record<string, unknown>>(c: Context): Promise<T> {
  try {
    return (await c.req.json()) as T;
  } catch {
    throw badRequest("Invalid JSON body");
  }
}
