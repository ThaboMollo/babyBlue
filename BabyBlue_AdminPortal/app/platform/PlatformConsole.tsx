"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { callApi } from "@/lib/api";

interface ClinicRow {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  suburb: string | null;
  status: "pending" | "active" | "suspended";
  booking_mode: string;
  admin: { name: string; email: string | null } | null;
}

const STATUS_STYLE: Record<ClinicRow["status"], string> = {
  pending: "bg-[#FEF3C7] text-[#92400E]",
  active: "bg-[#DCFCE7] text-[#166534]",
  suspended: "bg-[#FEE2E2] text-[#991B1B]",
};

export default function PlatformConsole() {
  const [clinics, setClinics] = useState<ClinicRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const token = useCallback(async () => {
    const {
      data: { session },
    } = await createClient().auth.getSession();
    return session?.access_token ?? null;
  }, []);

  const load = useCallback(async () => {
    setError(null);
    const t = await token();
    if (!t) {
      setError("Session expired — please sign in again.");
      setLoading(false);
      return;
    }
    try {
      const data = await callApi<{ clinics: ClinicRow[] }>("/v1/platform/clinics", {
        token: t,
        method: "GET",
      });
      setClinics(data.clinics);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load clinics.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(id: string, action: "approve" | "suspend") {
    setBusy(id);
    const t = await token();
    if (!t) {
      setError("Session expired — please sign in again.");
      setBusy(null);
      return;
    }
    try {
      await callApi(`/v1/platform/clinics/${id}/${action}`, { token: t });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusy(null);
    }
  }

  const pendingCount = clinics.filter((c) => c.status === "pending").length;

  return (
    <div>
      <div className="flex items-baseline justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#0F172A]">Clinics</h1>
        {pendingCount > 0 && (
          <span className="text-sm text-[#92400E] bg-[#FEF3C7] px-3 py-1 rounded-full">
            {pendingCount} awaiting approval
          </span>
        )}
      </div>

      {error && <p className="text-sm text-[#EF4444] bg-red-50 px-3 py-2 rounded-lg mb-4">{error}</p>}

      <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-[#475569] text-sm">Loading…</div>
        ) : clinics.length === 0 ? (
          <div className="p-10 text-center text-[#475569] text-sm">No clinics yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F7FAFC] text-left text-xs uppercase tracking-wider text-[#475569]">
                <th className="px-4 py-3">Clinic</th>
                <th className="px-4 py-3">Admin</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {clinics.map((c) => (
                <tr key={c.id} className="border-b border-[#E2E8F0] last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium text-[#0F172A]">{c.name}</div>
                    <div className="text-xs text-[#475569]">
                      {[c.suburb, c.city].filter(Boolean).join(", ") || "—"} · {c.booking_mode}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[#475569]">
                    {c.admin ? (
                      <>
                        <div>{c.admin.name || "—"}</div>
                        <div className="text-xs">{c.admin.email ?? "—"}</div>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_STYLE[c.status]}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {c.status !== "active" ? (
                      <button
                        disabled={busy === c.id}
                        onClick={() => act(c.id, "approve")}
                        className="bg-[#0B5AA8] hover:bg-[#083E78] text-white text-xs font-medium px-3 py-1.5 rounded-lg disabled:opacity-50"
                      >
                        {busy === c.id ? "…" : "Approve"}
                      </button>
                    ) : (
                      <button
                        disabled={busy === c.id}
                        onClick={() => act(c.id, "suspend")}
                        className="border border-[#E2E8F0] text-[#475569] hover:bg-[#F7FAFC] text-xs font-medium px-3 py-1.5 rounded-lg disabled:opacity-50"
                      >
                        {busy === c.id ? "…" : "Suspend"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
