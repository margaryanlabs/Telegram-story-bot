# Market Remembers V17 — AETHER / FINANCIAL OBSERVATORY

## Change in approach
Screenshot-driven correction after the user's 10:08/10:09 Android captures (5 Nov 2026).

Instead of iterating on red/black color values, V17 uses three independent systems:
1. **SCENE** — materially readable silver-blue titanium/obsidian planet with restrained VETO crimson fault traces, focused active-event glow and deep structured sky.
2. **FOCUS** — a selected historical event remains on the visible face of the globe; choosing another year reorients the sphere without forcing the research view open.
3. **RESEARCH** — a compact, useful dock containing title, Events/Connections and four historical years; a separate intentional immersive research view opens only when requested.

## User-observed V16 defects addressed
- V16 planet remained dim and smoky; V17 raises medium-tone plate luminance, soft key/fill and rim light, modest silver specular cues.
- Other year points were visible while the selected 2008 marker moved behind the sphere during idle 360-degree rotation. V17 focuses the selected episode on entry and uses gentle +/-2.4-degree idle sway instead of endless spinning.
- Old selected marker resembled a UI pill; V17 continues 3D-anchored nodes and ties a localized glow to the material at the selected coordinates via uActivePos.
- Backdrop was nearly empty; V17 uses low-cost layered gradients and sparse stars with constrained animated optics.
- Mobile expanded sheet seemed like an oversized modal inserted on top of the globe; V17 separates a compact scene-first research dock with four directly selectable years from an explicitly opened scrollable research stage.
- Large duplicate event title in expanded view removed.

## Technical changes
- Shader: v10/crimson-shaders.js — WebGL1 precision fallbacks; responsive alloy reflectance with two lights, layered low-cost procedural relief, localized stress/fault accents, active event light and restrained silver atmosphere.
- Engine: v10/crimson-event-core.js — new uActivePos binding, stable camera anchor on entry and after event focus, measured compact dock collision correction for Android browser chrome, brighter Canvas2D fallback.
- Modes: v10/market-history-modes.js — selectedPoint getter, scene-first event selection (no automatic panel expansion), return-state cleanup, explicit research header.
- CSS: v10/v17-aether-observatory.css — richer layered space atmosphere, silver-blue optic geometry, low-noise event microbeacons, mobile four-year dock rail, immersive research-on-demand with semantic cards, reduced-motion support.
- Existing v16 cinematic portal and People archive left intact. Original v12 People renderer, stories, local storage, backend and production are not modified.

## Historical data honesty
- The four markers refer to editorially selected 1907, 1987, 2008, 2020 events. Coordinates are symbolic surface positions and not actual Earth latitude/longitude.
- Connections encode shared editorial topics; they do not prove causality or participation by real people.
- Event record/source content stays unchanged. No fake historical numerical chart, ML forecasting or trading signal was introduced.

## Quality gates
The source checks and JS parsing can be performed immediately from GitHub fetch and review. Full browser tests require a running site with WebGL, the Playwright suite and screenshot inspection.
- node --test tests/*.test.mjs
- node scripts/check.mjs
- npx playwright test --config=v10-playwright.config.cjs
- Mobile 390×560 / 390×844 / 428×926; desktop 1280×800.
- verify selected 2008 node is visible after initial load; event chips stay interactive without opening dossier; mobile globe not obscured by dock; full research can close; People state returns unchanged.
- verify on-screen frame rate and shader compilation on physical Android; run Canvas2D fallback check.
- compared screenshots must be approved before merge. Passing static checks is NOT visual approval.

## Rollback / release safety
Separate draft V17 branch based on V16, not merged to production. Original user's pinned V12 and V14/V15/V16 revisions are retained.
