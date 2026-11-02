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
