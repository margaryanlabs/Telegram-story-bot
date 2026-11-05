# VETOGRAM REBORN — RB11 Account Atelier

**Date:** 2026-11-05  
**Source:** `margaryanlabs/Telegram-story-bot`  
**Working branch:** `feature/vetogram-reborn-rb1-foundation-20261105`  
**Draft:** PR #235 against `feat/vetogram-black-universe-preview-api-20261101`.  
**Production:** untouched. No merge.

## Purpose

Bring Profile, account visibility and actual Telegram onboarding/OTP/QR/2FA dialogs into the RB8–RB10 Obsidian Atelier design system, while honoring the critically different sources of access:

1. **Mini App identity** — validated Telegram Mini App `initData` exists. It does not mean the owner has connected their personal MTProto session.
2. **Personal Telegram session** — owner-verified `viewerState.session?.connected`, with identity mismatch and temporary store degradation treated as *not confirmed*. This is the prerequisite for personal Chats.
3. **Telegram Business** — independent permission for Business-bot interaction with selected chats; it cannot be granted by cosmetic UI or inferred from an MTProto login. Even a detected Business link does not prove events are arriving.

The previous Profile view was only a basic five-button list, and account flows had inconsistent visual materials and bright-red call-to-action treatments unrelated to the RB8–RB10 visual system.

## Code actually changed

- **`public/studio.html`**: adds a three-row **source-backed account overview** to the existing Profile, retaining original `v6Account`, `v6Appearance`, AI, Voice and tools buttons. The overview has distinct state nodes for Mini App, Personal and Business, an explanatory note and a single actionable `v11ProfileConnect` button. Loads new RB11 CSS *last*.
- **`public/app.js`**: adds `renderRebornProfileStatus()`, which derives the exact UI states from `tg.initData`, `viewerState.session`, `identityMismatch`, `degraded`, `loginPending` expiry and `state.businessPermissions`. It is invoked by normal connection rendering, successful viewer-sync and when entering Profile. Signed users entering Profile get a fresh existing owner-scoped Viewer Sync read; stale replies are still guarded by the RB6 owner epoch/intent fences. The button reuses **`window.VetoTelegramOpenAccountConnection`**; no new OTP, QR, session or authorization controller was introduced.
- **`public/vetogram-reborn-account.css`**: a dedicated final presentation layer for Profile (graphite-and-mineral-blue header, 3 truthful access proofs, clear account CTA, original feature rows) and the common account modal (account status, login methods, country picker, phone, code, optional 2FA, QR viewer, pending-login resume and error surfaces).
- **`tests/vetogram-reborn-rb11-account.test.js`**: 15 real-source regression cases. The renderer is executed in a VM with mocked DOM for signed-only, personal-connected, Business-only, identity mismatch, degraded storage, pending OTP/2FA, Mini App unavailable and Business consent missing. Additional cases assert existing OTP/QR routes and owner-safe signed checks, original profile handlers, final CSS order, mobile, focus and permanent deletion warning safety.

## UI decisions

- Source-provided statuses only. Ready/green requires an actual corresponding proof. Business-detected is rendered as pending verification of event delivery; settings never imply complete protection without a test.
- Main account CTA displays an appropriate action for unconnected, pending and owner-verified personal sessions but always enters the *same* existing code path.
- Native phone, QR, OTP and 2FA actions remain in the existing delegated `data-sheet-action` handler, including `viewer-start-qr`, `viewer-verify-code`, `viewer-verify-password`, `viewer-resume-login` and email-code fallbacks.
- Full-screen QR is shown on a white readable tile only while `#viewerQrImage` is unhidden. Existing QR token refresh, expiration, abort and owner fences are unchanged.
- Modal styles preserve original `#sheet` focus, Back, safe-area, scroll and overlay mechanisms, and never restyle the dangerous `ghost-danger` control as a friendly primary CTA.
- CSS uses 345/440/760 breakpoints, explicit Pearl/Linen light palettes, 16px form inputs to avoid mobile auto-zoom, `:focus-visible`, reduced motion and forced-color fallback.
- No fake data, no personal identifying info in events, no new API calls except the explicit refresh of an already signed owner when opening Profile.

## Checks that actually ran

- Fetched and re-read actual GitHub source files on the RB11 branch.
- Ran 15/15 RB11 source-bound checks using actual controller functions and mock DOM in an isolated V8 runner.
- Parsed the complete modified `public/app.js` successfully as JavaScript.
- Checked the RB11 stylesheet brace balance and final CSS link.

**Not performed:** full repository Node suite, browser-computed styles, screenshot visual QA, real signed Telegram WebView, actual SMS/OTP/2FA/QR, Android foldable keyboard tests, account disconnect/relink or Telegram Business delivery. None of those are claimed as passing.

## Release gate

- [ ] Run complete Node suite, including RB1–RB11 and older auth/security/privacy/media tests.
- [ ] Open exact PR head on an isolated staging URL, with no production/8.5 preview overwrite.
- [ ] Validate 320/360/390/430/768px and Samsung Fold outer/inner display for connected, disconnected, pending and degraded states.
- [ ] Test phone code, resend protection, 2FA, QR with second device, expired QR, owner mismatch, logout during in-flight refresh.
- [ ] Verify Business consent remains independent of personal MTProto, and no settings are auto-enabled.
- [ ] Confirm modal close & Telegram native Back do not restore focus to a hidden previous screen.
- [ ] Regression-test Pearl/Linen, high contrast, reduced motion, reading order and keyboard focus.
- [ ] Confirm destructive archival purge still requires explicit typed confirmation on a disposable test account.
- [ ] Merge only after real QA; PR remains Draft.

No live credentials, accounts, chat messages, user data or production services were modified.
