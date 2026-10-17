# VETO Telegram · Communication OS delivery plan

**Canonical public product name: VETO Telegram.** Do not introduce new user-facing brands. Existing Storypilot technical endpoints remain for backward compatibility.

This plan extends the existing `margaryanlabs/Telegram-story-bot` production codebase. Do not replace Story, Privacy, Live Chats, Viewer Sync, the user's encrypted MTProto session model, or the owner-isolation guard. Ship behind evidence-backed gates.

## Baseline (as of 2026-10-16)

- Story publishing, viewer analytics, owner-only MTProto Live Chats, opt-in message backup and private Media Vault exist.
- Smart Inbox uses transparent local heuristics, **not LLM analysis**.
- Voice Studio v1: live WebAudio EQ/effects, processed recording, playback, file share and download. Effects do **not** provide voice identity anonymity or true pitch/formant changes.
- Voice Studio v2 in PR #126: custom EQ, on-device processing, playback speed, recording time bound.
- Calls proof in PR #126: explicit P2P 1:1 audio, manual out-of-band invite/answer and WebRTC transport. **No automatic ringing, public rooms, TURN, identity service, video, model-based translation or server AI.** No normal Telegram call hooking.
- Security hardening in PR #125 separately handles in-flight previous-account UI events; merge only after account-isolation review and second-device acceptance.

## Follow-up P1 implementation (same draft PR #126)

The new short-code signaling path is **deployed on the backend but UI not released to production**:
- `/api/call-signal`: verifies Telegram-signed Mini App user, never trusts a client-supplied user ID, issues 192-bit temporary invite capability.
- `supabase/functions/veto-call-signal`: **independent** Ed25519-signed Supabase Edge function, separate from all Story, Privacy and Viewer Sync gateway operations.
- `supabase/migrations/20261016121000_veto_ephemeral_calls.sql`: server-only RLS table, bearer-token SHA-256 hash, first-answer atomic claim, eight-minute expiry and five-minute pg_cron hard purge.
- Browser: caller polls for answer over short invite `VETOR1`; callee claims it under their own signed Telegram identity. SDP stays server-side; no peer SDP is copied into the invite. Original manual `VETO1` remains a fallback.
- Both modes are WebRTC-only audio. Optional TURN REST credentials are implemented but require a real Coturn server and Vercel configuration; no functioning relay has been verified. A P2P WebRTC room is not a Telegram-native incoming-call/notification service.

**Deployment record, 2026-10-16:** applied `veto_ephemeral_calls` migration to Supabase project `xvtmgzzaomolnvkcgosk`; deployed standalone `veto-call-signal` Edge function v1, `verify_jwt=false` with mandatory internal Ed25519 verification. Verified table has RLS ON, neither `anon` nor `authenticated` has SELECT, initial room count = 0, and `veto-call-room-ttl` cron active every five minutes. Existing Story/Privacy Edge function was not replaced. This **does not** establish successful authenticated signaling or real WebRTC call; no real two-physical-device test completed.

**Remaining release gate:** verify signed end-to-end Vercel→Edge create/inspect/answer/poll/end via two separate real Telegram initData identities; verify first-answer and expiry; test Android/iOS and cellular/Wi-Fi ICE, reject cross-account access and confirm low leak risk. Do NOT merge until two-device evidence. Never log secrets, SDP or chats.

**TURN readiness:** server can mint Coturn REST temporary HMAC-SHA1 credentials on authenticated `POST /api/call-signal {action:"ice"}`. Configure server-only Vercel `VETO_TURN_URLS` (comma-separated `turn:`/`turns:` addresses) and `VETO_TURN_SECRET` (same strong shared secret as Coturn `static-auth-secret`). Without both, UI accurately displays STUN ONLY. Verify actual selected ICE candidate as relay in client quality indicator before calling it working TURN.

## Incoming invitations — consent-first delivery (staged PR #126)
- New migration `20261016204500_veto_call_recipient_optin.sql`: incoming alert preferences are **OFF by default**, server-only with RLS enabled and no `anon`/`authenticated` direct access; private recipient ID on targeted WebRTC rooms.
- New signed Edge operations `call_preferences_get` and `call_preferences_set` accept only the verified Telegram Mini App actor passed from the Vercel backend.
- Opted-in recipients can share their own Telegram ID with trusted people. A caller may optionally enter that ID to send one invitation. The Edge only permits that if the **recipient opted in**, binds the invite to the chosen Telegram account, and atomically limits alerts to **one per recipient per three minutes**.
- Vercel sends `sendMessage` from the existing Telegram bot after the signed store accepts the room; link carries **no raw SDP**, `protect_content` is set and the message has a single user-directed "Open VETO Calls" button. An undeliverable bot message is reported honestly; a short code remains usable.
- The Telegram Bot API **cannot ring arbitrary phone users**, intercept Telegram native calls, or message a recipient who has not started / blocked the bot. Incoming messages are notifications, not true CallKit/native OS phone rings.
- No alerts were sent during code deployment. At deployment verification, Supabase room count and opted-in record count were both **zero**. The `veto-call-signal` isolated Edge function is version 3 ACTIVE; private call opt-in table has RLS ON and direct client reads revoked.
- CLI/automated tests cover opt-in, disabled recipient rejection, targeted secret binding, replay refusal, caller-only poll, and throttling under a fake Telegram Bot API. **Not verified on two actual accounts or real Telegram messages.**

**Release gate:** verify Telegram bot has been started by recipient, the Main Mini App deep link opens correctly, delivery is not spammy, and real WebRTC audio works across two phones. PR stays draft; production UI should not show untested incoming calls.

## Delivery phases & acceptance criteria

| # | Feature | Status / next milestone | Acceptance gate |
|---|---|---|---|
| 1 | Voice Changer | WebAudio presets in Studio and Calls; actual gender-style/formant model is future R&D | Compare original/processed recordings; low-latency budget and measured CPU; no anonymity claims |
| 2 | VETO Calls | PR #126 P2P + staged signed signaling and verified invites; next TURN, incoming notifications and reconnect | Two real Telegram users, Android+iOS, Wi-Fi/cellular and NAT, mic revocation and hangup |
| 3 | Universal Translator | Not implemented | Opt-in STT→translate→TTS with displayed latency, languages RU/EN/HY/AR; fallback to original audio; costs |
| 4 | Voice Studio | Local recording present; v2 custom EQ and playback rate in PR #126 | Browser/WebView capability matrix, sharing fallback; never silently transmit audio |
| 5 | Call Memory | Not implemented | All participants explicitly opt into recording; consent visible/revocable, retention and deletion |
| 6 | Smart Inbox | Working heuristic highlights, no model; next user-reviewable priorities | Accurate sources, no sending or marking chat read, opt-in AI processing |
| 7 | Message Intelligence | Not implemented | Owner-selected source scope; actionable date/entity extraction with source quote and confidence |
| 8 | Voice Identity | Session-only custom tone; no biometric profile store | Opt-in user-owned profile, consent and secure local/server deletion |
| 9 | AI Reply Assistant | Not implemented | Draft only, visible citations to source messages; human send confirmation |
| 10 | Media Vault | Bounded opt-in copies of selected Telegram content exist | Server owner check, storage integrity and retention proof, accessible delete/export |
| 11 | Conversation Search | Text filters only; semantic retrieval not implemented | Owner-side only, strict chat ACL, encrypted-at-rest index, delete-index after disconnect |
| 12 | Communication Analytics | Stories analytics present; communication stats not implemented | Privacy-preserving aggregates, opt-in, no metadata leakage across owners |
| 13 | Live Voice Morphing | Low-latency EQ/tremolo intensity live in PR #126 | Measure latency in call; premium voice morph requires true pitch/formant DSP |
| 14 | Conversation Copilot | Not implemented | Human-controlled, consented context with latency and hallucination warning |
| 15 | Private Room | Not implemented; P2P call prototype ≠ private room | Signed invite membership, expiring credentials, video, access revocation, threat model |

## Architecture boundaries

1. **Telegram chat**: owner-signed Mini App `initData` + live MTProto `getMe` owner check + owner-scoped archive, with no cross-account browser caches.
2. **VETO Calls**: distinct WebRTC service, never intercepting standard Telegram calls. Use application-level signaling with authenticated room roles, per-room time limits, rate limits, TURN relay and server-side cleanup **before** advertising seamless calling.
3. **Audio effects**: process locally when possible. A browser EQ shelf is **not** true pitch shift, voice cloning or irreversible anonymization.
4. **AI**: disabled by default for private content. Per-feature opt-in, clear provider disclosure, time-bound processing and explicit delete. E2EE private rooms are incompatible with invisible server-side plaintext AI.
5. **Invitations**: production version should use one-time short links backed by authenticated signaling; never paste untrusted SDP into a privileged Telegram session endpoint. P2P trial currently uses manually transferred code.
6. **Recording**: all participants must be informed and consent. Do not auto-record or promise deleted-message recovery for content that was never backed up.
7. **Observability**: do not log raw SDP, MTProto sessions, message text, transcripts, auth tokens or media payloads. Use aggregate latency/error counters.
8. **Product clarity**: initial Home remains simple. Advanced calling/intelligence modules should be discoverable but never block Story onboarding.

## Production gates

- P0: real two-account isolation audit; PR #125 must be separately validated.
- P1: PR #126 preview build + deployed schema/Edge + signed live tests and **two-device** WebRTC test. Backend installed, E2E remains unverified. Browser tests do not prove actual call stability.
- P2: server signal service with reliable TURN, signed caller/callee identity, incoming notification route, disconnect lifecycle. Gate by transport reliability.
- P3: upgrade local Voice Studio first, then streaming speech-to-text and translation in separate optional consented calls.
- P4: Message Intelligence, source-grounded draft replies, encrypted semantic search and aggregations with measured privacy and inference cost.
- P5: conference rooms/video, collaborative review and caller-controlled AI assistance; full security review and consent UX.

**Monetization gate:** do not charge for experimental STUN-only manual signaling or advertise live translation before it exists. Price only after real-device success and explicit cost measurement (TURN bandwidth + STT/LLM/TTS + storage).
