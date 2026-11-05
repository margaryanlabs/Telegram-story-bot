# VETOGRAM REBORN — RB4: Owner session lifecycle (P0)

**Date:** 2026-11-05  
**Review branch:** `feature/vetogram-reborn-rb1-foundation-20261105`  
**Draft PR:** #235 against `feat/vetogram-black-universe-preview-api-20261101` (real Vetogram 8.5 preview snapshot).  
**Status:** code and isolated regression tests committed. NOT production-ready.

## Confirmed bug

The original `public/app.js` revoked the personal MTProto session after a successful `viewerApi('disconnect')`, but `public/telegram-chats.js` had no event listener for that same-owner session revocation. Its `resetOwner()` cleared state only if signed Mini App `initData` changed.

This meant that on voluntary logout **with the same Telegram Mini App identity**, private owner-verified conversations, volatile drafts, cached media and optimistic pending send callbacks could outlive the account connection in the browser until another API/navigation action. An old **LIVE ✓** label could remain visible.

This is a privacy and trust defect, not merely an animation issue.

## Changes implemented

### 1. Emit disconnect only for confirmed session loss

`public/app.js` now dispatches a local `vetogram:telegram-session-disconnected` signal with **no personal data** after a successful account disconnect from both settings actions:

- `security-revoke-session`
- `viewer-disconnect`

`refreshViewerSync()` also emits that signal when an **authoritative** signed server refresh transitions from previously connected to not connected. It does **not** infer logout from degraded or transient storage errors.

The existing `vetogram:telegram-session-connected` path remains responsible for reloading the signed owner's actual inbox after a successful connection.

### 2. Fail closed on disconnect, even if initData is unchanged

`public/telegram-chats.js` now listens for `vetogram:telegram-session-disconnected`, immediately:

- Increments inbox, archive-overlay, thread and session generations so old async responses cannot repaint the screen.
- Aborts active history and live polling; clears scheduled work.
- Clears RAM-only inbox, messages, hot-thread cache, drafts, optimistic send errors/nonces, pending attachment references and avatars.
- Revokes browser blob URLs, drops media previews, stops capture and removes private thread DOM nodes, including owner/thread markers.
- Clears `sendInFlight`, switches back to the inbox, updates account proof and shows **Telegram отключён**, never stale **LIVE ✓**.
- Clears the **personal** Account badge immediately; separate Telegram Business Story rights are left untouched.
- Keeps all actual server mutations within the existing authenticated `viewerApi('disconnect')` handler; the event is a **client-side cleanup**, not a new endpoint.

The original account owner checks and explicit authorization still apply. The existing Business permission path is not silently removed.

### 3. Fence delayed send responses from the revoked session

A new `sessionEpoch` is captured by text and rich-media send actions and incremented on owner reset or session invalidation. A late ACK, error, or `finally` from a prior session cannot refill local messages, overwrite drafts, restart sending status or unlock a newer send.

No automatic re-send is introduced. For already-issued MTProto calls, aborting browser display **does not guarantee delivery cancellation**; a remote send may complete after the user disconnects. The UI cannot honestly claim that server-side transport was reversed.

### 4. Regression test

`tests/vetogram-reborn-rb4-disconnect.test.js` extracts the original logout/invalidation code into an isolated Node VM. It covers:

- Clearing private state, DOM, drafts, cache, send locks and media immediately.
- Not clearing the *new* owner after a stale callback.
- Capturing `sessionEpoch` in text/rich send callbacks and fencing delayed results.
- Extended existing sender VM suites in `tests/vetogram-cross-chat-send-51.test.js` and `tests/vetogram-v5-media-send.test.js` with delayed successful/uncertain ACK scenarios.
- Authoritative server refresh versus temporary degraded storage state.
- Removing stale LIVE badges and presenting a truthful disconnected empty state.

**Execution note:** These tests are committed and source wiring is read back via the GitHub connector, but the full Node test suite and actual Telegram/WebView flows **have not yet run**. Hosted CI is not currently available for the branch, and the prior Render/Vercel preview limits remain unresolved. Do not describe this as production verified.

## Manual acceptance gates

1. Enter with personal Telegram. Confirm actual messages and account proof appear.
2. Start a text send and intentionally delay the ACK. Tap **Отключить Telegram Account**. No private bubbles, drafts, media or optimistic statuses may reappear.
3. Repeat with media/sticker send. A sent-before-logout Telegram message may finish remotely; UI must not rehydrate the old session.
4. Leave a background inbox refresh running during logout. Its old payload must never reintroduce previous chats.
5. Reconnect the *same* Telegram Mini App owner. New owner-verified dialogs must load; no cached old session data may be presented as already connected.
6. Switch A → B (different signed Mini App accounts). Private data and media from A never become visible to B.
7. Trigger a temporary Viewer storage outage, retaining a previously connected session. No false logout or data clearance without confirmed server session loss.
8. Revoke the server-side session, then refresh Viewer Sync. Same-owner disconnect event must clear the inbox.
9. Test 320/360/390/430px Telegram WebView and hardware Back, native keyboard and accessibility focus.
10. Verify business permission/archive policy remains independent; no historical Anti-Delete recovery claims.

## Further P0 work before release

- Run `node --test` on RB1–RB4 regression files and existing Telegram/chat owner/safety suites in a full local checkout.
- Exercise phone-code, QR, 2FA, challenge resume, cancelled challenge, actual send/receive and session revocation using an explicitly authorized **test** Telegram account.
- Audit and reconcile disconnected state across Chat, Stories, Account Center and Business/Privacy modules.
- Only then create an isolated staging preview (account limits currently block new Render/Vercel previews). Do not overwrite the old stable UI, main or current production.
