"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { UserPlus, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import StatusBadge from "@/components/StatusBadge";
import AddWalkInModal from "@/components/AddWalkInModal";
import type { AppointmentWithPatient, AppointmentStatus, Profile } from "@/types";

type FilterTab = "all" | AppointmentStatus;

const TABS: { key: FilterTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "waiting", label: "Waiting" },
  { key: "in_consultation", label: "In Consultation" },
  { key: "done", label: "Done" },
  { key: "cancelled", label: "Cancelled" },
];

interface Props {
  initialAppointments: AppointmentWithPatient[];
  profile: Profile;
  today: string;
}

export default function QueueClient({ initialAppointments, profile, today }: Props) {
  const [appointments, setAppointments] = useState(initialAppointments);
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [showWalkIn, setShowWalkIn] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const supabase = createClient();

  const refetchQueue = useCallback(async () => {
    const { data } = await supabase
      .from("appointments")
      .select("*, patients(id, name, phone)")
      .eq("clinic_id", profile.clinic_id)
      .eq("appointment_date", today)
      .order("entered_queue_at", { ascending: true });
    if (data) setAppointments(data);
  }, [profile.clinic_id, today, supabase]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("queue")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
          filter: `clinic_id=eq.${profile.clinic_id}`,
        },
        () => refetchQueue()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile.clinic_id, supabase, refetchQueue]);

  function showToast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  }

  async function updateStatus(appt: AppointmentWithPatient, newStatus: AppointmentStatus) {
    const { error } = await supabase
      .from("appointments")
      .update({ status: newStatus })
      .eq("id", appt.id);

    if (error) {
      showToast("Error: " + error.message);
      return;
    }

    // Audit log
    await supabase.from("appointment_events").insert({
      clinic_id: profile.clinic_id,
      appointment_id: appt.id,
      actor_type: "staff",
      actor_user_id: profile.id,
      event_type: "status_change",
      from_status: appt.status,
      to_status: newStatus,
    });

    await refetchQueue();
  }

  const filtered =
    activeTab === "all"
      ? appointments
      : appointments.filter((a) => a.status === activeTab);

  const waitingAppointments = appointments.filter((a) => a.status === "waiting");

  function queuePosition(apptId: string) {
    const idx = waitingAppointments.findIndex((a) => a.id === apptId);
    return idx >= 0 ? idx + 1 : null;
  }

  function formatTime(ts: string | null) {
    if (!ts) return "—";
    return new Date(ts).toLocaleTimeString("en-ZA", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const todayLabel = new Date().toLocaleDateString("en-ZA", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const canAddWalkIn = profile.role === "admin" || profile.role === "reception";
  const canCancel = profile.role === "admin" || profile.role === "reception";

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">Today&apos;s Queue</h1>
          <p className="text-sm text-[#475569] mt-0.5">{todayLabel}</p>
        </div>
        {canAddWalkIn && (
          <button
            onClick={() => setShowWalkIn(true)}
            className="flex items-center gap-2 bg-[#0B5AA8] hover:bg-[#083E78] text-white font-medium px-4 py-2.5 rounded-lg transition-colors text-sm min-h-[44px]"
          >
            <UserPlus size={16} />
            Add Walk-in
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {(
          [
            { label: "Waiting", status: "waiting", color: "text-gray-700" },
            { label: "In Consultation", status: "in_consultation", color: "text-[#0B5AA8]" },
            { label: "Done", status: "done", color: "text-[#20C997]" },
            { label: "Cancelled", status: "cancelled", color: "text-gray-400" },
          ] as const
        ).map(({ label, status, color }) => (
          <div key={status} className="bg-white rounded-xl border border-[#E2E8F0] px-4 py-4">
            <p className="text-xs text-[#475569] font-medium">{label}</p>
            <p className={`text-2xl font-bold mt-1 ${color}`}>
              {appointments.filter((a) => a.status === status).length}
            </p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4 bg-white rounded-xl border border-[#E2E8F0] p-1 w-fit">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === key
                ? "bg-[#0B5AA8] text-white"
                : "text-[#475569] hover:text-[#0F172A]"
            }`}
          >
            {label}
            {key !== "all" && (
              <span className="ml-1.5 text-xs opacity-70">
                {appointments.filter((a) => a.status === key).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Queue table */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-[#475569]">
            <p className="text-sm">No appointments in this category.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F7FAFC]">
                <th className="text-left text-xs font-semibold text-[#475569] uppercase tracking-wider px-4 py-3 w-12">
                  #
                </th>
                <th className="text-left text-xs font-semibold text-[#475569] uppercase tracking-wider px-4 py-3">
                  Patient
                </th>
                <th className="text-left text-xs font-semibold text-[#475569] uppercase tracking-wider px-4 py-3">
                  Joined
                </th>
                <th className="text-left text-xs font-semibold text-[#475569] uppercase tracking-wider px-4 py-3">
                  Status
                </th>
                <th className="text-right text-xs font-semibold text-[#475569] uppercase tracking-wider px-4 py-3">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((appt) => {
                const pos = queuePosition(appt.id);
                return (
                  <tr
                    key={appt.id}
                    className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F7FAFC] transition-colors"
                  >
                    <td className="px-4 py-3 text-sm font-bold text-[#0B5AA8]">
                      {pos ? `#${pos}` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold text-[#0F172A]">
                        {appt.patients.name}
                      </p>
                      <p className="text-xs text-[#475569]">{appt.patients.phone}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-[#475569]">
                      {formatTime(appt.entered_queue_at)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={appt.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {/* Action buttons */}
                        {appt.status === "waiting" && (
                          <button
                            onClick={() => updateStatus(appt, "in_consultation")}
                            className="text-xs font-medium px-3 py-1.5 rounded-lg bg-blue-50 text-[#0B5AA8] hover:bg-blue-100 transition-colors min-h-[36px]"
                          >
                            → Consult
                          </button>
                        )}
                        {appt.status === "in_consultation" && (
                          <button
                            onClick={() => updateStatus(appt, "done")}
                            className="text-xs font-medium px-3 py-1.5 rounded-lg bg-emerald-50 text-[#0FAE7B] hover:bg-emerald-100 transition-colors min-h-[36px]"
                          >
                            ✓ Done
                          </button>
                        )}
                        {canCancel && appt.status === "waiting" && (
                          <button
                            onClick={() => updateStatus(appt, "cancelled")}
                            className="text-xs font-medium px-3 py-1.5 rounded-lg bg-gray-50 text-gray-500 hover:bg-red-50 hover:text-[#EF4444] transition-colors min-h-[36px]"
                          >
                            ✕
                          </button>
                        )}
                        <Link
                          href={`/queue/${appt.id}`}
                          className="p-1.5 text-[#475569] hover:text-[#0B5AA8] transition-colors"
                        >
                          <ChevronRight size={16} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Walk-In Modal */}
      {showWalkIn && (
        <AddWalkInModal
          clinicId={profile.clinic_id}
          userId={profile.id}
          today={today}
          waitingCount={waitingAppointments.length}
          onClose={() => setShowWalkIn(false)}
          onSuccess={(msg) => {
            setShowWalkIn(false);
            showToast(msg);
            refetchQueue();
          }}
        />
      )}

      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#0F172A] text-white text-sm font-medium px-5 py-3 rounded-xl shadow-lg z-50">
          {toastMsg}
        </div>
      )}
    </div>
  );
}
