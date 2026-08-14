import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CheckCircle2, type LucideIcon } from "lucide-react";
import QueueMock from "./QueueMock";

export interface HeroChip {
  icon: LucideIcon;
  title: string;
  sub: string;
}

interface HeroProps {
  eyebrow: string;
  title: string;
  sub: string;
  image: string;
  imageAlt: string;
  queueMock: { clinic: string; position: number; wait: string };
  chip: HeroChip;
  mailSubject: string;
  trustPoints?: string[];
}

const defaultTrustPoints = [
  "No apps or accounts",
  "Works on any phone",
  "Live in under a week",
];

export default function Hero({
  eyebrow,
  title,
  sub,
  image,
  imageAlt,
  queueMock,
  chip,
  mailSubject,
  trustPoints = defaultTrustPoints,
}: HeroProps) {
  const ChipIcon = chip.icon;

  return (
    <section className="relative overflow-hidden">
      {/* Soft background wash */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[560px] bg-gradient-to-b from-blue-50/80 via-background to-background"
      />

      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-12 sm:px-6 lg:grid-cols-2 lg:gap-14 lg:pb-28 lg:pt-20">
        {/* Copy */}
        <div className="animate-fade-up">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-dark">
            {eyebrow}
          </p>
          <h1 className="mt-4 text-4xl font-extrabold leading-[1.08] tracking-tight text-text-primary sm:text-5xl lg:text-[3.4rem]">
            {title}
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-text-secondary sm:text-lg">
            {sub}
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              href={`mailto:hello@babyblue.co.za?subject=${encodeURIComponent(mailSubject)}`}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-7 text-base font-semibold text-white transition-colors hover:bg-primary-dark"
            >
              Book a free demo
              <ArrowRight size={18} />
            </a>
            <Link
              href="/c/demo-clinic"
              className="inline-flex h-12 items-center justify-center rounded-xl border border-primary bg-surface px-7 text-base font-semibold text-primary transition-colors hover:bg-blue-50"
            >
              See it live
            </Link>
          </div>

          <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-2">
            {trustPoints.map((point) => (
              <li
                key={point}
                className="flex items-center gap-1.5 text-sm text-text-secondary"
              >
                <CheckCircle2 size={16} className="text-accent-dark" />
                {point}
              </li>
            ))}
          </ul>
        </div>

        {/* Visual */}
        <div className="relative mb-10 animate-fade-up lg:mb-0">
          <div className="overflow-hidden rounded-3xl border border-border shadow-lg">
            <Image
              src={image}
              alt={imageAlt}
              width={1536}
              height={1024}
              priority
              className="h-full w-full object-cover"
              sizes="(min-width: 1024px) 560px, 100vw"
            />
          </div>

          {/* Floating chip */}
          <div className="absolute right-4 top-4 flex items-center gap-2.5 rounded-2xl border border-border bg-surface/95 p-3 pr-4 shadow-lg backdrop-blur">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-accent-dark">
              <ChipIcon size={18} />
            </span>
            <span>
              <span className="block text-sm font-semibold leading-tight text-text-primary">
                {chip.title}
              </span>
              <span className="block text-xs text-text-secondary">{chip.sub}</span>
            </span>
          </div>

          {/* Floating queue card — the product itself */}
          <QueueMock
            clinic={queueMock.clinic}
            position={queueMock.position}
            wait={queueMock.wait}
            className="absolute -bottom-8 left-4 sm:-left-6"
          />
        </div>
      </div>
    </section>
  );
}
