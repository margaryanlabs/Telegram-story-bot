# VETOGRAM REBORN — RB1 (audit and core navigation foundation)

**Date:** 2026-11-05  
**Repository:** `margaryanlabs/Telegram-story-bot`  
**Base:** `feat/vetogram-black-universe-preview-api-20261101`, commit `8188a3be` (published Vetogram 8.5 Render visual-review snapshot).  
**Status:** review only. **Do not merge into `main` or publish to `veto` production** without acceptance.

## Evidence from the existing repository

- `main` is still at commit `6504a387` (2026-10-22): it is **not** the 8.5 Render preview.
- `public/studio.html` on the 8.5 preview branch loads **30 separate CSS stylesheets**, ending in `vetogram-editorial-80.css`. At least several successive design generations are active at once. This is a maintainability and cascade risk, **not** evidence that every stylesheet is unused.
- Studio contains **16 screen identifiers**: `home`, `telegram`, `voice`, `publish`, `viewers`, `analytics`, `privacy`, `chats`, `ai`, `story-engine`, `studio`, `relay`, `archive`, `media`, `profile`, and `play`. A screen identifier does not establish that the end-to-end feature works.
- Before RB1, the bottom bar has **six** destinations: Chats, Stories, Games, Media, Protection, Profile. This duplicates entry points already available inside the existing app.
- Music, Cinema and Books are separate documents loaded in same-origin frames by `public/vetogram-universe.js`. They each have their own JS/CSS stacks. The route owner and owner-scope messages already exist; do not replace them with a detached mockup.
- The Render 8.5 preview server (`scripts/vetogram-preview-server.mjs`) explicitly disallows authenticated Telegram APIs; it is a **visual review server**, not proof that login, chat send or Anti-Delete work in production.
- Existing test files cover chat polling, cross-chat send, navigation, media status, reader retries and privacy boundaries. Their presence is not a substitute for actual Android / Telegram WebView tests.

## Product decision — ONE CORE, OPTIONAL MEDIA

**Main bottom bar:** Chats | Stories | Media | Protection.

Profile remains behind the existing top-right profile button. Games remain reachable from Media Hub and other existing shortcuts, but no longer compete for a bottom-bar slot. Preserve every existing screen and its route for backward compatibility, including direct links.

**Positioning:** Vetogram is a Telegram workspace with transparent privacy tools. Media is a secondary experience, not the first reason to grant account access.

## RB1 deliverables

1. Remove only the two duplicate bottom-bar **buttons** for Games and Profile. Do not delete the screens, scripts, data, or deep links.
2. Add a **last-loaded, studio-only** foundation stylesheet for core hierarchy, four-item mobile navigation, focus visibility, and reduced-motion respect. Do not touch user chat wallpapers, Telegram login, sender logic, or media iframe payloads.
3. Add a regression contract in `tests/vetogram-reborn-foundation.test.js`.

## Prioritized acceptance gates before marketing

| Priority | Gate | Evidence needed |
|---|---|---|
| P0 | Trust and access | Real Telegram login + QR recovery, logout, expired session and wrong-owner tests. No fake connected states. |
| P0 | Messages | Inbound/outbound, media, stickers, retry and offline return tested on actual Android and Telegram WebView. |
| P0 | Privacy | Document which messages Anti-Delete *can* archive, consent model, deletion and retention, encrypt-at-rest verification. Avoid absolute recoverability claims. |
| P0 | Honest preview | Preview must not masquerade as an authenticated or fully functioning production client. |
| P1 | Navigation | Four bottom destinations, back/forward, screen restore, Media iframe return, keyboard/focus and 320–430px layouts. |
| P1 | Media | Licensed/authorized source records, playability, reader completeness, coherent metadata/cover fallbacks and empty states. |
| P1 | Visual QA | One token system; inspect computed styles in *all four documents* before retiring any inherited CSS. |
| P2 | Games and extra tools | Keep available in Media/secondary navigation but don't block a focused initial launch. |

## What is deliberately *not* claimed by RB1

This is **not** a finished visual overhaul, production-grade chat verification, media catalog audit, or deploy. A passing source-level regression only verifies markup and asset wiring. Server health checks and physical-device review remain necessary. No API, database, production domain, authentication flow, or external deployment is changed.

## Next safe slices

- RB2: audit computed CSS and consolidate tokens per module without one more unscoped override. Screenshots at 320, 390, 430px, desktop and reduced-motion.
- RB3: Telegram login/chat/stories functional QA with real authorized test accounts, deterministic fixtures and session ownership boundaries.
- RB4: media content sourcing and honest playability states; remove misleading recommendations and broken cards.
- RB5: closed alpha and measurable release criteria (activation, successful first message, user-reported navigation errors, crash rate).
