// Environment loading + validation. Fail loudly at boot rather than
// silently mis-authenticating later.

export interface Env {
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  allowedOrigins: string[];
  port: number;
}

function required(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v.trim();
}

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  cached = {
    supabaseUrl: required("SUPABASE_URL"),
    supabaseAnonKey: required("SUPABASE_ANON_KEY"),
    supabaseServiceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
    allowedOrigins: (process.env.ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    port: Number(process.env.PORT ?? 8787),
  };
  return cached;
}
