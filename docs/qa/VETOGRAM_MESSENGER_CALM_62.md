# VETOGRAM 6.2 — Messenger Calm / reliability sprint

**Base:** `feat/vetogram-6-universe-20261028` (V6.1, PR #210).
**Branch:** `fix/vetogram-61-messenger-calm-reliability-20261031`.
**Release policy:** SOURCE ONLY. Do not deploy, merge to production, change billing, or touch Music/Cinema/Books/Games.

## Reported from Android / Telegram Mini App screenshots (31 October 2026)

1. Stories carousel too fluorescent: oversized pink/purple rings and visual collision with search.
2. Layered dark-blue grid/glows compete with chat content; large, scattered header actions.
3. Inbox shows fallback initials instead of some expected profile photos.
4. Thread shows a large "last from list" teaser, while the actual Telegram timeline is absent/still loading.
5. Chat connection, live history, privacy and avatar delivery require real-account diagnostics; screenshots alone cannot establish which backend resource failed.

## Changes in this branch

- Dedicated `public/vetogram-messenger-calm.css` loaded **after** V6.1 styles. Dark graphite palette, quiet chat background, no dashboard glows in the messenger, compact internal header, subtle story rings, simplified filters/search and composer, reduced motion and keyboard-safe controls. Does not alter Telegram's native Close/menu panel or overwrite alternate chat theme palettes.
- Telegram avatar endpoint `api/telegram-chat-media.js` now returns `noPhoto` only for **owner-verified, known dialogs** which explicitly have no profile photo. Unknown peer IDs are omitted. Auth validation and private response cache controls remain unchanged.
- Frontend `public/telegram-chats.js`: no-photo ids are not repeatedly downloaded; retryable avatar failures receive one scheduled, owner/epoch-scoped backoff (20s → 40s → 80s → 120s maximum), rather than waiting for scroll/user action. Manual refresh allows rechecking a contact which has added a photo. All avatar state/timers reset on owner switch/revoked access.
- First thread paint uses an explicit "Loading Telegram messages" placeholder, **not an inbox preview masquerading as history**.
- When Telegram returns HTTP 200 with an explicit read/storage warning but no messages, the UI shows a truthful retryable error, not "empty chat". Error text is escaped by the existing `empty()` renderer; preserve actual account boundaries and never silently send messages.
- Regression coverage in `tests/vetogram-messenger-calm-62.test.js` for CSS isolation, the backend no-photo distinction, owner-scoped avatar retry and warning-only empty-history state.

## Checks performed without deploying

- Remote GitHub file existence and references validated; dedicated CSS braces balanced.
- Parsed actual `public/telegram-chats.js` and `api/telegram-chat-media.js` via isolated JavaScript syntax compilation.
- Ran an in-memory simulation of the actual extracted signed avatar batch controller: absent photo skipped, failed photo retried after scheduled backoff and shown, no remaining retry timer.
- **NOT run:** `npm ci`, complete `npm test` / `vercel-build`, native Android/iOS/Fold screenshots or live Telegram E2E. These require a checked-out runtime and/or owner-confirmed test accounts. Passing older V6.1 builds does not certify this commit.

## Live diagnostics / remaining acceptance gates

1. Confirm Telegram Mini App `initData` validation, `getViewerSession` owner match, MTProto session status and backend error codes (401/403/409 vs 429/503/504). Do **not** log tokens, chat texts or raw auth headers.
2. Compare real `getDialogs` photo metadata with `avatar_batch` output for contacts *known to have* photos. Verify there is no accidental owner-scope mismatch. Only present initials if Telegram confirms no photo or after a visible failure.
3. With a real two-account test matrix: open first page, switch A→B→A while requests are running, re-open, paginate, pull-to-refresh, simulate a 22-second timeout, restore from saved archive. No private data leakage; no false empty states.
4. Physically verify top safe area and keyboard/composer on Android Galaxy Fold, compact Android portrait, iPhone and landscape. Telegram native close/menu is host-controlled, **not** in our CSS.
5. Verify actual Story contact image availability and view/publish independently; separate permissions from live chats. Confirm protection/Anti-Delete only when Business permission is present.
6. Run full Node suite and build gate before merging with any subsequent Games / Music / Cinema / Books branch; follow with one combined staging preview after user approval.

## Integration instructions

This is a stacked draft PR against `feat/vetogram-6-universe-20261028`, **not** another Vetogram product/site. The future Games feature (Plot Tank / Why Not?) is intentionally out of scope. Once its code and other media work are stable, merge/rebase in a controlled release branch and deploy the combined `studio.html` application once.
