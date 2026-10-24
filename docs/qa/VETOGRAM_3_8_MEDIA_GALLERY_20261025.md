# VETOGRAM 3.8 — owner-scoped media gallery
25 October 2026 · Draft PR #181 · existing signed Telegram Mini App

## Delivered
- Existing real <dialog> photo viewer gained left/right controls, a readable counter (“2 из 3 загруженных”), keyboard Left/Right support and restrained horizontal swipe. Escape continues to be handled by the native dialog, while short swipes, vertical scrolling and multi-touch gestures do not navigate.
- **Privacy boundary:** gallery enumerates only image blobs already downloaded into the **current signed owner's currently open thread**, in current message order. The code checks the expected account, current thread, blob: URL presence in the bounded `state.mediaUrls` list, and matching `image/*` MIME. It never automatically retrieves other images or stores a gallery/history off device.
- During navigation, the existing photo `img` and explicit local “Сохранить фото” link swap to the selected blob. MIME-aware file extensions from VETOGRAM 3.6 remain accurate; there is no new network path.
- Reopening an already open native modal no longer redundantly invokes `setAttribute('open', '')`; owner checks are explicit in the viewer even before the account-reset layer.
- The new `activePhotoId` is ephemeral. Close, Escape and media-owner/thread cleanup clear it, gallery actions disappear when no adjacent cached photo exists. Permission/attachment/caching limits remain unchanged.
- Gallery controls have accessible names, 44–48px mobile hit targets, focus rings, and `prefers-reduced-motion` support. Real Telegram message bubbles are not animated or replaced.

## Verification performed
- Updated VETOGRAM 3.6 photo MIME/owner regression to execute the new real gallery functions.
- `tests/vetogram-photo-gallery-38.test.js` covers six cases plus real swipe/arrow/click handler simulation: loaded images and counter; both navigation boundaries and download extensions; wrong owner/evicted blob; close/cleanup; actual mobile input events; reduced motion.
- Tests are registered in `ci:offline`, `qa:core:offline` and JS syntax `check`.
- Source-level V8 executions: VETOGRAM 3.8 (7/7), VETOGRAM 3.6 (5/5), VETOGRAM 3.7 chat return (6/6), **18/18 total passing**. Full actual Node/npm CI and physical Telegram device QA have **not** been run in this session.
- Main `public/telegram-chats.js` parsed in V8 without a syntax error; added CSS braces balanced. No Vercel deployment, Neon mutation or production change.

## Physical acceptance once a real preview is available
1. Test iPhone, Android, Fold folded/unfolded and 320/360/393px widths; safe-area, close, download and swipe controls stay visible.
2. Open three owner-loaded Telegram photos and navigate only among these three; retry network-unavailable thumbnails manually. Do not preload the rest of the chat.
3. Test normal finger swipe in both directions, vertical scroll, pinch gesture, keyboard arrow keys, native Escape/Back close and photo saving.
4. Switch Telegram owner, exit thread and evict cached attachments while gallery is open; ensure local blob pointers are revoked, no stale media or state is reused.
5. Verify PNG, JPEG, WebP and GIF downloads and active file name after navigating.
6. Validate real offline, low-memory, reduced motion and reader accessibility. Do not claim release visually certified before these tests.

## Deployment boundary
Work is source-only in the shared draft PR. Vercel, Neon, AI/paid APIs and main/production stay with other release work.
