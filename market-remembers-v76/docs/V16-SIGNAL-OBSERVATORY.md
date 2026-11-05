# Market Remembers V16 — SIGNAL OBSERVATORY

## Purpose
Respond to the owner's real Android screenshots: V14 looked like lava, V15 like an unreadably dark circle. The new build must earn the term **financial observatory**, not merely change color values.

This work is isolated to `feature/market-remembers-v16-signal-observatory-20261105`, based on V15. Original V12 PEOPLE globe, archive, personal stories, storage, login and production are unchanged.

## Two universes, one identity
- PEOPLE (unchanged): cyan/lilac memory sphere with trader stories and a personal legacy.
- EVENT CORE (V16): graphite/silver alloy world with localized VETO crimson stress signals and a new research UI.
- EVENT CORE has EVENTS and CONNECTIONS as internal tabs. Connections are editorial shared themes, *not* actual causality or evidence that fictional people participated in real crises.

## Visual
New `v10/crimson-shaders.js`: legible metal structural facets, restrained procedural pattern, cool key light, silver rim/fresnel, slow highlight sweep, sparse red seams and event-selection pulse. Optimized field/noise operations for phones.

New `v10/v16-experience.css`: deeper dark-blue-violet cosmic background, restrained halo and orbit tracers, observatory HUD, actual spherical event beacons (44px finger hit targets but 14px visual node), an active tether and a full modular research dossier. Mobile opens with only the compact event dock.

## Motion: Memory Collapse → Signal Ignition
New `v10/v16-scene-director.js`: animated convergence of light toward a central aperture, darkening of PEOPLE, timed commit to new planet at the covered midpoint and outward revealing bloom. Reverse transition when returning to PEOPLE. No audio or strong full-screen strobe.

Runtime ownership:
- `market-history-modes.js` orchestrates transitions through `window.MarketWorldTransition.run`, while preserving synchronous direct-link boot and direct EVENTS ↔ CONNECTIONS switches.
- Historical event selection updates the observatory HUD and curved point-to-card tether.
- Return via a Connections theme waits for the completed world-change commit before opening the existing People Signal Lens.
- `crimson-event-core.js` corrects event-marker projection (exact inverse of the shader yaw/pitch); event nodes follow the 3D surface when users rotate it.
- Legacy People renderer parks when EVENT CORE is active and resumes on return.

## Structured event dossier
- Verified date and institutional-source link.
- WHAT HAPPENED (event text from existing source records).
- SHOCK TRANSMISSION (three chronological segments from the existing data's descriptive mechanism).
- TRADER LESSON (clearly a research lesson, not a trading signal).
- Thematic relationships to other historical cases and People stories.
- No invented causal edges or real-person biographies.

## Performance, accessibility, QA
- Single active planet renderer at a time.
- V14 low-DPR mobile and capped draw cadence preserved.
- 2D fallback preserved and dark material remains readable.
- Reduced motion switches immediately, without the portal.
- 44px event-button hit areas, keyboard focus styles, transparent optics that cannot steal touch.
- `node --test tests/*.test.mjs`, `node scripts/check.mjs`, `node scripts/build.mjs`.
- Playwright: desktop and mobile (390x560, 390x844, 1280x800), portal, dossier, People return, WebGL and Canvas2D paths.
- Essential manual gate: Samsung Android physical GPU/shader and screenshots, landscape, long press/orbit, rapid switching, readable text and 30fps goal.

## Known limitation
Code and automated source checks do not prove the true appearance or framerate in Samsung WebGL. Do NOT merge or present production readiness without real-browser and mobile visual confirmation.

## Rollback
Keep PR unmerged or return to pinned V15, V14 or user-referenced V12 RC6 commit. The same production website remains unchanged.
