# Vetogram Play — integration plan (2026-10-31)

Status: **code-only feature branch**, no deployment, no database migrations, no main-branch merge.

## Verified sources

- Vetogram host: `margaryanlabs/Telegram-story-bot` (vanilla HTML/CSS/JS mini app).
- BLOTENQ? / Armenian Blot: `margaryan-labs/blot-armenian-digital-club` (TanStack Start / React; extensive game engine, bots, rooms and leaderboard code).
- WHO? / Group DNA: `margaryan-labs/group-dna` (social voting / rooms game; independent React app).
- BLOTENQ standalone URL is stated in its README.
- WHO? uses the existing Lovable project preview, not an invented production domain.
- No separate source repository named "Why Not?" or "Plot Tank" was confirmed within the two accessible GitHub accounts. Do not silently treat an unrelated project as one.

## Implemented in this branch

- Native `data-screen="play"` screen in the existing `public/studio.html`.
- Play tab uses the existing navigation controller via `SCREEN_ALIASES` in `public/app.js`.
- Visual styles isolated in `public/vetogram-play.css` with a compact 6-item bottom nav.
- `public/vetogram-play.js`: real offline Reaction and Four Pairs microgames, local personal bests, graceful pause/visibility handling, reduced-motion CSS, no user identity or network calls.
- Catalog features existing BLOTENQ and WHO?, currently with transparent **external** launch links. These are not yet games embedded in the Vetogram origin.
- Tests for routing, static link origin and browser-game behaviors.

## Architectural principles

1. **Protect chats first:** games must not request Telegram chat sessions, Business permissions, contact lists or raw login secrets.
2. **Lazy-load game resources:** host screen loads quickly; separate heavy game engines must load only after user chooses a game.
3. **Preserve repositories:** do not copy thousands of React files into the vanilla messenger. Keep each game as a versioned app package or separate build source.
4. **No fake multiplayer:** a local game is marked local; separate app is marked separate; server-supported matches require a verifiable server.
5. **Host controls navigation:** a game should expose `ready`, `exit`, `shareInvite` and `matchFinished` events through a narrowly scoped adapter. No arbitrary `postMessage('*')`.
6. **No gambling:** Blot rankings are for fair-play games, not bets for redeemable real-world value.

## Next implementation track (NOT yet shipped)

### A. Native embedded game builds

Produce **independent static game bundles** from BLOTENQ and WHO?. A thin adapter in each bundle receives a short-lived, server-issued game identity ticket. The Vetogram host mounts each under /games/<slug>/ after checking bundle loading, navigation return, resource usage and mobile/Fold layouts. If game SSR/API endpoints require a server, retain them separately and proxy only documented, authenticated endpoints. Do not embed untrusted external origins or assume that iframes work.

### B. Shared invite flow

Vetogram message composer may create a *user-reviewed* invitation containing a deep link. The receiver opens `?screen=play&game=blot&invite=<opaque-code>`. User action is required to send; do not read/send chat messages automatically. Game room validation happens server-side; links expire.

### C. Multiplayer and Neon, only when needed

Neon PostgreSQL can persist `play_profiles`, `play_rooms`, `play_members`, `play_matches`, `play_results` and idempotency keys. Use pseudonymous stable IDs and explicit per-game access policy; never store raw Telegram `initData`, OTPs, access tokens or chat contents. Neon is a relational store, not a full realtime game engine; use a room coordinator (WebSocket or controlled polling) with authoritative moves, race prevention, reconnection and anti-cheat testing. **No database has been created, modified, or queried for this branch.**

### D. WHO? moderation

Use report/skip controls for provocative party questions and rate-limit anonymous contributions. Do not reveal individual voter identities in score/result payloads. Validate room-bound access and invite expiration.

## Acceptance gate before future deployment

- Existing `npm run check` and `npm test` pass for the full Vetogram repo.
- Mini-game smoke tests pass on Android Telegram WebView, iOS Telegram WebView and narrow/Fold viewport.
- Standalone source games are verified, permission boundaries reviewed, error/back-navigation behavior tested.
- Nothing is described as native-in-app until an actual bundle has been integrated and verified.
- No production release or deploy until explicit approval.

## Next code-only milestone: expanded curated catalog

- Search/filter UI now covers **six verified entries**: BLOTENQ? and WHO? (external first-party applications), Reaction, Four Pairs, Tic-Tac-Toe vs local minimax bot, and 2048 (all four built-in/offline logic). These are not six embedded multiplayer games.
- New native games live in `public/vetogram-play-arcade.js`, intentionally separate from the existing Play module.
- `public/vetogram-play-registry.js` is an **allowlisted client catalog**, not a remotely downloaded plug-in store. Filter metadata is static until code review.
- `docs/vetogram-play-developers.md`, `examples/vetogram-play-starter/`, `lib/vetogram-play-manifest.js`, `scripts/validate-vetogram-game.mjs` and a draft GitHub issue template establish manual contribution rules. A valid manifest alone **never** installs a game or grants permissions.
- Mini-game scores remain in local storage, not linked to Telegram accounts and not competitive verified achievements.
- Future third-party games must run in an isolated sandbox or approved external origin, with user-approved events and server-side validation. No automatic community game code execution.

**Current release gate is still closed:** only feature branch edits, no production deploy, no Neon database changes and no merge.

## Play Store discovery & creator intake (code-only)

- `public/vetogram-play-store.js`: every approved catalog card receives **Favorites** and **Share** controls. Favorites are stored only in this browser's localStorage; if storage is unavailable they work for the current page only. No Telegram account linking.
- Catalog sharing happens **only after a click**. `https://<Vetogram host>/?screen=play&game=<approved-id>` is generated from a fixed allowlist. Existing URL query parameters, including credentials, are **never copied** into share links. Native share is attempted when supported, otherwise clipboard/manual copy; no messages are sent automatically.
- These are **game-discovery links**, not real multiplayer room invitation tokens. An invited person must still explicitly choose to open a game.
- The creator draft form in `public/vetogram-play-developer.js` validates input and prepares a GitHub issue URL; it **does not submit**, save, or upload the game. The developer must click the link and complete submission on GitHub. Public HTTPS source URLs with query strings, fragments or user credentials are refused to reduce inadvertent secret disclosure.
- `public/vetogram-play-runner.js`: users launch any of the four local games in a **focused native dialog**, which mounts the existing live DOM node, keeps its handlers/state, and restores the card to its original location after Close/Escape/navigation. External games are **not** embedded by this mechanism.
- All additional game scripts and tests are part of the branch; full Node test suite and Telegram device QA are still required before merging or publishing.
- No Neon connection or production schema modification, GitHub main merge, deployment, or real public creator marketplace has occurred.
