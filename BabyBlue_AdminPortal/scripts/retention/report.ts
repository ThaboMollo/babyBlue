/**
 * Retention report (Phase 4).
 *
 * Lists a clinic's patients with their HPCSA retention status — which
 * records are still within the retention window vs eligible for erasure.
 * This is a REPORT ONLY: it never deletes anything. Deletion stays a
 * deliberate, guarded, per-record admin action (see deletePatientRecord).
 *
 * Usage:
 *   npx tsx scripts/retention/report.ts --clinic <slug|uuid> [--out <path>]
 */
import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { computeRetention } from "../../lib/retention";
import { loadDotEnv } from "../_env";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function main() {
  const clinicArg = arg("clinic");
  if (!clinicArg) {
    console.error("Required: --clinic <slug|uuid> [--out <path>]");
    process.exit(2);
  }

  loadDotEnv(arg("env") ?? ".env");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("Missing env: NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(2);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let clinicId = clinicArg;
  if (!UUID_RE.test(clinicArg)) {
    const { data, error } = await supabase.from("clinics").select("id").eq("slug", clinicArg).single();
    if (error || !data) {
      console.error(`Clinic not found for slug "${clinicArg}": ${error?.message ?? "no row"}`);
      process.exit(1);
    }
    clinicId = data.id;
  }

  const { data: patients, error } = await supabase
    .from("patients")
    .select("id, name, dob, record_updated_at")
    .eq("clinic_id", clinicId);
  if (error) {
    console.error(`Failed to load patients: ${error.message}`);
    process.exit(1);
  }

  const rows: {
    id: string;
    name: string;
    lastActivity: string | null;
    retainUntil: string | null;
    eligible: boolean;
    reason: string;
  }[] = [];

  for (const p of patients ?? []) {
    // Latest of last appointment, latest note, and the record touch.
    const [lastAppt, lastNote] = await Promise.all([
      supabase
        .from("appointments")
        .select("appointment_date, completed_at")
        .eq("patient_id", p.id)
        .order("appointment_date", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("visit_notes")
        .select("updated_at")
        .eq("patient_id", p.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    const candidates = [
      lastAppt.data?.completed_at ?? lastAppt.data?.appointment_date ?? null,
      lastNote.data?.updated_at ?? null,
      p.record_updated_at ?? null,
    ].filter((v): v is string => Boolean(v));
    const lastActivity = candidates.length ? candidates.sort().at(-1)! : null;

    const r = computeRetention({ dob: p.dob, lastActivity });
    rows.push({ id: p.id, name: p.name, lastActivity, retainUntil: r.retainUntil, eligible: r.eligible, reason: r.reason });
  }

  rows.sort((a, b) => Number(b.eligible) - Number(a.eligible) || (a.retainUntil ?? "").localeCompare(b.retainUntil ?? ""));

  const eligible = rows.filter((r) => r.eligible).length;
  console.log(`Retention report — clinic ${clinicId}: ${rows.length} patient(s), ${eligible} eligible for erasure.\n`);
  for (const r of rows) {
    console.log(
      `  ${(r.eligible ? "ELIGIBLE" : "retain  ").padEnd(9)} ${r.name.padEnd(24)} until ${r.retainUntil ?? "—"}  (${r.reason})`
    );
  }

  const outPath = arg("out") ?? "retention-report.json";
  writeFileSync(outPath, JSON.stringify({ clinicId, generatedAt: new Date().toISOString(), eligible, rows }, null, 2));
  console.log(`\nReport written to ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
