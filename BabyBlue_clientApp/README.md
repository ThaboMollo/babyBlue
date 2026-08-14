# BabyBlue — Patient Queue App

A mobile-first web app that lets patients join a clinic's walk-in queue from their phone and track their position in real time — no account, no app install, no friction.

Patients scan a QR code (or open a link) at the clinic, enter their name and phone number, and immediately see where they are in line, how long the wait is likely to be, and when it's their turn. While waiting, they can fill in a short intake form so the doctor is prepared before they walk in.

## What it does

- **Marketing site** — the home page (`/`) pitches BabyBlue to practices, with tailored landing pages for dentists (`/for/dentists`), GPs (`/for/gps`) and clinics (`/for/clinics`).
- **Browse clinics** — `/find-a-clinic` lists every clinic on the platform so patients can find their facility and join its queue directly.
- **Join a queue** — each clinic has its own landing page (`/c/[clinicSlug]`) with a simple name + phone form. If the patient already has an active appointment today, they are reconnected to it instead of creating a duplicate.
- **Live queue position** (`/q/[appointmentId]`) — shows "You are #3 in line", the appointment status (Waiting → In consultation → Done), and an estimated wait time. Updates by polling every 7 seconds, with offline detection and manual refresh.
- **Quick intake** (`/q/[appointmentId]/intake`) — 3–6 clinic-configurable questions (text, dropdown, 0–10 scale, yes/no) submitted before the consultation.
- **Session persistence** — the appointment ID and access token are stored in `localStorage`, so patients can close the browser and return to their place in the queue. The clinic directory shows a "You have an active visit" banner when a session exists.

Deliberately **not** included (MVP scope): payments, video calls, prescriptions, medical records, or any account system. Staff-facing queue management and QR code generation live in a separate admin portal.

## How it works

- **Frontend**: Next.js (App Router) + TypeScript + Tailwind CSS, with `lucide-react` icons. Mobile-first layout that renders as a centered card / responsive grid on larger screens.
- **Backend**: Supabase — Postgres for data, and three Edge Functions that the app calls (see `supabase/functions/`):
  - `join-queue` — creates (or reconnects to) today's appointment and returns an access token
  - `get-appointment` — returns queue position, status, estimated wait, and intake questions
  - `submit-intake` — stores the patient's intake answers
- **Auth model**: no login. Each appointment gets a random access token; the token is required for all reads/writes about that appointment.
- **Realtime**: simple polling of `get-appointment` (no websockets), which keeps the stack minimal.

## Project structure

```
app/
  page.tsx                     # Home — marketing landing for practices
  for/{dentists,gps,clinics}/  # Segment landing pages (marketing)
  find-a-clinic/               # Clinic directory + resume-visit banner
  c/[clinicSlug]/              # Clinic landing + join queue form
  q/[appointmentId]/           # Live queue position (polls every 7s)
  q/[appointmentId]/intake/    # Intake questionnaire
components/ui/                 # Button, Card, Input, Badge, Spinner, Toast, PageShell
components/marketing/          # Nav, footer, hero, segment template, FAQ, CTA
lib/
  api.ts                       # Edge Function client
  session.ts                   # localStorage session helpers
  supabase/                    # Supabase clients + database types
supabase/
  functions/                   # join-queue, get-appointment, submit-intake
  migrations/                  # Schema + demo clinic seed
```

## Getting started

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment** — create `.env.local` with your Supabase project credentials:

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
   ```

3. **Set up Supabase** — apply the migrations in `supabase/migrations/` and deploy the Edge Functions:

   ```bash
   npx supabase db push
   npx supabase functions deploy join-queue get-appointment submit-intake
   ```

4. **Run the app**

   ```bash
   npm run dev
   ```

   Open http://localhost:3000. The seed migration includes a demo clinic you can use to try the full flow.

## Design

Styling follows the design system in `BabyBlueTheme.md`: Inter font, primary blue `#0B5AA8`, accent teal `#20C997`, 44px minimum tap targets, and a 560px content column that becomes a centered card on desktop. The full MVP scope and UX flow are documented in `PatientMobileWebBuildPlan.md`.
