"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Props {
  email: string;
  role: string;
  firstName: string;
  lastName: string;
}

// Self-service profile: name via RLS (Users can update own profile), password
// via Supabase Auth. Neither needs the service role, so both run client-side.
export default function ProfileClient({ email, role, firstName, lastName }: Props) {
  const router = useRouter();
  const [first, setFirst] = useState(firstName);
  const [last, setLast] = useState(lastName);
  const [nameMsg, setNameMsg] = useState<string | null>(null);
  const [nameSaving, setNameSaving] = useState(false);

  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwSaving, setPwSaving] = useState(false);

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    setNameSaving(true);
    setNameMsg(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setNameMsg("Session expired — please sign in again.");
      setNameSaving(false);
      return;
    }
    const { error } = await supabase
      .from("profiles")
      .update({ first_name: first.trim() || null, last_name: last.trim() || null })
      .eq("id", user.id);
    setNameSaving(false);
    if (error) setNameMsg("Error: " + error.message);
    else {
      setNameMsg("Saved.");
      router.refresh();
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwMsg(null);
    if (pw.length < 6) {
      setPwMsg("Password must be at least 6 characters.");
      return;
    }
    if (pw !== pw2) {
      setPwMsg("Passwords don't match.");
      return;
    }
    setPwSaving(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: pw });
    setPwSaving(false);
    if (error) setPwMsg("Error: " + error.message);
    else {
      setPwMsg("Password updated.");
      setPw("");
      setPw2("");
    }
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold text-[#0F172A] mb-6">My Profile</h1>

      <section className="bg-white rounded-xl border border-[#E2E8F0] p-5 mb-5">
        <h2 className="font-semibold text-[#0F172A] mb-4">Your details</h2>
        <form onSubmit={saveName} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name">
              <input required value={first} onChange={(e) => setFirst(e.target.value)} className={input} />
            </Field>
            <Field label="Last name">
              <input required value={last} onChange={(e) => setLast(e.target.value)} className={input} />
            </Field>
          </div>
          <Field label="Email">
            <input value={email} disabled className={`${input} bg-[#F7FAFC] text-[#94A3B8]`} />
          </Field>
          <Field label="Role">
            <input value={role} disabled className={`${input} bg-[#F7FAFC] text-[#94A3B8] capitalize`} />
          </Field>
          {nameMsg && <p className="text-sm text-[#475569]">{nameMsg}</p>}
          <button disabled={nameSaving} className={btn}>
            {nameSaving ? "Saving…" : "Save changes"}
          </button>
        </form>
      </section>

      <section className="bg-white rounded-xl border border-[#E2E8F0] p-5">
        <h2 className="font-semibold text-[#0F172A] mb-4">Change password</h2>
        <form onSubmit={savePassword} className="space-y-4">
          <Field label="New password">
            <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} className={input} placeholder="Min 6 characters" />
          </Field>
          <Field label="Confirm new password">
            <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} className={input} />
          </Field>
          {pwMsg && <p className="text-sm text-[#475569]">{pwMsg}</p>}
          <button disabled={pwSaving} className={btn}>
            {pwSaving ? "Updating…" : "Update password"}
          </button>
        </form>
      </section>
    </div>
  );
}

const input =
  "w-full px-3 py-2.5 rounded-lg border border-[#E2E8F0] text-sm focus:outline-none focus:ring-2 focus:ring-[#0B5AA8]";
const btn =
  "bg-[#0B5AA8] hover:bg-[#083E78] text-white font-medium px-5 py-2.5 rounded-lg text-sm disabled:opacity-50";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-[#0F172A] mb-1">{label}</label>
      {children}
    </div>
  );
}
