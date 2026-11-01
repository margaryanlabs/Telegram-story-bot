# VETOGRAM 7.3 — Media & Play Review Notes

**Scope:** review-only branch `feat/vetogram-black-universe-preview-api-20261101`, not main or production. No changes to Telegram session, Business permissions, database, payments or server-side message processing.

## Delivered in this iteration

- V7.2 media editorial hero, 2×2 discovery cards, in-shell navigation, 2026 dark-neutral visual language.
- Same design stylesheet loaded last in the existing Music, Cinema and Books entrypoints; actual module files, players and reader remain in place.
- Play hero, six illustrated and playable game cards, native dialog launch, favorites, shareable game links and 6 offline game entries (Reaction, Memory, Tic-Tac-Toe, 2048, Mines and Snake).
- **Mines:** 6×6, 6 mines, safe first opening including adjacent cells, zero flood reveal, flag mode (also right-click on desktop), victory/loss detection, device-local wins.
- **Snake:** 12×12, direction controls, touch swipes, keyboard arrows, game-over detection, score/best, pause/resume, pause when app hides or the game modal closes.
- Unavailable BLOTENQ? and WHO? remain explicitly labeled as **in development**. Online rooms remain server-dependent and are never passed off as playable offline.
- Direct `?screen=play&game=snake` links can focus the selected card even if route selection occurred before deferred Play Store init. They do **not** automatically start a game.

## Verification

Run independently:

```sh
node --test tests/vetogram-play*.test.js tests/vetogram-showcase-v72.test.js
npm run qa:surface:offline
npm run qa:preview:offline
```

The Vercel preview build runs the offline static/release and preview gates. A READY deployment is evidence of the build gates, **not** of a full Android WebView acceptance pass.

### Manual mobile acceptance cases still required

1. Open `/studio.html?screen=media` in Android Chrome and Telegram WebView. Verify cards, no overflow, bottom nav and music/cinema/books switches.
2. Open `?screen=play`, launch each of six offline games and close with the native button or Android Back. Verify focus return and no background Snake interval.
3. Mines: safe first click, flag, restart, loss and victory. Snake: arrows, swipes, collision, pause, background and high score.
4. Verify catalog favorites and safe share links without session parameters or chat contents.
5. Confirm live Media streaming with actual permitted providers, playback restrictions and user-owned content. Offline static tests **do not** establish content licensing, catalog completeness or stream availability.
6. Test responsive 360px/390px/600px and phone keyboard/touch targets in light/dark preferences.

## Known limitations

- No proven real third-party audio/video playback on all devices or geographies; provider/rights restrictions may apply.
- Only the existing licensed/open/owned media sources are intended for playback. Catalog-only titles must not imply full access.
- Telegram OTP/chat reliability and Supabase/Railway/Neon integrations have not been modified or validated by this UI-focused branch.
- Real browser-based visual QA needs a working browser environment and device checks. Do not merge the draft PR solely because preview returned READY.

## V7.4 device-local records and Android WebView safety

- The original game preview CSS accidentally hid every `.vp-game-art` in the gallery. The whitelist now explicitly preserves art while keeping game controls out of inactive cards.
- Native `<dialog>` close events may arrive after a following tap on Android. `vetogram-play-runner.js` restores the game card synchronously with idempotent native close handling; the fast-switch regression is in `tests/vetogram-play-runner.test.js`.
- Six real records appear in the Play hub with direct launch controls. Existing storage keys are read-only for the dashboard; game engines remain the sole writers. The panel is labelled **only on this device**, not a synced account or server leaderboard.
- The panel re-reads records on game close, app focus, screen navigation back to Play, or a cross-tab storage change. Catalog search and filters are reset through the existing filter handler before opening a selected game.
- Tests are in `tests/vetogram-play-records.test.js`. Check narrow 320px/360px/390px WebViews for horizontally scrollable score cards and focus indicators.

### Honest build status
Preview Vercel `READY` at `02e5744a` proves the earlier six-game build. Subsequent V7.4 commits need a new build and mobile visual pass. New preview creation may be blocked by Vercel `api-deployments-free-per-day` 402, which is not a code or CI success/failure result.
