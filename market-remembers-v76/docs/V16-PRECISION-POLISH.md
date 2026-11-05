# Market Remembers — V16 Precision Polish

## Baseline and scope
Pinned starting commit: `05b80b9cd4c6cb54ac3f7f97f485bb7f28bbe86b` — the **V16** variant that the owner explicitly restored after rejecting V17.
This branch ONLY refines V16 EVENT CORE; do not merge or cherry-pick V17 into this work.

## Non-negotiables
- PEOPLE retains the original V12 sphere, stories, forms, archive and all persistence.
- EVENT CORE keeps the existing V16 structure, globe, black/crimson VETO palette, historical records, events ↔ connections mapping, 3D placement, mobile compact/expanded behavior, V16 world transition and performance tiers.
- No new source dependencies, backend services, AI-generated data or production updates.
- If the new polish is less attractive or has measurable regressions, use the pinned V16 link unchanged.

## Implementation
### Shader: conservative, same algorithm
`v10/crimson-shaders.js`
- +moderate midtone lift to the same obsidian alloy, slightly stronger cool Fresnel edge and controlled specular highlights.
- Original red stress-seam topology, procedural noise, camera rotation, shock pulse and GPU complexity are unchanged.
- No new permanent bright red areas, no procedural light flood.

### Decorative and interface polish: removable enhancement layer
`v10/v16-precision-polish.css`
- Deepens the existing navy/black background with faint burgundy and slate radial depth; small sparse stars and low-opacity nebula.
- Preserves V16 glow/orbit geometry, raises optical contrast and adds two very slow, opacity/transform-based ambient movements.
- Tightens financial-probe markers and selected-node ring, keeps 44px touch target and 3D anchor.
- Improved research dock border, typography, selection chips and three distinct evidence modules.
- Restricts mobile expanded panel to min(66dvh, 535px) (64dvh on short phones), allowing the upper sphere to remain visible and the card to scroll.
- Refines the V16 passage iris and convergence without changing its timing.
- A restrained dashed SVG signal flow appears in CONNECTIONS only; reduced-motion disables it.
- No selectors change original People globe/drawer/story components.

### Safety and verification
`tests/v16-precision-polish.test.mjs` covers asset order, V16 material identity, isolated People world, original scripts and accessibility.
`tests/v16-precision-polish-browser.spec.cjs` targets 390×560, 390×844 and 1280×800, captures snapshots and verifies compact/full dock and world return. Registered in `v10-playwright.config.cjs`.
Original `v16-signal-observatory.test.mjs` updated to test the rim *behavior* without freezing its prior exact RGB constant.

Expected acceptance before merging:
- Run `node --test tests/*.test.mjs` and `node scripts/check.mjs` at `market-remembers-v76`.
- Run `npx playwright test --config=v10-playwright.config.cjs` in a browser environment with WebGL / Canvas2D test.
- Inspect Android screenshots, 30fps target in an in-app browser, touch/zoom, reduced-motion and brief world-switch stress test.
- Compare with pinned V16. Visual preference is an explicit release gate, not something that static tests can prove.

## Rollback
Do not merge the draft PR, or revert the change commits. The original exact V16 preview and all production services are unchanged.
