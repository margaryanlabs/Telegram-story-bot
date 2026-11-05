# VETOGRAM REBORN — RB7 Mobile Chat / Stories Navigation

**Date:** 2026-11-05  
**Branch:** `feature/vetogram-reborn-rb1-foundation-20261105`  
**Draft PR:** #235 (against the verified Vetogram 8.5 visual-review branch, not main)  
**Release:** code-review only; no production merge, no deployment.

## Confirmed navigation failures

### 1. Telegram native Back was wired only to the account modal

`public/app.js` previously registered `tg.BackButton.onClick(closeSheet)`. Native Back was shown when the account modal opened, then hidden on modal close, regardless of whether the user was in a full-screen Telegram conversation. The on-screen ← chat button worked, but the Telegram native Back had no equivalent chat action.

**RB7 fix:** one `nativeBackTarget()` and `handleNativeBackButton()` coordinator. Native Back always prioritizes, in order:

1. Account modal.
2. Native message-actions dialog.
3. In-chat photo viewer.
4. Full-screen contact Story viewer.
5. Full-screen Media player.
6. Open Telegram conversation.
7. Secondary pages (Profile, AI, Voice, Viewers, Analytics, Editor and others), returning to Chats.

For primary tabs **Chats / Stories / Media / Protection**, native Back is hidden when no nested screen is open. It does not automatically close the Mini App or trigger any authentication request.

`public/telegram-chats.js` now exports the existing owner-aware `back()` handler as `window.VetoTelegramChatBack`, with no new navigation state. It emits a local data-free `vetogram:chat-view-changed` event on open, return, session revoke, owner switch, and auth-failure auto-return. Existing in-memory list scroll/focus restoration, polling cancellation and privacy fences remain in the original handler.

### 2. Overlays were invisible to the native Back router

- `public/telegram-stories.js` emits a data-free story-view event and exposes its existing `closeViewer()` as the native Back action. That cleanup pauses video, revokes private blob URLs, stops timers and restores permitted focus.
- `public/vetogram-universe.js` exposes the existing **full-screen** player close action, leaving background Music playback unchanged. No audio is reloaded or stopped by this navigation-only action.
- `public/telegram-chats.js` now exposes its photo close action and emits view-state changes; the existing dialog `close` event also re-evaluates native Back.
- `public/vetogram-chat-experience-v4.js` emits view-state changes as the native contextual-message dialog opens and closes, so it closes before the conversation.

No event payload includes any Telegram owner ID, signed initData, message content, QR token, or media URL. The original backend/permissions are unchanged.

### 3. Contact Story viewer leaked across screen transitions and restored stale focus

The contact story overlay was not closed on entering the **publish Stories** primary tab, because the existing handler treated both `telegram` and `publish` as valid story-list refresh destinations. This could leave a full-screen contact story covering the publishing interface. Also, closing a viewer after an owner switch, screen change or background transition could refocus an inactive input.

**RB7 fix:** leaving the Chats screen always dismisses the *contact viewer* before the destination screen is shown, without restoring focus to an inactive chat. Explicit user close or native Back still returns focus only if the previous control is connected to the current visible screen and the app is not backgrounded. Owner changes and backgrounding never resurrect stale chat focus.

### 4. Mobile keyboard geometry — preserved, not rewritten

`public/veto-device-polish.js` already measured `visualViewport.height`, safe areas and focus in the active screen, and set `--veto-visible-height`, `--veto-visual-bottom`, and `.veto-keyboard-open`. The existing canonical `public/vetogram-noir.css` already made the full-screen thread respect those metrics and used 16px composer font size to prevent browser input zoom.

Rather than adding conflicting CSS declarations, RB7 adds behavioral regression coverage for keyboard opening/closing, layout-viewport changes, pinch zoom and transitions from Chats to Stories.

## Tests added

- `tests/vetogram-reborn-rb7-native-back.test.js` — native Back priority, overlays over conversations, secondary routes, owner/authorization exit paths and overlay focus safety. Tests use real extracted controller functions in a Node VM.
- `tests/vetogram-reborn-rb7-keyboard-viewport.test.js` — real `veto-device-polish.js` executed with a mocked `visualViewport`, screen focus and Telegram safe-area properties.

**Validation that actually ran:** the actual extracted native Back router passed **19/19 isolated V8 scenarios**, Story viewer closure/focus passed **6/6**, and the original viewport observer passed **5/5**. Full JS syntax parsing for the changed application scripts passed **6/6** at the time of analysis. Source test syntax also parsed after stripping ESM syntax for the V8 script parser. These are **not** a successful repository-level `node --test`, browser render, screenshot comparison, or hardware QA.

## Outstanding release gates

- [ ] Run the complete `node --test` suite on a full local checkout, including RB1–RB7 and inherited auth/chat/media tests. The current container still cannot resolve github.com for git cloning, and a connector does not supply a mountable checkout.
- [ ] Real Android Telegram WebView: physical Back, hardware Back, virtual keyboard, visualViewport and split-screen Fold form factor.
- [ ] Open chat A→B→A; verify old messages, drafts and keyboard focus do not cross threads.
- [ ] Close a message-actions dialog, chat photo, contact Story and Media full-screen player using both native Back and on-screen controls.
- [ ] Switch contact Story → publishing Stories; verify the old viewer closes, data remains owner-scoped and keyboard focus is not stolen.
- [ ] Test QR/OTP/2FA and actual message sending/receiving on an explicitly authorized test account, plus logout mid-send.
- [ ] Regression-test background music continuity when the full-screen player is dismissed, and ensure no double player instances.
- [ ] Compare 320/360/390/430px widths, light themes, accessibility labels, safe areas and reduced motion on device.
- [ ] Publish to an isolated staging service after Render/Vercel quotas are resolved; keep existing preview and production unchanged.

No real accounts, sessions, Telegram APIs, user messages, credentials or hosted services were accessed or modified by this phase.
