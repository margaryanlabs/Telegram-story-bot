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
