# VETOGRAM onboarding → Anti-Delete → Stories: release acceptance gate

Date: 24 October 2026. This is a draft-branch engineering audit and test plan, **not** a claim of live Telegram verification.

## What changed in the unified branch

1. `getBusinessConnection` verification checks exact stored connection ID, Telegram owner `user.id`, valid private-chat ID and enabled status. Telegram `user_chat_id` is **not** required to equal `user.id`: these are distinct Bot API fields. A foreign account or mismatched connection remains rejected.
2. Server now explicitly reports `storiesPermission` as granted/not-granted/unknown, and `messageEventsProven:false` even when the connection is valid. A valid connection/permission response cannot prove delivery of new, edited or deleted business messages.
3. Business wizard result UI distinguishes MTProto permission writes, Bot API verification and unverified Anti-Delete event processing. It does not report successful archive delivery on permission alone.
4. `postStory` may only be represented as published if Telegram returns a positive safe-integer Story ID. For HTTP success without a usable ID, report an **uncertain** outcome; tell the owner to inspect Telegram Stories before retrying, to avoid duplicates. Network failures are similarly ambiguous.
5. The story publisher's live Business-permission check no longer promotes **cached** rights after a transient Bot API outage. It preserves stored state for recovery but returns `live:false` and `rights:false` for the current publish attempt.

These changes are intentionally **fail closed**, and neither request/enable new Telegram rights nor publish Stories automatically.

## Free, dependency-light checks

Use `npm run qa:core:offline` on a local Node.js 22+ checkout. It runs only built-in `node:test` and requires no Vercel/GitHub Actions runner or external AI provider.

- `tests/vetogram-business-readiness.test.js`: 4 independent checks
- `tests/vetogram-story-publish-result.test.js`: 2 independent checks
- `tests/vetogram-miniapp-readiness.test.js`: 3 controller-level checks

**Evidence from editor sandbox**: all **9/9** test callbacks passed against the current source using an isolated V8 runner and mocked requests. These are not real Telegram calls and are not substitutes for a full native test/build pass.

## Real Telegram acceptance checklist — do this only with consenting test accounts

1. Launch signed Mini App as account A. Connect via QR or phone/code/2FA; verify owner A matches encrypted MTProto session. Check reconnect and disconnect.
2. With separate explicit consent, use the Business wizard to choose a few selected private chats (or the explicit all-private mode). Check Telegram's own connected bot state and that no unrelated Business bot is replaced.
3. Have consenting account B send, edit and delete a new test text message in an allowed chat. Confirm actual archive, edit history, deleted-message recovery and notification after reopening the Mini App. Repeat after webhook reconnect and when app is closed. Never infer this result from a green connection status.
4. Grant `manageStories` explicitly, using an eligible Telegram test account. From Story Engine, select a harmless JPEG, review the recipient audience, then attempt one publish. Verify the returned Story ID against Telegram's own Story list. Confirm privacy / excluded users and honest handling of Premium or flood errors.
5. Simulate stale connection IDs, disabled Business bot, API outages and unknown Story ID: no unverified Story publish is marked successful; no automatic duplicate retry. Ensure cached connection is retained for a later fresh verification.
6. Repeat owner switch A→B during asynchronous requests and explicit confirmation dialogs; no A private data or drafts appear under B.
7. Confirm test records, consent, archive deletion and privacy notices before enabling a public launch.

## Remaining release gates

- Integrate the previously drafted hotfix/onboarding/story branches in the correct order. Existing header and personal Telegram API fixes have been compared to the latest feature branch; **not yet merged to main**.
- The complete npm dependency lockfile remains outdated; regenerate from the official registry on a trusted network-enabled checkout, then execute the complete offline unit suite and build. No fake integrity hashes.
- Confirm the intended second Vercel project's authorized connection, active data provider (Neon vs Supabase), migrations, Bot API webhook, and stored encryption keys **without exposing credentials**.
- Validate on Android and iOS Telegram WebViews. Public monetization, referrals and AI background workers remain out of scope for this preflight and should remain disabled until reviewed.

No production deployment, database migration, Telegram credential change or new paid service was performed in this step.

## Follow-up: owner ID versus bot private-chat ID

Telegram Bot API `BusinessConnection.user.id` identifies the account that owns a connection; `BusinessConnection.user_chat_id` is the separate private-chat destination for bot messages. They may differ. Previously the Anti-Delete message archive, deletion lookup, and Business connection persistence keyed storage by `user_chat_id`, while Mini App archive reads and session ownership use signed `user.id`. That could make an archive inaccessible to its true owner whenever the two IDs were different.

The **draft implementation now**:
- indexes new/edit/delete archived records and server connection state by the owner's `connection.user.id`;
- uses `connection.user_chat_id` only where the bot sends its progress, edit and delete notifications or manages its menu button;
- rejects archive new/edit/delete events when the referenced Business connection ID does not match the freshly fetched connection; absent/unverified owner identity never writes archived content;
- checks `message.from.id` against the connected account owner before publishing photo Stories sent to the bot;
- validates the actual connection ID, owner and current Story permission in the Mini App `refreshConnection`; mismatches retain cached data for a later review but authorize **no** publish.

**Offline checks:** five new `tests/vetogram-business-owner-routing.test.js` cases were executed with isolated V8 and mocked store requests, all passed. Five updated `tests/vetogram-miniapp-readiness.test.js` cases also passed against the real controller function, including foreign owner, wrong connection token and missing `manageStories`. `tests/vetogram-webhook-flow.test.js` now deliberately uses different `user.id` and `user_chat_id` and asserts database owner and notification destination separately, but its **complete native Node integration test has not been run**.

**Data note:** previously archived records, if any, could have been keyed to `user_chat_id`. Do not migrate, merge or expose records based on an unverified mapping. Before public launch, inspect record counts and reconcile owner ↔ Business connection with a verified, consent-aware migration only if needed. No live data or migration was changed.

No GitHub Actions, paid runner, live Telegram test, Vercel deploy or database mutation was performed.

## Session ownership and login recovery audit

The phone-code and QR flows were reviewed after the Anti-Delete owner-key corrections. `api/viewer-sync.js` previously treated the persisted `status:'active'` flag as sufficient for several sensitive actions, even though its session status response already compared the persisted Telegram account ID to the signed Mini App owner. This inconsistency could accept a stale or misbound encrypted session for an unrelated action.

The draft now uses `isOwnActiveViewerSession(ownerId,row)` for:
- active-state responses; only the owner's encrypted session can be reported as connected;
- test Telegram alerts, viewer export, Story registration and notification preference writes;
- analytics access and continuation-of-login checks after reopening the Mini App;
- duplicate phone-code / QR login guards, which do **not** overwrite an unverified active row.

When a stored active session does not match the authenticated Mini App owner, its `account`, last polling information and last error are redacted. The UI still gets `identityMismatch:true` so it can show a recovery message, but does not receive unrelated profile data. These mismatches do **not** trigger automatic session revocation, deletion or re-auth requests.

The new `tests/vetogram-viewer-owner-sessions.test.js` exercises actual viewer API route handlers in a mocked VM and checks strict owner-bound session status, private-field redaction, denial of four sensitive operations, valid-owner success, and QR / phone-code non-overwrite. **7/7 cases passed** in the isolated JavaScript harness with current GitHub source; native Mini App login with a real Telegram code/QR remains unverified. The earlier report that codes did not arrive cannot be closed by mocked tests alone.

### Before releasing

Use a consenting test account to:
1. Sign in using **one** phone-code request. If the code is delivered through Telegram's official service chat, resume the pending challenge rather than requesting a new code.
2. Verify phone + code + optional 2FA and QR on a second device, then restart the WebView and confirm that the existing encrypted session loads without re-authorizing.
3. Deliberately open the Mini App from another Telegram account; ensure it cannot see the first account's profile, archived messages or Story analytics.
4. Disconnect explicitly, and confirm only the intended owner's private session is revoked. If a legacy row is misbound, investigate safely before any data migration.

All changes are draft-only. No Telegram code request, QR scan, message sending, production deployment or database mutation took place during this code audit.

## Archive outage integrity and recovery

This draft hardening addresses an Anti-Delete trust problem: `api/telegram-chats.js` previously swallowed secure-store failures in `archivedMessages()` and `archiveThreads()` and returned the **same empty collection** that a genuinely empty archive would return. The deferred `thread_archive` endpoint could therefore respond HTTP 200 with zero restored messages even though the archive might be full but temporarily offline.

The new behavior keeps owner-scoped, independently verified **live Telegram chats and messages available** while making archival failures explicit:

- An unavailable message archive is tagged `unavailable:true`; `thread_archive` responds **503** plus a user-safe archival warning. Genuine empty results stay 200 with an empty list.
- An unavailable saved-thread list is differentiated from a valid empty thread list. The chat listing returns 503 when **both** the live Telegram list and saved archive are unavailable; otherwise it preserves the live chat list with an explicit warning.
- For an independently available live thread, an archival outage appears in the response's warning. If neither a live chat nor an archive copy can be confirmed, the API returns 503 instead of falsely asserting the conversation never existed.
- In the Mini App, deferred archive synchronization failures are visible for **all** owner-matched live chats, rather than only archived-copy conversations. It never reports a restored deleted message unless the archive service actually responded with evidence.

Added `tests/vetogram-archive-unavailable.test.js` to the no-cost `npm run qa:core:offline` suite. **8/8 source-grounded V8-executed cases passed**, including a real handler mock showing an archive outage preserves working Telegram live chats with a warning. No actual Telegram webhook, archive storage or Vercel service was contacted. Native `node --test` and real two-account Anti-Delete event delivery remain separate pre-release acceptance gates.

No production migration, merge, deployment, credential action or paid service use in this change.
