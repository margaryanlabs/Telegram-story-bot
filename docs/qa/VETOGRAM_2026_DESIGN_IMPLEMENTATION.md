# VETOGRAM 2026 — premium experience · design implementation

Date: 2026-10-24 · Draft feature PR #181 · **not production**.

## Goal

Make the existing Telegram Mini App feel like an everyday messenger first, and a compact toolkit second. Retain the real Telegram account, Anti-Delete, Stories, Voice, Studio and VETO AI behaviors; do not swap them out for a demo or enable unverified features. No paid fonts, AI calls, GitHub Actions or remote assets were added.

## Changes in the actual existing app

- A new final-loading stylesheet `public/vetogram-2026.css` harmonizes the app shell, dark/glass surfaces, coral-accent navigation, mobile hierarchy, main home hero, six capability cards and existing Stories, Privacy, Voice, Studio, viewers and AI screens.
- Chat list design is tightened around a compact header, search and readable conversations; a one-tap row opens **VETO AI**, **Anti-Delete**, and **Story Engine**. These are normal `data-open-screen` navigation actions and do not read data or auto-publish.
- New `public/vetogram-command-2026.js` provides a privacy-safe, native-dialog command palette. Open with a dedicated header button, Ctrl/Meta+K, or **/** when not typing. Search filters nine fixed module destinations. Enter opens the first match; Escape closes and restores focus. Login/connection is only invoked after clicking that explicit action. Neither chats nor inputs are indexed, logged or persisted by this palette.
- The markup in `public/studio.html` loads the new CSS last, integrates one accessible search dialog, a real command trigger and chat quick actions. The old visual intro, auth routes, Story Engine, permissions, APIs, account ownership and server modules remain intact.
- Three legacy `data-open-screen` buttons incorrectly addressed non-existent `stories` or `ghost` pages, plus one Story Engine `creator` button. They now route to real `publish`, `privacy` and `studio` sections, respectively.
- Story Engine hero copy is localized to Russian. Active dark and light appearance options are maintained; no new persistence or external libraries.

## Quality controls and evidence

- `tests/vetogram-command-2026.test.js` is dependency-free, registered in the existing `ci:offline` and `qa:core:offline` scripts. Seven actual JS/HTML-source behavior tests passed in a V8 sandbox (open/close, keyboard and search, explicit connection click, navigation failure, accessible markup, all declarative links target existing screens).
- Final CSS has balanced rule braces, defined safe-area breakpoints, reduced-motion mode, compact phone breakpoints and theme variables.
- A separate **standalone interactive design preview** was created for visual review. Its interactions were exercised in headless Chromium at 320px, 390px and 1366px, with no JS page errors or horizontal overflow. It is a UI illustration with fictional contacts, not the production Mini App and not an integrated Telegram E2E run.
- Native browser visual QA of the complete real source across every legacy module, real Bot API, live Telegram accounts and paid subscriptions remain separate release gates.

## Follow-on priorities

1. Real Telegram mobile WebView visual verification of live chat list, composer, story viewer, permission flows, overlays and bottom dock; compare iPhone/Android and Fold sizes.
2. Apply the same density/spacing system to remaining legacy nested control cards without hiding permissions or warnings.
3. Validate accessibility, screenreader labels and light theme contrast with real DOM and keyboard focus.
4. Ship only after authorizing an explicit production release and verifying database/env configuration, Telegram publishing and Anti-Delete end-to-end.

**No production merge, migration, paid action, credential change or deployment has been performed.**
