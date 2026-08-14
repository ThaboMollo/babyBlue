import Link from "next/link";
import { ArrowRight } from "lucide-react";

interface CTASectionProps {
  title: string;
  body: string;
  mailSubject?: string;
}

export default function CTASection({ title, body, mailSubject = "BabyBlue demo request" }: CTASectionProps) {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:pb-24">
      <div className="relative overflow-hidden rounded-3xl bg-primary-dark px-6 py-14 text-center sm:px-12 lg:py-20">
        {/* Decorative rings */}
        <div
          aria-hidden
          className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full border border-white/10"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -right-20 h-96 w-96 rounded-full border border-white/10"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-20 -right-8 h-56 w-56 rounded-full border border-white/10"
        />

        <h2 className="mx-auto max-w-2xl text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          {title}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-blue-100">
          {body}
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href={`mailto:hello@babyblue.co.za?subject=${encodeURIComponent(mailSubject)}`}
            className="inline-flex h-12 items-center gap-2 rounded-xl bg-white px-7 text-base font-semibold text-primary-dark transition-colors hover:bg-blue-50"
          >
            Book a free demo
            <ArrowRight size={18} />
          </a>
          <Link
            href="/c/demo-clinic"
            className="inline-flex h-12 items-center rounded-xl border border-white/40 px-7 text-base font-semibold text-white transition-colors hover:bg-white/10"
          >
            See it live first
          </Link>
        </div>

        <p className="mt-6 text-xs text-blue-200">
          No install for patients · No integration project for you · Pilot in under a week
        </p>
      </div>
    </section>
  );
}
