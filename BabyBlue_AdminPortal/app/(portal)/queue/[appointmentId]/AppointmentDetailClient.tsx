"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ClipboardList, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { callApi } from "@/lib/api";
import StatusBadge from "@/components/StatusBadge";
import type {
  AppointmentStatus,
  IntakeResponse,
  AppointmentEvent,
  Profile,
} from "@/types";

interface Patient {
  id: string;
  name: string;
  phone: string;
  dob: string | null;
  email: string | null;
}

interface AppointmentFull {
  id: string;
  clinic_id: string;
  patient_id: string;
  status: AppointmentStatus;
  appointment_date: string;
  entered_queue_at: string;
  consultation_started_at: string | null;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
  patients: Patient;
}

interface Props {
  appointment: AppointmentFull;
  intakeResponses: IntakeResponse[] | null;
  events: AppointmentEvent[];
  profile: Profile;
}

export default function AppointmentDetailClient({
  appointment: initialAppt,
  intakeResponses,
  events,
  profile,
}: Props) {
  const [appt, setAppt] = useState(initialAppt);
  const [notes, setNotes] = useState(initialAppt.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const supabase = createClient();

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function updateStatus(newStatus: AppointmentStatus) {
    // Single write path: the API validates, audits, and notifies.
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) { showToast("Session expired — please sign in again."); return; }
    try {
      await callApi(`/v1/admin/appointments/${appt.id}/transition`, {
        token: session.access_token,
        body: { to_status: newStatus },
      });
    } catch (err) {
      showToast("Error: " + (err instanceof Error ? err.message : "could not update status"));
      return;
    }
    setAppt((prev) => ({ ...prev, status: newStatus }));
    showToast("Status updated");
  }

  async function saveNotes() {
    setSaving(true);
    const { error } = await supabase
      .from("appointments")
      .update({ notes })
      .eq("id", appt.id);
    setSaving(false);
    if (error) showToast("Error: " + error.message);
    else showToast("Notes saved");
  }

  function fmt(ts: string | null) {
    if (!ts) return "—";
    return new Date(ts).toLocaleString("en-ZA", {
      day: "numeric", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  }

  const canCancel = profile.role === "admin" || profile.role === "reception";

  return (
    <div>
      {/* Back */}
      <Link
        href="/queue"
        className="inline-flex items-center gap-2 text-sm text-[#475569] hover:text-[#0B5AA8] transition-colors mb-6"
      >
        <ArrowLeft size={16} />
        Back to Queue
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Patient card */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-xl font-bold text-[#0F172A]">
                  {appt.patients.name}
                </h1>
                <p className="text-sm text-[#475569] mt-0.5">
                  {appt.patients.phone}
                  {appt.patients.email && ` · ${appt.patients.email}`}
                </p>
                {appt.patients.dob && (
                  <p className="text-sm text-[#475569]">
                    DOB: {new Date(appt.patients.dob).toLocaleDateString("en-ZA")}
                  </p>
                )}
              </div>
              <StatusBadge status={appt.status} />
            </div>

            <div className="text-xs text-[#475569] space-y-1">
              <p>Joined queue: {fmt(appt.entered_queue_at)}</p>
              {appt.consultation_started_at && (
                <p>Consultation started: {fmt(appt.consultation_started_at)}</p>
              )}
              {appt.completed_at && (
                <p>Completed: {fmt(appt.completed_at)}</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 mt-4 flex-wrap">
              {appt.status === "waiting" && (
                <button
                  onClick={() => updateStatus("in_consultation")}
                  className="px-4 py-2 rounded-lg bg-blue-50 text-[#0B5AA8] text-sm font-medium hover:bg-blue-100 transition-colors min-h-[44px]"
                >
                  → In Consultation
                </button>
              )}
              {appt.status === "in_consultation" && (
                <button
                  onClick={() => updateStatus("done")}
                  className="px-4 py-2 rounded-lg bg-emerald-50 text-[#0FAE7B] text-sm font-medium hover:bg-emerald-100 transition-colors min-h-[44px]"
                >
                  ✓ Mark Done
                </button>
              )}
              {canCancel && (appt.status === "waiting" || appt.status === "in_consultation") && (
                <button
                  onClick={() => updateStatus("cancelled")}
                  className="px-4 py-2 rounded-lg bg-gray-50 text-gray-500 text-sm font-medium hover:bg-red-50 hover:text-[#EF4444] transition-colors min-h-[44px]"
                >
                  ✕ Cancel
                </button>
              )}
            </div>
          </div>

          {/* Intake responses */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-6">
            <div className="flex items-center gap-2 mb-4">
              <ClipboardList size={16} className="text-[#475569]" />
              <h2 className="font-semibold text-[#0F172A]">Intake Responses</h2>
            </div>

            {intakeResponses === null ? (
              <p className="text-sm text-[#475569]">
                You don&apos;t have permission to view intake responses.
              </p>
            ) : intakeResponses.length === 0 ? (
              <p className="text-sm text-[#475569]">
                Patient hasn&apos;t completed intake yet.
              </p>
            ) : (
              <div className="space-y-3">
                {intakeResponses.map((r) => (
                  <div
                    key={r.id}
                    className="bg-[#F7FAFC] rounded-lg px-4 py-3"
                  >
                    <p className="text-xs font-medium text-[#475569] mb-1">
                      {r.question_text}
                    </p>
                    <p className="text-sm text-[#0F172A]">{r.answer}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-6">
            <h2 className="font-semibold text-[#0F172A] mb-3">Clinical Notes</h2>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="w-full px-3 py-2.5 rounded-lg border border-[#E2E8F0] text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0B5AA8] resize-none"
              placeholder="Add notes about this appointment…"
            />
            <button
              onClick={saveNotes}
              disabled={saving}
              className="mt-2 px-4 py-2 bg-[#0B5AA8] hover:bg-[#083E78] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save Notes"}
            </button>
          </div>
        </div>

        {/* Right column — timeline */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 h-fit">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={16} className="text-[#475569]" />
            <h2 className="font-semibold text-[#0F172A]">Event Timeline</h2>
          </div>

          {events.length === 0 ? (
            <p className="text-sm text-[#475569]">No events yet.</p>
          ) : (
            <ol className="relative border-l border-[#E2E8F0] space-y-4 ml-2">
              {events.map((ev) => (
                <li key={ev.id} className="pl-4">
                  <div className="absolute w-2.5 h-2.5 bg-[#0B5AA8] rounded-full -left-1.5 mt-1" />
                  <p className="text-xs text-[#475569]">
                    {new Date(ev.created_at).toLocaleTimeString("en-ZA", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  <p className="text-sm font-medium text-[#0F172A] capitalize">
                    {ev.event_type.replace(/_/g, " ")}
                  </p>
                  {ev.from_status && ev.to_status && (
                    <p className="text-xs text-[#475569]">
                      {ev.from_status} → {ev.to_status}
                    </p>
                  )}
                  <p className="text-xs text-[#475569] capitalize">
                    by {ev.actor_type}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#0F172A] text-white text-sm font-medium px-5 py-3 rounded-xl shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
