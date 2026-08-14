"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { validatePatientIdentity } from "@/lib/identity";
import type { IdType } from "@/types";

interface Props {
  clinicId: string;
  userId: string;
  today: string;
  waitingCount: number;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

const ID_TYPES: { value: IdType; label: string }[] = [
  { value: "rsa_id", label: "RSA ID" },
  { value: "passport", label: "Passport" },
  { value: "asylum", label: "Asylum / permit" },
];

export default function AddWalkInModal({
  clinicId,
  userId,
  today,
  waitingCount,
  onClose,
  onSuccess,
}: Props) {
  const [name, setName] = useState("");
  const [nationality, setNationality] = useState("South Africa");
  const [idType, setIdType] = useState<IdType>("rsa_id");
  const [idNumber, setIdNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [dob, setDob] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live identity validation. For a valid RSA ID we also derive the DOB.
  const identity = useMemo(
    () => validatePatientIdentity({ idType, idNumber, nationality }),
    [idType, idNumber, nationality]
  );
  const derivedDob = identity.derivedDob; // non-null only for a valid RSA ID
  const effectiveDob = idType === "rsa_id" ? derivedDob ?? "" : dob;
  const idTouched = idNumber.trim().length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!identity.valid) {
      setError(identity.errors[0] ?? "Please check the ID details.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const trimmedId = idNumber.trim();

    // 1. Find-or-create patient — dedupe on ID number first, then phone.
    let patientId: string | null = null;

    const { data: byId } = await supabase
      .from("patients")
      .select("id")
      .eq("clinic_id", clinicId)
      .eq("id_type", idType)
      .eq("id_number", trimmedId)
      .maybeSingle();

    if (byId) {
      patientId = byId.id;
    } else {
      const { data: byPhone } = await supabase
        .from("patients")
        .select("id")
        .eq("clinic_id", clinicId)
        .eq("phone", phone.trim())
        .maybeSingle();
      if (byPhone) patientId = byPhone.id;
    }

    if (!patientId) {
      const { data: newPatient, error: patientError } = await supabase
        .from("patients")
        .insert({
          clinic_id: clinicId,
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim() || null,
          dob: effectiveDob || null,
          nationality: nationality.trim() || null,
          id_type: idType,
          id_number: trimmedId,
        })
        .select("id")
        .single();

      if (patientError || !newPatient) {
        setError(patientError?.message ?? "Failed to create patient.");
        setLoading(false);
        return;
      }
      patientId = newPatient.id;
    }

    // 2. Guard against a duplicate active appointment today.
    const { data: activeAppt } = await supabase
      .from("appointments")
      .select("id, status")
      .eq("clinic_id", clinicId)
      .eq("patient_id", patientId)
      .eq("appointment_date", today)
      .in("status", ["waiting", "in_consultation"])
      .maybeSingle();

    if (activeAppt) {
      setError("This patient is already active in today's queue.");
      setLoading(false);
      return;
    }

    // 3. Insert appointment.
    const { data: appt, error: apptError } = await supabase
      .from("appointments")
      .insert({
        clinic_id: clinicId,
        patient_id: patientId,
        status: "waiting",
        appointment_date: today,
      })
      .select("id")
      .single();

    if (apptError || !appt) {
      setError(apptError?.message ?? "Failed to create appointment.");
      setLoading(false);
      return;
    }

    // 4. Audit event.
    await supabase.from("appointment_events").insert({
      clinic_id: clinicId,
      appointment_id: appt.id,
      actor_type: "staff",
      actor_user_id: userId,
      event_type: "queue_joined",
      from_status: null,
      to_status: "waiting",
    });

    onSuccess(`Added to queue — position #${waitingCount + 1}`);
  }

  const canSubmit = !loading && name.trim() && phone.trim() && identity.valid;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] sticky top-0 bg-white">
          <h2 className="text-lg font-bold text-[#0F172A]">Add Walk-In</h2>
          <button
            onClick={onClose}
            className="p-2 text-[#475569] hover:text-[#0F172A] transition-colors rounded-lg"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <Field label="Full name" required>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              placeholder="Patient name"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Nationality" required>
              <input
                required
                value={nationality}
                onChange={(e) => setNationality(e.target.value)}
                className={inputClass}
                placeholder="South Africa"
              />
            </Field>
            <Field label="ID type" required>
              <select
                value={idType}
                onChange={(e) => setIdType(e.target.value as IdType)}
                className={inputClass}
              >
                {ID_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field
            label={idType === "rsa_id" ? "RSA ID number" : "ID / passport number"}
            required
          >
            <input
              required
              value={idNumber}
              onChange={(e) => setIdNumber(e.target.value)}
              className={inputClass}
              placeholder={idType === "rsa_id" ? "13 digits" : "Document number"}
              inputMode={idType === "rsa_id" ? "numeric" : "text"}
            />
            {idTouched && !identity.valid && (
              <p className="text-xs text-[#EF4444] mt-1">{identity.errors[0]}</p>
            )}
            {idType === "rsa_id" && derivedDob && (
              <p className="text-xs text-[#0FAE7B] mt-1">
                Valid ID — date of birth {new Date(derivedDob).toLocaleDateString("en-ZA")}
              </p>
            )}
          </Field>

          <Field label="Phone" required>
            <input
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputClass}
              placeholder="+27 82 000 0000"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Email" optional>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                placeholder="patient@email.com"
              />
            </Field>
            <Field
              label="Date of birth"
              optional={idType !== "rsa_id"}
            >
              <input
                type="date"
                value={effectiveDob}
                onChange={(e) => setDob(e.target.value)}
                disabled={idType === "rsa_id"}
                className={`${inputClass} disabled:bg-[#F7FAFC] disabled:text-[#94A3B8]`}
              />
            </Field>
          </div>

          {error && (
            <p className="text-sm text-[#EF4444] bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-[#E2E8F0] rounded-lg text-sm font-medium text-[#475569] hover:bg-[#F7FAFC] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="flex-1 bg-[#0B5AA8] hover:bg-[#083E78] text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50 text-sm"
            >
              {loading ? "Adding…" : "Add to Queue"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputClass =
  "w-full px-3 py-2.5 rounded-lg border border-[#E2E8F0] text-sm focus:outline-none focus:ring-2 focus:ring-[#0B5AA8]";

function Field({
  label,
  required,
  optional,
  children,
}: {
  label: string;
  required?: boolean;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-[#0F172A] mb-1">
        {label}{" "}
        {required && <span className="text-[#EF4444]">*</span>}
        {optional && <span className="text-[#475569] font-normal">(optional)</span>}
      </label>
      {children}
    </div>
  );
}
