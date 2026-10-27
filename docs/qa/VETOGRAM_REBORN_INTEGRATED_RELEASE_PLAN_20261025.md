## V4.11 OTP safety continuation — 2026-10-26 (NEON V6 APPLIED / VERIFIED)

- Migration `db/neon/006_login_code_request_leases.sql` committed and **applied 2026-10-26** to Neon project `veto-telegram-free` / database `veto_telegram`. Read-only verification: schemaVersion=6, Business lease table exists, OTP lease table and expires index exist, 0 OTP lease rows after migration and 0 PUBLIC table grants. Existing private sessions/messages were not rewritten. Do not reapply this migration.
- `api/viewer-sync.js` now retains the same-runtime duplicate-send guard and, for the explicitly selected Neon provider only, claims an atomic owner-scoped 180-second lease before `beginUserAuth`. It rechecks the challenge under the lease; a second Vercel instance gets HTTP 429 rather than sending an overlapping code. The release is token-checked and best effort; ambiguous Telegram send/failed challenge persistence holds the lease until expiry.
- A successful Neon code response now requires actual persisted encrypted challenge evidence. The legacy Supabase code path is left unchanged and **does not have distributed OTP serialization**.
- `configState()` reads the Neon v6 lease readiness without sending a code and exposes `newConnectionsReady=false` plus `NEON_LOGIN_CODE_LEASE_V6` if unavailable. `npm run neon:preflight` now requires v6 as a read-only release gate.
- Added actual-controller isolated regressions for two separate server instances, missing migration, database persistence failure and readiness. Pure V8 source handlers were executed with fake Telegram/storage; **additive Neon v6 SQL was applied and the schema verified; no genuine Telegram login/device test or full Node/npm build has run**.
- Remaining release order: run full `npm ci` + `npm run vercel-build`; confirm `viewer_crypto_health` and real Telegram phone/QR + Business events with consented test accounts; verify AI runtime provider/budget separately; approve Android/iOS/Fold Canvas Noir and RU/EN/HY UI; then deploy once. Do not merge draft or toggle Business flags until gates pass.

## Neon schema status — verified 2026-10-25
- Project: `veto-telegram-free` (`small-glitter-11116693`), branch `main` (`br-super-king-b9vfmlr4`), database `veto_telegram`.
- **Migration 005 successfully applied in one transaction**: `CREATE TABLE IF NOT EXISTS`, `REVOKE ALL FROM PUBLIC`, `CREATE INDEX IF NOT EXISTS`, ledger version 5 with `ON CONFLICT DO NOTHING`.
- Post-write checks: schema version=5, ledger v5 entries=1, lease table present, expiry index present, active leases=0, PUBLIC SELECT=false and PUBLIC INSERT=false.
- Existing session/message tables were not changed by this migration.
- Remaining release gates: personal Telegram login, Bot API business webhook/event delivery, targeted owner-safe Anti-Delete tests, explicit feature flag, full build and mobile QA. No deployment and no flag change accompanied this database migration.

# VETOGRAM REBORN — integrated release plan

Date: 2026-10-25. Status: **STAGED IN GITHUB ONLY — no deployment requested or performed for this update**.

## Why users previously saw manual Telegram Business setup

Telegram itself supports in-app MTProto `account.updateConnectedBot` without Premium. VETOGRAM already had the backend wizard, but production blocked it with `VETOGRAM_UNIFIED_ONBOARDING` (disabled unless =1) and the old Privacy UI treated manual navigation to Telegram Settings as the default. Direct Business connection also depends on a signed, owner-matching personal Telegram session and a supported Business bot.

## Implemented code in this phase

- The main Privacy onboarding CTA is **In-app Anti-Delete**. Old manual steps are behind an optional disclosure. If automatic connection is not enabled or the server is not ready, the screen explains this transparently and offers a manual route only as an emergency fallback. Never replaces a different connected Business bot.
- **Least privilege**: no default all-private recipient scope; new connections default to selected private chats (requires at least one explicit selection), existing owners default to preserving their current scope. Story management and Anti-Delete are separate unchecked opt-ins; accepting recipient scope does not grant either. No Telegram access changes occur until explicit confirmation.
- Protects against identity-switch race: a prepared wizard response is discarded if the signed Mini App `initData` changes; attempts to apply prior owner's snapshot are canceled on the client, and the server already binds its HMAC snapshot to the signed Telegram owner and current Business connection state.
- The backend now requires a **read-only production Neon schema v5 readiness check**, after the explicit environment feature flag and before reading sessions or performing Telegram writes. If it is not ready, `prepare` reports an unavailable feature; `connect` fails closed.
- **Neon migration exists**: `db/neon/005_business_connection_write_leases.sql`. It was **applied to live Neon on 2026-10-25** in a single transaction; schema v5, `veto_business_write_leases`, expiration index and denied PUBLIC table grants were verified independently. Existing preflight `npm run neon:preflight` must validate migration >=5 and compatible encrypted session key.
- AI stage 2: actual conversation panel moved above the long composer, more compact mobile hierarchy, local-only draft examples (never submit or toggle provider consent), simple chat-inbox priorities and calmer visual density. All real controller IDs, message data and actions remain intact.

## Acceptance gates before one coordinated final release

1. Verify exact intended Vercel account/project (second account `labsmargaryan@gmail.com`, project `veto`) and latest GitHub PR chain.
2. Run the normal Node test suite and `npm run vercel-build` in a checked-out environment **as part of the single final release process**, not per change.
3. **Completed 2026-10-25:** migration v5 was applied to main and independently verified. At final release run the read-only Neon preflight and confirm session encryption compatibility. Do not reapply the migration.
4. Enable the production `VETOGRAM_UNIFIED_ONBOARDING=1` flag **only after** migration and staging tests, with a rapid disable/rollback plan. Configuration not changed here.
5. With a dedicated test Telegram account, verify signed login, phone code or QR, owner isolation, bot Business mode, one-chat opt-in, all-private opt-in and explicit rejection on another connected bot.
6. Test a new consented message, edit and delete from a second account in the chosen allowed chat. Verify actual webhook event delivery and archived copies. Do not claim previously deleted messages are recoverable.
7. Test opt-in to Story-management separately and verify the Telegram capabilities and premium-related restrictions rather than promising unsupported publishing.
8. Run full real-device QA on Android/Fold and Telegram WebView (insets, keyboard, scroll, tabs, live messages, AI controls, Story editing), performance and RU/EN/HY strings.
9. Publish one final production deployment after gates pass, then verify the official domain and rollback readiness.

## Status honestly reported

Pure source syntax and a focused isolated VETOGRAM REBORN source-contract test harness pass. **This is not full Node/npm or visual/integration certification**. The Business-feature flag remains disabled in production, the Neon v5 migration has now been applied and verified, and live Telegram code delivery plus Business event reception have not been verified.

User explicitly requested **no more intermediate deployments**. Honor that instruction.

## Additional verified engineering findings and fixes

- **Resolved 2026-10-25:** an earlier read-only inspection found schema v4 and no lease table. The additive SQL migration was subsequently applied to Neon main; the independent post-migration query confirmed **schema v5**, the lease table, its expiry index, no active leases, and no PUBLIC SELECT/INSERT privileges. This is no longer a release blocker. Live Telegram connection and webhook-event tests remain necessary.
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


### Login recovery and explicit Business opt-in — latest code fix

- The client now mirrors the server's pending OTP challenge immediately after a successful `send_code` or a resumed valid challenge, preserving the expiry/delivery classification and allowing a return to code/2FA without making another Telegram request.
- On server HTTP 409 with an existing valid challenge, the user sees explicit **Resume login** or **Cancel & switch phone** actions; neither is executed automatically. A stale/expired challenge never presents that option.
- Removed both automatic Business permission wizard invocations after successful OTP and after successful Telegram 2FA. Privacy/Anti-Delete is a separate opt-in, never an implicit sequel to personal account login.
- Removed duplicate close buttons from the Business confirmation outcome; preserved the warning when archive settings were not saved.
- Targeted four login-recovery checks passed in an isolated JavaScript harness. No claims of Telegram code delivery or full npm test completion.

## Webhook reliability continuation — 25 October 2026

- **Anti-Delete idempotency:** `api/webhook-v7.js` now sends a delete alert only when the archive actually reports newly deleted, retained messages (`result.events.length>0`). Before this, Telegram's normal retry of the same update could notify the user again merely because `deleted.message_ids` was nonempty.
- **Honest delete API:** per-update `retained` is true only when a previously stored message was newly tombstoned, while `retention_enabled` separately describes the user's configuration. A replay does not pretend to create a new deletion.
- **Known limitation:** for a deletion whose message was never captured in the archive, the Bot API deletion event alone does not establish the missing message's contents. Without a separate idempotent unknown-deletion ledger, this code deliberately does not emit an unprovable/repeated "copy preserved" notification. This behavior needs clear product communication.
- **Story webhook hardening:** in `api/webhook-v8.js`, optional Bot API progress messages, picker state reads, picker cleanup and final status edits now fail independently; errors are logged, not allowed to prevent the actual `webhook-v7` publisher from running or override its response.
- Mocked regression suite exercised the production webhook handler code: **6/6** Business lifecycle and duplicate-delete cases, **5/5** optional-v8-UI-failure cases passed in an isolated JS harness. No Bot API credentials, user messages, Neon writes, Vercel build or deployment were used.
- Full repository Node suite, Telegram signed connection + webhook live-delivery QA, actual publication and mobile design verification remain release gates. Business flag stays disabled until those gates are complete.

## V4.1 Canvas Noir continuation — restored cross-chat design stages (25 October)

The approved direction is **Canvas Noir**, option 1 from the V4 visual exploration: dark, centered, restrained, contextual tools, **all product modules**, not Story Lab alone. Source of truth: PR #182 (NOIR) → #183 (V4 audit) → #184 (Canvas Noir) → current #185 (REBORN). Keep this stacked integration until one final verified release. Do not start an independent preview product.

### Newly implemented here (actual app, not a standalone mock)

- **Privacy / Secure Vault:** move the same `ghost-health-grid` and `ghost-quick-grid` DOM nodes directly below the real `ghost-command-card`. Actual archived counts and existing deleted/edited/media/all filters become the main product surface. Long setup, backup and manual Business permissions remain available below and keep their original IDs/listeners.
- **Voice Studio:** the "signal" label was previously permanently rendered as processing even with microphone off. The label and visual state now observe the existing `voiceMicState` classes set by `voice-studio.js` (`is-requesting-mic`, `live`, `recording`). Initial offline HTML says microphone OFF. Animating the recording border occurs only for the genuine recording flag, and stops with reduced motion.
- **VETO AI:** the real `aria-pressed` AI mode controls drive the small conversation-header mode label; the starter draft logic remains local, manually triggered and cannot bypass AI provider consent.
- **Responsive NOIR:** original Voice preset controls, actual media spectrum, actual Privacy statistics/actions and AI context chip now have 760/380px layout rules; no additional stylesheet or API.
- Four new isolated real-source checks passed in a V8 harness covering Vault DOM references, pure Voice status mapping, AI selected mode and CSS/HTML source wiring. **This is not a full Node test run, browser rendering or live Telegram test**.

### Remaining approved V4 stages (not falsely declared finished)

1. **Chats / messenger:** live two-account keyboard and swipe inspection, multi-photo and media lightbox interactions, owner isolation, clear connection/archived state, compact Fold thread/composer.
2. **Stories / Story Engine:** canvas-first Quick / Pro / AI Director, real export and handoff, layers, zoom/drag, Remix; verify codec support and publishing rights. Do not represent local presets as generated AI.
3. **VETO AI:** direct conversation and human-approved send, translate/rewrite and Story ideas; verify live provider errors, quota, mode focus and permission-preserving memory/task/approval workspaces.
4. **Privacy / Secure Vault:** confirm actual newly archived message, edit, delete, alert and optional media across two accounts, and that settings-only states never advertise retained evidence. Maintain optional, explicit Business permissions.
5. **Voice Studio:** test real mic permission, cancellation, start/stop, original vs processed local recording, audio export and share on Telegram Android/iOS/WebView; live status must follow device state.
6. **System-level UX:** RU first, review EN/HY fallback, responsive 320/360/390/430/Fold/tablet/desktop, focus/back/keyboard/safe areas, dark/light, no scroll traps, reduced motion and 44px interaction targets.
7. **Final release:** verify tests/build in checked-out repo and real Telegram flows first. Neon v5 is **already applied**, so use read-only preflight only; never repeat it. Keep production feature flag disabled until a signed real-world test, then one controlled deploy/rollback.

As before, no intermediate Vercel release, GitHub merge, new Neon write, credential change or user-data manipulation is part of this stage.

## V4.2 Mobile interactions and draft-history integrity — 25 October 2026

This slice fixes defects in existing V4 UI controllers, not in a standalone preview.

### Messenger gesture trust boundary

- `telegram-chats.js` now stamps the currently rendered message host with only its public Telegram owner numeric ID, chat ID and the in-memory thread generation. These markers are cleared on Back and on owner switch. The signed `initData`, session material and messages are **never** put in dataset attributes.
- The existing V4 message context menu and swipe-to-reply require the currently signed owner to agree with the live DOM owner, selected thread and thread generation. A queued long-press callback checks these constraints before showing any message excerpt.
- Two-finger touch/pinch, vertical movement and scroll cancel the gesture. Stale menus close when owner/thread changes.
- Rightward touch move shows a brief, distance-bound reply affordance on the actual message bubble. Releasing/canceling removes the style. Only an explicitly completed swipe delegates to the original `data-mirror-reply` button; no automatic message send or Telegram API action.
- Fixed asynchronous native-dialog close behavior so an old `close` event cannot clear a newly opened selection.

### Story Studio layer gestures

- Touching an existing text layer now selects it without changing its coordinates or recording an undo snapshot.
- Finger jitter under 12px is ignored. At 12px, the first deliberate move records exactly one undo checkpoint, followed by smooth local layer movement.
- Existing signed owner/draft checks remain before any text position change; switching owners cancels the drag.
- Pinch-to-zoom, export, manual publish confirmation and prior history/AI actions are unchanged.

### Verification and limitations

- Added `tests/vetogram-v4-mobile-gesture-boundaries.test.js` to the existing `node --test tests/*.test.js` suite discovery.
- Ran **5/5 isolated JavaScript regression cases** against freshly fetched actual source, including executing the original Story canvas pointer handlers and owner-check function; all passed.
- Parsed the changed controllers and checked the canonical CSS brace balance.
- A complete Node dependency install, full npm test/build, real gesture performance on Fold/iOS/Android, and live signed two-account E2E have **not** run in this continuation. GitHub CI for PRs aimed at the V4 integration branch is not configured to run automatically.
- No production Vercel deployment, Business permission change, schema migration, GitHub merge or paid runner invocation. Neon schema v5 remains completed.

### Next release gates

1. Real Telegram WebView QA: account switch during an open message action, navigation between two chats while a long press is queued, two-finger swipe/scroll, native long-press and hardware keyboard.
2. Story editor: tap versus drag, undo/redo, pinch zoom, changing draft/owner mid-gesture, and visual inspector on mobile/Fold.
3. Full npm verification then final integrated release review of PR #179 → #185. Keep one deploy after success, not per commit.

## V4.3 owner-safe Privacy / Secure Vault (25 October 2026)

This release-blocking UI privacy fix is implemented inside the same actual Mini App and stacked draft PR #185. No API contracts, server schema, Telegram permissions or deployment settings changed.

### Risk removed from the current interface
- The Privacy client previously kept `threads`, deleted-message feed, active archived thread, diagnostics, backup selection and Business UI state in memory across Telegram user switches. Unlike the Chats client, its refresh path did not check the signed owner before applying asynchronously returned data.
- A delayed `/api/privacy` response, open media, backup results or connection-check result from account A could otherwise overwrite the UI after account B was selected. Because V4.1 promotes archived evidence into the primary Privacy surface, this needed correction before visual release review.

### Safeguards implemented
1. `privacyState.ownerInitData` and monotonic `ownerEpoch` now scope all displayed Private Archive state. On account change, close any private sheet and reset threads, counts, deleted feed, brief, diagnostics, active archived thread, media URL, backup selection/queue and Business wizard snapshots. Stop in-progress client backup loops. The background archive worker is not changed or implicitly enabled.
2. API calls to `/api/privacy`, `/api/miniapp`, `/api/privacy-media`, `/api/privacy-media-recover`, `/api/privacy-backup` and Business wizard check the captured signed `initData` and epoch **after** awaited results. Old responses are discarded. Retry requests cannot silently switch identity between attempts.
3. Backup batch loops and confirmation sheets return without updating the new user's UI when the captured identity becomes stale. Stale failures do not restore old Privacy settings over a new account.
4. While verified owner data is not loaded (or the archive is degraded), archive counters and Smart Inbox counts show **—** instead of fabricated zeroes, and the actionable brief says **Проверяем архив Telegram**, not `CLEAR`. A real empty archive can still display zero **after** a successful verified refresh.
5. No signed `initData` or message bodies are exposed in new DOM attributes; the privacy reset and lease live entirely in client memory.

### Validation & remaining QA
- Added `tests/vetogram-privacy-owner-leases.test.js` with real-source isolated tests for owner reset, in-flight old response rejection, A→B→A epoch mismatch, stale Telegram connection proof rejection, and guarded media/backup/Business routes.
- The committed Privacy script was fetched and passed JavaScript parsing. An isolated live V8 harness exercised stale responses and account-switch logic; **6/6 targeted guard assertions passed**. This is NOT a successful full Node suite, browser/WebView E2E, live Telegram verification or proof of backend event delivery.
- Required later: physical Android/Fold/iOS user-switch during active Media Vault, archive thread, background queue, Business sheet and slow/offline response; confirmed new-owner contents and backdrop clean-up; full `npm test`, `npm run vercel-build` and final preflight.
- Neon schema v5 was already migrated; **do not repeat migration**. Keep `VETOGRAM_UNIFIED_ONBOARDING` OFF and PR Draft. No production deploy, merge or paid CI runner run in this stage.

## V4.4 Privacy ↔ Chats archive navigation and verified Vault UI (25 October 2026)

### Fixes in the real Mini App
- Archive thread now has a monotonic `archiveThreadEpoch`. Rapidly opening thread A then B cannot display A's delayed result over B. Explicit sheet close or Telegram native Back invalidates outstanding archive responses, and Privacy owner switching invalidates both epochs.
- The "Load older messages" request checks both the captured epoch **and active thread object**, so a delayed page cannot merge the wrong chat or overwrite a switched archive sheet. Buttons are restored only while still current; a stale request cannot unlock an unrelated new pagination request.
- Edit History dialogs and archived photo/video/audio blobs check their originating owner + thread before rendering; stale media never gets a fresh object URL attached to the wrong sheet. Delayed deep-link Edit History launch is also gated by the active archived thread.
- Parallel foreground/background refreshes of the same archive are serialized with an in-memory `refreshInFlight` flag. Switching owner clears that flag before the new owner's own refresh.
- The user-facing Canvas Noir Vault now displays a compact **real verified-sync timestamp** and a functional "↻ Обновить" action. The action invokes existing owner-scoped archive refresh and Telegram connection check; it does not create fake activity or claim Anti-Delete delivery.
- On initial HTML paint, the five Vault metrics use **—** instead of fabricated `0`. Numbers appear only after a successful, non-degraded owner-matched archive fetch. The refreshed status identifies empty/offline/pending/unverified states precisely.
- Native archive message modal polished for 320–430px mobile and Fold: sticky identity header, visible close/refresh touch targets, horizontal scrollable filters, readable message bubbles, reduced-motion handling. Existing real buttons and handlers stay intact. Header refresh now has an accessible label.

### Verification
- Added `tests/vetogram-privacy-thread-intents.test.js` running real production handlers in an isolated Node VM with controlled promises. Test scenarios: out-of-order A→B, pagination after chat switch, close while fetch in flight, duplicate-ID pagination preserving offset, plus UI/source acceptance.
- The 6 targeted test cases were executed in an isolated JavaScript harness over freshly fetched GitHub sources; **6/6 passed**. Privacy JS and V4 presentation script parsed; the canonical CSS braces remain balanced.
- No complete npm test suite, WebView rendering screenshots, iOS/Android/Fold gestures, actual Telegram signed-owner use, live archive status check, or webhook/Business integration test was executed in this slice. Do not claim those as complete.
- A final build and real-device QA are still release blockers, along with the entire other V4 module stack. **No deploy / merge / Neon migration / production flag change.**

## V4.5 Story / Voice / AI owner-safe lifecycle (25 October 2026)

Continue implementation in existing `margaryanlabs/Telegram-story-bot` branch and PR #185. This stage does **not** deploy, enable unified onboarding, touch Neon, consume AI provider quota, change permissions or merge.

### Story Studio
- Fixed potential loss of text/layer changes while `saveDraft()` awaits IndexedDB: a monotonic editor revision is now incremented by checkpoints, successive text keystrokes and draft switches. An old persisted snapshot cannot overwrite a newer live document; UI says when fresh edits still need a follow-up save.
- IndexedDB transaction wrapper now resolves **only on `tx.oncomplete`**, not `put().onsuccess`. A later transaction abort must not yield a false saved confirmation.
- Photo image error callbacks are owner/draft/image gated, so a stale image cannot show an error on another user's story.
- JPEG download and publisher handoff check both signed owner/draft **and revision** after async encoding; a change made during `toBlob()` cancels the handoff rather than producing a mismatched image/caption snapshot. Audience confirmation remains separate.

### Voice Studio
- Every `MediaRecorder` callback is bound to a recording epoch, active recorder instance and the Telegram signed session. Cancelling mic, leaving Voice, switching account, hiding/pagehide invalidates late onstop and stops tracks. Private pending blobs and object URLs are cleared on leaving; manual mic disconnect after a completed recording still allows download until exit.
- Late `getUserMedia` permission after exiting or owner switch is rejected and tracks immediately stopped; recorder.start exceptions now leave a usable UI.
- Spectrum no longer uses sine/time-generated fake "audio" bars: a static low baseline when mic is off; actual analyser drives active bars only. Visual V4 capture statuses remain derived from real recorder flags.

### AI
- AI mode change cancels its active generation through `AbortController`, resets the disabled composer, and increments a monotonic generation intent. A→B→A mode changes cannot apply an old reply even when the current mode name returns to A.
- Existing signed-owner `request()` gains an **optional, one-request cancellation signal** that propagates to grant issuance and main AI inference. Stale catch/finally blocks do not overwrite the new request's UI or incorrectly unlock a new request.
- The AI active mode text is displayed fully in Russian, and starter shortcuts remain draft-only, without auto-send.

### Isolated verification / remaining release gates
- Added real-controller tests: `tests/vetogram-v4-voice-session.test.js` (**6/6 isolated simulated-recorder cases**), `tests/vetogram-story-save-races.test.js` (**7/7 isolated store and editor cases**), and `tests/vetogram-ai-mode-generation.test.js` (**4/4 isolated cancellation cases**). These passed by execution of freshly fetched production controllers in an isolated JS harness, not the complete repository CI suite.
- Updated `studio.html` cache keys for the four changed Story/Voice/AI runtime files to ensure correct integration in the final single release.
- Still required before production: `npm test` (full suite), `npm run vercel-build`, native Android/Fold/iOS microphone permission and recording, real IndexedDB transaction abort, AI provider budget/consent, signed Telegram two-owner switching, multi-module visual inspection, webhook/media/Story publisher E2E.

## V4.6 Story → Publisher signed handoff / Portal safety (25 October 2026)

### Audited real product flow and fault found
- Previously `story-engine.js` injected an image `File` into `#storyFileInput` with `DataTransfer`. This API is unavailable or inconsistent in some native iOS WebViews. The code then dispatched a global `veto:portal-handoff`, but `app.js` had no handler for `VetoTelegramPortalHandoff`. The Publisher UI contained an **already-checked** Portal consent even though no server `portalLink` was being sent, so Canvas Noir displayed a misleading selectable capability.
- The actual server `api/miniapp.js` already accepts `portalLink` when the request is **standard audience and Business Bot API publication**. `lib/story-portal-media-area.js` enforces same-host HTTPS /portal.html hash, 1900 characters, unexpired Portal share token; `lib/story-app-publisher.js` adds a real Telegram Story `areas` link region for the Bot API transport. Personal Telegram session publishing does **not** support an attached Portal area.

### Changes committed in actual Mini App
1. Introduced `window.VetoTelegramStageStory({file,caption,portalLink,ownerId,draftId,stillCurrent})` inside real `app.js` *before* Story Engine is loaded. The editor awaits actual image compression and a positive result before navigating to Publish. New iOS flows do not need `DataTransfer`. The legacy file input bridge remains as a fallback only for older cached `app.js`; no publish happens inside the editor.
2. Stage and compression are scoped to the *signed Telegram identity* and editor's owner, draft ID and revision callback. A changed photo, editor revision or account invalidates old transfers; old file previews/nonces/Portal permissions clear before a new image is processed.
3. Public Portal host/path/hash/length validated **before** staging any image. The link is bound to the generation of the staged photo; a manual file replacement or reset clears it.
4. The real Publisher's `storyPortalConfirm` now defaults **unchecked**, even after the user chose a link in the editor. It displays a grounded public host warning and requires the user to tick the checkbox, choose **standard** audience, have actual Telegram Business Stories permissions, and accept a further public-link confirmation. Only then does `publish_story` send `portalLink`. Other audience and transport requests can still publish an ordinary photo **without** the URL, at the user's choice.
5. A successful Story confirmation references `portalAreaAttached` from the actual server response, never assumes a link attached. If the story posted but attachment is not confirmed, explicitly tell the user to inspect the Telegram Story **without retrying**.
6. Changed the one legacy device-wide caption `sessionStorage` key to a scoped Telegram-owner key, purge the legacy unscoped key on boot, and clear visible image, Portal and caption on identity switch. A returning owner can still retrieve their own saved caption.
7. AI suggestions now include their original `signed` identity when applying to Story Engine, and the editor rejects late/unsigned suggestions even if owner ID appears to match. AI only changes approved text/Portal and still never publishes automatically.
8. Updated inaccurate Story Studio help text: on-canvas Portal CTA is decorative, while the live Telegram click area is a separate Business-only link confirmed by the server. No claims that Portal votes, submissions or payments are captured in our database.

### Verification / remaining
- `tests/vetogram-story-publisher-handoff.test.js`: **8/8** isolated JS behavior scenarios with actual `app.js` handler slices: no-DataTransfer bridge, separate Portal checkbox and request payload, Business and audience guards, photo replacement, stale compression, foreign-link rejection, signed AI editor boundary and source contracts.
- **8/8** additional static cross-module assertions passed with freshly fetched GitHub files; `app.js`, `story-engine.js`, and `vetogram-ai.js` parse correctly.
- `tests/vetogram-story-portal-publish-contract.test.js` added as Node suite for the *real* Portal encoding + server validation/media-area interface. **Not executed in the isolated tool environment**; required in the full Node suite.
- Release blockers unchanged: full local Node tests and `npm run vercel-build`, native iOS/Fold/Android import/preview, two signed Telegram accounts, live standard Business post with area verification and alternative user-session photo-only publish, AI provider budget and consent, complete Canvas Noir screenshots. No deployment, Neon migration, merge, permission change or flag flip performed here.

### V4.6 Canvas Noir follow-through
- Added a compact provenance indicator in the live Publisher **only after** a successful, owner-matched, prepared `1080×1920` editor JPEG. Copy explicitly says the frame is **not yet published**. The indicator clears on manual replacement, composer reset or account change; no fake backend work or duplicated preview.
- Reused canonical `vetogram-noir.css` (no extra cascading stylesheet) for small-screen publisher alignment, confirmed source badge and a prominent, accessible Portal opt-in checkbox. CSS and updated `app.js` / `story-engine.js` / `vetogram-ai.js` are cache-busted in `studio.html`.
- Re-ran the isolated actual-source handoff suite after the UI change: **8/8 passed**. The Portal/server codec test is committed but still requires a full Node run. Android/iOS WebView and live Telegram Business publish remain unverified.

## V4.7 Viewer / Chats / AI signed-owner integration (26 October 2026)

### Primary production fault: Viewers/Automation data surviving Telegram account change
- Real `public/app.js` had owner-safe composer media but **not** owner-safe Viewers, Viewer Analytics, Automation jobs, published Story history, Business readiness or selected Story. Signed-owner checks on requests were insufficient to hide already-rendered old-account data immediately and failed to fence stale **A → B → A** responses.
- `ensureComposerIdentity()` now increments a monotonic `viewerOwnerEpoch` and both read-intent counters, revokes pending QR work, resets Viewer session, viewers, analytics, pending login state, Automation data, Story archive/current selection, signed connection and Business permission flags, search text and in-progress composer. Only the incoming Telegram owner's per-account caption may be restored. Calls `renderViewers()`, `renderAnalytics()`, `renderHome()` and `renderConnection()` to clear visible sensitive content before another network response.
- `refreshViewerSync()` and `refreshViewerAnalytics()` now fence results and errors by signed identity, owner epoch and latest request intent. Stale concurrent requests cannot overwrite the newer result, even if the owner returns to the same token. `viewerRegisteredKey` is reset, so an old account's remembered Story registrations do not suppress the new account's registration.
- `api()`, `viewerApi()` and `automationsApi()` now fence requests with the owner epoch; stale global miniapp responses cannot merge another owner's Story archive/history. `viewerApi()` no longer evaluates `selectedViewerStory` in its default argument **before** owner validation.
- Optimistic audience and protection setting handlers only restore previous values after failures when the same signed-owner epoch still owns the UI.
- Story `publishComposerStory()` now checks owner epoch and staged JPEG generation after server response, and fences follow-up Viewer refresh, modal, errors and `finally`. An old owner's ambiguous/late publish cannot clear new account's composer or unlock their current operation. **This does not imply cancellation of a server-side Story already posted**; uncertainty still requires manually checking Telegram before retrying.
- Viewer setup text now shows "Fast Alerts работают" only when the actual `backgroundReady` flag is true; when a user session exists without background readiness, it says that cron/setup remains to be confirmed. Compact progress copy is Russian.
- Messenger's prior thread + signed-owner guards remain in place; no unnecessary refactor of the independent Telegram chat transport or AI consent/send module was attempted.

### Verification and release gates
- Added `tests/vetogram-viewer-owner-boundaries.test.js` with 7 isolated regression cases: complete old-account state wipe, A → B → A delayed Viewer request, out-of-order Analytics response, registration token reset, API/audience/protection guards, default Story ID re-evaluation and truthful background copy. **7/7 passed** against actual fetched `app.js` controller functions via an isolated JS VM harness.
- Extended `tests/vetogram-story-publisher-handoff.test.js`: a delayed old-owner publish must not reset new-account publish controls. **9/9 isolated Story bridge tests passed** in this step. Full Node `npm test`, real WebView visual/browser E2E and Telegram signed two-account sessions remain **unverified**.
- Updated `studio.html` main app cache key to `20261026-v4-7`; did not change production or backend schema.
- Release remains blocked on complete suite and build, two live Telegram accounts switching while Analytics/Story/AI requests are pending, Android Fold + iOS + Android viewport sweeps, real Business Story Portal link tests, live webhook and paid AI provider flow. PR #185 remains Draft. **No deploy/merge/Neon migration/feature-flag activation.**

## V4.8 Cross-screen modal and full-screen Studio lifecycle (26 October 2026)

### Real issues identified and fixed
- Shared `#sheet` / `#sheetBackdrop` could remain visible over another screen or Telegram account because `switchScreen()` did not close it. Central `closeSheet({restoreFocus:false})` now runs when navigating to a different screen or resetting the signed owner. It still dispatches the existing `vetogram:modal-closed` cleanup event, which Privacy uses to invalidate archive/media/backups. Same-screen auth steps retain their modal.
- Modal close previously always restored focus to the initiating element. On a screen switch or owner reset, that may be an element inside a now-hidden or unrelated account screen. Programmatic cross-screen closure now skips restoring old focus; normal user/backdrop/Escape closure preserves accessible focus restoration.
- `runViewerAuthAction()` now keeps a signed-owner epoch lease. Late errors after an owner switch do not replace a new account's auth form with the old error; `finally` cannot unset another owner's `viewerAuthBusy` state or restore controls. The account-connect CTA also checks signed session + epoch after Viewer refresh before opening profile/setup.
- The real V4 Studio fullscreen editor's Escape handler used to run after the canonical shared-sheet Escape handler, closing **both** the modal and editor with one key. Editor/menu handlers now defer to a live shared sheet or native `dialog[open]`. Leaving the editor via navigation clears scroll locking without returning focus into a now-hidden editor.
- The shared sheet is `aria-modal` but keyboard Tab could escape to underlying Chats. The real sheet controller now traps Tab and Shift+Tab among visible enabled controls, deferring to native dialogs and the in-sheet country-picker Escape flow.
- In `vetogram-noir.css`, the `bottom:0!important` layout overrode native `veto-device-polish.css` keyboard positioning. Added a more specific override only when `html.veto-keyboard-open` is set by real `visualViewport` measurements, respecting `--veto-visual-bottom`, `--veto-visible-height` and reduced-motion preferences. No fake keyboard or separate layout engine.
- Updated `studio.html` app / V4 JS / Noir CSS cache keys to `20261026-v4-8`, preserving one final deployment.

### Verification and limits
- `tests/vetogram-v4-navigation-modal.test.js`: **9/9** isolated behavior/source tests on real modal + navigator handlers: cross-screen dismissal, same-screen MFA continuity, owner-switch private sheet cancellation, stale login errors, delayed account help, canonical BackButton, Tab wrap, native dialog/country-picker Escape, real CSS visualViewport override.
- `tests/vetogram-v4-focus-modal-priority.test.js`: **5/5** isolated production editor interaction tests: modal Escape priority, sequential tools/fullscreen Escape, screen leave unlock + focus isolation, native dialog priority, source acceptance.
- Re-ran prior `tests/vetogram-viewer-owner-boundaries.test.js`: **7/7**; re-ran `tests/vetogram-story-publisher-handoff.test.js` before asset-key-only change: **9/9**. All harness tests run against connector-fetched source in the isolated JS environment, **not** a full Node test runner or browser.
- Real iOS Safari/Android Telegram WebView and Fold virtual-keyboard measurements, screen reader traversal, photo/video dialog layering, full `npm test`, full build and signed two-owner E2E **remain release blockers**. Do not mark VETOGRAM production-ready from these isolated tests.
- No deploy, merge, paid CI step, Neon schema write, AI provider credit, Telegram permission change or Unified Business flag activation.


## V4.9 Cost-safe integrated release surface gate (26 October 2026)

### Read-only audit and build wiring
- Inspected actual `package.json` scripts. The single official release command is `npm run vercel-build`: verify committed lockfile → AI preflight → syntax checks → **new offline surface audit** → all Node `tests/*.test.js`. Full `npm ci` and `vercel-build` have **not** been executed in this environment because the container cannot resolve github.com / download the complete repository; the GitHub connector can inspect/edit files but does not run Node. No GitHub Actions workflow was triggered (preserves the user's no-paid-CI / no-intermediate-deploy constraint).
- Created `scripts/vetogram-release-surface-check.mjs` with a pure exported `inspectReleaseSurface()` plus a CLI entrypoint. It reads local project files without network and rejects duplicate DOM IDs; missing JS/CSS assets; missing Canvas Noir screens; duplicate browser assets; wrong `app.js` bootstrap order; missing asset cache/version markers; missing modal semantics; prechecked public Portal consent; missing awaited Story publisher bridge; missing Viewer owner-epoch invalidation; or missing signed AI → Story handoff.
- Expanded the audit to follow literal relative ESM imports of the *26 actual first-party scripts* loaded by `studio.html`, rejecting missing imports and module syntax in classic script tags. This prevents an entrypoint from looking valid while a child module is broken. It does not claim to handle arbitrary dynamic imports, type checking or browser rendering.
- Added `tests/vetogram-release-surface-gate.test.js` with **8** explicit Node test cases (positive + mutated assets / duplicate IDs / Portal opt-in / ordering / owner handoff / missing import / classic-script module). The test is committed and belongs to `npm test`, but a full Node runner execution of that test suite is **not yet independently verified**.
- Added `qa:surface:offline` and `qa:reborn:offline` npm scripts; the latter explicitly targets **11 regression suites** from V4.3–V4.8, including Privacy owner boundaries, Voice, Story/Portal, AI, Viewers, navigation and the new surface gate. Appended both to `ci:offline` and appended surface gate to `vercel-build`; no replacement of the existing broad `npm test` glob. Added script syntax check in `npm run check`.

### Findings backed by connector-source inspection
- Actual `studio.html`: **44** local JS/CSS resources referenced, all exist in the current GitHub tree (444 paths); **615** distinct DOM IDs with no duplicates; **13** screen sections; **26** local first-party script tags. Script type / import inspection found **16** literal local module dependencies; all targets exist, and their parent scripts use `type="module"`.
- The gate's pure function was executed in an isolated JS runtime with the connector-fetched actual source and repository file index: **PASS**, no errors. Deliberate `import './definitely-not-here.js'` and `import` inside the classic `app.js` both correctly produced blocking error codes. This is not a full `node --test` or `npm run vercel-build` run.
- Independently executed the repository's pure `auditNpmLock()` on fetched manifest and lockfile: **PASS**, format v3, six pinned direct dependencies correctly represented, 172 package entries, zero root spec mismatches, missing resolutions or invalid resolution metadata. Actual download, checksums and `npm ci` remain unverified.
- Existing `.github/workflows/vetogram-ai-ci.yml` is manual-dispatch only for cost safety. Existing `vetogram-verification.yml` defines normal PR verification, but the inspected prior PR head showed **no recorded workflow runs or commit statuses**. GitHub Actions success is NOT claimed.

### Still blocking single final production release
1. In a trusted network-enabled checkout run `npm ci --ignore-scripts --no-audit --no-fund`, `npm run qa:reborn:offline`, `npm run check`, `npm test`, `npm run vercel-build`; investigate any actual errors.
2. Real two-account Telegram WebView E2E: Anti-Delete, signed chats, viewers, Story publishing (Business standard Portal vs personal user session), Voice mic permissions, cross-owner privacy, AI consent & budgets.
3. Responsive and keyboard/safe-area screenshot/interaction review on Android, iOS and Fold, plus production service readiness/configuration and any approved database migrations.
4. One controlled final merge/deploy only after the above QA; **nothing deployed, merged, billed or migrated in this phase.**


## V4.10 Canvas Noir premium visual pass (26 October 2026)

The originally chosen **first Canvas Noir** direction is retained; the current source has **not** passed native visual QA. Do not state design is finished or launch-ready on the strength of these assertions.

### Existing-code implementation (not a parallel mockup)
- Updated the single canonical `public/vetogram-noir.css` design system across authentic Chats, Privacy, Publisher, Story Studio, AI and Voice. Added deliberate spacing, 44px+ controls, mobile-only 3-primary-mode AI rail with active secondary mode visibility, scrollable Story tabs, real selected preset states, focused search, quieter cards, reduced-motion/contrast behavior, 320/359px Fold fixes and narrow landscape layout.
- Corrected the old main-app 1180px width from narrowing the immersive conversation. Chat list uses a deliberate 760px max width while an open Telegram thread is truly full-height and full-width.
- Replaced inherited theme token fallbacks with four independent themes: graphite stays near-black, slate has its own blue-grey dark palette, pearl is a clean white, linen is warm neutral. Explicit light-mode text/input styles fix older AI and Story white-on-light form fields. No color filter on the actual exported Story canvas.
- `public/vetogram-experience-v4.js` now synchronizes the secondary AI dropdown with the **real currently selected mode** and updates its accessible label. Switching back to primary chat/translation/reply closes the extra list; user manual browsing remains possible. Nothing is auto-generated, sent or published by this enhancement.
- Tightened Russian UI copy across Story Studio, Voice, AI and Home; removed duplicate headings and mislabeled secondary AI modes, preserving IDs, actual event handlers and API semantics. Updated only the preexisting asset cache keys.
- Added `tests/vetogram-v4-visual-hierarchy.test.js` (9/9 isolated source/real-mode-controller cases) and `tests/vetogram-v4-light-theme.test.js` (5/5 source/token and contrast cases); `qa:reborn:offline` now includes **13 suites**. The computed text/muted/coral colors on slate/pearl/linen backgrounds and surfaces meet **WCAG 4.5:1 at the token level**. Component overlays, canvas artwork, device display scaling and screenshot fidelity are NOT established by this calculation.

### Explicit outstanding visual acceptance
- Detailed device/state and screen acceptance matrix saved as `docs/qa/VETOGRAM_CANVAS_NOIR_V410_VISUAL_ACCEPTANCE.md`. It is marked **NOT visually approved** until actual 320/359/390/430/768/1024px + Fold landscape + iOS/Android Telegram WebView screenshots and keyboard/overflow checks are reviewed.
- Last read-only release-surface check against the current branch confirmed 44/44 CSS/JS assets, 13 screen routes, 615 distinct DOM IDs, balanced canonical CSS braces, parsable changed JS and all 13 focused Node test suite paths present. This is not a `npm test` or Playwright run. Full Node test, dependency install, device E2E, live Telegram and final one-time deployment remain blocked.
- Kept PR #185 **draft**. No merge, deployment, paid CI runner, Neon migration, AI provider credits or Telegram permission change.

### V4.10 cascade follow-up

- Found and fixed a shared CSS specificity collision: the premium global `topbar display:flex!important` and fixed `bottom-nav display:grid!important` overrode classic immersive Messenger hide rules. Added high-specificity `body.veto-chat-active .topbar{display:none!important}` and `body.veto-chat-thread .bottom-nav,#actionDock{display:none!important}` to existing `vetogram-noir.css`, preserving full-viewport chat layout.
- Extended `tests/vetogram-v4-visual-hierarchy.test.js` to **10/10 isolated** real mode-controller/source cases, including explicit shell-vs-chat specificity. Native WebView visual verification is still pending.


## V4.11 Historical Vercel CI regression follow-up (26 October 2026)

- Attempted to check out the complete branch locally for `npm ci`, `npm test` and Chromium screenshot QA; the container has Node 22 and Chromium 144 but **cannot resolve github.com**. The connected GitHub tool provides read/write access to individual files, not a local working tree, so no full current-branch build or screenshot can honestly be claimed.
- Read-only inspected the connected secondary Vercel account `labsmargaryan@gmail.com` project `veto`. The newest READY preview for this branch was built from **older** SHA `ddb22faefdcc6cbc4f9d8362700d47794db471bf`; it is **not** the current V4.10 branch and is not valid proof of present design quality. No new deployment was triggered.
- Fetched logs of older failed Vercel preview builds: the `npm run vercel-build` pipeline failed during `npm test` on brittle AI route and four-tab label assertions (`tests/vetogram-ai-command.test.js`, `tests/vetogram-creative-deck.test.js`). Those exact source conditions had already been corrected on current branch, and 7/7 current standalone path/label contracts were confirmed.
- Tightened `tests/vetogram-creative-deck.test.js` to verify **four real `data-nav` destinations in correct order** and their actual Russian accessible labels via DOM markup supporting `data-ui-text`, instead of depending on a specific legacy text node. Tightened `tests/vetogram-ai-command.test.js` to check the actual `SCREEN_ALIASES` and `NAV_PARENT` maps for the AI route, rather than unrelated whitespace variants. These preserve important functionality checks; tests do not simply skip the assertions.
- **Evidence:** seven signed navigation + route predicates passed against fetched latest `studio.html` and `app.js`; new four-tab regex was parsed and matched actual HTML. These were connector-based isolated checks, **not a Node `node --test` execution**. The complete Node test suite, current preview build, Telegram owner E2E, and actual latest design screenshots remain release blockers.
- **No deploy, merge, migration, Vercel build dispatch or paid CI** performed.

## Independent release audit, 2026-10-26 (NO PRODUCTION DEPLOY)

- Last **verified full Vercel build** was preview commit `ddb22fa`: 736 tests discovered, 735 passed, 0 failed, 1 skipped. This is not a verification of the current PR head. Local container can execute Node/Chromium but cannot resolve external repository hosts, so no full clean checkout/build or pixel screenshot of the current head has been completed.
- Read-only Vercel project environment metadata on second Vercel account: `VETO_STORAGE_PROVIDER=neon` in Production and Preview; Telegram and Neon private credentials are targeted to Production only. Preview cannot prove real Telegram/Neon end-to-end behavior. Do not copy production credentials wholesale into Preview.
- AI table presence verified directly in Neon: usage, memory, grants, agent control/events, task cloud, reminders = 7/7 tables present. However `VETOGRAM_AI_ENABLED` and `VETOGRAM_GEMINI_API_KEY` / `VETOGRAM_OPENAI_API_KEY` are absent from Vercel environment configuration. Real AI inference is **not available until a deliberately budgeted provider is connected**. Never promise all functions work with the current configuration.
- Current Canvas Noir color tokens for pearl, linen, slate passed 18/18 sampled foreground/background pairs with WCAG AA ratio >=4.5:1; not screenshot acceptance. Localization audit found only 26 UI-marked entries in 13 screens. Nine main heading instances now use RU/EN/HY translation, and their isolated 2/2 core/source regressions passed. Full RU/EN/HY localization is still incomplete.
- Do not treat existing Vercel preview or source tests as proof of working Telegram permissions, real Story publishing, Voice mic capture, AI generation or Fold/Android/iOS layout.

## V4.11 RU/EN/HY screen-shell and AI disclosure continuation — 2026-10-26

**Work completed in the actual Mini App, not a mock page:**
- Added 45 RU/EN/HY labels for static section headings and marked all 48 h2/h3 instances across Chat, Privacy, Analytics, AI, Story Engine and Studio. Intentionally excluded 10 state-controlled headings (`vg27MissionTitle`, `activationTitle`, `viewerSyncTitle`, `timelineTitle`, `privacyBusinessOnboardingTitle`, `smartBriefTitle`, `vg26CreativeTitle`, `sePreviewTitle`, `relayPowerState`, `vg26CommandTitle`) to avoid overwriting real runtime states.
- Localized 22 functional controls: 8 chat filters, 4 Privacy/Archive filters, 8 VETO AI modes, 2 Sticker categories. Maintained existing `data-mirror-filter`, `data-privacy-filter`, `data-vtai-mode`, `data-sticker-tab` action contracts.
- Localized bottom navigation screen-reader labels for Chats, Stories and Privacy and fixed the collapsed Canvas Noir secondary AI-mode disclosure to re-render its selected mode / aria label on `vetogram:locale-changed` events, not merely when `aria-pressed` changes. Selection and manual expansion behavior are preserved.
- Expanded `tests/vetogram-noir-locale.test.js` for full marked-key coverage, live-state exclusions, language switching without touching unmarked user content, tab bindings, and accessible navigation. Updated the affected exact-heading assertion in `tests/vetogram-v4-light-theme.test.js` and added an EN/HY AI-disclosure behavior test to `tests/vetogram-v4-visual-hierarchy.test.js`.

**Connector-backed isolated execution, NOT the full Node runner:** locale 6/6 tests passed, Canvas Noir visual hierarchy 11/11 tests passed, and light theme 5/5 tests passed (**22/22 isolated focused tests**). Current shipping HTML: 13 screens, 615 unique DOM IDs with no duplicates, 44 linked local JS/CSS files all found, 108 `data-ui-text` / `data-ui-label` / `data-ui-placeholder` bindings using 102 distinct known dictionary keys. The Canvas Noir controller parsed without a syntax error.

**Release is still blocked:** Most supporting copy, dynamic runtime status strings, sheets and notifications are Russian; **complete RU/EN/HY localization is not done**. The current PR head has not passed a real clean `npm ci && npm run vercel-build`, there are no current-commit Android/iPhone/Fold WebView screenshots, real consented Telegram E2E is pending, and live AI inference requires an enabled provider key and budget. Never claim all features or visual QA are complete; do not promote to Production yet.

## V4.11 non-GitHub-Actions source QA continuation — 2026-10-26

### What changed in existing PR #185

- Fixed the **Story publication safety test**, which still expected obsolete `/app.js?v=20261025-reborn-1` and `/privacy.js?v=20261025-noir-3` query strings. The test now checks exactly one current versioned local script for each asset. Updated fixture wiring for `ensureComposerIdentity`, `viewerOwnerEpoch` and `composerGeneration` so regressions actually execute the current owner/generation guards.
- Corrected two **owner-scope test expectations**: the live AI generation guard checks both signed account and request-intent epoch; older tests required a weaker owner-only comparison. Retained owner and intent assertions.
- Business wizard tests now validate actual signed owner leases and `assertOwner(lease)` after the request, instead of a removed inline check; AI presentation assertion accounts for `data-ui-text="askVetoAI"`.
- The genuine Story success sheet no longer claims viewer events will be captured automatically solely because the viewer session is connected. It truthfully says that only confirmed view information can appear after data refresh. Added a regression assertion.

### Verification performed without GitHub Actions

`functions.exec` loaded current GitHub source into an isolated V8 execution harness; no node_modules installation or external network, Telegram, AI or database writes were performed during these **source-level** tests:

| Suite | Isolated checks passing |
| --- | ---: |
| Story publisher and non-idempotent POST safety | 13/13 |
| Real Anti-Delete persisted-proof and Archive diagnostics | 5/5 |
| OTP resume, duplicate suppression and Neon v6 guard (mocked) | 13/13 |
| Owner-bound A→B→A / AI async and Task Cloud boundaries | 12/12 |
| Business wizard consent and AI UI source contracts | 5/5 |
| Country picker, onboarding and navigation (+7/GE/AM) | 7/7 |
| Canvas Noir visual hierarchy, Fold CSS and disclosure controls | 11/11 |
| RU/EN/HY locale switching and safe user content | 6/6 |
| Light-theme tokens and Story canvas isolation | 5/5 |
| **Total** | **77/77** |

**These 77 checks are NOT equivalent to a full `node --test`, `npm ci`, production deployment build, screenshot-based responsive browser QA, real Telegram MTProto delivery, live Anti-Delete permission/event, Story publishing, microphone or AI provider call.** All dependencies remain necessary to authorize the single final deployment.

### Outstanding blockers / no deployment authorization

1. Full clean checkout of current branch followed by `npm ci --no-audit --no-fund` and `npm run vercel-build`; GitHub Actions still fails before assigning a runner and local sandbox DNS cannot fetch the repo. The known Vercel READY preview built older SHA `ddb22fa`, not this head.
2. Real signed Telegram accounts on mobile: OTP delivery, QR, owner swap, session recovery, consented Business rights, an actual deleted message archived and a published Story with confirmed Telegram ID. Avoid testing these against unrelated users.
3. Current-branch Android / iPhone / Fold screenshot acceptance for 13 screens / 4 themes, including safe area and keyboard, long strings, accessibility.
4. AI remains disabled until an explicit provider key, budget, quotas and provider call are available; API + storage tables alone do not make inference live. Broader UX copy and dynamic states in EN/HY still need localization.
5. Neon v6 additive OTP lease table already applied/verified. Do not repeat migration 006.

**Status: DRAFT / NOT READY TO DEPLOY AS A FULLY TESTED RELEASE.** No Vercel production deployment or PR merge was made in this continuation.

## V4.11 AI provider-readiness UX — 2026-10-26

- **No-cost visibility for a missing AI provider.** `GET /api/vetogram-ai` now verifies the signed Mini App owner and returns only `configured` and the machine-readable `state` (`disabled`, `provider_missing` or `configured`). No prompt, chat content, private key, Telegram ID, budget reservation or model request is made by this read-only route. Private, no-store cache headers still apply.
- Real `public/vetogram-ai.js` checks readiness only on owner-authorized AI screen entry; limits repeated checks to one per 60 seconds, uses an 8-second abort, and rejects stale results after owner switch or request intent invalidation. If explicitly disabled, the generate button is disabled with a clear explanation; other local drafts and tools remain available.
- Readiness means **environment configured, not live model verified**. Generated text still requires affirmative `x-vetogram-ai-consent` and quota checks on POST. An unavailable status check does not fabricate a model response. A language change re-renders cached RU/EN/HY availability text without a second API request.
- New `tests/vetogram-ai-provider-readiness.test.js` covers six security/readiness cases plus cached language switching: **7/7 pass in isolated V8 execution of actual API/client code with fake network**. Voice Studio recording 6/6, mobile gesture boundaries 5/5 and Canvas Noir Voice/Privacy Vault 4/4 also passed in their isolated harnesses (**22/22 newly executed focused tests**, not full npm run).
- Production Vercel still lacks an enabled AI provider configuration according to the prior environment audit. **Real inference is disabled**, and user has not authorized a provider key or spend. Do not say VETO AI or every function is live. Do not deploy on this basis alone.
- The full clean current-head `npm ci && npm run vercel-build`, device screenshot acceptance, and consented Telegram E2E are still outstanding. Container has Node 22/npm 10 but direct GitHub git/HTTPS is DNS-blocked; no local repo checkout/build succeeded. GitHub Actions remains bypassed; no Vercel production deployment or PR merge occurred.

## V4.11 AI mode UX, dynamic module graph and modal QA — 2026-10-26

**Applied to existing draft PR #185 only; no production deploy, merge, extra paid infrastructure or AI inference.**

- Fixed the actual `public/vetogram-ai.js` `setMode` chrome: each of eight AI modes now has translated RU/EN/HY input placeholder and appropriate generate/action label (14 new dictionary keys). `vetogram:locale-changed` repaints the same selected mode without clearing owner-bound drafts, approvals, consent, generated history, action/Negotiator policy or request intent. Added real `setMode` regression for all eight modes in all three languages (**7/7 locale suite including new case**, isolated JS execution).
- Extended the static offline release gate to inspect **literal dynamic `import('./file.js')`** in both classic and ESM entry points, including transitive imports, rejecting relative paths outside `public/` and stripping version suffixes before file existence checks. Added four failure-injection tests; **14/14 release-surface gate cases** passed in a connector-fed, isolated V8 test harness using actual entrypoint sources with stubs for unused dependencies. This is not the complete local filesystem gate.
- Verified all **26 shipping JS entrypoints** for classic JS syntax (and ESM syntax after stripping declarations) plus direct relative dependency existence; all 16 first-level ESM dependencies were fetched and checked for further links and source syntax. Portal preview/share both resolve to real `story-engine-core.js`. No missing relative source modules were detected at the inspected levels. **Not an npm/Vercel bundler run or browser screenshot.**
- Verified the current shared navigation, modal and account-switch controller with nine isolated tests: **9/9** passed. The shared dialog closes on owner change, late auth errors do not reopen old owner dialogs, and Escape/keyboard focus precedence remains guarded.
- Verified `GET /api/vetogram-ai` routes through the single Vercel Hobby function without method override and retains signed owner gating, no prompt submission, no quota reservation, no provider call and 3-language cached readiness repaint: **8/8** isolated tests passed. Readiness is configuration-only, not successful real inference.

**Remaining release blockers remain unchanged:** no full clean `npm ci && npm run vercel-build` for this PR head because local clone cannot resolve github.com and GitHub Actions runners have not allocated; live Telegram OTP/Business/Anti-Delete/Story/Voice consented E2E and Android/iPhone/Fold screenshots remain outstanding; AI provider and budget not configured; comprehensive dynamic RU/EN/HY translation of all supporting copy is not complete. Neon schema v6 was applied previously and must not be repeated.

**Release authorization: NOT YET.** A source-level green test result must not be marketed as all functions or visuals live.

## V4.11 WebView cache identity and Relay offline isolation — 2026-10-26

- Reviewed all 44 local JS/CSS URLs referenced by the shipping `studio.html`. Previous versions spanned many release dates even when scripts had changed. All 44 are now assigned the **same version fingerprint** `20261026-v411-reborn-release`. This ensures a coordinated cache identity when a final deployment is approved.
- Updated the offline release gate to reject *any* missing or mixed `?v=` fingerprints with `MIXED_RELEASE_ASSET_VERSIONS`. Eliminated a hardcoded boot-order test that referenced old app/story versions. **16/16 injected-failure and release-surface tests passed** using live branch source with an isolated V8/virtual filesystem harness; this does not constitute a clean `npm run vercel-build`.
- Verified the only currently registered origin-wide service worker comes from `public/relay-bootstrap.js` at `/relay-sw.js`. Its `fetch` listener handles **only four VETO Relay shell paths**, not `/studio.html`, `/app.js`, or `/api/*`. Consequently, although its prior `ignoreSearch:true` was a real stale-asset defect **for Relay**, it was **not** the cause of stale main VETOGRAM screens. The root Mini App's coherent query-string identity is handled separately as above.
- Replaced old Relay cache-first, query-ignoring behaviour with **network-first, cache:'no-store'** and offline fallback only to the exact matching versioned URL. Aligned `relay.html` CSS/JS versions to `20261026-v411-relay` and bumped its shell cache name. Old Relay caches are cleaned by prefix only; unrelated origin Cache Storage is never deleted. The service-worker registration now specifies `updateViaCache:'none'`. Cache Storage errors never prevent an online Relay network fetch; offline errors degrade to an explicit network failure rather than stale code.
- Added actual Relay service-worker behaviour tests in `tests/vetogram-relay-cache-isolation.test.js`: main chat/API isolation, online freshness, offline exact-version fallback, scoped cleanup, precache alignment, registration, Cache Storage-disabled online path and safe offline degradation. **8/8 isolated tests passed.** A real Chrome/Android/iPhone offline WebView test remains outstanding.
- No new Vercel deployment, PR merge, AI spend, Telegram account activity, or database migration performed. **Not yet authorised to deploy**: full current-head npm tests and build, real Telegram functional checks, device visual approval and AI provider enablement remain open.

## V4.11 Relay degraded-browser resilience and release QA — 2026-10-26

**Code changes in the same existing draft PR:**
- The emergency `public/relay-sw.js` now handles browsers where the global Cache Storage API is **entirely absent** (not merely `caches.open()` rejecting): install and activation still settle safely, online Relay HTML and assets use network-first fetch, and offline failures return a network error without serving stale versions. No VETOGRAM chat, authorization, history or API response is cached by Relay SW.
- Added three missing-global regression cases to `tests/vetogram-relay-cache-isolation.test.js`. All **11/11** isolated current-source Relay SW tests passed, including no-cache online/offline and service-worker lifecycle. This is **not** browser service worker E2E.
- `tests/relay-bootstrap.test.js` used to require the removed `veto-relay-shell-v1` and API interception; updated to assert the v4.11 cache identity, narrowly scoped `RELAY_PATHS`, exact-version lookups, and safe operation when `caches` is absent. Confirmed the actual three legacy Relay source contract suites pass **18/18** in an isolated JS harness (one stale test was failing before repair).
- Parsed the 23 changed non-test JavaScript and MJS files using isolated V8 syntax checks: 22 standard syntax checks passed after ESM declaration normalization; the Neon preflight uses valid top-level `await` and passed an async-module-equivalent wrapper check. These checks do not resolve dependencies, load npm modules or substitute for a real Node `--test` or `npm run vercel-build`.

**No final deployment authorization:** The current complete repository checkout + `npm ci && npm run vercel-build` remains unavailable to this runner (DNS for github.com and registry.npmjs.org does not resolve), GitHub Actions jobs still terminate with runner_id=0 and no steps, and the last confirmed successful Vercel preview is older than the draft PR head. Current-branch real Telegram test accounts, permissioned Business/Anti-Delete/Story publish/Voice capture, mobile WebView screenshots, and a deliberately enabled low-budget AI provider still require separate acceptance. Do not deploy or merge this draft as if all live functions were proven.

### 2026-10-26 Relay HTTP cache follow-up

- Fixed `vercel.json` for `/relay.html`: `Cache-Control: no-store, max-age=0` instead of a 300-second plus stale-while-revalidate HTTP cache. The isolated versioned Service Worker still explicitly caches the four public Relay shell assets for offline fallback, never Telegram chats, API responses, or private messages.
- Added a dedicated HTTP-cache contract regression to `tests/vetogram-relay-cache-isolation.test.js`; all **12/12 current-source SW tests** passed in an isolated V8 environment. Three legacy Relay source suites also passed **18/18** after updating the obsolete `v1` cache assertions. The 23 changed non-test JS/MJS sources passed limited syntax checks (including valid top-level await handling) but these checks **are not** the full Node build or a browser/WebView E2E.
- No deployment, merge, AI-provider purchase, Telegram permission action, or database write occurred in this continuation. Still waiting on real production-readiness gates before advising deployment.


### 2026-10-27 V5.1 Messenger Reliability — source-backed recovery (continued)

This update addresses the user's actual Android Telegram WebView observations (blank/slow chats, avatars missing, photo retrieval failures, native header overlay and Story template text stacking). It modifies **the existing app**, not a parallel demonstration.

- **DOM:** fixed invalid Home `insertBefore` parent usage in `vetogram-experience-v4.js`; that specific call previously could raise `NotFoundError` and abort UI initialization.
- **Avatar performance:** removed the lifetime cap of six avatars. Viewport-driven queue batches up to six owner-visible avatar IDs into one authenticated `avatar_batch` request; the server validates signed Mini App ownership, checks available dialogs using the authorized MTProto session, and never accepts untrusted peer access hashes. It converts oversized/non-JPEG profile photos into <=192px, <=180KiB JPEG previews. Browser cache remains in RAM-only blob URLs; old-account URLs are revoked on owner switch. Batches are serialized, limited to six IDs, with 90-second cooldown after individual failures.
- **Message images:** max incoming Telegram photo download 16MiB with smaller <=4MiB JPEG API previews; an accessible retained image is used where available, but a stalled/failed archive fetch can now fall back to owner-verified live Telegram for a still-existing current message. Confirmed deleted or preserved-only evidence **cannot** fall back, nor can stale owners/threads or 401/403 archive responses. Non-deleted archived-photo queries time out after 2.8s; retained-only archive evidence retains the longer 14s budget.
- **Thread race:** in-flight photo downloads are no longer rejected when an unrelated inbox list generation increments. Changed owner/thread still fail closed. Warm owner-scoped RAM history now covers six conversations for five minutes, cleared on account switch.
- **Truthful UX:** disconnected first-load/retry history shows "Не удалось загрузить историю" and a refresh instruction instead of a false "Пустой чат"; initial request shows a loading state rather than a frozen prior inbox preview. Kept the in-thread refresh control and four-tab navigation. Scoped native Telegram header clearance to Telegram WebViews; stopped duplicate Story template titles overlapping the painted preview canvas.
- **Tests:** added `tests/vetogram-chat-reliability-51.test.js`, `tests/vetogram-chat-media-preview-51.test.js`, `tests/vetogram-chat-avatar-batch-51.test.js`, `tests/vetogram-chat-photo-fallback-51.test.js` to the focus/offline QA command. Actual-source V8 simulations (not full Node) confirmed 14 avatars across four serialized batches, authenticated server fetch only returning owner-visible avatar IDs, invalid batch IDs returning 400, and seven photo fallback authorization/availability branches. Client and media server syntax parsed using limited V8 checks; these DO NOT constitute full suite pass.
- **Actions evidence:** multiple consecutive runs, including #40504949799, report `failure` after roughly two seconds with `runner_id=0` and `steps=[]`. This is a runner execution/availability blocker, not evidence that tests ran and failed. Missing workflow log blobs prevent definitive billing/runner root-cause identification; verify Actions account billing and runner assignment before re-running paid workflows.

**Still not verified:** signed real Telegram account tests (including two-account switching), first-message timing, WebView Chrome/Android/iOS/Fold visual QA, large user photos and file playback, publication/AI/Business consent, full `npm ci && npm run vercel-build`, production rollback path. Keep PR #185 in Draft. No production deployment, merge, Neon write, permission change or paid provider was performed in this stage.


### 2026-10-27 V5.1 Photo & Chat Recovery — continuation

- On failed initial thread history, a **real, tappable, accessible** "↻ Повторить загрузку" control now invokes the existing signed owner-scoped `loadMessages({reset:true})`, rather than leaving an inert error/blank screen. No message send, owner/session mutation, or new permission is triggered.
- Inline photos now have a **single** delayed retry (4.5 s) for transient failures. Response error statuses are preserved by `photoRequest` to distinguish service outages from 400/401/403/404/409 and Telegram 429 flood throttling, which never retry automatically. Queues remain 2 concurrent previews; auto retry is viewport-only, with one attempt maximum. The owner/thread/epoch are all revalidated before retry; old timers and counters are cleared with owner-scoped media cleanup. A deliberate user tap still permits retry.
- Added `tests/vetogram-photo-retry-51.test.js` to the focused offline QA script, covering one-shot 503 recovery, no retry on 429 or authorization failure, owner/thread/epoch race protections, cleanup, and mobile retry control. CSS uses a minimum 46px tap target with keyboard focus treatment.
- Versioned **all 44** HTML-linked CSS/JS assets under a single `20261027-v51-photo-recovery` identity, to avoid carrying old WebView layout/script caches into this draft preview.
- Independent actual-source V8 harness: **503 → two attempts / preview visible**, **429 → one attempt / no retry**, **401 → one attempt / no retry**. Tested snippets and parsed all five added test sources after ESM import normalization. These are **not** full Node test results or real live Telegram performance measurements.
- GitHub Actions remains unverified: the last pre-existing run examined had `runner_id=0` and `steps=[]`; investigate runner provision/billing. Keep draft PR #185 unmerged and un-deployed until `npm ci && npm run vercel-build`, live signed two-account test, media accessibility, and mobile visual acceptance succeed.


### 2026-10-27 V5.1 crash recovery — sticker drawer

**Confirmed critical source defect:** `public/telegram-chats.js` implemented
`closeStickerDrawer(){ state.stickerEpoch++; closeStickerDrawer(); }`. This synchronous
unbounded recursion could abort the JavaScript call stack when closing the drawer,
switching an owner's account, or completing rich-message sends.

**Fix:** close the existing drawer by setting `hidden=true`, clear its local search
query, and increment the sticker epoch once to invalidate stale asynchronous
thumbnail requests. No Telegram messages are read/sent, no credentials stored,
and no new permissions are granted. Existing open/toggle behavior is preserved.

**Tests:** new `tests/vetogram-sticker-drawer-51.test.js` runs the actual
controller in an isolated VM to assert non-recursion, consistent visibility,
query reset, safe operation when DOM nodes are missing, and epoch invalidation.
Included in `qa:reborn:offline`. Independently ran the actual code excerpt
twice: epoch 7→8→9, the panel remained hidden, and a detached panel was safe.
This is not a browser E2E test or full Node test-suite pass.

Updated all 44 `studio.html` versioned asset references to one shared
`20261027-v51-sticker-stability` cache identity. **PR #185 remains Draft; do not
deploy or merge while GitHub Actions cannot allocate a runner and production
acceptance has not been completed.**


### 2026-10-27 V5.1 messaging race / inbox outage continuation

This stage repairs additional errors in the **existing** Mini App, without a deploy or Telegram message action.

- **Cross-chat text sending:** a failed/uncertain send is restored as a draft for its ORIGINAL dialog even after the user navigates to a different chat. The other dialog's current compose field stays intact. One nonce is bound to an identical text **and replyTo message ID** and scoped by chat; a different reply target generates a different nonce. An ACK received after switching to another chat must not delete a newer draft of the original chat. Pending reply selections changed during network latency are preserved. The map of uncertain send intents is cleared on Telegram owner change.
- **Verified inbox availability:** English WebView transport errors (`Failed to fetch`, `NetworkError`, `Load failed`), offline state, 429 and server 5xx no longer automatically erase the same-owner verified inbox or masquerade as session revocation. Even a previously verified account with zero chats keeps its verified state through a temporary refresh outage. Pagination cursor is not reset on transient page-load failure. **401/403/409 remain fail closed**, and unknown credentials are never promoted to verified.
- **Tests:** new real-controller VM regression files `tests/vetogram-cross-chat-send-51.test.js` and `tests/vetogram-inbox-outage-51.test.js`, both included in `qa:reborn:offline`. Independent V8 scenarios confirmed a failed send in A restores A while B remains untouched, and a deliberate same-reply retry reuses the same nonce. Five actual-source inbox cases (verified transport failure, verified empty-inbox outage, pagination 503, unknown proof, 401 invalid login) produced expected states.
- **Cache identity:** all 44 linked Mini App assets in `studio.html` now share `20261027-v51-message-recovery`. All changes remain in draft PR #185. No merge, production publish, credential use, Telegram messages, or database writes in this stage.

Still pending: actual Node `npm ci && npm run vercel-build`, real signed two-account Telegram phone E2E, representative large photos, send-ack loss and reconnect tests, and successful Actions runner allocation. Standalone controller harnesses are not a replacement for full CI or a real deployment acceptance.


### 2026-10-27 V5.1 Rich Send Integrity — continuation

All changes are on the existing draft PR #185 in `margaryanlabs/Telegram-story-bot`; no production deployment, Telegram send, API-key mutation, or DB write.

**Fixed source-level races**
- Rich-media send acknowledgement does not delete new text typed during the Telegram/network round trip. It preserves a reply target chosen after sending and any new unsent attachment. Sending a sticker leaves the existing text composer draft intact.
- A RAM-only `draftVersions` map tracks actual user text edits. On a late media ACK after navigating A→B, only the **unchanged submitted caption** for A is cleared; a newer or even identical retyped draft remains intact. Owner switch clears this map.
- An uncertain rich-media/sticker acknowledgement is stored in RAM under `lastRichFailures[chatId]` with the original nonce and full intent. A user-initiated retry of the **exact same intent** reuses the nonce even when the failed request finished after changing chats. A changed sticker or recipient gets a fresh nonce. No automatic retry is issued.
- On reopening a chat with an uncertain text send, the original `replyTo` message ID is restored only if the signed owner's dialog and the unchanged text draft still match. A visible warning reminds the owner to check the native Telegram chat before manually retrying; fresh drafts or other dialogs cannot inherit that reply context.
- All 44 versioned CSS/JS references in `public/studio.html` now use `20261027-v51-send-integrity` to avoid mixed WebView resources on a future build.

**Independent evidence**
- Added `tests/vetogram-rich-send-draft-51.test.js` (8 cases) and `tests/vetogram-rich-send-idempotency-51.test.js` (4 cases) to `qa:reborn:offline`. Expanded `tests/vetogram-cross-chat-send-51.test.js` by two additional reply-recovery checks.
- Parsed the shipping `public/telegram-chats.js` and these three test files in a standalone V8 syntax check (after import normalization). Actual-controller V8 cases confirmed draft preservation, per-chat sticker nonce reuse after lost ACK, and reply context restoration (same text → reply 42; changed draft or different chat → no reply).
- These are **not** a passing full `npm ci`, Node test suite, real Telegram send, or Telegram WebView E2E. No evidence of actual message delivery/read receipts should be inferred from a local simulation.

**Release blockers:** GitHub Actions runners have repeatedly failed before any step executes (`runner_id=0`, `steps=[]`). Diagnose Actions runner access/billing or validate a trusted checkout through another execution environment. Finish signed Telegram two-account tests, large media and chat-switch tests, full build and mobile visual verification before merge or deployment. Keep PR Draft until then.


### 2026-10-27 VETOGRAM 5.1 — Uncertain media on chat reopen

The existing draft PR #185 adds owner-scoped **manual-only** media recovery on returning to a Telegram chat.

- Uncertain file/photo sends previously retained the random-id intent in RAM, but navigation cleared the visible `pendingAttachment`. It was therefore difficult or impossible to perform an **exact** deliberate retry, especially with the original attachment kind or reply target. On an owner-verified chat reopen, `restoreUncertainRichMedia(chat)` now reattaches the original in-memory File **only** when the signed user and chat match, the original caption is unchanged, the File is within the existing 2 MiB limit, and the item is not voice media. The original reply target is also restored only when appropriate. There is **no automatic Telegram send**.
- `richSendIntent` now includes `kind` and `duration` in equality checks, preventing accidentally reusing a nonce for a different kind or duration. `lastRichFailures` retains at most **4** owner-scoped intents in RAM and is cleared on owner switch; no file is written to persistent browser storage.
- Confirmed real code defect: the attachment chip used `pendingAttachment.name/size`, although the state stores `{file,kind}`. It now correctly resolves `pendingAttachment.file` and displays the real file name and size instead of `undefined / NaN КБ`.
- On reopening, the app shows a clear warning that the earlier media/sticker might already have arrived, and asks the user to verify in the native Telegram app **before** tapping Send again. Voice is intentionally excluded from reconstruction as a generic document.
- Added `tests/vetogram-rich-reopen-51.test.js` to focused offline QA (8 unit cases) and updated 44 WebView asset references to `20261027-v51-rich-recovery`. Independent current-source V8 checks confirmed same-owner unchanged-caption recovery and stable `sameRichIntent`, rejects on changed text, owner mismatch, voice or oversize file, plus accurate 2 KiB attachment chip display. Parsed the current client and three related test sources.
- No live Telegram session, upload, send, user data or deployment was used. Full `npm ci && npm run vercel-build`, GitHub Actions allocation, two-account WebView QA and real replay/duplicate checks **remain required** before merge or production publish.


### 2026-10-27 VETOGRAM 5.1 — Cross-chat send isolation and safe nonce preflight

Changes are in the existing **draft PR #185**; no Telegram send, provider/billing write, deploy, merge or external data mutation.

- One active signed MTProto send remains serialized across the owner WebView. Previously, after starting a send in chat A and opening chat B, B's disabled send control misleadingly showed the same spinner used for A; this looked like a broken chat. A `sendInFlightChatId` now explicitly identifies A. B's composer remains **editable**, preserves its draft, and shows a Russian explanation that a send in another chat is pending; no fake B-specific spinner. Button/tool availability is restored when the owner-scoped send completes. The account-switch reset clears this ID.
- Removed premature `lastSendFailures.delete(chatId)` and `lastRichFailures.delete(chatId)` operations at request **start**. If an existing uncertain send's deliberate retry cannot even read the local File, the **original nonce survives** and still belongs to the original chat. Success remains the authorization to discard the prior uncertain nonce. A different payload still gets a new nonce through exact intent comparison; owner reset clears all pending state.
- Added `tests/vetogram-cross-chat-send-lock-51.test.js` to `qa:reborn:offline`, checking cross-chat control states, owner reset and media nonce preservation after failed local file reading.
- Current-source isolated V8 checks: chat B was editable with its own draft while A's send remained pending; B's send button was disabled without a misleading spinner and became enabled on completion. Simulated media preflight failure retained an earlier uncertain nonce and correctly reset the in-flight state.
- Versioned all 44 `studio.html` public assets to `20261027-v51-cross-chat-safety` for the next preview build.

**Build evidence limit:** This container's `git ls-remote` still fails with `Could not resolve host: github.com`; `node` and `npm` exist but the full checkout/dependencies are not available, so full Node test execution is **not claimed**. GitHub Actions previously returned failure with `runner_id=0`, `steps=[]`. Production stays unchanged. A real Telegram two-account test, end-to-end send and replay protection, `npm ci` and `npm run vercel-build` remain release gates.
