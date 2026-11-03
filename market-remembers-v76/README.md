# THE MARKET REMEMBERS — V7.6.2 Memory Museum (isolated preview)

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
