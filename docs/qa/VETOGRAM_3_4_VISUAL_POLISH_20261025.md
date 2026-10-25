# VETOGRAM 3.4 — visual uplift without deployment
25 October 2026. Scope: real Mini App source in draft PR #181.

## Changes
- **Messenger-first UX:** condensed phone inbox header on initial render; a visible manual disclosure controls archive/tools without auto-collapse on scroll. Desktop header remains expanded. Telegram safe-area handling and all owner/auth checks remain unchanged.
- **Product shell:** softer depth and clean chrome for existing topbar, brand mark, and bottom nav; focus and tap feedback.
- **Real messages:** sharper search focus, compact rows, selected filters, raised composer, clear active send vs disabled send.
- **One palette:** graphite/navy/silver with controlled coral action accents; no extra online indicators, fake KPIs, countdowns or generated chats.
- **AI:** refined contrast and selection of actual AI mode chips, readable prompt fields and assistant/user bubbles. No AI keys or feature switches activated.
- **Stories:** stage hierarchy, selected template outlines and real primary actions; publishing stays behind existing consent, permission and server confirmation.
- **Localization:** remove remaining English eyebrow text on the primary chats, AI and Story Studio screens without changing accessible account actions.
- **Performance/accessibility:** purely visual CSS, no new libraries, network, permanent motion loops or data collection. Touchscreens do not run desktop hover translations. Reduced motion disables transitions; focus-visible is explicit. CSS does not make disabled send/publish buttons clickable.

## Regression gates
- Existing mobile/desktop header tests updated to verify the new initial responsive state.
- `tests/vetogram-premium-34.test.js` contains four tests (mobile header clicks; desktop behavior; original live controls; disabled and reduced-motion states).
- Test file is included in `ci:offline`, `qa:core:offline` and source check.
- A direct V8 behavior check of `public/vetogram-header.js` against current branch passed both mobile and desktop tap transitions; CSS curly brace count balanced.
- **NOT visually certified:** new Preview is still unavailable in this session, so real pixel comparison, screenshot approvals, smoothness on Fold/iPhone/Android, and live Telegram auth are not yet confirmed. `npm ci`/full Node CI remain gated by the existing lockfile/build environment. Do not merge to main or claim production delivery.

## Visual acceptance on actual Preview
1. Screens 320, 360, 393, 768 and desktop; both orientations on Fold; light and dark theme; no clipped labels or scroll traps.
2. First real chat paint: compact header and visible expand button, full accessibility to tools/archives; no fake success indicators.
3. Conversation: keyboard open, composer active/disabled, send confirmation and scroll retention, privacy mode and avatar/name contrast.
4. AI eight mode chips and Story ten templates: keyboard navigation, scroll and visible active state.
5. Reduced motion, low-end WebView, high text scaling, tab/focus outlines and Telegram top/bottom safe areas.
6. Owner authentication, Anti-Delete and real Story publish are **separate backend release gates**; aesthetic improvements do not certify functionality.
