# Deploying the BabyBlue Admin Portal

Release flow (mirrors the patient app):

```
push to main ─▶ DEV (auto, aliased) ─▶ smoke ─▶ UAT (approval, alias flip) ─▶ PROD (approval, prod build)
```

GitHub Actions owns every deploy via the Vercel CLI. **The Vercel Git
integration must stay disconnected** or it deploys straight to production on
push and bypasses the gates.

## URLs

| Stage | URL |
|---|---|
| DEV | https://clinic-os-portal-dev.vercel.app |
| UAT | https://clinic-os-portal-uat.vercel.app |
| PROD | https://clinic-os-portal.vercel.app |

DEV and UAT are the **same build** (UAT re-aliases the exact DEV artifact).
PROD builds separately because its `NEXT_PUBLIC_*` values are inlined at build.

## Environment values (single source of truth = GitHub)

Nothing is stored in Vercel. Values live in GitHub — environment-scoped
(`dev`, `production`) plus repo-level copies for CI:

| Name | Type | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | variable | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | secret | public anon key (inlined into browser bundle) |
| `SUPABASE_SERVICE_ROLE_KEY` | secret | **server-only**, runtime-only; supplied via `vercel deploy --env`, never `NEXT_PUBLIC_`, never inlined |
| `VERCEL_TOKEN` | secret | Vercel CLI auth |
| `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` | secret | target Vercel project (`clinic-os-portal`) |

All Supabase values currently point at project `wyctcephdorvblshadzd`.

## Approving a release

1. Push to `main` → `deploy-dev` + `smoke-dev` run automatically.
2. GitHub → **Actions → the run → Review deployments** → approve **uat**.
3. Then approve **production**. PROD rebuilds with the production-scoped env.

## Rollback

- **Fast:** Vercel dashboard → `clinic-os-portal` → Deployments → pick a
  previous READY production deployment → **Promote to Production** (instant).
- **Reproducible:** re-run the `Deploy` workflow from a known-good commit.

## One-time setup (already done unless noted)

- GitHub environments `dev` (no gate), `uat` + `production` (required reviewer).
- Repo + env variables/secrets above.
- **User-owned, cannot be scripted:**
  - `VERCEL_TOKEN` secret must exist.
  - Vercel Git integration on `clinic-os-portal` **disconnected**.
  - **Deployment Protection** on `clinic-os-portal` **disabled** (else preview
    URLs 302 to an SSO wall and the smoke test / human links break).

## Notes

- npm is the package manager (single `package-lock.json`; no `yarn.lock`).
- Node 24 across the workflow, `package.json` engines (`>=22`), and the Vercel
  project setting.
- Smoke test (`scripts/smoke.mjs`) is read-only: it checks the login screen
  renders and protected routes redirect to `/login` — it never authenticates.
