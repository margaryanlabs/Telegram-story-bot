# Market Remembers V20 — Integrated Review: Shock Replay × Crisis Compare

Date: 2026-11-06  
Review branch: `feature/market-remembers-v20-integrated-review-20261106`  
Integration baseline: PR #248, head `523a0ccaa561f525715ab72754f8274f571751a8`  
Compare source: PR #249, head `372f48ed8ee90cf2b3febd0bad7f34085f08782d`

## Why this branch exists

PR #249 branched from an older version of PR #248. Its controller and stylesheet changes diverged after Shock Replay was added to #248. It is unsafe to assume both drafts can be merged independently without examining overlapping `market-history-modes.js` changes.

This branch **ports the actual Compare behavior from #249 onto the latest #248**, preserving Shock Replay. It is a review-only integration, **not a production release**.

## Actual implementation

- Both interactions now live in the same existing EVENT CORE scene.
- In **СОБЫТИЯ**, 2008 opens the six-step sourced Shock Replay only when the user explicitly chooses the detailed dossier; its timer is cleaned up when switching event, research mode, or PEOPLE world.
- In **СВЯЗИ**, the current year stays pinned on the globe and a second case can be selected from the remaining three; both have independent source links and thematic comparison without invented market metrics.
- The Compare picker supports keyboard arrow navigation and focus retention, with scroll preserved on second-case selection.
- Entering Compare expands the research panel; returning from Compare to Events collapses it so the sphere is not unexpectedly covered. Deep linking directly to Compare also opens the evidence content.
- The older PEOPLE renderer, story IDs, storage and original WebGL shaders are untouched.
- Compare CSS and regression suite were ported unchanged from PR #249. The existing replay JS, its source records and tests are retained unchanged from PR #248.
- Added `tests/v20-replay-compare-integration.test.mjs` to execute both modules together in a simulated DOM, with assertions on lifecycle cleanup, focus, globe state and mode switching.

## Completed verification

- Inspected GitHub PR #248 and #249 refs and their divergence before modifying.
- JavaScript syntax compilation of the combined controller and replay module passed.
- All **14/14 existing targeted Crisis Atlas, Shock Replay and Compare checks** passed in an isolated JavaScript harness before the mode-transition polish.
- **2/2 additional integration checks** passed after the mode-transition polish. These checks execute both JS modules against the same simulated DOM.
- No runtime network requests, new secrets or paid infrastructure introduced.

## Mandatory acceptance still missing

- Full local/CI Node tests and static build (`npm run lint`, `npm test`, `npm run build`) have **not** been executed on an actual repository checkout.
- Playwright and physical mobile/browser visual QA are **not verified**. A disconnected connector runtime cannot substitute a real browser.
- There is no independently verified deployed V20 integrated URL; earlier Vercel API deployment was refused with a daily HTTP 402 quota. Do not advertise an unrelated HTML proxy or older build as a validated preview.
- No merge into PR #248, PR #249, `main`, or any production branch occurred. Review the integration branch and test on Android before release.

## Continuation of V20 master plan

Next limited increments: CHRONOSPHERE orientation and active-year labeling; mobile three-state event panel; story-first PEOPLE reader; source-provenance improvements, then archive/creation and device QA. Each increment must be inspectable and testable. Do not fabricate historical facts, price series or personal memories.
