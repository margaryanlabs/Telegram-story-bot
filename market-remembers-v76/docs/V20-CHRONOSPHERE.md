# Market Remembers V20 — Chronosphere Wayfinding
Date: 2026-11-06

Parent draft PR: #250, branch `feature/market-remembers-v20-integrated-review-20261106`.

## Goal

Make EVENT CORE a time-oriented research world rather than four anonymous stars. The existing WebGL EVENT renderer and the original PEOPLE world must remain intact. The time navigator is a **chronological index**, not a geographic or interval-scaled scientific time map.

## Committed implementation

1. In `v10/market-history-modes.js`, add a persistent `#mhChronosphere` navigation surface to the real EVENT scene. It is only present visually in `events` and `connections`, and remains hidden in `people`. Four entries are derived from the already-sourced `EVENTS` records (1907, 1987, 2008, 2020), not duplicated source data.
2. The navigator exposes one active year, title, archival date, and the short case description. Selecting any year via touch or click calls the existing `selectEvent` and globe `focus` machinery, independent of whether the star is currently on the visible hemisphere.
3. ArrowLeft/ArrowRight/ArrowUp/ArrowDown work directly on the navigator surface. The selected year retains focus and has `aria-pressed`.
4. In `renderBeacons`, the selected star gets the archived short case title beside its year. Other stars remain slim years. In `measure`, date labels flip to the left when they would otherwise clip the right screen boundary.
5. `v10/v20-chronosphere.css` provides a desktop chronology column, a compact horizontal mobile chronology, active marker hierarchy, 44–47px keyboard/touch controls, a short-screen compromise, a landscape layout and reduced-motion support. No PEOPLE renderer, shader or local-memory data was modified.
6. `index.html` loads the scoped Chronosphere CSS *after* Crisis Atlas, Replay and Compare, so the visual layer can correct older component styles without overwriting the other functionality.
7. Added `tests/v20-chronosphere.test.mjs` (six focused source-and-simulated-DOM checks): chronological provenance, PEOPLE visibility, all-year focus and keyboard access, replay/compare preservation, screen responsiveness, selected-beacon meaning and low-height clearance.

## Verification

- Existing prior Crisis Atlas / Shock Replay / Crisis Compare / integration checks re-executed in the same isolated JS/DOM harness.
- Current result: **22/22 focused checks pass** (5 Atlas, 5 Replay, 4 Compare, 2 integration, 6 Chronosphere).
- Updated event controller parsed as JavaScript in V8. CSS brace balance passed.
- Tests do **not** represent full Node `npm test`, build, Playwright or real Android/iOS WebGL visual confirmation. These checks remain outstanding.
- The 25-service Render Hobby ceiling prevented creation of a new isolated static preview; previous Vercel API deployment was blocked by daily quota. No verified V20 browser URL is claimed here.

## Next stage from master plan

V20-095: work toward mobile compact / mid / full evidence sheet without obscuring the globe, validate the portrait and landscape positions in a real browser, and avoid route/keyboard regressions.

No merge, production deploy, backend, paid infrastructure or automatic continuation from this commit.
