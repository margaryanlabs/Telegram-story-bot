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
