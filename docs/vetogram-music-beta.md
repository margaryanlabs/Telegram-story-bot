# Vetogram Music — music-only beta

Branch: `feat/vetogram-music-only-20261027`
Site: https://vetogram-music-live.vercel.app/
Independent Vercel project: `vetogram-music-live`, project `prj_8Zp9yMlnDbXy2L3zToC1GQycmHoU`.
Source: `public/index.html`, `public/vetogram-music.css`, `public/vetogram-music.js`.
No films, books, audiobooks, or VETOGRAM messaging modifications. Do **not** merge/deploy the underlying original media branch as VETOGRAM production without review.

## Implemented

- Music-only Home, Search, My Music, Radio and Add Music; immersive animated vinyl player, 2 themes, keyboard playback, responsive navigation, play/pause/seek/volume/speed/shuffle/repeat/sleep timer.
- Two locally generated **original demo** soundtracks for offline player UX verification. They do not impersonate mainstream copyrighted recordings.
- Audius official read/search API and direct stream attempts: https://docs.audius.co/api/ . Availability is per track and territorial restrictions may apply. No assumption of license to republish the full service for commercial use.
- Radio Browser HTTPS stations via mirrored public metadata endpoints. Stations supply their own streaming URLs; cannot guarantee formats, playback or retransmission rights. Respect Radio Browser's terms and the originating broadcaster.
- Personal audio files selected explicitly by the user; music files remain in this browser. IndexedDB attempts to keep them between visits; private browsing/WebView storage cleanup can remove them. Files are **not uploaded to Vetogram servers**.
- A metadata-only playlist import in text / CSV / JSON from user-provided Yandex Music or VK Music lists. Artist/title records only; NOT their actual audio, authenticated libraries, or passwords.
- Favorites stored locally; no cloud sync or automatic access to Telegram chats.
- Media Session API/transport controls for compatible browsers. No guarantee that audio keeps playing after the Telegram Mini App is minimized/closed.

## What is NOT implemented

- Automatic reading of user's Telegram music channels or private chats; Telegram Mini Apps launched by direct links have no such chat access.
- VK/Yandex protected music files, full subscriptions, or a Yandex/VK audio-stream API bridge. Licensing/partnership needed to offer mainstream catalog at scale.
- Cross-device cloud library, Telegram music-bot upload, or guaranteed Android/iOS background audio. Existing VETOGRAM bot sessions are **untouched**.
- Paid subscriptions, royalty reporting, studio agreements, downloads of third-party tracks, account-level login.

## Practical Telegram bot bridge for personal background listening (future)

The viable path is a **separate opt-in music bot**, not chat scraping:

1. User sends or forwards an audio file they own or are authorized to use to the new music bot (a bot only receives messages addressed to it or authorized chats). Never request their Telegram OTP or session.
2. Bot webhook verifies Telegram update authenticity/secret and sender/chat; records file ID, owner ID, title and performer in a private database. Do not show bot token, file ID or public Telegram file URLs in the browser.
3. With standard Telegram Bot API `getFile`, downloads are limited to **20 MB**. Telegram's self-hosted Local Bot API server can download without size limit, at additional infrastructure cost; upload limits/rights are separate. Keep file data private and use time-limited authenticated streaming routes if the mini app needs to play audio itself.
4. For background playback independent of the Mini App, the bot can `sendAudio` the user's authorized file back to the user's Telegram chat. Telegram's *native* player can handle supported audio in its own context; confirm actual device behavior. This doesn't magically license tracks or permit reading arbitrary channels.
5. For in-app integration authenticate via Telegram WebApp initData **server-side**, verify signature and freshness, issue user-scoped short-lived tokens, rate-limit, log minimal metadata. Don't expose BOT_TOKEN in frontend.
6. Content policy and uploader consent required; don't provide public redistributions of unknown or copyright-protected files.

Telegram Bot API: https://core.telegram.org/bots/api . Mini App docs: https://core.telegram.org/bots/webapps .

## Release gates

- On a real Android and iPhone, open via BotFather-configured HTTPS Mini App, test local file picker, storage persistence, physical headset controls, screen lock, minimize, background playback and audio focus.
- Confirm Audius search and streaming CORS, codec support and quotas, Radio Browser station streams, and external provider terms. Rate-limit discovery, implement retry/cache and user-friendly errors.
- Add more robust CSV parser tests and stronger IndexedDB storage management, import progress, deletion/reordering of saved local files and size-quota UX.
- Audit accessibility and performance on low-memory phones; autoplay must be user-initiated.
- The live site being public and Vercel READY is not a successful end-to-end Telegram WebView test.

## Pricing

An affordable/free beta is realistic for personal files and open-license content where permitted; unlimited mainstream catalog cannot be sold cheaper than VK/Yandex without music licenses, royalty payments, and compliance. Subscription should fund user-value features (cross-device sync, playlists, AI recommendations) rather than unlicensed redistribution.


## Social and personal-library upgrade (2026-10-27)

- Public full Vetogram Music beta remains at https://vetogram-music-live.vercel.app/ ; deployment dpl_Bm52HdscMRQeyCAY1kVf2uqkYEwd was READY and its newly published HTML and social JS were externally fetched as public resources.
- Added `public/vetogram-music-social.js` + CSS: Telegram chat-picker share for Audius track deep links (`?track=id`), opt-in friend import of metadata-only playlist links (`?mix=base64url`), default sharing of the app with friends, track-level Share actions, Up Next queue controls, and a premium social invitation card. No uploading personal playlists to a central server.
- Telegram link format based on https://core.telegram.org/widgets/share and https://core.telegram.org/api/links . Links contain titles, performers, and IDs only; no MP3s or private Telegram initData.
- Share links cap the mix to 14 records and approximately 1700 URL chars to stay within message length limits. Full library export is JSON, which can be downloaded or shared via supported Web Share files. The recipient must confirm the import; no automatic injection into another person's collection. Unicode/cyrillic roundtrip, bounding and damaged-link rejection verified in a standalone JS sandbox.
- On supported mobile browsers, explicit user click can `navigator.share` the user's locally imported audio as a File through the OS chooser. Telegram may appear as a share target. This is NOT a Telegram bot upload and unsupported WebViews show an alternative message. Privacy: no user audio goes to Vetogram backend.
- Personal local tracks have order controls and an individual delete action. Order is persisted in localStorage; deleting one clears its IndexedDB entry, revokes the local object URL, updates queue and favorites, and stops playback if it is currently playing.
- Follow-up test files `tests/vetogram-music-social.test.js` and `tests/vetogram-music-bot.test.mjs` were added. Full test suite was not executed. Tests verify encoding, UI hooks, URL limits, webhook secret, private chat restrictions and duplicate-update filtering.

## Optional music bot — code-only, not running

- `music-bot/server.mjs` is a separate Node HTTP webhook service, NOT wired to an existing Vetogram messaging bot. It is not deployed and requires a new music bot token, long random webhook secret, HTTPS webhook URL and independent production review.
- Telegram Bot API documentation: https://core.telegram.org/bots/api . Bot receives ONLY direct/private MP3 or M4A audio messages voluntarily sent to this music bot, then resends the same bot-scoped Telegram `file_id` back to the **same chat** using `sendAudio` for Telegram's own native audio player. It does not crawl personal chats, private channels or VK/Yandex protected catalogs. No getFile/download, no user library database, no cross-chat relaying.
- Uses timing-safe verification of Telegram X-Telegram-Bot-Api-Secret-Token, private-chat ID equality and bot-sender rejection, a 128 KiB webhook body cap, 11s outbound timeout, in-memory duplicate update check, and no logging of user identifiers or raw tokens. In-memory deduplication is insufficient for production exactly-once behavior; add durable idempotency before launch.
- Launch conditions: user explicitly connects a **separate** bot, creates secrets, verifies webhook routing, tests Telegram audio player on Android/iOS, handles content rights and privacy, abuse prevention, deletion, storage and support before accepting general public submissions.
- The bot returns a user-submitted audio message in Telegram; it is NOT a guarantee of Mini App background playback or commercial rights for mainstream tracks.

## Remaining product limitations

- This beta does NOT provide unauthorized free copies of VK/Yandex protected music, scraping, DRM bypass or full mainstream music catalogs. A free beta does not remove licensing obligations. Legal test content includes user-supplied/authorized audio and provider-allowed Audius streams.
- Android and iPhone native background behavior still requires device tests; the WebView can be suspended on minimize. The native Telegram player for user-sent files is a viable complementary path, not yet launched.
- Audius playback, Radio Browser station compatibility and Web Share support vary with network, browser and territorial rights. The hosted UI was externally fetched but not end-to-end exercised in a real Telegram mobile client.


## V3 personal audio connectors (2026-10-27)

- Added `public/vetogram-music-direct.js` and `public/vetogram-music-direct.css` to the music-only UI; users can add individually entered HTTPS audio URLs or upload/paste a plain M3U file with EXTINF artist/title metadata. The user's browser streams the source directly; Vetogram never fetches/hosts the audio server-side.
- Direct audio URLs must be HTTPS, without credentials or fragments. Yandex/VK/Spotify/YouTube page URLs, private/localhost hosts, HLS/M3U8 and HTML pages are not considered direct audio file streams. Browser codec support and source anti-hotlink rules still apply.
- M3U file parsing caps 160 KiB input and 150 unique entries; it ignores non-HTTPS unsupported entries, extracts Cyrillic artist/title pairs and explicitly rejects HLS manifests (`#EXT-X-`). The full playlist is stored only in browser localStorage; no private stream URLs included in friend-share metadata links.
- Added local library section for these user-provided streams, including playback through the existing audio element, persistent reorder/removal and metadata-only Telegram playlist sharing.
- `tests/vetogram-music-direct.test.js` covers source validation, duplicate and HLS handling, Unicode, UI hook and source syntax. Manual pure-parser checks confirmed two Cyrillic tracks parsed correctly, duplicates removed and unsupported links rejected. Full repository test suite and Android/iOS Telegram playback still outstanding.
- Public music-only Vercel site: https://vetogram-music-live.vercel.app/ . Vercel confirmed READY and external fetch verified the HTML and direct-import JS/CSS. An HTTPS page and JS presence are not a guarantee any particular external music provider plays successfully.
- Bot module remains code-only with no Telegram bot token or webhook deployed. No protected VK/Yandex scraping or commercial audio redistribution is included.


## V4 music charts and Russian/Armenian discovery (2026-10-27)

- Added dedicated Charts navigation route with mobile and desktop entries plus Home discovery promotion. The existing five pages remain music-only.
- `public/vetogram-music-charts.js` and CSS implement real Audius `/v1/tracks/trending` rankings with week/month/year/all-time and optional Electronic/Hip-Hop/Pop genre filters. The chart order is the provider's, never invented. Attribution says **Audius Trending**, not VK, Yandex or an official national ranking.
- Russian and Armenian music discovery use **user-initiated Audius track searches**. Initial Russian queries: `Russian music`, `русская музыка`; Armenian: `Armenian music`, `Հայկական`. User can search any particular singer/title. Searches return candidate recordings from Audius, which may not include a mainstream artist's original master; no false original-song claims.
- RU/AM live stations use Radio Browser's `/json/stations/bycountrycodeexact/ru|am` endpoint, sorted by provider votes and filtered to `lastcheckok` plus browser-compatible HTTPS non-HLS streams. Station ranking by votes is not a song chart. Each station plays through the existing user-initiated player; actual broadcast accessibility may vary.
- Cards show returned track artwork, source, artist, optional genre, actual rank for Audius Trending, playback via existing Vetogram Music queue and Telegram sharing. There are no fabricated track records; blank, empty and provider failures get clear messages.
- The module has per-source cancellation, independent provider failures, 5-minute memory caching and manual refresh. It does not download mass catalogs, bypass DRM or use account secrets.
- `tests/vetogram-music-charts.test.js` covers rank source, API endpoints, RU/AM code filtering, locked Audius tracks, Cyrillic/Armenian metadata and navigation. Eight converter/routing syntax checks ran in the GitHub-tool JS isolate; **full project suite and live network stream tests have not run**.
- Sources: https://docs.audius.co/api/ , https://docs.audius.co/sdk/tracks/ , https://docs.radio-browser.info/ . Their published API contracts permit these queries, but the response at any given time and in-Telegram stream behavior require live device verification.
- Keep free beta on provider-permitted music, users' authorized files, and broadcaster streams, respecting content usage permissions. Not a VK/Yandex pirated catalog or a claim to offer every Russian/Armenian track.
