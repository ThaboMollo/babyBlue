# Digitisation ingest (Phase 3)

Operator-run tool that lands a practice's scanned paper files into the Patient
File. It's the acquisition on-ramp from `SystemOfRecordSpec.md` §7:

```
Paper files → Scan → OCR → Structure/index → Ingest (this tool) → QA
```

This tool covers **Ingest**. Scanning + OCR + indexing happen upstream and
produce the **manifest** below (one entry per scanned file, carrying whatever
identity the OCR/index step extracted).

## What it does per file

1. **Match** to an existing patient — ID number → unique phone → name+dob.
2. Otherwise **create** the patient (needs a name + ID or phone).
3. **Upload** the file to the private `patient-documents` bucket at
   `clinic_id/patient_id/<uuid>-<filename>`.
4. **Insert** a `patient_documents` row (`source='digitised'`,
   `doc_type='historical_file'` by default, plus `original_date`, `ocr_text`).
5. Everything is written to a **QA report** (`ingest-report.json`).

**Only high-confidence resolutions are attached automatically** (matched by ID
or unique phone, or a newly created patient). A single name+dob match or any
ambiguous/insufficient case is **held for review — never silently merged.**

## Prerequisites

- Migrations applied, including `20260810120000_patients_phone_nullable.sql`
  (ID-only scanned patients have no phone).
- Env: `NEXT_PUBLIC_SUPABASE_URL` (or `SUPABASE_URL`) + `SUPABASE_SERVICE_ROLE_KEY`.
  Read from the process env or a project-root `.env` (auto-loaded).

> ⚠️ Uses the **service-role key** and bypasses RLS. Run it only in a trusted
> environment. Consent (`records_storage`) should be captured for the practice
> before go-live; ingest does not itself check per-patient consent.

## Manifest

A JSON array (or `{ "entries": [...] }`). One object per scanned file:

```json
[
  {
    "file": "smith-john.pdf",
    "name": "John Smith",
    "nationality": "South Africa",
    "id_type": "rsa_id",
    "id_number": "9005145000084",
    "phone": "0821234567",
    "dob": "1990-05-14",
    "original_date": "2019-03-02",
    "doc_type": "historical_file",
    "ocr_text": "…full OCR text for search…"
  }
]
```

| Field | Required | Notes |
|---|---|---|
| `file` | ✅ | Path relative to `--files` dir |
| `name` | ✅ | Used for matching + patient creation |
| `id_type` / `id_number` | — | Best match key; RSA IDs are Luhn-validated |
| `phone` | — | Fallback match key (normalised) |
| `dob` | — | ISO; RSA `dob` is derived from the ID if omitted |
| `nationality` | — | Stored on new patients |
| `original_date` | — | Date on the paper document |
| `doc_type` | — | Defaults to `historical_file` |
| `ocr_text` | — | Stored for search |

## Run

```bash
# Dry run first — matches only, no uploads/inserts, writes the report:
npx tsx scripts/ingest/run.ts --clinic <slug|uuid> \
  --manifest ./scans/manifest.json --files ./scans --dry-run

# Live:
npx tsx scripts/ingest/run.ts --clinic <slug|uuid> \
  --manifest ./scans/manifest.json --files ./scans
```

Flags: `--dry-run` (no writes), `--no-create` (never create patients — match
only), `--out <path>` (report location), `--env <path>` (env file).

## Result statuses (in the report)

| Status | Meaning |
|---|---|
| `ingested_matched` | Attached to an ID/phone-matched patient |
| `ingested_created` | Attached to a newly created patient |
| `review_low_confidence` | name+dob single match — confirm before attaching |
| `review_ambiguous` | Multiple candidates — resolve manually |
| `skipped_duplicate` | Same file already ingested for this patient |
| `skipped_insufficient` | No match and not enough to create |
| `error` | Upload/insert failed (file rolled back) |

Re-running is safe: already-ingested files are skipped as `skipped_duplicate`.
