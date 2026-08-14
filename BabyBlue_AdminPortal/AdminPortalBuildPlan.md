# Admin Portal Build Plan (BabyBlue Lite) — MVP v1
> Goal: Reception/clinic staff can **run the queue** reliably. Keep it simple. Ship fast.

## Scope (MVP)
**Must-have**
- Auth (Supabase) + role-based access (admin/reception/doctor)
- Clinic-scoped data (multi-tenant using `clinic_id`)
- Today’s queue view (Waiting / In consultation / Done)
- Add walk-in patient + create “today” appointment
- Update appointment status (Waiting → In consultation → Done; plus Cancel)
- Real-time updates (Supabase Realtime) so all staff screens stay in sync
- Basic audit trail (who changed status + when)

**Explicitly NOT in MVP**
- Billing, payments, claims
- Video/voice calling
- AI diagnosis
- Drag-and-drop reorder (optional later)
- Complex scheduling rules

---

## Tech Stack (recommended)
- **Frontend**: React + TypeScript + Vite
- **UI**: Tailwind or MUI (choose one, keep consistent)
- **State / Data**: TanStack Query (optional but recommended) + Supabase client
- **Auth**: Supabase Auth
- **DB**: Supabase Postgres + RLS
- **Realtime**: Supabase Realtime (postgres changes)

---

## Success Criteria (Pilot)
- Reception can run the queue for a full day with **zero confusion**
- Patients’ positions update within **< 2 seconds** of status changes (network permitting)
- No cross-clinic data leakage (RLS enforced)

---

## Data Model (minimum required)
Tables (all rows scoped by `clinic_id`):
- `clinics`
- `profiles` (maps `auth.users.id` → `clinic_id`, `role`)
- `patients`
- `appointments`
- `intake_responses` (optional for admin portal MVP; needed for doctor view)

**Appointment status enum (recommended):**
- `scheduled`
- `waiting`
- `in_consultation`
- `done`
- `cancelled`

---

## Backend Setup Checklist (Supabase)
### 1) Create project + environments
- [ ] Create Supabase project
- [ ] Create `.env` for admin app with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- [ ] Enable Email auth (or magic link) for clinic staff

### 2) Create tables + constraints
- [ ] Create tables listed above
- [ ] Add indexes:
  - [ ] `appointments (clinic_id, appointment_date, status, created_at)`
  - [ ] `patients (clinic_id, phone)`
  - [ ] `profiles (clinic_id, role)`

### 3) Row Level Security (RLS)
- [ ] Enable RLS on all tables
- [ ] Policies:
  - [ ] `profiles`: user can read their own profile
  - [ ] All clinic-scoped tables: user can read/write only rows where `clinic_id = profiles.clinic_id`
  - [ ] Role rules:
    - [ ] reception: can create patients/appointments; can update appointment status
    - [ ] doctor: can view intake + mark in_consultation/done
    - [ ] admin: full access within clinic

### 4) Seed / bootstrap
- [ ] Create a “Clinic Admin” onboarding flow:
  - [ ] create clinic record
  - [ ] create profile row for current user as `admin` with that clinic_id

---

## Frontend Build Plan
## Phase A — App Skeleton + Auth
- [ ] Create React+TS app
- [ ] Add Supabase client
- [ ] Add routing (React Router)
- [ ] Implement Auth screens:
  - [ ] Sign in
  - [ ] Sign up (admin only)
  - [ ] Password reset (optional)
- [ ] After login:
  - [ ] Fetch profile (`clinic_id`, `role`)
  - [ ] Guard routes by role
- [ ] Create base layout:
  - [ ] Top bar: clinic name, user role, logout
  - [ ] Left nav: Queue, Patients (optional), Settings (admin only)

**Acceptance**
- Login works
- User sees only clinic-scoped content
- Role gates are enforced in UI + by RLS

---

## Phase B — Today’s Queue View (Core)
### Queue screen requirements
- [ ] Default shows **Today**
- [ ] Tabs/filters: Waiting / In consultation / Done / Cancelled
- [ ] Each row shows: patient name, phone, created time, status
- [ ] Action buttons:
  - [ ] Mark Waiting
  - [ ] Mark In consultation
  - [ ] Mark Done
  - [ ] Cancel

### Query rules
- [ ] Only show `appointments` for today
- [ ] Order:
  - Waiting first ordered by `created_at`
  - In consultation second
  - Done last

### Realtime
- [ ] Subscribe to `appointments` changes for that clinic + today
- [ ] On event: refetch or update cache

**Acceptance**
- Two staff sessions see updates in near real-time
- No duplicates; no “ghost” queue entries

---

## Phase C — Add Walk-In Flow
### Reception “Add Walk-in” modal/page
- [ ] Inputs: patient name, phone (required), optional email, optional DOB
- [ ] Behavior:
  - [ ] Search patient by phone
  - [ ] If exists: reuse patient
  - [ ] If not: create patient
  - [ ] Create appointment for **today** with status `waiting`
- [ ] Success toast + navigate to queue

**Acceptance**
- Adding a walk-in creates one appointment only (idempotent)
- Patient shows in queue immediately

---

## Phase D — Basic Doctor View (Optional in Admin Portal)
If you’re including doctors in the admin portal:
- [ ] Appointment detail page:
  - [ ] Patient info
  - [ ] Intake response summary (if exists)
  - [ ] Status buttons

---

## Phase E — Audit Log (MVP-lite)
- [ ] Create `appointment_events` table (optional but recommended):
  - `id`, `clinic_id`, `appointment_id`, `actor_user_id`, `event_type`, `from_status`, `to_status`, `created_at`
- [ ] Log status transitions via:
  - [ ] Frontend insert on each change **OR**
  - [ ] DB trigger (preferred later)

**Acceptance**
- You can show “Last updated by X at time Y” in appointment detail

---

## Testing Checklist
- [ ] RLS: confirm clinic A cannot read clinic B data
- [ ] Concurrency: two receptionists updating same appointment
- [ ] Realtime reconnect: refresh page, queue loads correctly
- [ ] Network loss: app fails gracefully (shows offline)

---

## Deployment
- [ ] Deploy admin portal to Vercel
- [ ] Use Supabase prod keys
- [ ] Add env vars in Vercel

---

## MVP Done Definition
- Reception can:
  - [ ] Add walk-in
  - [ ] View today’s queue
  - [ ] Update statuses reliably
  - [ ] See updates in real time
- System passes basic RLS security checks
