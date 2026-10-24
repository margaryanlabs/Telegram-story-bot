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
