"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ArrowRight, Menu, X } from "lucide-react";

const links = [
  { href: "/for/dentists", label: "For Dentists" },
  { href: "/for/gps", label: "For GPs" },
  { href: "/for/clinics", label: "For Clinics" },
  { href: "/find-a-clinic", label: "Find your clinic" },
];

export default function SiteNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/85 backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
          <Image
            src="/icon.png"
            alt=""
            width={36}
            height={36}
            className="rounded-lg"
          />
          <span className="text-lg font-extrabold tracking-tight text-text-primary">
            Clinic<span className="text-accent-dark">OS</span>
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden items-center gap-1 md:flex">
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={[
                  "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-blue-50 text-primary"
                    : "text-text-secondary hover:bg-slate-100 hover:text-text-primary",
                ].join(" ")}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        <div className="hidden md:block">
          <Link
            href="/c/demo-clinic"
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-white transition-colors hover:bg-primary-dark"
          >
            See a live demo
            <ArrowRight size={16} />
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-text-primary hover:bg-slate-100 md:hidden"
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </nav>

      {/* Mobile panel */}
      {open && (
        <div className="border-t border-border bg-surface px-4 pb-4 pt-2 md:hidden">
          <div className="flex flex-col gap-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={[
                  "rounded-xl px-3 py-3 text-base font-medium",
                  pathname === link.href
                    ? "bg-blue-50 text-primary"
                    : "text-text-primary hover:bg-slate-100",
                ].join(" ")}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/c/demo-clinic"
              onClick={() => setOpen(false)}
              className="mt-2 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-base font-medium text-white"
            >
              See a live demo
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
