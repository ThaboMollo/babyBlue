# BabyBlue Platform (monorepo)

Yarn 4 workspace for **BabyBlue**. BabyBlue is both the consumer brand
(discovery, booking, WhatsApp) and the platform / practice-facing spine —
one backend, branded surfaces on top. See `../BabyBlueRestructureSpec.md`.

```
packages/core   @babyblue/core — domain types, identity/consent/retention,
                                  (soon) the Visit state machine
apps/api        @babyblue/api  — Hono HTTP service: the single write path,
                                  holder of the only service-role key, event emitter
apps/discovery  BabyBlue SSR/SSG — search + practice/practitioner/service pages   (planned)
apps/patient    BabyBlue consumer — booking funnel + thin presence page           (planned)
apps/admin      BabyBlue practice portal (evolved from ClinicOS_AdminPortal)       (via absorb)
```

All surfaces + the API talk to a **single Supabase project**. The **API is
the only holder of the service-role key**; it enforces consent, tenant
isolation, role rules, and HPCSA retention, and emits an event on every
Visit state transition.

## Getting started

```bash
corepack enable            # Yarn 4 via packageManager field
yarn install
yarn workspace @babyblue/core build
yarn dev:api               # http://localhost:8787/health
```

### Environment (apps/api/.env)

```
SUPABASE_URL=...                 # https://<ref>.supabase.co
SUPABASE_ANON_KEY=...            # public anon key (patient/public tier)
SUPABASE_SERVICE_ROLE_KEY=...    # SERVER-ONLY, bypasses RLS — lives ONLY here
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
PORT=8787
```

## Status

Foundation: `@babyblue/core` + `apps/api` (all 11 patient + admin operations)
are built and verified. Restructure in progress per the spec — Phase 0
(rename) done; identity split, Visit state machine, events/WhatsApp, and the
discovery/booking surfaces follow. The two legacy apps are absorbed via
history-preserving `git subtree` as the final phase.
