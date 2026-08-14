"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { RefreshCw, WifiOff, ClipboardList, CheckCircle2, Stethoscope, Star } from "lucide-react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import PageShell from "@/components/ui/PageShell";
import {
  cancelAppointment,
  getAppointment,
  isSessionInvalidError,
  submitFeedback,
} from "@/lib/api";
import { clearSession, loadSession } from "@/lib/session";
import type { AppointmentView, AppointmentStatus } from "@/lib/supabase/types";

const POLL_INTERVAL_MS = 7000;

export default function QueueViewPage() {
  const params = useParams();
  const router = useRouter();
  const appointmentId = params.appointmentId as string;

  const [data, setData] = useState<AppointmentView | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);

  // Lazy init: read once on mount; null during SSR (loadSession guards on window)
  const [session] = useState(loadSession);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(
    async (isManual = false) => {
      if (!session || session.appointmentId !== appointmentId) {
        router.push("/");
        return;
      }

      if (isManual) setRefreshing(true);

      try {
        const result = await getAppointment({
          appointment_id: session.appointmentId,
          access_token: session.accessToken,
        });
        setData(result);
        setOffline(false);
        setLastUpdated(new Date());
      } catch (err) {
        if (isSessionInvalidError(err)) {
          // Appointment no longer exists or token is invalid — session is dead
          clearSession();
          router.push("/");
          return;
        }
        setOffline(true);
      } finally {
        setLoading(false);
        if (isManual) setRefreshing(false);
      }
    },
    [appointmentId, router, session]
  );

  useEffect(() => {
    if (!session || session.appointmentId !== appointmentId) {
      router.push("/");
      return;
    }

    // Fetch-on-mount: state updates land after the network await, not synchronously
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
    pollRef.current = setInterval(() => fetchData(), POLL_INTERVAL_MS);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [appointmentId, fetchData, router, session]);

  // Stop polling when terminal status reached
  useEffect(() => {
    if (
      data?.appointment.status === "done" ||
      data?.appointment.status === "cancelled"
    ) {
      if (pollRef.current) clearInterval(pollRef.current);
    }
  }, [data?.appointment.status]);

  if (loading) {
    return (
      <PageShell>
        <div className="flex flex-1 items-center justify-center">
          <Spinner size={32} />
        </div>
      </PageShell>
    );
  }

  if (!data || !session) {
    return (
      <PageShell>
        <div className="flex flex-col items-center justify-center flex-1 px-md text-center">
        <WifiOff size={32} className="text-text-secondary mb-md" />
        <p className="text-text-primary font-semibold">Unable to load your queue position</p>
        <p className="text-text-secondary text-sm mt-sm">Check your connection and try again.</p>
        <Button
          variant="secondary"
          className="mt-lg"
          onClick={() => fetchData(true)}
          loading={refreshing}
        >
          Try again
        </Button>
        </div>
      </PageShell>
    );
  }

  const {
    appointment,
    position,
    estimated_wait_range,
    clinic,
    intake_submitted,
    feedback_submitted,
  } = data;
  const status = appointment.status as AppointmentStatus;

  async function handleLeaveQueue() {
    if (!session) return;
    setLeaving(true);
    try {
      await cancelAppointment({
        appointment_id: session.appointmentId,
        access_token: session.accessToken,
      });
      clearSession();
      router.push("/");
    } catch {
      setLeaving(false);
      setConfirmLeave(false);
      setOffline(true);
    }
  }

  return (
    <PageShell>
      <div className="flex flex-col flex-1">
      {/* Offline banner */}
      {offline && (
        <div className="bg-warning/10 border-b border-warning/30 px-md py-2 flex items-center gap-2">
          <WifiOff size={14} className="text-warning shrink-0" />
          <span className="text-xs text-amber-700">Unable to connect — retrying…</span>
        </div>
      )}

      {/* Header */}
      <header className="flex items-center justify-between px-md py-md border-b border-border">
        <div>
          <p className="text-xs text-text-secondary">Your visit at</p>
          <h1 className="text-base font-semibold text-text-primary leading-tight">
            {clinic.name}
          </h1>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          aria-label="Refresh"
          className="p-2 rounded-lg text-text-secondary hover:text-primary hover:bg-blue-50 transition-colors"
        >
          <RefreshCw size={18} className={refreshing ? "animate-spin" : ""} />
        </button>
      </header>

      {/* Main content */}
      <div className="flex flex-col flex-1 px-md py-lg gap-lg">
        <StatusCard
          status={status}
          position={position}
          estimatedWaitRange={estimated_wait_range}
        />

        {/* Feedback prompt after the visit */}
        {status === "done" && (
          <FeedbackCard
            appointmentId={session.appointmentId}
            accessToken={session.accessToken}
            alreadySubmitted={feedback_submitted}
          />
        )}

        {/* Intake prompt */}
        {status === "waiting" && !intake_submitted && (
          <Link
            href={`/q/${appointmentId}/intake`}
            className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-md hover:border-primary/40 hover:bg-blue-50/30 transition-colors"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 shrink-0">
              <ClipboardList size={20} className="text-primary" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary">Complete quick intake</p>
              <p className="text-xs text-text-secondary">Help the doctor prepare for your visit</p>
            </div>
            <span className="text-xs font-medium text-primary">Start →</span>
          </Link>
        )}

        {/* Intake done indicator */}
        {intake_submitted && status === "waiting" && (
          <div className="flex items-center gap-3 rounded-2xl border border-accent/30 bg-emerald-50/40 p-md">
            <CheckCircle2 size={20} className="text-accent shrink-0" />
            <p className="text-sm text-accent-dark font-medium">Intake submitted</p>
          </div>
        )}

        {/* Last updated */}
        {lastUpdated && !offline && (
          <p className="text-xs text-text-secondary text-center">
            Updated {formatRelativeTime(lastUpdated)}
          </p>
        )}

        {/* Leave queue — quiet, but reachable */}
        {status === "waiting" && (
          <div className="mt-auto pt-md">
            {!confirmLeave ? (
              <button
                onClick={() => setConfirmLeave(true)}
                className="w-full text-center text-sm text-text-secondary hover:text-error transition-colors py-2"
              >
                Leave the queue
              </button>
            ) : (
              <div className="rounded-2xl border border-error/20 bg-red-50/50 p-md flex flex-col gap-sm">
                <p className="text-sm text-text-primary text-center">
                  Leave the queue? You&apos;ll lose your place in line.
                </p>
                <div className="flex gap-sm">
                  <Button
                    variant="secondary"
                    className="flex-1"
                    onClick={() => setConfirmLeave(false)}
                    disabled={leaving}
                  >
                    Keep my place
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={handleLeaveQueue}
                    loading={leaving}
                  >
                    Yes, leave
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      </div>
    </PageShell>
  );
}

// ─────────────────────────────────────────
// Status-specific card
// ─────────────────────────────────────────
interface StatusCardProps {
  status: AppointmentStatus;
  position: number;
  estimatedWaitRange: { min: number; max: number } | null;
}

function StatusCard({ status, position, estimatedWaitRange }: StatusCardProps) {
  if (status === "waiting") {
    return (
      <div className="rounded-2xl border border-border bg-surface p-lg text-center">
        <Badge status="waiting" />
        <div className="mt-lg">
          <p className="text-5xl font-bold text-text-primary">#{position}</p>
          <p className="text-text-secondary mt-sm text-sm">
            {position === 1 ? "You're next in line" : `in line`}
          </p>
        </div>
        {estimatedWaitRange && (
          <div className="mt-lg border-t border-border pt-md">
            <p className="text-xs text-text-secondary uppercase tracking-wider">
              Estimated wait
            </p>
            <p className="text-xl font-semibold text-text-primary mt-xs">
              {estimatedWaitRange.min === estimatedWaitRange.max
                ? `~${estimatedWaitRange.min} min`
                : `~${estimatedWaitRange.min}–${estimatedWaitRange.max} min`}
            </p>
            <p className="text-xs text-text-secondary mt-xs">
              Based on today&apos;s pace at this clinic
            </p>
          </div>
        )}
      </div>
    );
  }

  if (status === "in_consultation") {
    return (
      <div className="rounded-2xl border border-accent/30 bg-emerald-50/40 p-lg text-center">
        <Badge status="in_consultation" />
        <div className="mt-lg flex flex-col items-center gap-md">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/10">
            <Stethoscope size={32} className="text-accent" />
          </span>
          <div>
            <p className="text-lg font-semibold text-accent-dark">You&apos;re being seen now</p>
            <p className="text-sm text-text-secondary mt-xs">Please make your way to the consultation room</p>
          </div>
        </div>
      </div>
    );
  }

  if (status === "done") {
    return (
      <div className="rounded-2xl border border-accent/30 bg-emerald-50/40 p-lg text-center">
        <Badge status="done" />
        <div className="mt-lg flex flex-col items-center gap-md">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/10">
            <CheckCircle2 size={32} className="text-accent" />
          </span>
          <div>
            <p className="text-lg font-semibold text-accent-dark">Visit complete</p>
            <p className="text-sm text-text-secondary mt-xs">Thank you for visiting. Take care!</p>
          </div>
        </div>
      </div>
    );
  }

  if (status === "cancelled") {
    return (
      <div className="rounded-2xl border border-border bg-surface p-lg text-center">
        <Badge status="cancelled" />
        <p className="text-sm text-text-secondary mt-md">
          This appointment was cancelled. Please speak to reception if you need assistance.
        </p>
      </div>
    );
  }

  return null;
}

// ─────────────────────────────────────────
// Post-visit feedback (§4.1)
// ─────────────────────────────────────────
interface FeedbackCardProps {
  appointmentId: string;
  accessToken: string;
  alreadySubmitted: boolean;
}

function FeedbackCard({ appointmentId, accessToken, alreadySubmitted }: FeedbackCardProps) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(alreadySubmitted);
  const [error, setError] = useState<string | null>(null);

  if (submitted) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-accent/30 bg-emerald-50/40 p-md">
        <CheckCircle2 size={20} className="text-accent shrink-0" />
        <p className="text-sm text-accent-dark font-medium">Thank you for your feedback</p>
      </div>
    );
  }

  async function handleSubmit() {
    if (rating === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitFeedback({
        appointment_id: appointmentId,
        access_token: accessToken,
        rating,
        comment: comment.trim() || undefined,
      });
      setSubmitted(true);
    } catch {
      setError("Couldn't send your feedback. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-md flex flex-col gap-md">
      <p className="text-sm font-medium text-text-primary text-center">
        How was your visit today?
      </p>
      <div className="flex justify-center gap-2">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => setRating(star)}
            aria-label={`${star} star${star > 1 ? "s" : ""}`}
            className="p-1.5 transition-transform active:scale-90"
          >
            <Star
              size={30}
              className={
                star <= rating ? "fill-amber-400 text-amber-400" : "text-border"
              }
            />
          </button>
        ))}
      </div>
      {rating > 0 && (
        <>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Anything you'd like the clinic to know? (optional)"
            rows={2}
            maxLength={1000}
            className="w-full rounded-[12px] border border-border bg-surface px-4 py-3 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 resize-none"
          />
          {error && <p className="text-xs text-error text-center">{error}</p>}
          <Button onClick={handleSubmit} loading={submitting} className="w-full">
            {submitting ? "Sending…" : "Send feedback"}
          </Button>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────
function formatRelativeTime(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.floor(seconds / 60)}m ago`;
}
