# Market Remembers V20.6 — collision-aware CHRONOSPHERE beacons

Date: 2026-11-06. Integration branch: `feature/market-remembers-v20-integrated-review-20261106`, draft PR #250.

## Problem

Previously, `measure()` flipped a projected event label to the left only if its x coordinate was close to the right screen border. It could not account for Chronosphere, the event research sheet, the world switcher, header, or competing projected years. Labels could stack on top of research UI or each other, especially during sphere rotation and mobile portrait.

## Implemented

- Added `v10/v20-beacon-layout.js`, a deterministic, small side-effect-free geometric solver. It accepts the REAL event planet's 2D projected positions and the current visible obstructions from `getBoundingClientRect()`, all normalized to `#scene` coordinates.
- Labels are placed in active-event-first order, then by year: `right / left` combined with `center / above / below`. A placement must fit the viewport, avoid the other accepted labels, and stay outside the actual Chronosphere, panel, switcher and event header rectangles.
- If no placement fits, only the text label gets `is-label-hidden`; the projected glowing star and its original `aria-label` remain unchanged. Years can always be selected in the persistent accessible CHRONOSPHERE.
- The source archival coordinates, source URLs and case contents, globe rotation/focus, PEOPLE renderer and WebGL shader are NOT modified.
- Added `v10/v20-beacon-layout.css` with just the above/below positions, hidden-label style and keyboard focus guarantee.
- Wired the solver before `v10/market-history-modes.js` in `index.html`; a missing module safely falls back to the prior right-edge placement.
- Added six regression cases in `tests/v20-beacon-layout.test.mjs`, including screen borders, competing stars, real rectangle blockers, vertical fallback, back-facing stars, invalid geometry, invariance under reversed input order and regression guards for research modules.
- Updated one older Chronosphere source assertion, which had assumed the original fixed right-edge algorithm.

## Verification in isolated connected GitHub runtime

**38/38 focused source and simulated-DOM checks passed** after the latest changes: Crisis 5; Replay 5; Compare 4; integration 2; Chronosphere 6; three-state sheet 4; Android Back 6; label decluttering 6. Parsed the added JS and scoped CSS.

These are **not** browser render tests, Playwright tests, hardware WebGL screenshots or a full repository `npm test` run. The real appearance, frame performance and potential label clipping in narrow Android devices need a real deployed preview and physical/mobile browser QA.

## Production release gates

- Build and all Node tests in a real checkout;
- real Android portrait + landscape and desktop WebGL vs Canvas fallback review;
- rotate to overlap labels, open Compare and fullscreen, use system Back;
- verify no touch/pointer interception over CHRONOSPHERE and 3D sphere.

No production merge/deploy, no new hosted service, no paid API, no re-enabled automation.
