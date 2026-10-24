# VETOGRAM 3.5 — flagship conversation polish
25 October 2026 · existing Mini App · Draft PR #181

## Scope and intent
Messenger-first finish for actual signed Telegram conversation surfaces, not a mock. No production deployment, Vercel operation, Neon mutation, new paid service, AI activation or Telegram send performed.

## Changes to `public/vetogram-finish-2026.css`
- Genuine conversation header on phones <=660px wraps long titles and the native-link, AI Reply, Second Brain, search and refresh actions into a separate visible row. Phone-specific controls have at least 44px click targets. No controls are hidden or dropped.
- Bubble typography improved (14px desktop, 13.5px phones), compact spacing, consistent incoming/outgoing geometry, sender/footer readability and preserved archive/deleted state.
- Actual media controls, reply preview, selected attachment and recorded voice preview are polished. Animation only starts when real DOM panels are unhidden, with a reduced-motion fallback. Media actions maintain focus outlines and >=44px targets.
- For phones <=410px, the three attachment tools and text+mic+send composer have separate rows. This avoids a squeezed text field on 320px devices while preserving every action.
- Keyboard-open resizing uses the existing `veto-device-polish.js` visualViewport calculation and `veto-keyboard-open` class. In signed active threads, the app and message pane may shrink below legacy 540px minimum without losing the composer behind the software keyboard.
- `veto-mirror-send-pending` is explicitly styled separately from `veto-mirror-send-accepted`. Server acceptance must not imply read receipt. Disabled actions remain disabled.

## Verification
- New `tests/vetogram-flagship-conversations-35.test.js`, registered in both free offline test suites and the JavaScript syntax check: 7/7 isolated V8 test callbacks passed against current source retrieved from GitHub.
- Verified static contracts: actual 12 conversation IDs, all header destinations, keyboard visualViewport guard, no fake send states, mobile 44px selectors, balanced CSS and reduced-motion handling.
- **Not yet verified:** real Telegram auth, Android/iPhone/Fold rendering, screenshot comparison, touch hit testing, message delivery, voice playback/record permissions, Story publishing, animated FPS, keyboard behavior inside native Telegram WebView. These remain real-device integration gates.

## Physical acceptance matrix after another chat restores Vercel Preview
1. Android narrow 320px/360px/393px + Fold folded/unfolded; iPhone Safari/Telegram WebView with keyboard open, large font and rotation.
2. Header with up to six actions must display all taps without overlapping title or keyboard.
3. Composer must remain visible while typing, paste, add photo, open sticker drawer, record, preview, cancel/re-record voice and reply to a message. None send automatically.
4. Message status must distinguish queued/pending, accepted, uncertain and archived content. Offline/permission error must be visible.
5. Graphite/Pearl/Slate/Linen bubble/readability, disabled state contrast, reduced motion, and large media.
6. Real two-account owner isolation, connection scope, Anti-Delete and live Story publish tested separately before production merge.

Do not merge or describe this change as visually verified in production before Preview acceptance.
