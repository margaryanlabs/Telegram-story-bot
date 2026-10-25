# VETOGRAM 3.2 — release audit and work log (25 October 2026)

## Scope and rule
Changes are made in the **existing** `margaryanlabs/Telegram-story-bot` Mini App on draft PR #181, preserving parents PR #179 (unified consent) and #180 (Story Engine) and the pending #178 hotfix. This is **not** a new app and **not** a production release. The review checks do not authorize unsafe Telegram actions or spending.

## Changes committed in this pass
1. `public/vetogram-finish-2026.css` provides a real last-loaded presentation layer with restrained home screen entry, dashboard and mission-card transitions, touch/focus affordances, mobile 365px behavior, true light-theme outlines and explicit `prefers-reduced-motion` fallbacks. The status animation applies **only** to state `checking`; it makes no claim of Telegram success.
2. `public/studio.html` loads this last stylesheet, localizes important labels and preserves the existing Telegram/navigation/creator structure. No fake account, animation-only chart or disconnected HTML was added.
3. **Fixed actual Creator deep links:** four Sticker/Brand Pack buttons and the global command palette had `data-open-screen="studio"`, but the app intentionally aliases `studio` to the *Story Engine* tab. They now use the already-supported `creator → studio` alias, and `public/vetogram-command-2026.js` explicitly allows `creator`. The main navigation `data-nav="studio"` still opens Story Engine.
4. **Fixed AI-ответ shortcuts:** chat list and thread AI controls explicitly carry `data-ai-mode="reply"`. The VETO AI controller now recognizes allowlisted human-click `reply` and `story` deep links. It does not make requests, preselect a chat, transmit message content or send anything on navigation.
5. Added `tests/vetogram-motion-finish.test.js` (3 test cases) and `tests/vetogram-ai-deep-links.test.js` (2 test cases), extended existing command-palette navigation regression, and included new checks in free `qa:core:offline`, `ci:offline` and syntax `check` scripts.

## Evidence gathered here
Seven connected-source/static gates passed, covering all declarative navigation destinations, all four Creator links, the Creator palette, two Reply shortcuts, allowlisted AI modes, last-loaded CSS, balanced CSS braces and test registration. This is **not** a claim that `npm test` or the real Android/iPhone UI has passed.

## Existing external release blockers (not resolved by UI changes)
- The committed `package-lock.json` is missing lock resolution for `@aws-sdk/client-s3@3.821.0`, `@aws-sdk/s3-request-presigner@3.821.0` and `@neondatabase/serverless@1.0.2`. `npm ci` will fail; only a trusted, network-enabled `npm run lock:refresh` can generate authentic dependency integrity records. DO NOT handwrite or remove live dependencies.
- GitHub Actions on prior runs had no assigned runner/steps. Check repository/org Actions spending, security and runner policy; no native test/temporary Postgres completion is evidenced. Do not loop reruns.
- Second-account Vercel project `veto` has previous READY production at `6504a387`; new branch previews were `CANCELED` and branch commit status indicates Vercel build-rate-limit. No new Preview/production acceptance exists.
- All six additive AI/cloud-task/reminder migrations remain staged/unapplied, and model/workers/monetization feature switches remain disabled. No runtime secret changes, Neon writes or webhook mutation were authorized.

## Release acceptance (hard stop until all met)
1. Verify exact PR #181 branch head and parent histories (#178/#179/#180); merge in dependency order and preserve each owner-auth/security fix. Review all conflicts. Do not bypass anti-delete or Telegram Business consent controls.
2. Refresh lock using official npm registry, inspect diff, `npm run lock:check && npm ci && npm run ci:offline && npm run check && npm test`; run disposable Postgres migrations, race tests and reminders worker tests without production secrets.
3. Stage an approved Vercel Preview in **labsmargaryan@gmail.com / veto**, after rate-limit / ignored-build-step issue is resolved; verify auth-guarded endpoints, response headers, route rewrites and mobile source serving.
4. Test on consenting Telegram accounts A and B: signed login through QR/phone/2FA; disconnect/reconnect; Telegram code delivery and error/rate-limit UX; Business scope and explicit archive consent; send/edit/delete in allowed chats and verify actual anti-delete across app restarts; Story recipient audience + confirmed Story ID; attempt legitimate non-Premium flow and report actual Telegram restriction rather than promise unsupported bypass; switches A→B under in-flight actions; AI reply draft and separate explicit send confirmation; retry uncertainty; voice permissions, media, chat keyboard, light/dark/Fold/Android/iOS.
5. Before AI/cloud tasks/reminders go live, apply and verify the six approved Neon migrations against correct environment, ensure quota and cost caps, owner-specific secrets and cancellation protections, then provision an authenticated scheduler suitable for timing requirements. Public subscriptions, Telegram Stars and referrals require their own real end-to-end ledger/webhook and entitlement tests. No fictitious payment enabled status.
6. Only after these gates: review final visual QA + telemetry, prepare rollback and deploy **one** controlled production version. Stop on any privacy, owner-data isolation, payments, postStory, archive or message delivery failure.

## Current decision
**Source changes prepared in draft PR #181. Not release-ready; no merge, deploy, migration, API activation, cost or live Telegram action performed in this pass.**

## 25 October continuation — API, assets, auth controls, performance

These changes remain in PR #181 only; no production/Neon/TG mutation.

- **Regression coverage:** Added `tests/vetogram-release-surface.test.js` to the offline QA and syntax preflight. It scans the real shipped public modules for API paths and verifies each has a Hobby router loader and handler file. It verifies all root-level static resources used by `public/studio.html`, the single Vercel function/rewrite, the Creator vs Story Engine navigation alias, and that every generated login/security `data-sheet-action` is covered by an app handler.
- **Current connected-source scan:** 40 API endpoint loaders in the single router; 25 distinct API endpoints referenced in the examined main client modules, all routed; 38 distinct root-level static resources referenced by the Mini App HTML, all present in the connected GitHub public directory; 35 sheet actions generated by app.js, all with `action ===` handlers. These are source-level inventory checks, not runtime endpoint availability or full coverage of dynamically generated calls.
- **Mobile responsiveness fix:** `public/app.js` formerly recalculated large visual gradients on each pointer and touch movement, including Telegram chat scrolling. Now pointer spotlight movement is coalesced via `requestAnimationFrame` on hover/fine-pointer desktops only; mobile, hidden-tab and reduced-motion contexts use the static visual. `tests/vetogram-spotlight-performance.test.js` covers rapid pointer batching, viewport clamping, hidden WebView, and no mobile/reduced-motion listeners; registered in offline QA. Direct connected-source V8 simulation showed 25 rapid pointer events coalesce to one visual frame. This is not physical Android FPS testing.
- **Login UX:** Phone and pending-code sheets now visibly expose `viewer-start-qr` as a deliberate alternative, avoiding buried support steps or repeated SendCode attempts. QR controller retains existing phone-code challenge until successful authorization; added source regression checks. Real MTProto / QR login still needs test accounts and WebView verification.
- **Static-only limitations:** No native Node `npm test`, `npm ci`, SQL migration, Telegram/AI network verification, real iOS/Android rendering, paid subscription, merge or deploy. The external npm lockfile/GitHub Actions/Vercel build quota blockers remain in force.

