# VETOGRAM 6.1 — Media Home & VETO VAULT implementation

Date: 28 October 2026. Feature branch / Draft PR #210, not a production release.

## Scope
- Existing studio.html remains the only app entry. No new website, new backend, credentials, cloud service or media server.
- Replaced three oversized Media Home cards with compact Canvas Noir header, personal search, continue shelf, three responsive media destinations and VETO VAULT panel.
- VETO VAULT aggregates locally stored Book bookmarks/progress, Music likes and Cinema favorites/history/progress from the existing Cinema controller. Only metadata; no message/chat/file/audio bytes or Telegram auth parameters copied.
- Search is scoped to actual personal/local index; not a fake cross-provider global catalog. Separate quick links open the individual Music, Cinema and Books search interfaces.
- HTTPS-only personal link saving and removal. Intentional tap opens external links via the Telegram WebApp API when present. Per-account localStorage, no cloud sync claim.
- Original child controllers and one audio element remain authoritative. VETO PLAYER is a full-screen overlay for existing audio controls (play/pause, next, previous, seek), not an additional player.
- Cross-module activity uses origin and exact source window validation, then bounded metadata. Cinema entries with inaccessible source IDs are not invented.
- All unavailable music/film sources remain clearly unsupported; this update does not grant content rights.

## Verification
- V8 syntax parsing on affected JavaScript sources passed.
- Targeted personal-index, search, HTTPS, account-isolation and shell navigation simulations passed. See current-turn audit.
- Added tests/vetogram-universe-61.test.js and tests/vetogram-universe-61-shell.test.js for the normal Node test runner.
- NOT yet run for the V6.1 head: complete npm run vercel-build and regression suite, actual browser visual checks, real Android/iPhone/Fold Telegram WebView, live auth/send/Stories/media provider validation.
- Vercel preview previously rejected with HTTP 402 api-deployments-free-per-day limit; no new READY preview URL claimed.
- Personal Telegram bot music upload still requires the persistent private Node directory documented for V6, which this interface does not provision.

## Release gate
Keep Draft PR #210 unmerged and existing V5 production unchanged until fresh complete build, real Telegram E2E, media source and device rendering QA pass.

## Saved-item resume follow-up
- Saved Books and Music cards pass their actual scoped item ID into the existing reader or Music controller; metadata-only music opens Search and missing local audio is refused.
- The iframe bridge checks both parent origin and exact source window. Missing saved items now return an explicit failure banner, not a silently broken tap.
- Vault counts only saved materials, and account switching resets its expanded state.
- New permanent regression test file: `tests/vetogram-universe-61-deeplink.test.js`, including the saved-item failure case.
- Full Node suite still needs a source checkout/CI runner. This environment has no network access to clone GitHub and Vercel preview is blocked by free quota.
