# Market Remembers V19 — Story-First Reader / Two-World Polish
Date: 2026-11-05

## Baseline and safety
- Exact parent: `a088efdd40a5a99dc7aad548fdf4045efbfbd9bd` (V18.1 historical-year visibility correction, PR #246).
- This is an isolated draft branch. Existing Render/production services and original PEOPLE shader remain untouched.
- No authentication, public story backend, payments, new analytics, private-data transfers, or fictional participation counts are introduced.

## PEOPLE — what actually changed
1. Flight-to-reader duration is 1100 ms rather than 1350 ms; timer, resume timer, and energy ramp agree. Reduced-motion path still opens the story immediately.
2. `v10/story-experience.js` displays **only supplied chapters**. Legacy examples with a summary and rule now show two actual sections rather than two invented empty chapters. Progress/navigation update to their true length.
3. A restrained provenance note explains when stages are not supplied. Source attribution and local-only link rules remain unchanged. For a user-provided four-stage record, all four original chapters remain intact.
4. Four **clearly marked fictional editorial stories** (QUARTZ, EMBER, HORIZON, VECTOR) now have full before/decision/consequences/remains arcs. The stories are authored examples, never real participant biographies or evidence of trading performance.
5. Added an art-direction stylesheet with deeper obsidian surfaces, less cluttered memory hero, more legible quote/chapter hierarchy, mobile-first padded reading, and a coordinated star opening animation.
6. The original PEOPLE GPU sphere, star identities, source-linked financial legends, thematic map, archive, memory paths, saved lessons and local creation/export are preserved.

## EVENT CORE — what actually changed
1. Selecting any date keeps the globe visible and the historical card **collapsed**. The user deliberately selects "Подробнее" to open the full researched dossier.
2. Compact teaser uses the existing event name and sourced event mechanism. The expanded record has an introductory context block, documented what-happened/mechanism/lesson cards and previous/next year buttons.
3. Clicking a different year collapses the dossier and refocuses the real 3D point. The four 1907/1987/2008/2020 years and existing sources are unchanged.
4. Timeline supports Left/Right keyboard navigation; re-rendering restores keyboard focus to the newly selected year or beacon.
5. The second WebGL context initializes only on first EVENT entry; active movement is capped around 30fps, quiet animation is about 12fps; hidden EVENT stops drawing as before. Canvas2D fallback now projects deterministic front-hemisphere stellar points with the same yaw/pitch as the beacon coordinates, instead of displaying a stationary flat-dot texture.
6. The original V18 mirrored PEOPLE sphere geometry and shader structure are preserved. No third globe, new unaudited historical facts, or false causal relationships.

## Verification performed
- Fresh GitHub readback after edits: parser checks for the inline app script and altered JavaScript modules; release layer and new JSX-free CSS asset referenced in document.
- Structural checks: four dated events retained, date teaser + manual full dossier wiring present, private local data paths untouched, and new front-end modules present.
- New `tests/v19-reader-worlds.test.mjs` and `tests/v19-reader-worlds-browser.spec.cjs` committed, older V10/WebKit/V16 assertions adapted to changed behavior, and V19 browser suite registered.
- **Not yet executed:** complete Node test suite, Playwright browser suite, real WebGL visual captures and Android hardware benchmark. GitHub-hosted Actions jobs did not start due to account billing/runner restrictions on the base branch.

## Release gate
1. Run from `market-remembers-v76/`: `npm ci --ignore-scripts && npm run lint && npm test && npm run build`.
2. Run `npx playwright test --config=v10-playwright.config.cjs` and `npm run test:webkit` where available.
3. Visually compare PEOPLE and EVENT at 390×560, 390×844 and 1280×800; check GPU shaders, offscreen/overlap, keyboard Back/return, private story creation and reduced-motion.
4. Check date button visibility in front hemisphere after 60 seconds, Canvas fallback, 2-world transitions and memory leak on 10 repeated switches.
5. Keep PR draft; do not touch existing production, V10 Render service or V7.4 preview until explicit approval.

## Product work still not solved by this release
- Public consented story publishing/moderation/account infrastructure.
- A larger, researched historical catalogue beyond four events.
- Physical Android and real-user quality validation.

## V19.1–V19.2 continuation (5 November 2026)
- The PEOPLE chapter reader now identifies a single unstructured summary as «Исходная история» and a supplied rule as «Практическое правило», rather than implying all examples are sourced pre-trade/decision/consequence accounts.
- Fictional PEOPLE examples offer one clearly marked **thematic analogy** to a dated EVENT CORE record; the route closes the reader and navigates to the universe before opening the referenced date. This is not a claim that anyone participated in the crisis. Personal/local entries do not get public-history relationships.
- Switching PEOPLE ↔ EVENT CORE pushes a browser history entry; selecting years updates the current entry. A popstate handler restores the world and selected year on browser/Android Back without creating a duplicate entry.
- Expand/collapse of the EVENT dossier resets panel scroll and restores keyboard focus. Escape collapses an expanded dossier, and the dated timeline supports left/right arrows.
- EVENT now supports two-pointer pinch zoom, a reachable header «Вернуть метки» camera reset, and cleanup of pointer state when leaving the world. This avoids trapping a visitor on the empty hemisphere after intentional rotation.
- V19-specific static tests and browser regression specifications cover these flows. Targeted static/source assertions and JavaScript parsing were evaluated successfully, but the full Node/Playwright suite and physical Android GPU validation remain **unexecuted** in this workspace.
- Preview constraints remain: Render workspace reached the Hobby 25-service limit; Vercel branches tied to the shared Telegram-story-bot repo may trigger unrelated preview projects. No separate MARKET V19 public URL has been asserted or verified.

## V19.3 performance and preview gate (5 November 2026)
- The EVENT renderer previously invoked requestAnimationFrame nearly 60 times/s, even when only painting about 12 times/s. It now uses one coalesced timer (active approx 33 ms, calm approx 82 ms) and schedules the next RAF only when due; input immediately clears a pending timer to restore responsiveness.
- Cancels both the RAF and idle timer when EVENT is hidden or its tab loses visibility; releasing a world also clears tracked touch pointers. While PEOPLE owns the foreground, EVENT no longer rebuilds its canvas mesh on resize or restores a hidden GPU context.
- New source-executed Node VM tests in `tests/v19-frame-scheduler.test.mjs` cover sleeping/no RAF spin, wake-on-interaction/no duplicate RAF, and hidden/inactive no-work. Also added browser pinch+reset regression for the EVENT sphere.
- A separately named Vercel project `market-remembers-v19-isolated-preview` was created in labsmargaryan's existing team, with build path `market-remembers-v76/`, no Git autorepository integration. Manual preview deployment was rejected by Vercel with HTTP 402 `api-deployments-free-per-day` (more than 100 free API deployments in 24h). Thus it has **no published V19 build or verified preview URL**. Previous previews remain intact.
- Render's Hobby workspace also rejected a new preview because it has 25/25 services. Neither block was bypassed by changing production or deleting services.
- QA run here: 14 targeted static/source invariants and JS syntax checks passed; 3 isolated scheduler behavioral scenarios passed after fixing a test-harness RAF stub. This is **not** equivalent to running the repository's complete `npm test`, Playwright/Chromium, WebKit, or testing an actual Android device. Full CI remains blocked by GitHub Actions' runner startup/billing issue.
- Release remains DRAFT. The next necessary gate is a clean preview deploy when capacity allows and actual two-world on-device browser testing.
