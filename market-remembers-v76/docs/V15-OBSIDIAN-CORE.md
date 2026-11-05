# THE MARKET REMEMBERS V15 — OBSIDIAN CORE
## Why this exists
User-provided Android screenshot of V14 revealed four failures:
- Planet resembled globally molten red lava instead of institutional fintech.
- Decorative red noise overwhelmed meaningful data/selected events.
- Mobile research card obscured the sphere.
- The giant upper-left headline competed with the sphere, event markers and tabs.

## Design decision
Keep **two separate worlds**. People stays unchanged. EVENT CORE remains genuinely distinct but becomes a black/graphite finance observatory with silver volume and sparse, localized VETO crimson stress fractures. Not a 2D image, not simply a hue filter on the old People shader.

## Material
`v10/crimson-shaders.js`
- Replace lava field with layered graphite, a low-energy metallic specular sheen and narrow geological seams localized to rare stress regions.
- Preserve spherical depth, camera rotation and the event-select pulse.
- Crimson is reserved for active risk zones and selection; night blue/silver define the ordinary state.
- No new texture, network call or persistent data.

## Mobile
`v10/crimson-event-core.js`
- Planet position and size adapt to actual stage height. Short Android browser windows reserve approximately 78px at top / 115px at bottom; tall phones reserve 115px / 136px.
- Radius uses min(width × 0.395, usableHeight × 0.5, height × 0.29). This aims to keep a complete, readable sphere above the compact dock without diminishing it unnecessarily on tall screens.
- Canvas2D fallback also uses dark graphite instead of red lava.

`v10/v15-obsidian-polish.css`
- Mobile hides redundant large hero heading; the dedicated EVENT CORE header already identifies the world.
- Collapsed event summary contains the selected event plus the Events / Connections tab control.
- Expanded research card is scrollable (up to 64dvh), with visible collapse affordance.
- Text, overlays, beacons, nebula and ring intensity are reduced for legibility.

`v10/market-history-modes.js`
- `panelExpanded=false` on world entry.
- Selecting an event expands the card; tapping the summary toggles its state.
- Switching submode expands the research card if requested; People mode resets compact state.
- Events and thematic editorial connections remain unchanged; no claims of actual user participation.

## Safety
- Based on V14 isolated branch; no production code update or existing People-data mutation.
- Original shader, renderer, stories and local storage remain untouched.
- No new API, database or third-party dependences.

## Acceptance
- Static JS parse and source invariants must pass.
- `node --test tests/v15-obsidian-polish.test.mjs` and `node --test tests/*.test.mjs`.
- Playwright: `tests/v15-obsidian-browser.spec.cjs`, mobile 390×560, 390×844, desktop 1280×800.
- Real WebGL1 GLSL compile, browser screenshot comparison, physical Android testing, returning to People.
- PR stays DRAFT until these tests succeed. CDN link is an unverified browser-render preview; not production.

## Rollback
Leave the V15 PR unmerged and use the V14 pinned commit, or the user's original V12 RC6 pinned commit `ef58c790f693a58a5090053f1ede4dcd3a007608`.
