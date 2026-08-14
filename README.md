# BabyBlue

Demand-side healthcare booking + presence for South Africa. One backend
(the **spine**), several branded **surfaces** on top. This directory assembles
the pieces described in [`BabyBlueRestructureSpec.md`](./BabyBlueRestructureSpec.md).

BabyBlue is both the **consumer brand** (patients search, book, and live in
WhatsApp) and the **practice-facing product** (queue ops + flow data). See the
spec for positioning, the Visit spine, and the four seams.

## What's here

| Folder | Spec surface (§5) | Role | Status |
|---|---|---|---|
| `babyBlue_api/` | Spine | Yarn 4 monorepo — `@babyblue/core` (domain types, identity, consent, retention) + `apps/api` (Hono service, single write path, holder of the service-role key, event emitter). | Foundation built & verified |
| `BabyBlue_clientApp/` | Discovery · Booking · Presence | Patient-facing web app (evolved from ClinicOS patient app): join a queue, live position, intake. Becomes the BabyBlue consumer surface. | Rebranded; repositioning pending |
| `BabyBlue_AdminPortal/` | Practice portal | Staff app (evolved from ClinicOS admin portal): run the queue, arrivals, settings, patient file. | Rebranded |

All three talk to a **single Supabase project**. Per the spec, the API is the
only holder of the service-role key; the two apps currently reach Supabase
directly — routing their writes through the API is later-phase seam work.

## Where this sits in the delivery plan (spec §12)

- **Phase 0 — Rename (ClinicOS → BabyBlue): done.** Packages, copy, UI, assets,
  and localStorage keys rebranded across all three surfaces. (SQL migration
  header comments + the demo-clinic seed name are intentionally left untouched
  to avoid altering already-applied migrations against the shared DB.)
- **Next (not yet started):** Seam 1 global vs. per-practice identity · Seam 2
  Visit state machine in `@babyblue/core` · Seam 3 event/outbox + WhatsApp ·
  Phase 4 Discovery + Booking surfaces · Phase 5 history-preserving `git
  subtree` absorb of the two apps into `babyBlue_api/apps/{patient,admin}`.

## Known follow-ups from the rebrand

- **Logo/icon artwork** (`BabyBlue_AdminPortal/public/BabyBlue_{logo,icon}.png`,
  `.ico`) was renamed for path consistency but is still the old ClinicOS
  artwork — needs real BabyBlue design.
- **Marketing narrative** in `BabyBlue_clientApp` still pitches the old
  supply-side story ("give your clinic a queue"). The consumer brand is
  demand-side; that copy is rewritten as part of the Discovery/Booking phase.
- **Domains/emails** were swapped to spec-consistent placeholders
  (`babyblue.co.za`, `patients.babyblue.app`, `hello@babyblue.co.za`) — point
  these at the real registered domain and inbox before launch.

## Origins

`BabyBlue_clientApp` and `BabyBlue_AdminPortal` are working copies of the
`ClinicOS` and `ClinicOS_AdminPortal` repos. Their full git history lives on
their original GitHub remotes; the Phase-5 absorb is where that history is
brought in via `git subtree`.
