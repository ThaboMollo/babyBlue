# BabyBlue — Value Roadmap & Implementation Spec (v1 → v2)

> Status: **Partially implemented (2026-07-16)** — shipped: §3.2 honest waits, §3.3 leave queue, §3.4 welcome-back prefill, §4.1 post-visit feedback, §4.2 analytics views, §6.1 rate limiting, §6.2 token expiry. Deferred: §3.1 SMS, §4.3 multi-language, Tier 3, §6.3–6.5 ops items.
> Scope: the patient mobile web app + its Supabase backend. Admin-portal features are flagged where they are the other half of a feature.

---

## 1. Context — what, who, why

**What it is.** A no-login, no-install web app: a patient scans a QR code at a clinic, joins the walk-in queue with a name and phone number, watches their position live, and fills in a short intake form while they wait.

**Who it's for.**
- *Patients* at walk-in-heavy clinics (GP practices, primary-care clinics — starting in South Africa), who today sit in a crowded room for an unknown amount of time because leaving means losing their place.
- *Clinics*, who have no visibility into their own patient flow, and whose reception desks absorb the "how much longer?" question all day.

**Why it exists.** The waiting room is opaque in both directions. The MVP removed the patient's uncertainty ("you are #3, ~20 min"). The value roadmap below follows one thesis:

> **The queue position is the hook. The real product is giving patients their time back, and giving clinics the data and communication channel they've never had.**

**Who pays.** Patients never pay. Clinics pay (per-clinic subscription). Every feature below is scored against: does it make patients insist their clinic uses this, or does it make the clinic's subscription easier to justify?

---

## 2. Guiding principles

1. **Never add friction to joining.** Name + phone stays the entire signup. No feature may add a required field to the join flow.
2. **Build on rails we already have.** The schema already captures phone numbers, consultation timestamps, and a full `appointment_events` audit log. Most of Tier 1 is "activate data we already collect."
3. **Patient app stays thin.** Heavy configuration and reporting belong in the admin portal; this app only ever shows the patient *their own* visit.
4. **Everything token-scoped.** All new patient-facing endpoints follow the existing model: `appointment_id + access_token`, validated server-side in an Edge Function, service-role DB access, no direct table access from the client.

---

## 3. Tier 1 — ship next (highest value ÷ effort)

### 3.1 SMS notifications — "It's almost your turn" ⭐ the killer feature

**Problem.** Knowing you're #7 is nice; still having to sit in the waiting room to find out when you become #1 is not. The single biggest value unlock is letting patients *leave* — go to work, the shop, the parking lot — and get called back.

**Value.** Patient: reclaims 30–90 minutes per visit. Clinic: emptier waiting room, fewer front-desk interruptions, and the differentiator that sells the subscription. This is the feature patients will describe to friends.

**UX.**
- Join form gains one *optional* checkbox (default on): "Text me when it's nearly my turn." No new fields — we already have the phone number.
- Two messages max per visit (cost + anti-spam):
  1. On join: "You're #7 at BabyBlue Demo Clinic. Track your place: {link}" — this also solves session recovery if the browser tab is lost.
  2. When position ≤ 2 or status → `in_consultation`: "You're next at {clinic}. Please head back now."

**Implementation.**
- Schema: `ALTER TABLE appointments ADD COLUMN notify_sms BOOLEAN NOT NULL DEFAULT false;` plus a `notifications` table (`id, appointment_id, clinic_id, kind ('joined'|'almost_up'), phone, status ('sent'|'failed'), provider_id, created_at`) — the send log doubles as the idempotency guard (never send the same `kind` twice per appointment).
- Trigger path: Postgres trigger on `appointments` status change + a check inside `get-appointment`'s position computation is *not* reliable enough; instead use a **`pg_cron` job every minute** (or a Database Webhook on `appointments` UPDATE) invoking a new `send-notifications` Edge Function that scans for: appointments with `notify_sms = true`, no `almost_up` row in `notifications`, and computed position ≤ 2. This keeps the logic in one place and survives staff updating statuses from the admin portal.
- Provider: start with **BulkSMS or Clickatell** (SA-local rates, ~R0.25–0.35/SMS) behind a tiny provider interface so Twilio can be swapped in for other markets. Secret lives in Edge Function env, never in the app.
- `join-queue` passes `notify_sms` through and enqueues the `joined` message.
- **Hard requirement before launch: rate-limit `join-queue`** (see §6) — an SMS-sending public endpoint is an SMS-bombing vector otherwise.

**Effort:** ~3–4 dev-days incl. provider account + testing. **Risk:** SMS cost scales with volume — cap at 2/visit and make the "joined" SMS a per-clinic setting.

---

### 3.2 Honest wait times — learn from today's actual pace

**Problem.** The estimate is `avg_consultation_minutes × (position − 1)` with a hardcoded per-clinic constant (default 10). On a slow day the app confidently lies, and a wrong estimate is worse than none — it erodes the product's core promise.

**Value.** Trust. The estimate is the second thing every patient looks at.

**Implementation** (confined to `get-appointment`):
- We already store `consultation_started_at` and `completed_at`. Compute a **rolling average of the last 5 completed consultations for this clinic today**; fall back to `avg_consultation_minutes` when fewer than 3 samples exist.
- Better model: wait ≈ position × (average *start-to-start* interval), since throughput — not consultation length — is what the patient experiences. Derivable from `consultation_started_at` deltas of today's appointments.
- Present as a **range** ("~20–35 min") rather than a point estimate: `[0.8×, 1.4×]` of the model output, rounded to 5 min. Honest and cheaper than being precise.
- One SQL query added per poll; today's appointments per clinic is small, existing index covers it.

**Effort:** ~1 dev-day. **Risk:** none meaningful; keep the "estimate only" disclaimer.

---

### 3.3 Leave the queue — patient-initiated cancel

**Problem.** Patients who give up and walk away stay in the queue as ghosts. Everyone behind them sees a position that's too pessimistic, staff call patients who left an hour ago, and our wait-time model (§3.2) trains on garbage.

**Value.** Queue accuracy for every other patient; fewer dead calls for staff. Also basic patient dignity — they should be able to undo joining.

**Implementation.**
- New Edge Function `cancel-appointment`: input `{ appointment_id, access_token }`; verify token (same pattern as `submit-intake`); allow only from `waiting` (not `in_consultation`); set `status = 'cancelled'`, log `appointment_events` (`actor_type: 'patient'`, `event_type: 'queue_left'`, `from_status/to_status`).
- Queue page: quiet "Leave queue" text button under the status card → confirmation dialog ("You'll lose your place") → on success, clear session, route home with a toast.
- The distinct `queue_left` event type lets the clinic distinguish patient abandonment from staff cancellation in analytics (§4.2) — that's a metric clinics will care about ("we lose 18% of walk-ins after 40 minutes").

**Effort:** ~1 dev-day.

---

### 3.4 Welcome back — returning-patient prefill

**Problem.** A returning patient retypes name and phone every visit, on a phone keyboard, while standing at a reception desk.

**Value.** The second visit becomes two taps. Cheap loyalty; makes the QR poster feel "smart."

**Implementation.** Client-only. On successful join, store `{ name, phone }` in a separate localStorage key (`babyblue_patient`, distinct from the session). On the join form, prefill both fields with a "Not you? Clear" link. No schema or API changes; the server already reconciles by normalized phone. Explicitly *not* auto-submit — the visible confirm step is the privacy guard on shared phones.

**Effort:** ~0.5 dev-day.

---

## 4. Tier 2 — the clinic-side value (what justifies the invoice)

### 4.1 Post-visit feedback — one tap on the Done screen

**Problem.** The Done screen is a dead end. The clinic gets no signal about patient experience, and we waste the one moment we have the patient's full attention and goodwill.

**Implementation.**
- Done screen gains a 1–5 star tap + optional one-line comment, submitted once.
- Schema: `visit_feedback (id, appointment_id UNIQUE, clinic_id, rating INT CHECK 1–5, comment TEXT, created_at)`, RLS: staff-read only (same pattern as `intake_responses`).
- New Edge Function `submit-feedback` (token-verified, only when status = `done`, upsert-guarded like intake).
- Admin portal later charts rating vs. wait time — the correlation *is* the sales deck.

**Effort:** ~1.5 dev-days (patient side + function).

### 4.2 Clinic flow analytics — activate `appointment_events`

**Problem.** We already log every join, status change, intake, and (after §3.3) abandonment with timestamps — and show the clinic none of it. This is the difference between "a queue widget" and "an operations product."

**Implementation.** Data layer lives in this repo's migrations; UI lives in the admin portal.
- SQL views (staff-RLS'd): `v_daily_clinic_stats` — per clinic per day: visits, median/p90 wait (join → consultation start), median consultation length, abandonment rate, arrivals by hour.
- These views also make the wait-estimate model (§3.2) inspectable by the clinic ("your average consult ran 14 min today").
- Deliverable here: one migration + verification queries; portal dashboard is a separate work item.

**Effort:** ~1 dev-day (views + tests) here; portal UI separate.

### 4.3 Multi-language patient app

**Problem.** The target market speaks 11+ official languages; the patient app is English-only. For public-sector and township clinics this is an adoption blocker, not a nice-to-have.

**Implementation.**
- `next-intl` with locale detection + a manual toggle on the landing page; start with **English, isiZulu, Sesotho, Afrikaans**. The app has maybe 40 strings — the frontend is the cheap half.
- Intake questions are DB content: add `translations JSONB` (`{"zu": {"question_text": "...", "options": [...]}}`) to `intake_question_templates` and `clinic_intake_questions`; `get-appointment` accepts an optional `locale` and resolves with English fallback. `question_key` snapshots in responses stay language-neutral, so staff always read answers consistently.

**Effort:** ~3 dev-days + translation cost. Sequence after Tier 1 unless a specific pilot clinic needs it sooner.

---

## 5. Tier 3 — bigger bets (decide after pilot feedback)

| Bet | One-liner | Why wait |
|---|---|---|
| **Scheduled appointments** | The `scheduled` status already exists in the schema, unused. Book-ahead slots + "arrive & check in" merges booked and walk-in patients into one queue — this turns a queue tool into the clinic's front door, and roughly doubles the product surface (slot config, capacity, no-show policy). | Biggest prize, biggest scope. Needs pilot-clinic pull first. |
| **WhatsApp channel** | Same triggers as §3.1 via WhatsApp Business API — in SA, WhatsApp >> SMS culturally, richer messages, cheaper at volume. | Ship SMS first (no approval process); the §3.1 provider interface is the seam to add this without rework. |
| **Supabase Realtime instead of polling** | Broadcast queue changes over websockets; instant updates, less function invocation load. | Polling at 7 s is fine to ~hundreds of concurrent patients. Revisit at scale; keep polling as the fallback path. |
| **PWA install + offline shell** | Manifest + service worker so the queue page survives flaky connections and can live on the home screen. | Cheap (~1 day) but only valuable once repeat usage exists. |

---

## 6. Hardening workstream (not features, still CTO priorities)

Do alongside Tier 1 — items 1 and 2 are **prerequisites for SMS (§3.1)**:

1. **Rate-limit `join-queue`** — per-IP and per-phone (e.g. 3 joins/hour/phone via a check against recent `appointments`, 20/hour/IP). Today the endpoint is unauthenticated by design; that's fine until it can spend money (SMS) or fill a clinic's queue with junk.
2. **Access-token lifecycle** — tokens currently live forever. Reject tokens for appointments older than `appointment_date + 1 day` in the verification step of all token-checked functions.
3. **Production deployment** — the demo runs off localhost. Vercel project + custom domain (`app.babyblue.co.za` or similar), env vars in Vercel, QR posters must point at the real domain.
4. **Supabase tier** — free tier pauses after ~1 week idle and would take pilot clinics down with it. Move to a paid plan the day a real clinic onboards.
5. **Monitoring** — Edge Function error alerting (Supabase log drains or a scheduled advisor check) + uptime ping on `/c/demo-clinic`. A clinic whose queue dies at 8 am on a Monday churns.

---

## 7. Recommended sequence (first ~3 weeks after demo)

| Week | Ship | Why this order |
|---|---|---|
| 1 | §3.2 honest waits · §3.3 leave queue · §3.4 welcome back · §6.3 deploy | All small, all sharpen the core loop; deploy unblocks real-device pilots |
| 2 | §6.1 rate limiting · §6.2 token expiry · §3.1 **SMS notifications** | The killer feature, safely |
| 3 | §4.1 feedback · §4.2 analytics views · §6.4–6.5 ops | Builds the clinic-facing value story for the next sales conversation |

Decision checkpoint after week 3: pilot-clinic feedback decides between **scheduled appointments** and **multi-language + WhatsApp** as the next epic.

---

## 8. Explicitly out of scope (unchanged from MVP)

Payments, video consultations, prescriptions, medical records, AI triage/diagnosis, patient accounts. Each would change the regulatory posture (POPIA/medical-records territory) and break principle #1. Revisit only with a clinic partner asking and a compliance review.
