# VETOGRAM 3.3 — Product art direction and visual release matrix
25 October 2026 · draft PR #181 · existing real Telegram Mini App, **not deployed**.

## Decision
Make the product feel more like a mature messenger with powerful utilities, not a dashboard of oversized marketing cards. Signed Telegram and privacy permissions remain independent.

## Implemented
- **One branded, concise hero** with the *actual* VETOGRAM SVG, the user-selected chat and connection actions, no invented performance indicators. Real app now uses a more concise Russian value proposition.
- **Real readiness next**: existing owner-bound Telegram/Anti-Delete/Stories status controls keep their exact original IDs and callbacks. A permission state does **not** claim restored messages or a published Story.
- **Discovery moved out of hero** into a dedicated six-button section (Privacy, audience, Story Studio, AI, Voice, Relay); all original `data-open-screen` destinations remain. Restore-last-action and explicit advanced screen still exist below.
- **Visual system:** 3.3 additions live in the already-last-loaded `public/vetogram-finish-2026.css`; consistent coral accents, navy/graphite surfaces, brand watermark, border hierarchy, compact 3/2/1-column feature grid, readable titles, safe-area-friendly bottom navigation, focus-visible and reduced-motion support.
- **Real messenger:** preserved compact real chat rows and existing message composer; no fake conversations or interactive showcase.
- **Mobile Story Studio:** replaced five unreadably tiny template columns with horizontally scrollable, readable 128px cards and snap behavior. Existing selected template and publishing controls retained.
- **Eight AI modes:** horizontal chip rail with >=45px tap targets; no network calls or auto-send from any visual component.
- **Russian UI:** shorter names/descriptions; preserved familiar product names (Story Studio, VETO AI, Relay) where they refer to real modules.

## Checks and evidence
- `tests/vetogram-mobile-command-center.test.js`: updated legacy swipe-rail expectations to new hierarchy and responsive grid; 5/5 scenarios executed in isolated V8 against current GitHub sources, passed.
- `tests/vetogram-product-art-direction.test.js`: four source and contrast checks added to `qa:core:offline`, `ci:offline`, and `check`; 4/4 V8 executions passed. Card foreground/background color combinations exceed WCAG AA 4.5:1.
- A browser rendering, Telegram iOS/Android WebView, real safe area, Fold, performance/FPS, touch/keyboard, Stories publishing, Telegram auth and API integrations have **not** passed physical/remote testing in this turn. A production readiness claim would be false.

## Release visual acceptance
Test actual new Preview once infrastructure unblocks, with a signed consenting Telegram test account:
1. Width 320px, 350px, 393px, 768px and desktop; no horizontal page overflow; toolkit 1/2/3 columns as designed; genuine navigation and no dead touch areas.
2. Theme Graphite / Pearl / Slate / Linen. Cards' main/secondary labels remain legible, focus/selected state visible, no dark-on-dark tokens, no content covered by 5-tab bottom nav.
3. Fold folded and unfolded, iPhone viewport/keyboard, Telegram safe-area bottom, Android WebView and reduced-motion preference.
4. Live connection checks remain truthful (permission is not delivery), loading/failed/offline show clearly; no fabricated followers, successful publish, or Pro entitlements.
5. Story Studio: 10 templates remain reachable with swipe/keyboard, active state visible and export/publish require explicit confirmation.
6. VETO AI: eight modes accessible with swipe/keyboard; draft/recipient/consent controls remain usable; AI backend remains OFF until quota+provider verified.
7. Chats: pinned/focus filters, search, composer, media previews, voice, and keyboard work with real owner data; no jump, lost scroll position or misaligned send button.
8. Compare latest real page screenshots against the intended brand direction before claiming visual QA complete.

## Infrastructure blockers unchanged
- Main/Production not merged. Vercel new branch previews canceled, current commit check advertises build-rate-limit, no usable new build.
- Committed npm lock file must be refreshed from trusted official registry; GitHub Actions runner availability unverified.
- Neon currently at storage schema v4; additive AI/Tasks/Reminders migrations not applied and providers not configured. Do not turn on paid provider or make DB changes without preflight.

## Next engineering gate
Fix authentic npm lockfile -> run full tests/build and disposable Postgres migration suite -> obtain valid Preview in the **second** Vercel account `labsmargaryan@gmail.com` -> perform the visual + Telegram integration matrix -> one controlled production release.
