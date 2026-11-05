# Market Remembers V16 — Cosmic Finish / Owner feedback

## Exact approved baseline
Pinned source SHA: `a4fed684050d2ce033433f1145b26abc2608b62c` (V16 Precision Polish).
Do not import, merge, copy, or restyle from the owner-rejected V17.

## Visual problems reported
- Constant random-looking red movement on the sphere felt like noise, not a cinematic special effect.
- Deep-space background was underdeveloped.
- Event buttons were only decorative circles; interaction needed a premium deliberate visual response.
- Long dotted vertical line from selected 2008 to the research dock was distracting.
- Existing sphere composition, look, size, and PEOPLE world were explicitly approved and must be protected.

## Implementation
1. `v10/crimson-shaders.js`: retains V16 base material, silver reflections and globe shaders. Red hairlines are narrower, restricted to a rarer fault field and **static**. Removes time-modulated crimson ignition. A short shockfront on entering a world or explicitly selecting an event remains.
2. `v10/v16-deep-space.js`: single-pass Canvas2D backdrop, fixed-seed 112 sparse stars, blue-violet / plum nebula ribbons and optical arcs. Re-render only when scene size changes (ResizeObserver); no requestAnimationFrame or realtime background workload.
3. `v10/v16-cosmic-effects.css`: restrained cosmic light, deterministic starfield compositor drift, soft orbit optics, subtle signal nodes and responsive contrast. Dials down distracting continuous beacon pulse and animated connection dash.
4. `v10/v16-scene-director.js`: interactive event burst with two light rings and one brief flare; the old long full-height dotted connector is replaced with a `64px mobile / 86px desktop` curved signal arc shown only after a selected event and auto-hidden after ~820ms.
5. `v10/market-history-modes.js`: selecting any 3D beacon focuses the sphere, updates its event info and triggers the one-shot light burst. The dock stays compact until the person taps **Подробнее**; if research is already open, it remains open.
6. `index.html`: includes only the new standalone scene asset and CSS after the existing V16 precision polish. All original PEOPLE shaders, stories, archive, persistence and backend unaffected.

## Design principle
***Effects communicate an action or a property, never generate constant irrelevant movement.***
The sphere remains a recognisable V16 obsidian object. The background makes it float. Red is an intentional risk/event highlight, not a strobe.

## Verification
- Test static source contracts: `node --test tests/v16-cosmic-finish.test.mjs`, then `node --test tests/*.test.mjs`.
- Playwright via `v10-playwright.config.cjs`: `tests/v16-cosmic-browser.spec.cjs`, screenshots at 390×560, 390×844 and 1280×800.
- Physical Android phone review: confirm sphere visual unchanged, star field actually visible, red lines don't crawl/flicker, event tap produces a single finite ring, connector never stretches to dock, compact and expanded cards remain operable, PEOPLE untouched, no major performance regression.
- These browser tests must be **run** for visual acceptance; merely storing test code or passing syntax checks does not prove real screenshots.

## Rollback
Do not merge draft PR. Owner's pinned V16 Precision Polish remains available unchanged at `a4fed684050d2ce033433f1145b26abc2608b62c`.
