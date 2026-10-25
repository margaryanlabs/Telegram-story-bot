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
