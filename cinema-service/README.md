# VETOGRAM CINEMA / Metadata Service

Cinema metadata and player references live in PostgreSQL. The video bytes **always** stream from the media provider to the viewer. Nothing in this service downloads, mirrors, relays, or rehosts video.

## Repo / status

- Source: \`margaryanlabs/Telegram-story-bot\`.
- Branch: \`feat/vetogram-cinema-standalone-20261027\` (PR #195).
- App: \`public/cinema.html\`, shared VETO logo and verified Music design tokens.
- Service: \`cinema-service/\` — **not deployed**. Existing static starter films still appear if API is offline.
- No current PostgreSQL instance was created or connected, and no migrations were run against production.

## Data model

Run \`sql/001_cinema.sql\` on a PostgreSQL 14+ instance. The two tables are:

- \`cinema_movies\`: Russian / original title, synopsis, release year, poster URL, duration, genres, language, publisher and status.
- \`cinema_playback_sources\`: film foreign key, provider, type (iframe/HLS/direct video), stream URL, publisher's original URL, credits, rights basis/evidence, reviewed date, activation and allowed territories.

There are no media blobs. \`cinema_playback_sources\` permits multiple references per film with metadata.
Only sources with **explicitly reviewed** rights and published status are exposed to clients. This workflow record is an operator attestation, not an automatic proof of ownership. The current API serves only sources marked globally available (empty territory list); geofenced titles remain hidden until licensed territory enforcement is implemented.

## Local development on a VPS or machine with PostgreSQL

\`\`\`sh
cd cinema-service
npm install
export DATABASE_URL='postgresql://cinema_user:********@127.0.0.1:5432/cinema'
npm run migrate
npm test
PORT=3800 npm start
curl -s http://127.0.0.1:3800/healthz
curl -s 'http://127.0.0.1:3800/api/cinema/movies?limit=40'
\`\`\`

**Do not put database secrets into the Telegram frontend or commit them.** Configure an HTTPS reverse proxy for \`/api/cinema/*\` to local service port 3800 so Cinema uses same-origin requests. The Vercel static routing currently does not route this new backend; this is intentionally reserved for a future separately approved release.

## Adding movie metadata (without uploading a movie)

1. Get a publisher-authorized public embed/stream. For public RUTUBE uploads, the provider's official documentation is https://rutube.ru/info/embed/ .
2. Copy \`example-unreviewed.json\`, replace film data/links, confirm the uploader, rights and terms for the intended presentation and region.
3. Only when documentary review is actually complete, set \`rights_reviewed=true\` for that item. This marker must not be filled by untrusted external provider JSON.
4. Run \`npm run import -- ./verified-films.json\`. The importer validates URLs and rejects unknown provider origins by default. Set \`CINEMA_ALLOWED_PROVIDER_ORIGINS\` for other expressly approved HTTPS providers.
5. The app queries \`GET /api/cinema/movies?limit=80&offset=0&q=...&genre=...\`, has a load-more control and automatically falls back to the local seed when the API is missing.

JSON fields: \`id,title_ru,original_title,year,description,poster_url,duration_seconds,genres,spoken_language,rights_holder,attribution,provider,source_type,playback_url,source_page_url,rights_basis,rights_evidence_url,rights_reviewed,territories\`. Allowed rights basis: \`official_embed\`, \`creative_commons\`, \`contract\`. This is an integration contract for any permitted provider's API/data export; not an unauthorized access or scraping tool.

## Playback and resume

- For authorized public RUTUBE iframe, source remains \`rutube.ru\` and the host plays the official player in an iframe. See documentation above.
- Player adapter validates incoming \`postMessage\` by exact origin, exact iframe window and expected video ID; \`player:currentTime\` / \`player:durationChange\` update browser-local progress.
- Resume uses RUTUBE documented \`player:setCurrentTime\`, without intercepting streams. RUTUBE controls subtitles, quality and audio inside its own iframe.
- For HTTPS MP4/WebM or HLS, the independent adapter uses native video or hls.js where supported. Only approved sources can be imported.
- Progress/favorites are local on the device, not synced between Telegram accounts yet.

## Validation and release blockers

- Static JS parse, HTML ID bindings, mocked iframe seek, origin verification and removal were inspected with the connected source in this task.
- Actual video streaming on Telegram Android and iOS, production PostgreSQL connectivity and reverse-proxy/CSP must be tested **before** any merge or deploy.
- Do not merge PR #195 or publish via Vercel until explicit owner request.


## Multi-player Russian dubbing support (Cinema 2.0)

- The importer now accepts multiple JSON entries for the same movie ID with different approved playback URLs. Add \`translation_name\`, \`quality_label\`, and optional \`priority\` to each entry.
- \`sql/002_source_variants.sql\` adds these source-level fields. Run **both** migrations via \`npm run migrate\` on a private database before starting the updated service.
- \`GET /api/cinema/movies/:id/sources\` returns up to 30 active, reviewed, globally permitted source variants for that title. Do not expose sources with unreviewed terms or territorial restrictions.
- In Cinema, an approved provider/translation dropdown appears above the player. Switching removes the previous iframe, preserving the shell. The original rights-holder RUTUBE film works with the static frontend while service is offline.
- The client presents provider-specific quality/voice labels **only from approved metadata**. Third-party embedded players control their own audio and video quality menus.

### Optional Kinobox discovery for administrative review

Kinobox documents an API for player search by title, Kinopoisk, IMDb or TMDB ID: https://kinobox.tv/api . The documented rate limit is **2 requests/second/IP**, and the API disallows scraping a copy of its whole film database.

The CLI intentionally makes a single query and outputs **unreviewed candidate metadata**; it does not publish third-party iframe URLs, bypass access restrictions, or grant distribution rights:

\`\`\`sh
cd cinema-service
npm run discover -- title "Интерстеллар"
npm run discover -- imdb tt0816692
\`\`\`

The output includes provider, available audio translation labels, quality and candidate iframe URL for **operator review only** (\`rights_reviewed:false\`). It cannot be passed directly to \`import.mjs\`: that requires verified rights-holder terms and the complete film metadata fields. No API key, member account, or mass streaming catalog has been obtained.

### Alloha readiness and eligibility

The public Alloha website (https://allohatv.com/) advertises 64,609 movies and 18,390 series. These are **provider claims, not VETOGRAM's available streaming count**. Its official access form (linked from the homepage) currently states a minimum of **300 site visitors/day during the previous week**, a player CNAME to \`streamalloha.live\`, and viewing access to site analytics. No Alloha account/domain integration has been authorized or completed. Do not invent or share a provider token or assume its videos may be republished in a paid Telegram app.

## UX / Quality status

- Premium homepage now contains a mobile-horizontal **«Смотреть на русском»** shelf in the existing VETO charcoal/coral theme.
- Provider/translation selector is visible on player pages with a confirmed external stream. The code was smoke-tested on synthetic DOM and simulated backend source responses.
- **Not yet tested on actual Telegram Android/iOS**: playback, commercials, deep links, iframe resizing, or network/provider regional restrictions. No VPS/Postgres provisioned. No merge/deployment.


## Alloha provider outreach — 27 October 2026

The owner explicitly approved sending an email seeking pilot integration access. A partnership/test-access inquiry was sent via the connected Gmail account to **support@alloha.tv** asking for:
- pilot access without 300 daily visitors,
- approved Telegram WebView embedding and CNAME/domain requirements,
- Russian dubbing and quality/catalog API features,
- applicable catalogue rights, geography and monetisation terms.

This contact email was historically published by an identified Alloha representative; current delivery/reply has not been verified. **No access credential, domain configuration, source authorization, catalogue rights or rollout approval has been received.** Keep provider status \`pending\`, do not enable Alloha in production.

## Artwork and iframe fallback

\`public/cinema-artwork.js\` attempts a source-scoped public RUTUBE video metadata lookup for official video thumbnails and accepts only RUTUBE image CDN hosts. If the endpoint is blocked by CORS, geography, or rate limits, the premium color-gradient fallback remains and the film card stays usable. The implementation was not validated live against the RUTUBE metadata endpoint.

For iframe playback, the UI uses a non-intercepting status banner, waits for provider readiness signals (RUTUBE \`player:init\`) rather than assuming iframe.onload implies playback, and exposes a direct \"Открыть видео у источника\" link. After 13 seconds without a confirmed RUTUBE signal, it shows a helpful fallback message while leaving the iframe clickable.


## Official big-catalogue streaming channels — new 27 October 2026

**These are third-party, rights-holder-operated public RUTUBE channels, not copyrighted movie files stored by VETOGRAM.** RUTUBE explicitly permits an iframe player for publicly accessible videos, but public embedding is not permission to copy/rehost videos, remove ads/DRM or automatically charge viewers for those films.

| Channel | Verified RUTUBE owner/channel | Type |
|---|---|---|
| Mosfilm | https://rutube.ru/channel/25963146/ | 1,000+ films *claimed by its channel*, actual filtered rows not enumerated |
| Lenfilm | https://rutube.ru/channel/1792500/ | full movies and serial episodes among other videos |
| Gorky Film Studio | https://rutube.ru/channel/48160110/ | 100+ public film projects, including serials; actual API rows unknown |

Integration:
1. \`cinema-service/official-rutube.mjs\` uses a fixed, publisher-only metadata route \`GET https://rutube.ru/api/video/person/<verified_channel_id>/?page=N&format=json\`. This shape is documented in \`yt-dlp/yt_dlp/extractor/rutube.py\` and the RUTUBE developer example \`rutube/ShowcaseTutorial\`. The exact endpoint response **could not be fetched live in the present environment**.
2. Source filtering demands **exact publisher ID**, valid 32-character video ID, duration 35–360 minutes, no paid/private/live flags, and excludes trailers, promos, interviews. Every card links to the original RUTUBE page. Each movie is streamed by the original RUTUBE iframe — no HLS proxy/copying.
3. \`GET /api/cinema/channels?channel=mosfilm&page=1\` (or lenfilm/gorky) is paginated server-side (1..120) and caches each public metadata page for ten minutes. The Cinema frontend has three dedicated studio tabs, automatic first-page loading, and \"Показать ещё фильмы\".
4. The viewer's search results and Russian-language recommendations incorporate loaded publisher entries. No unverified third-party uploader or copied Netflix catalogue is included.
5. For static hosting with no running metadata API, run \`npm run studios:export -- mosfilm 50 ../public/cinema-mosfilm-feed.json\` (and similarly for lenfilm/gorky). The export CLI stores a JSON of **metadata and embed URLs only**, paced to avoid hammering the source. Cinema can load these optional static JSON files.
6. Two actual Lenfilm public videos are now also embedded in the built-in offline seed: **«Старик Хоттабыч»**, **«Свадьба в Малиновке»**. This raises the starter catalog to 20, including eight films/episodes from Russian original-language channels.

### Operational status and launch gates

- **Code integrated into the Draft GitHub PR only; no API host or JSON export actually executed against RUTUBE**, since live access to the channel metadata endpoint was not available.
- No live database migrated, no static channel feed generated, no Vercel deployment and no Telegram Mini App bot URL changed.
- Verify metadata API shape, pagination and uploader IDs in an environment with RUTUBE access before launching a production catalogue.
- Verify playback and publisher territorial/age restrictions on Telegram Android/iOS. RUTUBE may geo-block certain content, including outside Russia.
- Film-studio channel totals are their own published claims, NOT counts of records loaded by our platform.

Docs: https://github.com/rutube/ShowcaseTutorial ; https://github.com/yt-dlp/yt-dlp/blob/master/yt_dlp/extractor/rutube.py ; https://rutube.ru/info/embed/ .


## No-Postgres launch path (public studio archives)

The public studio feed service **no longer requires** a database at boot. To run the publisher channel metadata endpoint only:

\`\`\`sh
cd cinema-service
npm install
PORT=3800 npm start
curl -s http://127.0.0.1:3800/healthz
curl -s "http://127.0.0.1:3800/api/cinema/channels?channel=mosfilm&page=1"
curl -s "http://127.0.0.1:3800/api/cinema/channels?channel=lenfilm&page=1"
curl -s "http://127.0.0.1:3800/api/cinema/channels?channel=gorky&page=1"
\`\`\`

Responses depend on the live RUTUBE metadata service. A request may be rejected or filtered to zero movies. The implementation only supports verified studio owners and public embeddable films. \`/api/cinema/movies\` will answer 503 until a PostgreSQL connection is configured; the UI retains its offline seed. For an actual Telegram Mini App, map \`/api/cinema/*\` to the service through a same-origin **HTTPS** reverse proxy. This has not been deployed or verified on devices yet.


## Cinema studio stream route — Vercel integration fix, 27 October 2026

The existing monorepo Vercel config routes only single-level \`/api/[name]\` calls to the single \`api/router.js\` function. The original frontend path \`/api/cinema/channels\` could never reach \`cinema-service/server.mjs\` on the VETOGRAM Vercel app.

**Fixed in the Cinema feature branch:** \`api/cinema-channels.js\` is registered in \`api/router.js\`; the frontend now calls same-origin \`GET /api/cinema-channels?channel=mosfilm&page=1\`. The separate VPS endpoint still exists if a VPS is preferred. Vercel route is metadata-only: no DB, API key, video proxy or media copies. The server returns structured upstream errors (ACCESS_DENIED, TIMEOUT, BAD_RESPONSE, UNAVAILABLE) and caches successful catalogue responses.

Five original film-producer channels are configured:
- Mosfilm — 25963146 — https://rutube.ru/channel/25963146/
- Lenfilm — 1792500 — https://rutube.ru/channel/1792500/
- Gorky Studio — 48160110 — https://rutube.ru/channel/48160110/
- Star Media — 141565 — https://rutube.ru/channel/141565/
- Mars Media — 29207414 — https://rutube.ru/channel/29207414/

For large foreign-dubbed film catalogs, \`Смотри кино!\` on RUTUBE has more than 5,000 reported public videos, but its rights for major Hollywood titles and third-party commercial embedding could not be established. It is deliberately not auto-imported into VETOGRAM.

The channel fetch now uses the documented \`origin__type=rtb,rst,ifrm,rspa\` videos filter from \`yt-dlp/yt_dlp/extractor/rutube.py\`, excluding shorts at source where supported. Backend response includes per-page filtering diagnostics for incorrect publisher IDs, too-short clips, unknown uploader, blocked/private items and non-movie titles.

**Actual attempted preview deployment:** Vercel project \`veto\` under labsmargaryan account was deployed to preview from Cinema PR (not production), deployment ID \`dpl_2nDZ8D6mCe3XeTHQRjkwvA6BryLL\`. Vercel returned **CANCELED / Ignored Build Step**. Production and \`main\` were not modified; this preview URL is not a working movie site. Do not infer successful access to RUTUBE based on mocked tests. Vercel build settings must be changed or a dedicated Cinema preview project provisioned before actual stream tests. Avoid repeated preview redeploys while the ignored-step rule still blocks them, as canceled builds can count toward quotas.

Validation performed: JS syntax checks, DOM ID bindings, mock RUTUBE upstream API and same-origin Vercel handler (200 for configured studio, client-supplied invalid channel rejected). No live RUTUBE channel feed or player has yet been verified in a running Telegram WebView.


## Franchise collection and sources — October 27, 2026

Cinema now includes 88 discovery-only entries in public/cinema-franchises.js: MCU 38 (includes the released 2026 Spider-Man: Brand New Day with its official Sony title page); Potter/Fantastic Beasts 11; legacy Marvel/X-Men/Spider-Man and related films 39.
These are title-discovery cards without video streams, playback permission, or verified Russian dubbing. Their buttons link to the official film collection or region-specific availability reference, never to an unverified upload.
The new homepage has a dedicated franchise shelf (MCU, Potter, legacy). The playback route branches on discoveryOnly BEFORE attempting to initialize its player.
Existing rights-holder RUTUBE original embedded players remain; the unrelated RUTUBE label has been removed from generic movie listings, and a one-source provider selector is hidden. Original player/source attribution is retained.
Alternate legitimate source directory links to official Mosfilm YouTube, Mosfilm VK and subtitled YouTube channels. They are navigation links, not automatically inserted movie streams.
No TMDB copyrighted poster images were imported because commercial access and licensing have not been obtained.
New regression checks: tests/cinema-franchises.test.js.

Latest changes are committed in the draft PR, but the public theater preview is an older build due to the Vercel 402 daily deployment limit. Do not claim 88 new franchise cards are live until a READY deployment is checked.

References: https://www.harrypotter.com/features/how-to-stream-harry-potter-wherever-you-are ; https://www.disneyplus.com/browse/page-60f4707d-19bb-4c0c-9390-ab269137be50 ; https://www.mosfilm.ru/about/news/mosfilm-novyy-sayt-k-100-letiyu-kinostudii/ ; https://rutube.ru/info/embed/ ; https://developer.themoviedb.org/docs/faq


## Russian audio evidence and provider status — 28 Oct 2026

`public/cinema-russian-audio.js` stores **32 exact, public, official provider title pages** with Russian listed as an audio/translation language: MEGOGO and Okko, all verified against those sites' public descriptions. Breakdown: MCU 10, Wizarding World 10, Marvel legacy 12. No posters/streams from these providers were copied.
The imported record is not an embed license. Fields keep `audioEvidence=listed-by-provider`, `availability=unknown|unavailable`, `verifiedOn=2026-10-28`. Six exact pages currently reported 'unavailable' during research. Remaining 26 are UNKNOWN for regional playability and may also not work. A URL and Russian language listing MUST NOT be counted as confirmed playback.
Russian-audio discovery only is the default for the three franchise rails and the combined film catalogue; the explicitly labelled checkbox 'Показать все названия ...' reveals the titles whose audio versions have not been verified. Catalogue cards distinguish provider-listed Russian track from confirmed playback. Unavailable title pages show 'Проверить статус у сервиса', not a fake Play button.
For the original studio films, we preserve the studio's Russian language metadata from RUTUBE official channels, but the underlying media still needs Telegram/region real playback verification. We never remove required provider attribution or re-stream restricted videos.
MEGOGO and Okko support rights/restrictions determined by viewer country, not whether their catalogue pages load. In particular, Armenia playback has NOT been verified for these 32 entries. Source pages must be checked in the viewer's country; failing content must not be promoted as playable.
Additional tests: `tests/cinema-franchises.test.js` validates 32 mapped Russian listings, unavailable labels and all 88 discovery records remain streamless. DO NOT advertise `32 playable`.
Official reference examples: https://megogo.net/ru/view/2453151-garri-potter-i-filosofskiy-kamen.html ; https://okko.tv/movie/harry-potter-and-the-order-of-the-phoenix/play ; https://megogo.net/ru/view/4512995-mstiteli-final.html ; https://megogo.net/ru/view/2012581-dedpul.html

## 200 real full-length Russian studio movies — 28 Oct 2026

- `public/cinema-featured-200.js` is an actual curated metadata seed of EXACTLY 200 distinct published RUTUBE videos (120 Mosfilm, 35 Lenfilm, 38 Gorky Film Studio, 7 Star Media). No fictitious titles, IDs, poster links, or MP4 URLs.
- Seed was selected from 501 unique rights-holder channel records reachable via same-origin `/api/cinema-channels`; 200 have duration >=35 minutes and exclude obvious season/episode/trailer markers. Published uploader ID and RUTUBE embed ID were checked upstream. Some feature movies may be multi-part works; every film's playback and language are determined by the original player.
- All 200 records were programmatically validated: 200 unique publisher/video IDs, 200 iframe IDs matching their original `https://rutube.ru/video/{id}/` page, 200 allowed public thumbnail URLs, 200 without explicit `серия/сезон/эпизод/трейлер` markers.
- `cinema.html` loads the static manifest before `cinema.js`. Initial app films are deduped by ID. `cinema.js` pre-populates publisher tabs with the seed so posters and titles can appear without waiting for external API. Existing API still refreshes/paginates channels and discovers newer movies.
- Metadata assets are roughly 258 KB uncompressed; poster images use `loading=lazy`, all video bytes remain with RUTUBE. No database/VPS/Railway required for this seed.
- There are also 20 fallback catalog records and 88 franchise discovery-only records, which remain distinct from these 200. The Marvel and Potter entries are NOT part of the 200 real playable studio embeds; those require clearance/verified rightsholder playback and should not be counted as movie streams.
- This is a code-complete offline metadata release pending a READY deployment; all runtime playback (including Russian audio, geo restrictions, WebView behavior) is not yet verified per record. RUTUBE's public embed guidance is not a sublicense to rehost or remove third-party player attribution.
- Added `tests/cinema-200-real-films.test.js` to check complete manifest structure and integration.

Do not call these 200 entries live on the public Vercel URL until a new deployment succeeds; previous Vercel attempts failed HTTP 402 `api-deployments-free-per-day`.

## Series module — 28 Oct 2026

- `/public/cinema-series-episodes.js` contains 99 original studio RUTUBE episodic or multi-episode videos (63 Star Media / 36 Mars Media), published by the original source channel. Each has video ID, original iframe URL, source credit and thumbnail. Russian metadata originates from producer feeds, but real video playback and territorial permissions remain untested.
- `/public/cinema-popular-series.js` contains 34 trending series' discovery cards with explicit Russian-audio catalogue evidence. 31 direct Kinopoisk series pages show 'Аудиодорожки: Русский'. Three Netflix series have official `am-ru` pages listing Russian in the Audio section: Stranger Things (80057281), Wednesday (81231974), Squid Game (81040344). Current Netflix Armenia subscription/playability is still subject to provider terms.
- The main `cinema.html` has a dedicated Series tab in both desktop and mobile nav; premium 'popular with Russian audio' shelf and on-platform episode shelf. `cinema.js` adds manifests before first render, de-duplicates IDs, filters Series separately from Films, and displays a season/episode dropdown for same-show original studio videos. No fake season count is displayed.
- Series episode grouping uses Cyrillic-aware expressions without JavaScript ASCII `\b` behind Cyrillic words. 99 original episodes organize into about 37 show/season groups from producer titles, retaining explicit season suffixes when present. 'All episodes' compilation uploads are separate originals, not artificial downloads.
- The 34 'hit' series have `discoveryOnly:true`, `player:null`: open exact Kinopoisk or Netflix title page, NOT a fake watch URL. HBO and Netflix streams are not redistributed in Cinema and their branding/auth remains intact. Russian audio listing is distinct from regional availability.
- `tests/cinema-series.test.js` covers all manifests, IDs/iframe URLs, 34 RU-audio source entries, Cyrillic grouping, and UI hooks.
- The previous 200 full-length movies and the earlier Russian Marvel/Potter discovery catalog are preserved. No branch merge, secrets, database migrations or production Messenger changes.
- Publishing requires a successful deployment of `feat/vetogram-cinema-standalone-20261027` to independent `vetogram-cinema-theater` Vercel project. Earlier Vercel REST deploy returned HTTP 402 daily deployment quota exhausted. The currently public theater is an older READY build and MUST NOT be described as displaying this new Series section until verified.

Official sample catalogues: https://www.kinopoisk.ru/series/464963/ (Game of Thrones); https://www.kinopoisk.ru/series/1316601/ (House of the Dragon); https://www.kinopoisk.ru/series/79848/ (The Sopranos); https://www.netflix.com/am-ru/title/80057281 (Stranger Things); https://www.netflix.com/am-ru/title/81231974 (Wednesday); https://www.netflix.com/am-ru/title/81040344 (Squid Game).

## Playable series only policy — 28 October 2026

User explicitly rejected series collections that route to platforms where the title cannot be watched in Cinema. `public/cinema.html` now omits `cinema-popular-series.js` and its formerly visible hit series shelf (34 discovery-only external Kinopoisk records). Such metadata is kept in the unused archive file, NOT imported by the application.
The Series tab and homepage now feature only actual RUTUBE originals from rights-holder original uploader channels: 99 true episode/compilation records, 63 Star Media and 36 Mars Media. 37 groups identified, episode selector uses actual episode numbers, e.g. `Женщина в беде` episodes 1-4.
99 records have matching original RUTUBE video pages and embed IDs plus artwork. This is NOT confirmation that all 99 actually play in Armenia/Telegram WebView; individual playback remains subject to current publisher and geography.
`Игра престолов` and `Дом Дракона` remain unavailable as in-app streaming: their catalogue/audio existence at Kinopoisk is not an authorized source or in-app player. They are not shown as playable or promoted into visible shelves.
QA: JS syntax passed, all DOM ID references resolve, 99 source IDs and iframe links validated, grouping has 37 shows, `Женщина в беде` 1–4 episode picker behaves correctly. Tests in `tests/cinema-series.test.js` updated.
Release: feature branch/PR only; Vercel 402 daily deploy limit remains the publication blocker. Existing public Cinema URL serves the older build.
