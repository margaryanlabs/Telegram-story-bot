# MARKET REMEMBERS V19 — FINANCIAL CHRONICLE

## Baseline
Based on the user-reviewed V18.1 PEOPLE Mirror preview (exact SHA `a088efdd40a5a99dc7aad548fdf4045efbfbd9bd`). The original PEOPLE 3D mesh, shaders, starfield, personal stories and storage are unchanged. Only EVENT CORE has been extended.

## Goal
Turn four dated points on a pretty planet into a useful, sourced, interactive research archive for traders. Keep the planet as the main scene; reveal financial evidence on demand. NO invented price charts, 2026 predictions, live trading signals or assumed causal edges.

## Eight research episodes (chronological)
- 1907 — banking panic, Federal Reserve History (unchanged).
- 1929 — stock market collapse, Federal Reserve History.
- 1987 — Black Monday, Federal Reserve History (unchanged).
- 1998 — near-collapse of leveraged LTCM, Federal Reserve History.
- 2008 — Lehman Brothers bankruptcy, FDIC (unchanged).
- 2010 — May 6 Flash Crash, SEC/CFTC.
- 2020 — March dash-for-cash/liquidity crisis, NY Fed (unchanged).
- 2023 — Silicon Valley Bank failure, FDIC.

All four original markers retain identical symbolic coordinates. Four new events use distinct points on the same visible archive hemisphere; coordinates are *conceptual archive positions*, not Earth geolocation. The sources are official institutional histories, statements or public reports.

## Visual information architecture
1. **PEOPLE-style planet** unchanged; four founding events retain their full labels. New research archives are smaller stars without always-visible labels. Any selected archival star receives its year label.
2. **Mobile compact research dock** retains the Events / Connections choice, adds a horizontal swipeable eight-year navigator; the selected year is scrolled toward the center. An unobtrusive historical signal/impact preview appears underneath.
3. **On selection**, the planet smoothly focuses the selected event and the compact summary updates. Opening detailed research is a separate, intentional tap on Подробнее.
4. **Expanded research dossier** shows institutional source/time, sourced headline/metric, What happened, three-stage chronology, mechanism of market transmission, observed historical market impact, and a clearly differentiated trader lesson.
5. **Connections** are editorial parallels based on shared themes, explicitly not causal evidence, and display at most four linked events so the interface remains readable.

## Implementation
- `v10/market-history-modes.js`: eight well-sourced event records with citation URLs, metric, impact, 3 narrative chapters and mechanism. Rendering/selection updated.
- `v10/v19-financial-chronicle.css`: light-weight scoped style layer for dots, horizontal rail, statistics and dossier progression.
- `index.html`: mounts one new CSS file after the existing PEOPLE-mirror palette, leaving the PEOPLE engine and shaders untouched.
- Tests: new Node data/scene contract checks and Playwright browser tests; older cases updated from 4 to 8 and 3 to 5 sections.

## Acceptance before deployment
- Node: `node --test tests/*.test.mjs`.
- Playwright: `npx playwright test --config=v10-playwright.config.cjs`.
- Physical Samsung Android screenshots: 390×560, 390×844, longer 428×926. No overlapping beacon labels, smooth horizontal timeline, selected star visible, research sheet scrolls, original PEOPLE works when switched back.
- Verify institutional source links, all 8 records, 3 stages each, four thematic links maximum.
- Measure framerate on the real handset, test WebGL fallback and prefers-reduced-motion.
- **Static source checks do NOT establish Android visual or performance acceptance**; keep PR draft and production unchanged until owner approves.

## Rollback
Leave V19 PR unmerged. Prior owner-reviewed V18.1 remains at `a088efdd40a5a99dc7aad548fdf4045efbfbd9bd`; earlier V16 archives remain intact.
