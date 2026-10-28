# VETOGRAM 6.0 — integration and release record

Date: 28 October 2026 (Asia/Yerevan). This is an integration branch, not a production release.

## Source map

| Area | Source branch | Inspected source SHA | Integration |
| --- | --- | --- | --- |
| Messenger / auth / Stories / Privacy | `fix/vetogram-v5-login-resume-composer-20261026` | `910ea37d063d5b906cc01aa581b8329a5ea97d73` | Existing `studio.html`, route controller, APIs and five-tab shell |
| Later Messenger reliability | `feat/vetogram-reborn-auth-and-navigation-20261025` | `ea7b4cec332026abfe5ffc3c122b877813c41996` | Merged later avatar, photo, polling, draft/ACK, thread-toolbar and history reliability fixes; retained V5 native media parsing, post-login refresh and connection notice |
| Music | `feat/vetogram-music-openverse-audio-20261028` | `9f75fb4ab8bf8e7e175b0e2f48b70cf6a6cc0610` | Existing native audio, search, radio, personal IndexedDB and collection controllers; source document bundled as `music-module.html` |
| Cinema | `feat/vetogram-cinema-standalone-20261027` | `43bbbcecd81bf4a76be24923114dabe34340bdd6` | Existing catalog, series chooser, provider adapter, watch progress and favorites |
| Books | `feat/vetogram-books-reader-20261027` | `af5b3b1cb3cdd8ecc0a9b008a808a4bc5a4787dd` | Existing whole editions, EPUB/FB2/TXT import, reading preferences, bookmarks and progress |

The experimental audio branch `a8e0330` was inspected, but its unverified Piped/Invidious source was not enabled as a licensed music catalog. The audio-only/open-license branch is the integration source. Historical standalone deployment URLs are not V6 preview evidence.

## One application

The entry point remains `/` → `public/studio.html`. No replacement `index.html`, new Site, new database, paid provider or production alias is created. Primary destinations are Chats, Stories, Media, Protection and Profile. Existing deep links and secondary AI/Voice/Relay/Creator routes remain valid. `?screen=music|cinema|books` opens the corresponding module inside the same shell.

Media modules retain their own documents and controllers in same-origin iframes loaded only after a click. This avoids mixing their CSS/global IDs and contains ordinary JS failures to the module document. These are trusted first-party documents, not a security sandbox for arbitrary third-party scripts. Only the existing Cinema provider adapter can embed reviewed video sources. Modules can be retried without rebuilding Messenger.

Music's one audio element stays mounted while users navigate. The shared mini-player mirrors actual audio events and forwards play/pause, previous, next and seeking to that element. It disappears inside Music to avoid two visible players. Cinema pauses when hidden and asks Music to pause when film playback starts. No promise of playback after Telegram/WebView is killed or closed.

The bridge validates both origin and exact source window. Telegram launch data is read synchronously from the same-origin parent, never put in iframe URLs, local storage, logs, share URLs or postMessage messages. Child modules do not own Telegram's global BackButton. Media documents and now-playing metadata are cleared on launch-identity change. Personal caches/preferences/collections use per-account namespaces; no automatic migration of legacy unscoped personal files into a signed account.

The five destinations and locale keys support RU/EN/HY through the established locale machinery. Russian UI labels are the default; full module translation into EN/HY is not claimed. Four parent theme tokens are propagated to loaded modules; reader paper/night/sepia preferences remain independent.

## Personal Telegram music

`lib/vetogram-music-library.js` reuses `music-bot/library.mjs`. The existing v7 webhook handles private MP3/M4A audio and document messages **after** its original secret check. Business events, image publishing, account login and commands retain their original paths. A forwarded file belongs to the sender's private library, not the original sender's or any public catalog. Users are instructed to send only files they may store/use.

`POST /api/music-library` verifies Telegram HMAC and a one-hour launch-data age, derives the owner server-side, and supports `list`, `bot`, `stream` and `artwork`. Stable opaque IDs survive reordering. User-provided `user_id`, Telegram `file_id` and remote stream URLs are ignored. Lists expose metadata, not bot-scoped IDs. Audio/cover bytes go through a bounded server fetch, never a token-bearing client URL. Covers use Telegram's thumbnail when present, otherwise a local visual fallback.

**Deployment requirement:** explicitly set `VETOGRAM_MUSIC_STORE_PATH` to a private persistent directory on the existing self-hosted Node process. This adapter is deliberately disabled when `VERCEL` is set, and when no directory is configured. It does not silently save durable libraries to `/tmp`. It uses per-owner atomic JSON and in-process serialization; deploy one writer process. Multiple replicas require a separate durable store adapter before use. No persistent directory or bot credential was configured by this change.

The deployed main bot and the music API must use the same existing bot token; Telegram file IDs are bot-specific. The separate historical music bot server remains available, but its different bot token/library is not silently mixed into the main bot. Library listing is paged, limited to 300 records per user, and requires a valid current owner signature.

Telegram's standard Bot API limits `getFile` downloads to 20 MB ([official File documentation](https://core.telegram.org/bots/api#file), checked 28 October 2026). Larger/unknown-size files are not labelled playable in Mini App; they remain in the user's Telegram chat. Local device import still uses the existing browser format/size limits. No Telegram chat scanning or public commercial-recording redistribution is added.

## Availability and verification

- Music retains native audio and explicit failures; source metadata is not proof of a working stream. The imported Openverse test exposed accepting `/watch` as audio based on declared filetype; the normalizer now requires an actual supported audio path extension.
- Cinema retains the source/licensing gates and discovery-only labels. A catalog entry does not guarantee playback or Russian audio in all regions. No film rights, geo access or unavailable provider is fabricated.
- Books retains complete-source and chapter completeness checks. Modern protected titles are catalog/discovery items, not falsely labelled free whole books. No summary substitutes for a complete text.
- Automated tests use fixtures and mocked external transports. They do not prove live Telegram authorization, send/receive, Story publication, provider availability, device audio or physical Fold/iPhone behavior.

Release gates and actual deployment outcome are appended after final checks. Do not call this production-ready until those outstanding real-device flows have passed.

## Integrated Messenger verification

The REBORN branch was merged into the V6 integration branch (not into main). Five source conflicts were resolved explicitly: keep the V6 shell and uniform cache version; retain the later chat retry/ACK/avatar controllers and the V5 media metadata decoder/login refresh; keep the cost-free manual-only verification workflow. No paid Actions run was started.

A fresh comparison run of the unmodified REBORN head showed pre-existing stale source assertions and VM fixtures. Those fixtures were updated for the actual map-based dialog lookup, six-chat/five-minute RAM cache, stable media epoch, live button reacquisition, newer auth error state, two-request avatar lifecycle and cross-realm array comparison. Regression tests still execute the shipping delayed-send and history controllers. No failing suites were removed or skipped to obtain a pass. The existing optional live Neon smoke remains gated on its original configuration.

## Actual local release checks

- Fresh `npm ci --ignore-scripts --no-audit --no-fund` succeeded using the committed lockfile (no dependency changes). Reusing an older scratch dependency tree was insufficient; results below use the fresh installation.
- `npm run vercel-build` succeeded: lock verification, AI preflight, JS syntax, release surface, and **1,224 passing tests, zero failures, one existing optional live-Neon smoke skipped**. All 15 shell screens and 49 first-party shell assets are accounted for. All module document assets exist.
- Thirteen new real-controller/transport fixture tests cover lazy loading, frame reuse across Chat navigation, mini-player state, message origin/source rejection, owner teardown, theme propagation, Cinema/audio arbitration, signed music ownership, webhook authenticity, idempotent intake, opaque identifiers, bounded streaming and private artwork delivery. Those tests are included in the total.
- Browser attempt to the local QA server was rejected with `net::ERR_CONNECTION_REFUSED` by the remote browser. No rendered screenshot, physical mobile/Fold pass, real bot upload or authenticated Telegram end-to-end claim is made.
- No production deployment, production merge, billing change, new paid provider, database migration or real Telegram message was performed. Preview deployment status is recorded separately after the hosting API returns.
