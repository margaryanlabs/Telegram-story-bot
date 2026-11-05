# VETOGRAM REBORN — RB3 Messenger Reliability

**Date:** 2026-11-05  
**Branch:** `feature/vetogram-reborn-rb1-foundation-20261105`  
**Review:** Draft PR #235, targeting the confirmed 8.5 preview branch. Not `main`.  
**Scope:** P0 reliability of Telegram chat history and honest Privacy archive coverage.

## Observed defects in the shipped source

### A. Full history was not recovered after a failed initial thread load

`public/telegram-chats.js` previously scheduled only `pollThread()` in `scheduleThreadSync()` regardless of `state.threadLoadError`. After an initial history failure, the online, visibility, screen-return and retry paths therefore fetched only the short new-message window from `/api/telegram-chat-updates`. This cannot reconstruct the complete history, pagination, or server-verified `canSend` rights restored by `loadMessages({reset:true})`.

**RB3 fix:** A scheduled sync uses `loadMessages({reset:true})` whenever `state.threadLoadError` exists and there is no history request already running. Incremental polling runs only when there is no unresolved history error. The existing `maySyncThread()` is checked again when the timer fires, preventing hidden/offline or unverified-owner retries. Existing cancellation, owner-generation fencing, 401/403/409 fail-closed semantics, and no-automatic-resend rules remain unchanged.

### B. Optional Privacy store outage masqueraded as empty archive

`api/telegram-chat-updates.js` previously converted any `listPrivacyMessages` failure to `[]` with no response indicator. The lack of saved rows cannot distinguish a genuinely empty archive from an offline store.

**RB3 fix:** The API now returns `archiveAvailable: true | false`. `true` requires a successfully returned `messages` array. Rejections and malformed responses report `false`, while still returning owner-verified live Telegram messages. The client shows an explicit transient archive-unavailable status and never infers a deletion from missing live messages.

### C. Legacy auth message branding

`api/telegram-chats.js`, `api/telegram-chat-updates.js`, and `api/telegram-send.js` now consistently use **Vetogram**, not the legacy VETO/StoryLab copy, when signed Telegram Mini App identity is missing. No security check was weakened.

## Regression coverage committed

- `tests/vetogram-reborn-rb3-reconnect.test.js`: exercises the real scheduler extracted from the shipping browser script with fake timers; healthy poll, failed history recovery, request-in-flight, hidden/offline, back-to-back reconnect, original lifecycle wiring and signed-owner conditions.
- `tests/vetogram-reborn-rb3-archive-status.test.js`: exercises the real backend poll handler in an isolated Node VM with mock Telegram owner and Privacy storage; live chat survives archive outage, healthy archive gives saved evidence, malformed response is explicitly unknown, wrong-owner session is rejected.
- `tests/vetogram-reborn-rb3-auth-brand.test.js`: consistent authentication copy and preservation of send-owner/nonce requirements.

### Verification truth

Source-level contract checks and connector read-back can confirm the code is present. The Node unit test files are **committed but NOT executed against the full checkout** in this environment. A local syntax smoke check of the extracted scheduler/normalizer snippets succeeded, which **does not** prove integration or browser behavior. GitHub Actions have previously been blocked by account billing restrictions. The public 8.5 Render service is a visual review server with Telegram APIs disabled, and therefore cannot validate actual chats.

No real Telegram credentials, conversations, user data, business permissions, WebView, public service or production branch were modified.

## Physical acceptance matrix — still required (P0)

| Case | Expected |
|---|---|
| New Telegram owner login with phone code | Verified session or honest error; no untrusted chat content |
| QR login on another device | Same account verified and retained |
| 2FA challenge, expired challenge and resume | Explicit status; no repeat OTP storm |
| Open thread and turn internet off during first history load | Existing verified messages remain; no fake successful update |
| Reconnect internet while open | Full history + canSend status revalidated before poll |
| Hide the WebView, open another screen, and switch A→B→A rapidly | Old replies never repaint the wrong thread |
| Privacy DB unavailable while live Telegram works | Live messages visible; **archive temporarily unavailable** indicator shown |
| Privacy DB returns malformed data | Archive cannot report verified-empty |
| Owner logout/revocation/changed signed Telegram account | Private drafts, messages, caches, media and timers invalidated |
| Send after temporarily dropped ACK | No automatic retry; manual retry uses the same deduplication nonce |
| Background/foreground/keyboard resizing on Android | No lost composer, inaccessible buttons or overlapping toolbars |

## Next work (RB4)

1. Execute new + existing Node tests in an actual repository checkout and repair regressions.
2. Exercise the phone/QR/2FA/owner-transfer scenarios on a real Telegram sandbox/test account with explicit permission; capture failures without private content.
3. Fix remaining UI auth/session recovery loops, evaluate the React-free style cascade on real Android dimensions, and consolidate the oldest CSS layers.
4. Only after green tests and a reachable isolated preview, consider promotion — not before.
