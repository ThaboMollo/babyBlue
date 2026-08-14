import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { matchPatient, createPatient, type IngestIdentity } from "./matchPatient";

const BUCKET = "patient-documents";

export interface IngestEntry {
  identity: IngestIdentity;
  fileName: string;
  bytes: Uint8Array;
  mimeType: string;
  docType?: string; // default 'historical_file'
  originalDate?: string | null;
  ocrText?: string | null;
}

export type IngestStatus =
  | "ingested_matched" // attached to an ID/phone-matched patient
  | "ingested_created" // attached to a newly created patient
  | "review_low_confidence" // name+dob single match — needs human confirm, NOT attached
  | "review_ambiguous" // multiple candidates — NOT attached
  | "skipped_duplicate" // same file already ingested for this patient
  | "skipped_insufficient" // no match and not enough to create
  | "error";

export interface IngestResult {
  status: IngestStatus;
  patientId: string | null;
  storagePath: string | null;
  matchBy: string | null;
  candidates?: { id: string; name: string }[];
  message?: string;
}

export interface IngestOptions {
  dryRun?: boolean; // match only; no upload/insert
  autoCreate?: boolean; // create a patient when no match (default true)
}

/**
 * Ingest one scanned document: resolve the patient, upload the file to the
 * private bucket, and insert its patient_documents row.
 *
 * Only high-confidence resolutions are attached automatically:
 *   - matched by ID or unique phone  → attached
 *   - created (new patient)          → attached
 *   - name+dob single match          → held for review (never silently merged)
 *   - ambiguous / insufficient       → held for review
 */
export async function ingestDocument(
  supabase: SupabaseClient,
  clinicId: string,
  entry: IngestEntry,
  opts: IngestOptions = {}
): Promise<IngestResult> {
  const autoCreate = opts.autoCreate !== false;
  const match = await matchPatient(supabase, clinicId, entry.identity);

  if (match.status === "ambiguous") {
    return {
      status: "review_ambiguous",
      patientId: null,
      storagePath: null,
      matchBy: match.by,
      candidates: match.candidates,
      message: match.note,
    };
  }

  if (match.status === "matched_low") {
    return {
      status: "review_low_confidence",
      patientId: match.patientId,
      storagePath: null,
      matchBy: match.by,
      candidates: match.candidates,
      message: "name+dob match — confirm before attaching",
    };
  }

  let patientId = match.patientId;
  let matchBy: string | null = match.by;
  let createdNew = false;

  if (!patientId) {
    if (!autoCreate) {
      return {
        status: "skipped_insufficient",
        patientId: null,
        storagePath: null,
        matchBy: null,
        message: "no match; auto-create disabled",
      };
    }
    const created = await createPatient(supabase, clinicId, entry.identity);
    if ("error" in created) {
      return {
        status: "skipped_insufficient",
        patientId: null,
        storagePath: null,
        matchBy: null,
        message: created.error,
      };
    }
    patientId = created.id;
    matchBy = "created";
    createdNew = true;
  }

  const okStatus: IngestStatus = createdNew ? "ingested_created" : "ingested_matched";

  if (opts.dryRun) {
    return { status: okStatus, patientId, storagePath: null, matchBy, message: "dry-run" };
  }

  // Idempotency: don't re-ingest the same file for the same patient.
  const { data: dup } = await supabase
    .from("patient_documents")
    .select("id")
    .eq("patient_id", patientId)
    .eq("file_name", entry.fileName)
    .eq("source", "digitised")
    .maybeSingle();
  if (dup) {
    return {
      status: "skipped_duplicate",
      patientId,
      storagePath: null,
      matchBy,
      message: "already ingested",
    };
  }

  const safeName = entry.fileName.replace(/[^\w.\-]/g, "_");
  const storagePath = `${clinicId}/${patientId}/${randomUUID()}-${safeName}`;

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, entry.bytes, { contentType: entry.mimeType, upsert: false });
  if (upErr) {
    return { status: "error", patientId, storagePath: null, matchBy, message: upErr.message };
  }

  const { error: insErr } = await supabase.from("patient_documents").insert({
    clinic_id: clinicId,
    patient_id: patientId,
    storage_path: storagePath,
    file_name: entry.fileName,
    mime_type: entry.mimeType,
    doc_type: entry.docType ?? "historical_file",
    source: "digitised",
    original_date: entry.originalDate ?? null,
    ocr_text: entry.ocrText ?? null,
  });
  if (insErr) {
    // Roll back the uploaded object so a failed insert doesn't orphan a file.
    await supabase.storage.from(BUCKET).remove([storagePath]);
    return { status: "error", patientId, storagePath: null, matchBy, message: insErr.message };
  }

  return { status: okStatus, patientId, storagePath, matchBy };
}
