# VETOGRAM 4.1 — all-screen responsive and asset audit
25 October 2026 · Existing Mini App · Draft PR #181 · Source-only

## Scope
The 13 genuine screens in `public/studio.html`: Home, Telegram Chats, Voice, Publish, Viewers, Analytics, Privacy, Smart Inbox, AI, Story Engine, Creator Studio, Relay and Archive. The screen routes and existing modules are retained; no new mock, backend or deployment.

## Source findings
- The Mini App assembles its UI from **17 ordered stylesheets**, including legacy `app.css` and more recent theme, media, mobile, creative and finish layers. Several historical classes have fixed widths, hidden overflow and `!important`, making narrower devices vulnerable to conflicting sizes. No claim of full pixel or real-device proof is made from this audit.
- Finish stylesheet and chats/header JavaScript still used static query versions associated with older iterations. Since these files were edited across several design rounds without changing their query version, intermediary browser/CDN caches **could** serve stale assets after a deployment. Updated exact asset query strings in `studio.html`; actual cache invalidation requires the other chat to deploy this PR.
- Source navigation includes **13 real screens, 5 bottom destinations and 10 named open-screen targets**, all resolving to real screens or `SCREEN_ALIASES` (e.g. `creator -> studio`). The current HTML has **578 unique IDs, zero duplicates**, and valid `aria-controls` and form-label `for` references.
- The runtime still depends on authenticated Telegram/MTProto permissions and API responses. This audit neither asserts that all features work nor bypasses these gates.

## Actual code changes
1. `public/vetogram-finish-2026.css` — appended VETOGRAM 4.1 scoped responsive fit and interaction rules: avoid text and container overflow; consistent focus rings, disabled affordances and touch feedback; editorial hierarchy on existing secondary screens; 720/480/360px grids for analytics, Viewers, archived Smart Inbox and Story Engine; 16px minimum text-edit font size on narrow iOS displays; reduced-motion safeguards. Existing signed messenger thread and native Story Canvas behaviors are deliberately untouched.
2. `public/studio.html` — updated asset URLs for `vetogram-finish-2026.css`, `telegram-chats.js` and `vetogram-header.js` with 4.1-specific query versions to request fresh client assets after deployment. Old URLs are not used.
3. `tests/vetogram-cross-screen-41.test.js` — six automated checks for all 13 screens, routing, DOM IDs and ARIA references, asset versions, mobile CSS contracts and reduced-motion/focus semantics. Registered in `ci:offline`, `qa:core:offline`, `check`.

## Verification obtained
- New **6/6** isolated source tests passed directly against current GitHub branch files.
- Prior premium header/source compatibility checks **4/4** passed against current CSS, HTML and `vetogram-header.js`.
- Actual `public/telegram-chats.js` JavaScript parsed successfully and CSS curly-brace counts were balanced.
- No full `npm ci`, Node CI, visual screenshot diff, benchmark or real Android/iPhone/Fold Telegram WebView QA was executed. These tests are a source-level gate, not a claim that production is ready.

## Physical acceptance matrix (needed after Preview deploy)
- **320, 360, 393, 600, 768 and 1024px** layouts; Android, iPhone and unfolded/folded Fold.
- All 13 screens: headings do not overflow; visible buttons and forms can be reached and activated; light/dark variants preserve contrast and safe areas; Story Canvas maintains usable controls.
- Telegram Inbox: compact header, readable counters, actual owner-specific filters, long-name rows, keyboard opening and recovery of previous list scroll.
- Voice: request/deny microphone, Start/Stop, record limit, true preview/redo/explicit Send; never claim owner voice permissions from UI-only status.
- Story Publish and Story Engine: preview/upload, account Premium limitations and publication eligibility; cannot infer from visual CSS.
- AI: no automatic read/send; provider activation, cost, fallback and actual response require separate integration tests.
- Archive/Privacy: preserved copies and deletion evidence must be checked against actual data; never fabricate recovered messages.
- Route / Back / accessible focus / reduced motion / keyboard / long text / image+audio media; no clipping or unexpected scroll.

## Release boundary
No main merge, no Vercel or Neon change, no production deploy, no API keys, payment requests or Telegram user actions. All work remains in the shared PR #181 pending integrated Preview QA.
