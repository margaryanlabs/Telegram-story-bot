# VETOGRAM 3.9 — voice studio UX, permission lifecycle and QA
25 October 2026 · Draft PR #181 · no production deployment

## Verified implementation
- Redesigned **real** in-chat voice recorder, not a mock: coherent 7-preset tray, visually separate microphone permission request, active recording and ready-to-review voice draft; readable native audio controls and large cancel / redo / send buttons. On narrow phones the explicit Send action becomes a full-width final row.
- Timer shows genuine elapsed recording seconds and the existing 45-second limit, only while `state.recording` is true; no simulated volume waveform or false network acceptance.
- Added `state.voiceStarting` guard **before** requesting mic permission, so repeated taps cannot open multiple concurrent `getUserMedia` dialogs. The button is disabled with `aria-busy=true` while waiting. The permission response is correlated with `voicePermissionGeneration` and the current Telegram owner and chat. After switch/cancel, stale mic streams are closed; old asynchronous responses cannot activate the next owner's recorder or reset its pending flag.
- During permission request and actual capture, recording EQ presets and attachment/sticker buttons are temporarily disabled so the outgoing payload cannot change inadvertently. **Stop remains enabled during capture, even if a prior attachment exists.** The send action for a recorded voice requires an explicit click on the existing preview action; this pass added no automatic send and no server API.
- Accessibility: live label for **permission requested** vs **recording**, separate visually updating elapsed timer marked `aria-hidden` to avoid speech repeating every 350 ms, truthful mic button `aria-pressed` and `aria-busy`, focus-visible targets, reduced-motion fallback.
- Existing preview Blob URL lifecycle, recording cap, voice effects, owner authorization, native file controls and chat/messaging code retained.

## Test evidence
- `tests/vetogram-voice-studio-39.test.js`: seven tests cover actual async mic permission single-flight/denial, owner-change cancellation, success path, true status/UI phases and effect lock, UI aria semantics, responsive/reduced-motion CSS and reachable Stop when recording with an attachment.
- The new suite was added to `ci:offline`, `qa:core:offline` and `check`.
- Isolated V8 tests against the latest GitHub sources: **7/7 Voice Studio 3.9 plus 5/5 earlier media/voice checks = 12/12 passing**. Source JS parsed successfully; CSS braces balanced.
- These are isolated source/behavior checks, **not** a full real Node CI run, not an Android/iPhone Telegram WebView microphone-permission test and not proof of successful upload/send.

## Acceptance on actual Preview
1. iOS/Android/Fold: permission accept, deny, dismiss; tap Start repeatedly; no duplicate prompts, no stuck disabled microphone.
2. Start recording, stop manually, let 45-second cap stop the recorder, then listen, redo, cancel and explicitly send.
3. Change account/chat or hide the Mini App while mic permission is pending; old recording must never start on the new owner.
4. Try attachment controls/preset choices while recording; Start/Stop must remain available and failed/disabled upload must never look accepted.
5. Readable/usable on 320px and iPhone keyboard with safe areas, live status not announcing every timer tick, dark/light chat theme, prefers-reduced-motion.
6. Verify processed low/high pitch vs robot/deep/warm/radio sound fidelity on actual mobile codecs; no false claim about voice identity or backend capabilities.

## Infrastructure scope
No main merge, production deploy, Vercel, Neon, AI keys, paid APIs or authorization changes. Another chat owns deployment; all changes remain in this draft PR.
