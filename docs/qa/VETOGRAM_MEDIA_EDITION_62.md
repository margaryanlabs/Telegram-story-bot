# VETOGRAM 6.2 — Media Edition / Music · Cinema · Books

Date: 31 October 2026. GitHub-only work. **No deployment, merge, payment, storage migration or live Telegram access.**

## Starting point and integration

- Parent V6.1 PR #210 on `feat/vetogram-6-universe-20261028`. This is NOT a standalone media website; Music, Cinema and Books remain embedded in the same `studio.html` shell.
- New media branch `feat/vetogram-62-media-library-expansion-20261031`. Messenger Calm PR #211 and the separate Games (Plot Tank / Why Not?) work deliberately remain in their own branches. Reconcile them in one release branch only after tests.
- Entry pages `public/music-module.html`, `public/cinema.html`, `public/books.html` each load `public/vetogram-media-edition-62.css` after previous CSS. Preserves existing music player, movie player, book reader, reading progress, saved library, router and sources.

## Design improvements

- Calm charcoal/graphite background, restrained mauve/coral accent, reduced neon decorations and shadows.
- Unified card edge/radii, legible typography and responsive player controls.
- Film posters retain subdued saturation, accessible hover/focus. Story/message shell unaffected.
- Full-book paper, navigation, chapter controls and reading settings untouched; visual surface polished.
- Mobile/Fold compact widths and reduced-motion support are included in CSS. **Still requires screenshot approval on real devices.**

## Music / actual availability

- Existing Audius API search has 40-per-page pagination, and the exploration ceiling was raised from 800 to 2,400 *possible* candidates. There is no fake seeded count: number of actual returned streams depends on real Audius results and provider availability.
- New Russian genre searches (rap, pop, indie, rock, remixes, phonk, Russian hits), world genres and Armenian categories. Artist names are labelled **search**, not promised original licensed songs.
- Radio one-tap streaming increased from 4 to 10 broadcaster endpoints. Added Record Russian Hits, 90s, 2000s, Record Main, Big Hits, Rock. Streams are live programming, not independently selectable songs. Existing in-app audio element is used without ripping, caching or reverse engineering.
- Other open-music ccMixter, Openverse and licensed archive modules were preserved, as were device-local and private Telegram file imports. Streaming may be blocked by cross-origin policies or regional issues; live runtime QA is outstanding.
- Stream provenance sample: https://docs.juniper.bot/music/radio-stations and https://www.radiorecord.ru. Do not republish broadcaster files or advertise ownership.

## Cinema / actual availability

- Existing catalog has 200 original film-publication records from recognized studio accounts with official RUTUBE embed URLs. The 92 foreign RUTUBE cards are discovery/external-only unless their owners have explicitly authorized an in-app player. We have **not** disguised those discovery records as licensed video.
- New “Нажми ▶ — и смотри” shelf only selects non-discovery films with a first-party approved RUTUBE iframe from known sources, original metadata, and full-length duration. The dedicated button directly opens the embedded player; normal cards still show details.
- Cinematic hero now prioritizes playable studio films over external-only foreign records.
- Background first-pass official-source discovery increased from up to two to three channel pages per publisher, paced. This expands catalog with **real** provider returns rather than fabricated movie entries. On provider failure the built-in film catalog remains.
- Official embedding behavior reference: https://rutube.ru/info/embed/. We did **not** independently verify every film is currently available in every country; provider errors must remain visible.

## Books / whole-work editions

- Existing 18 source-verified chaptered full editions remain. Added 7 identifiable public-domain Russian editions: *The Prince* (Machiavelli, Nikolay Kurochkin 1869, ID 559743, exact title `Государь (Макиавелли; Курочкин)/1869 (ВТ)`), `Преступление и наказание` (ID 6074), `Идиот` (10009), `Братья Карамазовы` (33835), `Обломов` (18810), `Отцы и дети` (4459), and `Ревизор` (43986).
- At writing, Wikisource API search/page-ID calls confirmed those exact works exist; structural chapter enumeration verified **27 parts** of Machiavelli (dedication + Chapters I–XXVI) and chaptered source indices for all six classics. This is not a claim that every chapter has been live-read through the deployed app.
- The source-title override passes the specific historical Machiavelli edition to WS Export (EPUB) rather than a generic title/disambiguation page. The source's 1869 translation is public domain in Russia; jurisdiction of readers may vary.
- Fixed Roman-numeral sorting in `api/books-wikisource.js`, so “Посвящение → Глава I → II → III → IV → V … XXVI” are in correct reading order, preserving numeric/locale ordering elsewhere. Older edition variations may appear in Wikisource's table of contents.
- Other 200 popular modern book cards are **metadata only**: their full Russian translations remain unavailable without rights or user-provided licensed copies. No paywalled chapters were extracted.

## Tested now without deployment

1. 19 direct source/simulation checks passed: JS syntax (Books, Cinema, Music and Wikisource API); stylesheet inclusion and balanced braces; exact 25 Wikisource edition entries and uniqueness; source-specific Machiavelli book ID; correct Roman chapter ordering; 10 distinct broadcaster URLs; Audius pagination configuration; genuine one-click Cinema shelf and original 200 studio iframe record validation.
2. Added repeatable `tests/vetogram-media-edition-62.test.js` (7 Node tests) to the normal `npm test` glob.
3. **NOT run:** full `npm ci`, `npm test`, `npm run vercel-build`, real Android/iPhone/Fold screenshots, actual stream playback, physical full-book downloads and each RUTUBE embed's `player:playStart` signal. All are blockers before a production release.

## Before final combined deploy

- Merge/rebase V6.1, Messenger Calm #211, this media branch and Games only after conflict review; preserve the original `studio.html` entry and account-scoped data controls.
- Real Telegram Mini App on Android, Fold and iPhone: test audio-only playback, 20+ radio stations discovery vs 10 one-tap stations, click→RUTUBE ready/playStart/error, book chapter navigation / full offline pack, exit/back and master mini-player transitions.
- Obtain rights or proper authorized sources for modern Russian/American hit recordings, modern films, recent Russian book translations; never present a metadata card as a playable original.
- One preview only when user requests deployment. No new paid GitHub Actions or storage.


## VETOGRAM 6.3 — playback-first extension (31 October 2026)

**The following replaces the older 25-book / 200-film / initial ccMixter fallback figures above.**

- **Music (actual MP3 metadata):** 160 unique ccMixter uploads with verified CC BY license URLs, original creator/attribution, and direct MP3 download URLs. No audio copied to GitHub or our servers; no noncommercial licenses included. Added a home-screen shelf with 20 visible at a time, one-click to the original Vetogram Music `<audio>` player and real stream-error signaling. When playback produces an error, that source is hidden from the shelf for that device session. This is not a guarantee of geographic availability or transcoding. Audius search remains dynamically source-driven, and ten broadcast streams remain live radio only.
- **Cinema (source-backed video):** added 260 more unique full-length video records from up to seven pages of six official RUTUBE publishing channels, minus duplicate IDs from the original 200; 73 film records, 101 episodes/series, 86 cartoons; 58 records with year >= 2000. Video author IDs match the official channel, the API reports no privacy/paywall/embedding prohibition, and every record supplies a native RUTUBE iframe embed plus original source page. This is **metadata verification**, not actual device playback confirmation. Only fully licensed/owner-embeddable or open Commons video rows appear in public playback lists; unlicensed third-party foreign/franchise discovery rows remain in code for provenance, but are hidden from the public catalogue, hero and navigation. Do not describe them as available films.
- **Books (complete-source discovery):** added 99 Russian classic works to the previous 25 = **124 distinct Wikisource page IDs**. The 49 new chapter-indexed works were checked with WikiMedia's full subpage index (including multiple editorial versions); another 50 original standalone text pages were verified to have substantial content in the source. We do **not** label every editorial version as 100% exhaustively checked; live `/api/books-wikisource` and the reader show the actual chapter coverage. The server now allows up to 600 chapters, avoiding truncation of large Tolstoy works from the 320-chapter ceiling; the existing official EPUB export remains available if local full-work archive button is intentionally capped.
- **UX:** a playable-content-only Cinema rail, an on-demand original-CC-BY music shelf and a 124-source full-work reader are now wired into the original shared media routes. Existing Messenger PR #211 and Games are separate; none of this work is deployed.
- **Validation:** 23 isolated direct source/syntax/schema tests passed, including MP3 licenses/URLs, official video iframe sources, unique 124 book IDs, module script load order and balanced CSS. Added repeatable Node regression test file `tests/vetogram-media-playback-63.test.js`. **Full Node suite, Vercel build, mobile screenshots, actual 160 MP3 loads and 260 video embed play events remain untested.**

### Truthfulness gate for product launch

Do not advertise arbitrary contemporary Marvel/Harry Potter/US films or famous chart songs as playable without an actual authorized player and rights holder's permission. No song or video is extracted from YouTube/VK/Yandex without authorization. A direct source URL that returns an audio/video error must be marked unavailable, not silently replaced. The user explicitly requested "if not playable, don't add"; no dummy catalogue rows or fake Play buttons may be introduced.
