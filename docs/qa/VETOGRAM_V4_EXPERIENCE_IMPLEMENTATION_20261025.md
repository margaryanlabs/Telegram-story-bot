# VETOGRAM V4 — Canvas Noir experience implementation (25 October 2026)

## Scope

**Status: first engineering slice, NOT the completed V4 redesign.** This work branches from #183 at `2628fe7690a8f66234fb1851919aca944b88a407`. It preserves the stacked draft line #179 → #180 → #181 → #182 → #183. No production deploy, schema change, backend API, consent, Telegram account, secret, or dependency changes.

The existing `studio.html` and real feature controllers remain in place. Instead of adding a mock UI, V4 adds an opt-in experience behavior layer (`public/vetogram-experience-v4.js`) integrated through `studio.html` and styles inside the **existing canonical** `public/vetogram-noir.css`.

## Implemented on actual app surfaces

| Surface | Real change | Safety boundary |
| --- | --- | --- |
| Home | Primary chat entry and recent activity prioritized; six-tool catalogue moved to native disclosure | All original destination buttons/IDs retained, original status source is authoritative |
| Messenger | Connection explanation, privacy note and extra shortcuts use separate progressive disclosures | The real chat list, search and connected/disconnected controller are retained; help expands when connection CTA becomes visible |
| Privacy / Anti-Delete | Setup instructions and backup details become optional expansions | Verified archive/data, main protection action and permission workflow unchanged |
| Story publisher | Main media and audience actions remain visible; fine control moved into disclosure | Original confirmation, owner-bound publishing and audience selection remain |
| Story Studio | Fullscreen **real 9:16 canvas focus mode** with close/Escape, optional sliding inspector, underlying original editor undo/redo/export/publish | Existing canvas and event handlers reused. No claims about video/AI publishing |
| VETO AI | Three common modes emphasized; advanced modes and task/approval/memory workspaces reorganized into optional sections | Existing consent and actions preserved; real pending approvals reopen their workspace |
| Voice Studio | Real mic/spectrum/recording remains prominent; long privacy explanation optional | No microphone permission requested automatically |
| Sticker Studio | Actual upload/preview workspace ahead of large tutorial, with brand tools optional | Existing creation controls, artwork and Telegram publishing handlers preserved |
| Viewers / Analytics | Separate viewer-connection and CSV export information disclosed progressively | Real viewer metrics and connection behavior unchanged |
| Relay | Power button and status primary, explanatory facts secondary | No connection or networking mutation |
| Archive | Original existing archive browsing behavior is kept, not redesigned yet | No data moved or deleted |

The current V4 experience controller relocates DOM nodes rather than cloning them, retaining existing IDs and listeners. Disclosure controls are native `<details>`, keyboard-operable and exposed to assistive technology. The focus editor uses a live canvas, not a screenshot.

## Validation performed

- Latest fetched V4 JavaScript compiled with `new Function()` in the tool runtime.
- New Node source-bound assertions exist: `tests/vetogram-v4-experience.test.js`, picked up by the existing `npm test` glob.
- New JavaScript included in the existing `npm run check` syntax gate.
- Existing HTML still includes the real `seCanvas`, `seEngine`, chat list, voice controls, privacy settings, and AI tasks.
- CSS brace-balance source check passed; V4 is part of the existing NOIR stylesheet, not a 19th stylesheet.
- No API/Telegram sending/publishing call is introduced by the new UX controller.

**Limitations:** full Node `npm test` / `npm run vercel-build` was NOT run here; the private repository could not be cloned into the local runtime. The syntactic/static checks are not a substitute for actual HTML layout verification, physical Fold/WebView/keyboard tests, signed Telegram, voice/media/AI workflows or 60 FPS measurements. Do not advertise full QA or release readiness.

## Follow-up quality gates

1. Run Node test/build in a checked-out repository; fix regressions.
2. Open all 13 screens in a real preview and inspect widths 320/360/390/430/725/768/1024/1440, light/dark themes, Telegram keyboard, safe areas and screen transitions.
3. Confirm visually that disclosure moves do not collide with existing CSS, and that buttons bound before DOM relocation still behave correctly.
4. Verify owned signed session, 2-account isolation, publishing, Anti-Delete and Voice permissions in real Telegram.
5. Continue deep screen-by-screen structural component migration, especially the messenger thread, Story editor tool panels, AI conversation and privacy timeline. Remove redundant legacy CSS only after parity tests.
6. Finish RU / EN / HY UI labels and accessibility review. No silent fake data or AI success states.
7. Draft PR stays unmerged and undeployed until review.

## Changed files

- `public/vetogram-experience-v4.js` — contextual UX controller.
- `public/vetogram-noir.css` — Canvas Noir V4 layout, disclosures and fullscreen editor.
- `public/studio.html` — actual Mini App integration.
- `package.json` — add source syntax gate.
- `tests/vetogram-v4-experience.test.js` — source-bound regression checks.

This is an engineering continuation of the **selected Canvas Noir direction**, not a completion certificate for every promised V4 functionality.


## Follow-up implementation — richer everyday interactions

**GitHub continuation in the same draft PR #184**, without touching production or Telegram API behavior.

1. **Messenger gesture layer** (`public/vetogram-chat-experience-v4.js`):
   - Long press / context menu / Shift+F10 on a real, signed-in thread bubble.
   - User-initiated reply delegates to original `data-mirror-reply` handler.
   - Explicit clipboard copy of rendered message text with success/error feedback.
   - Local search through the existing per-thread search controller.
   - Archive navigates to the existing Privacy screen without implying the selected message is archived.
   - Right swipe on touch/pen opens the existing reply composer. No swipe auto-send and no data upload.
   - Dialog selection is revoked if message DOM or signed Telegram account changes; light theme and reduced motion supported.
2. **Story Studio composition** (`public/story-engine-core.js`, `public/story-engine.js`):
   - Pure non-mutating `applyStoryTemplate` retains owner ID, image, caption, layers, authored title/subtitle and manual text placement.
   - Only unchanged original template defaults update when switching styles.
   - All ten template tiles now draw **live 108×192 local canvas previews** with the same canvas paint function as the full 9:16 composition. Throttled to limit repeated rendering; thumbnail work is skipped when editor focus overlays it.
   - The existing undo/redo checkpoint and actual export/publish handoff are kept.
3. **UX correctness**:
   - Removed the V4 nested setup disclosure around the messenger's pre-existing native `telegramMirrorAccessDrawer`.
   - Added an independently dismissible immersive Story inspector, proper `aria-controls`, focus control and Escape behavior.
   - The additional chat controller is registered in `npm run check`. Added explicit source tests and functional template-switch cases.

### Validation for this continuation

- Fetched committed JS for new V4 experience, chat gestures and real Story Engine; all syntax parsed in isolated JS checks (ES module imports were stripped **only for the syntax harness**, not in source).
- CSS brace count balanced, no new CSS file; the NOIR canonical sheet contains all styling.
- The source-bound V4 test file was exercised in an isolated mock harness: **6/6 passed**.
- Pure Story template helper was executed on actual fetched source: **9/9 checked scenarios passed**, including user text/media preservation and no mutation of source draft.
- GitHub committed source and HTML include all new scripts; existing syntax-gate script references both V4 controllers.

**Still pending:** native `npm run vercel-build` / full Node suite in checkout, full browser/WebView interaction tests, drag/swipe conflict checks on physical Android/iPhone/Fold, codec/auth/AI/publish E2E. The mocked checks are **not** production validation.

**The project is not complete.** This PR is an integration slice, not a claim that all screens were structurally rebuilt or every previously listed product feature is ready.
