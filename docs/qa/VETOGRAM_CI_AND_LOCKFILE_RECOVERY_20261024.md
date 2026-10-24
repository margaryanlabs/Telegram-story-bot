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


## 24 October — concurrent Task Cloud + reminder race coverage

The existing `disposable-postgres` job now also runs `scripts/vetogram-task-reminder-race.sh` after applying the six additive migrations. It uses only fake ciphertext and dedicated synthetic owner IDs (`98760005`, `98760006`).

Two independent PostgreSQL sessions exercise both orderings:
1. An owner cloud write acquires the lock, updates the revision, and an old-revision reminder request waits then must fail with `VETO_REMINDER_TASK_REVISION_CONFLICT`. The new encrypted snapshot must stay saved, no stale reminder may be created.
2. Scheduling an owner reminder acquires the lock, followed by a competing cloud save which must fail with `VETO_TASK_PENDING_REMINDERS`. The original ciphertext/revision and the newly pending reminder must survive.

A `pg_try_advisory_xact_lock` handshake waits until the background session actually holds the intended owner lock, avoiding an unreliable fixed 0.5-second delay. The dependency-free CI job additionally syntax-checks both shell race scripts with `bash -n`. Source assertions verify that both scenarios remain connected to the temporary-Postgres job. **The actual concurrent SQL cases have not yet run** because the GitHub Actions jobs have failed before taking any steps; no production database was accessed.

Lockfile regeneration was attempted from the working container on 24 October, but npm registry DNS resolution returned `EAI_AGAIN`, so it remains blocked. Do not manually fabricate package integrity metadata. The current branch still needs a trusted network-enabled `npm run lock:refresh` before `npm ci` can pass.


## 24 October: executable browser-function regressions and bounded reminder claims

### Browser tests (dependency-free)

Added `tests/vetogram-owner-ui-behavior.test.js` and registered it in `npm run ci:offline` (the regular `npm test` glob includes it as well). The test executes functions extracted from the **current browser controller source**, in Node's built-in `vm` sandbox with mocked DOM and network; it does not send messages or connect to a provider. It exercises:

1. Mode changes immediately clear old draft, nonce, approval and Send eligibility.
2. Hidden or stale drafts cannot reach the Telegram send request.
3. After an uncertain network response, a second **explicitly user-confirmed** attempt uses the same Telegram nonce, rather than a new random ID.
4. An async Approval Center chat lookup cannot restore owner A's draft into B's editor.
5. Real `generate()` branching for Second Brain and AI Action processes the returned response in sequence, rather than referring to it before it exists.

**Evidence:** five browser controller functions/scenarios evaluated with a V8 sandbox against fetched GitHub source: **5/5 passed**, browser source JS parse passed. The full Node `node --test` runner remains unverified until a trusted checkout/runner becomes available.

### Draft migration: claim bounds and task expiry

The staged, unapplied `migrations/vetogram-reminders-20261024.sql` now caps `vetogram_claim_reminders(NULL)` with `LEAST(GREATEST(COALESCE(p_limit,8),1),8)`. Previously PostgreSQL's `LIMIT NULL` semantics could allow an unbounded claim if a caller supplied NULL. The due-query also requires the task deadline not to be beyond the allowed 10-minute grace period. This matches the existing reminder worker's deadline policy and avoids consuming a send attempt for clearly obsolete jobs.

The disposable PostgreSQL smoke adds ten synthetic due rows plus one deadline-expired row, asserts a NULL limit claims **exactly eight**, oversized limit claims **exactly two remaining**, and the deadline-expired row remains unclaimed. Node source regression checks enforce both SQL clauses and smoke coverage. SQL **has not** been executed against PostgreSQL in this work; review and execute in isolated CI before ever applying the migration.

All tests use fake owner IDs and fake ciphertext. No live Telegram API calls, Neon migrations, Vercel changes, merge or production deployment.
