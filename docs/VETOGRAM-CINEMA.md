# VETOGRAM CINEMA — standalone Telegram Mini App (V1)

**Status:** GitHub-only feature branch. **No production deployment or publishing** until the product owner explicitly requests it.

## Location and design

- Entry: \`public/cinema.html\` (standalone webview URL will be \`/cinema.html\` after a future deploy).
- Separate \`public/cinema.css\`, \`public/cinema.js\`, \`public/cinema-catalog.js\`. Does **not** change VETOGRAM Messenger, Music, Books, existing routes, API or production.
- Design language reproduced from the existing Music/Media \`public/media.css\`: background \`#090d18\`, surfaces \`#11182a\`/\`#18223a\`, text \`#f5f6fc\`, muted \`#96a2bb\`, accent \`#fa7562\` with soft \`#ffb5a6\`. Shared \`veto-telegram-mark.svg\` icon.
- **Figma design file not verified**: the exact Figma URL/node identifier was not present in the available repo/context. This implementation uses the actual existing VETO MEDIA brand CSS as reference, not an invented claim that it was exported from Figma.
- Dark/light preference, safe areas and mobile-first navigation. Telegram SDK guarded \`ready/expand/BackButton\`; works in normal browser.

## What actually works

- Curated Russian-interface catalog with 12 Blender/open movies, year, synopsis, creator and source links.
- Filter by genre; Russian/English title, year and genre search.
- Responsive film details, watch action, favorite toggle, clipboard/native share deep link via \`?film=sintel\`.
- \`<video>\` player with native controls, seek ±10s, rate selection, fullscreen, PiP where supported, actual video quality switch when derivatives exist; buffer/error messaging and original Commons source.
- \`localStorage\` favorites/recent progress/resume/continue rail (per-device, not Telegram cloud sync).
- Poster preview from real Commons \`videoinfo.thumburl\` where available; CSS fallback with no mismatched movie posters.
- Russian subtitles: tries MediaWiki TimedMediaHandler \`action=timedtext\` for each exact movie with \`lang=ru&trackformat=vtt\`, attaches only when valid \`WEBVTT\` returns. Unavailable captions are clearly reported.
- Russian dubbing: \`Film.editions\` integration contract for **authorized** alternative complete movie streams with rights/attribution and Russian audio. No dubbed streams included until actual verified licensed files are supplied. No deceptive RU audio toggle.

## Video providers and licensing

Source: \`https://commons.wikimedia.org/w/api.php\` \`action=query&titles=File:EXACT_FILENAME&prop=videoinfo&viprop=url|derivatives&origin=*\`. Only HTTPS transcodes 240–720p compatible with the user's browser are offered. Streaming from Commons may still be limited by network, geo, browser codec or bandwidth; display errors instead of silent/fake playback. No movie files are mirrored, cached on our server, downloaded or redistributed.

Source/rights: each card links to its exact Wikimedia Commons file, project's original website, author/studio and Creative Commons license. Conditions may differ by film or country; individually review licenses and required credits before a commercial launch. Do not strip original credit scrolls.

For Russian dubbed version **only when rights permit**, add a checked alternative edition:
\`\`\`js
film.editions = [{id:'ru', label:'Русская озвучка', url:'https://licensed.example/full-dubbed-film.mp4', license:'rights record / contractual grant', credit:'Licensed dubbing producer'}];
\`\`\`
This is a documented **example**, NOT a live endpoint. The runtime rejects edition entries without HTTPS url, license, credit. Full-video edition switching is supported; a separate audio-only overlay without synchronized licensing is **not** implemented.

Never scrape/embed Kinogo, HDRezka and similar unauthorized film mirrors. Metadata providers (TMDB, TVmaze) are *not* streaming rights or media files. Better next provider integrations: licensed regional OTT partners, public-domain archives with per-item license checks, creator direct uploads with documented consent.

## Local validation (no deployment)

\`\`\`sh
npm test
node --check public/cinema.js
node --check public/cinema-catalog.js
\`\`\`

\`tests/cinema-contract.test.js\` checks asset wiring, source policy, film catalog uniqueness, and script syntax. Browser runtime/device streaming remains a **separate validation requirement**.

## Later, when authorized to deploy

Deploy public folder over HTTPS, then use a dedicated Cinema bot/entry via @BotFather with URL \`https://<HOST>/cinema.html\`. Production bot credentials are **not** stored in client assets; verify origin and Telegram initData server-side if accounts/subscriptions are added. Actual deployment, DNS, bot linking and live playback QA remain pending owner's explicit command.


## V2 feature-branch development (27 October 2026; not deployed)

Cinema now includes **15 items: 12 Blender/open films plus 3 full Russian-language Mosfilm channel videos**. These three are referenced through RUTUBE's documented iframe embedding interface, with RUTUBE as the streaming provider and rights holder's channel credited:

| Entry | Official video |
|---|---|
| Любовь и голуби | https://rutube.ru/video/68781d890618ea50933ec020fd5060bf/ |
| Афоня | https://rutube.ru/video/97251d193ac780c0138596f3aea972c0/ |
| Тот самый Мюнхгаузен — серия 1 | https://rutube.ru/video/2a0058219dc6990f2a356fbc47a59923/ |

Official embed format: \`https://rutube.ru/play/embed/VIDEO_ID\` — documented at https://rutube.ru/info/embed/.

- \`public/cinema-provider.js\` is loaded before \`cinema.js\`; it supports authorised \`iframe\`, HTTPS MP4/WebM, native HLS and on-demand hls.js. RUTUBE is the only currently enabled iframe origin.
- Film pages, search, favorites and brand colors are the same UI; RUTUBE frames replace the HTML5 player only for official embed entries.
- No Russian voiceover is synthesized or copied, no movie is downloaded/uploaded/rehosted, and there is no Kinogo/HDRezka integration.
- RUTUBE has its own controls and licensing; a third-party iframe cannot automatically use our HTML5 seek or audio controls. No false playback-sync claims.
- Public RUTUBE embedding is not a Creative Commons film license and commercial distribution rights may need separate approval.
- Unit/static DOM tests and a mocked iframe interaction check passed. Actual end-to-end network playback in Telegram on Android and iOS is **not verified**.
- Four-product repo status is documented in \`docs/VETOGRAM-FOUR-APPS.md\`.
