# THE MARKET REMEMBERS — STARLIGHT V9 / R1+R2 (isolated preview)

This is the **next additive experience layer** built on the exact V7.5.3 code. It does not replace V7.4, the V7.5 engine, WebGL shader, star positions, stories, Memory Paths, or local browser storage formats.

## What changed
- Selected Memory Fragment: richer editorial typography, contextual mood chip, warm accent per story category, tighter button hierarchy and visual distinction between verified legends, fictional examples and private local stories.
- Archive: responsive museum-style records with visual category accents and explicit provenance labels. No fake member counts or fake portraits.
- Reading room: wider immersive desktop reader with the globe visible behind it, full-screen mobile reader, warm contrast, improved narrative rhythm and a lightweight reading progress rail.
- Branded microcopy: Market Remembers stands on its own while attributing the experience to VETO Universe. No new logo assets are required.
- Animated transitions honor `prefers-reduced-motion`. The original Canvas2D fallback and mobile pointer cancellation remain available.

## Baseline and isolation
- Baseline: `feature/market-remembers-human-legacy-v75-20261102` / `market-remembers-v75/index.html`.
- New file: `market-remembers-v76/index.html` (self-contained).
- The original `market-remembers-preview/human-legacy-v74.html` stays unchanged on its own Render publication.
- No deployment to existing V7.4 or V7.5 services.
- The demo stores visitor stories only in localStorage on the current origin, not on servers. Demo people are fictional, apart from independently sourced legend entries.

## Smoke checks
`node --test market-remembers-v76/tests/*.test.mjs`

This verifies inline JS parsing, required DOM controls and enhanced IDs, preservation of the original localStorage key, original WebGL engine, provenance labels, reduced-motion and mobile fallback conditions. Real-device GPU, touch and pixel-level quality still require manual QA.

## V7.6.1 — Memory choreography and accessible reading
- The selected story fragment transitions subtly when choosing a different star. Animations are omitted when the operating system requests reduced motion.
- Each story or verified legend gets a two-step reading navigator with direct jumps to its experience/context and lesson/editorial conclusion.
- The rail updates active chapters and read progress as the user scrolls.
- Changing story category changes only the memory-dive glow, not the particle sphere shader.
- Tab and Shift+Tab stay inside the active reader dialog, and the prior trigger regains focus on close.
- A lighter desktop reader scrim reveals the existing frozen globe rather than replacing it. Mobile keeps a fully immersive reader.

### Manual acceptance checklist (pending visual/real-device verification)
1. Desktop: open any fictional memory; visually inspect the globe behind the reader and both chapter buttons.
2. Desktop: Tab through all controls; Shift+Tab should cycle to the last control and Escape should close.
3. Mobile: open via star and bottom dock; chapter buttons and close control must remain usable.
4. Change to an official legend and confirm source attribution and both chapter labels.
5. Enable reduced motion: no fragment transition or motion-based navigation.
6. Check LENS, guided Memory Paths and My Legacy are unaffected.
7. Verify private local story provenance; do not suggest that a demo entry has been published globally.

## V7.6.2 — return to the selected star
- Closing a story reader aligns the camera to the *same* selected star, reveals its label, and performs a one-time restrained halo pulse.
- The pulse is suppressed for reduced-motion users and when moving directly into the next story/guide chapter. The animation cannot interrupt the existing story dive.
- Mobile uses the original compact signal dock for the return highlight. Reader close restores keyboard focus, falling back to the mobile dock or desktop memory CTA when the original archive item was replaced.
- No changes to shaders, underlying story content, localStorage format, V7.4, V7.5, or production deployments.

### V7.6.2 acceptance
1. Open memory; close via X and verify selected star is centered and gently pulsed.
2. Navigate to next memory: no spurious return pulse before the next dive.
3. Use the guided four-step Memory Path; each chapter stays in route order.
4. At 390px viewport ensure the return highlight appears behind the mobile signal dock.
5. With reduced motion enabled, return happens instantly without halo animation.
6. Escape closes reader and restores keyboard focus to a useful, visible control.

## V7.6.3 — responsive mobile composition
- Replaced a fixed percentage mobile globe projection with a stage measured **once per resize** from actual hero and signal-dock rectangles. Particle loops do not read DOM bounds.
- Landscape mobile uses a right-side theatre layout, leaving a left narrative/control column.
- Portrait mobile sizes the same original WebGL globe to the available vertical space, including short-height phones and foldables; desktop keeps its exact previous camera geometry.
- Mobile navigation and signal dock have warmer editorial contrast, touch-friendly controls, two-line quotes, and safe-area-aware bottom spacing.
- Front-side star controls respect the content-safe vertical band on portrait devices.
- No personal-data migration, shader rewrite, backend or publication of fictional demo stories.

### Layout acceptance cases
- 390 × 844: normal phone, hero / sphere / dock clearly separated.
- 390 × 620 and 320 × 568: sphere scales down without covering the hero or dock.
- 768 × 1024: foldable portrait with large but constrained sphere.
- 760 × 420: landscape theatre: story left, sphere right, controls left.
- 1280 × 720: unchanged desktop target center and radius.
- Focus mode keeps its immersive full-size sphere and original gestures.

### Verification
The source-level and isolated mock-interaction suite contains 21 cases and passed with JavaScript execution. These are not screenshot tests or a substitute for real-device WebGL/Canvas fallback QA. The GitHub-hosted workflow has been unable to allocate a runner on this account; it is separate from the local checks.

## V7.7 — Living Stories: editorial thematic threads
- Adds a *three-way* continuation block after each non-guided story reader: the same theme, a complementary discipline, and a distinct editorial viewpoint. Targets use the existing indexed star catalogue and original `beginDive(index)` animation.
- The selection is deterministic (same catalogue yields identical ordering); it never recommends the source record or duplicates.
- Private, user-saved local records are **never eligible targets**. A user's private story may recommend existing public-domain/fictional *demo content* but its text is never sent to an external service.
- The provenance for each target is explicit: sourced legend vs fictional example vs editorial fictional narrative.
- Four-step guided `MEMORY PATHS` do not display thematic continuation panels, protecting their chapter order.
- Reader navigation, star return animation, source citations, story data model and existing archive layout remain unchanged.
- This does not add a social graph, publish user content, invent personal relationships, or introduce backend/API calls.

### Acceptance cases
1. Open a fictional story, scroll to the end and see three theme-based continuation records.
2. Click a continuation: close the reader and fly to the chosen existing star, not a new generated star.
3. Open a sourced financial legend: source attribution and disclaimer must remain visible, followed by thematic suggestions.
4. Start a guided four-star Memory Path: the thematic section should be absent and the correct next chapter remains in control.
5. Open a privately saved local story: suggestions must contain only existing demo/editorial/verified records, never another local story.
6. Mobile: cards stack in one column and remain keyboard/touch accessible; reduced motion disables hover/transition motion.

### Automated checks
30 source-level + mocked DOM/camera tests passed via JS evaluation, including 9 new `living-stories.test.mjs` checks. These are not equivalent to mobile screenshots, a real WebGL test or a hosted CI run.

## V7.8 — Reversible editorial star trails
- Following a thematic recommendation carries a *temporary*, in-memory origin/destination and reason for the connection.
- The existing SVG travel line is restyled warmly during these hops; no additional WebGL draw pass or shader dependency.
- The memory-dive scene names both stars and the editorial reason for the link. The destination reading room shows a lightweight breadcrumb with one-tap return to the prior story.
- A back action clears the breadcrumb instead of creating endless loops.
- Hops into guided Memory Paths are disallowed; each route continues with its established four chapters.
- Navigating to Archive, My Legacy, or the creation form clears the temporary thread; leaving the reader clears it too. **Nothing is written to storage, sent to an API, published, or treated as a real relationship between people**.
- Private local aliases are shown as "МОЯ ЛОКАЛЬНАЯ ЗВЕЗДА" in the route context rather than exposing their name.
- Reduced-motion mode skips cinematic transitions as before; transition context is still accessible in the reading room.

### V7.8 acceptance cases
1. Open a fictional story and select a thematic recommendation. The dive scene should show the original and destination star and the reason.
2. Open the destination: confirm a breadcrumb explains the path and its return button opens the previous story.
3. From a destination, select another thematic recommendation: the breadcrumb should show the immediately preceding story only.
4. Go to Archive or create a personal story: prior thematic breadcrumb must not persist.
5. Use a 4-part Memory Path: normal chapters remain intact; thematic hops must not override it.
6. On a 320–390px phone, the new breadcrumb remains readable and the close/back controls stay accessible.
7. Reduced motion: no extra star-trail animation, and breadcrumbs/return controls still work.

### Test status
43/43 source-level, syntax and mock-interaction checks passed in the connected JavaScript test harness, including new `tests/thread-route.test.mjs`. This is not browser screenshot, physical-device, GPU or GitHub-hosted CI confirmation.

## V7.9 — Museum Archive editorial consolidation
- Replaced the old generic card archive with a single coherent, wider editorial reading collection, stronger typography, consistent graphite/ivory/violet visual language, spacious panels, and comfortable mobile one-column records.
- The archive header now derives **live totals** from the actual current catalogue: all records, sourced legends, browser-local/private recordings. No fixed “30 stories” claim.
- The search supports aliases, market, category, quotes, full-story text, remembered rule and source metadata. Search input and clear button preserve keyboard focus.
- Filter interactions no longer call `showArchive()` and do not recreate the drawer, reset the scroll position, or steal keyboard focus. Each filter exposes `aria-pressed` and the count of matches is announced with `aria-live`.
- The archive distinguishes verified citations from verified document headings, editorial fiction, fictional demo characters, and private local recordings.
- New illustrated empty state provides a one-tap, accessible reset to all stories and restores input focus.
- On narrow phones, filters form a horizontally scrollable chip line with touch-sized controls; record cards stack vertically.
- Subtle universe caption updated from the historical “V7.5.3 TRUE 3D CORE” to “V7.9 MEMORY CORE”, which remains truthful in the Canvas fallback.
- No shader rebuild, new API, production merge, storage schema change or actual public publishing.

### V7.9 acceptance
1. Archive opens with actual totals (including any browser-local records) and the matching-results counter.
2. Select Risk, then Legends, while scrolled down. Input stays focused, scroll position remains, and no archive shell recreation occurs.
3. Search by alias, market, quote, remembered rule, and legend source. Clear search; previous filter persists.
4. “Mine” contains only this device’s records; “Saved” contains only bookmarks; verified quotes remain distinct from fictional examples.
5. Empty results show a quiet explanatory state, and reset returns to All with focus on the search field.
6. At 320px–390px, the filter line scrolls horizontally and archive records remain in one readable column.
7. Open a record; original star dive, reader chapters, breadcrumbs and universe return must keep working.
8. Test with WebGL unavailable: Canvas fallback shows a neutral “MEMORY CORE” caption instead of claiming to render true 3D.

### Verification
53/53 syntax/source/mocked interaction tests passed, including 10 new archive tests in `tests/archive-v79.test.mjs`. Real-device browser visual/GPU QA and GitHub-hosted CI remain to be completed.

## V8.0 Release Candidate — stability and keyboard recovery

**Status:** Isolated review candidate, not production/GA. Continues the existing V7.4–V7.9 universe with no renderer rewrite.

### Real release blocker addressed
- The mobile browser viewport may change when the archive search field opens the software keyboard. Previously the global resize listener could regenerate the globe's WebGL/Canvas buffers **under the fully covering archive/reader**.
- `v8NeedsSceneResize()` computes if the stage size or device-pixel ratio actually changed.
- `scheduleResize()` now records covered-stage resize changes without regenerating geometry while the reader or birth overlay is covering the scene.
- `resumeScene()` performs at most **one** resize on return to the uncovered universe, and avoids any 3D work while a modal is still visible. If the mobile keyboard returned to the original viewport height, the unnecessary rebuild is skipped entirely.
- Explicit quality changes still call `resize()` directly and preserve user intent.
- Browser visibility regain respects the covered-state guard.
- Final focus outlines and ≥44px mobile reader/section navigation controls preserve readable, keyboard-friendly editorial interfaces.
- Memory Core caption updated to V8.0 RC, without claiming real 3D when Canvas fallback is running.
- Existing V7.9 archive search, private localStorage records, V7.8 thematic trails, all sourced legends and original GPU/Canvas fallback remain intact.

### Required final QA before merging
1. On Android Chrome and Telegram WebView, open Archive, focus search, type several queries and hide/show keyboard. No sphere-buffer rebuild should occur under the panel; archive search remains responsive.
2. While the keyboard is open, close the archive. Sphere and star markers should fit the restored viewport without a displaced selected-star label.
3. Rotate the device landscape/portrait while an archive/reader is open. Close it and confirm correct recalculation.
4. Repeat the same checks with WebGL disabled: Canvas2D fallback must render the actual sphere.
5. Test immersive focus mode, selected-star return, 4-step Memory Paths, next/previous memories and V7.8 breadcrumb return.
6. Confirm that V7.4 and V7.5 Render URLs still show their originals, and that neither site nor production changed.
7. Visually review on 320×568, 390×844, 768×1024, 760×420 and wide desktop, with normal and reduced-motion settings.

### Verification state
61/61 isolated JavaScript syntax, source and mocked-behavior tests passed, including eight new viewport/release tests in `tests/release-v80.test.mjs`. Native GitHub-hosted runner allocation and real-device/browser screenshot QA have **not** been confirmed. Draft PR must not be merged until that work is finished.

## V8.0 RC2 — BIG GLOBE / premium atmospheric lighting

This pass directly restores the user's preferred **big universe at first opening**, without replacing the original WebGL renderer or memory reader.

- **BIG by default**, on every page load. The chosen scale is transient and intentionally never saved to localStorage.
- New globe control in the original `world-controls` row: `◉ BIG → ◌ SMALL → ✦ MAX → ◉ BIG`, with screen-reader labels, on-screen announcements, and a gentle ease between radii.
- Portrait mobile radii now follow the viewport width instead of being capped by half the free height between the hero and story dock. Deliberate soft overlap is masked by the editorial gradients, not a reason to shrink the globe.
- Landscaped Android phones keep the right-side theatre composition with a larger sphere. Foldables and desktop now receive larger cinematic proportions while desktop bounds are clamped to the viewport.
- Immersive FOCUS is **larger still** and supports the same three size settings. Previous pinch-to-zoom, rotating star selection and mouse-wheel zoom are preserved.
- A lightweight, CSS-only globe aura is driven by the original camera projection from `updateAtlas()` — no extra WebGL meshes or draw calls.
- The halo breathes slowly with a soft outer ring and subtle orbit arc. Colors follow the **selected memory category**, including source-backed legends and editorial lessons, rather than cycling arbitrary colors.
- Reduced-motion users get a still aura and an immediate size change. The graphics LOW / adaptive ECO path disables the decorative halo orbit.
- Verified legends, privacy boundaries, local data keys, Memory Paths, thematic links, archive, desktop renderer and Canvas fallback remain intact.

### Geometry samples (BIG mode before manual zoom)
- 390×844: sphere radius ~177 px, previously ~158 px.
- 390×620: sphere radius ~177 px, previously ~100 px (old free-gap cap).
- 320×568: sphere radius ~146 px, previously ~70–90 px.
- 768×1024: sphere radius ~349 px.
- 760×420 landscape: sphere radius ~179 px.
- 1280×720 desktop: sphere radius ~331 px, previously ~281 px.

### RC2 QA
70/70 source, syntax, camera-geometry and mocked UI checks passed, including `tests/big-globe-v80.test.mjs` and updated responsive geometry checks. **Actual browser screenshots, Android WebView performance and production merge are not yet validated.** The original V7.4 and V7.5 sites must remain untouched; preview is isolated.

## ECLIPSE V8.2 — visual recovery experiment (DO NOT replace V8.0 preview)

This is a **distinct GitHub branch and distinct Render static service**, created because the user reported a serious visual regression in the preceding Big Globe release. The previous V8.0 RC2, V7.4 and V7.5 remain available as exact comparison baselines.

### Root-cause analysis
- The 3D core WebGL fragment shader is byte-for-byte the same in the original V7.4 and V8.0.
- V8.0 enlarged the mobile sphere up to 45.5% of the viewport width and added a CSS aura 3.1x the sphere radius, while re-enabling lens halo and energy sweep. Those produced a dominant dark disc and wide hazy rings, obscuring the attractive point cloud.
- Some later mobile rules accidentally used `.obsidian .app .hero` even though the HTML root is `<div class="app obsidian">`. Those rules could not match and silently failed to recompose the hero.

### ECLIPSE art direction
- Restore near-V7.4 sphere framing: 39.7% of screen width on ordinary portrait, 36% on short portrait, 36% of height on landscape; FOCUS uses the original approximately 49% mobile viewport width.
- Disable the `v81-globe-aura` and `energy-sweep` graphics layers, reduce lens halo to 2.5% and grid to 1.2%; remove the giant ring without touching real GPU stars.
- Restore the softer original V7.4 scene shading. Keep the core shader **unchanged** and the actual shader sphere/Canvas fallback untouched.
- Correct mobile CSS specificity to `.app.obsidian .hero`, tighten typography/navigation and add editorial contrast while retaining the site's original language and logo.
- Lighten the lower dock into calmer glass, preserve the functional BIG/SMALL/MAX, FOCUS, ATLAS and LENS controls and all V7.9/8.0 archival and memory features.
- No new backend, localStorage schema change, public sharing, shader pass, network dependency, or production modifications.

### A/B URLs
- Original V7.4 (preserved): https://market-remembers-veto-universe.onrender.com/human-legacy-v74.html?v=7.4&release=7c893384
- Previous V8.0 RC2 (preserved): https://market-remembers-memory-v76.onrender.com/
- New alternative ECLIPSE V8.2: https://market-remembers-eclipse-v82.onrender.com/

### Quality gate
78/78 source, mocked-interaction, geometry and source-comparison checks passed, including 8 new `tests/eclipse-visual.test.mjs` tests verifying WebGL shader identity, decorative ring removal and actually matching CSS selectors. No claim of physical-device screenshot/GPU performance testing. User's Android screenshot of V8.0 was used as the visual regression case.

## STARLIGHT V9 — implementation milestone (R1 + R2)

**This is real code, not a design brief.** The untouched ECLIPSE V8.2 remains the safety fallback.

### R1: native WebGL light & dimensional stars (implemented)
- Refined original `coreFragment` material within the **existing WebGL1 shader pipeline**, increasing directional fill and surface contours without a giant CSS halo, extra draw pass, imported game engine, or replacement image.
- Refined `pFragment` to preserve crisp near/far stars, selected-star brightness, rare violet/amber variation and subtle point falloff.
- Added `uPulse` uniform to the existing `passUniforms` function and focused illumination on the actual selected star position (`uFocus`), rather than an unrelated decorative ring.
- Kept actual sphere mesh + occlusion, original `generateParticles`, category/verified/source data and Canvas2D fallback intact.

### R2: STAR PASSAGE (implemented)
- `v9PhaseFor` and `v9Tick` now synchronize **lock (0-220ms), flight (220-1000ms), reveal (1000-1350ms)**, zoom and GLSL star energy inside the existing `animate()` render loop.
- `beginDive` / `finishDive` / `cancelDive` form a cancellable one-token story transition; rapid taps never open the previous story.
- Choosing a real indexed star opens that exact story after the transition. SKIP opens it directly; ESC cancels and returns to the existing universe; reduced-motion opens it instantly.
- A fixed, once-created group of 14 lightweight CSS spark points appears around the **actual projected star location**, not across the whole screen. No full-screen ring shader, runtime asset download, or extra GPU draw pass.
- The original archive, editorial connections, verified quote provenance, browser-local privacy and star return remain intact.

### Current QA
- 88/88 mock/source/geometry JS regression checks passed, including 10 new `tests/v9-starlight.test.mjs` state/reader/skip cases.
- Added `v9-playwright.config.ts` + `tests/v9-visual.spec.ts` for real Chromium screenshots at 320×568, 390×844, 760×420, 768×1024, 1440×900 and interaction smoke checks.
- To run screenshots from repository root with Playwright installed:
  `npx playwright test --config=market-remembers-v76/v9-playwright.config.ts`.
- **Important:** Chromium/WebGL 1 could not initialize a GPU context in the current local headless container (tested), and the remote browser automation wallet lacks credit. Therefore real Android/WebGL shader compilation, graphics performance and full-browser screenshot execution are **not yet verified**; do not merge to production without those checks.

### Explicit non-goals in this milestone
- No backend, private story uploading, public social connections, new library migration or Render overwrite.
- R3 contextual reader refactoring and R4 personal star creation animation remain on the master plan, not claimed as complete.
