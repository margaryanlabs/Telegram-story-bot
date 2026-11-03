# THE MARKET REMEMBERS — V9 / LIVING UNIVERSE
## Production implementation brief — 2026-11-03

**Purpose:** A cinematic, explorable archive of human decisions on financial markets, where each visible star represents a story. Not a trading terminal, real social graph, or price-prediction product.

**Baseline:** ECLIPSE V8.2, isolated Render preview `https://market-remembers-eclipse-v82.onrender.com/`. Keep V7.4 and V8.0 as unchanged controls. New experiments must use an isolated branch/preview and never overwrite original render sites or production.

**ONE signature experience:** Universe → select star → cinematic star ignition and controlled camera flight → a readable memory artifact → return to the same star → create one's own star. One continuous world, no detached mockups.

## R0 — Freeze, audit, measure before redesign (mandatory)
- [ ] Capture identical mobile screenshots/videos of original V7.4, V8.0 regression and ECLIPSE V8.2 at 390×844 and 320×568, then desktop 1440×900, landscape 760×420.
- [ ] Add Playwright screenshot + touch/keyboard tests with stable camera seed, animation freeze for *visual comparisons only*, and baseline image approval. `expect(page).toHaveScreenshot()`.
- [ ] Capture whether actual renderer is WebGL or Canvas; verify screen sizes, devicePixelRatio and reduced motion. A mobile emulator alone does **not** prove physical Android GPU results.
- [ ] On an actual Android browser inspect one full first-open → story → back → archive → personal star journey and record visual overlap, FPS/jank and any WebGL context loss.
- [ ] Hard rule: do not use JS-unit test counts to assert visual success.

**Exit criterion:** reproducible screen/video baselines, rendering mode logged, clearly ranked defects and no untouched production files affected.

## R1 — The sphere becomes luminous and dimensional
**No new giant CSS halos. Fix the light *inside* the orb and its depth, not its outside diameter.**

Changes:
- `coreFragment`: improve graphite/ice surface response and local rim brightness; maintain occlusion and the opaque globe's structural silhouette. Implement optional per-category color using a restrained shader uniform *only if mobile frame budget permits*.
- `pFragment`: tune point-sprite falloff and size/density according to perceived depth; stars remain pinpoints with soft halos, not fuzzy discs. Preserve selected-star clarity and accessibility hit targets.
- `generateParticles`: keep determinism and stable spatial layout; improve organic distribution and depth through controlled rare bright stars and gentle particle densities, not a random cloud or social graph.
- `targetCenter` / `v763MeasureStage`: define a locked, visually reviewed framing table by viewport class; keep the sphere centered, clearly separated from hero text and bottom dock. Do **not** scale it solely because there is spare viewport width.
- Preserve `canvasRender` parity with restrained graphic effects.

**Exit criterion:** first-open frame has a clearly legible bright 3D sphere, naturally varying star depths, no huge exterior rings and no clipping on all five devices. If the still image is not convincing, DO NOT start R2.

## R2 — Signature effect: STAR IGNITION
Only one cinematic effect receives production priority.

When an actual story star is tapped:
1. Briefly emphasize the selected star and desaturate neighboring stars (0–250ms).
2. Pull the camera toward the *actual 3D projection of that star*, with eased interpolation and subtle depth/parallax (250–1050ms).
3. Use existing point sprites to draw a short, local gravity/particle wake, not full-screen layers (350–1200ms). Optionally use a small batched dynamic buffer; no extra particle engine by default.
4. Open the actual memory reader when flight reaches its destination (approximately 1050–1450ms). Focus the heading, maintain provenance and correct selected index.
5. SKIP button, close/cancel, browser back and reduced-motion must produce the **same correct story selection and focus**, with animation omitted where required.

Implementation: refactor the existing `beginDive`, `finishDive`, `cancelDive`, `updateTravel` into a small `idle → lock → fly → reveal → reader` state machine with one cancellation token. Keep star IDs stable. Do not replace with a video or a fake layer.

**Exit criterion:** user taps any visible star and reaches its correct story in one fluid sequence; no wrong alias, lost star, double animation, or frozen state under rapid taps/ESC.

## R3 — Museum that feels connected
- Keep `v77RelatedRecords` and `v78MountBreadcrumb` but present them as contextual continuations inside the same scene.
- Reader composition: one expressive quote, contextual scene, what happened, the remembered rule, provenance, and one obvious next action. Avoid stacking decorative panels.
- Verified source headlines must not be represented as direct quotations. Fictional/editorial examples clearly labeled.
- Back action returns to the same star and framed camera. Themed constellations illustrate *topics*, never real-world personal relationships.

**Exit criterion:** reading works fully on 320px mobile, clear contrast and touch targets, scroll position not stolen, themed navigation moves to the correct star.

## R4 — YOUR STAR: personal creation as the product payoff
- Build on current local-only `showCreate` / birth overlay and storage schema.
- Deterministic `starSeed` from a local UUID / stable local ID; animate 30–80 lightweight particles coalescing to the star location using existing render pipeline or one batched group. No external identity/upload.
- The created star stays in this browser's local archive and is revisitable.
- Clearly communicate that clearing browser storage removes the local memory. Cross-device publishing/sharing requires a future opt-in backend, data consent and moderation. Do not imply it exists yet.
- “Share” may share a generic project URL; it must NOT falsely imply the user's private story was published.

**Exit criterion:** creation → birth effect → find star → reopen the exact story survives reload on that browser and never uploads private text.

## Technical architecture (existing code first)
- **Current foundation:** raw WebGL 1, GLSL vertex/fragment shaders, Canvas 2D fallback, DOM editorial UI, CSS, existing story catalogue and browser-local storage.
- **No first-pass rewrite into Three.js, Babylon, Unreal, Blender runtimes, full particle libraries or automatic AI video.** Add only if profiling proves a concrete need.
- Optional tiny shader uniforms for selected-star energy, category tint and transition progress. Keep buffers batched and avoid layout reads in the render loop.
- Use `requestAnimationFrame`; cap DPR and particle count in adaptive quality and keep performance opt-out/reduced-motion. Don't run GPU scene work beneath the fully covering reader.
- Source-of-truth: one selected story ID, one camera state, one transition token. No duplicated navigation logic.
- Future backend is a separate opt-in milestone, **not** part of V9 cinematic launch.

## Real testing and release gate
- Run existing functional/mock test suites plus deterministic selection, canceled flight, keyboard, reduced-motion, WebGL context loss and Canvas fallback tests.
- Run Playwright browser interaction and visual regression: 320×568, 390×844, 768×1024, 760×420, 1440×900. Explicitly verify drawer overlap and live screenshot silhouettes.
- Native Android browser/Telegram WebView smoke test after emulation, when accessible. Note GPU variability.
- **Targets to measure, not guaranteed results:** desktop 60fps, mainstream Android stable near 30–60fps depending GPU, initial key interaction responsive <150ms, no critical JS errors, no missing tappable content. Visual "wow" is an explicit review gate, not captured by test count.
- Retain PR as draft unless mobile visual checks, functionality, and privacy boundaries all pass.

## Implementation order and stop rules
1. R0 visual truth before code.
2. R1 **one** improved first screen and genuine material/point light.
3. R2 **one** complete star-ignition experience.
4. R3 readable memory scene.
5. R4 personal star creation.

**Stop immediately** if a change recreates giant rings, reduces star visibility, introduces unreadable overlays, breaks local privacy or replaces true WebGL with a fake screenshot. Revert that small experiment, don't add another CSS effect as a patch.

## Deliverables of each iteration
- GitHub code diff + exact branch and commit
- One separate Render review URL with autoDeploy OFF
- Before/after screenshot or explicit disclosure if no screenshot browser was available
- Functional tests and render mode (WebGL vs Canvas)
- One-paragraph change log, performance findings, known blockers

**Current status as of this plan:** R0–R4 are a proposed implementation program, not completed features. ECLIPSE V8.2 is a verified separate Render preview but physical-device visual approval is still outstanding.
