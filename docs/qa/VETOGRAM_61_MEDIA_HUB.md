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
