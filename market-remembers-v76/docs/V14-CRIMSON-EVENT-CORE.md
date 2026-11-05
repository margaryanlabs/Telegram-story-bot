# THE MARKET REMEMBERS — V14 Crimson Event Core

## Product decision
One product, two **separate visual worlds**, not three skins of the same planet:

- **PEOPLE** — the untouched V12 RC6 universe of traders, personal stories, human legacy and the existing archive.
- **EVENT CORE** — a new dark-crimson, basalt-like, procedurally rendered financial crisis world. It has two internal modes: EVENTS and CONNECTIONS.

This is a code implementation brief and release gate. It is not evidence that a phone/browser has rendered the result correctly.

## Exact base
- Based on the user-provided pinned V12 RC6 commit: `ef58c790f693a58a5090053f1ede4dcd3a007608`.
- V13 foundation is preserved only for the four sourced historical episode records and thematic connections.
- No modifications to production, `main`, existing person stories, storage contracts or original WebGL shaders.
- All work takes place in `feature/market-remembers-v14-crimson-event-core-20261105`.

## Architecture
- `index.html`: links new assets; parks the People animation loop when Event Core is active; exposes `window.MarketPeopleResume` to restart it on return.
- `v10/market-history-modes.js`: two-world navigation (PEOPLE / EVENT CORE), Events and Connections tabs inside Event Core, sourced events, thematic links and globe-projected beacons.
- `v10/crimson-shaders.js`: original WebGL1 procedural basalt/red thermal fracture shader; no borrowed texture and no old-globe CSS hue filter.
- `v10/crimson-event-core.js`: new planet Canvas + WebGL renderer + secondary Canvas2D fallback; separate rotation/camera, focus/drag/wheel and frame scheduling; transition hook and full-world header. The People renderer stays parked while this world is active.
- `v10/crimson-event-core.css`: VETO-inspired black/burgundy/crimson atmosphere and header, distinct panels, event beacons, world-transition overlay; scope to `app[data-mh-mode]`.
- `tests/v14-crimson-event-core.test.mjs`: source contract tests.

## Color contracts
- Background: #050507 / #0B070C
- Basalt shadow: #170D16
- Deep red: #542230
- VETO crimson: #A72D44 / #E34D6B
- Shock glow: #FF627B
- Primary text: #F6EEF0
- Evidence silver: #CFD7EA

Avoid flat neon red spheres, spaghetti-line artifacts and cosmetic smoke that obscures data. Red denotes financial stress and highlighted events, not a claim of risk magnitude.

## Interaction contracts
1. PEOPLE route shows original sphere unmodified; existing archive, reader, legacy and local storage remain functional.
2. Clicking EVENT CORE leaves the first world and presents second planet with separate header, crimson atmosphere and content pane.
3. EVENTS contains 1907, 1987, 2008 and March 2020 with explicit date/source and carefully delimited trader lessons.
4. CONNECTIONS draws only thematic connections among historical cases; never suggests evidence of real user participation or causation.
5. Clicking a year selects the event, focuses the new sphere, and updates the information card.
6. On PEOPLE return the original animation resumes at its retained state.
7. Mobile can move/zoom new planet with drag and keyboard controls for event selection; optional browser zoom only on wheel.
8. Reduced-motion setting disables automatic animation and preserves a static full scene; WebGL failure uses Canvas2D.
9. No new persisted data or backend requests.

## Acceptance gates (not yet fully verified)
- `node scripts/check.mjs` (full existing application check)
- `node --test tests/*.test.mjs` (full V12/V13/V14 test suite)
- Browser Chromium/WebKit: WebGL1 shader compilation and actual visual inspection.
- Samsung Android 360 / 390 / 430 px viewport and landscape, both high and reduced graphics.
- Verify no globe/hero/panel collisions, event beacons reachable, no touches hijacked.
- QA return to PEOPLE after 20 mode switches, explore, story reader, form/legacy and drawer navigation; confirm data unchanged.
- Test WebGL context loss and Canvas2D fallback.
- Verify memory pressure/average frame rate on constrained mobile devices.
- Avoid production deploy/merge until blockers resolved.

## Known limitations
- Event beacons are positions on a symbolic sphere, not Earth lat/long.
- Cross-event lines encode shared editorial themes, not statistical market contagion.
- No realtime API, AI claims, 3D satellite views or provenance ledger.
- The shader source is implemented; without a successful browser run, visual output is not independently validated.
- The user's linked pinned V12 is unchanged; V14 has separate immutable commit previews.

## Rollback
Return to `ef58c790f693a58a5090053f1ede4dcd3a007608` or keep V14 draft PR unmerged. Production unchanged.
