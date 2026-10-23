# VETOGRAM NEXT — CI and lockfile recovery (draft, no deployment)

24 October 2026. Repo: `margaryanlabs/Telegram-story-bot`. Existing draft PR #181 (`feat/vetogram-ai-story-unified-20261023`).

## Verified separate blockers

**GitHub Actions did not execute any job steps.** Run `40033363043` returned failed `node-tests` and `disposable-postgres` jobs, both with zero steps. Log retrieval returned 404 BlobNotFound. This evidence does not show a failing Node assertion or a failing PostgreSQL migration: the hosted runner never produced execution evidence. Review GitHub Actions availability, billing/limits, runner assignment, policy and workflow eligibility in repository settings. Do not assume a code change or rerun can fix account-wide runner denial. Avoid unlimited reruns.

**Vercel preview was intentionally skipped/canceled, not a compiler crash.** In the second connected Vercel account (`labsmargaryan@gmail.com`) and project `veto`, preview deployment `dpl_3CDdaTebDPcnLC2gn8oeJSbqk31L` for commit `a82d2e104a239ce9196d9e6c95d39fa6a0fd2d3e` is `CANCELED`, with an error link to the Vercel *Ignored Build Step* setting. This does not establish deploy readiness or build failure. The branch remains intentionally undeployed under the user's consolidated-release plan. A request for build events returned 403 under that project scope, so full Vercel build logs were not accessible. Do not change Ignored Build Step or initiate a preview/production deployment without explicit scope and authorization.

**The committed npm lockfile is incompatible with package.json.** Actual direct-dependency audit on current PR #181:
- `@aws-sdk/client-s3@3.821.0` missing from lock root and `node_modules` entries.
- `@aws-sdk/s3-request-presigner@3.821.0` missing.
- `@neondatabase/serverless@1.0.2` missing.
The other three direct dependencies match. A successful `npm ci` is not possible with this committed lock. Do **not** invent integrity hashes, package resolutions or a handwritten AWS dependency tree.

## Draft-only CI changes

- A new `offline-contracts` job runs `npm run ci:offline` with Node 24 and **no** `npm ci`, secret, DB connection or Telegram send. It checks staged migration/runtime contracts and pure Node tests for reminder, cloud tasks, and lockfile audit logic. It cannot run while GitHub refuses to assign runners.
- The existing complete `node-tests` job now invokes `npm run lock:check` **before** the install, producing an actionable error for exactly the missing packages. It still uses `npm ci --ignore-scripts --no-audit --no-fund` once the lock has been properly refreshed.
- `npm run vercel-build` also requires the committed lock to pass validation before attempting other checks.
- A pure offline `auditNpmLock` module validates direct manifest specs and the existence of all direct `node_modules` package resolutions. Unit tests use synthetic lock data. No network calls or dependency installs are performed by these source checks.

## Safe recovery, once a trusted network-enabled checkout/runner is available

```sh
npm run lock:refresh
npm run lock:check
npm ci --ignore-scripts --no-audit --no-fund
npm run ci:offline
npm run check
npm test
```

Review `git diff -- package-lock.json`, confirm exact npm registry integrity fields, and commit **the generated lockfile only** to the same draft PR branch. Then run disposable PostgreSQL migrations/smoke/concurrency tests and review Vercel Preview intentionally only at the final approved release gate. Do not move credentials or database contents into logs/artifacts.

## Current evidence and limits

The live offline audit correctly reported the three missing dependencies; its synthetic positive test passed; new JavaScript helper, CLI and test file parsed syntactically. **This is not evidence of an npm install or actual GitHub Actions run.** All six additive AI migrations remain staged and unapplied. No changes to production, Vercel environment, ignored-build setting, GitHub billing, Neon data or main branch.
