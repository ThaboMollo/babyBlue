"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronDown,
  FileText,
  ShieldCheck,
  ShieldAlert,
  ExternalLink,
  Check,
  Loader2,
  Download,
  Trash2,
} from "lucide-react";
import StatusBadge from "@/components/StatusBadge";
import {
  signDocumentUrl,
  captureRecordsConsent,
  revokeRecordsConsent,
  saveVisitNote,
  exportPatientRecord,
  deletePatientRecord,
} from "./actions";
import type {
  Patient,
  UserRole,
  TimelineVisit,
  PatientDocument,
  PatientConsent,
  ConsentMethod,
  IdType,
  DocType,
} from "@/types";

interface Props {
  patient: Patient;
  role: UserRole;
  timeline: TimelineVisit[];
  documents: PatientDocument[];
  consent: PatientConsent | null;
  hasActiveConsent: boolean;
}

const ID_TYPE_LABEL: Record<IdType, string> = {
  rsa_id: "RSA ID",
  passport: "Passport",
  asylum: "Asylum / permit",
};

const DOC_TYPE_LABEL: Record<DocType, string> = {
  historical_file: "Historical file",
  referral: "Referral",
  lab_result: "Lab result",
  id_document: "ID document",
  other: "Document",
};

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("en-ZA") : "—";
const fmtDateTime = (d?: string | null) =>
  d ? new Date(d).toLocaleString("en-ZA") : "—";

export default function PatientFileClient({
  patient,
  role,
  timeline,
  documents,
  consent,
  hasActiveConsent,
}: Props) {
  const router = useRouter();
  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/patients"
        className="inline-flex items-center gap-1.5 text-sm text-[#475569] hover:text-[#0F172A] transition-colors w-fit"
      >
        <ArrowLeft size={16} /> Back to patients
      </Link>

      <Header patient={patient} hasActiveConsent={hasActiveConsent} consent={consent} />

      <ConsentSection
        patientId={patient.id}
        role={role}
        hasActiveConsent={hasActiveConsent}
        onChanged={() => router.refresh()}
      />

      <ClinicalSummary patient={patient} />

      <Documents documents={documents} />

      <Timeline timeline={timeline} role={role} hasActiveConsent={hasActiveConsent} />

      {role === "admin" && <AdminActions patient={patient} />}
    </div>
  );
}

function AdminActions({ patient }: { patient: Patient }) {
  const router = useRouter();
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDelete, setShowDelete] = useState(false);

  async function handleExport() {
    setError(null);
    setExporting(true);
    const res = await exportPatientRecord(patient.id);
    setExporting(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    const blob = new Blob([JSON.stringify(res.record, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `patient-record-${patient.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="bg-white rounded-xl border border-[#E2E8F0] p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-[#475569] mb-1">
        Data-subject rights
      </h2>
      <p className="text-xs text-[#94A3B8] mb-4">
        Export the full record (POPIA access) or erase it (subject to HPCSA retention).
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleExport}
          disabled={exporting}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm font-medium text-[#0B5AA8] hover:bg-[#F7FAFC] transition-colors disabled:opacity-50"
        >
          <Download size={15} />
          {exporting ? "Exporting…" : "Export record"}
        </button>
        <button
          onClick={() => setShowDelete(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-[#EF4444] hover:bg-red-50 transition-colors"
        >
          <Trash2 size={15} />
          Delete record
        </button>
      </div>
      {error && <p className="text-xs text-[#EF4444] mt-3">{error}</p>}

      {showDelete && (
        <DeleteModal
          patient={patient}
          onClose={() => setShowDelete(false)}
          onDeleted={() => router.push("/patients")}
        />
      )}
    </section>
  );
}

function DeleteModal({
  patient,
  onClose,
  onDeleted,
}: {
  patient: Patient;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [confirmName, setConfirmName] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setBusy(true);
    setError(null);
    const res = await deletePatientRecord(patient.id, { confirmName, reason });
    if ("error" in res) {
      setBusy(false);
      setError(res.error);
      return;
    }
    onDeleted();
  }

  const canDelete = !busy && confirmName.trim() === patient.name.trim() && reason.trim().length > 0;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-[#E2E8F0]">
          <h3 className="text-lg font-bold text-[#EF4444]">Delete patient record</h3>
        </div>
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-[#475569]">
            This permanently erases <strong>{patient.name}</strong>&apos;s record — visits,
            notes, documents, and consent. It cannot be undone, and is refused if the record
            is still within its HPCSA retention window.
          </p>
          <div>
            <label className="block text-sm font-medium text-[#0F172A] mb-1">
              Type the patient&apos;s name to confirm
            </label>
            <input
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={patient.name}
              className="w-full px-3 py-2.5 rounded-lg border border-[#E2E8F0] text-sm focus:outline-none focus:ring-2 focus:ring-[#EF4444]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#0F172A] mb-1">Reason</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="e.g. Patient erasure request dated…"
              className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-sm focus:outline-none focus:ring-2 focus:ring-[#EF4444] resize-y"
            />
          </div>
          {error && <p className="text-sm text-[#EF4444] bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-[#E2E8F0] rounded-lg text-sm font-medium text-[#475569] hover:bg-[#F7FAFC] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={!canDelete}
              className="flex-1 bg-[#EF4444] hover:bg-red-700 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50 text-sm"
            >
              {busy ? "Deleting…" : "Delete permanently"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Header({
  patient,
  hasActiveConsent,
  consent,
}: {
  patient: Patient;
  hasActiveConsent: boolean;
  consent: PatientConsent | null;
}) {
  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">{patient.name}</h1>
          <p className="text-sm text-[#475569] mt-1">
            {patient.phone}
            {patient.email ? ` · ${patient.email}` : ""}
          </p>
        </div>
        <ConsentBadge hasActiveConsent={hasActiveConsent} consent={consent} />
      </div>

      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
        <Field label="Date of birth" value={fmtDate(patient.dob)} />
        <Field
          label="ID"
          value={
            patient.id_number
              ? `${patient.id_type ? ID_TYPE_LABEL[patient.id_type] : "ID"} · ${patient.id_number}`
              : "—"
          }
        />
        <Field label="Nationality" value={patient.nationality ?? "—"} />
        <Field label="Blood type" value={patient.blood_type ?? "—"} />
      </dl>
    </div>
  );
}

function ConsentBadge({
  hasActiveConsent,
  consent,
}: {
  hasActiveConsent: boolean;
  consent: PatientConsent | null;
}) {
  if (hasActiveConsent) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 text-[#0FAE7B] px-3 py-1 text-xs font-medium shrink-0">
        <ShieldCheck size={14} /> Consent on file
        {consent ? ` · ${fmtDate(consent.granted_at)}` : ""}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 text-amber-700 px-3 py-1 text-xs font-medium shrink-0">
      <ShieldAlert size={14} /> No consent
    </span>
  );
}

const CONSENT_METHODS: { value: ConsentMethod; label: string }[] = [
  { value: "reception_verbal", label: "Verbal (reception)" },
  { value: "signed_form", label: "Signed form" },
];

function ConsentSection({
  patientId,
  role,
  hasActiveConsent,
  onChanged,
}: {
  patientId: string;
  role: UserRole;
  hasActiveConsent: boolean;
  onChanged: () => void;
}) {
  const canManage = role === "reception" || role === "admin";
  const [method, setMethod] = useState<ConsentMethod>("reception_verbal");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<{ ok: true } | { error: string }>) {
    setBusy(true);
    setError(null);
    const res = await fn();
    setBusy(false);
    if ("error" in res) setError(res.error);
    else onChanged();
  }

  if (hasActiveConsent) {
    if (!canManage) return null; // header badge already shows the status
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
        <p className="text-sm text-emerald-800 inline-flex items-center gap-2">
          <ShieldCheck size={16} /> Records-storage consent is on file.
        </p>
        <button
          onClick={() => run(() => revokeRecordsConsent(patientId))}
          disabled={busy}
          className="text-sm font-medium text-[#475569] hover:text-[#EF4444] transition-colors disabled:opacity-50"
        >
          {busy ? "…" : "Revoke"}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
      <div className="flex items-start gap-3">
        <ShieldAlert size={18} className="text-amber-600 mt-0.5 shrink-0" />
        <div className="flex-1">
          <p className="text-sm text-amber-800">
            No active <strong>records-storage consent</strong>. Consult notes and document
            uploads are blocked until consent is captured.
          </p>
          {canManage && (
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as ConsentMethod)}
                className="px-3 py-1.5 rounded-lg border border-amber-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                {CONSENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              <button
                onClick={() => run(() => captureRecordsConsent(patientId, method))}
                disabled={busy}
                className="bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
              >
                {busy ? "Saving…" : "Record consent"}
              </button>
            </div>
          )}
          {error && <p className="text-xs text-[#EF4444] mt-2">{error}</p>}
        </div>
      </div>
    </div>
  );
}

function ClinicalSummary({ patient }: { patient: Patient }) {
  const rows: { label: string; value: string | null }[] = [
    { label: "Allergies", value: patient.allergies },
    { label: "Chronic conditions", value: patient.chronic_conditions },
    { label: "Current medications", value: patient.current_medications },
    { label: "Clinical notes", value: patient.clinical_notes },
  ];
  return (
    <section className="bg-white rounded-xl border border-[#E2E8F0] p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[#475569]">
          Clinical summary
        </h2>
        {patient.record_updated_at && (
          <span className="text-xs text-[#94A3B8]">
            Updated {fmtDateTime(patient.record_updated_at)}
          </span>
        )}
      </div>
      <dl className="grid sm:grid-cols-2 gap-4">
        {rows.map((r) => (
          <div key={r.label}>
            <dt className="text-xs font-medium text-[#94A3B8] mb-1">{r.label}</dt>
            <dd className="text-sm text-[#0F172A] whitespace-pre-wrap">
              {r.value?.trim() ? r.value : <span className="text-[#94A3B8]">—</span>}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Documents({ documents }: { documents: PatientDocument[] }) {
  const [signingId, setSigningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleView(docId: string) {
    setError(null);
    setSigningId(docId);
    const res = await signDocumentUrl(docId);
    setSigningId(null);
    if ("url" in res) {
      window.open(res.url, "_blank", "noopener,noreferrer");
    } else {
      setError(res.error);
    }
  }

  return (
    <section className="bg-white rounded-xl border border-[#E2E8F0] p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-[#475569] mb-4">
        Documents
      </h2>
      {error && (
        <p className="text-sm text-[#EF4444] bg-red-50 px-3 py-2 rounded-lg mb-3">{error}</p>
      )}
      {documents.length === 0 ? (
        <p className="text-sm text-[#94A3B8]">No documents on file yet.</p>
      ) : (
        <ul className="divide-y divide-[#E2E8F0]">
          {documents.map((doc) => (
            <li key={doc.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
              <div className="flex items-center gap-3 min-w-0">
                <FileText size={18} className="text-[#0B5AA8] shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#0F172A] truncate">{doc.file_name}</p>
                  <p className="text-xs text-[#94A3B8]">
                    {doc.doc_type ? DOC_TYPE_LABEL[doc.doc_type] : "Document"}
                    {" · "}
                    {doc.source === "digitised" ? "Digitised" : "Uploaded"}
                    {doc.original_date ? ` · ${fmtDate(doc.original_date)}` : ""}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleView(doc.id)}
                disabled={signingId === doc.id}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-sm font-medium text-[#0B5AA8] hover:bg-[#F7FAFC] transition-colors disabled:opacity-50 shrink-0"
              >
                <ExternalLink size={14} />
                {signingId === doc.id ? "Opening…" : "View"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Timeline({
  timeline,
  role,
  hasActiveConsent,
}: {
  timeline: TimelineVisit[];
  role: UserRole;
  hasActiveConsent: boolean;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });

  return (
    <section className="bg-white rounded-xl border border-[#E2E8F0] p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-[#475569] mb-4">
        Visit timeline
      </h2>
      {timeline.length === 0 ? (
        <p className="text-sm text-[#94A3B8]">No visits recorded yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {timeline.map((visit) => {
            const isOpen = expanded.has(visit.id);
            return (
              <li key={visit.id} className="border border-[#E2E8F0] rounded-lg overflow-hidden">
                <button
                  onClick={() => toggle(visit.id)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-[#F7FAFC] transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <ChevronDown
                      size={16}
                      className={`text-[#94A3B8] transition-transform ${isOpen ? "rotate-180" : ""}`}
                    />
                    <span className="text-sm font-medium text-[#0F172A]">
                      {fmtDate(visit.appointment_date)}
                    </span>
                    <StatusBadge status={visit.status} />
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[#94A3B8]">
                    {visit.visit_note && <span className="text-[#0B5AA8] font-medium">Note</span>}
                    {visit.visit_feedback && <span>★ {visit.visit_feedback.rating}/5</span>}
                  </div>
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 pt-1 border-t border-[#E2E8F0] flex flex-col gap-4">
                    <VisitIntake visit={visit} />
                    {role === "doctor" ? (
                      <VisitNoteEditor visit={visit} hasActiveConsent={hasActiveConsent} />
                    ) : (
                      <VisitNoteBlock visit={visit} role={role} />
                    )}
                    <VisitFeedbackBlock visit={visit} />
                    <VisitEvents visit={visit} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8] mb-2 mt-2">
        {title}
      </h3>
      {children}
    </div>
  );
}

function VisitIntake({ visit }: { visit: TimelineVisit }) {
  if (visit.intake_responses.length === 0) return null;
  return (
    <SubSection title="Intake">
      <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
        {visit.intake_responses.map((r) => (
          <div key={r.id} className="flex flex-col">
            <dt className="text-xs text-[#94A3B8]">{r.question_text}</dt>
            <dd className="text-sm text-[#0F172A]">{r.answer}</dd>
          </div>
        ))}
      </dl>
    </SubSection>
  );
}

type NoteFields = { subjective: string; objective: string; assessment: string; plan: string };
type SaveStatus = "idle" | "saving" | "saved" | "error";

const SOAP_FIELDS: { key: keyof NoteFields; label: string; placeholder: string }[] = [
  { key: "subjective", label: "Subjective", placeholder: "Patient's reported symptoms and history…" },
  { key: "objective", label: "Objective", placeholder: "Examination findings, vitals, observations…" },
  { key: "assessment", label: "Assessment", placeholder: "Diagnosis / clinical impression…" },
  { key: "plan", label: "Plan", placeholder: "Treatment, medication, follow-up…" },
];

const AUTOSAVE_MS = 800;

function VisitNoteEditor({
  visit,
  hasActiveConsent,
}: {
  visit: TimelineVisit;
  hasActiveConsent: boolean;
}) {
  const note = visit.visit_note;

  // Consent hard-block (mirrors the DB WITH CHECK): read-only until consent.
  if (!hasActiveConsent) {
    return (
      <SubSection title="Consult note (SOAP)">
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Records-storage consent is required before writing a consult note.
        </div>
        {note && (
          <div className="mt-2">
            <VisitNoteReadOnly note={note} />
          </div>
        )}
      </SubSection>
    );
  }

  return <VisitNoteEditorActive visit={visit} />;
}

function VisitNoteEditorActive({ visit }: { visit: TimelineVisit }) {
  const note = visit.visit_note;
  const [fields, setFields] = useState<NoteFields>({
    subjective: note?.subjective ?? "",
    objective: note?.objective ?? "",
    assessment: note?.assessment ?? "",
    plan: note?.plan ?? "",
  });
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [savedAt, setSavedAt] = useState<string | null>(note?.updated_at ?? null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  async function save(values: NoteFields) {
    setStatus("saving");
    const res = await saveVisitNote({ appointmentId: visit.id, ...values });
    if ("error" in res) {
      setStatus("error");
      setError(res.error);
    } else {
      setStatus("saved");
      setSavedAt(res.updatedAt);
      setError(null);
    }
  }

  function onChange(key: keyof NoteFields, value: string) {
    const next = { ...fields, [key]: value };
    setFields(next);
    setStatus("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(next), AUTOSAVE_MS);
  }

  return (
    <SubSection title="Consult note (SOAP)">
      <div className="flex flex-col gap-3">
        {SOAP_FIELDS.map((f) => (
          <div key={f.key}>
            <label className="text-xs font-semibold text-[#0B5AA8]">{f.label}</label>
            <textarea
              value={fields[f.key]}
              onChange={(e) => onChange(f.key, e.target.value)}
              placeholder={f.placeholder}
              rows={2}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0B5AA8] resize-y"
            />
          </div>
        ))}
        <SaveIndicator status={status} savedAt={savedAt} error={error} />
      </div>
    </SubSection>
  );
}

function SaveIndicator({
  status,
  savedAt,
  error,
}: {
  status: SaveStatus;
  savedAt: string | null;
  error: string | null;
}) {
  if (status === "error") {
    return <p className="text-xs text-[#EF4444]">{error ?? "Could not save."}</p>;
  }
  if (status === "saving") {
    return (
      <p className="text-xs text-[#94A3B8] inline-flex items-center gap-1.5">
        <Loader2 size={12} className="animate-spin" /> Saving…
      </p>
    );
  }
  if (savedAt) {
    return (
      <p className="text-xs text-[#0FAE7B] inline-flex items-center gap-1.5">
        <Check size={12} /> Saved {new Date(savedAt).toLocaleTimeString("en-ZA")}
      </p>
    );
  }
  return <p className="text-xs text-[#94A3B8]">Autosaves as you type.</p>;
}

function VisitNoteReadOnly({ note }: { note: NonNullable<TimelineVisit["visit_note"]> }) {
  const parts: { label: string; value: string | null }[] = [
    { label: "Subjective", value: note.subjective },
    { label: "Objective", value: note.objective },
    { label: "Assessment", value: note.assessment },
    { label: "Plan", value: note.plan },
  ];
  const filled = parts.filter((p) => p.value?.trim());
  if (filled.length === 0) return <p className="text-sm text-[#94A3B8]">No note for this visit.</p>;
  return (
    <div className="flex flex-col gap-2">
      {filled.map((p) => (
        <div key={p.label}>
          <span className="text-xs font-semibold text-[#0B5AA8]">{p.label}</span>
          <p className="text-sm text-[#0F172A] whitespace-pre-wrap">{p.value}</p>
        </div>
      ))}
    </div>
  );
}

function VisitNoteBlock({ visit, role }: { visit: TimelineVisit; role: UserRole }) {
  const note = visit.visit_note;
  if (!note) {
    // Reception never receives notes via RLS; only hint doctors/admins.
    if (role === "reception") return null;
    return (
      <SubSection title="Consult note">
        <p className="text-sm text-[#94A3B8]">No note for this visit.</p>
      </SubSection>
    );
  }
  const parts: { label: string; value: string | null }[] = [
    { label: "Subjective", value: note.subjective },
    { label: "Objective", value: note.objective },
    { label: "Assessment", value: note.assessment },
    { label: "Plan", value: note.plan },
  ];
  return (
    <SubSection title="Consult note (SOAP)">
      <div className="flex flex-col gap-2">
        {parts
          .filter((p) => p.value?.trim())
          .map((p) => (
            <div key={p.label}>
              <span className="text-xs font-semibold text-[#0B5AA8]">{p.label}</span>
              <p className="text-sm text-[#0F172A] whitespace-pre-wrap">{p.value}</p>
            </div>
          ))}
      </div>
    </SubSection>
  );
}

function VisitFeedbackBlock({ visit }: { visit: TimelineVisit }) {
  const fb = visit.visit_feedback;
  if (!fb) return null;
  return (
    <SubSection title="Patient feedback">
      <p className="text-sm text-[#0F172A]">
        ★ {fb.rating}/5{fb.comment ? ` — ${fb.comment}` : ""}
      </p>
    </SubSection>
  );
}

function VisitEvents({ visit }: { visit: TimelineVisit }) {
  if (visit.appointment_events.length === 0) return null;
  return (
    <SubSection title="Activity">
      <ul className="flex flex-col gap-1">
        {visit.appointment_events.map((e) => (
          <li key={e.id} className="text-xs text-[#475569]">
            <span className="text-[#94A3B8]">{fmtDateTime(e.created_at)}</span> · {e.event_type}
            {e.from_status && e.to_status ? ` (${e.from_status} → ${e.to_status})` : ""}
          </li>
        ))}
      </ul>
    </SubSection>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-[#94A3B8] mb-1">{label}</dt>
      <dd className="text-sm text-[#0F172A]">{value}</dd>
    </div>
  );
}
