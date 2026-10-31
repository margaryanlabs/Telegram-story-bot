# Vetogram Play — private Neon room engine (not deployed)

## Status

Code only on `feat/vetogram-play-hub-20261031`. **No Neon instance was modified, no migration executed, no production release created, no changes to Messenger sessions.**

This is a genuinely server-authoritative **two-player online Tic-Tac-Toe**, not real-time multi-game room infrastructure. Existing BLOTENQ and WHO? continue to be independent apps. The local single-player games do not require the server.

## Files

| Part | Location |
| --- | --- |
| Game rules, signed room codes, expiration, visible owner/guest state | `lib/vetogram-play-room-core.js` |
| Version-checked persistence, create/join/move operations | `lib/vetogram-play-room-store.js` |
| Telegram initData verified HTTP handler | `api/play-room.js` |
| Router mapping | `api/router.js` |
| PostgreSQL schema (manual) | `migrations/vetogram-play/001_ttt_rooms.sql` |
| UI and safe polling | `public/vetogram-play-room.js` |
| UI in existing hub | `public/studio.html` |
| Unit and API tests | `tests/vetogram-play-room-*.test.js` |

## Setting up the **isolated development** database later

1. Provision a *new development branch/database* in Neon; do not connect the current Messenger's active database.
2. Manually review and execute `migrations/vetogram-play/001_ttt_rooms.sql` on a **fresh, empty** development database using a Neon SQL editor or authorized migration tooling. The unapplied migration now includes `round`, `rematch_x`, `rematch_o`. Do not assume it upgrades an existing table: `CREATE TABLE IF NOT EXISTS` will not add these columns. If any previous version has been applied, a separately reviewed `ALTER TABLE` migration is required.
3. Set the server-only environment variable `VETOGRAM_PLAY_DATABASE_URL=postgresql://...` in the development deployment. Do not set it in a client-side `VITE_*` or `NEXT_PUBLIC_*` env. Never commit a live connection URL.
4. Ensure the **existing** `TELEGRAM_BOT_TOKEN` matches the Mini App's bot. Clients use fresh signed Telegram `initData`; no user password, Telegram OTP, or Business permissions are read.
5. Install the dependency `@neondatabase/serverless` from package.json and run `npm run check && npm test`.
6. Test with **two different Telegram accounts**. Create → share link → second account joins → X/O alternate until a win/draw → first player offers a rematch → second player accepts → X/O sides swap. Confirm the game never restarts on only one approval, that stale approvals fail, and that expiration blocks rematches. Also test revoked sessions, manual refresh, Android/iOS Telegram WebViews and low-memory foldable devices.
7. Do **not deploy or merge until explicitly approved**. This document does not request or authorize any infrastructure write.

## API contract

The API route is `/api/play-room` through the existing router. `GET ?health=1` returns `configured` (environment variable presence **only**; not proof that the DB/schema works). Every other action requires signed Telegram `x-telegram-init-data` with a 1-hour maximum auth date.

- `POST {action:'create'}` — creates one expiring room and returns an owner view, subject to a basic limit of five active rooms per owner.
- `POST {action:'join',code:'XXXXXXXX'}` — one guest per room, conflict-safe.
- `GET ?code=XXXXXXXX` — reads the room only as owner or guest, never spectator.
- `POST {action:'move',code,version,cell}` — validates signed player, correct seat, board and expected version, then attempts a conditional SQL update.
- `POST {action:'rematch',code,version}` — accepts an authenticated participant's consent only **after a finished round**. One vote leaves the game finished; two distinct players' votes reset the board, start a new round and rotate X/O seats. Both votes are version-guarded; stale requests fail with conflict.
- Response success: `{ok:true,room:{code,seat,guestJoined,board,turn,status,winner,version,round,rematchRequested,opponentRequested,expiresAt}}`. Responses never include both players' raw Telegram identities.
- Failed actions return `{ok:false,error,message}` with no raw database messages or secrets.

All writes use bound SQL parameters and compare-and-swap `version` to reject conflicting updates. No optimistic score commits are trusted from the browser. The game uses 4-second polling while an unexpired room view is visible (including finished matches awaiting a rematch decision); polling stops when the user leaves or the room expires.

## Limitations requiring hardening before production

- Basic owner room-count check is not a distributed abuse limiter; add an authenticated edge rate limiter and server-side quota before opening to the public.
- A room link conveys only a code, not authorization to view or play as a third account. The second Telegram account must explicitly join.
- There is currently no surrender, spectator mode, tournament leaderboard, account-linked ratings, or matchmaking. Rematches require both players' consent and stay within the original six-hour expiry.
- No confirmation that SQL migration and driver run against a live Neon deployment: all work is offline code and logic checks.
- A detached/expired room is left stored until explicit cleanup (see migration maintenance note).
- For external game publishers, preserve source isolation and manual review; never inject untrusted scripts into Vetogram's messenger origin.

## Why this architecture

- Isolated database prevents shared account/chat storage from being coupled to game state.
- The version field ensures two nearly simultaneous moves cannot both win the same turn.
- No cross-origin iframes or Telegram chat/message APIs are involved in gameplay.
- Standalone big games (BLOTENQ, WHO) may later receive a similar authenticated room adapter while retaining separate repositories.
