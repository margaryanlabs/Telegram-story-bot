# VETOGRAM REBORN RB12 — CSS Release Consolidation & Mobile Safety

**Date:** 2026-11-05
**Branch:** `feature/vetogram-reborn-rb1-foundation-20261105`
**Draft PR:** #235, based on the independent Vetogram 8.5 visual-review branch, not `main`
**No production merge, Render replacement, live account operations or deployment.**

## What actually changed

RB8–RB11 introduced a cohesive graphical system across the real Telegram Chats/Stories, Media/Play, Privacy/Smart Inbox and Profile/Account Center. The static studio previously linked **35 stylesheets** and included four separate last-stage RB8–RB11 design files. Keeping them independent made their precedence and shipping version easy to drift during continued work.

RB12 now keeps the original **source CSS files** as the editable design library and serves **one generated CSS bundle**:

- `public/vetogram-reborn-atelier.css` — RB8 Chats, Stories and the 4-tab shell
- `public/vetogram-reborn-media.css` — RB9 Media Hub, Games shell, persistent media player
- `public/vetogram-reborn-privacy.css` — RB10 Privacy, Business permissions, archived Smart Inbox
- `public/vetogram-reborn-account.css` — RB11 Profile, signed account status, QR/OTP/2FA modal presentation

`scripts/build-reborn-css.mjs` deterministically concatenates these four files **in that exact original cascade order**, separating them with source markers, and appends an RB12 safety epilogue. No `@import`, `@charset` or relative CSS asset URLs in the four sources block consolidation.

`public/vetogram-reborn-ui.css` is the generated, committed static file. Run:

```bash
node scripts/build-reborn-css.mjs
node scripts/build-reborn-css.mjs --check
```

The `--check` command fails if any editable source module is different from the committed output. Edit the individual four files, then regenerate the bundle; **never hand-edit the generated file**.

`public/studio.html` now loads the **RB1 foundation** and then **the single RB12 bundle**. Other legacy styles and the three separate Music/Cinema/Books iframe module styles are left intact. This cuts `studio.html` from **35** CSS links to **32**, reduces the final Atelier layer from four HTTP requests to one, and preserves the original order of declarations without adding a browser runtime dependency.

## Actual UI correctness repairs

### Protect the semantic `hidden` attribute
Legacy and newer designer CSS both contain `display: ... !important` rules. The HTML `hidden` attribute must not unexpectedly reveal any confidential login UI or old Telegram thread actions.

A release invariant at the **very end of the bundle** forces `[hidden]:not([hidden="until-found"])` to `display:none!important`. Additional **ID-specific selectors** cover the real dynamically managed chat deep link, pending-login notice, QR image and country selector because an older selector may outrank the generic invariant. `hidden="until-found"` remains excluded to preserve native browser find-in-page behavior. No JS control state or permission has changed.

### Correct 44px mobile hit areas
Existing RB8 CSS reduced some chat-header tools to **39px** on mobile while legacy styles had a 44px minimum. RB12 restores **44px** minimum width/height for the real inbox tools at coarse pointers up to 600px and for the native conversation Back control, without changing the controller or showing redundant Home/Archive buttons on small screens.

### Modal and Telegram keyboard geometry
The final account modal now observes `--veto-visible-height` for its height cap instead of a fixed display-only ceiling. The existing **higher-specificity** `.veto-keyboard-open` rule in `vetogram-noir.css` remains the authority on the modal's bottom offset and keyboard-visible maximum height. The `veto-device-polish.js` visualViewport observer is preserved; no duplicate resize listener or competing keyboard state machine was introduced.

## Tests changed and executed

- New `tests/vetogram-reborn-rb12-bundle.test.js` has **13 regression contracts** for deterministic input parity, stylesheet order, HTML `hidden` handling, 44px tap areas, viewport geometry, light themes, accessibility, Media iframe stylesheet independence, 4-tab navigation, CSS syntax and unique static IDs.
- Prior tests for RB1, RB8, RB9, RB10 and RB11 were updated **only where their assertion presumed one of the four standalone CSS links was the final linked file**. The source CSS contracts are retained.
- **Actual checks in isolated V8 against fetched GitHub files:** RB1 **3/3**, RB8 **11/11**, RB9 **12/12**, RB10 **15/15**, RB11 **15/15**, RB12 **13/13** = **69/69** passing. The real generator was executed against source-file mocks and produced a character-for-character identical bundle; both its generate and check paths passed.
- Inspected an additional **15 earlier RB2–RB7 and authentication/navigation test sources** for obsolete assumptions about stylesheet loading order; no additional last-stylesheet assertions were found.
- Inspected `vercel.json` (static `public/**` deployment) and `scripts/vetogram-preview-server.mjs` (CSS MIME and safe public-file path): both support a new root-level `.css` asset without a route change.

**These are isolated source-contract executions**, not an actual `node --test` repository pass, real browser computed styles, screenshot comparison or mobile device QA. Do not interpret 69/69 as production readiness.

## Remaining release gates

1. Run `node scripts/build-reborn-css.mjs --check` and the complete `node --test` suite on a full repository checkout, including all RB2–RB7 and legacy controllers.
2. Publish the exact Git commit to a **separate preview**, not the old 8.5 review service or production. At the last check, Render had **25/25** services, while Vercel API deployment was blocked by **402** `api-deployments-free-per-day` (>100 per day).
3. Verify the new `/vetogram-reborn-ui.css?v=20261105-rb12-01` is served with 200/valid CSS and that all sections render in the same expected order.
4. Compare actual screenshots at **320, 360, 390, 430px**, Samsung Galaxy Z Fold cover/expanded widths, and desktop. Include graphite, Pearl and Linen themes and large text/reduced-motion.
5. Validate showing/hiding OTP resume, QR, country chooser, avatar, all modal options, tool drawer, unread chat list, optional Business permission and archive-clear controls.
6. Exercise actual Telegram login/OTP/2FA/QR, owner mismatch, revocation, chat loading and sending, message-dialog Back, Story viewer, background audio, file imports and stored-reader preferences.
7. Only after visual/device/functional QA should the PR leave **Draft** or be merged.

**No new public RB12 URL exists as a result of these source changes.** Existing production and the 8.5 review remain untouched.
