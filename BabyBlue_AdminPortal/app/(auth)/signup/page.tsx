"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding`,
        data: { first_name: firstName.trim(), last_name: lastName.trim() },
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // With email confirmation enabled, signUp returns no session — the user
    // must confirm before they have one. Only proceed to onboarding (which does
    // authenticated inserts) when a session actually exists; otherwise prompt
    // them to confirm their email first.
    if (data.session) {
      router.push("/onboarding");
      router.refresh();
    } else {
      setCheckEmail(true);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7FAFC]">
      <div className="bg-white rounded-2xl shadow-sm border border-[#E2E8F0] w-full max-w-md p-8">
        <div className="mb-8 flex flex-col items-center gap-3">
          <Image
            src="/BabyBlue_logo.png"
            alt="BabyBlue"
            width={180}
            height={46}
            priority
          />
          <p className="text-[#475569] text-sm font-medium tracking-wide uppercase">
            Create your clinic account
          </p>
        </div>

        {checkEmail ? (
          <div className="text-center space-y-3">
            <p className="text-[#0F172A] font-semibold">Check your email</p>
            <p className="text-sm text-[#475569]">
              We&apos;ve sent a confirmation link to <span className="font-medium">{email}</span>.
              Confirm your account, then you&apos;ll be taken to set up your clinic.
            </p>
            <Link href="/login" className="inline-block text-[#0B5AA8] font-medium hover:underline text-sm">
              Back to sign in
            </Link>
          </div>
        ) : (
        <form onSubmit={handleSignup} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[#0F172A] mb-1">
                First name
              </label>
              <input
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-[#E2E8F0] text-[#0F172A] text-sm focus:outline-none focus:ring-2 focus:ring-[#0B5AA8] focus:border-transparent"
                placeholder="First name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#0F172A] mb-1">
                Last name
              </label>
              <input
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-[#E2E8F0] text-[#0F172A] text-sm focus:outline-none focus:ring-2 focus:ring-[#0B5AA8] focus:border-transparent"
                placeholder="Last name"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#0F172A] mb-1">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-[#E2E8F0] text-[#0F172A] text-sm focus:outline-none focus:ring-2 focus:ring-[#0B5AA8] focus:border-transparent"
              placeholder="you@clinic.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#0F172A] mb-1">
              Password
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-[#E2E8F0] text-[#0F172A] text-sm focus:outline-none focus:ring-2 focus:ring-[#0B5AA8] focus:border-transparent"
              placeholder="Min 6 characters"
            />
          </div>

          {error && (
            <p className="text-sm text-[#EF4444] bg-red-50 px-3 py-2 rounded-lg">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#0B5AA8] hover:bg-[#083E78] text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>
        )}

        {!checkEmail && (
        <p className="mt-6 text-center text-sm text-[#475569]">
          Already have an account?{" "}
          <Link href="/login" className="text-[#0B5AA8] font-medium hover:underline">
            Sign in
          </Link>
        </p>
        )}
      </div>
    </div>
  );
}
