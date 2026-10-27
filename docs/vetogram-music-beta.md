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
