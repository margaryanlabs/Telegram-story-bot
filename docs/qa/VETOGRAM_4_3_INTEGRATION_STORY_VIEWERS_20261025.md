# VETOGRAM 4.3 — Owner-safe integrated Story, Viewer and Automation flows
25 October 2026 · Existing VETOGRAM Telegram Mini App · Draft PR #181

## Concrete risks found and repaired
1. **Overlapping Story image preparation.** Two overlapping `prepareComposerFile` operations could finish in reverse order and replace a newer image with an older one. Clicking remove during preparation could also leave the old result able to repopulate the editor. Added `composerGeneration` as an in-memory attempt epoch. Only the latest job may update media, image data, preview, nonce, busy state, or errors. `resetComposer` invalidates all previous jobs.
2. **Account-scoped Story drafts.** Prepared media now stores the signing `composerOwner` at the time the image is accepted. If `tg.initData` changes during image processing, the old result is dropped and the incomplete draft reset. A photo prepared for account A cannot be published under account B. Screen navigation also clears a prepared image once the current signed owner no longer matches. Existing publication still requires explicit user action, a valid audience and server-side authorization.
3. **Main `/api/miniapp` response safety.** The request now captures the actual signed Telegram initData once, uses that in the header, then verifies that the same value is still active before touching the user's Story state, activity and avatar. Stale owner A replies are discarded rather than painting over B.
4. **Viewers, audience and Analytics response safety.** `viewerApi`, `refreshViewerSync`, and `refreshViewerAnalytics` now check the captured signed owner after awaited network operations and before mutating viewer session, viewer register key, analytics, notices or rendering. Old owner results and errors are not shown in the new owner's interface.
5. **Automation Center response safety.** `automationsApi` captures and checks the same Telegram owner before returning API results. This does not enable or modify automation settings; consent remains explicit.
6. **Asset freshness.** `studio.html` now requests `/app.js?v=20261025-owner-integration-43`. This invalidates the previous static script cache only once a Preview or production build is deployed elsewhere.

## Boundaries retained
- Telegram Business, Anti-Delete, saved archives, AI provider consent, explicit AI message confirmation, manual Stories publication and protected owner checks remain in their existing modules. No real messages, Story or AI requests were sent from this audit.
- No data persistence or new credentials were added. A local generation counter is not a replacement for server identity verification.
- The actual backend still needs end-to-end tests for Telegram permission requirements, Premium Story eligibility and idempotent publication retries, as well as correct server-side account/session isolation.

## Automated evidence
- `tests/vetogram-integration-story-43.test.js`: **7/7** isolated behavior/source tests passed, including reversed async image processing, deletion during processing, owner switching, wrong-owner publication prevention, stale main API response and explicit Story/AI/Privacy boundaries.
- `tests/vetogram-integration-viewers-43.test.js`: **9/9** isolated behavior/source tests passed, including stale Viewer API, Analytics success/errors, Viewer Sync success/errors, current-owner acceptance, Automation Center stale responses and fresh asset reference.
- Both suites registered in `ci:offline`, `qa:core:offline` and JS syntax `check`.
- GitHub commit checks / PR workflow runs: none reported for the inspected branch HEAD during this audit. **No full npm/Node CI, browser screenshot test or Telegram real-account test was completed.**
- Full `public/app.js` parsed in the V8 engine; all changed JS syntax should still be validated by actual repo CI.

## Real device/release acceptance
1. Story Engine export → Publisher: choose photo A, then B while A compresses; confirm B remains. Remove while loading, reopen and retry. Verify no old image/nonce comes back.
2. Log in to own Telegram account, export a Story, change owner or invalidate session; the old image must not be publishable in the new account. Confirm an intentionally chosen new photo can be uploaded.
3. Upload actual JPEG/PNG/WebP, audience selected/contacts/all restrictions, Story publication and correct returned Story ID; verify handling of API timeout/retry and no duplicate publishing.
4. Open Viewers and Analytics during login/session switches or flaky data requests; there must be no cross-owner displayed counts, usernames or saved audience data.
5. AI chat/send requires opt-in, explicit owner/recipient confirmation and no background automatic messages. Privacy connection must honor actual separate Business consent.
6. Revisit all 13 screens on iPhone/Android/Fold and exercise keyboard, mic permissions, media, Back navigation, dark/light themes and reduced-motion settings.
7. Run full `npm ci`, `npm run check`, project tests and deploy a Preview through the Vercel release workstream before considering production merge.

## Release status
All modifications are confined to the shared draft PR #181 branch. Vercel, Neon, main, production, payments, live Telegram actions and API keys were untouched.
