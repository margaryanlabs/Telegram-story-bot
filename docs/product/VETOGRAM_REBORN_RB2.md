# VETOGRAM REBORN — RB2 Core Experience

**Date:** 2026-11-05  
**Source branch:** feature/vetogram-reborn-rb1-foundation-20261105  
**Review PR:** #235 (Draft against the published Vetogram 8.5 preview branch)  
**Release status:** SOURCE REVIEW — not production, not yet browser-verified.

## Product experience objective

Show users **their Telegram first**, explain consent and the actual connection state, and keep secondary utilities available without allowing them to overwhelm the primary workflow.

The user journey is:

1. See a recognizable, lightweight Telegram workspace.
2. Open existing Chats or explicitly choose to connect a session.
3. Understand three independent readiness statuses (Telegram, optional Anti-Delete, Stories).
4. Reach Stories, Media or Protection in one bottom-tab action.
5. Access advanced tools, recent screens and activity only on demand.

**Do not imply** that already deleted messages can be recovered; Anti-Delete availability and completeness depend on permitted events and the actual Telegram Business setup.

## Changes committed

| File | Purpose |
|---|---|
| \`public/studio.html\` | Direct task-oriented hero with honest consent, clear statuses and fewer competing promises |
| \`public/vetogram-reborn-foundation.css\` | Append RB2 rules **inside the existing RB1 stylesheet**, rather than creating yet another CSS link; responsive four-track nav, readable primary CTA, calm hero/status card, secondary disclosure styling |
| \`public/vetogram-experience-v4.js\` | Reuse existing \`progressive()\` DOM move to put recent tools and actual activity behind native \`details\`, preserving mounted nodes and event handlers |
| \`public/app.js\` | Restore a direct \`open-profile\` route from the account status sheet since Profile was removed from the bottom bar |
| \`tests/vetogram-reborn-rb2-home.test.js\` | Contracts for navigation, truthful copy, persistent IDs and explicit profile access |

## What is still not solved

- The source is currently using **31 CSS links** (30 inherited plus the RB1/RB2 foundation). The last style sheet is still a transitional override, not the final consolidated design system. Auditing the cascade and retiring superseded declarations remains necessary.
- No authenticated Render backend is available on the public **8.5 visual-review** service. A successful preview cannot prove Telegram sign-in, message delivery or Anti-Delete.
- The media catalog needs a rights/reliability audit, title consistency, working source verification and mobile-player review.
- Actual Android/Telegram WebView dimensions, keyboard resizing, system bars, safe-area behavior and screen readers remain unverified.
- The new build is **not published**: Render Hobby reported a 25-service limit and Vercel reported the 100 API deployments/day limit. No existing production or review service was repurposed.
- GitHub source reads verify wiring only; passing Node, integration, browser or screenshot tests **has not been established**.

## Acceptance checklist (physical devices / real account)

- [ ] Guest sees a truthful connection prompt; no UI claims account is linked before auth.
- [ ] Connected user opens a real chat and sends/receives a message without losing draft or focus.
- [ ] Cancelling Telegram login returns safely to the previous screen.
- [ ] Anti-Delete description does not imply historical recovery; consent remains separate.
- [ ] Games can still be opened through Media, and Profile opens from the header account sheet.
- [ ] Mobile nav shows exactly four equal hit targets at 320, 360, 390 and 430px; no clipped text.
- [ ] Browser and Telegram WebView Back transitions preserve media playback/reader state appropriately.
- [ ] Pearl, Linen, Slate and Graphite themes retain adequate contrast and chosen chat wallpapers.
- [ ] Reduced-motion disables nonessential transitions, accessible focus remains visible.
- [ ] Search, Stories, Music, Cinema and Books remain mounted behind real routes and do not promise unsupported playback.

## Next implementation slice (RB3)

Treat Chat authorization and messenger as **P0**. Run actual end-to-end scenarios for new login, QR recovery, 2FA, repeated session use, wrong-owner access, offline polling, chat composer and media attachments. Fix functional failures before expanding catalog visuals. Consolidate CSS by extracting **stable tokens and removing tested superseded declarations**, not by adding more global overrides.

No destructive changes, merges or production deployments are authorized by this slice.
