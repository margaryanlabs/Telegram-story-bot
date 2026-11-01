# VETOGRAM PLAY — Verified profiles and community leaderboard

**Development branch only.** No Neon database or production application has been changed. This module is not live without migrations 001 and 002.

## Server-authoritative recording

The server accepts only moves from authenticated participants, checks the correct X/O turn, validates the resulting board and updates a room using `version` compare-and-swap. A finished move is recorded **in the same PostgreSQL statement** using a data-modifying CTE (`advanced` + `recorded`). If the result insert fails, the room move is rolled back. The unique primary key `(room_code,round)` prevents duplicate result rows for one round.

Attribution to players uses the **server-owned room's** `owner_id`, `guest_id` and `round` parity. The client cannot post wins, score or a fake winner. Every legal rematch switches seats; the ledger preserves each round separately. Unfinished or disconnected games do not affect the ranking. Terminal rounds recorded before the migration is installed are **not backfilled or counted** automatically.

## Database changes (manual only)

Use a newly isolated Neon development database and review/apply both migrations in order:

1. `migrations/vetogram-play/001_ttt_rooms.sql` — authenticated room and versioned moves.
2. `migrations/vetogram-play/002_profiles_verified_results.sql` — player profiles with opt-in visibility, immutable completed-round ledger and indexes.

If migration 001 was applied previously, do **not** assume `CREATE TABLE IF NOT EXISTS` upgrades it. Introduce an audited `ALTER TABLE` migration separately. Rooms referenced by results **must not be deleted** via the old room cleanup suggestion because the result table references the room; use a retention/archive plan that preserves the ledger or explicitly review deletion policies.

`VETOGRAM_PLAY_DATABASE_URL` is **server-only**. No database credentials, Telegram session data, OTP or chat histories should be stored in Play client files.

## Privacy

The profile stores only the signed Telegram user ID privately on the server plus an independently random `VP-XXXXXXXXXX` pseudonym. The user receives that alias, their personal totals and up to 20 latest verified rounds. Their identity, opponent's ID and private room codes are omitted from history responses.

**Leaderboard visibility is false by default.** The user must explicitly turn it on to appear among public aliases. It can be turned off any time; public queries filter out hidden profiles. An alias needs at least three completed rounds to qualify. Do not suggest that this provides complete anonymity (players can share their own aliases or infer identities outside the product).

Ranking points: **win = 3, draw = 1, loss = 0**. Stats are computed server-side from the immutable ledger, not local browser achievements. Ranked players are sorted by total points, wins, then pseudonym; maximum 20.

## HTTP API

All endpoints require validated recent Telegram Mini App `initData` in `x-telegram-init-data`. No anonymous user search is supported.

- `GET /api/play-stats?view=mine` — signed user's `{profile:{alias,leaderboardVisible},stats:{games,wins,draws,losses,points},history:[]}`.
- `GET /api/play-stats?view=leaders` — list of public aliases with qualified verified stats only; never raw player IDs.
- `POST /api/play-stats` with `{action:"leaderboard_visibility",visible:true|false}` — explicit signed visibility choice.
- Until the database is configured: return `503 not_configured` and display the unavailable state, **not** a fictional profile or leaderboard.

The frontend has a fresh-results action, a visibility checkbox and a manually refreshed leaderboard. This only tracks online two-person Tic-Tac-Toe, not BLOTENQ, WHO? or local arcade records.

## Release checks still required

Run `npm run check && npm test`, integration tests against actual isolated Neon schema, race tests across concurrent finish requests, privacy review, review of `vercel.json` routing, and tests on Telegram Android/iOS. The unit tests in this branch simulate database responses but **do not prove** a live Neon migration or a deployed endpoint.

**No deployment, no merge to main, no DB mutations were performed in this task.**
