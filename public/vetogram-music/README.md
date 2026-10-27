# Vetogram Music — independent music product (beta, 2026-10-27)

This branch introduces a completely separate **music-only** experience at `public/vetogram-music/`. It does not delete or redeploy the Vetogram messenger, StoryLab, existing VETO MEDIA or its media PR. Production URL: https://vetogram-music.vercel.app/ .

## Features actually implemented

- Russian-first mobile and desktop music UX: home, live Audius trending/new releases, search, favorites, local library, playlist metadata import.
- One HTMLAudioElement for all supported recordings, player dock and full-screen reactive-to-play-state vinyl studio with Ember/Aurora/Noir themes, seeking, queue next/previous, shuffle, repeat, volume, playback speed, sleep timer, Media Session controls (where available).
- User-supplied audio files via native file picker. Personal audio blobs stored on-device in IndexedDB, with per-file and total limits, restore after reload and delete. If storage quota fails, the UI warns the user; no server-side file upload.
- Explicit plain-text import of **artist — title** metadata from VK/Yandex/etc. It does NOT import MP3s, log into those services, scrape protected APIs or automatically substitute an Audius cover for the original song. The user can individually search Audius for possible matches.
- Telegram WebApp official SDK integration (only when initData is present) for ready(), expand(), BackButton and safe areas. It does not authenticate the user to a backend, read chats, MTProto sessions or BotFather settings.
- Standalone installable PWA manifest, vector icon and app-shell-only service worker (no third-party track stream cache, no user file cache).

## Not supported or claimed

- **All of VK/Yandex/Spotify catalogue**, DRM-protected music or commercial chart playback without licensing. Audius's official read/stream API provides independent recordings where stream access is offered; per-track rights must be respected. API: https://docs.audius.co/api/
- Automatic read of a Telegram user's Saved Messages, private channels, audio library or private messages. The standard Telegram Bot API sees content sent to the bot (subject to permissions), not the user's full account. A consent-based bot handoff and streaming backend would be a separate reviewed integration. Bot getFile normally supports downloads to 20MB on cloud Bot API; local Bot API server has different limits. Docs: https://core.telegram.org/bots/api
- Guaranteed background playback while the Telegram in-app browser is minimized or the iPhone is locked. Media Session is used; host WebView can suspend audio regardless. Device acceptance tests are needed; Android installable PWA/native companion can be considered to improve reliability. Docs: https://core.telegram.org/bots/webapps
- Paid access or music subscriptions: beta is free, no billing or credentials. Premium pricing cannot confer rights to copyrighted recordings.

## Test plan

1. On both Android Telegram and iOS Telegram, launch through a **real BotFather-configured Mini App URL** with valid initData and verify play/pause, screen lock, mini-app minimize/restore, seek, 20+ minutes of background audio, USB/Bluetooth media controls, audio focus, notification.
2. Test external Audius streaming availability across countries and recordings, stream error states, device codecs, CORS, SDK, data limits.
3. Test local MP3, M4A, OGG, WAV files, quota limits and persistence after reload on Chrome Android / iOS Safari / Telegram WebView; check private files never leave browser.
4. Validate playlists; ensure imported metadata does not pretend to be a license or an available MP3.
5. Verify responsive visual UI 390, 768, 1440 widths, keyboard focus, safe areas and reduced motion.
6. Add authenticated Telegram bot forwarding service only after separately consenting users and server-side signed WebApp initData validation; never expose bot token in the browser.

The published URL is a functional *public browser beta*, not a confirmed Telegram Mini App connected in BotFather. Production Vetogram unchanged.
