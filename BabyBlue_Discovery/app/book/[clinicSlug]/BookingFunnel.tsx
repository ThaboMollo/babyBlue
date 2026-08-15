"use client";

import { useEffect, useState } from "react";
import { Check, CalendarClock, Loader2 } from "lucide-react";
import { getAvailability, book, type BookResult } from "@/lib/api";
import type { Clinic, Practitioner, Slot } from "@/lib/types";

const PATIENT_APP = process.env.NEXT_PUBLIC_PATIENT_APP_URL ?? "http://localhost:3000";

type Step = "details" | "slot" | "review" | "done";

function todayISO() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Johannesburg" });
}
function fmtSlot(iso: string) {
  return new Date(iso).toLocaleString("en-ZA", {
    timeZone: "Africa/Johannesburg",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function BookingFunnel({
  clinic,
  practitioners,
  preselectedDr,
}: {
  clinic: Clinic;
  practitioners: Practitioner[];
  preselectedDr: string | null;
}) {
  const isLive = clinic.booking_mode === "live";
  const [step, setStep] = useState<Step>("details");

  // details
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneIsWhatsapp, setPhoneIsWhatsapp] = useState(true);
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [reason, setReason] = useState("");
  const [practitionerSlug, setPractitionerSlug] = useState<string>(preselectedDr ?? "");

  // slot
  const [date, setDate] = useState(todayISO());
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotStart, setSlotStart] = useState<string>("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BookResult | null>(null);

  useEffect(() => {
    if (step !== "slot" || !isLive) return;
    let active = true;
    setLoadingSlots(true);
    setSlotStart("");
    getAvailability(clinic.slug, date)
      .then((s) => active && setSlots(s))
      .finally(() => active && setLoadingSlots(false));
    return () => {
      active = false;
    };
  }, [step, isLive, clinic.slug, date]);

  const detailsValid =
    firstName.trim() && phone.trim() && (phoneIsWhatsapp || whatsappNumber.trim());

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const r = await book({
        clinic_slug: clinic.slug,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim(),
        phone_is_whatsapp: phoneIsWhatsapp,
        whatsapp_number: phoneIsWhatsapp ? undefined : whatsappNumber.trim(),
        reason: reason.trim() || undefined,
        slot_start: isLive ? slotStart : undefined,
        practitioner_slug: practitionerSlug || undefined,
      });
      setResult(r);
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Booking failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-md mx-auto px-4 py-10">
      <h1 className="text-2xl font-extrabold text-text-primary">Book at {clinic.name}</h1>
      <p className="mt-1 text-sm text-accent-dark flex items-center gap-1">
        <CalendarClock size={15} />
        {isLive ? "Pick a live slot" : "Request an appointment — the practice confirms"}
      </p>

      {/* DETAILS */}
      {step === "details" && (
        <div className="mt-6 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name" required>
              <input className={input} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </Field>
            <Field label="Last name">
              <input className={input} value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </Field>
          </div>
          <Field label="Phone number" required>
            <input className={input} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="082 000 0000" />
          </Field>
          <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer -mt-1">
            <input type="checkbox" checked={phoneIsWhatsapp} onChange={(e) => setPhoneIsWhatsapp(e.target.checked)} />
            This is my WhatsApp number
          </label>
          {!phoneIsWhatsapp && (
            <Field label="WhatsApp number" required>
              <input className={input} value={whatsappNumber} onChange={(e) => setWhatsappNumber(e.target.value)} />
            </Field>
          )}
          {practitioners.length > 0 && (
            <Field label="Practitioner (optional)">
              <select className={input} value={practitionerSlug} onChange={(e) => setPractitionerSlug(e.target.value)}>
                <option value="">Any available</option>
                {practitioners.map((p) => (
                  <option key={p.id} value={p.slug}>
                    {p.title ? `${p.title} ` : ""}
                    {p.first_name} {p.last_name}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Reason for visit (optional)">
            <input className={input} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Skin rash" />
          </Field>
          <button
            disabled={!detailsValid}
            onClick={() => setStep("slot")}
            className={btnPrimary}
          >
            Continue
          </button>
        </div>
      )}

      {/* SLOT */}
      {step === "slot" && (
        <div className="mt-6 flex flex-col gap-3">
          <Field label={isLive ? "Choose a date" : "Preferred date"}>
            <input type="date" className={input} value={date} min={todayISO()} onChange={(e) => setDate(e.target.value)} />
          </Field>

          {isLive ? (
            loadingSlots ? (
              <p className="text-sm text-text-secondary flex items-center gap-2">
                <Loader2 size={15} className="animate-spin" /> Loading slots…
              </p>
            ) : slots.length === 0 ? (
              <p className="text-sm text-text-secondary">No open slots that day. Try another date.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {slots.map((s) => (
                  <button
                    key={s.start}
                    onClick={() => setSlotStart(s.start)}
                    className={`h-10 rounded-lg border text-sm ${
                      slotStart === s.start
                        ? "border-primary bg-primary text-white"
                        : "border-border bg-surface hover:border-primary/40"
                    }`}
                  >
                    {new Date(s.start).toLocaleTimeString("en-ZA", {
                      timeZone: "Africa/Johannesburg",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </button>
                ))}
              </div>
            )
          ) : (
            <p className="text-sm text-text-secondary">
              We&apos;ll send your preferred date to {clinic.name}. They&apos;ll confirm a time on WhatsApp.
            </p>
          )}

          <div className="flex gap-2">
            <button onClick={() => setStep("details")} className={btnGhost}>
              Back
            </button>
            <button
              disabled={isLive && !slotStart}
              onClick={() => setStep("review")}
              className={btnPrimary}
            >
              Review
            </button>
          </div>
        </div>
      )}

      {/* REVIEW */}
      {step === "review" && (
        <div className="mt-6 flex flex-col gap-3">
          <div className="rounded-xl border border-border bg-surface p-4 text-sm">
            <Row k="Name" v={`${firstName} ${lastName}`.trim()} />
            <Row k="WhatsApp" v={phoneIsWhatsapp ? phone : whatsappNumber} />
            {practitionerSlug && (
              <Row
                k="Practitioner"
                v={
                  practitioners.find((p) => p.slug === practitionerSlug)?.first_name +
                  " " +
                  practitioners.find((p) => p.slug === practitionerSlug)?.last_name
                }
              />
            )}
            {reason && <Row k="Reason" v={reason} />}
            <Row k={isLive ? "Slot" : "Preferred"} v={isLive ? fmtSlot(slotStart) : date} />
          </div>
          {error && <p className="text-sm text-error bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          <div className="flex gap-2">
            <button onClick={() => setStep("slot")} className={btnGhost} disabled={submitting}>
              Back
            </button>
            <button onClick={submit} disabled={submitting} className={btnPrimary}>
              {submitting ? "Booking…" : isLive ? "Confirm booking" : "Send request"}
            </button>
          </div>
        </div>
      )}

      {/* DONE */}
      {step === "done" && result && (
        <div className="mt-8 text-center">
          <div className="mx-auto h-14 w-14 rounded-full bg-accent/15 text-accent-dark grid place-items-center">
            <Check size={28} />
          </div>
          <h2 className="mt-4 text-xl font-bold text-text-primary">
            {result.status === "confirmed" ? "Booking confirmed" : "Request sent"}
          </h2>
          <p className="mt-2 text-text-secondary text-sm">
            {result.status === "confirmed"
              ? `You're booked at ${result.clinic_name}${result.slot_start ? ` for ${fmtSlot(result.slot_start)}` : ""}.`
              : `${result.clinic_name} will confirm a time.`}{" "}
            We&apos;ll message you on WhatsApp — and again when it&apos;s nearly your turn.
          </p>
          <a
            href={`${PATIENT_APP}/q/${result.appointment_id}?t=${result.access_token}&c=${clinic.slug}`}
            className="inline-block mt-6 px-6 py-3 rounded-input bg-primary hover:bg-primary-dark text-white font-medium"
          >
            Track your visit
          </a>
        </div>
      )}
    </div>
  );
}

const input =
  "w-full h-11 px-3 rounded-input border border-border bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30";
const btnPrimary =
  "h-11 flex-1 rounded-input bg-primary hover:bg-primary-dark text-white font-medium disabled:opacity-50";
const btnGhost =
  "h-11 px-5 rounded-input border border-border text-text-secondary hover:bg-background";

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-text-primary mb-1">
        {label} {required && <span className="text-error">*</span>}
      </label>
      {children}
    </div>
  );
}
function Row({ k, v }: { k: string; v: string | undefined }) {
  return (
    <div className="flex justify-between py-1 border-b border-border last:border-0">
      <span className="text-text-secondary">{k}</span>
      <span className="font-medium text-text-primary">{v}</span>
    </div>
  );
}
