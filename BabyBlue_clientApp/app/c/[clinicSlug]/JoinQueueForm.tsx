"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Card from "@/components/ui/Card";
import { joinQueue } from "@/lib/api";
import { validatePatientIdentity, type IdType } from "@babyblue/core";
import {
  saveSession,
  savePatientInfo,
  loadPatientInfo,
  clearPatientInfo,
} from "@/lib/session";
import { Users } from "lucide-react";

interface JoinQueueFormProps {
  clinicSlug: string;
  clinicName: string;
}

interface FormErrors {
  name?: string;
  phone?: string;
  whatsapp?: string;
  idNumber?: string;
  general?: string;
}

const ID_TYPES: { value: IdType; label: string }[] = [
  { value: "rsa_id", label: "RSA ID" },
  { value: "passport", label: "Passport" },
  { value: "asylum", label: "Asylum / permit" },
];

const selectClass = [
  "h-12 w-full rounded-[12px] border border-border bg-surface px-4",
  "text-sm text-text-primary",
  "transition-colors duration-150",
  "focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20",
].join(" ");

function validatePhone(phone: string): boolean {
  // Accept international or local formats
  return /^[+\d\s\-()]{7,15}$/.test(phone.trim());
}

export default function JoinQueueForm({ clinicSlug, clinicName }: JoinQueueFormProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [nationality, setNationality] = useState("South Africa");
  const [idType, setIdType] = useState<IdType>("rsa_id");
  const [idNumber, setIdNumber] = useState("");
  const [phone, setPhone] = useState("");
  // Phone is NOT assumed to be WhatsApp — patient confirms it (Seam 1).
  const [phoneIsWhatsapp, setPhoneIsWhatsapp] = useState(true);
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [prefilled, setPrefilled] = useState(false);

  // Welcome back — returning patients shouldn't retype their details.
  // localStorage must be read after hydration, so an effect is the right home.
  useEffect(() => {
    const saved = loadPatientInfo();
    if (saved) {
      const parts = saved.name.trim().split(/\s+/);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFirstName(parts.shift() ?? "");
      setLastName(parts.join(" "));
      setPhone(saved.phone);
      if (saved.nationality) setNationality(saved.nationality);
      if (saved.id_type) setIdType(saved.id_type);
      if (saved.id_number) setIdNumber(saved.id_number);
      setPrefilled(true);
    }
  }, []);

  // Live identity validation. A valid RSA ID also yields the date of birth.
  const identity = useMemo(
    () => validatePatientIdentity({ idType, idNumber, nationality }),
    [idType, idNumber, nationality]
  );
  const idTouched = idNumber.trim().length > 0;

  function handleClearSaved() {
    clearPatientInfo();
    setFirstName("");
    setLastName("");
    setPhone("");
    setPhoneIsWhatsapp(true);
    setWhatsappNumber("");
    setNationality("South Africa");
    setIdType("rsa_id");
    setIdNumber("");
    setPrefilled(false);
  }

  function validate(): boolean {
    const errs: FormErrors = {};
    if (!firstName.trim()) errs.name = "Please enter your first name.";
    if (!phone.trim()) {
      errs.phone = "Please enter your phone number.";
    } else if (!validatePhone(phone)) {
      errs.phone = "Please enter a valid phone number.";
    }
    if (!phoneIsWhatsapp && !validatePhone(whatsappNumber)) {
      errs.whatsapp = "Please enter a valid WhatsApp number.";
    }
    if (!identity.valid) {
      errs.idNumber = identity.errors[0] ?? "Please check your ID details.";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setErrors({});

    try {
      const result = await joinQueue({
        clinic_slug: clinicSlug,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim(),
        phone_is_whatsapp: phoneIsWhatsapp,
        whatsapp_number: phoneIsWhatsapp ? undefined : whatsappNumber.trim(),
        nationality: nationality.trim(),
        id_type: idType,
        id_number: idNumber.trim(),
        dob: identity.derivedDob,
        consent_records_storage: consent,
      });

      saveSession({
        appointmentId: result.appointment_id,
        accessToken: result.access_token,
        clinicSlug,
      });
      savePatientInfo({
        name: `${firstName.trim()} ${lastName.trim()}`.trim(),
        phone: phone.trim(),
        nationality: nationality.trim(),
        id_type: idType,
        id_number: idNumber.trim(),
      });

      router.push(`/q/${result.appointment_id}`);
    } catch (err) {
      setErrors({
        general:
          err instanceof Error
            ? err.message
            : "Something went wrong. Please try again.",
      });
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-md">
      {!expanded ? (
        <Button size="lg" onClick={() => setExpanded(true)} className="w-full">
          <Users size={18} />
          Join Queue
        </Button>
      ) : (
        <Card>
          <h2 className="text-lg font-semibold text-text-primary mb-md">
            Join the queue at {clinicName}
          </h2>

          {prefilled && (
            <p className="text-sm text-text-secondary mb-md -mt-2">
              Welcome back — we&apos;ve filled in your details.{" "}
              <button
                type="button"
                onClick={handleClearSaved}
                className="font-medium text-primary hover:underline"
              >
                Not you?
              </button>
            </p>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-md" noValidate>
            <div className="grid grid-cols-2 gap-sm">
              <Input
                label="First name"
                placeholder="e.g. Thabo"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                error={errors.name}
                autoComplete="given-name"
                autoFocus
              />
              <Input
                label="Last name"
                placeholder="e.g. Dlamini"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                autoComplete="family-name"
              />
            </div>

            <div className="grid grid-cols-2 gap-sm">
              <Input
                label="Nationality"
                placeholder="South Africa"
                value={nationality}
                onChange={(e) => setNationality(e.target.value)}
                autoComplete="country-name"
              />
              <div className="flex flex-col gap-1">
                <label htmlFor="id-type" className="text-sm font-medium text-text-primary">
                  ID type
                </label>
                <select
                  id="id-type"
                  value={idType}
                  onChange={(e) => setIdType(e.target.value as IdType)}
                  className={selectClass}
                >
                  {ID_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <Input
                label={idType === "rsa_id" ? "RSA ID number" : "ID / passport number"}
                placeholder={idType === "rsa_id" ? "13 digits" : "Document number"}
                value={idNumber}
                onChange={(e) => setIdNumber(e.target.value)}
                error={errors.idNumber}
                inputMode={idType === "rsa_id" ? "numeric" : "text"}
              />
              {idTouched && !errors.idNumber && !identity.valid && (
                <p className="text-xs text-error mt-1">{identity.errors[0]}</p>
              )}
              {idType === "rsa_id" && identity.derivedDob && (
                <p className="text-xs text-accent-dark mt-1">
                  Verified · date of birth{" "}
                  {new Date(identity.derivedDob).toLocaleDateString("en-ZA")}
                </p>
              )}
            </div>

            <Input
              label="Phone number"
              type="tel"
              placeholder="e.g. 082 123 4567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              error={errors.phone}
              autoComplete="tel"
            />

            <label className="flex items-center gap-2 -mt-1 cursor-pointer">
              <input
                type="checkbox"
                checked={phoneIsWhatsapp}
                onChange={(e) => setPhoneIsWhatsapp(e.target.checked)}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary/20"
              />
              <span className="text-sm text-text-secondary">
                This is my WhatsApp number
              </span>
            </label>

            {!phoneIsWhatsapp && (
              <Input
                label="WhatsApp number"
                type="tel"
                placeholder="e.g. 082 123 4567"
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                error={errors.whatsapp}
                autoComplete="tel"
              />
            )}

            <p className="text-xs text-text-secondary -mt-1">
              We use your ID number only to link you to your medical records at this
              clinic. It&apos;s stored securely and never shared.
            </p>

            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary/20"
              />
              <span className="text-sm text-text-secondary">
                Store my visit records with {clinicName} so my care team can see my
                history on future visits. I can withdraw consent at any time.
              </span>
            </label>

            {errors.general && (
              <p className="text-sm text-error rounded-xl bg-red-50 border border-error/20 px-4 py-3">
                {errors.general}
              </p>
            )}

            <Button type="submit" size="lg" loading={loading} className="w-full mt-sm">
              {loading ? "Joining queue…" : "Join Queue"}
            </Button>

            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="text-sm text-text-secondary text-center mt-1 hover:text-text-primary transition-colors"
            >
              Cancel
            </button>
          </form>
        </Card>
      )}

      <p className="text-xs text-text-secondary text-center px-md">
        Your information is only used to manage your visit. We don&apos;t share it.
      </p>
    </div>
  );
}
