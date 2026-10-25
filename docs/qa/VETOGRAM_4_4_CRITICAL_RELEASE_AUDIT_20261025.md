# VETOGRAM 4.4 — critical launch gate: Telegram, Stories, delivery and Anti-Delete
25 October 2026 · Existing GitHub Draft PR #181 · Source-only, not deployed

## What was actually audited
- Mini App signed initData at `api/miniapp.js`, owner-scoped MTProto and Telegram send endpoint; Story publishing via Bot API and direct authorized Telegram user session.
- The existing send route validates a real Mini App owner, active encrypted user session, same Telegram account, revalidates `client.getMe()`, checks destination among real owner dialogs, and derives a stable random ID from the owner's explicit nonce. **No real outgoing message was sent in this audit.**
- Privacy diagnostics and the optional Business bot consent route were inspected. Business connection rights and a reachable webhook are **not** independent proof that a deleted message was actually captured. The real delete evidence comes from the owner's saved deleted-message feed.

## Critical changes in this pass
1. **Unsafe Story retry removed (client)** — `public/app.js` no longer automatically retries `publish_story` after request failure. Bot API postStory has no application-proven idempotent nonce guarantee; a lost response might mean the first Story is already live. Requests such as read-only GET and explicit `check` retain the original retry policy. Network errors, HTTP 5xx, and in-flight 409 are described as **uncertain**; user is instructed to check real Telegram Stories before trying again. Composer/nonce stay available after uncertainty.
2. **No stale Story success from previous ID (client)** — `publishComposerStory()` requires `published === true` **and** a positive digit-only `result.storyId` from this request. It cannot fall back to the owner's earlier `state.lastStory`. No image cleanup, success toast or success sheet occurs on missing/invalid Story confirmation.
3. **Live owner identity before any personal Story upload (server)** — `publishPhotoStoryUserSession` now requires the signed owner ID passed by `api/miniapp.js`, validates its shape, and uses `verifyTelegramClientOwner(client, ownerId)` on the authenticated MTProto `client.getMe()` **before** requesting peer info and uploading private media. Stored session metadata alone is insufficient to publish in someone's name.
4. **No guessed ID of newest existing Story (server)** — Both MTProto Story publishing variants no longer select the most recent active Story when Telegram fails to provide the specific new Story ID. Such a guess risked falsely claiming success or invoking a privacy-mismatch deletion against an unrelated Story. The result is treated as uncertain and requires the user's own Telegram verification.
5. **Owner error mapped explicitly (server)** — `api/miniapp.js` now uses `telegramOwnerError` to return a specific 409 (owner mismatch) or 503 (cannot verify identity) rather than hiding a known security refusal as a generic HTTP 500. Other unknown publish results expose a conservative `uncertain` flag.
6. **Anti-Delete readiness separates configuration and evidence** — `api/privacy.js` now returns `attention`, `configured`, or `ready`. `ready` requires both operating core checks **and** an owner-scoped persisted real delete event; `configured` means infrastructure is configured but no deletion proof exists. `public/privacy.js` displays a distinct message and never presents a synthetic self-test alert as an actual deletion.
7. **Static asset cache version** — `studio.html` now refers to `/app.js?v=20261025-release-safety-44` and `/privacy.js?v=20261025-release-proof-44`. The former 4.3 integration source test was updated to check the newer URL. These URLs only take effect after another workstream deploys the PR.

## Evidence obtained
- `tests/vetogram-release-publish-safety-44.test.js`: **12/12** isolated source and behavior checks passed, including single-attempt Story POST, different retry treatment for safe calls, unknown HTTP 500, explicit 403, missing/unconfirmed Story IDs, successful ID handling, personal MTProto identity and server refusal mapping, deterministic chat sends and cache references.
- `tests/vetogram-release-antidelete-proof-44.test.js`: **5/5** isolated source and behavior checks passed, including configured-but-unproven state, owner-scoped real delete proof, missing webhook, disabled Business bot and missing storage.
- Both suites registered in `ci:offline`, `qa:core:offline` and `check`; release source and scripts were re-fetched after committing.
- **17/17 isolated checks passed.** This is not the result of the full GitHub Actions pipeline, not `npm ci`, not a real Telegram send or Story publication, and not a hardware visual QA pass. CI status should be inspected independently.

## Outstanding release blockers (do not claim ready)
- **Story lifecycle:** on a willing test Telegram account with valid owner session, publish one ordinary Story, then verify its exact Telegram Story ID, privacy/audience, protections, duplicate/timeout response behavior and the availability of Stories without Premium under that account's actual Telegram permissions. There is no unconditional Premium bypass.
- **Business / Anti-Delete:** the user must intentionally grant a Business bot scope to permitted chats. With a consenting test contact, send a new message, edit it, delete it, verify capture of the real webhook event and owner-private durable copy, plus absence of cross-chat/access leaks. Telegram secret chats and earlier history are not magically recoverable.
- **Send:** one explicit manual outgoing text and media/sticker test; verify destination, nonce/delivery and behavior after an ambiguous timeout. Do not silently retry a new nonce.
- **Security/infra:** check actual BOT token/MTProto credentials, live owner verification, webhook / signature delivery, Neon storage migration readiness, full CI and Vercel Preview with current PR assets. No changes were made to external infrastructure in this pass.
- **Mobile:** test Android, iPhone, Fold, dark/light and keyboard-safe UI on real WebViews, media viewing, mic capture and all 13 screens. Visual source QA cannot certify behavior.

## Deployment boundary
No merge into `main`, no Vercel/Neon production mutation, no new paid API, no Telegram user action, no guessed ability to post a Story and no fabricated Anti-Delete proof. The source work is limited to the existing Draft PR #181 branch.
