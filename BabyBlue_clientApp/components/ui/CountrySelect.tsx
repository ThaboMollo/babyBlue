"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import { COUNTRIES } from "@/lib/countries";

interface Props {
  value: string;
  onChange: (country: string) => void;
  id?: string;
}

/**
 * Searchable country dropdown. Commits only a value picked from the list (typed
 * text filters but never becomes the value), so nationality can't be free text.
 */
export default function CountrySelect({ value, onChange, id }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter((c) => c.toLowerCase().includes(q));
  }, [query]);

  // Close on outside click.
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
        id={id}
        onClick={() => setOpen((o) => !o)}
        className="h-12 w-full rounded-[12px] border border-border bg-surface px-4 text-left text-sm text-text-primary flex items-center justify-between focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
      >
        <span className={value ? "" : "text-text-secondary"}>{value || "Select country"}</span>
        <ChevronDown size={16} className="text-text-secondary shrink-0" />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-[12px] border border-border bg-surface shadow-lg">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search countries…"
            className="h-10 w-full rounded-t-[12px] border-b border-border px-4 text-sm focus:outline-none"
          />
          <ul className="max-h-56 overflow-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-4 py-2 text-sm text-text-secondary">No match</li>
            ) : (
              filtered.map((c) => (
                <li key={c}>
                  <button
                    type="button"
                    onClick={() => select(c)}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-background flex items-center justify-between"
                  >
                    {c}
                    {c === value && <Check size={15} className="text-primary" />}
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
