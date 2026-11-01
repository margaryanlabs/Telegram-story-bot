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

## Media Library restore and honest playback status — 2026-11-01

Verified cross-module correctness defects and fixes:

- **Metadata-only music:** `VetogramMusic.openSavedById()` previously resolved `true` even when the only available action was searching for an external recording by title. The module now resolves the discriminated status `"search"`. The iframe bridge publishes `open-item-status.status` as `opened`, `search`, or `unavailable`, and the host displays a non-playback explanation instead of false success. Existing true/false opening semantics for Books/Cinema are retained.
- **Blocked personal audio storage:** IndexedDB `open()` can remain pending forever in some restricted WebViews. `openDb()` now bounds the open attempt to 6 seconds, handles blocked and error events, cleans up the watchdog, and closes an abandoned DB handle on late success. The `loadDb` `getAll()` query also has a 6-second timeout so a saved-music deep-link request can complete or return a useful error. The module continues with its public catalog if local storage is unavailable.
- **Security boundary:** only parent-origin `postMessage` commands are handled. A message from a wrong origin/source does not open saved content.

Validation performed against exact current source via isolated JavaScript execution, **not a full Node test run**:
- 20/20 source/contract assertions passed.
- Executed the actual production IndexedDB open function with fake database events: 5/5 scenarios passed (no IndexedDB, successful open, timeout, late-success cleanup, blocked open).
- Exercised the production iframe bridge against a mocked parent: metadata-only song returned `ok:false,status:"search"`, accepted stream returned `ok:true,status:"opened"`, wrong-origin command was ignored; outgoing events stayed same-origin.
- Six browser JavaScript modules passed syntax parsing. Added `tests/vetogram-music-storage-lifecycle.test.js` (5 Node VM tests) and three media bridge behavior tests, alongside source assertions.
- No live device/storage/backend or real licensed audio URL has been verified. PR remains draft, Vercel build-rate-limit persists, no production deployment.

## Chats & Stories — avatar lifecycle, return navigation, identity guard (2026-11-01)

Found and corrected source-level defects in the **existing** Telegram chat and story controllers:

1. `public/telegram-chats.js`: the visible avatar queue previously re-ran on list paint and scroll, but could remain empty after a user returned from another Vetogram section to a **previously populated inbox**. The `veto:screen-changed` and `visibilitychange` handlers now explicitly invoke the existing `queueVisibleAvatars()` while retaining owner/thread and in-memory thumbnail state.
2. The avatar queue no longer starts any new `/api/telegram-chat-media` requests while the WebView is hidden or another Vetogram screen is active. Pending work stays queued until a visible Chats screen can resume it. This is an optimization, **not** a claim that existing in-flight network requests are cancelled.
3. Both enqueue and dispatch now require the current Telegram launch data to match `state.ownerInitData` **and** a previously verified connection proof. Thus neither an unverified session nor a changed signed account can initiate a new batch request from stale chat state. Backend owner verification remains authoritative.
4. `public/telegram-stories.js`: the avatar map used string chat IDs but compared them directly to a `userId` which can be numeric. Normalizing `String(person.userId)` permits owner-matching story avatars; broken or revoked image blobs fall back to contact initials. A different chat ID cannot be used to supply another person's story thumbnail.
5. Extended `tests/vetogram-thread-avatar-51.test.js` with hidden tab, screen return, document focus, unverified session and wrong-account regression cases. Added `tests/vetogram-story-contact-avatar-7.test.js` with four executable Node VM cases: numeric/string ID, wrong contact, missing image and image error fallback. The prior avatar test fixture now marks known missing images instead of leaving a 25-second retry timer alive.

**Direct execution, bounded to an isolated JavaScript harness:** the actual extracted avatar queue functions passed **8/8** mock scenarios; extracted story avatar sync passed **4/4** scenarios. Main browser controllers `telegram-chats.js`, `telegram-stories.js`, `vetogram-universe.js` and `vetogram-media-bridge.js` parsed successfully as JavaScript scripts. These are **not** actual `node --test` runs, Telegram account tests, network probes or verified avatar downloads. Unit tests stored in GitHub remain to be run under Node.

No real user credentials, chats or photos were retrieved. PR remains draft, unmerged and undeployed. Full test suite, genuine Android WebView and end-to-end Telegram avatar rendering remain release gates.

## Live Chats sync lifecycle — 2026-11-01

Source audit found that the existing Messenger already used generation checks to protect stale history and an abortable history fetch, but **the ongoing `/api/telegram-chat-updates` poll was not actually aborted** on navigating away. Its periodic timer was stopped, while the signed in-flight network operation could continue until the 18.5-second timeout. A WebView exit could also leave the "Checking new messages" spinner after cancellation.

Fixes in `public/telegram-chats.js`:

- Track the current active poll's `AbortController` as `state.syncAbort`. New `cancelActivePoll()` invalidates the run ID **before** aborting transport, resets `syncBusy`, and clears the stale checking indicator. The controller's `finally` clears `syncAbort` only when it still owns that slot.
- Call cancellation on chat switch, Back, beginning a full history refresh, owner change, authorization rejection, leaving the Chats screen, a hidden tab, going offline and `pagehide`.
- Check `runId===state.syncRunId` and `maySyncThread()` on success *before* merging updates. A transport that ignores AbortSignal cannot render late data or schedule a new poll after the screen is hidden.
- **Normal active polling still works** and continues on the existing 26-second interval when current, verified and visible. Messages are not cleared by navigation or a transient network failure. The feature does not circumvent Telegram's authentication or session requirements.

Regression test file added: `tests/vetogram-live-poll-cancellation-7.test.js`, five offline Node VM tests (abort on hide, late network success after cancel, A→B switch, current message merge, lifecycle hooks). Updated source/contract test with poll cancellation invariants.

**Verification achieved in current execution:** 21/21 source/contract tests passed in isolated JavaScript harness; 8/8 relevant browser scripts parsed; four runtime simulations of the actual extracted poll/cancel source all passed. This **does not** mean the repository's full Node test suite ran, or that real Telegram login/messages/live WebView were exercised. GitHub Actions/Vercel build success and manual Android/iOS QA remain necessary. No production merge or deployment.

## Product-design rescue pass — after mobile user screenshots (1 November 2026)

**Source of truth:** four actual Android screenshots showed a blue Chats screen while Media was black/purple; very tall featured book with stretched left column, tiny lower book cover, cramped badges and huge empty area; tall purple music promotional panel; media cards with small generic symbols; an embedded mini-player obscured by the main bottom bar.

### Changes made in the *same integrated branch* (no replacement site)

- Removed **19 special selectors** from `books-art-direction.css` that forced the first book in the full-text catalog to span two columns/rows and place the jacket in a narrow mixed grid. All books now use the same responsive 2-column phone grid. Source licensed covers still win where available.
- Standardized Messenger's default graphite palette from blue (`#0c111b`) to actual black. Unified embedded module variables with black `#000` / neutral `#101013` surfaces and VETO rose accents. User-chosen light/sepia reader themes and chat wallpapers remain available.
- Removed giant purple `native-home` and `audio-home-panel` gradients, reduced padding, and raised the embedded Music player by 72px plus safe-area to avoid the host navigation bar on phones. The document reserves extra scroll padding below.
- Fixed four media destinations into **4 across on desktop, 2 across on mobile**, removing the orphan fourth tile. Media header no longer claims “06.1” or wastes space explaining the concept.
- Removed **two direct Lovable links** from BLOTENQ and WHO? cards. Both are explicitly labelled *coming soon* rather than pretending a game is integrated. The game registry now calls these `upcoming` rather than `external` and advertises four playable local minigames plus two in development. Four local games now have distinct, offline original SVG illustration assets embedded in the HTML.
- For Books with no official art, made typographic fallback jackets quieter (Georgia title, no giant uppercase Impact / toy-like branding and motifs); no attempt to pass synthetic artwork off as a real publisher jacket. Original source images remain primary and are never overwritten.
- Cinema uses `year` as default sort and hero deck first priority, so older uploads no longer automatically lead just because somebody uploaded them yesterday. Trim uploader SEO text in *displayed* titles only; the raw source names and legal attributions remain unchanged. Do not falsely claim external franchise metadata is watchable.
- Explicit cache-busting revision `20261101-rebuild01` on the four HTML entrypoints prevents phones from loading old CSS/JS against changed page markup.

### Isolated validation

- **7/7** new source-contract checks in `tests/vetogram-design-recovery-7.test.js` passed in an isolated JS runner.
- **21/21** previously existing preview/source contract checks still passed with versioned links updated.
- Six modified JavaScript modules parsed successfully, plus Book/Cinema/Play scripts in the new-check pass.
- No automated screenshot diff, browser rendering, live Telegram account test, movie stream availability check or native `node --test` run has yet been completed. The current draft PR is not production-ready.
- A separate Render review service is the visual-validation destination; production has not been changed.

### Remaining critical issues before a public launch

1. Verify Android and iPhone WebViews visually at narrow and large widths, with bottom navigation and virtual keyboard.
2. Confirm actual book text, playback and linked media capabilities, distinguishing discovery metadata from playable media. Licensing still limits popular foreign films.
3. True designed/copyright-cleared movie posters and book cover assets for those entries where source art is unavailable; synthetic fallback art is intentionally honest.
4. Reconcile the many inherited CSS stylesheets into a smaller tokenized hierarchy; this pass **fixes visible conflicts but does not claim the underlying CSS debt is retired**.
5. Execute full native Node CI and end-to-end login / message / anti-delete workflows before merge.

## Catalog reliability and quieter content presentation — 2026-11-01

The real Android screenshots exposed another class of problems: movie thumbnails and music art weren't a reliable, useful part of the content grid, and the Books UI mixed read-in-app works with metadata-only bestseller listings.

### Changes in working draft branch
- **Cinema poster identity:** `requestPoster()` previously matched original `f.title` against a shortened human-facing card name. The match broke when titles were normalized, so valid poster fetches weren't attached to their existing cards. Movie cards now carry stable `data-film-id`, and delayed thumbnail updates match the ID instead of display text. Metadata and source attribution remain intact.
- **Cinema mobile bandwidth:** poster requests are now lazy until a card comes within 240px of the viewport (via `IntersectionObserver` when supported), with at most **3 concurrent** upstream requests and a 5-minute cooldown after an unsuccessful lookup. Failed image URLs stay in a failure set; repeated renders cannot issue unlimited requests.
- **Books honesty:** the 200 modern bestseller records are metadata, not readable books. Source tabs now explicitly distinguish `Каталог · без полного текста` and `Новинки · каталог`. A live explanation above tabs changes with the selected book source and differentiates opened books / personal local files / external descriptions. Existing reader and source rights handling remain unchanged.
- **Music artwork:** ccMixter rows use small deterministic, original typographic artwork based on the actual track ID/title instead of the same emoji note. This is labelled editorial fallback and is not represented as authentic publisher/artist artwork. Removed remaining oversized note from playlist home and flattened six old purple-blue playlist gradients into neutral brand surfaces.
- **Phone cache:** updated the `cinema.js`, `books.js`, `books-art-direction.css`, `vetogram-music-licensed-home-63.js`, `vetogram-music-collections.css` and `vetogram-media-edition-62.css` asset version query strings to `20261101-rebuild02`.

### Checks and limitations
- 7/7 new isolated tests of the real poster queue implementation and code contracts passed, including stable ID injection, bounded concurrency, retry cooldown, lazy observers, honest books labels and music art styles (`tests/vetogram-catalog-reliability-7.test.js`).
- 21/21 previously committed source/preview tests still passed after changes, and six relevant browser JS files passed syntax parsing.
- Full native `node --test`, real WebView screenshots and live region-specific video/audio playback remain unverified. A real browser at the review URL could not be run from the code sandbox because external DNS is blocked. **Do not infer actual mobile layout success from isolated tests**.
- Public preview only. No production auth, chat data, merger, or database changes.

Next gates: real Android browser viewport screenshots of the Books shelf, Music playlist, Cinema cards and the player; verified live source availability; consolidate legacy CSS under a smaller design-token system.

## Mobile consistency and honest movie labels — 2026-11-01 (rebuild03)

- Fixed the real CSS specificity conflict in `books-jacket-studio.css`: at 450–600 px a `3-column !important` grid could override the intended two-column book cards. Current breakpoints use **2 columns through 600 px**, then 3 columns from 601–699 px; neutral background and visible card boundary instead of completely transparent book tiles.
- Embedded book document reserves `115px + safe-area` bottom scrolling space above host navigation, so the final row and shelf controls remain reachable.
- Increased miniature world illustrations in the 2×2 mobile Media hub (55→78 px, image scale 0.38→0.60). No fake art source or copyrighted poster has been added.
- Strengthened readable editorial title inside genuinely posterless Cinema cards, keeping titles unobstructed/hidden only over actual poster images. Made the fallback poster background black/neutral, without pretending there is an official theatrical poster.
- Corrected Cinema source messaging: no blanket "Русский" label when release year unknown, no unqualified "Смотреть" for mere player objects, no unconditional Russian-audio claim for the hero.
- Removed 19 redundant repeated patch comments from Books styles; made each correction in an existing stylesheet rather than creating a new high-specificity CSS file.
- Updated source URL cache revision to `20261101-rebuild03` in Studio, Books, Music, Cinema entry points; synchronized preview contract test expectation.

Validation: **6/6** new isolated source-contract checks passed, and Cinema JS parsed successfully; tests committed as `tests/vetogram-mobile-ui-regression-7.test.js`. These are *source contracts, not pixel-perfect WebView screenshots*. Full native Node test suite and Android live viewport verification remain required.

This remains draft PR only. User accounts, message databases, production domains and auth endpoints are untouched.

## Unified player and truthful status lifecycle — 2026-11-01 (rebuild04)

The current integrated Music iframe and Vetogram host both previously rendered their **own** bottom mini-player. The host suppressed itself when Music was the active section and the child bar moved inside its viewport, causing a jump in controls/navigation when switching screens.

Source-level changes:
- `vetogram-universe.js::chrome()` now displays the **one host-owned player** whenever `lastAudio` is available, including while Music is the active module, and preserves the same player in Chats/Cinema/Books.
- `vetogram-media-embedded.css` hides *only* the child module's `.player-bar` when `html.v6-embedded`; standalone `/music-module.html` retains its native controls. Existing `postMessage` handlers still forward seek/toggle/previous/next commands to the real audio element.
- Removed now-obsolete 72px raised child-bar override and 130px of unnecessary body padding. Host reserves one 62px music bar above the main mobile nav through existing `--v6-player`.
- Saved metadata-only tracks and unavailable deep links previously called `moduleStatus(text,false)`, erroneously showing a loading spinner forever and `aria-busy=true`. Added explicit `notice` state, no spinner and `aria-busy=false`, distinct from genuine module loading and retryable iframe failures. Notices clear normally on successful open/module switch.
- Cache-busted the host `vetogram-universe.js` and `vetogram-universe.css` (previously using old 20261031 version) plus the child `vetogram-media-bridge.js` and common CSS across all four entrypoints to **20261101-rebuild04**. This avoids Android retaining mismatched JS/CSS.

Verification, carefully scoped:
- `tests/vetogram-single-player-lifecycle-7.test.js`: 5/5 individual runtime/style checks passed using isolated JS function execution.
- `tests/vetogram-module-status-7.test.js`: 6/6 state-machine checks passed (loading, notice, missing item, failure/retry, clearing, CSS spinner).
- `tests/vetogram-design-recovery-7.test.js`: 7/7 source/design checks passed after adapting obsolete two-player expectations.
- `tests/vetogram-black-universe-preview.test.js`: 22/22 preview/permission/source checks passed after all four entrypoint asset versions were aligned.
- The above checks were **isolated JavaScript runners**, not full native Node CI or real browser screenshot QA. JS syntax for host/media/Books/Cinema/Music/Chats parsed successfully. Real Android/iOS WebView interaction, background audio and media rights/availability remain release gates.

Review service is separate, production unchanged. Do not merge draft PR before live QA.
