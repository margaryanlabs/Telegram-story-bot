# Vetogram 7 — Black Universe + working public media preview (2026-11-01)

## What changed

- Public preview server now executes **GET only** public media handlers for `/api/books`, `/api/books-wikisource`, `/api/books-discover`, and `/api/cinema-channels` instead of returning `preview_only` for every `/api/` request.
- All other API paths continue returning `503 preview_only`. Telegram login, business consent, personal messages, media backup, personal libraries, game rooms, database and webhook routes are **not exposed** by preview.
- Public preview requests receive a minimal request object without Cookies, Authorization headers or Telegram WebApp launch data. Payload and query sizes are bounded.
- The shared black theme is included in `studio.html`, `music-module.html`, `cinema.html`, and `books.html`: #000 base, dark grey surfaces and restrained pink accents. Existing light/sepia book reading modes and chosen chat wallpaper remain independently controlled.
- Reader text requests have a bounded retry for temporary source outages, with a visible **Повторить загрузку текста** action.
- Cinema's `Зарубежное RU` tab is now discoverable. Unlicensed external catalog entries have an explicit disclaimer and do not masquerade as playable in-app streams. The active playing-only shelves remain rights-gated.
- Basic regression tests added at `tests/vetogram-black-universe-preview.test.js`.

## Manual verification / release checklist

1. Run `node --test tests/vetogram-black-universe-preview.test.js` from repo root and `npm run check`; inspect failures before merging.
2. Run `node scripts/vetogram-preview-server.mjs`; confirm static `/`, `/books.html`, `/cinema.html`, `/music-module.html` render.
3. Confirm `GET /api/books-wikisource?mode=text&wiki=ru&id=559743` responds with a real book response or a **real** upstream error, not `preview_only`. Open **Государь** to confirm chapter navigation and retry.
4. Confirm `GET /api/music-library`, `GET /api/telegram-chats` return `503 preview_only`; no private Telegram session data leaves the server.
5. Confirm `GET /api/cinema-channels?channel=mosfilm&page=1` returns a real response or provider error. External playback still depends on source ownership and current availability.
6. Verify foreign discovery listing and labeling, but do **not** call unlicensed films in-app playable or verified Russian dubbing.
7. Test real Android Telegram WebView, Fold viewport and iOS, light/sepia reading, custom chat wallpaper, long book, media player and keyboard.
8. Confirm zero horizontal overflow, readable contrast, visible focus and no jumpy layout after font scaling.
9. Do not merge into `main`, change active production domains, or deploy a private-data backend until auth, permissions, environment and device QA pass.

## Important limitations

This is a source change, **not a production deployment**. Connecting book/cinema APIs in the public preview still depends on hosting outbound connectivity (Wikisource, Gutenberg, RUTUBE). It cannot guarantee third-party availability. Live playback of foreign-dubbed films and copyrighted popular music is not added without authorized sources, and the private media library remains disabled in the public preview.

## Follow-up: cover resiliency and visual polish (2026-11-01)

- Movie poster URLs that have produced a browser image error are stored in an ephemeral failure set. The next card render uses an existing source-backed alternative or retains an editorial text background instead of endlessly re-requesting the same broken URL.
- Book cover failures are remembered for the session. All source-less books retain the existing individually generated `jacketProfile` motifs and tones; removed the Black theme rule that flattened them to an identical gradient.
- Music track, radio and catalog cards now use an initial-letter fallback and skip repeatedly failed artwork URLs. These are explicitly editorial placeholders, not fake official album covers.
- Cinema cards use consistent 2:3 artwork, quieter labels and metadata; book lists and mobile player have responsive spacing. Existing audio/film rights logic is unchanged.
- Expanded test definitions in `tests/vetogram-black-universe-preview.test.js` to 10 cases.
- **Verification in this ChatGPT session:** parsed `public/books.js`, `public/cinema.js`, `public/vetogram-music.js` and `public/vetogram-music-catalog.js` with a JavaScript parser without executing application code. Replayed all 10 test callbacks in an isolated JavaScript verification harness with mock response and URL interfaces: **10/10 pass**. This is **not** a Node `npm test` run or an end-to-end browser test; the real production and streaming environment remain unverified.
- The GitHub commit status for `5961055941597b4f9a437e5ab4510f9cda36acb7` reports Vercel preview **failure** at an upgrade/build-rate-limit URL. This is an infrastructure/plan constraint, not evidence that the source code compiled or failed. Do not claim a working live preview.

## Next release gates

- Execute full Node targeted test suite and inspect any Node-specific failures.
- Browser walkthrough on Android Telegram, iPhone and Fold: book opening, failed cover fallback, real movie/playStart, licensed music playing, bottom-nav and back behaviour.
- Review foreign-film metadata and rights/translation before offering one-tap playback. No deployment from this draft PR.
