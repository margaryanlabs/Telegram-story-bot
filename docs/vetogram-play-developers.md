# Vetogram Play — developer program (draft, not launched)

The Vetogram Play catalog will eventually accept games made by independent developers. This is an **offline code draft** on a feature branch. **No public game uploads, automatic installation, or automatic publishing are enabled.**

## Recommended development structure

- Small self-contained games (Reaction, Memory, Tic-Tac-Toe, 2048) can be maintained inside the Vetogram web shell with strict DOM, state and CSS isolation.
- Full games like [BLOTENQ?](https://github.com/margaryan-labs/blot-armenian-digital-club) and [WHO?](https://github.com/margaryan-labs/group-dna) **keep their own source repositories**, release cycles and game engines. After a separately tested integration adapter, the shell may offer a curated in-app launch.
- Community games should also have **independent source/build packages**. We review and pin a specific build. There must never be an arbitrary user-submitted script injected into the main messenger origin.

## Submission package (proposed v1)

Create a repository containing:

```
my-game/
  game.json
  index.html
  game.js
  assets/...
  README.md
  LICENSE
```

Provide a `game.json` manifest matching [the example](../examples/vetogram-play-starter/game.json). Minimum fields:

- `schema`: `vetogram.play/v1`
- `id`: lowercase `[a-z0-9-]` slug (3–40 chars, starting with a letter)
- `name`, `description`, `version`, `author`, `license`, `category`
- `entry`: **relative** entry file such as `index.html`, no absolute URL or `..`
- `languages`: nonempty subset of `ru`, `hy`, `en`
- `mode`: `solo`, `local-multiplayer`, `remote-multiplayer`
- `capabilities`: requested optional host capabilities (currently only descriptive; no grants exist)

Run `node scripts/validate-vetogram-game.mjs ./examples/vetogram-play-starter/game.json` when the checker is available. A passing manifest validation is **not** a security audit.

## Security and privacy contract

1. **Default deny.** No access to Vetogram messenger DOM, messages, Telegram sessions, bot tokens, initData, credentials, clipboard, contacts or Business permissions.
2. No execution of community game code on Vetogram's privileged origin without a sandbox design and complete review. A vetted, separately hosted game can be opened in an external browser as an interim state, labeled honestly.
3. Future embedded games require origin-pinned messages, nonce/handshake validation, versioning, strict allowed events, size limits, timeouts, explicit user approval and browser/WebView checks. **This handshake is not implemented yet.**
4. Scores, invites, profile linking and payments must be routed through a server with per-game identity, authorization and anti-cheat. Never trust a client-supplied match result for competitive rewards.
5. No gambling or redeemable wagers, phishing, deceptive tracking, third-party ad injections or unlicensed copyrighted game assets.
6. Community multiplayer must implement room authorization, safe moderation/reporting, rate limits, connection recovery, and consent before sharing an invite.

## Developer review (planned)

1. Developer publishes a repository and screenshots/demo.
2. Developer submits a proposal via GitHub Issues, describing gameplay, rights to code/assets, age rating, monetization, requested permissions and backend usage.
3. Vetogram maintainers review the source, dependencies, license, performance on Telegram Android/iOS and data flows.
4. Approved game receives a curator-owned catalog entry with a version and permitted launch origin. Rejected/unreviewed submissions stay **out** of the playable catalog.
5. Updates require new review. Ability to disable/delist and report games must be built before opening the marketplace.

**Current implementation:** there is an issue proposal link in Play Hub, two standalone first-party project entries, and four offline built-in games. There is no automatic third-party submission service or database-backed approval queue.

## Roadmap

- v1: curated catalog, search/category filters, original offline games, developer starter and a manual proposal route.
- v2: test a narrow adapter for existing first-party games with proper isolation and navigation.
- v3: secured game identity, invitations, matchmaking and Neon-backed metadata under server-side permission checks.
- v4: moderation dashboard, developer approvals, version signing/rollback, curated external games.

No deploy, merge to main, or Neon migrations without the owner's later instruction.
