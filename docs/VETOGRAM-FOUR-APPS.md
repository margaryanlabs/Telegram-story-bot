# VETOGRAM UNIVERSE — four independently launchable Telegram products

## Source of truth

**Single GitHub repo:** margaryanlabs/Telegram-story-bot

**No release, merge into main, Vercel deployment, bot linking or infrastructure change was authorized in this work.** Implement changes in review branches. One repo does not require one runtime, one domain, or one Telegram bot.

| Product | Existing code | Current state | Target independent entrypoint |
|---|---|---|---|
| Messenger | main: public/studio.html | Existing main application | /studio.html |
| Music | feat/veto-media-foundation-20261026: public/media.html + media.js | Music works inside combined VETO MEDIA branch, not independently routed on main | /music.html — pending extraction |
| Books | feat/veto-media-foundation-20261026: public/media.html + media-reader.js | Reader works inside combined VETO MEDIA branch, not independently routed on main | /books.html — pending extraction |
| Cinema | feat/vetogram-cinema-standalone-20261027: public/cinema.html, cinema.css/js, cinema-provider.js, cinema-catalog.js | Independent implementation, pending device QA | /cinema.html |

We must not claim four projects are already individually deployed or that unfinished Music/Books entrypoints exist. They will share logo/colors while retaining own navigation, data contracts, privacy/consent and runtime.

## Shared design foundation

Reference: existing VETO MEDIA stylesheet (public/media.css on feature branch) and existing VETO logo (public/veto-telegram-mark.svg on main).

- Dark background #090d18, surfaces #11182a / #18223a.
- Brand accent #fa7562 with soft accent #ffb5a6.
- Text #f5f6fc, muted #96a2bb.
- Russian-first, mobile-first, respecting Telegram safe areas.
- No independently verified Figma frame/node yet; brand colors and actual repository assets are verified.

## Cinema's streaming model

User -> Cinema film page -> stored authorized publisher's official embed/player -> publisher/CDN delivers video directly into the user's Telegram WebView. **No video upload, rehosting, segment proxy, ripping, or DRM bypass.**

- Open-licensed Blender films via Wikimedia Commons and native video.
- Official Russian-language Mosfilm films via RUTUBE's documented public-embed mechanism; do not present the films as Creative Commons or sublicense them.
- Reusable source adapter for HTTPS video, HLS and origin-allowlisted iframe, with explicit license/credit metadata. Source adapter alone doesn't independently validate copyright ownership.
- Film metadata and public discoverability do not imply streaming rights. Individual territorial restrictions, age ratings and content terms must be respected.
- Embedded players may reject WebView, third-party cookies, geo/network or advertiser requirements. Always show direct original link when possible.

Verified official RUTUBE source examples at time of implementation:
- «Любовь и голуби» https://rutube.ru/video/68781d890618ea50933ec020fd5060bf/
- «Афоня» https://rutube.ru/video/97251d193ac780c0138596f3aea972c0/
- «Тот самый Мюнхгаузен», серия 1 https://rutube.ru/video/2a0058219dc6990f2a356fbc47a59923/

RUTUBE documents public embeds at https://rutube.ru/info/embed/. Embedding permission depends on current upload visibility/settings; that is not a blanket license to redistribute/repackage the video or sell access to it.

## Separate releases, later

1. Extract Music and Books into distinct document entrypoints once source branches are reconciled safely; avoid conflating release with code merge.
2. Deploy each of four apps as an independent site/bot or four routes with independent release controls as budget permits.
3. Use distinct Telegram Mini App URL per product with TLS/HTTPS. Never put bot tokens or Telegram session keys in web client.
4. Release cinema only after Android Telegram, iOS Telegram and desktop embed checks; verify Vercel/reverse-proxy frame/embed CSP and CORS settings. Do not invent test results.
5. If monetizing catalog, obtain provider consent/rights for intended distribution model; do not charge for copyrighted content without appropriate terms/authorization.
