"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import PageShell from "@/components/ui/PageShell";
import { getAppointment, isSessionInvalidError, submitIntake } from "@/lib/api";
import { clearSession, loadSession } from "@/lib/session";
import type { AppointmentView, ResolvedQuestion } from "@/lib/supabase/types";

export default function IntakeFormPage() {
  const params = useParams();
  const router = useRouter();
  const appointmentId = params.appointmentId as string;

  const [view, setView] = useState<AppointmentView | null>(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);

  const sessionRef = useRef(loadSession());

  useEffect(() => {
    const session = loadSession();
    sessionRef.current = session;

    if (!session || session.appointmentId !== appointmentId) {
      router.push("/");
      return;
    }

    getAppointment({
      appointment_id: session.appointmentId,
      access_token: session.accessToken,
    })
      .then((data) => {
        if (data.intake_submitted) {
          setSubmitted(true);
        }
        // Sliders render at 5 by default, so make that the recorded answer too
        setAnswers((prev) => {
          const next = { ...prev };
          for (const q of data.questions) {
            if (q.question_type === "scale" && !next[q.id]) next[q.id] = "5";
          }
          return next;
        });
        setView(data);
      })
      .catch((err) => {
        if (isSessionInvalidError(err)) {
          clearSession();
          router.push("/");
          return;
        }
        setGeneralError("Unable to load intake form. Please try again.");
      })
      .finally(() => setLoading(false));
  }, [appointmentId, router]);

  function setAnswer(questionId: string, value: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    if (errors[questionId]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[questionId];
        return next;
      });
    }
  }

  function validate(): boolean {
    if (!view) return false;
    const errs: Record<string, string> = {};
    for (const q of view.questions) {
      if (!answers[q.id]?.trim()) {
        errs[q.id] = "This question is required.";
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!view || !validate()) return;

    const session = sessionRef.current!;
    setSubmitting(true);
    setGeneralError(null);

    try {
      await submitIntake({
        appointment_id: session.appointmentId,
        access_token: session.accessToken,
        answers: view.questions.map((q) => ({
          question_id: q.id,
          question_key: q.question_key,
          question_text: q.question_text,
          answer: answers[q.id] ?? "",
        })),
      });

      setSubmitted(true);
      setTimeout(() => router.push(`/q/${appointmentId}`), 1500);
    } catch (err) {
      setGeneralError(
        err instanceof Error ? err.message : "Failed to submit. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <PageShell>
        <div className="flex flex-1 items-center justify-center">
          <Spinner size={32} />
        </div>
      </PageShell>
    );
  }

  if (submitted) {
    return (
      <PageShell>
        <div className="flex flex-col items-center justify-center flex-1 px-md text-center gap-md">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/10">
          <CheckCircle2 size={32} className="text-accent" />
        </span>
        <h2 className="text-lg font-semibold text-text-primary">Intake submitted</h2>
        <p className="text-sm text-text-secondary">Your information has been sent to the clinic.</p>
        <Button variant="secondary" onClick={() => router.push(`/q/${appointmentId}`)}>
          Back to queue
        </Button>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      {/* Header */}
      <header className="flex items-center gap-3 px-md py-md border-b border-border">
        <button
          onClick={() => router.back()}
          className="p-2 -ml-2 rounded-lg text-text-secondary hover:text-primary hover:bg-blue-50 transition-colors"
          aria-label="Go back"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-base font-semibold text-text-primary">Quick Intake</h1>
      </header>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex flex-col flex-1 px-md py-lg gap-lg" noValidate>
        <p className="text-sm text-text-secondary">
          Please answer these short questions to help the doctor prepare for your visit.
        </p>

        {view?.questions.map((question, idx) => (
          <QuestionField
            key={question.id}
            question={question}
            index={idx + 1}
            total={view.questions.length}
            value={answers[question.id] ?? ""}
            error={errors[question.id]}
            onChange={(val) => setAnswer(question.id, val)}
          />
        ))}

        {generalError && (
          <p className="text-sm text-error rounded-xl bg-red-50 border border-error/20 px-4 py-3">
            {generalError}
          </p>
        )}

        <Button
          type="submit"
          size="lg"
          loading={submitting}
          className="w-full"
        >
          {submitting ? "Submitting…" : "Submit Intake"}
        </Button>
      </form>
    </PageShell>
  );
}

// ─────────────────────────────────────────
// Question field renderer
// ─────────────────────────────────────────
interface QuestionFieldProps {
  question: ResolvedQuestion;
  index: number;
  total: number;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}

function QuestionField({ question, index, total, value, error, onChange }: QuestionFieldProps) {
  return (
    <div className="flex flex-col gap-sm">
      <div>
        <p className="text-xs text-text-secondary mb-1">
          {index} / {total}
        </p>
        <label className="text-sm font-medium text-text-primary">
          {question.question_text}
        </label>
      </div>

      {question.question_type === "text" && (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={[
            "h-12 w-full rounded-[12px] border border-border bg-surface px-4",
            "text-sm text-text-primary placeholder:text-text-secondary",
            "focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20",
            error ? "border-error" : "",
          ].join(" ")}
          placeholder="Type your answer…"
        />
      )}

      {question.question_type === "dropdown" && question.options && (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={[
            "h-12 w-full rounded-[12px] border border-border bg-surface px-4",
            "text-sm text-text-primary",
            "focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20",
            "appearance-none cursor-pointer",
            error ? "border-error" : "",
          ].join(" ")}
        >
          <option value="">Select an option…</option>
          {question.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      )}

      {question.question_type === "scale" && (
        <div className="flex flex-col gap-sm">
          <input
            type="range"
            min={0}
            max={10}
            value={value === "" ? 5 : Number(value)}
            onChange={(e) => onChange(e.target.value)}
            className="w-full accent-primary"
          />
          <div className="flex justify-between items-center">
            <span className="text-xs text-text-secondary">0 — None</span>
            <span className="text-lg font-bold text-primary">
              {value === "" ? "5" : value}
            </span>
            <span className="text-xs text-text-secondary">10 — Severe</span>
          </div>
        </div>
      )}

      {question.question_type === "boolean" && (
        <div className="flex gap-sm">
          {["Yes", "No"].map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={[
                "flex-1 h-12 rounded-xl border text-sm font-medium transition-colors",
                value === opt
                  ? "bg-primary text-white border-primary"
                  : "bg-surface text-text-secondary border-border hover:border-primary/50",
              ].join(" ")}
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  );
}
