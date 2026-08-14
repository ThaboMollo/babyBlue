# Patient Mobile Web App Build Plan (BabyBlue Lite) — MVP v1
> Goal: Patients can **join the queue** and see **live position** on a phone. Minimal friction.

---

## Scope (MVP)
**Must-have**
- Clinic entry (QR code / link per clinic)
- Join queue (walk-in) with name + phone
- Live queue position + status updates (polling every 5–10s)
- Basic intake form submission (configurable per clinic, global defaults inherited)
- Privacy-friendly design (no sensitive data on screen)

**Explicitly NOT in MVP**
- Payments
- Video calls
- Prescriptions
- AI diagnosis
- Full medical history / centralized records
- QR code generation (lives in admin portal repo)

---

## UX Flow (MVP)
1. Patient scans clinic QR / opens link: `/c/:clinicSlug`
2. Sees clinic landing + "Join Queue" button
3. Enters name + phone → `join-queue` Edge Function runs:
   - If active appointment today → reconnects (returns existing token)
   - If no active appointment (or last was done/cancelled) → creates new
4. Redirect to `/q/:appointmentId` (token stored in localStorage)
   - Shows: "You are #3 in line"
   - Shows status: Waiting / In consultation / Done
   - Shows estimated wait (heuristic: avg_minutes × (position - 1))
   - Polls `get-appointment` every 5–10s
5. Optional: link to `/q/:appointmentId/intake` (3–6 configurable questions)

---

## Tech Stack
- **Frontend**: Next.js 14 + TypeScript (App Router, standalone repo)
- **UI**: Tailwind CSS
- **Design system**: BabyBlueTheme.md (Inter font, Blue #0B5AA8, Teal #20C997)
- **Icons**: `lucide-react`
- **Data**: `@supabase/ssr` + `@supabase/supabase-js`
- **Routing**: Next.js App Router (`app/` directory)
- **Realtime**: Polling (5–10s interval via `get-appointment` Edge Function)
- **Deployment**: Vercel

---

## Security Model: Option A — Signed Session Token
- Patient joins queue → `join-queue` Edge Function creates/returns a `access_token` (UUID) stored on the appointment row
- Patient app stores `{ appointmentId, accessToken }` in localStorage
- All reads to appointment data require `appointment_id + access_token` to be passed to `get-appointment` Edge Function
- Edge Function validates token before returning data
- Patients can only see their own appointment (no RLS direct access needed for patients)

---

## Data Model
### Shared Supabase schema (used by both patient app + admin portal)

```sql
-- clinics
id UUID PK
name TEXT
slug TEXT UNIQUE              -- used in /c/:clinicSlug
address TEXT
phone TEXT
avg_consultation_minutes INT DEFAULT 10  -- for estimated wait heuristic
created_at TIMESTAMPTZ

-- profiles (staff — for admin portal auth)
id UUID PK → auth.users(id)
clinic_id UUID → clinics(id)
role TEXT  CHECK IN ('admin', 'reception', 'doctor')
full_name TEXT
created_at TIMESTAMPTZ

-- patients
id UUID PK
clinic_id UUID → clinics(id)
name TEXT
phone TEXT
email TEXT
dob DATE
created_at TIMESTAMPTZ
UNIQUE (clinic_id, phone)

-- appointments
id UUID PK
clinic_id UUID → clinics(id)
patient_id UUID → patients(id)
status TEXT DEFAULT 'waiting'  CHECK IN ('scheduled','waiting','in_consultation','done','cancelled')
appointment_date DATE DEFAULT CURRENT_DATE
access_token UUID DEFAULT gen_random_uuid()   -- Option A token
entered_queue_at TIMESTAMPTZ DEFAULT now()    -- when patient joined
consultation_started_at TIMESTAMPTZ           -- when status → in_consultation
completed_at TIMESTAMPTZ                      -- when status → done
notes TEXT
created_at TIMESTAMPTZ DEFAULT now()

-- intake_question_templates (global defaults)
id UUID PK
question_key TEXT UNIQUE       -- e.g. 'primary_symptom', 'pain_level'
question_text TEXT
question_type TEXT  CHECK IN ('text', 'dropdown', 'scale', 'boolean')
options JSONB                  -- for dropdown type e.g. ["Headache","Fever","Cough"]
sort_order INT DEFAULT 0
is_active BOOLEAN DEFAULT true
created_at TIMESTAMPTZ

-- clinic_intake_questions (per-clinic override/additions)
id UUID PK
clinic_id UUID → clinics(id)
template_id UUID → intake_question_templates(id)  -- NULL if fully custom question
inherit_global BOOLEAN DEFAULT true               -- if true, inherit text/type from template
question_text TEXT                                -- override or custom question text
question_type TEXT  CHECK IN ('text', 'dropdown', 'scale', 'boolean')
options JSONB
sort_order INT DEFAULT 0
is_active BOOLEAN DEFAULT true
created_at TIMESTAMPTZ

-- intake_responses
id UUID PK
appointment_id UUID → appointments(id)
clinic_id UUID → clinics(id)     -- for admin portal RLS
question_id UUID → clinic_intake_questions(id)
question_key TEXT                -- snapshot of key at time of answer
question_text TEXT               -- snapshot of question text at time of answer
answer TEXT
created_at TIMESTAMPTZ

-- appointment_events (audit log)
id UUID PK
clinic_id UUID → clinics(id)
appointment_id UUID → appointments(id)
actor_type TEXT  CHECK IN ('patient', 'staff')
actor_user_id UUID → auth.users(id)  -- NULL for patient actions
event_type TEXT   -- 'queue_joined', 'status_change', 'intake_submitted'
from_status TEXT
to_status TEXT
metadata JSONB
created_at TIMESTAMPTZ
```

### Key indexes
```sql
appointments (clinic_id, appointment_date, status, created_at)
appointments (id, access_token)   -- for token verification
patients (clinic_id, phone)
profiles (clinic_id, role)
```

---

## Edge Functions (Supabase)

### `join-queue`
**Input**: `{ clinic_slug, name, phone }`
**Logic**:
1. Look up clinic by `slug` → return 404 if not found
2. Find or create patient by `(clinic_id, phone)`
3. Look for existing appointment today with status `waiting` or `in_consultation`
4. If found → reconnect: return existing `appointment_id` + `access_token`
5. If not found (or last was `done`/`cancelled`) → create new appointment: `entered_queue_at = now()`
6. Log `appointment_events` row: `event_type = 'queue_joined'`
7. Compute position (count of `waiting` appointments for clinic+today created before this one)
8. Return: `{ appointment_id, access_token, clinic_name, position, is_reconnect }`

### `get-appointment`
**Input**: `{ appointment_id }` + `access_token` (Authorization header or body)
**Logic**:
1. Fetch appointment by `id`, verify `access_token` matches → 403 if not
2. Fetch clinic for `avg_consultation_minutes`
3. Compute position: `COUNT(*) WHERE clinic_id = X AND appointment_date = today AND status = 'waiting' AND entered_queue_at < this.entered_queue_at`
4. Compute `estimated_wait_minutes = avg_consultation_minutes * (position - 1)`
5. Return: `{ appointment: { id, status, entered_queue_at, ... }, position, estimated_wait_minutes, clinic: { name, address } }`

---

## Frontend Build Plan

---

## Phase 0 — Supabase Setup (First, before any frontend)
- [ ] Create Supabase project
- [ ] Run schema SQL (all tables above)
- [ ] Add indexes
- [ ] Enable RLS on all tables
- [ ] Write RLS policies:
  - `clinics`: public read (slug + name + address + avg_consultation_minutes only)
  - `appointments`: no direct client access (all access via Edge Functions)
  - `patients`: no direct client access
  - `intake_responses`: no direct client access
  - `profiles`: auth users read own row; admin portal RLS (clinic-scoped)
- [ ] Seed global `intake_question_templates`:
  - primary_symptom (dropdown: Headache, Fever, Cough, Pain, Other)
  - pain_level (scale: 0–10)
  - duration (dropdown: Today, A few days, A week or more)
  - fever (boolean: Yes/No)
  - allergies (boolean: Yes/No + text if yes)
- [ ] Create `join-queue` Edge Function + deploy
- [ ] Create `get-appointment` Edge Function + deploy
- [ ] Test both Edge Functions with `curl` / Supabase dashboard

**Acceptance**
- Edge Functions return correct data
- No direct patient access to appointment data without a valid token

---

## Phase A — App Skeleton
- [ ] Create Next.js + TypeScript app: `npx create-next-app@latest . --typescript --tailwind --app --no-src-dir --import-alias "@/*"`
- [ ] Install additional dependencies:
  - `@supabase/ssr`
  - `@supabase/supabase-js`
  - `lucide-react`
- [ ] Configure Tailwind with BabyBlue tokens:
  - Primary: `#0B5AA8`
  - Primary Dark: `#083E78`
  - Accent: `#20C997`
  - Accent Dark: `#0FAE7B`
  - Background: `#F7FAFC`
  - Text Primary: `#0F172A`
  - Text Secondary: `#475569`
  - Border: `#E2E8F0`
- [ ] Add Inter font (Google Fonts or system fallback)
- [ ] Create Supabase browser client: `lib/supabase/client.ts`
- [ ] Create Supabase server client: `lib/supabase/server.ts` (for Server Components)
- [ ] Add `.env.local`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] App Router route structure:
  - `app/c/[clinicSlug]/page.tsx` → ClinicLanding (Server Component)
  - `app/q/[appointmentId]/page.tsx` → QueueView (Client Component)
  - `app/q/[appointmentId]/intake/page.tsx` → IntakeForm (Client Component)
  - `app/not-found.tsx` → NotFound
- [ ] Mobile-first base layout: max-width 480–560px centered, 8px spacing scale
- [ ] Create shared UI primitives:
  - `Button` (primary, secondary, destructive + loading state)
  - `Input` (with label + error state, 10–14px radius)
  - `Card` (white surface, slate-200 border, light shadow)
  - `Badge` (Waiting: neutral, In consultation: blue, Done: green)
  - `Spinner`
- [ ] Add BabyBlue logo/icon (from `BabyBlue_icon.png`)

**Acceptance**
- Routes render on mobile screen sizes
- BabyBlue color system applied via Tailwind config
- UI primitives consistent with BabyBlueTheme.md

---

## Phase B — Clinic Landing + Join Queue
### `app/c/[clinicSlug]/page.tsx` (Server Component)
- [ ] Fetch clinic public info by slug (via Supabase client — public read policy)
  - Show: clinic name, address
  - Handle: clinic not found → clear error screen
- [ ] Show BabyBlue icon (small, top of screen)
- [ ] Join Queue button + form (initially hidden, expands on click):
  - Name (required)
  - Phone (required, validated format)
- [ ] On submit → call `join-queue` Edge Function
  - Show loading spinner
  - On success:
    - Store `{ appointmentId, accessToken }` in localStorage key `babyblue_session`
    - Navigate to `/q/:appointmentId`
  - On error → show plain-language error message
- [ ] Handle reconnect case (`is_reconnect: true`): show "Welcome back — reconnecting to your queue position"

**Acceptance**
- Joining creates appointment + redirects to queue view
- Re-joining reconnects to existing appointment if still active
- Name + phone validated before submit

---

## Phase C — Live Queue View
### `app/q/[appointmentId]/page.tsx` (Client Component — `'use client'`)
- [ ] On mount:
  - Read `{ appointmentId, accessToken }` from localStorage
  - If missing or appointmentId doesn't match URL param → show "Session not found" with link back to home
- [ ] Poll `get-appointment` every 5 seconds:
  - Update position, status, estimated wait on each response
  - Show "Updated just now" with timestamp after each successful poll
  - On network error: show offline banner "Unable to connect — retrying…"
- [ ] Queue display:
  - Large position number: "You are **#3** in line" (large, prominent)
  - Status badge (`Badge` component): Waiting / In consultation / Done
  - Estimated wait label: "Estimated wait: ~15 min" (only when status = waiting)
  - "Estimated" label always visible — never promise exact time
- [ ] Status-specific screens:
  - `waiting`: position + estimated wait
  - `in_consultation`: "You're being seen now" (accent green)
  - `done`: "Your visit is complete" + thank you message
  - `cancelled`: "This appointment was cancelled"
- [ ] Manual refresh button (visible at all times)
- [ ] "Complete quick intake" link → `/q/:appointmentId/intake` (shown only when status = waiting AND intake not yet submitted)
- [ ] Stop polling when status is `done` or `cancelled`

**Acceptance**
- Position updates within one poll cycle when admin portal changes status
- Offline banner appears on disconnect, clears on reconnect
- Done state stops polling

---

## Phase D — Quick Intake Form
### `app/q/[appointmentId]/intake/page.tsx` (Client Component — `'use client'`)
- [ ] On mount:
  - Verify session from localStorage
  - Fetch clinic's active intake questions (via `get-appointment` response or separate endpoint)
  - If intake already submitted → show "Intake already submitted" message
- [ ] Render questions dynamically by `question_type`:
  - `text` → `<Input>`
  - `dropdown` → `<select>` styled to match BabyBlue inputs
  - `scale` → range slider (0–10) with numeric display
  - `boolean` → two-button toggle (Yes / No)
- [ ] All questions required before submit
- [ ] On submit → insert `intake_responses` rows (one per question)
  - Show loading state on button
  - On success → navigate back to `/q/:appointmentId` + show toast "Intake submitted"
  - On error → plain-language error, keep form data

**Note on question resolution**:
A clinic's effective question set = all `clinic_intake_questions` where `clinic_id = X AND is_active = true`, ordered by `sort_order`. If `inherit_global = true` and `template_id` is set, the text/type/options are pulled from the template row.

**Acceptance**
- Doctor/reception can view intake responses in admin portal
- Questions reflect the clinic's configured set (inheriting global defaults)
- No duplicate submissions

---

## Phase E — Deployment
- [ ] Create `.env.local` with production Supabase credentials
- [ ] Deploy to Vercel:
  - [ ] Connect GitHub repo
  - [ ] Add env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
  - [ ] Ensure HTTPS (Vercel provides this automatically)
- [ ] Test full flow on a real mobile device

**Note**: QR code generation lives in the admin portal repo. The admin portal generates `https://yourdomain.com/c/{clinicSlug}` and prints it.

---

## Testing Checklist
- [ ] Patient cannot access another patient's appointment (wrong token returns 403)
- [ ] Appointment link reuse works (refresh keeps position)
- [ ] Joining twice reconnects, not duplicates (when status = waiting/in_consultation)
- [ ] Joining after done creates a fresh appointment
- [ ] Polling works on mobile data (slow connection)
- [ ] Offline banner appears when network drops
- [ ] Intake form can't be submitted twice
- [ ] Clinic not found → graceful 404 page
- [ ] No sensitive medical data visible without valid token

---

## Build Order (strict sequence)
```
Phase 0: Supabase schema + Edge Functions
    ↓
Phase A: App skeleton + BabyBlue theme + routing
    ↓
Phase B: Clinic landing + join queue
    ↓
Phase C: Live queue view + polling
    ↓
Phase D: Intake form
    ↓
Phase E: Deploy to Vercel
```

---

## MVP Done Definition
Patient can:
- [ ] Open clinic link/QR
- [ ] Join queue with name + phone
- [ ] Reconnect to existing queue position on re-scan
- [ ] See live position + status (polled every 5s)
- [ ] See estimated wait time
- [ ] Submit quick intake form
- [ ] See "Done" state when consultation is complete
