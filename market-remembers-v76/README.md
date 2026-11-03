# THE MARKET REMEMBERS — V7.6 Memory Museum (isolated preview)

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
