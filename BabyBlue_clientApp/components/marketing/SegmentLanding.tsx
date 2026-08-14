import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { SegmentContent } from "@/lib/marketing/segments";
import { segments } from "@/lib/marketing/segments";
import SiteNav from "./SiteNav";
import SiteFooter from "./SiteFooter";
import Hero from "./Hero";
import SectionHeading from "./SectionHeading";
import StatsBand from "./StatsBand";
import HowItWorks from "./HowItWorks";
import FAQ from "./FAQ";
import CTASection from "./CTASection";

export default function SegmentLanding({ segment }: { segment: SegmentContent }) {
  const others = segments.filter((s) => s.slug !== segment.slug);

  return (
    <>
      <SiteNav />
      <main>
        <Hero
          eyebrow={segment.eyebrow}
          title={segment.heroTitle}
          sub={segment.heroSub}
          image={segment.heroImage}
          imageAlt={segment.heroImageAlt}
          queueMock={segment.queueMock}
          chip={segment.heroChip}
          mailSubject={segment.mailSubject}
        />

        {/* Pain points */}
        <section className="bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
            <SectionHeading
              eyebrow="The problem"
              title={segment.painTitle}
              intro={segment.painIntro}
            />
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {segment.pains.map((pain) => (
                <div
                  key={pain.title}
                  className="rounded-3xl border border-border bg-background p-6"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-text-secondary">
                    <pain.icon size={22} />
                  </span>
                  <h3 className="mt-4 text-lg font-bold text-text-primary">
                    {pain.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                    {pain.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="bg-background">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
            <SectionHeading
              eyebrow="The fix"
              title={segment.featureTitle}
              intro={segment.featureIntro}
            />
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {segment.features.map((feature) => (
                <div
                  key={feature.title}
                  className="rounded-3xl border border-border bg-surface p-6 shadow-sm transition-shadow hover:shadow-md"
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
          </div>
        </section>

        <StatsBand stats={segment.stats} />

        <HowItWorks />

        {/* FAQ */}
        <section className="bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
            <SectionHeading
              eyebrow="Questions"
              title="Answers before you ask"
            />
            <div className="mt-10">
              <FAQ items={segment.faqs} />
            </div>
          </div>
        </section>

        {/* Cross-links to the other segments */}
        <section className="bg-background">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
            <p className="text-center text-sm font-semibold uppercase tracking-[0.15em] text-text-secondary">
              Not quite your practice?
            </p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {others.map((other) => (
                <Link
                  key={other.slug}
                  href={`/for/${other.slug}`}
                  className="group flex items-center gap-4 rounded-2xl border border-border bg-surface p-5 transition-colors hover:border-primary/40"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-primary">
                    <other.icon size={22} />
                  </span>
                  <span className="flex-1">
                    <span className="block text-base font-bold text-text-primary">
                      BabyBlue for {other.name}
                    </span>
                    <span className="block text-sm text-text-secondary">
                      {other.cardBlurb}
                    </span>
                  </span>
                  <ArrowRight
                    size={18}
                    className="shrink-0 text-text-secondary transition-transform group-hover:translate-x-1 group-hover:text-primary"
                  />
                </Link>
              ))}
            </div>
          </div>
        </section>

        <CTASection
          title={segment.ctaTitle}
          body={segment.ctaBody}
          mailSubject={segment.mailSubject}
        />
      </main>
      <SiteFooter />
    </>
  );
}
