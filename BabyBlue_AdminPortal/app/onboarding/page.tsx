"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [clinicName, setClinicName] = useState("");
  const [slug, setSlug] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [avgMinutes, setAvgMinutes] = useState("10");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [clinicId, setClinicId] = useState<string | null>(null);

  function handleNameChange(val: string) {
    setClinicName(val);
    setSlug(slugify(val));
  }

  async function handleCreateClinic(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();

    // Require an authenticated session before any privileged insert. Without
    // this, an unconfirmed/expired session would attempt the insert as `anon`
    // and hit a cryptic row-level-security error instead of a clear prompt.
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Please confirm your email and sign in before setting up your clinic.");
      setLoading(false);
      router.push("/login");
      return;
    }

    // Check slug uniqueness
    const { data: existing } = await supabase
      .from("clinics")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (existing) {
      setError("That URL slug is already taken — try a different one.");
      setLoading(false);
      return;
    }

    const { data: clinic, error: clinicError } = await supabase
      .from("clinics")
      .insert({
        name: clinicName,
        slug,
        address: address || null,
        phone: phone || null,
        avg_consultation_minutes: parseInt(avgMinutes) || 10,
      })
      .select()
      .single();

    if (clinicError) {
      setError(clinicError.message);
      setLoading(false);
      return;
    }

    setClinicId(clinic.id);
    setStep(2);
    setLoading(false);
  }

  async function handleCreateProfile(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !clinicId) {
      setError("Session expired. Please log in again.");
      setLoading(false);
      return;
    }

    // Create profile
    const { error: profileError } = await supabase.from("profiles").insert({
      id: user.id,
      clinic_id: clinicId,
      role: "admin",
      full_name: fullName || null,
    });

    if (profileError) {
      setError(profileError.message);
      setLoading(false);
      return;
    }

    // Seed clinic intake questions from global templates
    const { data: templates } = await supabase
      .from("intake_question_templates")
      .select("id, sort_order")
      .eq("is_active", true);

    if (templates && templates.length > 0) {
      await supabase.from("clinic_intake_questions").insert(
        templates.map((t) => ({
          clinic_id: clinicId,
          template_id: t.id,
          inherit_global: true,
          sort_order: t.sort_order,
          is_active: true,
        }))
      );
    }

    router.push("/queue");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7FAFC] p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-[#E2E8F0] w-full max-w-lg p-8">
        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          <div
            className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
              step >= 1 ? "bg-[#0B5AA8] text-white" : "bg-[#E2E8F0] text-[#475569]"
            }`}
          >
            1
          </div>
          <div className="flex-1 h-px bg-[#E2E8F0]" />
          <div
            className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
              step >= 2 ? "bg-[#0B5AA8] text-white" : "bg-[#E2E8F0] text-[#475569]"
            }`}
          >
            2
          </div>
        </div>

        {step === 1 && (
          <>
            <h2 className="text-xl font-bold text-[#0F172A] mb-1">Set up your clinic</h2>
            <p className="text-sm text-[#475569] mb-6">
              This creates your clinic in BabyBlue.
            </p>

            <form onSubmit={handleCreateClinic} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#0F172A] mb-1">
                  Clinic name <span className="text-[#EF4444]">*</span>
                </label>
                <input
                  required
                  value={clinicName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-[#E2E8F0] text-sm focus:outline-none focus:ring-2 focus:ring-[#0B5AA8]"
                  placeholder="City Health Clinic"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#0F172A] mb-1">
                  Patient app URL slug <span className="text-[#EF4444]">*</span>
                </label>
                <input
                  required
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  className="w-full px-3 py-2.5 rounded-lg border border-[#E2E8F0] text-sm focus:outline-none focus:ring-2 focus:ring-[#0B5AA8]"
                  placeholder="city-health-clinic"
                />
                <p className="text-xs text-[#475569] mt-1">
                  Patient QR link: <code className="bg-gray-100 px-1 rounded">/c/{slug || "your-slug"}</code>
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#0F172A] mb-1">
                  Address
                </label>
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-[#E2E8F0] text-sm focus:outline-none focus:ring-2 focus:ring-[#0B5AA8]"
                  placeholder="123 Main St"
                />
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-[#0F172A] mb-1">
                    Phone
                  </label>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-[#E2E8F0] text-sm focus:outline-none focus:ring-2 focus:ring-[#0B5AA8]"
                    placeholder="+27 11 000 0000"
                  />
                </div>
                <div className="w-40">
                  <label className="block text-sm font-medium text-[#0F172A] mb-1">
                    Avg consult (min)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="120"
                    value={avgMinutes}
                    onChange={(e) => setAvgMinutes(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-[#E2E8F0] text-sm focus:outline-none focus:ring-2 focus:ring-[#0B5AA8]"
                  />
                </div>
              </div>

              {error && (
                <p className="text-sm text-[#EF4444] bg-red-50 px-3 py-2 rounded-lg">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || !clinicName || !slug}
                className="w-full bg-[#0B5AA8] hover:bg-[#083E78] text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50"
              >
                {loading ? "Creating clinic…" : "Continue →"}
              </button>
            </form>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="text-xl font-bold text-[#0F172A] mb-1">Your profile</h2>
            <p className="text-sm text-[#475569] mb-6">
              Almost done — tell us your name.
            </p>

            <form onSubmit={handleCreateProfile} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#0F172A] mb-1">
                  Full name
                </label>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-[#E2E8F0] text-sm focus:outline-none focus:ring-2 focus:ring-[#0B5AA8]"
                  placeholder="Dr. Jane Smith"
                />
              </div>

              <p className="text-sm text-[#475569] bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                You will be set as <strong>Admin</strong> for your clinic.
              </p>

              {error && (
                <p className="text-sm text-[#EF4444] bg-red-50 px-3 py-2 rounded-lg">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#20C997] hover:bg-[#0FAE7B] text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50"
              >
                {loading ? "Finishing setup…" : "Go to Queue →"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
