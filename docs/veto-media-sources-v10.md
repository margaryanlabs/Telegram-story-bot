# VETO MEDIA V10 — Sources, rights and importer design

Date: 2026-10-27. Independent Mini App, Draft PR #191; no production deploy.

## Four different things must stay separate

1. Work metadata: artist, title, artist IDs, author, movie/series metadata.
2. User-owned playlist metadata: names and titles, without audio files.
3. Provider availability: whether this particular recording can be streamed for this user.
4. Media bytes and rights: playable streams require explicit authorization and territory review.

Importing a VK playlist is importing *metadata*, not downloading/relaying VK audio.

## Sources

- Audius: https://docs.audius.co/api/ — current public search and streaming candidate. Read endpoints often work without credentials. Per-track streamability and rights are separate and must be tested.
- VK Music Bot API: https://github.com/TraftG/vk-music-bot-api — unofficial project; README proposes VK Admin Token and MP3 downloads. Not integrated because a repository's MIT license does not license musical recordings or privileged tokens.
- MusicBrainz: https://musicbrainz.org/doc/MusicBrainz_API — global artist and recording identity only, not audio. About 1 request/second average/IP, contact MusicBrainz for commercial plan and meaningful User-Agent. Server adapter later, not called by V10.
- TMDB: https://www.themoviedb.org/documentation/api — films/series metadata/posters, not video playback. Commercial license is a separate agreement; not called in V10.
- Internet Archive: https://archive.org/developers/ — existing archived films with source links; metadata claims of public domain are clues, not proof of rights for every territory.
- Gutenberg/Gutendex — existing classic book metadata and text; translation copyright needs market-specific review.
- Open Library: https://openlibrary.org/developers/api — intended for human-centered lookups, not bulk commercial traffic/backend; no mass scraping.
- LibriVox: https://librivox.org/api/info — existing public-domain audio catalog with source links; playback compatibility must be tested.
- Jamendo: https://developer.jamendo.com/v3.0 — potential indie catalog, commercial music permissions must be arranged.
- Apple MusicKit: https://developer.apple.com/musickit/ — optional authenticated playback tied to user subscription and compatible WebView; not enabled.
- YouTube embedded player — future official trailers where embedding is permitted; never scrape/rip films.

## Working V10 playlist import

Users explicitly paste lines in Artist — Title form or upload TXT/CSV/JSON metadata. CSV handles quoted values and headers; JSON accepts arrays, tracks, items, playlists and common artist/title fields. Browser-local list, deduplication by normalized artist/title, 300-entry limit and 512 KiB input limit. All media files remain outside the importer; user can export plain JSON.

User can click Find in Audius on one track; candidates are ranked by artist/title similarity and require the user to choose a version manually. Matching a cover/remix is never presented as the original recording. The chosen Audius candidate uses an existing VETO player bridge, never a VK stream. The URL to the original Audius item remains visible.

Files: public/media-import.js, public/media-import.css, public/media.js bridge and public/media.html. No server, VK password, token, unauthorized stream or paid API key required for importer.

## Test/launch gates

- Headless Chromium browser checks of standalone V10 preview, 390px and 1440px, with mocked Audius replies: parsing TXT/CSV/JSON, adding entries, matching UI, handoff to audio element, no JS exceptions or horizontal overflow. Actual Audius network streaming **not** verified; this browser cannot establish Telegram WebView compatibility.
- Import feature parser has dedicated Node tests for formats, deduplication, size and record caps.
- Host stand-alone VETO MEDIA on HTTPS, test live audio and video on Telegram Android and iOS, then verify EPUB security before launch. Do not deploy VETOGRAM production.
- For each provider build explicit adapter facts: catalog ID, source, streaming permission, territorial rights, source attribution, last validation.
- Claim in previous user-shared discussion about VK API restrictions beginning September 2026 was not independently verified and should not be used as a product decision without official documentation.

## V11 — Unified discovery and series catalog (2026-10-27)

- Separate modules public/media-discovery.js and public/media-discovery.css add an explicitly triggered search across Audius music, TVmaze series, Gutendex public-domain books and Internet Archive Prelinger archival film metadata. No unauthorized streaming or unrequested crawling.
- TVmaze's https://www.tvmaze.com/api documents CORS, at least 20 calls per 10 seconds/IP and CC BY-SA data licensing. The UI credits TVmaze and links to the item. This is TV series information, NOT free TV episodes. Poster/image-specific rights need additional review.
- Audius results can be handed to the existing audio player on the user's click. Streams remain subject to territorial rights, browser codecs and provider availability.
- Gutendex books are explicitly filtered to copyright:false. The Gutenberg reader bridge can open such books, but worldwide translation rights remain a separate legal review.
- Cinema search currently returns only public-domain-labelled records from the Prelinger archive, with links to original Internet Archive items. Uploaded license metadata does not prove worldwide rights.
- Mass-market feature films via TMDB are not yet added because the intended commercial service needs a suitable commercial API and poster-content license. Open Library is not used as a high-volume commercial backend.
- User saves up to 100 Discover items locally. This is not an account-level synchronization or subscription. Search runs per user query with abort and timeout, has a five-minute in-memory result cache, and reports provider failures separately.
- Dedicated test file tests/veto-media-discovery.test.js validates source normalization, permission flags and user-facing module wiring.
- Standalone preview veto-media-preview-v11.html tested via Chromium at 390 and 1440 px with mock provider responses. Four synthetic cards rendered; category filters and series detail modal worked, with no JS errors or horizontal overflow. TVmaze 503 was also simulated and the other three results remained. Synthetic screenshots DO NOT prove availability of the pictured films.
- The series detail window participates in Telegram native BackButton flow. Actual Android/iOS Telegram HTTPS/WebView streaming and EPUB safety remain launch blockers. All changes remain in Draft PR #191; no merge or production deploy.
