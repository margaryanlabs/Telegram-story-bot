# VETO Calls — Real device acceptance / TURN launch gate

**Status:** STAGED on PR #126. A passing Vercel preview or in-browser virtual
two-peer test is **not** evidence of a working phone-to-phone call. Do not
merge PR #126 or describe native Telegram call support until these gates pass.

## 0. Correct scopes and no secrets in logs

- This is **VETO Telegram's own WebRTC audio**, not Telegram's normal
  voice/video call, not Telegram account MTProto access, not CallKit.
- No recording, cloud transcripts, captured private chats, raw SDP, room tokens,
  IP addresses, TURN passwords or Telegram `initData` go into bug reports.
- Keep PR #125 (account-switch privacy isolation) under separate review.
- In Vercel, the **current** Telegram bot token and API environment values
  were present only for **production** at last check. Do not copy a real
  production bot token into arbitrary unreviewed preview branches.
- Use a separately configured staging bot and Main Mini App URL for manual
  preview checks; do not deploy a staging URL on the public production bot.

## 1. Verify server is ready (authenticated, no user data returned)

On each signed Telegram account open **Calls → Проверить готовность**:

| Probe | Expected |
| --- | --- |
| WebRTC, WebAudio and media API | Available on the actual Telegram WebView |
| Authenticated `POST /api/call-signal`, action `probe` | Valid signature and private Supabase DB reachable |
| action `ice` | `relayConfigured` is **false** until TURN is really configured |
| Call room database | RLS enabled, no `anon` or `authenticated` SELECT |
| Cleanup | Cron `veto-call-room-ttl` active every five minutes |

**Do not change** existing Stories/Privacy Edge Functions. The dedicated
`veto-call-signal` function signs requests with Ed25519 from trusted Vercel.

## 2. Local check (one device, no microphone)

Tap **Тест WebRTC без микрофона**. This uses two RTCPeerConnections and
near-silent synthetic audio + control DataChannel in one WebView. It only
checks local browser media/ICE, not real-world connectivity.

## 3. TURN real-relay proof (one device, no microphone)

1. Provision and secure an external TURN server (Coturn or equivalent) with
   TURN REST shared secret, TLS and working UDP/TCP transport. A server
   address alone is not sufficient: test firewall rules and external reachability.
2. Configure server-only Vercel env vars for the **intended testing environment**:
   `VETO_TURN_URLS`: comma-separated `turn:hostname:3478?transport=udp`
   and optionally `turns:hostname:5349?transport=tcp`; `VETO_TURN_SECRET`:
   strong shared secret matching the TURN server REST configuration. Do not
   put shared secrets in front-end code, Telegram messages or this document.
3. In Telegram Calls, tap **Проверить реальный TURN relay**. This initiates
   two local RTCPeerConnections with `iceTransportPolicy:'relay'`, synthetic
   audio and data-channel ping/pong, then checks **selected relay ICE candidates
   on both peers** via WebRTC getStats. The ICE API returns temporary credentials
   only after Telegram Mini App signed authentication.
4. Only a successful **selected relay** check counts as proof that this device
   can reach the relay through its current network. A label
   `TURN ДОСТУПЕН` merely means credentials are configured.
5. Repeat Wi-Fi and cellular on **both phones**. A single-device success
   **still does not** prove that the two phones can reach each other.

## 4. Real Telegram user-to-user path (two physical devices)

Prerequisites: two different Telegram users who explicitly consent to testing,
fresh Telegram clients, dedicated staging bot started on both devices, correct
Main Mini App deep-link settings, and a working relay test.

1. On device A, open Calls and allow microphone only after tapping
   **Создать короткий код**.
2. On B, enable incoming invitations explicitly or keep notifications off
   and receive the invitation securely out-of-band.
3. On A, optionally enter B's Telegram ID (only when B opted in), create
   the room and verify **notificationSent** feedback is accurate.
4. On B, tap the Telegram invite link or paste the VETOR1 short code. Verify
   the **Calls** screen opens with code prefilled but microphone remains off
   until explicit **Присоединиться**.
5. B joins; A must auto-receive the answer, WebRTC both reach `connected`,
   and both hear **real** 1:1 audio. Test mute state and peer hangup.
6. Run A on cellular / B on Wi-Fi; swap roles and networks. Check actual
   selected relay candidate and round trip time (without capturing IP/SDP).
7. Deny microphone, block bot, use expired/reused invitation, a third
   Telegram user, disconnected ICE and account switch. Each must fail closed,
   stop mic, not leak owner state and not send unwanted invitations.
8. Wait until room expiry and cron cleanup; verify temporary SDP is deleted.
   No test needs a user's private messages, native call records or SMS code.

## 5. Expected restrictions / troubleshooting

- The recipient must have **started** the bot and enabled incoming
  invitations. Telegram bots cannot send messages to arbitrary users who
  never started them or blocked them.
- The Mini App WebView may close/suspend when Telegram is backgrounded.
  Tests must keep the call window in foreground; there is no operating-system
  background calling or native Telegram ringing yet.
- `TURN not configured` is a **deployment prerequisite**, not a successful
  traversal. Never claim a completed real TURN test until relay getStats proof.
- Preview deployment build tests are **synthetic** and cannot provide consent
  on behalf of two live Telegram users.
- Success = evidence recorded for signed database checks, real relay, real
  2-user/2-phone audio, rejection cases and owner isolation. Only then
  consider marking PR ready, merging and production smoke verification.

## Safe test record template

Date/device platform and Telegram version; network class (Wi-Fi/4G/5G),
test step, status PASS/FAIL, elapsed seconds or RTT aggregate if available,
whether selected transport is P2P or TURN RELAY. **Never** attach raw
SDP, links containing invite secrets, IP addresses, full user IDs, chat
contents, tokens, or mic recordings.
