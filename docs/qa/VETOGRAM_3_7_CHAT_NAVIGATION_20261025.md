# VETOGRAM 3.7 — owner-scoped chat navigation and photo motion
25 October 2026 · Draft PR #181 · real Telegram Mini App

## Why
The messenger returned to the beginning of the list after pressing Back. With many dialogs, this forced users to relocate their contact. Separate previous visual CSS lacked an explicit visual transition contract for the same real list/thread elements.

## Delivered
1. `public/telegram-chats.js`: before switching into a real thread, capture **only this owner's in-memory** window scroll offset, any inbox/list scroll offsets, and the selected existing chat ID. The canonical owner switching path now resets `inboxReturn` to `null`.
2. Back restores the cached conversation list **immediately** without a network wait, then returns scroll offsets and keyboard focus to the matching real chat after the next animation frame. The frame checks the current signed owner, current thread and visibility before changing UI. No cross-owner positions, hidden stale threads or persistent storage.
3. Existing current chat messages and hot-thread snapshots remain untouched; the new navigation code has no server call, history read or read receipt.
4. `public/vetogram-finish-2026.css`: restrained one-shot thread entrance, inbox return and native `<dialog>` photo opening animations. These run on real element visibility/class changes **not** on each sync/poll/message rebuild. Existing message bubbles explicitly stay non-animated, protecting long-list performance and scroll anchoring.
5. On phones <=520px animations shorten further. `prefers-reduced-motion: reduce` removes transitions entirely. Focus outlines remain visible; no fabricated chat or photo.

## Verification performed
- `tests/vetogram-chat-navigation-37.test.js` registered in `ci:offline`, `qa:core:offline` and syntax check.
- **6 of 6** isolated JavaScript test callbacks passed against the real current repo sources: exact scroll restoration, focus without scrolling, owner reset, queued stale navigation guard, absent saved position and animation frame fallback, real DOM/CSS contract and reduced-motion.
- Parsed the full current `public/telegram-chats.js` JavaScript source with the V8 compiler after the changes.
- Source CSS braces balanced before and after the added styles.

## Remaining physical acceptance
- Test actual Telegram Android and iPhone WebView, Android Fold folded/unfolded, 320/360/393px widths and iOS software keyboard. The list should not jump after Back, including after filter and search.
- Verify no accidental focus scrolling on physical touch and screen readers; no focus theft when tapping to open a second chat immediately after Back.
- Verify photo dialog open/close/Escape behaves natively without frame jitter, readable on light/dark themes, respects home indicator safe-area.
- Test long chat histories with ongoing Telegram sync, rapid open/Back/reopen, pending media/voice playback, owner-switch while image load is in flight.
- A real pixel-perfect screenshot/FPS and network-backed Telegram QA **was not possible in this pass**. Other chat owns Vercel and Neon deployment/infrastructure; no deploy or backend changes are part of 3.7.

## Release boundary
No commit merged into main, no production URL touched, no paid resources, no Neon migration and no Telegram account mutation. Source improvements live in the shared draft PR only.
