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


## 2026-10-27 — inbox session revocation and A→B→A recovery

- **Owner-safety regression:** a revoked MTProto session can be detected in either `loadMessages()`, `pollThread()`, or the `loadChats()` inbox refresh. Previously only the thread paths invoked `invalidateThreadAuthorization()`; the inbox failure handler hid chats but retained private RAM-only thread cache, avatar blobs, unsent drafts and prior retry nonces. For explicit HTTP `401/403/409`, the inbox now invokes the exact same shared owner-invalidation handler before switching to the connection screen. Temporary network `503` continues to retain owner-verified RAM history and draft state. The actual source handlers were exercised in an isolated JavaScript environment for 401,403,409,503: privacy data cleared exactly once for revoked sessions, and verified state remained visible on transient 503. `tests/vetogram-inbox-outage-51.test.js` now covers both paths. This is not a live account test.
- **Stale reopening regression:** a delayed open-thread completion can outlive navigation A→B→A and post an old uncertain-send warning on the current A. `openThread()` now records the exact `threadGeneration` created by its `loadMessages()` call and checks that it is still active before posting the warning. The new three-case `tests/vetogram-stale-open-51.test.js` is part of both `qa:free` and `qa:reborn:offline`. An isolated V8 evaluation of shipping `openThread()` with three deferred requests produced exactly one warning for the currently active A and none from the two stale opens.
- **No-cost observability:** Vercel's production grouped runtime error summary over the past 24h showed one warning family, Node `DEP0169` (`url.parse()` deprecation) at `/api/router.js`; it does **not** establish the cause of the user's Telegram chat login/refresh failures. Detailed logs requested beyond the plan's one-hour retention were unavailable; a recent grouped 30-minute log lookup returned no entries. No credentials, message bodies, or personal logs were extracted. Do not claim a confirmed production diagnosis from this.
- All 44 asset-version references in `public/studio.html` now use `20261027-v51-session-races`; they remain **unbuilt and undeployed** until a future accepted release. `qa:free` now contains **17** no-install Node test files and needs an available local checkout to run. GitHub Actions is still not used, no new Vercel deployment was created, and production is untouched.

**Open acceptance gates:** full checkout-based Node test execution, dependency-aware build, two signed Telegram owner sessions, actual photo/send/sticker/voice and Stories flows, rate-limit behavior, production-branch merge reconciliation. None can be marked passed by the above isolated mocks.


## 2026-10-28 — cancellable chat requests and keyboard-safe Canvas Noir

**Network / responsiveness.** The 22-second `/api/telegram-chats` HTTP timeout is necessary for a current chat, but an obsolete A history fetch was continuing after the owner navigated A→B. Added `state.threadRequestAbort`, a single owner-scoped `cancelThreadRequest()`, and external abort support to the shared `request(action,payload,externalSignal)` helper. `openThread`, `back`, `resetOwner` and explicit auth revocation now abort the obsolete thread request. Each `loadMessages` owns its own AbortController; completion only clears that exact controller, so a stale request cannot clear the active B request. Generation and signed-owner guards remain mandatory. Nothing retries or sends messages automatically.

**Visual quality / keyboard.** The final loaded `vetogram-noir.css` contained a higher-specificity `height:100dvh!important` rule for the immersive chat `.app-shell`. This could override earlier `--veto-visible-height` CSS designed to keep the composer above mobile keyboards. Corrected the final CSS cascade to use the measured viewport variable for the shell, mirror and thread, with a flexing, independently scrollable body. Long names and URLs no longer need to widen the window; the composer uses a 16px mobile font and 40–44px controls. With a keyboard *actually open*, only secondary security/status and AI header actions collapse to reserve message space; they return when it closes. No new fonts, graphics, data sources or CSS animation effects.

**Checks.** Added `tests/vetogram-thread-cancel-51.test.js` and `tests/vetogram-mobile-chat-viewport-51.test.js` to both no-install `qa:free` and focused QA. Updated three pre-existing VM fixtures to include cancellation helpers and real AbortController. Current `qa:free` lists 19 test files and existing `node --check` checks. Actual shipping request+history controllers were exercised in a single offline JavaScript isolate: on navigation the pending fetch's signal changed to aborted, the controller reference was cleared and the new B thread stayed unchanged with no false error. Syntax of client and directly affected test sources also parsed; these are isolated evaluations and static CSS assertions, NOT a full Node test execution, cross-device screenshot audit, real Telegram login or production acceptance.

**Delivery:** all 44 `studio.html` asset references were updated to `20261028-v51-keyboard-history`. PR #185 stays draft and no production build, paid GitHub Actions runner, additional Vercel preview or account login was attempted.
