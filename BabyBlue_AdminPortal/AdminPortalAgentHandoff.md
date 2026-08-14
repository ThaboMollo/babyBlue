# BabyBlue Admin Portal — Agent Handoff Document
> **For the agent building the admin portal.**
> Read this entire document before writing a single line of code. Everything you need is here.

---

## 1. What Already Exists

The **BabyBlue patient mobile web app** is fully built and deployed. The Supabase project is live with:
- The complete shared database schema (8 tables, RLS, seed data)
- 3 deployed Edge Functions (`join-queue`, `get-appointment`, `submit-intake`)
- A demo clinic already seeded (`slug: demo-clinic`)

**You must connect to the same Supabase project. Do not create a new one.**

---

## 2. Shared Supabase Project

| Key | Value |
|-----|-------|
| Project ref | `wyctcephdorvblshadzd` |
| Project URL | `https://wyctcephdorvblshadzd.supabase.co` |
| Anon key | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5Y3RjZXBoZG9ydmJsc2hhZHpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2Nzk0NjgsImV4cCI6MjA4NzI1NTQ2OH0.H1RpjNXTFB5ssbPO7jylbg8ng0IHJE5pxrXVDYkGers` |
| Dashboard | `https://supabase.com/dashboard/project/wyctcephdorvblshadzd` |

> **Service role key**: Retrieve this from Supabase Dashboard → Project Settings → API → `service_role` key.
> You need it for `.env.local`. **Never commit it.**

---

## 3. Supabase Connection — Step by Step

Follow these steps exactly in order.

### Step 1 — Install Supabase CLI

Homebrew may fail on macOS 26 beta. Use npm instead:

```bash
npm install supabase --save-dev
```

Verify:
```bash
npx supabase --version
# Should print: 2.x.x
```

### Step 2 — Log in

```bash
npx supabase login
```
This opens a browser. Authorize with your Supabase account.

> If running in a non-TTY environment (CI, some terminals), set `SUPABASE_ACCESS_TOKEN` env var with a personal access token from the Supabase dashboard instead.

### Step 3 — Initialize + Link

```bash
npx supabase init
npx supabase link --project-ref wyctcephdorvblshadzd --password "IfV3DEwzB6s0O8kB"
```

### Step 4 — Pull the existing schema

```bash
npx supabase db pull
```

This fetches the current remote schema into your local `supabase/migrations/` folder so you're in sync.

### Step 5 — Apply the additional admin portal migrations

The existing schema was designed for both apps but is missing a few policies the admin portal needs. Run the SQL in Section 6 of this document as a new migration:

```bash
# Create the migration file
npx supabase migration new admin_portal_policies

# Paste the SQL from Section 6 into the created file, then:
npx supabase db push
```

### Step 6 — Set up `.env.local`

```env
NEXT_PUBLIC_SUPABASE_URL=https://wyctcephdorvblshadzd.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5Y3RjZXBoZG9ydmJsc2hhZHpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2Nzk0NjgsImV4cCI6MjA4NzI1NTQ2OH0.H1RpjNXTFB5ssbPO7jylbg8ng0IHJE5pxrXVDYkGers
SUPABASE_SERVICE_ROLE_KEY=<get from Supabase Dashboard → Project Settings → API>
```

### Step 7 — Verify connection

```bash
# Should return the demo clinic
curl "https://wyctcephdorvblshadzd.supabase.co/rest/v1/clinics?select=id,name,slug" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5Y3RjZXBoZG9ydmJsc2hhZHpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2Nzk0NjgsImV4cCI6MjA4NzI1NTQ2OH0.H1RpjNXTFB5ssbPO7jylbg8ng0IHJE5pxrXVDYkGers" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5Y3RjZXBoZG9ydmJsc2hhZHpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2Nzk0NjgsImV4cCI6MjA4NzI1NTQ2OH0.H1RpjNXTFB5ssbPO7jylbg8ng0IHJE5pxrXVDYkGers"
# Expected: [{"id":"...","name":"BabyBlue Demo Clinic","slug":"demo-clinic"}]
```

---

## 4. Existing Database Schema

All tables already exist. **Do not recreate them.** Read this carefully — every field matters.

```
clinics
  id                        UUID PK
  name                      TEXT
  slug                      TEXT UNIQUE          ← used in patient QR links /c/:slug
  address                   TEXT
  phone                     TEXT
  avg_consultation_minutes  INT DEFAULT 10       ← patient app uses this for estimated wait
  created_at                TIMESTAMPTZ

profiles  (clinic staff — maps auth.users → clinic)
  id          UUID PK → auth.users(id)
  clinic_id   UUID → clinics(id)
  role        TEXT  CHECK IN ('admin','reception','doctor')
  full_name   TEXT
  created_at  TIMESTAMPTZ

patients
  id          UUID PK
  clinic_id   UUID → clinics(id)
  name        TEXT
  phone       TEXT
  email       TEXT
  dob         DATE
  created_at  TIMESTAMPTZ
  UNIQUE (clinic_id, phone)

appointments
  id                      UUID PK
  clinic_id               UUID → clinics(id)
  patient_id              UUID → patients(id)
  status                  TEXT  CHECK IN ('scheduled','waiting','in_consultation','done','cancelled')
  appointment_date        DATE DEFAULT CURRENT_DATE
  access_token            UUID                  ← patient app's auth token — DO NOT EXPOSE
  entered_queue_at        TIMESTAMPTZ           ← when patient joined queue (used for position)
  consultation_started_at TIMESTAMPTZ           ← set automatically when status → in_consultation
  completed_at            TIMESTAMPTZ           ← set automatically when status → done
  notes                   TEXT
  created_at              TIMESTAMPTZ

intake_question_templates  (global defaults, managed by super-admin)
  id             UUID PK
  question_key   TEXT UNIQUE
  question_text  TEXT
  question_type  TEXT  CHECK IN ('text','dropdown','scale','boolean')
  options        JSONB   ← array of strings for dropdown type
  sort_order     INT
  is_active      BOOLEAN

clinic_intake_questions  (per-clinic config — inherits or overrides templates)
  id             UUID PK
  clinic_id      UUID → clinics(id)
  template_id    UUID → intake_question_templates(id)  ← NULL if fully custom
  inherit_global BOOLEAN  ← if true, use text/type/options from template row
  question_text  TEXT     ← override (only used when inherit_global = false)
  question_type  TEXT
  options        JSONB
  sort_order     INT
  is_active      BOOLEAN

intake_responses  (written by patient app — read-only for admin portal)
  id              UUID PK
  appointment_id  UUID → appointments(id)
  clinic_id       UUID → clinics(id)
  question_id     UUID → clinic_intake_questions(id)
  question_key    TEXT   ← snapshot at time of answer
  question_text   TEXT   ← snapshot at time of answer
  answer          TEXT
  created_at      TIMESTAMPTZ

appointment_events  (audit log)
  id              UUID PK
  clinic_id       UUID → clinics(id)
  appointment_id  UUID → appointments(id)
  actor_type      TEXT  CHECK IN ('patient','staff')
  actor_user_id   UUID → auth.users(id)   ← NULL for patient actions
  event_type      TEXT   ← 'queue_joined' | 'status_change' | 'intake_submitted'
  from_status     TEXT
  to_status       TEXT
  metadata        JSONB
  created_at      TIMESTAMPTZ
```

---

## 5. Existing RLS Policies Summary

| Table | Existing Policies |
|-------|------------------|
| `clinics` | Public SELECT (all); staff ALL (own clinic) |
| `profiles` | User SELECT own; user UPDATE own |
| `patients` | Staff ALL (own clinic) |
| `appointments` | Staff ALL (own clinic) |
| `intake_question_templates` | Public SELECT (active only) |
| `clinic_intake_questions` | Public SELECT (active only); staff ALL (own clinic) |
| `intake_responses` | Staff SELECT (own clinic) |
| `appointment_events` | Staff SELECT (own clinic) |

**Gap — you must add these in your migration (Section 6):**
- `profiles` INSERT — users can create their own profile (needed for onboarding)
- `clinics` INSERT — authenticated users can create a clinic (needed for onboarding)
- `profiles` SELECT — admins can see all profiles in their clinic (not just their own)
- `appointment_events` INSERT — staff can write audit events on status changes
- `appointments` UPDATE trigger — auto-sets `consultation_started_at` / `completed_at`

---

## 6. Required Admin Portal Migration SQL

Create `supabase/migrations/<timestamp>_admin_portal_policies.sql` with this content:

```sql
-- ─────────────────────────────────────────
-- Admin portal additional policies + trigger
-- ─────────────────────────────────────────

-- Allow authenticated users to create a new clinic (onboarding flow)
CREATE POLICY "Authenticated users can create clinics"
  ON clinics FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow users to create their own profile (onboarding flow)
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- Admins can read all profiles in their clinic (staff management)
-- Drop the restrictive existing read policy and replace with a broader one
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
CREATE POLICY "Staff can read relevant profiles"
  ON profiles FOR SELECT
  USING (
    id = auth.uid()
    OR clinic_id IN (
      SELECT clinic_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Staff can insert appointment events (audit log on status changes)
CREATE POLICY "Staff can insert appointment events"
  ON appointment_events FOR INSERT
  TO authenticated
  WITH CHECK (
    clinic_id IN (
      SELECT clinic_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Trigger: auto-set timestamps when appointment status changes
CREATE OR REPLACE FUNCTION handle_appointment_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'in_consultation' AND (OLD.status IS DISTINCT FROM 'in_consultation') THEN
    NEW.consultation_started_at = now();
  END IF;
  IF NEW.status = 'done' AND (OLD.status IS DISTINCT FROM 'done') THEN
    NEW.completed_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_appointment_status_change
  BEFORE UPDATE ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION handle_appointment_status_change();
```

---

## 7. Tech Stack

| Concern | Choice |
|---------|--------|
| Framework | Next.js 15 + TypeScript (App Router) |
| UI | Tailwind CSS |
| Design system | BabyBlueTheme.md (see Section 8) |
| Icons | `lucide-react` |
| Supabase client | `@supabase/ssr` + `@supabase/supabase-js` |
| Auth | Supabase Auth (email + password) |
| Realtime | Supabase Realtime (`postgres_changes`) |
| Deployment | Vercel |

**Do not deviate from this stack.** Consistency with the patient app matters for shared maintenance.

---

## 8. Design System — BabyBlueTheme

Apply these tokens in `tailwind.config.ts`. **Match exactly** — both apps must feel like the same product.

```ts
colors: {
  primary:    { DEFAULT: "#0B5AA8", dark: "#083E78" },
  accent:     { DEFAULT: "#20C997", dark: "#0FAE7B" },
  warning:    "#F59E0B",
  error:      "#EF4444",
  background: "#F7FAFC",
  surface:    "#FFFFFF",
  border:     "#E2E8F0",
  "text-primary":   "#0F172A",
  "text-secondary": "#475569",
}
fontFamily: { sans: ["Inter", "system-ui", ...] }
```

**Layout rules for admin portal:**
- Left sidebar nav + main content area
- Main content max-width: 1200–1400px
- Cards for sections; tables for the queue
- Tap/click targets: 44px min height
- Status pills (Badge components) for appointment statuses:
  - `waiting` → neutral gray
  - `in_consultation` → primary blue
  - `done` → accent green
  - `cancelled` → muted gray

**Font:** Inter from Google Fonts or system-ui fallback.

---

## 9. Supabase Auth Setup

Before building UI, configure auth in the Supabase dashboard:

1. Go to **Authentication → Providers** → ensure Email is enabled
2. Go to **Authentication → Email Templates** → customize if desired
3. Go to **Authentication → URL Configuration**:
   - Site URL: your Vercel URL (or `http://localhost:3000` for dev)
   - Redirect URLs: add `http://localhost:3000/**` and your production URL

**Important:** The admin portal uses Supabase Auth. The patient app does **not** — patients are identified by phone number + access token only. Never mix these auth models.

---

## 10. TypeScript Types

Use these exact types. They are shared with the patient app and must stay in sync.

```typescript
export type AppointmentStatus =
  | "scheduled" | "waiting" | "in_consultation" | "done" | "cancelled";

export type UserRole = "admin" | "reception" | "doctor";
export type QuestionType = "text" | "dropdown" | "scale" | "boolean";
export type ActorType = "patient" | "staff";

// Full row types
export interface Clinic {
  id: string; name: string; slug: string;
  address: string | null; phone: string | null;
  avg_consultation_minutes: number; created_at: string;
}

export interface Profile {
  id: string; clinic_id: string;
  role: UserRole; full_name: string | null; created_at: string;
}

export interface Patient {
  id: string; clinic_id: string; name: string; phone: string;
  email: string | null; dob: string | null; created_at: string;
}

export interface Appointment {
  id: string; clinic_id: string; patient_id: string;
  status: AppointmentStatus; appointment_date: string;
  access_token: string;          // ← NEVER display this to staff UI
  entered_queue_at: string;
  consultation_started_at: string | null;
  completed_at: string | null;
  notes: string | null; created_at: string;
}

export interface IntakeResponse {
  id: string; appointment_id: string; clinic_id: string;
  question_id: string | null; question_key: string;
  question_text: string; answer: string; created_at: string;
}

export interface AppointmentEvent {
  id: string; clinic_id: string; appointment_id: string;
  actor_type: ActorType; actor_user_id: string | null;
  event_type: string;
  from_status: AppointmentStatus | null; to_status: AppointmentStatus | null;
  metadata: Record<string, unknown> | null; created_at: string;
}

export interface ClinicIntakeQuestion {
  id: string; clinic_id: string; template_id: string | null;
  inherit_global: boolean; question_text: string | null;
  question_type: QuestionType | null; options: string[] | null;
  sort_order: number; is_active: boolean; created_at: string;
}

// Full appointment row joined with patient
export interface AppointmentWithPatient extends Appointment {
  patients: Pick<Patient, "id" | "name" | "phone">;
}
```

---

## 11. Supabase Client Setup

**Browser client** (`lib/supabase/client.ts`):
```typescript
import { createBrowserClient } from "@supabase/ssr";
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

**Server client** (`lib/supabase/server.ts`):
```typescript
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch { /* Server Component — safe to ignore */ }
        },
      },
    }
  );
}
```

**Middleware** (`middleware.ts` in root) — required for session refresh:
```typescript
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request: { headers: request.headers } });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );
  await supabase.auth.getUser();
  return response;
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
```

---

## 12. App Router Structure

```
app/
├── layout.tsx                          # Root layout
├── globals.css                         # BabyBlue tokens
├── page.tsx                            # Redirect → /login or /queue
│
├── (auth)/
│   ├── login/page.tsx                  # Email + password sign in
│   ├── signup/page.tsx                 # Create account (clinic admin onboarding)
│   └── auth/callback/route.ts          # Supabase OAuth callback handler
│
├── (portal)/                           # Route group — requires auth
│   ├── layout.tsx                      # Sidebar + topbar shell, fetches profile
│   ├── queue/page.tsx                  # Today's queue (main screen)
│   ├── queue/[appointmentId]/page.tsx  # Appointment detail + intake view
│   ├── patients/page.tsx               # Patient search list (optional MVP)
│   ├── settings/
│   │   ├── page.tsx                    # Clinic settings (name, slug, avg minutes)
│   │   └── intake/page.tsx             # Manage clinic intake questions
│   └── onboarding/page.tsx             # First-run: create clinic + profile
│
middleware.ts                           # Session refresh (required)
```

---

## 13. Build Phases

---

### Phase A — Skeleton + Auth

- [ ] `npx create-next-app@latest . --typescript --tailwind --app --no-src-dir --import-alias "@/*"`
  > If directory name has capitals, set `"name": "babyblue-admin"` manually in `package.json`
- [ ] `npm install @supabase/ssr @supabase/supabase-js lucide-react`
- [ ] Configure Tailwind with BabyBlue tokens (Section 8)
- [ ] Add Inter font
- [ ] Create browser + server Supabase clients (Section 11)
- [ ] Create `middleware.ts` (Section 11)
- [ ] Add `.env.local` (Section 3, Step 6)
- [ ] Build auth pages:
  - **Login** (`/login`): email + password form → `supabase.auth.signInWithPassword()`
  - **Sign up** (`/signup`): email + password → `supabase.auth.signUp()` → redirect to onboarding
  - **`/auth/callback/route.ts`**: exchange code for session
- [ ] Auth guard: middleware or Server Component checks session; redirect unauthenticated users to `/login`
- [ ] After login: fetch `profiles` row for `auth.uid()`:
  - If profile exists → redirect to `/queue`
  - If no profile → redirect to `/onboarding`

**Acceptance:** Login works. Unauthenticated access to `/queue` redirects to `/login`.

---

### Phase B — Onboarding (First-Run Setup)

**`/onboarding`** — only shown to users without a profile

- [ ] Step 1: Create clinic
  - Inputs: Clinic name (required), slug (auto-generated from name, editable), address, phone, avg consultation minutes (default 10)
  - Slug validation: URL-safe, unique (check against `clinics.slug`)
  - On submit: INSERT into `clinics`
- [ ] Step 2: Create profile
  - After clinic created: INSERT into `profiles` with `{ id: user.id, clinic_id: newClinic.id, role: 'admin' }`
- [ ] Step 3: Seed clinic intake questions
  - Fetch all `intake_question_templates` where `is_active = true`
  - INSERT rows into `clinic_intake_questions` with `inherit_global: true` for each template
  - This makes the clinic inherit all 6 global questions automatically
- [ ] Redirect to `/queue`

**Acceptance:** A new sign-up can create a clinic and reach the queue screen. Their patient app link works at `https://wyctcephdorvblshadzd.supabase.co` → `/c/<their-slug>`.

---

### Phase C — Today's Queue (Core Screen)

**`/queue`** — the main daily screen for reception

**Data query:**
```typescript
supabase
  .from("appointments")
  .select("*, patients(id, name, phone)")
  .eq("clinic_id", profile.clinic_id)
  .eq("appointment_date", today)            // today = new Date().toISOString().split("T")[0]
  .order("entered_queue_at", { ascending: true })
```

**Layout:**
- [ ] Date header: "Today — Monday 21 Feb 2026"
- [ ] Filter tabs: All | Waiting | In Consultation | Done | Cancelled
- [ ] Each queue row shows:
  - Position number (1, 2, 3… — count of waiting rows before this one)
  - Patient name + phone
  - Time entered queue (e.g. "09:14")
  - Status badge
  - Action buttons (role-dependent):
    - Reception: `→ In Consultation`, `✓ Done`, `✕ Cancel`
    - Doctor: `→ In Consultation`, `✓ Done`
    - Admin: all actions
- [ ] "Add Walk-in" button (top right)

**Status update logic:**
```typescript
// When updating status, the DB trigger auto-sets timestamps.
// You only need to INSERT the audit event manually:
await supabase
  .from("appointments")
  .update({ status: newStatus })
  .eq("id", appointmentId);

await supabase
  .from("appointment_events")
  .insert({
    clinic_id: profile.clinic_id,
    appointment_id: appointmentId,
    actor_type: "staff",
    actor_user_id: user.id,
    event_type: "status_change",
    from_status: currentStatus,
    to_status: newStatus,
  });
```

**Realtime:**
- [ ] Subscribe to `appointments` changes for this clinic + today:
```typescript
supabase.channel("queue")
  .on("postgres_changes", {
    event: "*",
    schema: "public",
    table: "appointments",
    filter: `clinic_id=eq.${profile.clinic_id}`,
  }, (payload) => {
    // refetch or update local state
  })
  .subscribe();
```

**Acceptance:** Two browser tabs show updates within 2 seconds. Status changes reflect immediately.

---

### Phase D — Add Walk-In

Triggered from "Add Walk-in" button → modal or slide-over panel.

- [ ] Inputs: Name (required), Phone (required), Email (optional), DOB (optional)
- [ ] On submit:
  1. Search `patients` by `(clinic_id, phone)`:
     - If found → reuse patient
     - If not found → INSERT new patient
  2. Check for active appointment today:
     - If `waiting` or `in_consultation` already → show warning "Patient already in queue" + offer to view their position
     - If `done`/`cancelled` or none → INSERT new appointment with `status: 'waiting'`
  3. INSERT `appointment_events` row: `event_type: 'queue_joined'`, `actor_type: 'staff'`
  4. Close modal, queue updates via realtime
- [ ] Success toast: "Added to queue — position #N"

**Acceptance:** Walk-in appears in queue immediately. No duplicates for same phone + same day.

---

### Phase E — Appointment Detail

**`/queue/[appointmentId]`**

- [ ] Patient card: name, phone, DOB (if set), time in queue
- [ ] Status badge + history timeline (from `appointment_events` ordered by `created_at`)
- [ ] Intake responses panel:
  - If submitted: display each question + answer in a clean card
  - If not submitted: "Patient hasn't completed intake yet"
- [ ] Status action buttons (same as queue row)
- [ ] Notes field: editable textarea → UPDATE `appointments.notes`
- [ ] Back to queue link

**Acceptance:** Doctor can see intake before consultation. Events timeline shows who changed what and when.

---

### Phase F — Clinic Settings + Intake Management

**`/settings`**
- [ ] Edit clinic: name, address, phone, avg_consultation_minutes, slug
  - Warn if slug changes (patient QR links will break)
- [ ] Slug preview: "Your patient QR link: `/c/<slug>`"

**`/settings/intake`**
- [ ] List all `clinic_intake_questions` for this clinic (joined with `intake_question_templates` for inherited ones)
- [ ] Each row: question text, type, active toggle, sort handle (drag or up/down arrows)
- [ ] "Add from global templates" button:
  - Shows unlinked templates → click to add with `inherit_global: true`
- [ ] "Add custom question" button:
  - Form: question text, type, options (if dropdown), sort order
  - INSERT with `template_id: null`, `inherit_global: false`
- [ ] Deactivate/reactivate: toggle `is_active`

**Acceptance:** Adding a question via settings means the next patient who does intake sees it.

---

### Phase G — QR Code Generation

**`/settings`** — QR code section

- [ ] Generate QR code for `https://<patient-app-domain>/c/<clinic-slug>`
- [ ] Use the `qrcode` or `qrcode.react` npm package
- [ ] "Download PNG" button for printing
- [ ] "Copy link" button

> Note: The patient app domain is wherever you deploy the patient app (separate Vercel project). For testing, use `http://localhost:3001/c/<slug>` (patient app on different port).

**Acceptance:** Printed QR scanned on a phone loads the correct clinic landing page.

---

## 14. Role-Based Access Control

Enforce in UI (not just RLS — RLS already handles data security, this is UX):

| Action | admin | reception | doctor |
|--------|-------|-----------|--------|
| View queue | ✓ | ✓ | ✓ |
| Add walk-in | ✓ | ✓ | — |
| Move to In Consultation | ✓ | ✓ | ✓ |
| Mark Done | ✓ | ✓ | ✓ |
| Cancel | ✓ | ✓ | — |
| View intake responses | ✓ | — | ✓ |
| Edit clinic settings | ✓ | — | — |
| Manage intake questions | ✓ | — | — |
| Invite staff | ✓ | — | — |

Fetch role from `profiles` after login and store in context. Guard UI elements by role.

---

## 15. Critical Compatibility Notes

These are non-negotiable. Getting them wrong breaks the patient app.

1. **Never expose `appointments.access_token`** in the admin UI. It is the patient's auth token. Don't SELECT it unless strictly needed, never render it.

2. **Don't rename or restructure any table or column.** The patient app's Edge Functions query exact column names. Any rename is a breaking change.

3. **`entered_queue_at` drives queue ordering.** When reception adds a walk-in, do NOT set `entered_queue_at` manually — let it default to `now()`. The patient app computes position using this column.

4. **Status values are exact strings.** The patient app displays UI based on `'waiting'`, `'in_consultation'`, `'done'`, `'cancelled'`. Do not use different casing or values.

5. **`avg_consultation_minutes`** on the `clinics` row is used by the patient app for estimated wait time. When the setting is changed in admin settings, patients see updated estimates immediately on their next poll.

6. **`clinic_intake_questions` with `is_active = false`** are ignored by the patient app. Use this to hide questions without deleting response history.

7. **`appointment_date`** is always stored as `DATE` (not timestamp). Always use `new Date().toISOString().split("T")[0]` for today's date in queries.

---

## 16. Testing Checklist

Before marking any phase complete:

- [ ] RLS: Sign in as clinic A staff, confirm you cannot see clinic B's data
- [ ] Realtime: Open queue in two browser windows, change status in one — other updates within 2s
- [ ] Walk-in: Adding same phone twice same day shows warning, doesn't duplicate
- [ ] Status trigger: Changing to `in_consultation` sets `consultation_started_at`; changing to `done` sets `completed_at`
- [ ] Patient app compatibility: After adding a walk-in from admin portal, patient can NOT access that appointment via the patient app (they need `access_token` — only the patient's own join flow gives them this)
- [ ] Intake: Intake responses submitted via patient app appear in appointment detail
- [ ] Role guard: Log in as `reception` — confirm settings nav is hidden

---

## 17. Deployment

```bash
# Build check before deploying
npm run build

# Deploy to Vercel
vercel --prod
```

**Vercel env vars to add:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

**Supabase Auth redirect URLs** — add your Vercel production URL:
- Dashboard → Authentication → URL Configuration → Add Redirect URL: `https://your-admin-portal.vercel.app/**`

---

## 18. Package.json Starting Point

```json
{
  "name": "babyblue-admin-portal",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "15.1.6",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@supabase/ssr": "^0.5.2",
    "@supabase/supabase-js": "^2.47.10",
    "lucide-react": "^0.469.0",
    "qrcode.react": "^4.0.0"
  },
  "devDependencies": {
    "typescript": "^5",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "tailwindcss": "^3.4.1",
    "postcss": "^8",
    "autoprefixer": "^10.0.1",
    "eslint": "^8",
    "eslint-config-next": "15.1.6",
    "supabase": "^2.76.12"
  }
}
```

---

## 19. Build Order

Follow this sequence. Each phase depends on the previous.

```
Step 1: Connect to Supabase (Section 3)
Step 2: Run admin portal migration SQL (Section 6)
Step 3: Phase A — Skeleton + Auth
Step 4: Phase B — Onboarding
Step 5: Phase C — Queue View (this is the MVP core — get it right)
Step 6: Phase D — Add Walk-In
Step 7: Phase E — Appointment Detail
Step 8: Phase F — Settings + Intake Management
Step 9: Phase G — QR Code
Step 10: Deploy to Vercel
```

Do not skip Supabase connection and migration before starting Phase A. The onboarding flow (Phase B) depends on the new RLS policies from the migration.
