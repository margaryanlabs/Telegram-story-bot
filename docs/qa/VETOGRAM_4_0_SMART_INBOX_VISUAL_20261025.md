# VETOGRAM 4.0 — Smart Inbox / message states / route audit
25 October 2026 · existing Mini App · Draft PR #181 · source-only; no deploy

## Actual source changes
- Reframed the three **real** Inbox Pulse tiles around their real filtered destinations. “Непрочитанные чаты” counts chats with server-provided unreadCount > 0, not unread messages. “Внимание” counts chats with an explainable inbox attention signal, not inferred legal or financial obligations. “Сохранённые” now counts **savedChats**, rather than displaying deleted-message totals that did not match its linked `copies` filter.
- Refined Russian captions in the archived Smart Inbox overview, retaining the original actual `data-smart-filter` routes and account-specific data.
- Replaced contradictory “LIVE · По запросу” text with “Обновление по запросу” and “N чатов загружено · по запросу”; neither local cache nor polling is passed off as an always-live cloud feed.
- Chat rows now have truthful source-backed styles `has-attention` and `has-copy`, cautious labels (“Возможное действие” / “Может требовать ответа”), plus readable unread counter and accessible chat name/summary. Owner/Telegram authorization logic stays intact.
- Synchronize each filter control’s `aria-pressed` with the *actual* current `state.filter` after a fresh render, including Pulse shortcuts and account reset. Existing user-click behavior stays the same.
- New premium visual treatment for the genuine loaded-chat Pulse, small-row attention and saved copy indicators, and delivery status borders for `sending`, `accepted`, `uncertain`, `failed`. On <=420px phones, three tiles become a horizontal rail instead of squeezed columns; focus outlines, active state and reduced motion are explicit.
- **No fabricated chat, fake online status, read receipt, AI priority score, storage claim, network request or additional personal data collection** is introduced.

## Compatibility and source checks
- Updated pre-existing `tests/vetogram-inbox-pulse.test.js` to assert new truthful `savedChats` counter and localized scope copy; all **5/5** isolated callbacks passed.
- Added `tests/vetogram-smart-inbox-40.test.js` with six source-and-behavior tests (Pulse consistency, selected filters, cautious attention labels, actual owner-scoped send statuses, responsive UI, localized Smart Inbox). All **6/6** isolated callbacks passed against current GitHub sources; total **11/11** in these suites.
- Both offline suites (`ci:offline`, `qa:core:offline`) and source `check` register the new suite.
- Static full-source audit verified 13 screens, five primary navigation destinations, ten `data-open-screen` values all resolved to real screens either directly or by real `SCREEN_ALIASES` (including `creator -> studio`), and 578 unique DOM IDs with **zero duplicates** in the currently fetched `public/studio.html`.
- Actual `public/telegram-chats.js` parsed in V8, and finish CSS braces balanced.
- **These are source and isolated checks, not complete Node/npm CI, live Telegram traffic, browser screenshots or real WebView/Fold accessibility sign-off.**

## Before shipping
1. Restore a stable Preview in the Vercel workstream and run the real repository Node CI including lockfile/build.
2. Compare Android/iPhone/Fold folded and unfolded at 320/360/393/768px; dark/light themes and longer chat titles at large text sizes.
3. Real owner login and filtering: verify count differences among unread chats, saved chats and deleted messages; verify “Внимание” does not imply confirmed facts beyond the signal.
4. Confirm cached list update does not imply live streaming; verify actual Telegram send `sending`/accepted/uncertain/failed paths, and an archive-only read-only conversation.
5. Verify focus states, tab order, keyboard opening/closing, swipe rail and no message list scroll jumps.
6. Separate release gates: anti-delete evidence, MTProto account/code delivery, Story publishing, AI consent/provider keys, Neon migrations and payment flows. Visual polish does not certify these functions.

## Operating boundary
All edits stay in the same PR branch; this change did not touch Vercel, Neon, main, production deploy, AI keys, Telegram auth/session secrets or user funds.
