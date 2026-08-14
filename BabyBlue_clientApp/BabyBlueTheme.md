# BabyBlue Theme & UI Instructions (MVP v1)
> Purpose: Keep BabyBlue looking **clean, clinical, modern, and trustworthy** across Admin Portal + Patient Mobile Web.
> This is the **single source of truth** for UI decisions.

---

## 1) Brand Personality
- **Clinical, calm, reliable** (not playful)
- **Operational + modern** (B2B infrastructure vibe)
- **Simple and readable** (fast comprehension under stress)
- **Mobile-first** mindset (patients)

Do **not** use:
- Loud/neon colors
- “Wellness spa” aesthetics
- Cartoon icons

---

## 2) Logo Usage
### Primary Mark
- Use the **icon-only** mark for app icon, favicon, splash, and sidebar.
- Use the full wordmark only on landing screens / login.

### Placement rules
- Admin Portal:
  - Top-left in navbar (icon + “BabyBlue” text)
- Patient App:
  - Clinic landing page header (icon only or small wordmark)
  - Avoid large hero logos (patients want function, not branding)

---

## 3) Color System
### Primary palette (aligned with current logo direction)
Use these as **starting tokens**:

- **Primary (Blue)**: `#0B5AA8`
- **Primary Dark**: `#083E78`
- **Accent (Teal/Green)**: `#20C997`
- **Accent Dark**: `#0FAE7B`
- **Background**: `#F7FAFC`
- **Surface**: `#FFFFFF`
- **Text Primary**: `#0F172A` (slate-900)
- **Text Secondary**: `#475569` (slate-600)
- **Border**: `#E2E8F0` (slate-200)

### Semantic colors
- **Success**: Accent (Teal/Green)
- **Warning**: `#F59E0B`
- **Error**: `#EF4444`
- **Info**: Primary (Blue)

### Usage rules
- Primary Blue = buttons, links, key actions
- Accent Green = confirmations, “In consultation”, “Connected”
- Never use Error red except for real problems
- Use neutrals for most UI; color is for meaning

---

## 4) Typography
### Font
- Prefer **Inter** (or system default if you want zero setup).
- Fallback: `system-ui, -apple-system, Segoe UI, Roboto, Arial`

### Type scale (recommended)
- H1: 24–28px (rare)
- H2: 20px
- H3: 16–18px
- Body: 14–16px
- Small: 12–13px
- Buttons: 14–16px, medium weight

### Rules
- Avoid thin weights
- Prioritize readability over style
- Use sentence case, not ALL CAPS

---

## 5) Spacing & Layout
### Spacing scale (8px base)
- xs: 4
- sm: 8
- md: 16
- lg: 24
- xl: 32

### Admin Portal layout
- Left nav + main content
- Main content max width: 1200–1400px
- Cards for sections; tables/lists for queues

### Patient app layout
- Full-width mobile layout
- Max width: 480–560px (centered on desktop)
- Tap targets: **44px** min height

---

## 6) Component Styling Rules
### Buttons
- Primary: solid blue + white text
- Secondary: white surface + blue border
- Destructive: red (only for cancel/delete)
- Loading states: spinner + disabled

### Inputs
- Corner radius: 10–14px
- Border: slate-200
- Focus ring: primary blue (subtle)

### Cards
- White surface
- Border: slate-200
- Shadow: very light (avoid heavy shadows)

### Tables (Admin Queue)
- Status pills (chip/badge) for:
  - Waiting (neutral)
  - In consultation (blue)
  - Done (green)
  - Cancelled (gray; red only when necessary)

---

## 7) Queue UI (Most Important)
### Status presentation
- Pill badges + optional small icon
- Always show “last updated” timestamp (trust)

### Queue position (Patient app)
- Show position as **large number**
- Copy:
  - “You are #3 in line”
- If estimating wait:
  - Label clearly as “Estimated” (never promise exact)

### Realtime feedback
- Subtle indicator: “Updated just now”
- If disconnected:
  - Banner: “Offline — reconnecting…”

---

## 8) Accessibility & UX Rules
- Keep strong contrast
- Clear labels + inline validation
- Plain-language errors
- Don’t show sensitive medical info in public views

---

## 9) Light & Dark Mode (Optional)
MVP can ship light-mode only.
If adding dark mode later:
- Background: slate-950
- Surface: slate-900
- Text: slate-50 / slate-200
- Borders: slate-800
- Keep brand blue/green consistent

---

## 10) Icons
- Use one icon set (recommended: `lucide-react`)
- Consistent stroke (1.5–2px)
- Common sizes: 18–20px (lists), 24px (headers)

---

## 11) Motion (Optional)
- Subtle transitions: 150–250ms
- Use motion for:
  - loading
  - state changes
  - confirmations

---

## 12) “On-Brand” Checklist
A screen is on-brand if:
- Calm and professional
- Key info visible in 2 seconds
- Actions are obvious
- Color communicates meaning
- Feels trustworthy for a clinic

---

## 13) Implementation Note (React + Tailwind)
If using Tailwind:
- Define CSS variables in `:root` for tokens
- Map to Tailwind config if needed
- Keep UI primitives consistent:
  - `Button`, `Input`, `Card`, `Badge`, `Toast`

---

## 14) Theme Lock Rule
Do not redesign weekly. Lock theme → ship MVP → refine after clinic feedback.
