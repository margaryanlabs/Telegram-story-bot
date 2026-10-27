# VETO MEDIA · Independent Mini App (beta foundation)

**URL when this branch is deployed by an approved static host:** /media.html  
**Production VETOGRAM remains untouched.** This is a separate frontend and brand surface, not part of VETOGRAM sign-in, Telegram Business, messaging, Stories, or relay.

## Already implemented on this branch

- Shared VETO mark from \`public/veto-telegram-mark.svg\`, own MEDIA wordmark, premium mobile/dark interface, light theme, independent navigation.
- Music discovery/search via public Audius endpoints and user-initiated HTML5 streaming for publicly accessible tracks; skip stream-gated/scheduled items; artwork-driven active-track scene, seek, queue next/previous, local favorites, playback errors.
- Books search via Gutendex public-domain flag, Russian/English filters, cover images, in-app TXT reader **only if** source allows cross-origin fetch, font controls, reading position and local favorites.
- Local TXT import (2 MB max) with reader and reading-position persistence; files are processed in the browser and never uploaded.
- Personal EPUB shelf in browser IndexedDB (DRM-free, up to 35 MB per book and 30 books), EPUB.js renderer, chapter navigation, last-read location, adjustable font, and PURE/CINEMA/DEEP reading modes with local per-book notes.
- LibriVox catalog browsing and in-app playback of available chapter stream URLs from the official API, with original-source deep links; no copied MP3 files.
- WebApp ready/expand if opened inside Telegram, but public browser route works without Telegram login.
- Status and failure states for unavailable providers, localStorage-limited devices and failed streams.

## Limitations / do NOT claim production readiness

- Real-provider live calls, CORS permissions, rights clearance, catalog completeness, mobile audio background behavior and playback inside Telegram iOS/Android WebViews are **not verified end to end**.
- No Spotify, Yandex Music, VK Music, major-label streaming, or Telegram file scraping is built in. Their catalogs are not interchangeable public content APIs. No license bypass.
- Audius is an open catalog but every track's redistribution/monetization rights and API terms must be reviewed for a commercial VETO product.
- Project Gutenberg public-domain metadata is not a worldwide clearance. Respect local copyright rules, particular edition and territorial restrictions. Do not mirror the complete Gutenberg website.
- The original **Living Reading Lab 2.4 / «ПОКА ТЫ ЖДАЛ»** code and publishing lab were located in the user's connected Google Drive (canonical release folder: https://drive.google.com/drive/folders/1Z4NYDNTjajUJEfm9DewX-41hkaZb9PLj ; source kit `Poka_Ty_Zhdal_Book_First_2_4_Source_Kit.zip`). The beta includes a newly implemented personal EPUB reader with PURE/CINEMA/DEEP modes inspired by that product, but **is not yet a source-level migration** of the original Living Reading Lab modules, its editorial publishing studio, highlights, EPUB archive export/import, or full rights-ledger workflow. The source kit contains the user's original unpublished book manuscript; because this GitHub repo is public, do not copy that source kit or manuscript into the repository without an explicit publishing decision. Future reuse should extract generic reader/editor components only and preserve rights-gating.
- Audiobook WebView stream verification, EPUB structure-security hardening (the original Living Reader's full ZIP and metadata validation was not migrated), cloud bookmark sync, subscriptions/Stars, recommendation AI, moderation and full catalog ingestion require subsequent development.
- No bot is provisioned or configured. To use as a distinct Telegram Mini App, register a separate bot with @BotFather and connect a deployed HTTPS URL. Do not point the existing VETOGRAM bot at MEDIA.
- No deployment was made by this branch.

## Content roadmap

| Provider | Type | Implemented | Commercial caveat |
|---|---|---|---|
| Audius https://docs.audius.co/api/ | Independent music | Catalog + audio client | Confirm API terms & rights per item before monetizing |
| Gutendex https://gutendex.com/ | Gutenberg book metadata | Browse/search/filters + best-effort TXT reader | Public domain status varies by country and edition |
| LibriVox https://librivox.org/api/info | Public-domain audiobooks | Browse/source links + best-effort in-app chapter streaming | Attribution, recording and territorial rights |
| Open Library https://openlibrary.org/developers/api | Book metadata | Planned (not connected) | Not a bulk third-party database or unrestricted reading API |
| Jamendo https://devportal.jamendo.com/api_terms_of_use | Independent CC music | Not connected | Commercial API use requires separate arrangement |
| Yandex Music, VK Music, Spotify | Commercial popular catalogs | Not connected | Licensing, territorial rights, partner integration required |

**Music sourcing:** artists and labels -> distributors/aggregators -> platform under negotiated rights. Initial commercial strategy: direct opt-in independent artists and licensed catalogs; for Russian and international hits seek rights holders or a licensed B2B provider. Never present scraped Telegram collections as a legal distribution feed.

**Telegram payment:** For digital services sold inside Telegram, integrate Stars (XTR) in a later phase; pricing and entitlements are not part of this beta.

## Dev / review

Static site files: \`public/media.html\`, \`public/media.css\`, \`public/media.js\`. No bundler, database, token or paid hosting required to inspect the UI. Serve the \`public\` directory on any static HTTPS host (or a local HTTP server for browser-only inspection). API availability may vary by origin due to CORS and network restrictions.

QA checklist:
1. Mobile Android/iOS layout at 320, 390, 768px and desktop.
2. Open as normal web page and inside Telegram WebView, check no phone auth request.
3. Audius trending/search/stream; fail closed for unavailable or gated tracks.
4. Gutenberg search RU/EN, public-domain labels, open source TXT when permitted; otherwise original source link.
5. Local TXT import, reader size and progress across reload; local EPUB import, reading mode, pagination, chapter navigation, and IndexedDB persistence. Verify no EPUB executable scripts run and malicious ZIP structures are rejected before any public launch.
6. Favorites, previous/next, seek and reduced motion.
7. LibriVox source attribution + clickthrough.
8. No changes to VETOGRAM flow or production deployment.

## Project architecture

\`Telegram-story-bot\` currently contains VETOGRAM and this isolated sibling **frontend** for shared brand assets. It is not a shared production backend. After beta validation, move VETO MEDIA into a dedicated repository/domain, retain shared design tokens, and onboard its own Telegram Mini App bot.


## V3 entertainment continuation — 2026-10-26

- Modular film tab added to `/media.html` with `media-films.js` and `media-films.css`. Search/list of archived video items from the Prelinger collection with public-domain metadata indicators, poster thumbnails from Internet Archive, spotlight, horizontal reel, film details and opt-in Internet Archive iframe player with original-source fallback.
- The archive API is a third-party dependency. Failure or CORS rejection yields a clearly labeled error with archive source, never invented film catalog entries.
- Preview artifact `veto-media-preview-v3.html` was constructed independently for visual design review; it includes the full immersive home, five-button mobile dock, cinematic film rail and playback mock testing. Modular parity with the standalone preview is work in progress. Preview asset is stored in the conversation and is not an automatic production deploy.
- Browser UI smoke tests used a 390px mobile and 1440px desktop viewport, including navigation, film modal, no horizontal overflow, and test provider responses. Production Telegram Android/iOS streaming, licensing outside the U.S. and payment remain unverified.


## V4 immersive continuation (2026-10-26)

- New standalone VETO MEDIA **Home** is the default tab; cinematic hero, mood shortcuts for Audius search and cross-links to Films/Books/Audiobooks. Mobile bottom navigation is included.
- New `public/media-v4.js` + `public/media-v4.css`: full-screen **Listening Room** is bound to the real browser audio element, with an animated vinyl scene, current track metadata, previous/play/next controls, seek bar and Pulse/Aurora/Midnight color themes. Motion reflects playback state, **not live audio-frequency measurements**.
- User-facing browser-only `veto-media-preview-v4.html` built and tested separately with mocked public catalog responses. At 390 and 1440 px, both home and film rail showed no horizontal overflow; modal music room opened, switched theme and closed with no JS page errors. This is *not* a live-provider WebView or production acceptance test.
- Source repo `margaryanlabs/Telegram-story-bot` uses a dedicated Draft PR with all VETO MEDIA additions. Do not merge/deploy while VETOGRAM PR #185 remains in development.
- Provider limitations unchanged: no paid Russian/international chart catalog; cinema intentionally restricted to third-party archive metadata flagged public domain, territorial rights must be verified; Gutenberg books and Audius streams can fail in Telegram due to CORS, region or provider restrictions.


## V5 Personal Universe (2026-10-26)

- New `media-v5.js` and `media-v5.css` provide a private on-device watchlist for film archive entries and books opened in the reader, in addition to the existing music favorites. Films created solely as design concepts in a preview are labeled explicitly as concepts when saved.
- Accessible Save/Unsave controls are added to film/book details; the personal tab displays two lists, totals and source links. Browser localStorage is used with a maximum of 60 entries per category, bounded strings, HTTPS-only source links and no upload/API write. User can export a portable JSON list manually; there is no import or account-level sync.
- Saves do not survive clearing browser storage, private browsing limits, or Telegram's WebView storage eviction. Failure is reported rather than guaranteeing persistence.
- Separate V5 conversation preview tested with a mock browser storage backing in headless Chromium (390px + 1440px). Film and book save, reload-like document rebuild and retrieval succeeded, with no JS page errors or horizontal overflow. This is not an end-to-end Telegram login, platform SDK or external streaming test.
- No paid streaming catalog, license, VETOGRAM auth/bot changes, merge or production deployment.


## V6 reliability and recovery (2026-10-26)

- `public/media-v5.js`: transactional browser-local saved items. When localStorage writes fail, an attempted Save/Unsave is rolled back instead of claiming it persisted.
- `window.VetoPersonal.importCollection`: manual JSON backup restore. Validates file format/version, maximum 60 items per collection, unique IDs, bounded strings, HTTPS-only links and a complete replacement with rollback if saving fails. The UI asks before replacement; no file goes to a server.
- `public/media-v6.js` and `media-v6.css`: provider status only updates after this tab actually receives success/failure from Audius, Gutenberg, LibriVox or Internet Archive. Unchecked providers are not falsely marked healthy. Includes a playback-retry banner and source link if browser audio cannot load. Includes a browser-local 'continue' rail for saved films and books.
- `public/media.js`: source catalog requests now use 12s AbortController timeouts, report bounded provider results to V6, and show a nonfatal message on media element errors. `media-films.js` reports archive query result after a successful public-domain-flagged selection.
- Standalone `veto-media-preview-v6.html` lives as a separate conversation-generated file, not a deployed site. Headless browser QA of the preview used 390px and 1440px screens with simulated provider responses: music loading, archive film entry, book reader/save, saved-item continuation, audio-error fallback, JSON import, unsafe URL rejection, and no horizontal overflow or page JS errors. Browser QA with mock responses **does not verify any external live stream, Telegram WebView compatibility, or actual music/movie licensing**.
- Source catalogs verified against current upstream API documentation for Audius and Gutendex. Their read APIs can be used without a paid key at lower limits, but every actual track's streamability, territory, and rights require further checks. Internet Archive uploaded license metadata is not legal proof for other jurisdictions.
- Remaining gates for launch: real Android/iOS Telegram playback, full library export/import and EPUB sandbox-security tests, stream/cross-origin behavior, real film rights, bot entrypoint, host, review and monetization. **Do not merge or deploy VETOGRAM.**


## V7 Telegram native bridge and listening resume (2026-10-26)

- Real Telegram WebApp integration is now in `public/media-telegram.js` and `media-telegram.css`. The official `https://telegram.org/js/telegram-web-app.js` script is loaded before the media application. Native integration is enabled only when the Telegram SDK exposes nonempty `initData` and `ready`; it is **not used for authentication**. The same static site still runs standalone outside Telegram.
- The app calls ready()/expand(), sets dark header/background when the official methods are available, maps Telegram safe-area/content-safe-area inset values into CSS, supports optional native BackButton closing film/reading/player overlays or returning Home, and opens ordinary HTTPS source links using Telegram.openLink only when explicitly clicked.
- On-device audiobooks store the LibriVox chapter index and playback seconds for up to 40 books in localStorage. Playing a saved book restores the chapter and time on `loadedmetadata` when seekable. All data is local; it is not a synchronized library, and WebView storage eviction may erase it.
- Official SDK API surface checked against Telegram Mini Apps documentation; music/stream, browser stream redirects, audio focus, iOS and Android SDK event support still need **manual end-to-end HTTPS + Telegram device testing** before launch.
- Browser-only HTML preview `veto-media-preview-v7.html` includes a Media Readiness panel (Telegram launch hint, MP3 codec support, IndexedDB and browser storage availability). Tested with mocked catalogs in Chromium at 390x844 and 1440x900: readiness rows rendered, music/film navigation worked, no reported JavaScript exceptions or horizontal overflow. The preview is independent and not a deployed Telegram launch.
- The main VETO MEDIA code is in Draft PR #191 and is not merged or deployed. Do not touch VETOGRAM authorization, business bot, MTProto, stories, or production hosting.


## V8 Personal Audio and Listening Studio (2026-10-26)

- `public/media-v8.js` and `media-v8.css`: optional offline-capable audio file chooser, local queue (12 files maximum, 100 MiB per file / 300 MiB combined), audio object URLs that are revoked on clear/pagehide, selection and next/previous navigation. The files are not uploaded and not persisted by the app. Users re-select them after a page reload, while player volume/rate preferences may persist locally.
- New controls: volume, 0.75–2× playback speed, 15/30/60-minute sleep timer and browser Media Session actions (when supported). UI state follows the actual browser media element.
- The new V8 code never requests any server, file storage upload or Telegram account data; external provider integrations remain in their existing separate modules.
- The full-screen Listening Room shortcut is raised above the mobile mini-player, to avoid an actual mobile click-interception defect found during QA.
- HTML design preview `veto-media-preview-v8.html` built and tested independently using Chromium on 390×844 and 1440×900. **A real, on-device generated PCM WAV** (4 seconds each, two different tones) was uploaded via the file picker on each viewport. Observed: browser audio playback started and advanced beyond zero; next/previous switched files; volume was 42%, speed 1.25×, 15-minute timer enabled; clear removed queue; a new document instance had zero local files. No page script exceptions or horizontal overflow were observed. Preview originally targeted an HTML `audio` section rather than the `audioEl` element for the Listening Room; this was corrected and retested. The preview contains synthetic test track names during automated QA only.
- Limitations: Actual arbitrary MP3/M4A playback in Telegram Android/iOS was not tested, and codec support depends on the device; third-party Audius/Internet Archive/Gutenberg/LibriVox streams have not been end-to-end tested inside Telegram; do not claim otherwise. Telegram safe-area API calls and Mini App launch authentication must be verified on an actual HTTPS host.
- No merge, deployment, payment integration, or change to VETOGRAM auth, chats, Stories or Business bot.

## V9 playback queue management (2026-10-26)

- The local-only audio queue in `public/media-v8.js` can now be reordered, tracks can be deleted individually, and the listener can toggle **Shuffle** and repeat modes **All / One / Off**. The queue updates the active-track index on reorder without reloading the playing blob; deleting an active track stops and releases its blob URL before selecting the next item. All controls have keyboard/assistive-technology labels.
- Added `public/media-v9.css` to preserve VETO cinematic styling and responsive row actions on phone screens. The locally created HTML preview `veto-media-preview-v9.html` remains an independent design/runtime preview; the repo version uses the same queue logic and styles, but production WebView testing remains outstanding.
- **Browser verification**: mocked Audius discovery while testing actual local WAV audio files (330/440/550 Hz) in headless Chromium at 390px and 1440px. Verified adding 3 local tracks, reorder preserving playing track, removing a different track, removing the currently playing track with the next track taking over, repeat and shuffle buttons, queue clear, no horizontal overflow or JavaScript page exceptions. These test WAV files are generated only for QA and are not distributed in production.
- Live third-party Audius/Internet Archive streams were not validated in Telegram Android or iPhone. Catalog service availability, regional copyright clearance, and Telegram's real audio focus rules remain gating. Film availability is separate from uploaded Internet Archive copyright labels; avoid claiming global playback rights.
- No deployment or merge, and no modifications to VETOGRAM messaging, session, authorization, Stories, or production infrastructure.


## V11 status (2026-10-27)
- Unified search Discover is implemented under public/media-discovery.js + CSS and linked into media.html, media.js and the six-button mobile dock.
- Providers: Audius tracks (playback request only on click), TVmaze television metadata (CC BY-SA source attribution and no episode player), Gutenberg public-domain texts (reader bridge), and Internet Archive public-domain-labelled Prelinger archival records (source links).
- Per-source failure and search cancellation do not drop results from the other providers. Search metadata is cached for up to 5 minutes only in the current page; no background scraping.
- Favorites from Discover are saved locally, separately from the existing V5 library; no account sync or server upload. V11 TVmaze details use the Telegram BackButton when hosted inside a genuine WebApp.
- Browser QA of separate standalone V11 preview in Chromium (390x844 and 1440x900) with four MOCK responses: four cards rendered, filters and TVmaze details modal worked; a simulated TVmaze HTTP 503 left three other providers active. No JS page exceptions or horizontal overflow reported.
- The preview's synthetic Sherlock Archive record is for QA only. Actual live results, stream access, mobile Telegram WebView, poster licensing and copyrighted movies have not been verified. No VETOGRAM production merge or deployment.


## V12 production-readiness hardening (2026-10-27)

- Strengthened client-side EPUB import: public/media-epub-guard.js performs a ZIP central-directory preflight before epub.js parses or IndexedDB stores the book. Enforces 35 MiB input, 2000 ZIP entries, 120 MiB total uncompressed, 35 MiB per entry, compression ratio <=250, no encryption, no ZIP64, no traversal paths, no duplicated filenames, valid MIME entry and local file headers. Resource preflight is NOT a complete malicious-book HTML/DOM isolation guarantee.
- Integrated guard via media.html before media-epub.js; existing epub.js reader continues to pass allowScriptedContent:false. Read via local ArrayBuffer only; no upload.
- Added developer-only QA panel via public/media-readiness.js and CSS. It activates only on ?media_qa=1 or #media-qa. The panel does not collect or export Telegram initData, private chats, MP3s, book files, playlist contents or credentials. It reports only Boolean WebView hint, local capabilities and the status of four human-triggered read-only source API probes, with a 9-second timeout each and no credentials. It can export a JSON report for manual review.
- Chromium standalone preview: veto-media-preview-v12.html. QA panel is visible in this review snapshot so it can be opened from the sandbox preview. At 390x844 and 1440x900, confirmed: 6 capability rows, 4 mocked JSON API success replies, exported JSON report, modal close/reopen, no horizontal overflow and no page JavaScript exceptions. Mock requests DO NOT verify real provider response, streaming, licensing or mobile Telegram.
- Direct EPUB guard function checks run against a minimal central-directory test fixture: valid ZIP, bad name traversal, missing mimetype, suspicious expansion, encryption and corrupt EOCD all passed expected allow/reject results. Corresponding Node test files added under tests/veto-media-epub-guard.test.js and tests/veto-media-readiness.test.js. The full repository Node test suite has NOT been executed in this session.
- Manual release checklist: host VETO MEDIA independently over HTTPS, open via a real Telegram Mini App entrypoint (not a regular browser tab) on Android AND iOS, verify source GET requests and actual audio/video playback, seeking, backgrounding/foregrounding, file import and local persistence. Review commercial audio/film licenses and rights flags; test EPUB iframe scripting/sanitization and large legitimate EPUBs. Do not merge or deploy to production until these gates pass.
- Keep VETOGRAM messaging, auth, Stories, and bot session isolated. PR #191 is still a draft. No main merge, no hosting bill or deployment.


## V13 Immersive Sound Studio (2026-10-27)

- Introduced standalone reusable `public/media-v13.js` and `public/media-v13.css`, loaded after the existing audio modules. V13 builds an accessible full-screen player sharing the exact current `<audio>` element; no second audio engine or Telegram session access. Users open it through the new floating launch control, from the Home page, or with `#v13` deep-link. The older V4 floating shortcut is hidden to prevent overlapping CTAs but remains in source for rollback.
- Visual design: animated layered ambient gradients, kinetic orbit rings, rotating vinyl cover, 47 decorative bars, CSS accent themes (Ember Glow, Aurora, Midnight), album art from current track when available, progress halo and responsive 390px/1440px layouts. Background animation runs only while the actual audio element plays and follows reduced-motion preferences. **Decorative motion is NOT true audio-frequency FFT and must not be advertised as frequency-reactive.**
- Functional controls: play/pause, next/previous via existing VETO controls or synthetic demo, seek, volume, playback rate (0.75x to 2x), sleep timer (15/30/60 minutes), local demo shuffle/repeat, local theme preference. Integrates with V8's playlist shuffle and repeat controls when the primary source is not demo audio.
- Original synthesized demo: generated locally on user click as a PCM 16-kHz mono WAV blob. Three original sound designs share a 20-second synthesis engine; no DRM bypass, external stream/download, paid API or backend. Browser object URLs are revoked when replacing the demo, changing audio source or closing the page.
- Telegram: `public/media-telegram.js` BackButton now closes V13 first, and V13 open/close manually synchronizes native BackButton visibility. This still requires genuine Android/iOS Telegram testing, not merely a browser script.
- QA: Independent HTML preview `veto-media-v13-player.html` auto-opens the new studio; `veto-media-preview-v13.html` includes it in the full VETO MEDIA experience. Chromium browser QA at 390x844 and 1440x900 with catalog API mocks confirmed real synthesized WAV advancing playback, pause/resume, next demo track, theme change, volume, 1.25x rate, 15-minute timer, close/reopen and zero page JS exceptions or horizontal overflow. Audio playback came from a generated WAV blob, **not from a live Audius track or actual Telegram WebView**.
- Node static and synthesized WAV byte-level tests in `tests/veto-media-v13.test.js`. Full repository test suite and production integration tests were NOT run.
- The sandbox HTML is a working local artifact, NOT a public hosted HTTPS Mini App URL. Do not claim real Telegram deployment, permanent streaming rights or commercial launch readiness. No production VETOGRAM change, merge or deploy.


## Public V13 review site (2026-10-27)

- A real HTTPS review page for the already-built V13 player was created as a new independent Vercel Hobby static project `veto-media-v13-live-preview`. Public URL: https://veto-media-v13-live-preview.vercel.app/ .
- Deployment ID: dpl_65YkGa1zb76hVfas6ZhCY4pDQKFU ; Vercel API confirmed READY. Project ID: prj_sRmxZmWxHue8LL62TjZIMuI4oBKk . Project has SSO, password, and IP protection disabled for public review only.
- Independent external page fetch confirmed a public 200-equivalent HTML page title 'VETO MEDIA V13 — Launch Lab & Immersive Media' and the media catalog/players. This is a copy of the existing self-contained V13 HTML preview, not a live deployment from the Draft PR #191 branch.
- The hosted page can play a locally synthesized test audio track on user click, but no real Audius streaming, film rights or Telegram Android/iOS WebView compatibility was certified by the external page fetch. It is not a production release, connected to any user accounts, or linked to VETOGRAM messaging.
- The account's Vercel plan was reported as Hobby/active at the time of creation; this deploy used no paid plans, database, Railway or Supabase. Preview is a separate project so VETOGRAM production remains untouched.


## V14 full HTTPS platform (2026-10-27)

- User-requested public FULL-SITE preview: https://veto-media-platform-live.vercel.app/ . Separate Vercel Hobby static project id prj_BZ4Tznt1XrsCZyEG8jaglboO7fru, latest READY deployment dpl_GnhPRjBPABysWHPnpg1cpjNjXH2p. Stable domain points at the complete VETO MEDIA (Music, Cinema, Books, Audiobooks, Discover, My library, V13 player, V14 integrations); Vercel login protection disabled only on this independent review project. Unauthenticated public page fetch confirms page content and title.
- Public deployment is a self-contained copy of the existing full V13 HTML preview, with new V14 modules inlined. It is NOT a CI deployment of Draft PR #191. The GitHub branch receives separate source modules and public/media.html wiring. Production VETOGRAM untouched.
- Official Radio Browser public read API: users can search stations, filter known-broken entries and play HTTPS live streams in shared VETO audio only on explicit click. Stations may be HLS or browser-incompatible, and radio broadcast rights depend on providers/region. No unlicensed relay or guaranteed stream.
- Official Apple iTunes Search API: Apple Podcasts directory metadata, artwork and links to Apple Podcasts; the app does not copy podcast files or impersonate an authorized Apple Music player. Apple promotional terms need review for commercial launch.
- Provider Hub on Home labels 8 source/integration categories honestly: Audius tracks (availability dependent); Radio Browser live (availability dependent); Apple Podcasts, TVmaze (catalog only); Gutenberg books, LibriVox audiobooks, Internet Archive archived film; VK/Spotify user-supplied CSV/JSON/TXT import only (no password, no paid recordings).
- Visual enhancements: cinematic radio/podcast cards and an additional glow layer on V13 Listening Room. These are play/pause-aware visuals, NOT a real remote-stream FFT.
- Real server API probes: de1.api.radio-browser.info returned Jazz stations and itunes.apple.com returned podcast metadata. The full public site was retrieved without Vercel authentication. Browser JavaScript interaction and actual live audio within Telegram WebView were NOT verified: optional remote browser automation lacked credits; do not label a stream or a search result fully QA-passed.
- Tests: tests/veto-media-broadcast.test.js, tests/veto-media-integrations.test.js. Pure source mappers checked for valid Radio URL, HTTPS filter, HLS signal, dead stations, and Apple podcast source URL; full repo automated suite not executed.
- Further direct integrations (VK/Yandex/Spotify playback, Apple MusicKit, TMDB commercial film metadata) depend on official account authentication and licensing; importing a playlist list never transfers its audio bytes. No VETOGRAM release or dependency bills created.
