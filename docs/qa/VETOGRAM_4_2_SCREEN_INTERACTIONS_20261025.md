# VETOGRAM 4.2 — screen transitions, mic lifecycle and keyboard safety
25 October 2026 · existing Telegram Mini App · Draft PR #181 · no deployment

## Verified faults in existing runtime
1. The independent Voice Studio (screen `voice`) allowed concurrent `getUserMedia` requests while the first permission prompt was pending. Because the recorder only marked `state.active` after the async permission and `AudioContext.resume`, leaving Voice Studio or closing WebView before a late permission response could start the audio graph outside that screen. The existing screen-change cleanup stopped audio only if `state.active` was already true.
2. `veto-device-polish.js` measured keyboard-open geometry against any focused editable element. On navigation, that field could already be inside a hidden screen; a delayed blur/resize could leave the new screen in its old keyboard geometry.
3. Updated scripts were referenced with old versioned query strings, risking stale client assets after the subsequent Vercel deploy. Assets were not deployed in this pass.

## Actual fixes
- `public/voice-studio.js`: `micStarting` single-flight guard, `micEpoch` cancellation token; a pending request disables additional Start taps but keeps an explicit “Отменить запрос” button available. Both the microphone permission continuation and async AudioContext resume verify the current visible `voice` screen and epoch. Stale audio streams are stopped; any created context is closed; stale rejections do not overwrite a newer screen's UI state. `stopMic` invalidates pending starts. A `visibilitychange` handler also stops active/pending mic work when Mini App goes into the background; existing `pagehide` cleanup remains.
- `public/veto-device-polish.js`: onscreen keyboard is considered active only if the currently focused editable field belongs to the active screen; on `veto:screen-changed`, a focused field in a hidden screen is blurred and viewport geometry is recomputed. This does not alter Telegram permissions, message content or persistence.
- `public/studio.html`: fresh URL versions for `voice-studio.js` and `veto-device-polish.js`, initial mic `aria-busy="false"` and clear Russian mic caption.
- `public/vetogram-finish-2026.css`: restrained pending-permission styling, accessible focus and touch targets, reduced-motion support. No simulated microphone recording or auto-send.
- `tests/vetogram-cross-screen-interactions-42.test.js`: tests registered in `ci:offline`, `qa:core:offline` and syntax `check`.

## Evidence checked
- **10/10** isolated source/behavior tests in VETOGRAM 4.2 passed against current GitHub sources:
  repeated Start during pending getUserMedia, late stream after navigation, pending AudioContext.resume cancellation, page-hidden pending request, successful explicit start and Stop cleanup, stale permission failure, hidden input keyboard reset, fresh static asset versions, fullscreen Telegram chat -> AI restores tab/navigation classes, and actual `visibilitychange` callback stops active and pending mic.
- **6/6** compatibility source tests for VETOGRAM 4.1 passed, **16/16 total** in these two isolated suites.
- `voice-studio.js`, `veto-device-polish.js`, `chat-theme.js`, `app.js` and `telegram-chats.js` parsed in the V8 runtime without syntax errors. Finish CSS braces balanced.
- **Not run:** real `npm ci`/full Node CI, Playwright screenshots, Android/iOS/Telegram WebView microphone permissions, device keyboard events, actual user-recording/playback or background WebView OS behavior.

## Hardware acceptance before merge
1. Open Voice Studio, tap Mic twice quickly while permission prompt is pending: exactly one prompt; “Отменить запрос” stops it safely. Deny and retry; button does not remain stuck.
2. Grant permission but immediately switch to AI / Stories / Telegram chats or background Mini App. Any late callback must stop the mic track, close the audio graph and never record while hidden.
3. Accept permissions in the foreground, start a local recording, Stop, listen, redo/share/download explicitly, then background and foreground the app. No audio continues while hidden.
4. Focus search or compose field with software keyboard open; switch to a different screen. New screen must not inherit `veto-keyboard-open` or get cropped; active text fields should still use the actual keyboard-safe viewport.
5. From fullscreen Telegram thread open VETO AI or Story Engine: restored bottom nav must be reachable. Return to Telegram: the source-verified owner/session and draft restrictions remain enforced.
6. Validate Fold, iPhone, Android, dark/light mode, reduced motion, 320/360/393/768px widths and large accessibility text.
7. Run real app tests and full build separately. Other chat is responsible for Vercel/Neon and production release.

## No release side effects
This pass performed no main merge, no production deploy, no Telegram account changes, no financial/API key operations and no Vercel/Neon mutations. It is limited to the existing GitHub draft PR.
