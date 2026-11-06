# VETOGRAM 8.0 — ONE MEDIA DESIGN / Review gate

**Source:** `margaryanlabs/Telegram-story-bot`, review branch `feat/vetogram-black-universe-preview-api-20261101`. This is a structural UI redesign, **not** a new media backend or production merge.

## Benchmarks that informed information architecture
- Netflix: item posters and featured content, browse by film/series, genre category tiles, search and Continue Watching. Official 2026 mobile UX references: https://help.netflix.com/en/node/575087423404644 and https://help.netflix.com/en/node/47765.
- Spotify: music filters, real cover art, persistent player and recent/library access. https://support.spotify.com/gq-en/article/sort-and-filter/.
- Apple Books: personal library, full-text reading, last page and collections. https://support.apple.com/guide/iphone/read-books-iphc1af7c57/ios.

These are interaction-pattern references, not copied layouts, assets, branding or licensed catalogs.

## Actual changes
### Media Home
- Remove misleading fake decorative cover art/vinyl from four **navigation** destinations; render a compact 4→2 navigation grid.
- Simplify the hero and unify spacing/typography with the three real modules.
- Put existing, owner-scoped Continue shelf before the Media world choices; the original VAULT, search and ownership logic remain unchanged.

### Cinema
- Reorder original nodes: real navigation and search immediately after hero, then source-backed playable film rail, film genres and latest rail, then compact secondary actions.
- Format native film posters consistently at 2:3, preserve real source artwork and only show text fallback when no poster is available.
- Render category tiles with a poster selected **only from already loaded film metadata**, via an HTTPS source URL; with validated text fallback and image error handling. No random generated fake poster or unauthorized content injection.
- Retain the original Cinema film/series browse tabs, provider availability disclosures, player, source rights and watch progress.

### Music
- Surface existing licensed tracks before secondary promo and actions; keep native `licensedHomeSection` node and its original audio handlers intact.
- Suppress redundant marketing widgets, not the real search/catalog/library/import/radio features.
- Remove the decorative vinyl stage. Keep native audio player, now-playing, radio LIVE, local uploads, original source attribution and volume/speed preferences.

### Books
- Move the original featured **readable** editions and real source category/language filter row above the redundant quick-action intro.
- Display existing edition cover images when source supplies them; otherwise preserve an honest author/title jacket (not an invented scan).
- Reader, original import formats, chapter/page progress, public-domain source attribution and licensing remain under the existing Books controller.

### Implementation files
- `public/vetogram-editorial-80.js`: deterministic, listener-preserving DOM arrangement only; no fetch, sessions, auth, browser links, string HTML or fake media.
- `public/vetogram-editorial-80.css`: cohesive responsive tokens and module-scoped presentation across Media Home, Cinema, Music and Books.
- `public/cinema.js`: optional, original-film poster on real genre categories.
- `public/studio.html`, `public/cinema.html`, `public/music-module.html`, `public/books.html`: existing documents load 8.0 assets last.
- `tests/vetogram-editorial-80.test.js`: original component preservation, content order, CSS breakpoints and data-backed art. Enforced by preview QA script.

## Must validate before product release
1. Render deployment commit SHA equals latest review branch; all four real pages resolve, CSS/JS assets load.
2. Mobile on Android 360/390px: real posters, no viewport overflow, filter action and source attribution visible.
3. Open Cinema category, watch verified licensed source, return and resume; ensure no false play claims.
4. Play a music track; use native playback and then switch modules; confirm persistent mini-player and no duplicate audio.
5. Open a complete book and turn a page; save and resume, local import, native back button.
6. Test owner/account scope, Telegram session and error/loading state in production-like environment; do not promote preview without this.

## V8.1 compact mobile first-fold pass

Applied narrower max-height/min-height limits to existing Cinema, Music, Books and shared Media mastheads (620px breakpoint). The pages now bring genuine category/poster/audio/cover sections into view sooner instead of reproducing full-height welcome pages. The original artwork, genre/source controls and playback/reader nodes remain in their owning modules.

Regression: `tests/vetogram-editorial-80.test.js` checks module-specific mobile mastheads and sticky-cinema catalog offset. This only validates source/style contracts; no Android screenshots or real swipe/tap automation were available because the connected browser automation wallet is out of funds. Final QA still requires visually checking 360px and 390px breakpoints.

## V8.2 — native filters visible immediately

**Music:** added a compact scrollable genre selector in the existing home screen with seven **actual** preset IDs from `vetogram-music-catalog.js`: `ru`, `am`, `world`, `ru-rap`, `electronic`, `jazz`, `world-lofi`. Selection calls the original `VetogramCatalog.selectPreset` before `VetogramMusic.showPage('catalog')`, avoiding the initial default RU query and duplicate request. If either module is unloaded, the status reports it without falsely claiming the search worked. No new/unauthorized music is added.

**Books:** the existing `catalogSearch` form is moved before the original `featuredEditions` section; existing source availability tabs and genre `.topics` are moved above secondary action UI. Those same DOM nodes keep their original event listeners. Responsive styles provide scrollable 42px+ touch targets and focus states, without replacing book text, shelf persistence or data sources.

**QA:** `tests/vetogram-media-catalog-82.test.js` is part of `qa:preview:offline`; four targeted JS execution/simulation checks passed (real preset IDs, single-search routing, unloaded fallback, and Books node/order preservation). These checks do not prove third-party provider availability or visual Android testing. Production remains unchanged.

## V8.3 — Real-audio cover gallery and cache correctness

- Native Music catalog has a new **Обложки / Список** switch. Obложки is the starting view; cards use 1:1 images already provided in the normalized Audius track metadata, not fake covers. The original alphabetical/track list remains available immediately. Both views keep the **same** original nodes and user actions (Play, favorite, share).
- Gallery adapts from five columns on wide desktop to two on phones. Original source/availability and error states are unchanged; failed artwork reverts to an honest text fallback.
- The new controller only alters the existing `#catalogResults.dataset.viewMode` and `aria-pressed` state; it does not instantiate a second player or send extra requests when toggling.
- New `tests/vetogram-media-cover-grid-83.test.js` covers real image/source, default cover mode, list switch, invalid mode, and responsive/artwork constraints. Four targeted JS/test simulations passed and it is included in `qa:preview:offline`.
- **Android cache fix:** the editorial CSS/JS URLs in all four native documents are bumped to `20261102-media83`; Music catalog CSS and JS get the same version. This avoids presenting an older cached release as the latest one after preview publication.
- Remaining validation: matching Render LIVE deployment, Android Telegram touch QA, real artwork fetching from Audius, licensed music playback, video and books reader.

## V8.4 — Fix actual catalog fragmentation

The 8.0-8.3 editorials moved only selected Book controls above a secondary action hub, separating them from related source/translation filter panels, the main shelf heading, book results and source legal footer. Cinema likewise left the actual all-film browse/grid below the secondary panel. This did not match the promised content-first information architecture.

**Cinema:** preserve the original `#cinemaBrowse` with source-backed film cards, genre `#cinemaGenres`, sort `#cinemaSort`, pagination, and empty/unavailable states, but place the entire **existing** section right after the real movie rails and before the secondary shortcut hub. Responsive desktop and mobile grid and touch/keyboard genre controls are scoped to the real elements.

**Books:** move all *existing DOM nodes* together before the shortcut hub: original search, readable edition covers, library/source tabs, actual full-text/metadata explanation, source description, translation/hot/classic/spotlight filters, personal import banner, author discovery, shelf heading, genre chips, legal availability explanation, dynamic `#catalogGrid` and pagination/source attribution footer. This keeps all native filter handlers, imported files, rights notices and the original reader; no alternate search or content datasets.

**Evidence:** `tests/vetogram-editorial-84-contiguity.test.js` executes the real editor script against realistic original element order, checks both Cinema and Books final DOM order and verifies that all original nodes survive. The three target tests passed in a JS harness. QA gate now includes this file. Mobile presentation scoped to actual `#cinemaGrid`/Book filter controls. The four HTML files use `20261102-media84` asset versions so updated Android WebView caches do not mask the fix.

**Still needed:** full `npm run qa:preview:offline`, Render exact HEAD LIVE check, mobile screenshot/tap QA, source-provider streams and reader/import verification before promoting draft PR #214.

## V8.5 — Continuous navigation through the real Media modules

- **Back trail in the parent shell:** the existing `#v6MediaBack` button now returns to the previous *visited module* (Music/Cinema/Books) before returning to the Media home. The button's accessible destination updates to `Назад: Музыка`, `Назад: Кино`, or `Назад: Медиа`. No fake browser entries or hidden redirects.
- Frames remain cached on Back, preserving the original modules' internal page, track queue, reading context and scroll positions (while video pauses through the existing hidden-frame protection). The shell navigation history is memory-only and capped at 12 entries; no viewed titles, files or private Telegram credentials are persisted.
- **Same navigation everywhere:** the existing `v79-media-switcher` now shows the four real destinations in standalone Cinema/Music/Books pages as well. In the integrated Telegram shell, same-origin allowlisted and owner-verified postMessage navigation switches cached frames. Standalone preview uses native local links, not an iframe or second fake player.
- History resets on explicit `Все медиа` and on Telegram-account identity changes, so a subsequent login cannot restore another owner's module.
- Extended `tests/vetogram-universe-navigation.test.js` with Back traversal, trusted/invalid child transitions, identity isolation. Updated `tests/vetogram-media-next-78.test.js` to exercise standalone/embedded nav, correct per-module actions, multiple audio event listeners, source-safe parent messages, CSS selectors and accessible states. Targeted JavaScript executions: **21/21 shell navigation cases and 9/9 Media hub cases pass**.
- Version-bumped the parent shell script and all three module shared Media CSS/JS to `20261102-media85` for mobile WebView cache freshness. The whole `qa:preview:offline` and real Android WebView / actual media playback still require a verified release run.

**Production:** no merge and no changes to the main Vetogram. Review branch only.

## V8.5 — Real Media navigation continuity

The integrated Media Back button now walks a capped in-memory navigation trail (up to 12 visited modules), returning to the previous cached Cinema / Music / Books iframe rather than always returning to Media Home. The former direct-to-hub behavior still applies when the trail is empty. The host frame cache remains owner-scoped and is destroyed on Telegram account identity change. No history content, private book text, media urls, user identity or Telegram launch credentials is persisted.

Standalone direct Render URLs for Cinema / Music / Books also expose a fixed, same-origin four-way navigation row to Cinema, Music, Books and Media Home. In the integrated shell, the same links instead send verified same-origin module-navigation messages to the trusted current host; inactive frames cannot change routes. The standalone controls work as regular local links and do not require JavaScript parent messaging.

Adjusted `tests/vetogram-media-next-78.test.js` to model the actual module-specific action set and multiple native audio event listeners. Current targeted JavaScript execution: 21/21 shell navigation cases and 9/9 media hub cases passed. These are not real Telegram Android playback or gesture acceptance results.

All affected Media assets use `20261102-media85` to invalidate old Android WebView copies. Full CI gate, release browser screenshots and live provider/player QA remain pending.
