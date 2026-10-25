# VETOGRAM NOIR 3.0 — implementation and release gates

## Scope and base

This is an implementation in the existing `margaryanlabs/Telegram-story-bot` Mini App, not an independent demo. Branch: `feat/vetogram-3-premium-redesign`.

`main` was inspected at `6504a387d2b88961df3689792cd1c6d4d0e68571`. The current integrated product is a stack: PR #179 → #180 → #181. The redesign starts from the frozen PR #181 head `c8235b022dc748c973b7968b9f74b3ddafa5bfbd`, rather than dropping those existing Story Engine, AI, owner-isolation and release-safety changes. This base is a **draft release candidate, not verified stable production**. The redesign PR targets #181's branch to isolate the new diff. Review/merge upstream dependencies before retargeting to main.

No backend API, authorization, permission, database, migration, secret or Vercel configuration changes are included. No production deployment or paid service purchase was performed.

## Audit evidence

All nine user-provided screenshots from 25 October were inspected. The files show the actual unfolded-Fold interface, not a new design concept.

| Source screenshot | Finding | Implementation |
| --- | --- | --- |
| `1000067908(1).jpg` | Messenger header, status, connection CTA, search and filters compete above the list. | Neutral compact messenger header, restrained search/filter surfaces and flat dialogue rows. |
| `1000067910(1).jpg` | Large marketing hero and repeated connection panels occupy Home. | Editorial task heading, compact live status, six tool shortcuts, recent sections and real activity. |
| `1000067912(1).jpg` | Oversized tool cards and another large resume block. | Compact two-column phone / six-column desktop tools, smaller recent-section area. |
| `1000067914(1).jpg` | Workflow deck repeats tools and pushes useful content below the fold. | Existing actions remain wired; duplicate workflow deck is hidden in the daily Home composition. |
| `1000067916(1).jpg` | Studio landing hero and templates appear before the working canvas. Bottom navigation visually covers editor content. | Canvas-first layout, horizontal miniature templates, contextual inspector and measured bottom chrome reservation. |
| `1000067918(1).jpg` | Canvas occupies a very long standalone card; controls are on another part of the page. | Canvas and inspector are siblings on wide layouts; compact canvas above tools on narrow layouts. |
| `1000067920(1).jpg` | Long form, English technical labels and large gaps between related controls. | Text/photo/layers/sound/idea/link/project tabs, Russian vocabulary and dense field sizing. |
| `1000067922(1).jpg` | Layers, local template helper, Portal and storage are arranged as separate long forms. | One selected inspector at a time; visible distinction between local composition and real AI handoff. |
| `1000067924(1).jpg` | Publication has a landing-page hero, connection strip, floating action and floating navigation. | Smaller publishing header and shared geometry for navigation/action dock. |

Privacy, analytics, viewers, stickers, Voice and AI were also inspected in the current source. Their full signed-in browser journeys were **not** available. The existing preview URL opened to Vercel's “You Need Access” screen. The cloud browser could not connect to the development container's localhost; direct local file navigation was blocked by browser policy. No bypass of those browser restrictions was attempted.

## Implemented

- Shared NOIR tokens: graphite `#070A11`, midnight `#111A2B`, border `#263550`, coral `#FF7887`, violet `#8A83F5`, soft white `#DDE7F6`; explicit light-theme tokens.
- Existing VETOGRAM SVG preserved. Decorative brand dots/background effects are removed from the new composition so they cannot suggest a verified connection.
- Shared focus, disabled, touch, radius, typography and motion rules across the existing app. CSS-only motion and reduced-motion handling; no WebGL or new production dependency.
- Full-width bottom navigation, measured navigation/action-dock heights, safe areas and keyboard states. Existing device/WebView controller is retained.
- Home becomes a daily workspace: existing status sources, working six-tool grid, session-only recent sections, real existing activity feed. No fabricated messages, usage, revenue or protection states.
- Messenger visual treatment covers the actual `.veto-mirror-chat` rows, avatars, search, shortcuts and header; existing search/filter/paging/thread controllers remain intact.
- Stories reuse the existing media viewer, gestures and no-receipt guard. Viewer styling and entrance motion are unified. Publishing reuses the existing owner-bound file/audience/confirmation flow.
- Privacy and secondary screens share surfaces and hierarchy; existing verification, archive permissions and diagnostics remain authoritative.
- Story Studio has three modes: Quick, Pro and AI Director. Modes select contextual tools; Quick hides advanced Layers/Portal tabs without disabling their existing features.
- 9:16 canvas, ten typed template miniatures, contextual text/photo/layer controls, keyboard layer movement, pointer drag, selection outline, separate modal preview and existing JPEG publisher handoff.
- In-memory undo/redo for composition/media/layers/Portal, bounded to 24 entries and approximately 32 MiB of distinct historical photo strings. The history resets on owner/draft changes and never writes to browser storage.
- Local Magic Remix cycles visual style while retaining title, media and layers. It is explicitly described as local; it does not call an AI model.
- Own music selection/preview, validation and optional real MediaRecorder clip export up to eight seconds. No microphone, uploads or automatic publishing. MP4/WebM availability is browser-dependent. Sound is not included in JPEG or saved drafts.
- VETO Orb animation is tied to actual AI busy/reset events. AI Director opens the existing real Story AI workflow and its explicit provider/consent checks; generation is not simulated.
- Broad Russian static copy cleanup and targeted dynamic labels. RU/EN/HY locale core and selector added for explicitly marked new chrome and tools. Locale translation never walks user chat/AI/archive content.

## Validation

- `npm ci --ignore-scripts --no-audit --no-fund` completed. Production dependency versions and lockfile are unchanged.
- `npm run vercel-build`: production gate (`lock:check`, `ai:preflight`, JavaScript syntax checks, full Node suite) passed: **713 tests, 712 passed, 1 skipped, 0 failed**.
- This repository is plain JavaScript; no TypeScript project or dedicated lint task exists. All new runtime modules were added to the existing syntax gate.
- Ten new history/locale/soundtrack tests passed. Soundtrack tests use a fake recorder: they prove input validation, unsupported-browser behavior, download orchestration and cleanup, **not an actual phone codec or audio recording**.
- A DOM/canvas harness executed the full actual Story Engine module against the actual HTML: no duplicate IDs, no removed existing IDs, correct inspector parentage, ten templates, text/layer updates, Remix, undo/redo, preview and owner-switch history reset passed. This is not a layout browser or Telegram test.
- New CSS parsed successfully with PostCSS: 228 rules, approximately 32.8 kB / 6.4 kB gzip. No measured FPS, LCP or phone-memory benchmark is claimed.
- Declared text/background contrast ratios: dark main 13.95:1; dark muted 7.84:1; light main 16.05:1; light muted 6.26:1; dark coral CTA 7.82:1; light CTA 5.99:1. These token checks do not establish full accessibility conformance.
- `git diff --check` passed. No changes under `api/`, `lib/`, `vercel.json` or `package-lock.json`.
- The upstream base itself had three pre-existing test failures caused by a retired privacy.js cache key (699 pass / 3 fail / 1 skip). Assertions now require a versioned current asset rather than that obsolete exact key. Copy/navigation source assertions and sandbox collaborators were updated for the intentional UI and history changes; owner/permission/media isolation assertions remain.

## Remaining release gates

1. **Visual/device QA is pending.** No new browser-rendered screenshot, before/after rendering comparison or measured overflow result is claimed. Check 320/360/390/430/725/768/1024/1440 CSS-pixel widths, folded/unfolded Fold, iPhone keyboard/safe areas, Android and actual Telegram WebViews.
2. Verify real chats, code/QR login, Anti-Delete edit/delete delivery, publishing confirmation/Story ID, no-receipt viewing, Voice permission lifecycle and AI provider behavior with consenting real accounts. Passing mocks do not prove these integrations.
3. Play and download a clip on Android/iOS; verify actual audio, supported codecs, cancellation and Telegram compatibility. WebM can need conversion. A multilayer video timeline, audio trimming and cloud music catalogue are not implemented.
4. EN/HY cover the new chrome/tools, with Russian fallback. Full legacy diagnostics, server errors and older dynamic components still require localization. A fully localized whole-app EN/HY release is not claimed.
5. The earlier feature CSS files are retained for compatibility with the large existing app; the new token/composition stylesheet overrides their presentation. A wider removal of legacy CSS should follow rendered regression checks.
6. This is a draft stacked redesign; it is **not** certified launch-ready or visually signed off. No production release should be inferred from the automated results.

## Local review

Run the existing build gates, then serve the actual `public` directory, for example `python3 -m http.server 4173 --directory public`. Open `/studio.html?screen=home` and navigate all five tabs. This serves the real app assets; signed Telegram integrations still require their real backend and a genuine Telegram Mini App session.
