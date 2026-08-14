import type { StaffContext } from "./middleware/auth.js";

/** Hono generics shared across the app so `c.get("staff")` is typed. */
export interface AppEnv {
  Variables: {
    staff: StaffContext;
  };
}
