# VETO MEDIA · Independent Mini App (beta foundation)

**URL when this branch is deployed by an approved static host:** /media.html  
**Production VETOGRAM remains untouched.** This is a separate frontend and brand surface, not part of VETOGRAM sign-in, Telegram Business, messaging, Stories, or relay.

## Already implemented on this branch

- Shared VETO mark from \`public/veto-telegram-mark.svg\`, own MEDIA wordmark, premium mobile/dark interface, light theme, independent navigation.
- Music discovery/search via public Audius endpoints and user-initiated HTML5 streaming for publicly accessible tracks; skip stream-gated/scheduled items; artwork-driven active-track scene, seek, queue next/previous, local favorites, playback errors.
- Books search via Gutendex public-domain flag, Russian/English filters, cover images, in-app TXT reader **only if** source allows cross-origin fetch, font controls, reading position and local favorites.
- Local TXT import (2 MB max) with reader and reading-position persistence; files are processed in the browser and never uploaded.
- Personal EPUB shelf in browser IndexedDB (DRM-free, up to 35 MB per book and 30 books), EPUB.js renderer, chapter navigation, last-read location, adjustable font, and PURE/CINEMA/DEEP reading modes with local per-book notes.
- LibriVox catalog browsing and in-app playback of available chapter stream URLs from the official API, with original-source deep links; no copied MP3 files.
- WebApp ready/expand if opened inside Telegram, but public browser route works without Telegram login.
- Status and failure states for unavailable providers, localStorage-limited devices and failed streams.

## Limitations / do NOT claim production readiness

- Real-provider live calls, CORS permissions, rights clearance, catalog completeness, mobile audio background behavior and playback inside Telegram iOS/Android WebViews are **not verified end to end**.
- No Spotify, Yandex Music, VK Music, major-label streaming, or Telegram file scraping is built in. Their catalogs are not interchangeable public content APIs. No license bypass.
- Audius is an open catalog but every track's redistribution/monetization rights and API terms must be reviewed for a commercial VETO product.
- Project Gutenberg public-domain metadata is not a worldwide clearance. Respect local copyright rules, particular edition and territorial restrictions. Do not mirror the complete Gutenberg website.
- The original **Living Reading Lab 2.4 / «ПОКА ТЫ ЖДАЛ»** code and publishing lab were located in the user's connected Google Drive (canonical release folder: https://drive.google.com/drive/folders/1Z4NYDNTjajUJEfm9DewX-41hkaZb9PLj ; source kit `Poka_Ty_Zhdal_Book_First_2_4_Source_Kit.zip`). The beta includes a newly implemented personal EPUB reader with PURE/CINEMA/DEEP modes inspired by that product, but **is not yet a source-level migration** of the original Living Reading Lab modules, its editorial publishing studio, highlights, EPUB archive export/import, or full rights-ledger workflow. The source kit contains the user's original unpublished book manuscript; because this GitHub repo is public, do not copy that source kit or manuscript into the repository without an explicit publishing decision. Future reuse should extract generic reader/editor components only and preserve rights-gating.
- Audiobook WebView stream verification, EPUB structure-security hardening (the original Living Reader's full ZIP and metadata validation was not migrated), cloud bookmark sync, subscriptions/Stars, recommendation AI, moderation and full catalog ingestion require subsequent development.
- No bot is provisioned or configured. To use as a distinct Telegram Mini App, register a separate bot with @BotFather and connect a deployed HTTPS URL. Do not point the existing VETOGRAM bot at MEDIA.
- No deployment was made by this branch.

## Content roadmap

| Provider | Type | Implemented | Commercial caveat |
|---|---|---|---|
| Audius https://docs.audius.co/api/ | Independent music | Catalog + audio client | Confirm API terms & rights per item before monetizing |
| Gutendex https://gutendex.com/ | Gutenberg book metadata | Browse/search/filters + best-effort TXT reader | Public domain status varies by country and edition |
| LibriVox https://librivox.org/api/info | Public-domain audiobooks | Browse/source links + best-effort in-app chapter streaming | Attribution, recording and territorial rights |
| Open Library https://openlibrary.org/developers/api | Book metadata | Planned (not connected) | Not a bulk third-party database or unrestricted reading API |
| Jamendo https://devportal.jamendo.com/api_terms_of_use | Independent CC music | Not connected | Commercial API use requires separate arrangement |
| Yandex Music, VK Music, Spotify | Commercial popular catalogs | Not connected | Licensing, territorial rights, partner integration required |

**Music sourcing:** artists and labels -> distributors/aggregators -> platform under negotiated rights. Initial commercial strategy: direct opt-in independent artists and licensed catalogs; for Russian and international hits seek rights holders or a licensed B2B provider. Never present scraped Telegram collections as a legal distribution feed.

**Telegram payment:** For digital services sold inside Telegram, integrate Stars (XTR) in a later phase; pricing and entitlements are not part of this beta.

## Dev / review

Static site files: \`public/media.html\`, \`public/media.css\`, \`public/media.js\`. No bundler, database, token or paid hosting required to inspect the UI. Serve the \`public\` directory on any static HTTPS host (or a local HTTP server for browser-only inspection). API availability may vary by origin due to CORS and network restrictions.

QA checklist:
1. Mobile Android/iOS layout at 320, 390, 768px and desktop.
2. Open as normal web page and inside Telegram WebView, check no phone auth request.
3. Audius trending/search/stream; fail closed for unavailable or gated tracks.
4. Gutenberg search RU/EN, public-domain labels, open source TXT when permitted; otherwise original source link.
5. Local TXT import, reader size and progress across reload; local EPUB import, reading mode, pagination, chapter navigation, and IndexedDB persistence. Verify no EPUB executable scripts run and malicious ZIP structures are rejected before any public launch.
6. Favorites, previous/next, seek and reduced motion.
7. LibriVox source attribution + clickthrough.
8. No changes to VETOGRAM flow or production deployment.

## Project architecture

\`Telegram-story-bot\` currently contains VETOGRAM and this isolated sibling **frontend** for shared brand assets. It is not a shared production backend. After beta validation, move VETO MEDIA into a dedicated repository/domain, retain shared design tokens, and onboard its own Telegram Mini App bot.
