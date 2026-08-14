import { QrCode, Eye, ClipboardCheck } from "lucide-react";
import SectionHeading from "./SectionHeading";

const steps = [
  {
    icon: QrCode,
    title: "Scan & join",
    body: "A patient scans the QR poster at your reception and types a name and phone number. That's the whole signup — ten seconds, any phone, no app store.",
  },
  {
    icon: Eye,
    title: "Watch the line move",
    body: "They see “You're #4 in line” and an honest wait range learned from your actual pace today — from the car park, the taxi rank or the café next door.",
  },
  {
    icon: ClipboardCheck,
    title: "Arrive prepared",
    body: "While they wait, a short intake form briefs your team before the consult. Afterwards, a one-tap rating tells you exactly how the visit landed.",
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-20 bg-background">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
        <SectionHeading
          eyebrow="How it works"
          title="From pavement to consultation in three steps"
          intro="No hardware, no integration project, no patient accounts. Put a poster on the wall and the queue moves to their phones."
        />

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {steps.map((step, i) => (
            <div
              key={step.title}
              className="relative rounded-3xl border border-border bg-surface p-6 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-primary">
                  <step.icon size={22} />
                </span>
                <span className="text-sm font-bold uppercase tracking-[0.15em] text-accent-dark">
                  Step {i + 1}
                </span>
              </div>
              <h3 className="mt-4 text-lg font-bold text-text-primary">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-text-secondary">{step.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
