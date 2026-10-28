# VETOGRAM 6.1 — Media Home & VETO VAULT implementation

Date: 28 October 2026. Feature branch / Draft PR #210, not a production release.

## Scope
- Existing studio.html remains the only app entry. No new website, new backend, credentials, cloud service or media server.
- Replaced three oversized Media Home cards with compact Canvas Noir header, personal search, continue shelf, three responsive media destinations and VETO VAULT panel.
- VETO VAULT aggregates locally stored Book bookmarks/progress, Music likes and Cinema favorites/history/progress from the existing Cinema controller. Only metadata; no message/chat/file/audio bytes or Telegram auth parameters copied.
- Search is scoped to actual personal/local index; not a fake cross-provider global catalog. Separate quick links open the individual Music, Cinema and Books search interfaces.
- HTTPS-only personal link saving and removal. Intentional tap opens external links via the Telegram WebApp API when present. Per-account localStorage, no cloud sync claim.
- Original child controllers and one audio element remain authoritative. VETO PLAYER is a full-screen overlay for existing audio controls (play/pause, next, previous, seek), not an additional player.
- Cross-module activity uses origin and exact source window validation, then bounded metadata. Cinema entries with inaccessible source IDs are not invented.
- All unavailable music/film sources remain clearly unsupported; this update does not grant content rights.

## Verification
- V8 syntax parsing on affected JavaScript sources passed.
- Targeted personal-index, search, HTTPS, account-isolation and shell navigation simulations passed. See current-turn audit.
- Added tests/vetogram-universe-61.test.js and tests/vetogram-universe-61-shell.test.js for the normal Node test runner.
- NOT yet run for the V6.1 head: complete npm run vercel-build and regression suite, actual browser visual checks, real Android/iPhone/Fold Telegram WebView, live auth/send/Stories/media provider validation.
- Vercel preview previously rejected with HTTP 402 api-deployments-free-per-day limit; no new READY preview URL claimed.
- Personal Telegram bot music upload still requires the persistent private Node directory documented for V6, which this interface does not provision.

## Release gate
Keep Draft PR #210 unmerged and existing V5 production unchanged until fresh complete build, real Telegram E2E, media source and device rendering QA pass.

## Saved-item resume follow-up
- Saved Books and Music cards pass their actual scoped item ID into the existing reader or Music controller; metadata-only music opens Search and missing local audio is refused.
- The iframe bridge checks both parent origin and exact source window. Missing saved items now return an explicit failure banner, not a silently broken tap.
- Vault counts only saved materials, and account switching resets its expanded state.
- New permanent regression test file: `tests/vetogram-universe-61-deeplink.test.js`, including the saved-item failure case.
- Full Node suite still needs a source checkout/CI runner. This environment has no network access to clone GitHub and Vercel preview is blocked by free quota.

## QA continuation — 28 October 2026 (release hardening)
- Full-screen VETO PLAYER: guarded against opening without a current track; return focus after closing; Escape and wrapping Tab/Shift+Tab controls; automatically closes on cross-screen navigation and source loss. The original Music iframe/audio element remains the sole player.
- Media retry: preserves the requested page and item ID, clears and removes a failed first-party iframe before recreating it, and clears stale player metadata for a Music retry.
- Added two cases to `tests/vetogram-universe-navigation.test.js` for retrying the same film/search and null-audio closure.
- Added `tests/vetogram-universe-61-assets.test.js` (four offline release-surface tests) covering local asset existence, unique document IDs, five existing primary navigation routes, script bootstrap order and one audio controller.
- Repository tree audit: 627 tracked paths; all 62 distinct CSS/JS/image references scanned across four entry documents are present, and `public/studio.html` contains 664 unique HTML IDs with no duplicates.
- Focused VM fixture: ten fullscreen keyboard/focus/source-loss checks passed. A second fixture: nine retry/deep-link checks passed. Syntax of the changed shipping JS and test body was checked.
- **Limitations**: full Node `npm run vercel-build`, all tests, actual browser-rendered visual QA, private MP3 via bot and live Telegram login/chat/Stories were **not run** in this session. GitHub has no Actions workflow run for V6.1 commit `cb6d254` and direct GitHub clone failed due network resolution; these are NOT passing checks. Preview on Vercel is not available under the previously observed HTTP 402 daily free deployment limit.
- **Release remains blocked** until those real tests pass. Do not merge this draft PR to main or modify active production V5.

## Follow-up — personal Music and real Books import (28 October 2026)
- VETO VAULT Books import CTA now routes directly to the existing Books local-file import panel. It selects the owner's "local" source, scrolls to the EPUB/FB2/TXT import area and focuses the real file import button. The native file picker is **not opened automatically** from a cross-iframe message; the user must tap explicitly.
- Music module provides `getLibrary()` returning only sanitized ID/title/artist/category metadata for saved tracks and actual locally imported MP3s. The original audio Blob, file bytes, transient Blob URLs, streaming credentials and bot file IDs are **not** sent to VETO VAULT.
- The music bridge sends a bounded library snapshot on readiness and after local audio/liked-track changes. Main shell only accepts trusted same-origin messages from the exact iframe window, then stores per-owner metadata in `vetogram-v61-music:owner-ID` with the existing signed-context scope pattern.
- IndexedDB restoration race fixed: opening a saved local MP3 from Media Home awaits `localDbReady` before testing whether the audio is available. The bridge now supports asynchronous open-status acknowledgements and reports false for missing items.
- VAULT distinguishes `Личный аудиофайл`, `Сохранённый трек` and `Только название, без аудио`. Metadata-only entries remain discovery/search items, not playable tracks.
- New tests: `tests/vetogram-universe-61-library-import.test.js` (four cases) and an additional asynchronous-restoration case in `tests/vetogram-universe-61-deeplink.test.js`. Targeted V8 fixtures and static checks: 16 focused checks passed at this follow-up.
- **Release gate remains blocked**: no fresh full Node `npm run vercel-build` in CI, no rendered browser/Android/iPhone/Fold QA, no live Telegram auth/Stories/chats testing, no verifiable V6.1 preview URL. GitHub Actions verification workflow is intentionally `workflow_dispatch`-only due repository owner's billing constraints; did not attempt a runner or paid Vercel deployment. Existing V5 production remains unchanged.

## 28 October — Continue resilience and full personal library
- Saved music "Продолжить" now finds real in-session Audius/provider entries, the current playback queue and original owned demo compositions. If an old provider track has expired and only title/artist metadata remains, it navigates to Music search instead of claiming playback. Unowned/unknown IDs are still rejected. Parent banner resets after successful opens.
- Previous implementation rendered only 35 search hits/50 VAULT rows and truncated the entire local index at 400. The index now retains up to 1,200 bounded metadata entries and offers explicit "Показать ещё" controls (35 for search, 50 for VAULT). Search heading reports true match count. Filters and account changes reset pagination.
- VAULT rows are constructed lazily only when open; the closed widget still shows the full saved-item total.
- Added `tests/vetogram-universe-61-pagination.test.js` with three deterministic checks for 120 books, progressive reveal and account-isolated reset. A separate targeted execution of the real V6.1 scripts passed 9 checks.
- **QA caveat:** full Node test suite, browser-rendered mobile UX, real chat/Stories/auth and the Vercel preview have not been verified; no deployment, money spent or production V5 modifications.

## V6.1 unified personal search → live module catalogs
- The Media Home personal collection search remains local-only. If no saved record is found, the user can choose Music/Cinema/Books source discovery with the existing query preserved; no additional service, server or API credentials.
- Parent passes the trimmed query to the exact matching same-origin child iframe via `action:search-query` after readiness; query never appears in the iframe URL, logs or Telegram launch context. It is retained for explicit retry.
- Music uses the existing `VetogramMusic.search()`; Cinema uses `VetogramCinema.search()` with its real catalog and matching query; Books uses `VetogramBooks.search()` on the currently selected catalog (if private-local mode is selected it switches to the full-book catalog rather than hiding the search box). External discovery is not represented as guaranteed playback.
- Cross-origin/forged-window messages are ignored; queries shorter than two characters are not sent into search. Added `tests/vetogram-universe-61-cross-search.test.js` (four focused cases). The matching parent query handoff was exercised in a targeted V8 iframe fixture.
- The full Node suite and real browser/device QA remain open release gates; no Vercel preview or production change is claimed.

## 28 October — single-app navigation QA and film deep-link correction
- Audited the existing `app.js` route owner. Its real `VetoTelegramNavigate` controls the five native bottom tabs and emits `veto:screen-changed`; Universe listens without replacing the Messenger/Stories/Privacy navigation controllers.
- Fixed Cinema duplicate deep link: embedded saved-film selection is sent **once** over the validated same-origin `open-item` bridge after frame ready, not simultaneously in the iframe URL. A direct film request on the parent URL is still validated and forwarded into the child command.
- Updated `tests/vetogram-universe-navigation.test.js`: corrected stale frame-message fixtures and URL expectation, added a real single-app lifecycle scenario Chats → Music → Cinema → Books → Chats → Media that checks frame reuse and visibility; all **8 navigation tests / 54 assertions** passed in an isolated V8 execution of the shipping controller.
- The cross-module Books search previously directed users to the 18-item `complete` reader subset. It now selects broader `spotlight` discovery when invoked from `complete` or personal `local`; existing catalog error + external-source fallback remain visible instead of promising full text. Added regression test verifying that and preserving an explicitly selected `ru` source.
- Four existing media test suites were separately exercised in a V8-compatible harness: 18 previously existing cases passed, and the new Books-specific search case passed. Together with the 8 navigation cases, 27 targeted cases were checked in this phase.
- **What this is not:** this is not a full Node `npm run vercel-build` or browser/Telegram E2E run. No claim of successful real mobile auth, chat loading, story publishing, licensed external streams, or Vercel deployment; GitHub Actions billing guard and previous preview quota errors remain. Production V5 is unchanged and PR #210 remains draft.

## 28 October — V6.1 pending-play race, private storage and large-library QA
- **Stale iframe replies**: every `open-item` now carries a monotonically increasing `requestId`; child acknowledgements echo it after success/failure. Parent ignores an asynchronous failure/success that does not match the currently requested item, even when it comes from the correct iframe. This prevents misleading error banners when users rapidly open different materials.
- **Latest Music selection wins**: `openSavedById` cancels an outdated pending IndexedDB restore when a newer saved track or manual playback has been chosen. Only the latest requested audio may start; owner-scoped file restoration remains asynchronous.
- **Owner protection**: media frame teardown now compares both signed initData and Telegram user ID. Cached frames, audio metadata and owner-local state cannot survive a changed user ID even if a client refreshes its SDK fields in stages.
- **Fast VETO VAULT**: the per-owner metadata index is now cached during search typing and invalidated on account change, localStorage changes and media/library writes. Previously a single search input could parse and collect up to 1,200 items repeatedly. Recalculation now occurs only after relevant data changes.
- **Honest storage errors**: browser privacy mode or quota errors are never presented as successful link saves. A compact guest-mode note warns that unsigned collections are device/browser-scoped and visible to other people sharing the same browser profile. Signed-account collections remain separated by owner-specific keys.
- **Deduplication**: new recent activity retains the saved record's original artist/description (e.g. `Личный аудиофайл`) instead of replacing it with blank metadata.
- Added focused regressions for request-order races, cancellation, owner-ID changes, VETO VAULT cache invalidation, denied storage, guest-mode disclosure and saved-media metadata. Exercised **36/36 targeted cases and 173 assertions** against the actual shipping JS in a V8-based test harness. This is not a complete Node runner; no browser UI or end-to-end Telegram testing was performed.
- Static release surface check: 631 tracked files, 62 distinct local asset references across the four entry HTML pages, **0 missing**; 667 IDs in `studio.html`, **0 duplicates**. Syntax checks were performed for edited shipping JavaScript.
- **Release blockers remain**: clean `npm ci`, `npm run vercel-build`, real Android/iOS chat/auth/Stories/audio-video, and deployed V6.1 preview. The GitHub Actions workflow is manual-only to avoid owner billing and Vercel preview was blocked by provider quota. Keep PR #210 draft, no automatic merge and no production V5 changes.

## 28 October — actual Vercel deployment inspection and module-load recovery
- Inspected the connected **labsmargaryan-5386** Vercel project `vetogram-cinema-preview` after GitHub showed a green commit status. The deployment for commit `2ca8d41` (`dpl_5wgcxDQTn2kUhdWsKQLzoAhDJPcL`) is **CANCELED**, **not READY**; the Vercel API reported no READY deployments for `feat/vetogram-6-universe-20261028`. The deployment detail points to Vercel's ignored-build-step documentation. A green GitHub status is **not** evidence of a live preview URL. Do not give a fabricated/untested URL.
- Fixed embedded media module boot verification: `vetogram-media-bridge.js` now announces `ready` only when the correct actual controller loaded on the matching `/music-module.html`, `/cinema.html` or `/books.html` document. Missing/invalid controllers, unknown routes or caught script failures announce `failed` to the existing parent error UI instead.
- Fixed retry lifecycle: `vetogram-universe.js` now persists per-frame load-failure/timeout state and keeps "Повторить загрузку" visible after navigating to another module or Chats and returning. On error, the obsolete 18-second timeout is canceled so it cannot replace a specific failure message with a misleading timeout warning. Retry creates a fresh iframe and reapplies pending navigation context; previous V5 controllers remain authoritative.
- New permanent cases: `tests/vetogram-universe-61-ready-contract.test.js` (4 tests for positive readiness, missing modules, unexpected paths, script failures and nonembedded cases) and three added cases in `tests/vetogram-universe-navigation.test.js` (retry after failure, background timeout, iframe error).
- Targeted V8 test harness after these changes: **43/43 tests and 203 assertions passed** across the six focused suites. The complete Node test suite was **not executed** and no live Telegram/mobile browser QA took place.
- Expanded static import audit: 4 entry pages (`studio.html`, `music-module.html`, `cinema.html`, `books.html`), **121 local src/href references checked, 0 missing**. Checked both root-relative (`/`) and page-relative (`./`) asset paths against the complete non-truncated repository tree. No duplicate HTML IDs across any individual entry page.
- **Release gate:** draft PR #210 stays unmerged, production V5 unchanged; wait for a verified READY preview and real user-device/Node testing. No paid deploy triggered.
