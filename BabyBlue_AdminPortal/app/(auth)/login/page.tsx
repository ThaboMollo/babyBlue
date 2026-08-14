"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
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
            Admin Portal
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-[#E2E8F0] text-[#0F172A] text-sm focus:outline-none focus:ring-2 focus:ring-[#0B5AA8] focus:border-transparent"
              placeholder="••••••••"
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
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[#475569]">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-[#0B5AA8] font-medium hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
