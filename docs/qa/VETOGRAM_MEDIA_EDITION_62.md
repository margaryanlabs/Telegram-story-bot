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
