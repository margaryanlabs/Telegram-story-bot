# Market Remembers V20.2 — Shock Replay / 2008

Date: 2026-11-06 · Parent draft PR: #248 · Continuation of V19 PR #247.

## What was actually implemented

The 2008 historical dossier now includes a standalone, **source-backed chronology**. It deliberately does **not** draw artificial market prices, assign a distinct location to each historical stage on the sphere, claim a causal model or imply that fictional PEOPLE characters were participants in the 2008 crisis.

The six steps (read-only source-backed facts with explicitly marked editorial interpretations):

| # | Date (ISO) | Documented event | Official reference |
|---|---|---|---|
| 01 | 2008-09-07 | FHFA conservatorship of Fannie Mae / Freddie Mac | St. Louis Fed FRASER |
| 02 | 2008-09-15 | Lehman Brothers Chapter 11 filing | St. Louis Fed FRASER |
| 03 | 2008-09-16 | Reserve Primary Fund's NAV drops below $1 | FDIC historical timeline |
| 04 | 2008-09-16 | Federal Reserve Board authorizes NY Fed credit line of up to $85B to AIG | FDIC historical timeline |
| 05 | 2008-09-19 | U.S. Treasury announces temporary guarantee program for participating money-market funds | St. Louis Fed FRASER |
| 06 | 2008-10-03 | Public Law 110-343 establishing TARP; authorized up to $700B | GovInfo official Public Law |

Primary source entry points (also linked on each interactive step):
- https://fraser.stlouisfed.org/timeline/financial-crisis
- https://www.fdic.gov/history/2000-2009
- https://www.govinfo.gov/app/details/PLAW-110publ343/PLAW-110publ343

Each step contains separately labelled **historical fact** and **editorial explanation**, with a direct source link. Editorial explanations are not proof of causal links.

### User interaction

- Open EVENT CORE, select **2008**, choose **Подробнее**, then access **SHOCK REPLAY** inside the expanded dossier.
- Manual previous/next and any of six date buttons work independently of autoplay.
- Play/pause and speeds **1× / 1.5× / 2×** are available. Playback is **opt-in only** and stops on the last step, when the tab is hidden, when a different event is selected, or when the user exits to PEOPLE.
- Focused 2008 globe marker shows a restrained decorative halo during playback; the actual source of evidence remains the timeline inside the dossier, not the globe coordinates.
- Keyboard focus, readable stage text, direct source links, reduced motion and mobile safe-area layout are retained.

### Git changes

- Added `v10/shock-replay-2008.js`: isolated data, player and lifecycle.
- Added `v10/v20-shock-replay.css`: responsive reader and focused 2008 node visual treatment.
- Updated `v10/market-history-modes.js`: explicit mount/unmount, scene sync after marker redraw.
- Updated `index.html`: replay JS loads before mode controller; styles follow the V20 layer.
- Added `tests/v20-shock-replay.test.mjs`.

### Verification / honest release state

- Source readback, V8 parser validation, and **10 focused source-and-behavior checks PASS** across V20 Crisis Atlas and V20.2 Replay.
- The checks include a mocked browser DOM, player timers, stepping, speeds, visibility pause, cleanup, and EVENT → PEOPLE lifecycle.
- **Not yet run:** complete repository `npm run lint`, `npm test`, `npm run build`, Playwright browser testing, physical Android Chrome WebGL and iOS Safari.
- Existing Vercel isolated preview is still blocked by daily account deployment quota. No tested V20.2 interactive public URL is asserted.
- **Draft only**. Do not merge to main, deploy to production, change old previews, expose personal memories or add backend without explicit approval.

## Next agreed stages

V20.1 CHRONOSPHERE directional visual hierarchy and mobile three-state panel; V20.2 additional source review and factual presentation; V20.3 PEOPLE story-first reader; V20.4 explained PEOPLE↔EVENT bridges; V20.5 archive and private creation; V20.6 full device/release QA.

Source note: this work implements the prioritized portion of the 120-item V20 master plan; it does not claim all items are done.
