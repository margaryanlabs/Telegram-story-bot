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
