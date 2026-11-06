# Market Remembers V20.5 — Android Back and touchscreen scroll isolation

Date: 2026-11-06. Review-only branch `feature/market-remembers-v20-integrated-review-20261106`, draft PR #250.

## Goal

Fix a real mobile navigation contract: Android Chrome / in-app WebView Back should return `full → research → compact`, not discard the dossier in one jump. Full → research must preserve the currently playing 2008 Shock Replay, the selected stage and reading position.

## Implemented in the real EVENT CORE

1. The controller records **public UI-only snapshots** into `history.state.__marketRemembersV20Sheet`: `mode`, `event`, `sheet` and `depth`. It preserves unrelated existing `history.state` keys. No story, user text, token, storage content or performance data is written.
2. Entering a sheet state creates in-place same-URL history entries. Android Back/Forward navigates between existing states. Only a change of event/world/expanded content invokes a document rerender. Full ↔ research is a layout-only operation and **does not remount or restart Shock Replay**.
3. The **К СФЕРЕ** action consumes the in-app sheet history to return directly to compact without keeping ghost entries that reopen the dismissed document on Back. Opening Compare directly from `?mm=connections&event=1987` starts as research level zero and can be closed safely.
4. Event-year selection continues to use `history.replaceState`, so scrolling the four archival years does not flood the Back stack; world switches remain distinct history steps.
5. When browser history APIs are absent or blocked, controls retain their local in-place fallback. Existing test fixtures for such environments still pass.
6. Fullscreen now sets `scene.inert` and `switcher.inert`, with a runtime check for the EVENT header. A scoped `data-mh-sheet-state` on the app additionally disables pointer events for behind-the-reader globe, beacons, chronosphere and controls in CSS.
7. Full/research sheets have native vertical touch scrolling with `overscroll-behavior-y:contain`, `-webkit-overflow-scrolling:touch` and a nonconflicting, horizontally pannable Shock Replay date strip.

## Files

- `v10/market-history-modes.js`: history state snapshots, popstate reconstruction, explicit close and safe inert background.
- `v10/v20-three-state-sheet.css`: mobile scroll containment and fullscreen pointer guards.
- `tests/v20-android-back.test.mjs`: 6 tests using a model browser-history stack with real-looking URL changes, Back, Forward, timers and DOM actions. Covers fullscreen↔research playback preservation, explicit dismissal, world transitions, deep-link Compare, public-only state and background inert behavior.

## Verification

**32/32 focused source and simulated-DOM tests passed** at this commit stage (previous 26 plus new Android Back 6). A pre-existing HTML WebGL app was not rebuilt or redeployed. The browser-history tests use a deterministic JavaScript model of `popstate`, not an Android handset or a Chromium browser.

The following **remain unverified**: a full `npm test`, `npm run build`, Playwright, real Android WebView navigation gesture or Chrome UI, hardware device scrolling, physical landscape layout, Safari/iOS behaviour, and actual 3D rendering.

No main/production merge, no existing hosted service modification, no payments or secrets, and no reactivation of the disabled overnight automation.

## Next release gate

Run the integrated branch in an actual browser on Android portrait and landscape, verify native Android Back, gesture scrolling, back-forward transitions, WebGL fallback, focus and active-year marker clipping. Do not label V20 production-ready without these checks.
