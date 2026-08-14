# BabyBlue Deployment Pipeline

Every push to `main` flows through three environments with two manual approval gates:

```
push to main ──▶ DEV (automatic) ──▶ smoke test ──▶ UAT (approval) ──▶ PROD (approval)
```

GitHub Actions owns all deploys via the Vercel CLI. The Vercel Git integration
must stay **disconnected** on the `clinic-os-ui` project — if it is ever
reconnected, Vercel will deploy every push on its own and bypass the gates.

## Environments

| Env  | URL | Backend (Supabase) | Gate |
|------|-----|--------------------|------|
| DEV  | https://clinic-os-ui-dev.vercel.app | `qxtanjxyjagbzaaxqylu` (shared with UAT) | none — deploys on every push to main |
| UAT  | https://clinic-os-ui-uat.vercel.app | `qxtanjxyjagbzaaxqylu` (shared with DEV) | required reviewer on the `uat` environment |
| PROD | https://clinic-os-ui.vercel.app | `qxtanjxyjagbzaaxqylu` ⚠ temporary — see below | required reviewer on the `production` environment |

> ⚠ **Deferred PROD split (2026-07-20):** PROD currently shares the Supabase
> project with DEV/UAT because the free tier's 2-active-project limit is
> reached. Before onboarding real clinics: upgrade the Supabase org (or free
> a slot), create `babyblue-prod`, apply `supabase/migrations/`, deploy the
> five edge functions with `--no-verify-jwt`, and update the `production`
> environment values in GitHub — nothing else in the pipeline changes.

- **UAT is not a rebuild.** Approving the UAT gate re-aliases the exact DEV
  deployment, so UAT signs off on the byte-identical artifact.
- **PROD is a separate build** of the same commit: `NEXT_PUBLIC_*` values are
  inlined at build time, and PROD points at a different Supabase project.
- Config lives in GitHub, not Vercel: per-environment values under
  *Settings → Environments → dev / uat / production*
  (`NEXT_PUBLIC_SUPABASE_URL` as a variable, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  as a secret). Repo-level secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID`,
  `VERCEL_PROJECT_ID` are the deploy plumbing.

## Approving a release

Actions → the running **Deploy** workflow → "Review deployments" → tick
`uat` (or `production`) → *Approve and deploy*. Rejecting simply stops the
pipeline; DEV keeps the new build, UAT/PROD keep the old one.

## Rolling back

- **PROD (fastest):** Vercel dashboard → `clinic-os-ui` → Deployments → pick
  the previous production deployment → ⋯ → *Promote to Production*. Instant,
  no rebuild. CLI equivalent: `vercel rollback --token=…`.
- **PROD (reproducible):** revert the offending commit on `main` and let the
  pipeline run again, or re-run the last good Deploy workflow from the Actions
  tab (gates are re-approved).
- **DEV/UAT:** re-point the alias at any older deployment:
  `vercel alias set <older-deployment-url> clinic-os-ui-uat.vercel.app --scope=thabomollos-projects`.

## Smoke test

`scripts/smoke.mjs` runs against the DEV alias after every DEV deploy
(read-only: marketing home renders, `/find-a-clinic` lists the demo clinic,
`/c/demo-clinic` shows the join form, zero console errors). Run it against
any URL locally: `npm run smoke -- https://clinic-os-ui-dev.vercel.app`.

## Upgrade path (Vercel Pro)

The design keeps all environment knowledge in GitHub, so moving to Vercel Pro
custom environments later only changes the deploy commands (deploy `--target`
instead of alias flips). Secrets, gates, and workflow structure stay as-is.
