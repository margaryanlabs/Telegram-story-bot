# Vetogram V9 — Monochrome Shell & Product Architecture

**Status:** isolated design candidate, not production-ready. Branch based on RB12 preview snapshot f731b687. The main production branch is unchanged. Original 8.5 baseline is kept at backup/vetogram-8-5-render-review-20261105.

## Source diagnosis
- Studio loads 32 CSS sheets. The RB12 generated final stylesheet had 1,489 important declarations.
- Four bottom tabs excluded Games; the game screen exists, but navigation mapped play to Media.
- Media included a decorative giant header before content and two competing searches (public catalog, private library).
- Cinema, Music, Books render in independent iframes with their own CSS, not controlled by parent styling.
- Real Android Telegram screenshots and login/replay E2E were not run for RB12.

## IA — primary destinations
Chats / Stories / Media / Games / Protection, with Profile through the avatar.
Media is Cinema / Music / Books only; Games is a separate immediate destination.
Keep owner-scoped Telegram authorisation, legitimate live status, archives, saved chat wallpaper, and persistent music player.

## Stage 1 implementation in this V9 branch
1. Five persistent bottom tabs; corrected Games parent route and native Back classification.
2. Removed duplicate Games card from Media without deleting its handler; simplified Media hero and mobile module cards.
3. Replaced blue presentation tokens across editable chat, media, privacy, account, foundation and embedded-module CSS sources with graphite monochrome tokens. Regenerated deterministic CSS bundle.
4. Optional extremely subtle monochrome hero glow only on fine pointer with motion allowed; no new animation in chats or reader.
5. Unified cache identity for 74 Studio CSS/JS asset links and updated embedded module stylesheets.
6. No changes to APIs, Telegram login, OTP, database, bot or actual media playback.

This first milestone does NOT eliminate the 32 historic CSS layers; staged consolidation is needed after visual QA. Do not call this a fully rebuilt product.

## Stages 2–4 proposed, not implemented
**Media:** Cinema must show actual poster catalog, genres, details and available legitimate playback; Music must separate licensed playable audio from radio, preserve one player and explain load failures; Books must have real texts with legal availability, language/genre selection, reader typography and progress. Local collection search moves into a secondary disclosure rather than competing with catalog discovery.

**Games:** Six existing offline games visible immediately, each can launch and return with one clear Back. Online rooms, ranking and developer submission move to secondary areas; unfinished multiplayer must never be presented as active.

**Technical:** One UI navigation/state adapter, ordered tokens/base/components/screens/theme CSS; remove old important overrides incrementally with screenshots. Keep iframe owner-scope postMessage safety until a replacement is fully tested. Avoid replacing current messaging/Telegram backend.

## Release gates
- Screenshots and actual interaction checks for 320/360/390/430px, Android Telegram WebView, keyboard, folded devices, black/white theme, custom chat wallpaper.
- Games in 1 tap; each media destination in <=2 taps; Back does not lose chat drafts or persistent playback.
- Real login/logout/QR/OTP tests; Stories, player, catalog, ownership, consent, permissions, network/error states.
- Full npm check/test, offline gates, source tests, CSS parity, no-scroll-overflow and visual baseline comparisons before any release.
- A staged deployment requires SHA check and actual live HTML/CSS verification. Keep main untouched, preserve old Render fallback and documented rollback.
