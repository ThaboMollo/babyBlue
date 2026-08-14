/**
 * Digitisation ingest runner (Phase 3).
 *
 * Reads a manifest describing scanned files + the identity the OCR/index
 * step extracted, then matches → uploads → inserts each into the patient
 * record, writing a QA report for the reviewer.
 *
 * Usage (service-role key required):
 *   npx tsx scripts/ingest/run.ts \
 *     --clinic <slug|uuid> --manifest ./scans/manifest.json --files ./scans [--dry-run] [--no-create]
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) + SUPABASE_SERVICE_ROLE_KEY,
 * read from the process env or an .env file in the project root (auto-loaded).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { ingestDocument, type IngestEntry, type IngestResult } from "./ingestDocument";
import type { IngestIdentity } from "./matchPatient";
import { loadDotEnv } from "../_env";

interface ManifestEntry {
  file: string;
  name: string;
  nationality?: string;
  id_type?: "rsa_id" | "passport" | "asylum";
  id_number?: string;
  phone?: string;
  dob?: string;
  original_date?: string;
  doc_type?: string;
  ocr_text?: string;
}

const MIME_BY_EXT: Record<string, string> = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".tif": "image/tiff",
  ".tiff": "image/tiff",
  ".webp": "image/webp",
};

function detectMime(fileName: string): string {
  return MIME_BY_EXT[extname(fileName).toLowerCase()] ?? "application/octet-stream";
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function main() {
  const clinicArg = arg("clinic");
  const manifestPath = arg("manifest");
  if (!clinicArg || !manifestPath) {
    console.error("Required: --clinic <slug|uuid> --manifest <path> [--files <dir>] [--dry-run] [--no-create] [--out <path>]");
    process.exit(2);
  }

  loadDotEnv(arg("env") ?? ".env");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("Missing env: set NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(2);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Resolve clinic id.
  let clinicId = clinicArg;
  if (!UUID_RE.test(clinicArg)) {
    const { data, error } = await supabase
      .from("clinics")
      .select("id")
      .eq("slug", clinicArg)
      .single();
    if (error || !data) {
      console.error(`Clinic not found for slug "${clinicArg}": ${error?.message ?? "no row"}`);
      process.exit(1);
    }
    clinicId = data.id;
  }

  const filesDir = arg("files") ?? dirname(manifestPath);
  const dryRun = flag("dry-run");
  const autoCreate = !flag("no-create");

  const raw = JSON.parse(readFileSync(manifestPath, "utf8"));
  const entries: ManifestEntry[] = Array.isArray(raw) ? raw : raw.entries;
  if (!Array.isArray(entries)) {
    console.error("Manifest must be an array of entries, or { entries: [...] }.");
    process.exit(2);
  }

  console.log(
    `Ingesting ${entries.length} file(s) into clinic ${clinicId}` +
      `${dryRun ? " [dry-run]" : ""}${autoCreate ? "" : " [no-create]"}\n`
  );

  const report: (IngestResult & { file: string; name: string })[] = [];
  const counts: Record<string, number> = {};

  for (const m of entries) {
    const identity: IngestIdentity = {
      name: m.name,
      nationality: m.nationality ?? null,
      idType: m.id_type ?? null,
      idNumber: m.id_number ?? null,
      phone: m.phone ?? null,
      dob: m.dob ?? null,
    };

    let result: IngestResult;
    try {
      const bytes = readFileSync(join(filesDir, m.file));
      const entry: IngestEntry = {
        identity,
        fileName: basename(m.file),
        bytes,
        mimeType: detectMime(m.file),
        docType: m.doc_type,
        originalDate: m.original_date ?? null,
        ocrText: m.ocr_text ?? null,
      };
      result = await ingestDocument(supabase, clinicId, entry, { dryRun, autoCreate });
    } catch (err) {
      result = {
        status: "error",
        patientId: null,
        storagePath: null,
        matchBy: null,
        message: err instanceof Error ? err.message : String(err),
      };
    }

    counts[result.status] = (counts[result.status] ?? 0) + 1;
    report.push({ ...result, file: m.file, name: m.name });
    console.log(`  ${result.status.padEnd(22)} ${m.file}${result.message ? ` — ${result.message}` : ""}`);
  }

  const outPath = arg("out") ?? join(dirname(manifestPath), "ingest-report.json");
  writeFileSync(outPath, JSON.stringify({ clinicId, dryRun, counts, results: report }, null, 2));

  console.log("\nSummary:");
  for (const [status, n] of Object.entries(counts)) console.log(`  ${status}: ${n}`);
  console.log(`\nReport written to ${outPath}`);

  // Non-zero exit only on hard errors; reviews/skips are expected outcomes.
  process.exit((counts.error ?? 0) > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
