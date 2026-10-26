# VETOGRAM 5.0 — Telegram authentication audit

Date: 2026-10-26. Baseline: PR #188 `4bd95a65dc2e4ff555d38150c7034e4adbbe20c1`.

## Confirmed reproducible code defects

1. `beginUserAuth()` called the pinned teleproto `sendCode()` convenience helper. Inspection of installed `teleproto@1.229.0/client/auth.js` confirms that helper returns `phoneCodeHash`, `isCodeViaApp` and email flags, while discarding the actual `auth.SentCode.type`, `nextType` and `timeout`. VETOGRAM therefore could not distinguish SMS from calls/other media or show Telegram's actual retry deadline. A valid challenge was reused for ten minutes, with no `auth.resendCode` path.
2. Real `teleproto.errors.FloodWaitError` has `errorMessage === 'FLOOD'`, its exact wait in `.seconds`, and class name `FloodWaitError`. The previous `FLOOD_WAIT` string-only classifier missed real SDK errors. This is reproduced with real SDK error constructors in the tests.
3. The SDK password helper wraps errors as `AUTH_USER_CANCEL` when `onError()` returns true. The prior callback therefore obscured `PASSWORD_HASH_INVALID` and rate limits.
4. The previous normalizer silently removed letters from a phone input. It now accepts ordinary phone punctuation and rejects malformed international numbers instead of changing their digits.

These defects explain missing delivery detail, missing supported recovery and incorrect rate-limit feedback. They do **not** establish why a specific historical code did not arrive on a particular device. A successful `auth.sendCode` response establishes Telegram's selected delivery channel, not receipt on the phone. No live code receipt was tested in this audit.

## Implemented behavior

- Invoke official `Api.auth.SendCode` directly and persist exact safe delivery metadata, next medium, timeout-derived deadline, code format and code length together with the existing encrypted challenge/session/hash. Never expose the hash or session in the HTTP response.
- Distinguish app, SMS, call, flash/missed call, email, Fragment and Firebase delivery. Unknown constructors remain unknown. No fabricated SMS receipt, delivery success, URL or notification.
- Handle `auth.SentCodeSuccess` as actual authorization and `SESSION_PASSWORD_NEEDED` as a password step, including when no code was sent. Every successful owner identity is checked before storing a session; mismatch revokes the new session.
- Add explicit `resend_code` using the existing encrypted challenge and latest hash. It requires an actual supported `nextType`, a valid elapsed Telegram timeout, working secure storage and the existing Neon v6 owner lease. It never falls back to another `sendCode` call.
- Retain cross-instance serialization. Recheck current challenge after acquiring the lease. Confirm replacement challenge persistence before acknowledging resend success. On uncertain Telegram/storage outcome, retain the lease rather than immediately retrying.
- Preserve real FLOOD_WAIT duration in safe `Retry-After` feedback and extend the same token-bound Neon lease with `defer_login_code_lease`. That cooldown survives Vercel cold starts and explicit challenge cancellation, without a schema migration. Competing requests receive remaining lease duration from SQL. As with any durable write, storage failure cannot prove cooldown persistence; the original bounded lease is retained in that case.
- Limit auth connect/RPC/disconnect time. Use a two-attempt SDK RPC budget to preserve its built-in PHONE/NETWORK_MIGRATE handling, with `floodSleepThreshold:0`. Do not recurse on AUTH_RESTART, silently force SMS, or loop password attempts.
- Preserve email setup and 2FA, support SMS word/phrase codes, reject malformed challenge expirations and keep QR as an independently supported alternative.
- Preserve the existing QR stream's request deadline and abort behavior. QR receipt, device camera access and real 2FA were not tested here.

## Test evidence and limits

`tests/vetogram-v5-auth-delivery.test.js` adds executable tests using actual Telegram API constructors and SDK errors, injected fake MTProto clients, the actual resend-handler source, and a simulated SQL boundary. Covered: delivery/timeout/next-medium mapping, no RPC on early or unavailable resend, durable-session/latest-hash reuse, real FLOOD_WAIT classification and deferral, cross-runtime serialization, persistence failure, owner/token SQL guard, immediate authorization, pre-code 2FA, password error preservation, text codes and strict phone input.

The existing email and login-resume suites retain their behavioral concurrency, pending-challenge and storage-readiness checks. Their test harness now includes the actual safe metadata helper instead of assuming it is a VM global. Legacy UI source assertions were adjusted for the shared result-rendering helper and whitespace without removing the no-automatic-Business requirement.

These are local deterministic tests. They do not simulate or claim a successful Telegram delivery, a real Neon SQL transaction, an authenticated phone session, or a physical-device WebView result. Full-suite/build results are recorded in the main release report.

Focused verification at handoff: 50/50 pass across auth delivery, email, login resume, auth navigation and the parent's V5 auth UI suite. `node --check` passed for modified auth server files; `git diff --check` clean.

## Required live acceptance before commercial release

1. On the owner's consented test account, request one code once. Record only constructor name, timeout/next-medium category, sanitized RPC code and timestamp. Do not record phone, hash, code, password, session, QR token or email.
2. Confirm the device receives it through the channel Telegram actually chose. Close/reopen Mini App and verify the same challenge resumes without another SendCode.
3. If Telegram offers a next medium, wait the real deadline and deliberately request one resend. Confirm replacement state survives a second serverless request; verify the newest code.
4. Complete 2FA through the application's private input if required. Confirm owner identity and session restoration after restart. Never submit codes/passwords through this conversation or GitHub.
5. Test QR with a second already-authorized device and correct owner; test expiry/cancellation separately. This audit did not request any real QR token or authorization code.
6. Read/send/receive a controlled message after session restoration. Verify restricted/archived chats remain read-only.

The parent audit confirmed Neon schema v6 is already applied; do not reapply its migration. Required server secrets remain `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`, `TELEGRAM_BOT_TOKEN`, `VETO_NEON_DATABASE_URL`, `VETO_NEON_SESSION_KEY` through protected environment variables only. This auth work introduces no paid service and requires no new API key.

## Official references

- https://core.telegram.org/api/auth
- https://core.telegram.org/method/auth.sendCode
- https://core.telegram.org/constructor/auth.sentCode
- https://core.telegram.org/method/auth.resendCode
- https://core.telegram.org/api/qr-login

Source behavior and availability must be checked against these Telegram contracts and the pinned installed SDK; third-party clients cannot guarantee SMS delivery or bypass Telegram's restrictions.
