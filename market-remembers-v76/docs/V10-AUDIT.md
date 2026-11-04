# V10 audit and preservation — 2026-11-04

## Verified source

Both Render services point to `margaryanlabs/Telegram-story-bot`:

- V9: `feature/market-remembers-v9-star-ignition-20261103`, publish directory `market-remembers-v76`, live commit `3e86f0db7d4f5a9fe18e8e114f8ae4ba4096ee53` (V9.8).
- V7.4: `preview/market-remembers-veto-universe-20261101`, directory `market-remembers-preview/human-legacy-v74.html`.
- The separately named `margaryanlabs/Marketremember` is another development line, not the source serving the requested URLs.
- Downloaded public HTML matches the selected baseline. Compared 1440×900 and 390×844 browser captures (Canvas fallback). This does not establish physical-device GPU compatibility.

Recovery branch: `backup/market-remembers-pre-v10-20261104` at the exact V9.8 commit. Work branch: `feature/market-remembers-v10-living-universe-20261104`.

## What to retain

V7.4: restrained cyan optics, readable sans/serif pairing, compact selected fragment, sphere silhouette, personal PNG, private storage disclosure.

V9: stable star identities/positions; real triangulated WebGL1 sphere; Canvas fallback; bounded DPR and adaptive ECO; front-facing touch picking; 1.35s cancellable/skippable passage; same-star return; reader focus trap; sourced legend quotations; explicit fiction labels; deterministic thematic links; guided paths; private bookmarks; 30-day discipline, time capsule; JSON import/export with integrity checks.

## Regressions / gaps

- Desktop selected fragment grew from a compact V7.4 panel to a large V9 overlay obscuring the sphere. Restore editorial hierarchy with less enclosure.
- Mobile hero, navigation, signal dock and four opaque English controls compete for scene space. Keep functions but use clear Russian control labels and a shorter mobile hero.
- Stories remain one quote plus two short blocks. Existing data often does **not** specify context, choice and consequences separately. V10 must expose missing fields honestly; never manufacture biographies to fill chapters.
- Related records are three similar cards. Render the same explicit thematic links as a small navigable constellation plus an equivalent text list.
- Archive has search/categories/bookmarks but no sorting or shareable filter URL.
- Browser history does not encode view/star/filter state.
- Creation stores locally, not publicly. There is no publication backend, moderation service or public deletion endpoint. Preserve local creation and birth only after confirmed storage. Public publication must report unavailable.
- Main app is a 299 KB single HTML file with years of additive CSS. Add isolated named modules and tokens; avoid replacing the compatible renderer or importing Three.js/React.
- Reduced motion already affects optics but the continuous frame scheduler still runs while idle. Park rendering when motion and camera changes settle.

## Baseline verification

`node --test market-remembers-v76/tests/*.test.mjs`: 10 test files pass, 9 fail on unmodified source. Several assertions match obsolete exact source strings; extracted-function mocks also omit newer dependencies. Preserve the baseline record and repair tests against current behavior. Browser regressions are required for actual interactions.

No production service, environment variable, database or existing deployment has been changed.
