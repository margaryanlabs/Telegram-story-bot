# MARKET REMEMBERS V20 — CRISIS ATLAS / scene card & people polish

Date: 2026-11-06  
Baseline: V19 draft PR #247, commit `d3036a936adae66fce0788fdff4df1246fd79167`.

## Delivered in this draft branch

- **EVENT CORE** is still the mirrored V18/V19 WebGL globe. Added a clear `01 / 04` case index, always-visible previous/next controls and preserved the four sourced financial-crisis records (1907, 1987, 2008, 2020). The arrows change the highlighted real globe marker and event card without automatically opening the larger dossier.
- **Source transparency** now appears in the compact card as a direct link to the existing source of the selected event. The three-stage causal chain is the already stored `event.mechanism`, not an invented chart or invented performance metric.
- **Keyboard/screen-reader navigation:** each quick arrow has a distinct accessible label. When the selected date replaces the card's DOM, focus returns to the same arrow direction; event detail remains an explicit `Подробнее` interaction.
- **Cinematic visual refinement:** new scoped `v10/v20-crisis-atlas.css` for the case-file treatment, legible chronology strip, authored source card, separated crisis mechanism and improved source cards in expanded detail.
- **PEOPLE:** upgraded desktop star quote card and mobile signal dock with larger touch targets, refined glass depth and more readable story title, while keeping the same personal stories, original 3D shader, save and route actions.
- **Mobile/responsive:** event case card and four-date picker remain accessible at 390px, with reduced density on short screens; a landscape layout stays in a side panel. Reduced-motion overrides included.
- **Regression:** added `tests/v20-crisis-atlas.test.mjs` to verify the HTML load order, known event IDs, preservation of sourced mechanisms, compact-mode behavior, quick navigation, keyboard focus and visual-layer scoping.

## Files
- `index.html`: load the V20 stylesheet after V19.
- `v10/market-history-modes.js`: case counter, circular prev/next navigation and source link, focus restoration.
- `v10/v20-crisis-atlas.css`: isolated EVENT/PEOPLE responsive design.
- `tests/v20-crisis-atlas.test.mjs`: regression guards.

## Verified in current connected environment
- GitHub file mutations committed and read back from the branch.
- JavaScript parser check for the complete updated `market-history-modes.js` passed.
- Source assertions passed for date controls, 4 events, sourced mechanism, focus restoration, CSS load order, mobile and reduced-motion breakpoints.

## Not verified yet
- The complete `npm test`, `npm run lint`, `npm run build` and Playwright/browser suite were not executed in this environment (GitHub Actions billing/runner restrictions and no checkout in local tool runtime).
- No live device GPU performance or 390px/desktop screenshots verified. These checks remain a release blocker.
- A Vercel live V20 preview is not yet confirmed; do not present any older preview as V20.

## Release boundaries
Keep draft. Do not merge or promote to existing production or active Render/Vercel project without an explicit go-ahead. No changes to auth, payments, privacy, stored memories, historical sources or WebGL engine.
