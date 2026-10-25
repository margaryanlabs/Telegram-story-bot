# VETOGRAM REBORN — integrated release plan

Date: 2026-10-25. Status: **STAGED IN GITHUB ONLY — no deployment requested or performed for this update**.

## Why users previously saw manual Telegram Business setup

Telegram itself supports in-app MTProto `account.updateConnectedBot` without Premium. VETOGRAM already had the backend wizard, but production blocked it with `VETOGRAM_UNIFIED_ONBOARDING` (disabled unless =1) and the old Privacy UI treated manual navigation to Telegram Settings as the default. Direct Business connection also depends on a signed, owner-matching personal Telegram session and a supported Business bot.

## Implemented code in this phase

- The main Privacy onboarding CTA is **In-app Anti-Delete**. Old manual steps are behind an optional disclosure. If automatic connection is not enabled or the server is not ready, the screen explains this transparently and offers a manual route only as an emergency fallback. Never replaces a different connected Business bot.
- **Least privilege**: no default all-private recipient scope; new connections default to selected private chats (requires at least one explicit selection), existing owners default to preserving their current scope. Story management and Anti-Delete are separate unchecked opt-ins; accepting recipient scope does not grant either. No Telegram access changes occur until explicit confirmation.
- Protects against identity-switch race: a prepared wizard response is discarded if the signed Mini App `initData` changes; attempts to apply prior owner's snapshot are canceled on the client, and the server already binds its HMAC snapshot to the signed Telegram owner and current Business connection state.
- The backend now requires a **read-only production Neon schema v5 readiness check**, after the explicit environment feature flag and before reading sessions or performing Telegram writes. If it is not ready, `prepare` reports an unavailable feature; `connect` fails closed.
- **Neon migration exists**: `db/neon/005_business_connection_write_leases.sql`. It is staged and **was NOT executed**. An earlier inventory said the *live* `veto_business_write_leases` table was absent; current live DB status still needs independent verification before release. Existing preflight `npm run neon:preflight` must validate migration >=5 and compatible encrypted session key.
- AI stage 2: actual conversation panel moved above the long composer, more compact mobile hierarchy, local-only draft examples (never submit or toggle provider consent), simple chat-inbox priorities and calmer visual density. All real controller IDs, message data and actions remain intact.

## Acceptance gates before one coordinated final release

1. Verify exact intended Vercel account/project (second account `labsmargaryan@gmail.com`, project `veto`) and latest GitHub PR chain.
2. Run the normal Node test suite and `npm run vercel-build` in a checked-out environment **as part of the single final release process**, not per change.
3. Independently inspect and apply the reviewed Neon v5 migration only within the approved release window, after DB backup and confirming original session key compatibility. Do not apply a second time blindly.
4. Enable the production `VETOGRAM_UNIFIED_ONBOARDING=1` flag **only after** migration and staging tests, with a rapid disable/rollback plan. Configuration not changed here.
5. With a dedicated test Telegram account, verify signed login, phone code or QR, owner isolation, bot Business mode, one-chat opt-in, all-private opt-in and explicit rejection on another connected bot.
6. Test a new consented message, edit and delete from a second account in the chosen allowed chat. Verify actual webhook event delivery and archived copies. Do not claim previously deleted messages are recoverable.
7. Test opt-in to Story-management separately and verify the Telegram capabilities and premium-related restrictions rather than promising unsupported publishing.
8. Run full real-device QA on Android/Fold and Telegram WebView (insets, keyboard, scroll, tabs, live messages, AI controls, Story editing), performance and RU/EN/HY strings.
9. Publish one final production deployment after gates pass, then verify the official domain and rollback readiness.

## Status honestly reported

Pure source syntax and a focused isolated VETOGRAM REBORN source-contract test harness pass. **This is not full Node/npm or visual/integration certification**. The Business-feature flag remains disabled in production, the Neon migration remains unapplied as part of this task, and live Telegram code delivery plus Business event reception have not been verified.

User explicitly requested **no more intermediate deployments**. Honor that instruction.

## Additional verified engineering findings and fixes

- Read-only inspection of connected Neon project `veto-telegram-free` / main on 2026-10-25 found **schema version 4** and **no `public.veto_business_write_leases` table**. This is a confirmed production blocker, not an assumption; do not enable Business writes until migration v5 and lease preflight have been reviewed and applied.
- Fixed **15 invalid login modal CSS selectors** that mistakenly searched for `body` under itself/the root `#vetogram`. The actual root is `<html id="vetogram" class="vetogram-noir">`.
- Corrected the shared modal: both `app.js` and `privacy.js` now delegate to one controller for background navigation, safe-area, keyboard focus and Telegram BackButton handling. Closing also halts local Privacy backup work and releases temporary media URLs.
- Scope-specific Business checkboxes: selecting exact chats disables exclusion boxes, while preserve scope disables and clears both selectors. This avoids stale or contradictory consent payloads.
- Removed duplicate close buttons and corrected misleading Anti-Delete status copy: saved settings alone are **not** proof of an incoming delete event.
- One isolated 4-check source contract suite passed (new tests at `tests/vetogram-reborn-modal-permissions.test.js`); the +7 shared-code country-picker interaction passed an isolated harness. These are **not** real Telegram or browser tests.
- Normal Node test suite / full build / physical WebView verification remain outstanding under the one-final-release gate.


### Security correction: preview builds are real Telegram writes too

The previous implementation implicitly enabled automatic Business connection in non-production Vercel environments and bypassed the Neon atomic write lease check outside production. **Both bypasses have now been removed.** All environments require explicit `VETOGRAM_UNIFIED_ONBOARDING=1` and read-only proof of a Neon storage backend with schema >= 5 and the actual `veto_business_write_leases` table. This is deliberate: preview URLs can be visited by real Telegram accounts. The normal default remains disabled until release gates are complete.

Personal-account management is now distinct from Business onboarding; opening profile/account status cannot launch a Business permissions wizard. Story publishing and viewer-identification copy now accurately describes provider-dependent capabilities rather than promising them after login.


### Continuing engineering audit — state and permission separation

- Personal Telegram account management no longer auto-opens Business consent. It opens account status, while Anti-Delete remains a separate, opt-in Privacy flow.
- Business automation now **requires explicit `VETOGRAM_UNIFIED_ONBOARDING=1` in all environments**, not just production. The Neon schema/lease readiness preflight is equally mandatory in preview and development; a preview URL is not a safe sandbox for real Telegram permission writes.
- Onboarding copy no longer marks Stories publishing or viewer identities as automatically available after login.
- Account profile no longer interprets `state.connection === 'needs_permission'` as a connected bot. It shows permission required separately and does not claim the receipt of Anti-Delete events from mere stored configuration.
- Source/DOM contract tests for modal, consent, identity and truthful status passed **8/8** in an isolated JavaScript harness. Full repository suite and real Telegram verification remain pending until the coordinated release gate.
