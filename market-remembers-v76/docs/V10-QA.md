# V10 review acceptance — 2026-11-04

Live interactive preview: https://market-remembers-living-universe-v10.onrender.com

Pull request: https://github.com/margaryanlabs/Telegram-story-bot/pull/221

Deployed application commit: `90d1c49ab951b8bb3d0dedd40b244d9cd127b1be`.
Render service: `srv-dbl9dg0u01pc739he5ag`; deploy `dep-dbl9hg6gekts73fnp46g` reached **live**. It is an independent static site with auto-deploy off. Later evidence/configuration commits do not change deployed application assets.

## Executed verification

| Check | Actual result |
| --- | --- |
| Isolated syntax/asset/DOM-ID lint | Passed |
| Static build | Passed; only HTML and V10 assets published |
| Node regressions | **199 individual cases / 20 files passed**, zero failures |
| Chromium acceptance | **17 passed** |
| WebKit mobile acceptance | **4 passed** |
| Deployed preview browser acceptance | **5 passed** |
| Public HTML and V10 asset comparison | Downloaded deployed HTML, tokens, layout CSS and integration JS exactly match the local application files |
| Existing V7.4 and V9 | Downloaded again; both HTML documents are byte-for-byte unchanged |

[Actual browser result lines](evidence/V10-TEST-RESULTS.txt).

Chromium covers 320×568, 390×844, 760×420, 768×1024 and 1440×900. It checks layout overflow/control separation; real WebGL shader linking and context loss; forced no-WebGL Canvas fallback; skippable travel and no repeated flight; Escape and browser Back; four chapter navigation; thematic map and list; keyboard containment; search/sort/filter URL reload; locate-star; all 30 stable story routes and legend source links; reviewed creation and confirmed local birth; persistent chapter fields; JSON export; deletion followed by the actual empty-archive reload; storage quota failure without a success screen; and parked rendering in reduced motion/covered scenes.

The Android reproduction uses touch input, 390×844, device DPR 3, Android Chrome user agent, and **4× CPU throttling**. Actual drawing buffers remain capped at DPR ≤1.35, measured frame gaps stay below the 1.5-second stall guard, and a real touchscreen tap opens its story within 4.5 seconds including travel. These are reproducible emulation bounds, not a benchmark of physical Android hardware.

WebKit tests phone/tablet/landscape composition, chapter scrolling and keyboard containment, return to the same star, archive URL restoration, real touch actions, reviewed private creation and reload. The downloaded Playwright WebKit 26 engine ran with its required Debian libraries extracted into `/tmp`; system/browser trust settings were not modified. This is Linux WebKit mobile emulation, not physical iOS Safari.

The five deployed tests exercise travel/return, archive state and star location, every catalogue route, local creation/reload/export/deletion, and failed storage. The managed browser's ephemeral NSS store does not include its HTTPS proxy CA. The optional `V10_VERIFIED_PROXY_FETCH=1` fixture therefore forwards exact live responses through Playwright's request client using the configured proxy and injected trusted CA. **TLS verification stays enabled.** No site response is fabricated. Direct trusted HTTPS requests and asset hashes also pass.

Normal local reproduction:

```sh
npm ci --ignore-scripts
npm run lint
npm run build
npm test
npx playwright install --with-deps chromium webkit
npm run test:browser
npm run test:webkit
```

For a deployed site, set `V10_BASE_URL` to the preview. `V10_VERIFIED_PROXY_FETCH=1` is only for the managed proxy environment described above.

## Visual review

Captured from the actual deployed preview:

- [Universe on a phone](evidence/v10-universe-mobile.jpg)
- [Human story and chapter navigator](evidence/v10-reader-mobile.jpg)
- [Thematic constellation](evidence/v10-constellation-mobile.jpg)

Token contrast on reader surface `#0B141E`: ivory 15.46:1, secondary text 10.72:1, muted text 8.07:1, stellar ice 12.05:1 and memory gold 8.41:1. These are static token-pair calculations, not a claim of a complete WCAG audit of every composited state.

## Preservation proof

Unchanged public HTML SHA-256:

- V9: `161f0984f9c67d71ad1007d1a4243e2f04e51d42748925b5de4b3179156e812f`
- V7.4: `3d82cb829b70049273d973e698b25c8dd13250c9c050150e32948ba562534f35`

Recovery branch `backup/market-remembers-pre-v10-20261104` remains at live baseline `3e86f0db7d4f5a9fe18e8e114f8ae4ba4096ee53`. No main/production branch was updated, no existing Render service was changed, and the PR is unmerged. API source, tests and `.git/config` return 404 from the new static publication.

## Remaining limits / release blockers

1. **GitHub-hosted CI cannot start.** GitHub's job annotation states: “The job was not started because your account is locked due to a billing issue.” The workflows are committed and local checks pass, but hosted checks remain failed. This has not been described as green CI.
2. **No public story backend.** Confirmed storage, birth, stable identity, export/import and deletion work locally. Public publication, moderation, server spam protection, authenticated server deletion and public permalinks for contributed stories are not available. The adapter rejects; the interface does not claim publication.
3. **Older accounts are incomplete source data.** Many fictional examples contain one short account plus a rule. Missing decision/consequence fields remain explicitly unrecorded. New contributions collect all four chapters; no historical/person-specific facts were invented.
4. **Physical device acceptance remains.** Android hardware GPU/battery, real iOS Safari, Telegram WebView, and changing address-bar/keyboard behavior on actual phones were not tested here. WebKit/Chromium emulation and software WebGL tests are evidence within that limit.
5. **Local storage belongs to an origin.** Export/import JSON is required to transfer private V9 records into the separate V10 preview. Local links do not transfer or publish their contents. Storage is plaintext and may be cleared by the browser.

V10 is available for interactive design/product review. These limits must be resolved or explicitly accepted before a production rollout; no production rollout is authorized or performed.
