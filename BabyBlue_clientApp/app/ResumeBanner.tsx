"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Clock, ChevronRight } from "lucide-react";
import { getAppointment, isSessionInvalidError } from "@/lib/api";
import { clearSession, loadSession } from "@/lib/session";
import type { PatientSession } from "@/lib/supabase/types";

export default function ResumeBanner() {
  const [session, setSession] = useState<PatientSession | null>(null);

  useEffect(() => {
    const stored = loadSession();
    if (!stored) return;

    // Only show the banner for visits that are still active on the server
    getAppointment({
      appointment_id: stored.appointmentId,
      access_token: stored.accessToken,
    })
      .then((data) => {
        const status = data.appointment.status;
        if (status === "waiting" || status === "in_consultation") {
          setSession(stored);
        }
      })
      .catch((err) => {
        if (isSessionInvalidError(err)) clearSession();
      });
  }, []);

  if (!session) return null;

  return (
    <Link
      href={`/q/${session.appointmentId}`}
      className="mt-lg flex items-center gap-3 rounded-2xl border border-primary/30 bg-blue-50/50 p-md transition-colors hover:border-primary/60 hover:bg-blue-50"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50">
        <Clock size={20} className="text-primary" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-text-primary">You have an active visit</p>
        <p className="text-xs text-text-secondary">Tap to see your queue position</p>
      </div>
      <ChevronRight size={18} className="shrink-0 text-primary" />
    </Link>
  );
}
