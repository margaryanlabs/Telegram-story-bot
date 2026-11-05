# Vetogram REBORN — RB5: QR/2FA/phone login recovery and stale-flow fences

**Date:** 2026-11-05  
**Source:** \`feature/vetogram-reborn-rb1-foundation-20261105\`, continuing RB1–RB4 Draft PR #235  
**Release status:** review-only. Not merged or deployed; no real Telegram credentials used.

## Confirmed bugs and changes

### 1. QR 2FA challenge lacked client-side resumability

The QR API **already persisted** a per-owner encrypted \`qr_password\` challenge to the store after Telegram requested a password. But its \`password_required\` streaming event exposed only a hint, and the client immediately showed \`viewerPasswordSheet()\` without setting \`viewerState.loginPending\`. If the sheet was dismissed before another signed state refresh, the inline **Resume** indication was absent.

- \`api/viewer-qr.js\` now streams \`stage:'qr_password'\` and a **non-secret** \`expiresAt\` that matches the server-persisted challenge expiry.
- \`public/app.js\` records only \`{stage:'qr_password',expiresAt}\` in volatile UI state and refreshes the existing pending-login notice before switching to the 2FA sheet.
- No password, phone number, QR token, auth hash or MTProto session is written into client storage. The server keeps its existing encrypted owner-scoped challenge; no new login request is automatically dispatched.

### 2. Old QR streams could outlive owner and modal state

The QR login controller previously used one async \`fetch\` and a readable stream but did not compare the **signed Mini App identity and owner epoch** after async boundaries. A late QR stream could therefore continue to update or navigate UI that no longer belonged to the original owner after a WebView identity change or modal close.

- The QR controller captures **signedOwner** and **ownerEpoch**; its \`isCurrent()\` also checks the active AbortController and modal visibility before reading/applying events.
- The request header uses the captured signed owner throughout.
- After a connected event, the follow-up \`refreshViewerSync\`, Mini App refresh and analytics are also fenced by the captured owner before navigation/Business consent offer.
- Closing or replacing the sheet cannot trigger a stale navigation or show old-account QR results.

### 3. Unexpected stream completion looked like indefinite loading

A QR stream ending without a terminal \`connected\`, \`password_required\`, \`expired\` or \`error\` event now produces an explicit retryable error. Explicit \`expired\`/\`error\` messages are not overwritten with a generic stream error.

### 4. Phone-code-to-2FA expiry and honest modal state

The server previously saved a **fresh** ten-minute challenge when phone code verification advanced to 2FA, but omitted that new deadline from its success response. The UI kept the older code deadline and could prematurely hide the option to resume 2FA.

- \`api/viewer-sync.js\` now returns the **same non-secret \`expiresAt\`** written to the durable 2FA challenge.
- \`public/app.js\` preserves this deadline after \`verify_code\`, updates the pending-login notice and clarifies **QR** versus **номер + код** steps in the password sheet.
- Closing the password sheet now says \`Закрыть (вход сохранится)\`, accurately describing that it does not revoke the pending server challenge.
- \`tests/vetogram-reborn-rb5-phone-2fa.test.js\` adds an isolated server 2FA branch fixture, client login transition fixture and modal copy/route checks.

**Isolated in-memory verification:** Executed the actual extracted QR controller in V8 with fake streams for six scenarios (6/6 passed), plus the actual extracted phone server 2FA transition and password UI for five checks (5/5 passed). These are **not** the full Node regression suite or a real Telegram/WebView test.

### 5. Navigation regression test drift

\`tests/vetogram-reborn-auth-navigation.test.js\` still asserted **five** bottom navigation destinations, conflicting with RB1’s agreed four-tab configuration. It now expects \`telegram, publish, media, privacy\` while explicitly ensuring Profile remains reachable from the header/account sheet and AI remains a secondary route.

## New regression test

\`tests/vetogram-reborn-rb5-qr-lifecycle.test.js\` runs the **shipping QR controller** in an isolated Node VM and checks:

- QR 2FA creates non-secret, resumable UI state.
- Closing a modal during pending response cannot navigate.
- Changing owner during a QR request cannot expose old owner QR or navigate.
- Owner changing during post-connection refresh cannot navigate or offer Business permissions to the new owner.
- Unexpected stream EOF results in a retry state.
- Explicit expiry is preserved.
- No implicit \`send_code\`, \`resend_code\` or Business grant.

## Safety and release criteria

No production endpoint, live QR token, Telegram password, phone number, private session or user database was accessed or modified; code changes are limited to the Draft review branch. The Node tests are **committed but have not been executed in a full checkout**. Do not claim an authenticated QR sign-in is verified.

Still required to release:

1. Run \`node --test\` for RB1–RB5 and existing Telegram login, owner, OTP/resend, QR, chat-send and privacy regression tests in a full checkout. Fix any failing inherited tests before merging.
2. On a test Telegram account: phone/SMS/app-code, code expiry, QR scan with a second device, QR-required 2FA, closing/reopening the modal, cancelling the challenge, and switching signed account mid-flow.
3. Verify WebView streaming support on Android/iOS; where streaming is unavailable the UI must give a truthful error and a supported phone-code path.
4. Verify username and session owner match after login, first inbox load and sending with a known test chat.
5. Continue RB6 with visual work only after P0 owner/session safety and usability tests actually pass.
