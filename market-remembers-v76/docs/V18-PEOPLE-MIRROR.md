# Market Remembers V18 — PEOPLE MIRROR / FINANCIAL DATES

## Product decision
The owner rejected V17 and the later V16 cosmetic remakes. **Do not create another new globe.** Directly reuse the original, approved PEOPLE universe's real GPU rendering geometry, volume, star field and interaction physics. Change **only** the EVENT universe color palette and replace story stars with financial event dates.

## Exact reference and rollback
Built from pinned V16 Precision Polish SHA `a4fed684050d2ce033433f1145b26abc2608b62c`.
Original PEOPLE core engine stays in the inline script in `index.html` entirely untouched. Existing historical event data, links, sources and research panel are unchanged. No production deployment, merge, storage migration or new backend dependency.

## What is actually duplicated
**Copied verbatim from the original PEOPLE inline script:**
- `coreVertex`: triangulated 3D sphere camera projection.
- `pVertex`: physical moving star and dust particle projection.
- `lVertex`: physical orbital/line projection.
- `coreFragment` up to its final `gl_FragColor` expression: same high/eco volumetric raymarching, cloud billows, rim, microfilaments, light and gold pockets.
- `pFragment`: same star point core/halo/occlusion, changed palette RGB values only.
- 30×46 mobile / 46×70 desktop sphere triangles at radius .955.
- Fibonacci 3D star/dust sampling with golden angle 2.399963229728653; 2 streamlines, inner shell, orbital guide.
- WebGL1 real depth occlusion, and Canvas2D fallback.

**Different only in EVENT CORE:**
- Core final RGB color remapping to silver-plum / mauve, without modifying volume geometry or lighting functions.
- Particle RGB palette becomes violet/pearl/pink, instead of People cyan/teal.
- Instead of PEOPLE stories, add four dated event stars: 1907, 1987, 2008, 2020, with the existing sourced event cards.
- Distinct muted space color and scene UI for event selection; old lava/crimson shader is not executed.
- Four fixed symbolic positions are passed through the event getter and projected with the exact PEOPLE camera and perspective formula.

## Files
- `v10/people-mirror-shaders.js`: exact six original GLSL strings copied from PEOPLE with only palette changes.
- `v10/people-mirror-planet.js`: separate render instance with same mesh and star data algorithm, existing V14-compatible MarketEventPlanet API.
- `v10/people-mirror-events.css`: color-only EVENT visual skin and 44px date-star buttons. No selectors target PEOPLE.
- `v10/market-history-modes.js`: read-only `p:[...p]` exported for event projection.
- `index.html`: replace only the two EVENT script includes; original PEOPLE remains byte-for-byte except appended stylesheet and changed includes.
- Existing V16 world transition is preserved.

## Quality gate
Static GitHub readback shows all new files and shader copy invariants. This does not mean a real browser rendered it:
1. `node --test tests/*.test.mjs`, especially `v18-people-mirror.test.mjs`.
2. `npx playwright test --config=v10-playwright.config.cjs` with chromium WebGL on.
3. Compare screenshots from PEOPLE vs EVENT at 390x560, 390x844 and 1280x800. Check same volumetric/cloud structure, not a new opaque circle.
4. Test date focus and panel; back to PEOPLE; Canvas2D fallback; reduced motion; browser navigation and physical Android GPU memory.
5. Visual owner acceptance before merging. Original pinned V16 preview remains unchanged.

## Risks
Heavy original PEOPLE volumetric shader may be expensive in Android with a second WebGL context. Only one renderer actively draws at a time; new EVENT uses ECO shader and DPR <=1 on phones. If a browser lacks WebGL1, the fallback is a simplified colored sphere; it is not pixel-identical to the GPU original. No additional camera source or real financial data feed has been added.
