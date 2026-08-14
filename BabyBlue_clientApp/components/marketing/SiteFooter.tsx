import Link from "next/link";
import Image from "next/image";

const practiceLinks = [
  { href: "/for/dentists", label: "For Dentists" },
  { href: "/for/gps", label: "For GPs" },
  { href: "/for/clinics", label: "For Clinics" },
];

const patientLinks = [
  { href: "/find-a-clinic", label: "Find your clinic" },
  { href: "/c/demo-clinic", label: "Try the demo clinic" },
];

export default function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-4 lg:py-16">
        <div className="md:col-span-2">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/icon.png" alt="" width={36} height={36} className="rounded-lg" />
            <span className="text-lg font-extrabold tracking-tight text-text-primary">
              Clinic<span className="text-accent-dark">OS</span>
            </span>
          </Link>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-text-secondary">
            The walk-in queue, on every patient&apos;s phone. No apps, no accounts —
            just a name, a number, and an honest wait.
          </p>
          <p className="mt-4 text-sm font-medium text-text-primary">
            Patients never pay. Clinics subscribe per site.
          </p>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-text-primary">For practices</h3>
          <ul className="mt-3 space-y-2">
            {practiceLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-sm text-text-secondary transition-colors hover:text-primary"
                >
                  {link.label}
                </Link>
              </li>
            ))}
            <li>
              <a
                href="mailto:hello@babyblue.co.za?subject=BabyBlue%20demo%20request"
                className="text-sm text-text-secondary transition-colors hover:text-primary"
              >
                Book a demo
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-text-primary">For patients</h3>
          <ul className="mt-3 space-y-2">
            {patientLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-sm text-text-secondary transition-colors hover:text-primary"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-text-secondary sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>© 2026 BabyBlue. Built for South African healthcare.</span>
          <span>
            Token-scoped sessions · Row-level security · Designed with POPIA in mind
          </span>
        </div>
      </div>
    </footer>
  );
}
