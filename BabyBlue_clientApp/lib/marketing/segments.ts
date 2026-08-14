import {
  Activity,
  BarChart3,
  Building2,
  CalendarClock,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  DoorOpen,
  Eye,
  EyeOff,
  Frown,
  HelpCircle,
  Hourglass,
  LineChart,
  LogOut,
  ShieldCheck,
  Smile,
  Star,
  Stethoscope,
  Timer,
  TrendingDown,
  UserCheck,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { Stat } from "@/components/marketing/StatsBand";
import type { FAQItem } from "@/components/marketing/FAQ";
import type { HeroChip } from "@/components/marketing/Hero";

export interface SegmentPoint {
  icon: LucideIcon;
  title: string;
  body: string;
}

export interface SegmentContent {
  slug: "dentists" | "gps" | "clinics";
  name: string;
  navLabel: string;
  icon: LucideIcon;
  metaTitle: string;
  metaDescription: string;
  eyebrow: string;
  heroTitle: string;
  heroSub: string;
  heroImage: string;
  heroImageAlt: string;
  queueMock: { clinic: string; position: number; wait: string };
  heroChip: HeroChip;
  mailSubject: string;
  painTitle: string;
  painIntro: string;
  pains: SegmentPoint[];
  featureTitle: string;
  featureIntro: string;
  features: SegmentPoint[];
  stats: Stat[];
  faqs: FAQItem[];
  ctaTitle: string;
  ctaBody: string;
  /** Short pitch used on the home page segment cards */
  cardBlurb: string;
  cardBullets: string[];
}

export const segments: SegmentContent[] = [
  {
    slug: "dentists",
    name: "Dentists",
    navLabel: "For Dentists",
    icon: Smile,
    metaTitle: "For Dentists",
    metaDescription:
      "BabyBlue for dental practices: give anxious patients a live, honest view of their wait, capture pain-score intake before they sit down, and collect five-star feedback at the moment of relief.",
    eyebrow: "BabyBlue for dental practices",
    heroTitle: "An empty waiting room is the sign of a well-run practice.",
    heroSub:
      "Dentistry runs on precision scheduling — and gets ambushed by emergencies, overruns and walk-ins. BabyBlue gives every patient a live, honest view of their wait on their own phone, so the 2 pm crown that runs long doesn't wreck the 3 pm mood.",
    heroImage: "/marketing/hero-dentists.webp",
    heroImageAlt:
      "A dentist smiling next to a relaxed patient in a modern dental practice",
    queueMock: { clinic: "Bright Smile Dental Studio", position: 2, wait: "~10–15 min" },
    heroChip: {
      icon: ClipboardCheck,
      title: "Intake received",
      sub: "Pain 7/10 · lower left molar",
    },
    mailSubject: "BabyBlue demo — dental practice",
    painTitle: "Sound familiar?",
    painIntro:
      "Every dental front desk fights the same three battles. None of them are about dentistry.",
    pains: [
      {
        icon: CalendarClock,
        title: "One overrun rattles the whole afternoon",
        body: "A crown that takes forty minutes longer ripples through every booking after it. Patients stare at a frozen appointment time; your receptionist absorbs the frustration, one sigh at a time.",
      },
      {
        icon: Frown,
        title: "Anxiety builds by the minute",
        body: "For nervous patients, sitting in front of a closed surgery door is the worst part of the visit. An unknown wait makes the chair scarier — and makes cancellations easier.",
      },
      {
        icon: Zap,
        title: "Emergencies don't book ahead",
        body: "The cracked tooth that walks in at lunchtime has to fit in somewhere. Without a visible queue, walk-ins and booked patients collide at your reception desk.",
      },
    ],
    featureTitle: "What changes with BabyBlue",
    featureIntro:
      "One QR poster at reception moves the wait out of your waiting room and onto their phones — with the chair-side details arriving before the patient does.",
    features: [
      {
        icon: Eye,
        title: "A wait they can watch",
        body: "Walk-in and emergency patients scan, join with a name and number, and see their live place in line — from the car, the pharmacy, anywhere but your doorway.",
      },
      {
        icon: Timer,
        title: "Estimates that match reality",
        body: "Wait times are learned from today's actual pace and shown as an honest range — never a made-up number that erodes trust when the schedule slips.",
      },
      {
        icon: ClipboardList,
        title: "The chair-side brief",
        body: "Chief complaint, a 0–10 pain score, last visit — your own intake questions, answered while they wait and delivered before they recline.",
      },
      {
        icon: Smile,
        title: "Calmer patients, easier dentistry",
        body: "A patient who waited in daylight instead of dread arrives easier to treat. The queue page keeps them informed at every step, without your staff saying a word.",
      },
      {
        icon: Star,
        title: "Five stars at the moment of relief",
        body: "The rating prompt appears on the “visit complete” screen — precisely when the pain is gone and your patient loves you most.",
      },
      {
        icon: BarChart3,
        title: "Know your real chair time",
        body: "Daily medians for waits and consultation lengths show exactly which slots overrun — evidence for smarter scheduling, not gut feel.",
      },
    ],
    stats: [
      { value: "10 sec", label: "for a patient to join the queue" },
      { value: "0–10", label: "pain-scale intake before the chair" },
      { value: "7 sec", label: "between live queue updates" },
      { value: "1 tap", label: "to capture a post-visit rating" },
    ],
    faqs: [
      {
        q: "We run on appointments, not walk-ins. Is this still for us?",
        a: "Yes. BabyBlue handles the part your appointment book can't: emergencies, walk-ins, and the knock-on delays when treatments overrun. Patients who arrive early or get bumped see a live, honest wait instead of silence at the desk — and your booked schedule stays exactly where it is.",
      },
      {
        q: "Will elderly or less tech-savvy patients manage?",
        a: "Joining is two fields on a normal web page — no app store, no password, no download. Anyone who'd rather just take a seat still can; your front desk keeps full control of the same queue from the admin portal.",
      },
      {
        q: "Can we ask our own intake questions?",
        a: "Yes — three to six questions per practice: free text, dropdowns, 0–10 pain scales and yes/no. Answers reach you before the consultation, with the exact wording of each question preserved for your records.",
      },
      {
        q: "Is patient data safe?",
        a: "Each visit gets its own expiring access token, and row-level security means no patient can ever see another patient's information. There are no patient accounts to breach, and queue joins are rate-limited against abuse.",
      },
    ],
    ctaTitle: "Give your patients a wait they can trust.",
    ctaBody:
      "One QR poster at reception. A calmer practice by Friday. Book a demo and watch your own queue move in minutes.",
    cardBlurb:
      "Keep anxious patients calm and your chair time on schedule — even when a walk-in emergency lands at 2 pm.",
    cardBullets: [
      "Live waits patients actually trust",
      "Pain-score intake before they sit down",
      "Ratings captured at the moment of relief",
    ],
  },
  {
    slug: "gps",
    name: "GPs",
    navLabel: "For GPs",
    icon: Stethoscope,
    metaTitle: "For GPs",
    metaDescription:
      "BabyBlue for general practice: put the walk-in queue on every patient's phone, with honest wait times learned from your real pace. Empty the room, keep the list true, start every consult prepared.",
    eyebrow: "BabyBlue for general practice",
    heroTitle: "Monday, 07:58. Fourteen patients at the door. Calm.",
    heroSub:
      "General practice lives and dies by the walk-in queue. BabyBlue puts that queue on every patient's phone — with wait times learned from how fast you're actually consulting today — so the room empties, the desk quietens, and nobody loses their place.",
    heroImage: "/marketing/hero-gps.webp",
    heroImageAlt:
      "A GP listening attentively to an elderly patient in a bright consulting room",
    queueMock: { clinic: "Melville Family Practice", position: 5, wait: "~25–35 min" },
    heroChip: {
      icon: Activity,
      title: "Today's real pace",
      sub: "12 min between consults",
    },
    mailSubject: "BabyBlue demo — GP practice",
    painTitle: "The walk-in reality",
    painIntro:
      "You can't schedule flu season. But you can stop it from running your front desk.",
    pains: [
      {
        icon: HelpCircle,
        title: "The question your desk answers all day",
        body: "“How much longer?” — asked forty times a day, answered with a guess. Every interruption slows down the very queue it's asking about.",
      },
      {
        icon: Users,
        title: "A packed room helps nobody",
        body: "Sick patients sitting shoulder-to-shoulder for two hours is an infection-control problem, not just a comfort problem. They only stay because leaving means losing their place.",
      },
      {
        icon: Hourglass,
        title: "Ghost patients wreck your list",
        body: "People give up and go home without telling anyone. Staff call names into an empty room, and everyone waiting behind a ghost waits longer than they should.",
      },
    ],
    featureTitle: "What changes with BabyBlue",
    featureIntro:
      "The queue becomes something patients carry with them — and something you can finally measure.",
    features: [
      {
        icon: Timer,
        title: "Waits that learn your day",
        body: "Estimates come from the start-to-start pace of today's actual consultations. Slow day, honest number — always shown as a range, never a promise.",
      },
      {
        icon: DoorOpen,
        title: "The waiting room goes remote",
        body: "Patients watch their place from the car, from work, or from the shop next door — and walk back in exactly when it matters.",
      },
      {
        icon: LogOut,
        title: "Leaving is a tap, not a mystery",
        body: "Patients who can't stay cancel properly. Positions correct instantly for everyone behind them, and abandonment finally shows up in your numbers.",
      },
      {
        icon: ClipboardList,
        title: "Triage before the consult",
        body: "Symptoms, duration, a 0–10 severity scale — your own questions, answered in the queue, so you start every consultation already oriented.",
      },
      {
        icon: UserCheck,
        title: "Two-tap return visits",
        body: "Regulars find their details prefilled from their own phone, with a “Not you?” reset. The second visit takes two taps.",
      },
      {
        icon: BarChart3,
        title: "Your day, in numbers",
        body: "Median and p90 waits, consultation lengths, arrivals by hour, abandonment rate — per day, per clinic. Roster the front desk on evidence.",
      },
    ],
    stats: [
      { value: "2", label: "fields to join — name and phone" },
      { value: "7 sec", label: "between live queue updates" },
      { value: "0", label: "apps, accounts or passwords" },
      { value: "3/hr", label: "join rate-limit per phone — junk stays out" },
    ],
    faqs: [
      {
        q: "What do patients need to use it?",
        a: "Any phone with a browser. No app, no account, no data-hungry download — the queue page is lighter than a WhatsApp photo, and it keeps working through flaky connections with an offline banner and automatic retry.",
      },
      {
        q: "What about patients without smartphones?",
        a: "Nothing changes for them. Your staff manage the same queue from the admin portal, so phone patients and take-a-seat patients share one honest line.",
      },
      {
        q: "Will it slow down joining at the front desk?",
        a: "Joining is a name and a phone number — ten seconds. It's a design rule of the product that no feature may ever add a required field to the join flow.",
      },
      {
        q: "We're busy. Will it keep up — and is it secure?",
        a: "The queue updates every seven seconds, reconnects returning patients instead of duplicating them, and rate-limits junk joins. Every visit is protected by its own expiring access token with row-level security underneath — patients only ever see their own place in line.",
      },
    ],
    ctaTitle: "Empty the room, not the list.",
    ctaBody:
      "Watch a live queue move in the demo clinic, then put a QR poster at your reception. Your Monday rush will never look the same.",
    cardBlurb:
      "Tame the Monday-morning rush with honest wait times learned from your actual pace — and a waiting room patients don't have to sit in.",
    cardBullets: [
      "Wait estimates that learn your real pace",
      "Patients wait from the car, not the corridor",
      "Triage answers before the consult",
    ],
  },
  {
    slug: "clinics",
    name: "Clinics",
    navLabel: "For Clinics",
    icon: Building2,
    metaTitle: "For Clinics",
    metaDescription:
      "BabyBlue for clinics and health centres: live queues for patients, and the operational record you've never had — arrivals by hour, real waits, abandonment — per clinic, per day.",
    eyebrow: "BabyBlue for clinics & health centres",
    heroTitle: "You can't fix a queue you can't see.",
    heroSub:
      "High-volume clinics run on flow — and flow has always been invisible. BabyBlue shows patients their place in line, and shows you the whole day: arrivals by hour, real waits, walk-aways. Your operations, finally on the record.",
    heroImage: "/marketing/hero-clinics.webp",
    heroImageAlt:
      "A calm, modern community health clinic reception with a nearly empty waiting area",
    queueMock: { clinic: "Northmead Health Centre", position: 8, wait: "~40–55 min" },
    heroChip: {
      icon: BarChart3,
      title: "Today so far",
      sub: "64 visits · 23 min median wait",
    },
    mailSubject: "BabyBlue demo — clinic / health centre",
    painTitle: "The operational blind spot",
    painIntro:
      "Most clinics discover their bottlenecks the same way patients do: standing in them.",
    pains: [
      {
        icon: EyeOff,
        title: "Flow is invisible in both directions",
        body: "Patients can't see the queue; you can't see the day. Bottlenecks announce themselves as a full room and a stressed front desk — hours too late to do anything about it.",
      },
      {
        icon: TrendingDown,
        title: "Walk-aways vanish without a trace",
        body: "Patients who give up after an hour don't file a complaint — they just never come back. Today you don't even know how many you lost, or on which days.",
      },
      {
        icon: CalendarClock,
        title: "Rosters built on gut feel",
        body: "Staffing Tuesday like Monday because nobody has the arrival curve. Overstaffed at 14:00, drowning at 08:00 — and no data to argue with.",
      },
    ],
    featureTitle: "What changes with BabyBlue",
    featureIntro:
      "Every join, wait, consultation and walk-away becomes a timestamped record — and the waiting room becomes a number you manage, not a mood you absorb.",
    features: [
      {
        icon: LineChart,
        title: "The operations record",
        body: "Every join, status change, intake and patient-leave is written to a timestamped audit trail — the raw, arguable truth of your patient flow.",
      },
      {
        icon: BarChart3,
        title: "Daily flow stats",
        body: "Visits, completions, cancellations, patient abandonment, median and p90 waits, consultation lengths — aggregated per clinic, per day.",
      },
      {
        icon: Clock3,
        title: "Arrivals by hour",
        body: "An hourly arrival curve turns rostering from folklore into arithmetic. Staff the 08:00 wave like you can see it coming — because now you can.",
      },
      {
        icon: Star,
        title: "Experience, on the record",
        body: "One-tap post-visit ratings with optional comments land alongside wait data — so you can see exactly where satisfaction breaks down.",
      },
      {
        icon: Users,
        title: "Every site, one playbook",
        body: "Each facility runs its own queue, its own intake questions and its own pace model — while every patient gets the same two-field join.",
      },
      {
        icon: ShieldCheck,
        title: "Governance-grade security",
        body: "Row-level security on every table, token-scoped patient sessions that expire, rate-limited public endpoints, and staff-only data access via the admin portal.",
      },
    ],
    stats: [
      { value: "p50/p90", label: "wait percentiles, per clinic per day" },
      { value: "24/7", label: "timestamped audit trail of every event" },
      { value: "1–5 ★", label: "post-visit ratings, one tap per patient" },
      { value: "2", label: "fields for any patient to join — name and phone" },
    ],
    faqs: [
      {
        q: "Does this replace our clinical or booking systems?",
        a: "No — it sits at the front door. BabyBlue runs the walk-in queue and its analytics; your clinical, billing and record systems stay exactly as they are. Scheduled-appointment check-in is on the roadmap.",
      },
      {
        q: "What does rollout actually involve?",
        a: "A QR poster at reception, and staff driving statuses from the admin portal. No patient accounts, no hardware, no integration project — a clinic can realistically pilot within a week.",
      },
      {
        q: "How does pricing work?",
        a: "A simple per-clinic subscription. Patients never pay, and there's no per-patient metering — a busy day costs the same as a quiet one.",
      },
      {
        q: "What about language support?",
        a: "English today, with isiZulu, Sesotho and Afrikaans next on the roadmap — including translated intake questions with language-neutral answers for your staff.",
      },
      {
        q: "Is it POPIA-conscious?",
        a: "It's built on data minimalism: a name, a phone number, and the intake answers you choose to ask. Every visit is locked behind its own expiring token, row-level security separates all data, and patients can never see anyone's information but their own.",
      },
    ],
    ctaTitle: "Run the day on data.",
    ctaBody:
      "Book a demo, watch a live queue move, and picture Monday morning with the arrival curve on your side.",
    cardBlurb:
      "See your patient flow for the first time — arrivals, waits, walk-aways — and staff the day on data, not gut feel.",
    cardBullets: [
      "Median & p90 waits, per day",
      "Hourly arrival curve for rostering",
      "Every event on an audit trail",
    ],
  },
];

export function getSegment(slug: SegmentContent["slug"]): SegmentContent {
  const segment = segments.find((s) => s.slug === slug);
  if (!segment) throw new Error(`Unknown segment: ${slug}`);
  return segment;
}
