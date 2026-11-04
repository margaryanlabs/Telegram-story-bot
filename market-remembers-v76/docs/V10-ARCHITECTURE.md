# V10 — The Living Universe

## Scope and source

V10 evolves the exact live V9.8 commit in this directory. Original V7.4/V7.5 publications, backend APIs, main branch, and existing Render services are unchanged. No React, Three.js, GSAP or production dependency was added. Playwright is an isolated development dependency.

## Modules

| Module | Responsibility |
| --- | --- |
| `index.html` | Original WebGL1 mesh, camera, star picking, Canvas fallback, storage/integrity, guided paths, discipline and capsule |
| `v10/design-tokens.css` | Obsidian Observatory colors, typography, rhythm, focus and touch controls |
| `v10/living-universe.css` | Responsive scene, editorial reader/archive/form and constellation layouts |
| `v10/universe-atmosphere.js` | Three depth layers in one bounded Canvas2D pass; 52/96/210 points; original engine owns scheduling |
| `v10/motion-system.js` | Reduced motion, session-only visited stars, optional immediate opening |
| `v10/memory-data.js` | Bounded four-chapter adapter, provenance, stable identity links |
| `v10/story-experience.js` | Chapter jumps, scroll progress, explicit missing data, source-preserving legend reader |
| `v10/constellation-system.js` | Existing deterministic thematic edges as a star map and equivalent text list |
| `v10/memory-archive.js` | Sort/order and locate-star actions over the original live search/filter/bookmark data |
| `v10/legacy-submission.js` | Six steps including review, explicit private consent, confirmed local save, unavailable public adapter |
| `v10/navigation.js` | Hash routes, Back/Forward, deep links and filter URL restoration |
| `v10/living-universe.js` | Thin bridge around existing experience functions, modal isolation and clear control labels |

## Renderer fixes

The live baseline fell back to Canvas in Chromium/ANGLE because shared `uTime`/`uPulse` declarations had different vertex/fragment precision. They now explicitly agree; varyings also explicitly agree. Shader time is expressed in seconds and bounded below the minimum mediump maximum. Shader/program allocation failure releases resources.

The same triangle mesh now uses restrained irregular atmospheric shading rather than prominent repeating bands. Surface dust occupies a thin depth range around the original sphere, so it remains visible with real depth occlusion. Story coordinates, IDs and back-side culling are unchanged. The original adaptive DPR/ECO, context-loss fallback and buffer reuse remain.

The background shares the engine's frame lifecycle and parks behind modal surfaces. Reduced motion parks all idle rendering; user controls wake it. No second persistent RAF loop or image/video texture.

## Data honesty and compatibility

- Existing fictional/editorial accounts are preserved verbatim. Unrecorded decisions/consequences are marked missing; V10 never fills these with inferred biographies.
- Source-based legend quotations retain their original translation, provenance, link, original wording and editorial disclaimer. They are not recast as fictional autobiographies.
- New local records add `chapters: {before, decision, consequences, remains}`. The original ID, position, quote/story/rule and storage key remain compatible. JSON export/import preserves bounded chapter fields.
- All 30 catalogue records have stable `#story/<id>` links. Local IDs are stable too, but their links only resolve in a browser holding that record. They are not public permalinks.
- Different Render origins have different browser storage. Transfer personal V9 records into the V10 preview with the existing JSON export/import; no automatic cross-origin transfer is claimed.
- Bookmark write failures now roll back the in-memory change.

## Publication boundary

No publication server is configured. `MarketV10.legacy.publication.available` is false and `submit()` rejects. No request uploads a story. Local success/birth requires confirmed `localStorage.setItem` first. Failure keeps the review and entered text visible.

Before enabling public publication a real adapter must provide durable IDs, canonical public links, server-side validation/limits, spam protection, moderation states, explicit separate publication consent, and authenticated deletion. This preview does not claim those services exist. Local consent, local deletion, plaintext-storage disclosure, a honeypot, and duplicate-submit prevention are implemented now.

## Build and verification

From this directory:

```sh
npm ci --ignore-scripts
npm run lint
npm run build
npm test
npx playwright install --with-deps chromium
npm run test:browser
```

`lint` validates the JavaScript syntax, all referenced local V10 assets and unique shell IDs; it is not ESLint. `build` produces `dist/` with only the site HTML and V10 assets. It does not publish tests, documentation, API code or the repository root. `PLAYWRIGHT_CHROMIUM_EXECUTABLE` selects an existing Chromium; `V10_BASE_URL` tests a deployed preview.

The historical V9 visual spec remains an archival reference for the earlier UI. V10 browser acceptance lives in `tests/v10-browser.spec.cjs`. Existing Node regressions remain active; their stale version/precision assertions and strict-mode VM fixture bindings were repaired without removing behavioral cases.
