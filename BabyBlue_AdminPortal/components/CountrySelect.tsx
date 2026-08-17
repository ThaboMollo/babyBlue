"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import { COUNTRIES } from "@/lib/countries";

interface Props {
  value: string;
  onChange: (country: string) => void;
}

/**
 * Searchable country dropdown. Commits only a value picked from the list (typed
 * text filters but never becomes the value), so nationality can't be free text.
 */
export default function CountrySelect({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter((c) => c.toLowerCase().includes(q));
  }, [query]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function select(country: string) {
    onChange(country);
    setOpen(false);
    setQuery("");
  }

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full px-3 py-2.5 rounded-lg border border-[#E2E8F0] text-sm text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-[#0B5AA8]"
      >
        <span className={value ? "text-[#0F172A]" : "text-[#94A3B8]"}>
          {value || "Select country"}
        </span>
        <ChevronDown size={16} className="text-[#94A3B8] shrink-0" />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white shadow-lg">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search countries…"
            className="w-full px-3 py-2 text-sm border-b border-[#E2E8F0] rounded-t-lg focus:outline-none"
          />
          <ul className="max-h-56 overflow-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-[#94A3B8]">No match</li>
            ) : (
              filtered.map((c) => (
                <li key={c}>
                  <button
                    type="button"
                    onClick={() => select(c)}
                    className="w-full px-3 py-2 text-left text-sm text-[#0F172A] hover:bg-[#F7FAFC] flex items-center justify-between"
                  >
                    {c}
                    {c === value && <Check size={15} className="text-[#0B5AA8]" />}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
