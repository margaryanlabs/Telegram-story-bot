# VETOGRAM 3.0 — Daily Workflows UI (24 October 2026)

## Scope
This is a **draft-branch** improvement to the REAL `public/studio.html` app, not a detached standalone concept. The existing `vg26Resume` section now presents four structured workflow entries with premium responsive styling, consistent with the last-loaded 2026 design layer.

| Entry | Explicit destination | Behaviour |
|---|---|---|
| Ответить красиво | `ai` screen, existing `reply` mode | Navigates, clicks existing AI mode controller; does NOT generate, send or copy text |
| Создать сильную Story | `ai` screen, existing `campaign` mode | Navigates, selects Story-to-Sale draft mode; does NOT publish |
| Проверить Anti-Delete | `privacy` screen | Navigates only; does NOT alter consent or enable archiving |
| Сделать голосовое | `voice` screen | Navigates only; does NOT start microphone or send voice |

New `public/vetogram-workflow-core.js` defines an explicit allowlist. `public/vetogram-workflows-2026.js` binds real click events, navigates via the existing `VetoTelegramNavigate`, selects AI modes using their existing `data-vtai-mode` buttons, sets `aria-pressed`, and reports clear success/failure without claiming an external action happened.

No passwords, Telegram messages, personal context, client storage, fake subscriber metrics or external API calls are required or introduced.

## Visual finish
`public/vetogram-experience-2026.css` (currently the last stylesheet) styles a quiet but premium four-action deck: strong content hierarchy, restrained peach/coral highlights, whitespace, 44px+ usable targets, sensible 2-column mobile layout, one column on very narrow 365px screens, focus-visible treatment, `aria-live` status and reduced-motion safety. Works with the product's existing palette variables to retain multiple supported themes.

## Test evidence
`tests/vetogram-workflow-2026.test.js` provides six focused dependency-free checks (V8 isolated evaluation against exact current GitHub JavaScript and HTML/CSS):

1. Strict workflow/destination allowlist; unknown actions rejected.
2. Real click opens AI reply mode without network/auto-send.
3. Story-to-Sale opens campaign mode only.
4. Privacy and Voice navigation have no AI mode click.
5. Missing target or failed navigation shows error and no fake selected state.
6. HTML module inclusion, button accessibility, stylesheet mobile and reduced-motion rules.

**6/6 passed** in the isolated V8 test harness. The test is registered in `npm run qa:core:offline` and `ci:offline`. Real Telegram mobile UI visual inspection, native Node runner and backend integration remain separate tasks.

No deploy, merge, database changes or GitHub Actions runs in this iteration.
