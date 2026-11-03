# THE MARKET REMEMBERS — STARLIGHT V9.1 / R1–R4 + local archive protection (isolated preview)

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

## V9 R3 — Connected Observatory Reader (implemented)

The signature STAR PASSAGE no longer cuts into an unrelated-looking dialog. The destination story opens with a compact **observatory of the same selected star** inside the existing reader.

### Real implementation
- `v93ReaderInfo(record)` resolves the actual record's index, category, current star alias and factual provenance from the existing catalogue (and source metadata for legends); it never creates a replacement story or another person's fictional relationship.
- `v93MountReaderScene(record)` adds one calm telescope-like star field at the top of the reader using the **same source object's `p` coordinates** for its featured star. Seven tiny backdrop pinpoints are purely ornamental; they do not represent other users or real connections.
- Explicit provenance labels distinguish source-backed quotations from sourced document *titles*, editorial fictional narratives, fictional examples and browser-local private entries.
- The reader's intro includes a single immediate **“К ЭТОЙ ЗВЕЗДЕ”** control; this calls existing `closeDrawer`, restoring the real selected star with the pre-existing return pulse.
- The observatory inherits the actual category/legend accent, and the reading status follows existing `v76UpdateReader`: context → personal rule or editorial conclusion.
- On mobile the reader intro is limited to a compact ~132px block, with a genuine ≥44px return touch target. Fictional example silhouette is hidden to prevent duplicate visual hierarchy, but **real historical legend images and their credit links remain intact**.
- Quote reveal uses one restrained, reduced-motion-aware animation; no giant visual ring, separate fake artwork, backend request or extra GPU pass.
- All navigation through themed recommendations and four-step Memory Paths remains operative.

### Regression & visual review
- **98/98 isolated JS source, mocked DOM/camera and interaction tests passed**, including ten new cases in `tests/v9-reader.test.mjs` (real catalogue identity, source distinction, private data, keyboard action, and continuity).
- Added three additional Playwright browser scenarios to `tests/v9-visual.spec.ts`: mobile entry/return screenshot, narrow 320px viewport, and reduced-motion observatory.
- Playwright scenarios have **not yet been executed** on this hosted branch and physical Android WebGL screenshot QA remains pending. The remote metered browser has an insufficient wallet balance; this does not block static Render deployment.
- This milestone intentionally excludes R4 star-birth redesign, which remains a separate testable release step.

### Compare
- Updated STARLIGHT V9: https://market-remembers-starlight-v9.onrender.com/
- Frozen ECLIPSE V8.2: https://market-remembers-eclipse-v82.onrender.com/
- Frozen V7.4: https://market-remembers-veto-universe.onrender.com/human-legacy-v74.html?v=7.4&release=7c893384

**Please do not merge PR #220 until actual mobile visual/GPU review.**

## V9 R4 — Your Star / personal memory birth (implemented)

R4 completes the interactive narrative arc: **select a star → experience its story → write your own lesson → see your star form → find that actual persisted star in the universe**.

### What shipped in code
- Added `v94SeedFromId`, `v94NewLocalId` and `v94PositionFromId`: a unique local ID (native browser `crypto.randomUUID`, with legacy fallback) maps deterministically to one sphere position, which is saved with the story. Existing saved stars keep their original `p`.
- All private history still uses the **existing browser-only localStorage key** `veto-market-remembers-demo-v4`. No network upload, account, server-side sharing or personal social graph.
- `v94StoreLocal` now **must succeed before** the record is pushed into the live scene and birth animation begins. If localStorage is blocked or full, the form stays open, no birth is claimed and the user receives an error.
- The original 3D star enters the same existing scene/markers/particle catalogue; `v94PrepareBirthField` builds a deterministic one-shot **48-point (24 in LOW/ECO) CSS coalescence** at the new star's actual camera projection, updated by `v94UpdateBirthField`.
- The original small comet remains part of the journey. No second WebGL render pass, bulky full-screen CSS rings, new animation library or backend.
- On completion, a quieter local-only birth dialogue explains that browser storage can be cleared. **“НАЙТИ МОЮ ЗВЕЗДУ”** dismisses the dialogue and returns the user to that selected star on the real globe; **“МОЙ ЛОКАЛЬНЫЙ АРХИВ”** opens the existing personal archive.
- ESC dismisses the birth dialogue to the same star rather than leaving a paused renderer; reduced-motion users get the complete saved experience without animation.
- Creation no longer needlessly calls `generateParticles()` twice after changing the lens, helping Android performance.
- First entry and return preserve the existing sourced-vs-fictional provenance, categorical star color, chapter navigation and selected-star return behavior.

### Acceptance cases
1. Submit a private memory with explicit consent, see particles gather at one selected star, see the *local-only* birth confirmation, then press **“НАЙТИ МОЮ ЗВЕЗДУ”**.
2. Refresh the page: open Archive → Mine → the new star; its ID, 3D position and exact story must match.
3. Temporarily deny localStorage writes: the form must stay visible, the memory catalogue must remain unchanged, and no success state may appear.
4. Select LOW graphics: use at most 24 birth particles; reduced-motion mode: no birth particles or 2.45-second wait.
5. Open other stories after creation: prior V9 Star Passage, R3 observatory and existing historical attributions must remain correct.
6. Android 320×568 and 390×844: no dialogue overflow; both completion actions retain 44px+ tap targets and safe-area padding.

### Verification and limits
- **116/116 isolated JS source, mock DOM/behavior, privacy, persistence and projection tests passed**, including 18 tests in `tests/v9-birth.test.mjs` and an expanded browser script `tests/v9-visual.spec.ts`.
- The Playwright browser tests are provided for execution but **have not been run in a real Chromium/WebGL browser here**. The external metered browser wallet was insufficient. Device screenshot/graphics/keyboard QA is still an acceptance gate. This is a draft review candidate, not production approval.
- Comparison original ECLIPSE: https://market-remembers-eclipse-v82.onrender.com/ 
- Isolated V9 review: https://market-remembers-starlight-v9.onrender.com/

## V9 Release QA — opt-in Android device diagnostics (implemented)

We are now in **stabilization**, not adding visual decoration, and the user's screenshot of V8.0 remains the primary warning against blind changes.

### On-device check
- Normal public preview remains **unchanged**: https://market-remembers-starlight-v9.onrender.com/
- Optional diagnostic version: https://market-remembers-starlight-v9.onrender.com/?qa=1
- A collapsible **QA / DEVICE** panel shows renderer (WEBGL1/CANVAS2D/unavailable), actual viewport and GPU buffer sizes, device pixel ratio, sampled animation-frame FPS, graphics quality/ECO, reduced-motion status, current navigation state, and counts of WebGL context losses or fallback events.
- Copying the QA panel is a **direct local clipboard action**. No server call, new localStorage writes, tracking script, screenshot upload or personal story ID/text ever enters the report. A screenshot can also show the panel; users should avoid including personal story contents in screenshots.
- The panel is entirely absent visually unless the exact URL query parameter `qa=1` is set. It uses existing code/DOM and adds no rendering work to the regular production view.
- Frame sampling uses `requestAnimationFrame` timestamps, not fake performance claims. Under the reader the GPU rendering is intentionally parked, so the displayed FPS is the **last active sample**, not a live measurement from a hidden scene.

### Genuine defect fixed
- The last V9 R4 birth particles were configured for up to 1870ms animation plus 650ms delay (2520ms total) but the confirmation opened at 2450ms. Reduced the animation to 1750ms, allowing even the last particle to finish before confirmation (~2400ms total). No new graphics layer.
- Added 10 focused source/mock-UI tests in `tests/v9-qa-hud.test.mjs`, plus two opt-in QA Playwright browser scenarios.

### Verification state
- **126/126 isolated source, syntax, mock DOM, navigation, privacy and timing checks passed**.
- A headless Chromium 144 browser was run locally with a mobile viewport and can render ordinary DOM. In this environment it **cannot initialize WebGL**, and the live Render URL is unreachable from the local container; therefore this does not constitute a rendered screenshot/real Android GPU verification of the full application.
- The external metered browser automation provider is unavailable because of insufficient wallet balance. No charge is needed for the site or this QA mode.
- Final release gate: open `?qa=1` on a real Android browser, verify the renderer and frame-rate, then test one passage, one reader return, one locally saved star birth, archive re-entry, and page reload. Capture visual evidence at 320×568 and 390×844 before merging the draft PR. Preserve ECLIPSE V8.2 and V7.4/8.0 comparison baselines.

**No automatic deployment or production merge is enabled.**

## V9.1 — Personal archive preservation / no silent memory deletion

This pass responds to a real data-preservation problem, not a visual effect request. The former `v94StoreLocal()` **silently truncated personal stories at 40** and `safeStored()` also hid earlier entries. Those slices have been removed. A failed browser storage write still leaves the existing stored archive untouched; quota limits may prevent new stories, but old ones are not intentionally evicted.

### New: export + restore, entirely offline and local
- Existing `MY LEGACY → ЭКСПОРТ JSON` continues exporting all personal stories and local 30-day check-ins.
- **ВОССТАНОВИТЬ JSON** now appears in both empty and populated MY LEGACY screens. Users can take a backup file to a new browser or device and import it. No file upload, account, server, telemetry, or publication.
- `v95NormalizeBackup` checks that the source is an actual local-only backup, validates IDs, positions and record fields, rejects duplicate/corrupted entries, ignores unknown/unsafe check-in statuses, and bounds file import to 5 MB.
- `v95ImportBackupData` merges on stable star IDs: previous stories never overwrite or disappear; known entries are not duplicated; locally newer discipline marks win on conflict.
- If the first localStorage write succeeded but writing the second key fails, import attempts to roll back the original archive. Failure is disclosed, never silently presented as success.
- The import asks for explicit confirmation and reloads the same page only after a successful merge. Previously exported JSON files using `{demo:true,localOnly:true,stories,checkins}` remain compatible.
- Import test scenarios include empty-browser restoration, corrupted-file rejection, 41+ stars, duplicate-ID handling, conflict precedence and storage failure recovery.

### Important limits
- This protects **future** saves; already-evicted records from prior releases can only be recovered from an earlier JSON export, if one exists.
- The backup file contains private stories, so users must store it securely. There is no end-to-end sync or cloud storage.
- Browser or device clearing deletes local storage unless an independent copy exists.
- **138/138** isolated JavaScript parsing, source, geometry, DOM/mock-interaction and storage-regression checks passed, including 12 new checks in `tests/v9-backup.test.mjs`.
- Two new Playwright scenarios in `tests/v9-visual.spec.ts` cover import to an empty archive and rejection of a corrupt file, but **have not been executed in a real WebGL-capable mobile browser**.
- Keep PR #220 in Draft. No changes to ECLIPSE V8.2, original V7.4/8.0 previews or production.


## V9.2 — Archive integrity and multi-star navigation (2026-11-03)

Changes on the **same isolated V9 STARLIGHT Draft PR**; frozen V7.4, V8.0, V8.2 and Vetogram production remain unchanged.

- **MY LEGACY navigation:** when the browser contains multiple personal stars, a compact labeled selector switches the active star, including its own rule, capsule and 30-day discipline tracker. Each option renders the local alias/ID safely.
- **Fresh writes across tabs:** new personal stars are appended to the latest localStorage snapshot, not the page-load copy; a stale tab refuses to resurrect deleted records. Malformed, duplicate or invalid-position records fail closed rather than being silently overwritten.
- **Fresh JSON export:** retrieves the current persisted personal stories and check-ins, with an explicit error if the data is malformed.
- **Safer JSON restore:** merges against the current browser archive rather than the stale `saved` array, prefers the latest local check-in on conflicts, preserves stars created in another tab, and reloads the page when check-ins changed even if no new star IDs were imported.
- **Vector safety:** restore rejects finite coordinates whose combined magnitude overflows to infinity.
- Added `tests/v9-archive-integrity.test.mjs` (9 focused regression cases), and aligned existing V9 backup/birth fixtures with fresh-storage semantics.

**Verification:** Main inline JavaScript parsed successfully, and 8/8 targeted source-level function/behavior checks were executed successfully in an isolated JavaScript harness. This is **not** equivalent to running the full Node test suite or Chromium/Android visual QA. GitHub Actions runner was not assigned steps in the latest observed failed run, so CI success must not be claimed. Keep PR #220 Draft until runner-level tests and real Android GPU/visual review are completed.

Review URL (manual Render deploy, autoDeploy OFF): https://market-remembers-starlight-v9.onrender.com/


## V9.3 — Suspended passage, real-star anchoring, mobile touch/paint budget (2026-11-04)

The same V9 STARLIGHT project continues on isolated Draft PR #220 with ECLIPSE V8.2 as visual baseline. The original V7.4, V8.0, V8.2 and Telegram/Vetogram production code and Render sites remain unchanged.

### Behavior improvements
- **Suspended passage:** hide the browser mid-flight and the 1.35-second STAR PASSAGE pauses instead of silently opening the reader while backgrounded. The CSS star flare/progress animations are paused in sync with the JS flight clock. Returning to the page restores the paused elapsed-time clock and schedules the remaining passage on the **same selection token**. ESC/cancel invalidates it.
- **Correct first frame:** the transition CSS position is now projected synchronously from the **actual selected star** when the overlay first appears, avoiding a flash at a generic fallback center.
- **Lower mobile DOM cost:** HTML star-marker projection/placement runs at about 30 Hz on mobile during animation, while WebGL/Canvas retains its own normal frame cadence. Direct pointer/selection/resize marker updates remain immediate.
- **Larger touch targets:** mobile dock buttons are at least 44px, top navigation at least 40px, and portrait scene controls 42px (39px in short portrait screens). No additional large halos or rings; preserve ECLIPSE original visual identity.

### QA and release boundaries
- 4/4 targeted simulated **shared-state** STAR PASSAGE tests passed: correct selected identity and first-frame anchor; no background reader opening; resumption with same token and remaining time; cancelled passage stays cancelled.
- Full inline application JS passed a syntax parse; new V9.3 mock tests were added to `v9-starlight.test.mjs` and browser scenarios added to `v9-visual.spec.ts` for passage anchor and narrow/mobile tap geometry.
- **Not yet verified:** full Node suite, on-device Chrome/Telegram GPU frame time, actual phone screenshots or Playwright browser runs. GitHub Actions still needs an available runner. Keep draft PR; do not merge to production.
- Static preview uses the existing isolated https://market-remembers-starlight-v9.onrender.com/ Render service with autoDeploy OFF; manual deployment required after code changes.


## V9.4 — Viewport-aware mobile composition and foreground render recovery (2026-11-04)

**Same isolated STARLIGHT / PR #220.** This is a refinement of the existing WebGL1 sphere, Canvas fallback, ECLIPSE palette and real content. No replacement mockups, new GPU pass, CSS orbital rings, paid features, private upload, production merge or modification of frozen V7.4/V8.0/V8.2 sites.

### Code changes
- **Measured portrait framing:** `v9PortraitFrame(width,height,heroBottom,dockTop,nominalRadius)` uses the actual available band between the hero and signal dock only when it exceeds 1.85 × the baseline sphere radius. With room, it centers and fits the original sphere to avoid headline/card overlap. On crowded short screens, it preserves the approved ECLIPSE camera size/position rather than collapsing the globe into a tiny dot. Landscape, desktop, and FOCUS geometry remain untouched.
- **Floating selected-star label:** hides the auxiliary alias chip if it would intrude into the hero; the dock remains visible and fully operable.
- **Background and reader recovery:** track the pending requestAnimationFrame handle; cancel it on tab hide, schedule a clean frame on return, and skip rendering if the reader or personal star dialog covered the scene before the frame executes. V9.3 STAR PASSAGE pause/resume remains unchanged.
- **Opt-in device QA:** `?qa=1` now reports the **orb's screen center/radius** and portrait safe band (MEASURED or ECLIPSE fallback), enabling review of actual Android layout dimensions. These are screen geometry, **not personal-story star coordinates**. No personal aliases, text, IDs, backup files or telemetry are included.

### Regression and release gates
- Updated `tests/mobile-layout.test.mjs` and `tests/eclipse-visual.test.mjs` for dynamic portrait framing; added layout, label, RAF tests; extended QA HUD mock assertions and Playwright screenshots at 390×844 and 320×568.
- 10/10 focused scene syntax/geometry checks passed for tall/short portrait, landscape, tablet, desktop, FOCUS, focus-label exclusion and RAF scheduling. A further 11/11 final source/QA tests passed, including a simulated opt-in QA output. These are **local JavaScript source-level and simulated checks, not the full Node suite, a real Chromium screenshot, or a physical Android GPU run**.
- GitHub Actions remained unavailable on earlier observed runs. PR remains **Draft**. Physical Android WebGL/Canvas visual and interaction approval, accessible zoom, touch behavior and narrow-screen screenshot review are still required before any merge.
- Review preview: https://market-remembers-starlight-v9.onrender.com/ ; device diagnostics: https://market-remembers-starlight-v9.onrender.com/?qa=1 (Render autoDeploy OFF, manual publish).


## V9.5 — Luminous mesh, Canvas depth parity and Observatory readability (2026-11-04)

This is another **incremental change on the existing STARLIGHT branch** and Draft PR #220. The existing VETO WebGL1 triangulated sphere, ECLIPSE V8.2 stage composition, category signal colors, original story archive, history and local-only storage remain intact. No replacement hero illustration, pseudo-globe, new Canvas layers, giant rings, dependencies or external server were introduced.

### Existing universe, improved
- **WebGL1:** a subtle second directional bounce-light term in the *existing* core fragment shader (`coreFragment`). The original surface texture, main illumination, mesh/depth draw order, view, star categories and shader architecture are unchanged. This is a material adjustment, not a new GPU pass. Visual appearance still requires real WebGL hardware QA.
- **Canvas2D fallback:** a new `v95FrontStoryProjection` rejects named stars that project onto the back hemisphere, offscreen positions or invalid values. The fallback no longer visibly leaks a story star through the opaque graphite sphere. It retains `lensMatches` and selected story targeting.
- **Observatory reader:** narrow-screen grid adjustments and readable long text, aliases, rules and local notes using `overflow-wrap`, typography and tighter layout within existing components. Reduced-motion chapter navigation now uses standard `scrollTo({behavior:'auto'})`, while other readers retain smooth transitions. No personal data flows beyond the device.

### Tests and release gates
- Added `tests/v95-material-reader.test.mjs` with seven targeted shader, Canvas visibility, backface rejection, private archive and Observatory markup assertions. **7/7 tests passed in an isolated JavaScript execution harness**, using source extracted from the current GitHub file. This is not the full Node test suite.
- Added Playwright scenarios for forced WebGL → Canvas fallback at 390×844, reader return, and a long local story at 320×568. The scenarios **have not been executed in a real Android/WebGL browser** and their screenshot appearance is not verified.
- Keep PR #220 Draft and autoDeploy OFF until physical Android/GPU/Canvas and browser regression QA is completed. Frozen V7.4, V8.0, V8.2 previews and Vetogram production are untouched.

Manual Render review link: https://market-remembers-starlight-v9.onrender.com/


## V9.6 — One star, one continuous reader journey (2026-11-04)

STARLIGHT continues in **the existing isolated branch** and Draft PR #220. The native WebGL/Canvas globe, ECLIPSE visual silhouette, real stories and local-only archive remain unchanged; no replacement demo, extra 3D scene, customer telemetry or production merge.

### Product work
- **Reliable focus on arrival:** the 1.35-second STAR PASSAGE now hands off directly into Observatory without focusing the underlying dock in between. An active hidden `SKIP` button is never saved as the reader's keyboard return target.
- **Return to the same star:** reader close restores focus to a connected/visible origin (selected marker when appropriate, otherwise the mobile dock, desktop open control, or FOCUS control). Removed archive cards, hidden overlay controls and unusable elements are rejected; scene-star return pulse remains controlled by explicit `skipReturn === true` only for internal transitions.
- **Explicit click handlers:** scrim, X close and story-back handlers call `closeDrawer()` without forwarding native events as navigation flags. The earlier implementation already protected against this with a strict comparison; this change makes the contract explicit.
- **Visual continuity:** only the *actual passage-to-reader* route applies a 7px/520ms eased arrival to the existing Observatory content, disabled for `prefers-reduced-motion`. No atmosphere halo, GPU pass or new HTML scene. Mobile chosen-star alias is announced politely to assistive technology.
- **Escape/cancellation:** still cancels the selected passage, restores the active globe controller, and never opens an obsolete story. Thread and journey selection semantics remain intact.

### Verification and deployment boundaries
- New `tests/v96-continuity.test.mjs`: **12/12 targeted isolated shared-state tests passed**, including completion, stale token, Escape, hidden SKIP, removed archive card, FOCUS, reader close, synthetic click event and explicit internal skip.
- Five prior test files (`v9-starlight`, `v95-material-reader`, `mobile-layout`, `v9-qa-hud`, `eclipse-visual`) ran in the same isolated V8 test harness: **51/51 passed**.
- Added Playwright scenarios for passage→reader→same star at 390×844, Escape cancellation, scrim return at 1440×900 and reduced-motion entry. These **remain unexecuted in a real browser/Android GPU**. Isolated JavaScript mock success is not a substitute for full Node.js, Playwright, physical device or visual sign-off.
- Production/main and frozen V7.4/V8.0/V8.2 Render services untouched. Keep PR #220 Draft; keep preview `autoDeploy=no`.

Preview: https://market-remembers-starlight-v9.onrender.com/ ; device diagnostics: https://market-remembers-starlight-v9.onrender.com/?qa=1
