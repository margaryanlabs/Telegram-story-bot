# VETOGRAM 7.3 — Media & Play Review Notes

**Scope:** review-only branch `feat/vetogram-black-universe-preview-api-20261101`, not main or production. No changes to Telegram session, Business permissions, database, payments or server-side message processing.

## Delivered in this iteration

- V7.2 media editorial hero, 2×2 discovery cards, in-shell navigation, 2026 dark-neutral visual language.
- Same design stylesheet loaded last in the existing Music, Cinema and Books entrypoints; actual module files, players and reader remain in place.
- Play hero, six illustrated and playable game cards, native dialog launch, favorites, shareable game links and 6 offline game entries (Reaction, Memory, Tic-Tac-Toe, 2048, Mines and Snake).
- **Mines:** 6×6, 6 mines, safe first opening including adjacent cells, zero flood reveal, flag mode (also right-click on desktop), victory/loss detection, device-local wins.
- **Snake:** 12×12, direction controls, touch swipes, keyboard arrows, game-over detection, score/best, pause/resume, pause when app hides or the game modal closes.
- Unavailable BLOTENQ? and WHO? remain explicitly labeled as **in development**. Online rooms remain server-dependent and are never passed off as playable offline.
- Direct `?screen=play&game=snake` links can focus the selected card even if route selection occurred before deferred Play Store init. They do **not** automatically start a game.

## Verification

Run independently:

```sh
node --test tests/vetogram-play*.test.js tests/vetogram-showcase-v72.test.js
npm run qa:surface:offline
npm run qa:preview:offline
```

The Vercel preview build runs the offline static/release and preview gates. A READY deployment is evidence of the build gates, **not** of a full Android WebView acceptance pass.

### Manual mobile acceptance cases still required

1. Open `/studio.html?screen=media` in Android Chrome and Telegram WebView. Verify cards, no overflow, bottom nav and music/cinema/books switches.
2. Open `?screen=play`, launch each of six offline games and close with the native button or Android Back. Verify focus return and no background Snake interval.
3. Mines: safe first click, flag, restart, loss and victory. Snake: arrows, swipes, collision, pause, background and high score.
4. Verify catalog favorites and safe share links without session parameters or chat contents.
5. Confirm live Media streaming with actual permitted providers, playback restrictions and user-owned content. Offline static tests **do not** establish content licensing, catalog completeness or stream availability.
6. Test responsive 360px/390px/600px and phone keyboard/touch targets in light/dark preferences.

## Known limitations

- No proven real third-party audio/video playback on all devices or geographies; provider/rights restrictions may apply.
- Only the existing licensed/open/owned media sources are intended for playback. Catalog-only titles must not imply full access.
- Telegram OTP/chat reliability and Supabase/Railway/Neon integrations have not been modified or validated by this UI-focused branch.
- Real browser-based visual QA needs a working browser environment and device checks. Do not merge the draft PR solely because preview returned READY.

## V7.4 device-local records and Android WebView safety

- The original game preview CSS accidentally hid every `.vp-game-art` in the gallery. The whitelist now explicitly preserves art while keeping game controls out of inactive cards.
- Native `<dialog>` close events may arrive after a following tap on Android. `vetogram-play-runner.js` restores the game card synchronously with idempotent native close handling; the fast-switch regression is in `tests/vetogram-play-runner.test.js`.
- Six real records appear in the Play hub with direct launch controls. Existing storage keys are read-only for the dashboard; game engines remain the sole writers. The panel is labelled **only on this device**, not a synced account or server leaderboard.
- The panel re-reads records on game close, app focus, screen navigation back to Play, or a cross-tab storage change. Catalog search and filters are reset through the existing filter handler before opening a selected game.
- Tests are in `tests/vetogram-play-records.test.js`. Check narrow 320px/360px/390px WebViews for horizontally scrollable score cards and focus indicators.

### Honest build status
Preview Vercel `READY` at `02e5744a` proves the earlier six-game build. Subsequent V7.4 commits need a new build and mobile visual pass. New preview creation may be blocked by Vercel `api-deployments-free-per-day` 402, which is not a code or CI success/failure result.

## V7.5 — Catalog search + first-screen navigation + surprise play

- On mobile, the four real Media module cards appear **immediately after the hero** instead of being buried below the private-library search and Continue sections.
- The media dashboard now differentiates **external catalog discovery** from searching the owner's local VAULT. Search is entered once and routed to the existing same-origin owner-checked Music/Cinema/Books modules. It **does not** invent local results, persist user queries, copy chats or fetch unauthorized provider data.
- Short query rejection (one visible character), explicit empty-query catalog browse, allowlisted destinations and no-provider fallback are covered by `tests/vetogram-media-discovery-v75.test.js`.
- Arcade has an **Удиви меня** action that uses the original native game runner to open one of the six ready offline games only — not online rooms or unfinished BLOTENQ?/WHO?.
- New CSS in `public/vetogram-discovery-v75.css` is screen-scoped, keyboard-focus visible, responsive to 390px/760px and reduced-motion aware.
- `npm run qa:preview:offline` now includes the V7.5 discovery and V7.2 structural tests. `npm run check` syntax-checks the new Media/Game scripts.

### Deployment warning
The latest V7.5 code is **not** at the preceding READY V7.4 URL. The explicit Vercel deployment endpoint returned HTTP 402 `api-deployments-free-per-day` after 100+ daily builds. A previous automatic deployment (first HTML-only change) correctly failed the release surface check because newly referenced assets had not yet been committed. Both assets have since been committed; **do not claim a clean V7.5 build until new deployment logs actually confirm it**.

## V7.6 — Game input and background-timer safety

- **2048** handles keyboard arrows only when its own `.vp-game-in-dialog` is open. Otherwise arrows remain available to the page, accessible forms and the Snake game.
- **Snake** handles keyboard arrows only while actively running in its own open modal. Typing in INPUT/TEXTAREA/SELECT and scrolling in other app screens is not hijacked.
- **Reaction** cancels outstanding reaction delay when its modal closes; no score can appear afterward from that pending timer.
- **Four Pairs** cancels a pending mismatch flip when its modal closes, the app backgrounds or Play navigation exits. Already resolved matches are preserved unless a mismatch animation is interrupted.
- Added scoped keyboard and countdown regression tests in `tests/vetogram-play-arcade.test.js`, `tests/vetogram-play-plus.test.js`, and `tests/vetogram-play.test.js`.
- All changes are limited to the review branch. **Full browser and Vercel acceptance of this head is still required before marking ready.**

Manual test on Android: open Snake then tap directional arrows and close; open 2048 and press arrows; return to Media and scroll; open a search input while the Play screen is underneath; run Reaction then close during countdown; play Four Pairs with an unmatched pair then switch screens.

## V7.7 — richer local games & persistent progress

- **2048:** one-step undo restores board, score and game-over status without reducing the historical best. Undo is disabled until a legal move, and cannot be reused indefinitely.
- **2048:** current session (`board[16]`, score and two game flags only) is saved on device on legal moves, resets and undo. After reload a strictly validated local state resumes; invalid or corrupted JSON, unsafe tile numbers and impossible scores are discarded. The undo history itself is deliberately not saved.
- **Mines:** touch or pen long-press (~440 ms) places a flag without selecting mode; synthetic click after the hold is suppressed. Desktop right-click remains supported.
- **Mines:** opened numbered cells support standard Minesweeper chord interaction when adjacent flag count matches. Wrongly flagged neighbors can still cause a loss. Chording is disabled in flag mode.
- **Mines:** stale touch timers are cancelled on reset, dialog close and app backgrounding. Mobile buttons disable text selection for more reliable hold gestures. Existing reveal and flag mode remain available.
- Updated game help copy to describe persistence, undo, long press and number actions.
- New cases in `tests/vetogram-play-arcade.test.js` and `tests/vetogram-play-plus.test.js`: undo board equivalence, single-step behavior, reload resume, corrupt storage recovery, touch hold, synthetic tap suppression, canceled gesture, chord without flags and pending timer cleanup.

### Manual acceptance for V7.7
1. Play 2048, make a legal move, undo, then reload. Verify restored current state and no stale undo history.
2. Corrupt only the `vetogram:play:2048-session:v1` **test fixture** (not a real user profile), reload and verify a safe new board.
3. On Android, long-press a closed Mines cell: exactly one flag. Tap quickly: open the cell. Move finger off button: no delayed flag.
4. Tap an opened numbered cell before flagging: no reveal and descriptive status. Mark exactly its adjacent mine count and tap again: neighbors reveal, including a potential loss if flags were incorrect.
5. Close the Mines dialog during a hold and navigate between Music/Play screens. No delayed flag or hidden timer should run.

The preview build status must be verified at the **current Git SHA**; READY on an earlier commit is not proof for this new code.

## V7.8 — Cinema, Music & Books native product pass

### Cinema, existing `public/cinema.html` and `public/cinema.js`
- A real action hub with *Continue*, *Series*, *Search*, *My collection*; it calls the original `VetogramCinema.openTab/openFilm/getLibrary` instead of creating alternative pages.
- A favorite with valid unfinished watch progress is eligible for Continue; an absent / completed history falls back honestly to browsing rather than opening arbitrary content.
- Source availability and licensing remain truthful. Existing player / licensed provider logic, metadata and history remain authoritative.
- Original Cinema tabs are horizontally scrollable on narrow phones; real film cards get a consistent visual treatment, readable metadata and focus outlines.

### Music, existing `public/music-module.html` and `public/vetogram-music.js`
- A one-tap hub for real search, personal music library, radio and adding permitted tracks. Uses the existing module's actions.
- Compact **Now Playing** UI reads the existing native audio and `VetogramMusic.now()`. It invokes the original `miniPlay` controller; it does not create a second audio source, silently autoplay demo media, upload recordings or persist private searches.
- Track rows, cover handling, active playback, keyboard focus and compact player contrast redesigned without changing licensed source contracts.
- Sleep timer, queue and Media Session remain owned by the existing music controller.

### Books, existing `public/books.html` and `public/books.js`
- **Continue** invokes the genuine progress action when available. Without a saved page, it goes to reading discovery and reports the absence of progress.
- Direct native actions for readable editions, personal saved shelf and local EPUB/FB2/TXT import.
- Keeps existing distinction between readable full-text editions and metadata-only catalog. No fictional book text or claims of rights.
- Reader controls, progress page labels, book-card focus and text wrapping updated for small touch devices. Original reader pagination, VETO FLOW, annotations, source attribution and owner scope remain intact.

### Shared implementation
- `public/vetogram-media-next-78.css` — four-column desktop action rail, 2-column tablets, single-column phones; distinct Cinema/Music/Books accent palettes.
- `public/vetogram-media-next-78.js` — strictly allowlisted actions for the three existing modules; no privileged Telegram, chat, external fetch or duplicate players.
- `tests/vetogram-media-next-78.test.js` — module-specific navigation, absent history fallback, native playback delegation, saved reading and import, DOM markers, responsive styles and no forbidden API access.
- `package.json` preview QA gate includes this test; syntax check includes the shared script.

### Current release gate
- Source changes are committed to draft PR #214, not merged to production.
- GitHub's Vercel check is currently **failure due to build-rate-limit**, pointing to a Vercel upgrade/rate-limit page, rather than a completed current-head build.
- Do **not** claim the V7.8 test suite passed or that there is a working V7.8 URL until a READY deployment with matching commit SHA and runtime smoke check exist.
- Validate on Android WebView: Cinema resume/search/library; Music real permitted audio, next/prev, import and player states; Books real full-text, search, EPUB/FB2/TXT import, bookmarks, reading progress and controls.

## V7.9 — in-app media continuity / source-preserving UX

- **Three-media handoff:** An accessible in-frame switcher in existing Cinema, Music, Books allows one-tap changes between real modules and the shared Media hub. No extra sites, copied players or URL-based privilege handoff. The navigation is emitted only from a trusted embedded module.
- **Host security:** `vetogram-universe.js` accepts child-initiated navigation only if the sender is the current active, already-ready iframe, the same-origin and owner-scope handshake succeeded, and the requested module is an own property of the allowlisted module definition. Inactive or spoofed child tabs cannot trigger switches.
- **Playback lifecycle:** Existing host `visibility()` remains authoritative. When Cinema is hidden, its embedded video is paused / closed through the real controller; Music maintains its original single persistent audio player under the host chrome; Books pauses speculative chapter prefetch without discarding the open page.
- **Cinema native progress:** `cinema.js` persists actual native-video watch progress on `visibilitychange` (hidden) and `pagehide`; direct progress remains tied to observable HTML5 video duration/time only. Third-party iframe position is not fabricated.
- **Music native settings:** `vetogram-music.js` saves only player volume (0–100) and allowed speed (.75, 1, 1.25, 1.5, 2) to scoped device storage; validates these preferences on restore. No audio bytes, query text, Telegram sessions, links, lyrics or secret tokens. No autoplay after reload; sleep timer remains session-only.
- **Books:** existing page/chapter and progress saves occur inside `showPage()`. The V7.9 handoff deliberately preserves this tested behavior; no new book fetches, fictional full-text content, or reader replacements.
- Source tests: `tests/vetogram-media-next-78.test.js` (switcher), `tests/vetogram-media-continuity-79.test.js` (trusted iframe handoff, audio prefs, native film progress), wired into `qa:preview:offline`.

### Release condition (latest head)
- Vercel GitHub status is currently **failure: build-rate-limit**, not a passed current-head test run. An older READY URL does **not** contain these source changes.
- No merge or production promotion. Preview deploy, automated tests and Android/iOS WebView end-to-end playback/reader checks are still required before claiming V7.9 shipped.
