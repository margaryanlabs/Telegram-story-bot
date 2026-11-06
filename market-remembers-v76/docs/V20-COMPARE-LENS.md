# Market Remembers V20 — Evidence Compare / research-grade crisis lens

Date: 2026-11-06  
Base: PR #248 (V20 Crisis Atlas), commit `f6d92b2fc8a8771dc49d9b6cb7b8609afda27f0c`.  
Branch: `feature/market-remembers-v20-compare-lens-20261106`.

## Delivered

The existing **EVENT CORE → СВЯЗИ** view now includes a genuinely interactive **CRISIS COMPARE** section before the thematic links. This is an extension of the real V20 app, not a separate demo.

- The active event on the globe remains the primary **case A**. Choose any of the other three archived years as **case B** without changing the globe orientation or opening a second overlay.
- Both case files display their own archived date, event detail, three-stage mechanism, interpretive lesson and **direct primary-source link**.
- Shared and event-specific thematic tags are computed from the existing event records, not invented correlations.
- Clear provenance and uncertainty: documented facts are distinguished from analytical lessons, and thematic similarities explicitly do not prove causality or matching price dynamics.
- Picker buttons expose `aria-pressed`, accessible group labels, visible focus and ArrowLeft/ArrowRight navigation. DOM rerenders restore keyboard focus and scroll position.
- Mobile renders the cases in a readable vertical stack; wider desktop panels may use two columns. Reduced-motion preferences are respected.
- Existing PEOPLE globe, its shaders, cards and reader are **not modified**.

## Files changed

- `v10/market-history-modes.js` — comparison markup, state, picker interaction, keyboard and focus handling.
- `v10/v20-compare-lens.css` — isolated responsive research design.
- `index.html` — stylesheet loaded after V20 Crisis Atlas.
- `tests/v20-compare-lens.test.mjs` — source, styling, DOM and interaction regression tests.

## Verification performed

- GitHub file readback and JavaScript syntax parsing of the updated controller.
- 4/4 new Compare tests + 5/5 prior Crisis Atlas tests + 6/6 V19 regression tests **passed** in an isolated V8 source-and-DOM harness. The harness used lightweight stand-ins for Node test/assert and browser DOM/URL APIs; this is **not equivalent** to a full Node/Playwright run.
- CSS block balance and load order checked. No test required network access or production deployment.

## Release gates / limitations

- Full `npm run lint`, `npm test`, `npm run build` and real Playwright/Android WebGL visual QA remain **unverified** here.
- No deployment attempted; previous V20 documentation records a Vercel API free-tier HTTP 402 blocker. No production service, main branch or existing preview was touched.
- Four source-backed pilot events remain; this work does not add historical cases, price series or simulated financial metrics.

## Next priority

Improve the globe-to-case spatial narrative and small-screen panel ergonomics through **real browser visual QA**; then expand the evidence catalog with individually sourced events and transparent citation coverage, without presenting thematic links as causal inference.
