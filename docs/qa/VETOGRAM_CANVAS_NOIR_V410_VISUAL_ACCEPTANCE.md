# VETOGRAM — Canvas Noir V4.10: visual acceptance contract

**Repository:** `margaryanlabs/Telegram-story-bot` · same codebase / draft PR #185.  
**Chosen direction:** original first Canvas Noir concept — editorial hierarchy, fast Telegram-like chat, calm premium surfaces, genuine product states, progressive disclosure, no decorative fake service readiness.

> **Status:** implemented source-level design improvements, automated behavior/contrast checks, **NOT visually accepted**. No Playwright/real Telegram WebView screenshots have been produced for this unreleased branch. Do not claim pixel fidelity or production readiness until manual/browser QA below is finished.

## What changed in this implementation

- Canonical `public/vetogram-noir.css` remains the sole Canvas Noir presentation layer. No parallel landing page, demonstration UI or extra override stylesheet.
- Distinct `graphite`, `slate`, `pearl` and `linen` palettes; themed AI composer and Story form controls use actual color tokens, not white text hardcoded on light backgrounds. The **rendered JPEG canvas remains unchanged** by system/theme selection.
- One legible 44px+ mobile action vocabulary. Brand, search, appearance, and avatar do not compete for Fold's limited top-bar width. At widths <=420px command search becomes icon-only but keeps its accessible label.
- Real Chat rows receive restrained focus/hover feedback; compact scrollable filters remain visible. Fullscreen messaging uses its own full-height page and does not inherit ordinary dashboard max-width.
- Real AI secondary-mode disclosure now labels the *selected* mode; switching back to a primary mode collapses it. Selection reflects the authoritative `aria-pressed` source and does not send anything.
- Voice presets reflect actual `aria-pressed` effects, not a mock signal. Recorder controls and microphone display remain wired to the real recording lifecycle.
- Story Studio tabs remain directly reachable by horizontal touch/keyboard scrolling. JPEG publishing and layer/editor controls retain original event handlers and IDs. Light mode affects the form, never Story artwork.
- Landscape <=560px, Fold width <=359px, high contrast, forced-color and reduced-motion variants have explicit styles.

## Human / browser acceptance — not yet signed off

Test **all** of the following before marking `Design: Approved`.

| Surface | Acceptance threshold |
|---|---|
| Chat list | Search and chat rows dominate first fold; no unnecessary dashboard wall; loaded/empty/connecting/error states distinguish actual data; no clipping on long names |
| Open conversation | Thread header readable with long names; keyboard and safe-area controls reachable; photo/gallery/menu dialogs stay above messages; scroll position stable |
| Privacy & Anti-Delete | Live/unknown/degraded protection clearly distinguished; archived messages and real evidence readable; consent wording never implies deleted content was already recovered |
| Story Studio | True 9:16 canvas fits 320–430px; horizontal tools selectable; selected layer controllable; portrait, wide photo and empty photo safe; publisher handoff requires explicit confirmation |
| Story publisher / Portal | Caption, audience and single JPEG review readable; Portal checkbox off by default; standard Business-only link clearly marked and not shown as already attached |
| AI | Current mode always identifiable; conversation vs form visually separated; consent checkbox and send button visible; text long/empty/busy/error states and approval workspace functional |
| Voice | Microphone off is truly static; permission, live, recording, finished and error states distinct; disabled recording buttons honest; controls accessible with keyboard |
| Viewers & analytics | Unverified counts appear as unknown rather than zeros; new user session clears previous user's details; charts/text readable at compact widths |
| Global chrome | 4 destinations obvious; Fold header is not crushed; theme menu fits viewport; one active destination; sheets trap keyboard focus and close in correct order |

### Required viewport and state matrix

- **Portrait widths:** 320, 359, 360, 390, 430, 768 and 1024 CSS pixels.
- **Fold/landscape:** split-screen widths below 359px; landscape visual height 560px or less; on-screen keyboard open and closed; safe area with Android gesture bar/iOS bottom inset.
- **Palettes:** graphite, slate, pearl, linen — check contrast on real device, not only theoretical CSS variables.
- **Accessibility:** 200% text size, screen reader labels and focus order, reduced motion, forced colors / increased contrast where supported, disabled/enabled button affordances.
- **Product states:** Telegram missing, signed account connected without Business, Business permission disabled, source data degraded, offline/online, in-flight AI request, awaiting microphone permission, active recording, AI provider quota stop, delayed network response, owner A→B→A.
- **Acceptance proof:** screenshots or screen recordings from the actual branch/WebView for each high-priority viewport/state; verify no horizontal overflow, no unreadable text, no cut-off confirm button, no hidden focus, and no fabricated successful state.

## Evidence already checked from source

- Isolated `tests/vetogram-v4-visual-hierarchy.test.js`: 9/9 current control, mobile CSS and real secondary-mode behavior checks.
- Isolated `tests/vetogram-v4-light-theme.test.js`: 5/5 token, light-mode form, real Russian UI wording and distinct-theme checks. Measured light/dark theme foreground tokens against background and surface at **>=4.5:1**.
- Previous V4.8 focus / mobile modal checks: 9/9 shared sheet, 5/5 full-screen focus; previous V4.7 Viewers and V4.6 Story tests remain part of focused Node test list.
- Full Node test runner and actual browser screenshots were **not** executed in this tool environment. Source assertions do not verify layout engine metrics or visual quality.

## One release, not a stream of previews

Keep PR #185 draft. Before one merge/deploy: clean `npm ci` and `npm run vercel-build`, visual/browser acceptance matrix, two signed Telegram accounts, real Story publishing, AI authorization and voice permission on devices. Do not spend credits, enable flags, apply Neon migrations or activate Telegram Business without a separate verified release plan.

### Source QA follow-up: immersive chat chrome specificity

The common Noir topbar uses `display:flex!important` and nav uses `display:grid!important`. These higher-specificity rules would otherwise defeat the older messenger's `body.veto-chat-active .topbar{display:none}` and `body.veto-chat-thread .bottom-nav{display:none!important}`. Added an explicit high-specificity immersive-chat override in the **same Noir stylesheet** and a regression test. This is tested for CSS contract correctness, not via an actual WebView screenshot.
