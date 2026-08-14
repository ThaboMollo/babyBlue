"use client";

import { useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Download, ExternalLink, ClipboardList } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Clinic } from "@/types";

const PATIENT_APP_DOMAIN =
  process.env.NEXT_PUBLIC_PATIENT_APP_URL ?? "https://patients.babyblue.app";

interface Props {
  clinic: Clinic | null;
}

export default function SettingsClient({ clinic: initialClinic }: Props) {
  const [clinic, setClinic] = useState(initialClinic);
  const [name, setName] = useState(initialClinic?.name ?? "");
  const [slug, setSlug] = useState(initialClinic?.slug ?? "");
  const [address, setAddress] = useState(initialClinic?.address ?? "");
  const [phone, setPhone] = useState(initialClinic?.phone ?? "");
  const [avgMinutes, setAvgMinutes] = useState(
    String(initialClinic?.avg_consultation_minutes ?? 10)
  );
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const supabase = createClient();
  const patientUrl = `${PATIENT_APP_DOMAIN}/c/${clinic?.slug ?? ""}`;

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const { data, error } = await supabase
      .from("clinics")
      .update({
        name,
        slug,
        address: address || null,
        phone: phone || null,
        avg_consultation_minutes: parseInt(avgMinutes) || 10,
      })
      .eq("id", clinic!.id)
      .select()
      .single();

    setSaving(false);

    if (error) { showToast("Error: " + error.message); return; }
    setClinic(data);
    showToast("Clinic settings saved");
  }

  function copyLink() {
    navigator.clipboard.writeText(patientUrl);
    showToast("Link copied!");
  }

  function downloadQR() {
    const svg = document.querySelector("#qr-code svg") as SVGElement;
    if (!svg) return;
    const data = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([data], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `babyblue-qr-${clinic?.slug}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">Settings</h1>
          <p className="text-sm text-[#475569] mt-0.5">Manage your clinic configuration</p>
        </div>
        <Link
          href="/settings/intake"
          className="flex items-center gap-2 px-4 py-2.5 border border-[#E2E8F0] rounded-lg text-sm font-medium text-[#475569] hover:bg-[#F7FAFC] transition-colors"
        >
          <ClipboardList size={16} />
          Intake Questions
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Clinic settings form */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-[#E2E8F0] p-6">
          <h2 className="font-semibold text-[#0F172A] mb-4">Clinic Details</h2>

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#0F172A] mb-1">
                Clinic name
              </label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-[#E2E8F0] text-sm focus:outline-none focus:ring-2 focus:ring-[#0B5AA8]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#0F172A] mb-1">
                URL slug
              </label>
              <input
                required
                value={slug}
                onChange={(e) =>
                  setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
                }
                className="w-full px-3 py-2.5 rounded-lg border border-[#E2E8F0] text-sm focus:outline-none focus:ring-2 focus:ring-[#0B5AA8]"
              />
              {slug !== initialClinic?.slug && (
                <p className="text-xs text-[#F59E0B] mt-1">
                  ⚠ Changing the slug will break existing QR codes and patient links.
                </p>
              )}
              <p className="text-xs text-[#475569] mt-1">
                Patient link: <span className="font-mono">/c/{slug}</span>
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
                />
              </div>
              <div className="w-48">
                <label className="block text-sm font-medium text-[#0F172A] mb-1">
                  Avg consultation (min)
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

            <button
              type="submit"
              disabled={saving}
              className="bg-[#0B5AA8] hover:bg-[#083E78] text-white font-medium px-6 py-2.5 rounded-lg transition-colors disabled:opacity-50 text-sm"
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </form>
        </div>

        {/* QR Code */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 h-fit">
          <h2 className="font-semibold text-[#0F172A] mb-4">Patient QR Code</h2>

          <div
            id="qr-code"
            className="flex items-center justify-center bg-[#F7FAFC] rounded-xl p-4 mb-4"
          >
            <QRCodeSVG
              value={patientUrl}
              size={160}
              fgColor="#0F172A"
              bgColor="#F7FAFC"
            />
          </div>

          <p className="text-xs text-[#475569] break-all mb-4">{patientUrl}</p>

          <div className="space-y-2">
            <button
              onClick={copyLink}
              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 border border-[#E2E8F0] rounded-lg text-sm font-medium text-[#475569] hover:bg-[#F7FAFC] transition-colors"
            >
              <Copy size={14} />
              Copy Link
            </button>
            <button
              onClick={downloadQR}
              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-[#0B5AA8] hover:bg-[#083E78] text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Download size={14} />
              Download QR
            </button>
            <a
              href={patientUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 border border-[#E2E8F0] rounded-lg text-sm font-medium text-[#475569] hover:bg-[#F7FAFC] transition-colors"
            >
              <ExternalLink size={14} />
              Open Patient App
            </a>
          </div>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#0F172A] text-white text-sm font-medium px-5 py-3 rounded-xl shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
