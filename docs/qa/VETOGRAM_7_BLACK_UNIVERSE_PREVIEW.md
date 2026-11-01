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
