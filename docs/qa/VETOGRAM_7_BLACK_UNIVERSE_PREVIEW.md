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

## Continued media correctness pass — 1 November 2026

**Verified source defects corrected:**
1. `public/cinema.js` used to emit `vetogram:cinema-playing` as soon as a movie player was opened, before any actual playback. `public/vetogram-media-bridge.js` also emitted `video-playing` on the Watch button click. This stopped an active music track even when an iframe refused playback. Both eager signals are removed. The host receives a pause request only after native HTML5 `playing` or a validated RUTUBE `playStarted` / `state playing` callback. Duplicate playback-start signals from the same iframe attempt are suppressed.
2. The Books reader's previous two-attempt remote request had no cancellation when switching books, chapters or closing the reader. A request-specific AbortController now aborts abandoned fetches. The retry path checks the outer cancellation signal and never retries a deliberately abandoned book request. Existing reader identity and request-generation guards still prevent stale responses from replacing the current text.
3. Deep-linked saved books previously replied `open-item-status ok:true` before any pages loaded. `openSavedByKey` now returns the `openBook` promise, which resolves only when `loadChapter` has paginated the text successfully. A failed/unavailable source returns false instead of a misleading success.

**Current regression coverage:** 13 targeted cases defined; 13/13 passed in the chat's isolated JavaScript source/contract runner with mock URL and response objects. Syntax parsing passed for Books, Cinema, media bridge, Music and Music Catalog. This is **not** a real Node test runner, hosted API probe, Telegram device QA, or verified media stream.

**Still release-blocking:** actual Android/iOS Telegram scenarios, Node full test run, authorized media-source availability, access/rights audit, Vercel build-rate-limit. No production merge or deployment.

## Screen lifecycle, network and playback continuation — 1 November 2026

- Enforced fail-closed playback: `cinema.js::play` treats both `externalRutube` and `discoveryOnly` flags as external-site-only. A metadata change cannot silently turn a third-party movie upload into an in-app licensed iframe.
- Aborted superseded `/api/cinema/movies` requests using a single catalog AbortController. Switching tabs cancels in-flight fetches, invalidates old response tickets, clears search debounce and leaves the load-more button unlocked. Library/Series/Foreign tabs do not issue an irrelevant catalog request. This avoids stale UI updates and unnecessary bandwidth on mobile.
- Reduced idle foreground identity polling from 1 second to 10 seconds in the media host; immediate checks on opening a module, receiving a message, focus and visibility are still in place. Background WebViews do not run the periodic check.
- Added behavioral tests `tests/vetogram-media-bridge-behavior.test.js`: Watch click, native play, provider-confirmed play, error/waiting, hidden Cinema closes, and hidden Music keeps audio playing. No browser-specific external provider is claimed verified.
- Source/contract test file now covers 16 cases, and six additional VM-based behavioral cases are authored. In an isolated code runner, 16/16 source checks passed and a six-step direct media-bridge event simulation passed (including closing hidden Cinema and keeping audio during Music view switches). Six browser JavaScript modules parsed successfully.
- The real local Node test suite was **not** run: the repository cannot be cloned in the active runtime (github.com DNS unavailable) and the connector does not provide a command runner. These isolated checks are not an E2E test or build confirmation.

Required release gates remain unchanged: real Node CI, Android Telegram and iOS WebView, licensed playback, source coverage, account switch tests, and preview deployment once infrastructure is available.

## Reader consistency and hidden-frame guards — 2026-11-01, additional pass

This pass addressed issues verified in the existing source, without replacing the working modules:

- **Offline book attribution:** `cacheText()` now stores source `coverage` along with `text`, `chapters` and attribution in the per-device IndexedDB cache. The next read no longer loses the source's limited/unverified completeness warning.
- **No false success for missing chapters:** empty or non-string upstream text is rejected instead of treating the reader's placeholder page as a successful book; users receive the existing retry action.
- **Bounded background work:** `prefetchNextChapter()` now has an explicit 12-second abort, honors network Data Saver and 2G restrictions, and rejects cached writes after a reader close/chapter switch/book switch. `cancelChapterPrefetch()` runs on every chapter change, book open and close.
- **Navigation guard:** when a user switches away from Books, the iframe cancels only the optional prefetch through `pauseBackgroundWork`; the current chapter, page and progress remain intact.
- **Audio guard:** the host ignores delayed `video-playing` notifications after the Cinema iframe has been hidden or the user has switched out of the media screen. Only the active Cinema section can pause Music.

**Verification in the chat:**
- 19/19 source/contract checks passed in the isolated JavaScript harness.
- A dedicated behavioral harness exercised the **actual source of** `cancelChapterPrefetch` and `prefetchNextChapter` with mock networking and signals: 4/4 passed (abort, book switch, coverage save and Data Saver).
- Six changed browser JavaScript modules passed JavaScript syntax parsing.
- Added four Node VM test definitions in `tests/vetogram-book-prefetch-behavior.test.js` and one hidden-reader lifecycle test in the media bridge suite. These Node tests have **not yet been executed using `node --test`**; browser/WebView functionality and upstream APIs remain unverified.
- GitHub Actions has no PR-triggered workflow run returned for the current branch commit. Vercel still shows `build-rate-limit` failure for the preview context. This is not proof of a source-code build failure.

Production remains untouched, no merge and no preview/Render/Vercel deployment. Device QA and full Node CI are still required before marking this PR ready.
