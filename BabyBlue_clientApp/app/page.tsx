import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  ClipboardList,
  LogOut,
  MapPin,
  ShieldCheck,
  Star,
  Timer,
  UserCheck,
  Users,
} from "lucide-react";
import SiteNav from "@/components/marketing/SiteNav";
import SiteFooter from "@/components/marketing/SiteFooter";
import Hero from "@/components/marketing/Hero";
import SectionHeading from "@/components/marketing/SectionHeading";
import StatsBand from "@/components/marketing/StatsBand";
import HowItWorks from "@/components/marketing/HowItWorks";
import CTASection from "@/components/marketing/CTASection";
import { segments } from "@/lib/marketing/segments";

export const metadata: Metadata = {
  title: "BabyBlue — The waiting room, without the waiting",
  description:
    "BabyBlue puts your walk-in queue on every patient's phone — no app, no account, just a name and a number. Honest wait times, calmer front desks, and the flow data your practice has never had.",
};

const features = [
  {
    icon: Timer,
    title: "Honest wait estimates",
    body: "Ranges learned from today's real consultation pace — never a made-up number that erodes trust the moment the day runs late.",
  },
  {
    icon: LogOut,
    title: "Leave without ghosting",
    body: "Change of plans? Patients cancel properly, positions correct instantly for everyone behind them, and nobody calls a name into an empty room.",
  },
  {
    icon: UserCheck,
    title: "Two-tap return visits",
    body: "Returning patients find their details prefilled from their own device — never from your database — with a “Not you?” reset.",
  },
  {
    icon: ClipboardList,
    title: "Your own intake questions",
    body: "Three to six questions per practice — text, dropdowns, 0–10 scales, yes/no — answered in the queue, delivered before the consult.",
  },
  {
    icon: Star,
    title: "Feedback at peak goodwill",
    body: "A one-tap 1–5 rating with optional comment on the “visit complete” screen — the moment patients are most willing to tell you the truth.",
  },
  {
    icon: BarChart3,
    title: "The flow data you've never had",
    body: "Visits, median and p90 waits, abandonment, arrivals by hour — per clinic, per day. Roster and schedule on evidence.",
  },
];

export default function Home() {
  return (
    <>
      <SiteNav />
      <main>
        <Hero
          eyebrow="Patient queue software · Built in South Africa"
          title="The waiting room, without the waiting."
          sub="BabyBlue lets walk-in patients join your queue from their own phone — no app, no account, just a name and a number — and watch their place in line from wherever they'd rather be. Your front desk gets its day back."
          image="/marketing/hero-home.webp"
          imageAlt="A relaxed patient checking her phone in a bright, modern clinic reception"
          queueMock={{ clinic: "BabyBlue Demo Clinic", position: 3, wait: "~15–20 min" }}
          chip={{ icon: Users, title: "Queue live", sub: "14 waiting · moving now" }}
          mailSubject="BabyBlue demo request"
        />

        <StatsBand
          stats={[
            { value: "2", label: "fields to join the queue — name and phone" },
            { value: "7 sec", label: "between live position updates" },
            { value: "0", label: "downloads, accounts or passwords" },
            { value: "1", label: "QR poster at reception — that's the rollout" },
          ]}
        />

        {/* Segment selector */}
        <section id="segments" className="scroll-mt-20 bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
            <SectionHeading
              eyebrow="Who it's for"
              title="Built around your kind of practice"
              intro="A dental chair, a consulting room and a six-doctor clinic don't queue the same way. Pick your practice — the workflow, the copy and the pitch below are tailored to it."
            />

            <div className="mt-12 grid gap-6 lg:grid-cols-3">
              {segments.map((segment) => (
                <Link
                  key={segment.slug}
                  href={`/for/${segment.slug}`}
                  className="group flex flex-col rounded-3xl border border-border bg-background p-7 transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                    <segment.icon size={24} />
                  </span>
                  <h3 className="mt-5 text-xl font-extrabold tracking-tight text-text-primary">
                    For {segment.name}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                    {segment.cardBlurb}
                  </p>
                  <ul className="mt-4 flex flex-col gap-2">
                    {segment.cardBullets.map((bullet) => (
                      <li
                        key={bullet}
                        className="flex items-start gap-2 text-sm text-text-primary"
                      >
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                        {bullet}
                      </li>
                    ))}
                  </ul>
                  <span className="mt-auto flex items-center gap-1.5 pt-6 text-sm font-semibold text-primary">
                    Explore BabyBlue for {segment.name}
                    <ArrowRight
                      size={16}
                      className="transition-transform group-hover:translate-x-1"
                    />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <HowItWorks />

        {/* Feature grid */}
        <section className="bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
            <SectionHeading
              eyebrow="What you get"
              title="Small app for patients. Big upgrade for you."
              intro="Everything below ships today — no modules, no tiers, no per-patient fees."
            />
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => (
                <div
                  key={feature.title}
                  className="rounded-3xl border border-border bg-background p-6"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-primary">
                    <feature.icon size={22} />
                  </span>
                  <h3 className="mt-4 text-base font-bold text-text-primary">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                    {feature.body}
                  </p>
                </div>
              ))}
            </div>

            {/* Security banner */}
            <div className="mt-6 flex flex-col gap-4 rounded-3xl border border-border bg-primary-dark p-7 sm:flex-row sm:items-center">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-accent">
                <ShieldCheck size={24} />
              </span>
              <div>
                <h3 className="text-base font-bold text-white">
                  Locked down by default
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-blue-100">
                  Token-scoped sessions that expire, row-level security on every table,
                  rate-limited joins, and no patient accounts to breach. Patients only
                  ever see their own place in line — designed with POPIA in mind.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Patient strip */}
        <section className="bg-background">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
            <div className="flex flex-col items-start gap-5 rounded-3xl border border-border bg-emerald-50/60 p-7 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface text-accent-dark shadow-sm">
                  <MapPin size={22} />
                </span>
                <div>
                  <h2 className="text-lg font-bold text-text-primary">
                    At the clinic right now?
                  </h2>
                  <p className="mt-1 text-sm text-text-secondary">
                    If your clinic runs BabyBlue, find it here and join the queue from
                    your phone — no app needed.
                  </p>
                </div>
              </div>
              <Link
                href="/find-a-clinic"
                className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl bg-accent-dark px-5 text-sm font-semibold text-white transition-colors hover:bg-accent"
              >
                Find your clinic
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </section>

        <CTASection
          title="Put your waiting room on their phones."
          body="A QR poster at reception this week; a calmer front desk by Friday. Patients never pay — clinics subscribe per site."
        />
      </main>
      <SiteFooter />
    </>
  );
}
