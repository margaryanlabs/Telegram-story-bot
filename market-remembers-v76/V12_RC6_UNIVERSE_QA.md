# The Market Remembers — V12 RC6 Cinematic Universe

**Scope:** real WebGL/Canvas globe and its cosmic background only.
**Branch:** `feature/market-remembers-v12-cinematic-universe-20261105`.
**Based on:** V12 RC5 (archive/story navigation unchanged).
**Production:** unchanged.

## Visual composition

- A real triangulated memory sphere with brighter blue plasma veins,
  two spectral cloud frequencies, better interior lighting and a sharp
  atmospheric limb. Local amber sunlight appears on the illuminated
  side, never across the entire surface.
- The existing globe-tracked halo gains two slim optical elliptical
  rings. These are decorative orbits — **not social relationships** —
  and do not intercept pointer events or create new animated objects.
- The dark space field gains a muted lilac band in the upper right, a
  quieter counter-nebula in the lower-left and sparser distant lights.
  The upper-left title is still covered by a dark text-safe gradient.
- Full-quality material uses secondary turquoise micro-clouds and
  localized light knots. Mobile AUTO/ECO retains the main cyan veins
  and visible rim, skipping the expensive secondary detail.
- Canvas2D fallback renders clipped cloud light rather than a flat,
  featureless disk. No extra animation loop or dependency.

## Changed files

- `index.html`: globe GLSL material, decorative orbit mount, canvas
  fallback lighting, stylesheet declaration and RC6 preview label.
- `v10/v12-universe-cinema.css`: self-contained scene background,
  halo and star visual polish.
- `v10/universe-atmosphere.js`: more legible existing throttled
  far-field background; point count and scheduler untouched.
- `package.json`, `scripts/check.mjs`, `scripts/build.mjs`,
  prior version-pinned release tests: RC6 identity.
- `tests/v12-rc6-universe-cinema.test.mjs`: scope and performance
  regressions.

**Explicitly untouched:** V12 reader/card files, archive, memory trails,
router, forms, story content, back-end, browser storage, Telegram bot,
production domain, current public preview.

## Test and manual-release gate

Run inside `market-remembers-v76/`:

```sh
node --test tests/*.test.mjs
node scripts/build.mjs
# Requires Playwright browsers and a working software/hardware WebGL context:
npm run test:browser
```

These are required in CI before any merge. Further acceptance:

1. Open Universe at Android widths 360px, 390px, 430px and rotate globe;
   cyan and warm light should move with the real 3D surface.
2. Compare low/AUTO/high quality. Low must remain readable and not hang;
   high should show more detailed internal cloud knots.
3. Pinch, drag and tap different stars repeatedly; all hit targets must
   remain functional with background layers visible.
4. Compare exact same angle in WebGL and Canvas fallback; the fallback
   should retain a sharp sphere silhouette and light-bank.
5. Change scale BIG/SMALL/MAX; orbital outlines must follow the globe.
6. Use reduced motion and battery-saving mode; confirm no new animation
   flashes or unexpected continuous work.
7. Confirm reader, archive, search, return-to-archive and saved routes
   behave as before; this change must not affect them.
8. Inspect visual contrast: main hero text readable; sphere not washed out;
   no oversized white glow or bright pink fog.

**Release blocker (5 Nov 2026):** Connected Vercel returned HTTP 402
`api-deployments-free-per-day`. Existing Render workspace is already at
the service limit. A new public RC6 preview is **not** available at this
point. Do not label the older RC4 URL as RC6. Await allowed capacity or
select an explicitly authorized alternative deployment destination.

## Evidence

- Separate static checks passed for the added universe layer (6/6).
- Inline original runtime JS parsed, shader braces balanced and WebGL
  core/fallback code paths present.
- Full Node test suite and actual Android GPU visual QA **not yet confirmed**.

## Browser-specific RC6 checks

`tests/v12-rc6-browser.spec.cjs` is now part of the Chromium Playwright
suite. It checks real WebGL shader compile results, native globe visibility,
Canvas2D fallback, optical-overlay pointer transparency, orbit scaling,
story-star clicks, and writes mobile/desktop scene screenshots for review.
The screenshots are test artifacts and must be visually reviewed; their
existence alone is not acceptance.

**Current check distinction (5 Nov):** 6/6 targeted JS checks and 8/8
static integration checks passed. The local container's Chromium does not
provide a functioning WebGL context, so actual WebGL compile/render and
physical Android FPS have **not been proven** here. GitHub Actions runs have
failure status but their job log downloads are returning 404, and Vercel
preview deployment is quota-blocked (HTTP 402).

Do not call this production-ready or claim that the new world is already
live based on the previous RC4 preview link.


## Offscreen real OpenGL ES 2.0 GPU/CPU raster validation (5 Nov 2026)

The actual RC6 `coreVertex` and `coreFragment` strings were extracted
from the existing isolated shader harness, submitted to a Mesa surfaceless
EGL OpenGL ES 2.0 context, compiled with the driver's actual
`glCompileShader` and linked with `glLinkProgram`:

| Stage | Result |
|---|---|
| EGL initialization | 1.5 |
| Vertex compile | PASS (empty info log) |
| Fragment compile | PASS (empty info log) |
| Program link | PASS (empty info log) |
| Low/ECO raster (600×600) | PASS, glGetError = 0 |
| High raster (600×600) | PASS, glGetError = 0 |
| Depth occlusion | PASS with 24-bit pbuffer depth |

The first offscreen test without an EGL depth attachment drew back faces
over the front and created artificial horizontal seams. Requesting an
EGL 24-bit depth attachment removed them, as expected. The real browser
scene's `getContext('webgl',{depth:true})` and `DEPTH_TEST` path
were already present; no production-shader geometry change was necessary.

Two 600×600 offscreen snapshots (ECO/HIGH) were captured for manual review
during this development session. These images are **isolated shader renders
of the actual sphere material**, not screenshots of the fully assembled
website; they exclude background nebula, HTML overlays, real markers,
camera gestures and phone-specific performance.

**What remains open:** real Android WebGL rendering, browser-driven
Playwright tests, actual full-app screenshots and public RC6 preview
delivery. Do not merge into production or claim full device acceptance
from the EGL test alone.


## Visual refinement II — nebula depth and actual GPU verification

Implemented on the **same RC6 review branch / PR #236**, not a new
application or deployment:

- `index.html`: a coherent 3D value-noise field (`nebulaNoise3`),
  physically rotating dark cloud cavities, narrow cyan plasma rivers,
  warm-gold surface filaments, delicate high-quality stellar dust,
  a sharp solar atmosphere and a highp-when-available / mediump-fallback
  fragment precision declaration.
- `v10/v12-universe-depth-v2.css`: new non-interactive background
  galaxy, diagonal violet/blue nebula river and warm lower-left
  counternebula with phone-specific, reduced-motion overrides.
- `index.html`: new `v127-space-field` sits **strictly between**
  `v124-depth-field` and the real `#gl` canvas.
- `tests/v12-rc6-universe-cinema.test.mjs` and
  `scripts/check.mjs`: enforce the shader, background layer,
  transparent pointer behavior and cumulative release identity.

**Verified offscreen by actual Mesa EGL OpenGL ES 2.0 rasterization:**
both ECO and HIGH compiled, linked, and produced 600×600 framebuffers
with `glGetError() == 0`. The high mode has stronger plasma highlights
and rare stellar dust. Full inline application JS parsed, and all six
updated targeted RC6 tests passed in a faithful assertion harness.

**Not yet proven:** full mobile Chromium/WebGL end-to-end QA,
real Android FPS or comparison of the complete CSS background with
the finished application. A GitHack pinned-commit live link is for
user review only; it is not a substitute for a proper production
preview or full regression suite.


## Mobile visual review — screenshot follow-up, 5 Nov 2026

The Samsung Android review of RC6 revealed a giant black glass-like
sphere with too many intersecting cyan/gold ribbons and part of its
lower edge covered by the memory dock. Purple background glow remained
too diffuse.

Addressed **in the same PR #236, not in production**:

- V12 fragment material: cut repeated sine-ribbon contribution,
  reduce both decorative great-circle strokes, introduce illuminated
  irregular gaseous banks and more readable darker rifts using existing
  3D noise (no new shader pass or remote texture).
- Existing mobile `v9PortraitFrame`: reduce standard phone
  nominal radius from .347 to .306 of the smaller viewport dimension
  (.325 to .296 for short portrait), preserving original star projection,
  clicking, zoom, and 3D rotation. Goal: less overlap with the dock.
- `v12-universe-depth-v2.css`: move distant galaxy into the
  upper-right phone viewport; tone down the broad violet river to
  reduce color wash.
- `v12-universe-cinema.css`: soften decorative CSS orbital ellipses
  so they do not compete with active star buttons.
- `tests/v12-rc6-universe-cinema.test.mjs`: add invariants for
  organic clouds, softened great-circle guides and mobile radius.

Targeted source/behavior checks pass 6/6 in an isolated JS harness;
application inline script parses; scene stacking order remains correct.
**Still needed:** full Node suite, GLSL compile on final code revision,
actual phone visual check, WebGL/Canvas fallback integration and FPS QA.

Do not represent the previous pinned preview as this new revision.
