# VETOGRAM 5.1 — No-credit QA and release gate (2026-10-27)

## Financial constraint and release policy
The repository owner has no budget for GitHub Actions billing, hosted CI runners, extra Vercel build retries, or paid infrastructure. **Do not request a payment card, renew a subscription, trigger additional deployments, enable paid hosting or merge/publish unverified code.** This file adds no recurring expense or automation.

The existing PR #185 remains Draft. Production `vtrg-telegram.vercel.app` is from a **different** Vercel/Git branch than this PR. Do not promote a build or overwrite that production branch without reconciling both.

## Zero-cost source and test checks
A dependency-free, Node built-in test command was added to `package.json`:

```sh
npm run qa:free
```

It uses `node --check` on **six** client and Telegram API sources and `node --test` for **16** focused, actual-source regression files. It needs an existing Node.js 22+/npm installation and a local repository checkout, but **does not require npm install, GitHub Actions, Vercel, paid API keys or a live Telegram session**. Tests do not send Telegram messages. This is a narrower command than `qa:reborn:offline` (30 test files), some of which import third-party dependencies such as sharp.

For this checkpoint, the connected GitHub files were independently inspected using a JavaScript isolate: **29/29 test sources parsed successfully after normalizing ES-module imports**. This is **syntax-only**, not 29 passing Node tests. The shipping Telegram client plus the new polling controller were also executed against mock state: 503 preserved messages and drafts; 401, 403 and 409 revoked account-bound UI state and scrubbed messages, images and unsent drafts. No real user data was used.

## Infrastructure, not code, prevents hosted acceptance
- The recent GitHub Actions `Vetogram Verification` job ended `failure` without a runner or steps (`runner_id=0`, `steps=[]`), so the build script never executed. The owner's payment restrictions mean GitHub-hosted runners are **not** the release path.
- A single previously requested Vercel preview `dpl_Ak1ELfc2XEEQFwS4RuRKanevQowe` for commit `9f2e3a7` was later observed as **CANCELED**. No live preview or successful build was obtained. **No replacement build is requested.**
- GitHub connector writes, code inspection, and isolated mock tests are available without launching GitHub Actions.

## Remaining release gates
Before production: a full dependency-aware build on a no-cost environment that can access the repository and npm packages; manual Telegram Mini App tests for real OTP, linked account ownership, two-account switching, 100+ dialogs, large photos, sticker/file sends, voice drafts, and Stories; comparison of production branch with PR #185. Passing the isolated checks alone is not sufficient to claim production readiness.

Never weaken login verification, disable auth checks, fabricate chat/photos, or silently enable costs merely to make a preview look ready.

## 2026-10-27 — safer polling and no-cost CI

- Updated `.github/workflows/vetogram-verification.yml` from automatic `push` / `pull_request` to **manual `workflow_dispatch` only** on PR #185's feature branch. This prevents future automatic runner requests *once this workflow version is active*; other branches can still have their own workflow configuration. Restore automated checks only when the owner explicitly authorizes runner usage and has verified GitHub billing. Existing repository branch protection rules may still require a passing check to merge.
- Extended `npm run qa:free` to six dependency-free `node --check` checks and sixteen `node --test` suites. Included an invariant check to prevent accidental reintroduction of paid runner triggers or dependency installs into zero-budget QA. This command **was not executed as a full Node test suite** in this session; the current working container cannot fetch a checkout from GitHub.
- Fixed a specific race in shipping `pollThread`: an old failed poll from chat A can return after A→B→A, causing a stale 401/403 to erase valid state or a stale 503 to overwrite the current connection indicator. The catch path now requires both the same `threadGeneration` and `syncRunId` as the launched poll, alongside the same signed owner/chat. Four new regression cases were added to `tests/vetogram-poll-auth-51.test.js`. Independent execution of the exact controller with fake asynchronous transport returned the expected six cases: stale 401/403/503 ignored, current 401/403 correctly revoked, current 503 retained verified history.
- The owner reconnect action was inspected: `window.VetoTelegramOpenAccountConnection` is defined in `public/app.js`, and the fallback `connectTelegramButton` is defined in `public/studio.html`; no broken selector could be confirmed from source alone.

The prior Vercel preview remained canceled; no new deployment was triggered, no live Telegram account accessed, and production was not modified.
