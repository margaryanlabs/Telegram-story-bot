# Market Remembers V20.4 — Three-state EVENT research sheet

Date: 2026-11-06. Isolated draft review branch: `feature/market-remembers-v20-integrated-review-20261106`, PR #250.

## Real implementation

V20-095 now has three explicit evidence-panel states:
- `compact` — a quiet source-linked case preview, with the globe and Chronosphere visible;
- `research` — a scrollable documented event case / 2008 Shock Replay / CRISIS COMPARE;
- `full` — a viewport-filling evidence reader on mobile, with `safe-area-inset-top/bottom`, fixed scrolling and 44px controls; a wider centered document surface on desktop.

The EVENT controller keeps `panelExpanded` for existing content-visibility behavior and adds `panelFullscreen` for layout only. `get sheetState()` reports the canonical three states. A full/half toggle changes the DOM class and accessible control states **without rebuilding the dossier**, so it preserves current Replay stage, timer/play state, scroll, and container DOM.

The buttons `НА ВЕСЬ ЭКРАН / УМЕНЬШИТЬ` and `К СФЕРЕ` and the Escape key create predictable return paths: full → research → compact. Changing year, switching to PEOPLE, and returning from Compare to the globe reset the full state and dispose of replay timers. The new mobile compact style hides the duplicate shock strip while preserving visible source access; the research state retains the original mechanisms.

## Changed files
- `v10/market-history-modes.js`: state and transitions, in-place resize, escape and focus behavior, cleanup.
- `v10/v20-three-state-sheet.css`: scoped desktop, mobile portrait/landscape, safe-area and reduced-motion rules.
- `index.html`: stylesheet loaded after existing Atlas, Replay, Compare and Chronosphere design layers.
- `tests/v20-three-state-sheet.test.mjs`: four new tests for a live 2008 Replay crossing view states, Compare↔PEOPLE, Escape, CSS/safe-area.
- Updated earlier Atlas/Replay/Compare integration test assertions to reflect the required two-dimensional cleanup (`panelExpanded=false; panelFullscreen=false`), without reverting intended behavior.

## Verification in connected runtime

**26/26 focused source and simulated-DOM checks passed**, across Atlas 5, Replay 5, Compare 4, integration 2, Chronosphere 6, and new sheet 4. This included the actual controller and Replay JS executed against a shared fake DOM, timers, scroll and keyboard events.

The tests first surfaced one real bug: leaving fullscreen for PEOPLE retained `.is-fullscreen` despite hiding the panel. The controller now explicitly cleans the DOM presentation; the issue was retested to PASS.

## Still unverified

- Full `npm test`, lint/build, Playwright, physical Android Chrome or iOS Safari, WebGL on/off visuals and mobile browser Back gesture.
- In-browser layout and actual CSS positioning (mocked tests cannot prove visual correctness). A separate verified preview has not been deployed because the existing Vercel quota and Render Hobby 25-service limit blocked new isolated deployments.
- No merge into base/main, no existing-service or production changes, no changes to private user data and no asynchronous automation was enabled.

Next: visual browser QA, mobile Back/scroll interaction, then further CHRONOSPHERE depth/era cues without invented historical time-to-distance scales.
