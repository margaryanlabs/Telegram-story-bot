# VETOGRAM — isolated Vercel Preview smoke test (2026-10-25)

## Verified deployment

- Account: SECOND Vercel account, `labsmargaryan@gmail.com`; project `veto`, project ID `prj_9JVRlYLCDU4fuZ18F3En06Ih0A69`.
- Source: `margaryanlabs/Telegram-story-bot`, branch `feat/vetogram-ai-story-unified-20261023`, **pinned commit `d320569c90d404aaf07cc3da0dd767fd734f0830`**.
- Preview: https://veto-now6tnwu1-labsmargaryan-5386.vercel.app
- Deployment ID: `dpl_2oX7M5qxVTbC1w6RhaoVnk8wTzNU`, **READY** from Vercel API after a full Vercel build.
- Builder: `npm run vercel-build`, **686 tests: 685 passed, 0 failed, 1 skipped**.
- Routes `/`, `/studio.html`, `/api/health`, `/api/vetogram-ai` all returned **HTTP 302 to Vercel SSO** to a caller without a Vercel session (expected Preview protection).
- Vercel Production remains a different deployment: Git SHA `6504a387d2b88961df3689792cd1c6d4d0e68571` with state **READY**.
- Automated Preview deployment creation remains disabled to protect Hobby build quotas; this Preview was created as a single explicit Git-based deployment.

## Fix made

The earlier Preview deployment `dpl_8TXziREuvEqYEjq5cEPMY4uf3bJv` failed because `tests/telegram-webhook-health.test.js` hardcoded obsolete `/app.js?v=20261019-messenger-first-v1` after asset cache busting. The test now asserts a single versioned `/app.js` script with a current build date. Targeted 5/5 webhook tests and 685/685 runnable suite tests passed at commit `d320569`.

## Security / staging boundary

- Preview environment has no configured production Telegram bot token, Telegram API ID/hash, Neon database URL or Neon session-encryption key.
- Preview is Vercel SSO protected. **Do not disable SSO merely to make a mobile link easy to open.**
- A normal browser preview can be reviewed visually after Vercel sign-in, but Telegram WebView initialization / MTProto chat access cannot be proven without consented test identities and a separately configured **test bot**. Do not reuse real users' sessions or the production bot for staging.
- AI and reminders remain fail-closed without explicit feature gates/provider credentials. No live AI-provider request, Story publication, message send or deletion capture has been carried out by this smoke test.

## Next controlled acceptance tasks

- [ ] Authenticated browser/UI review on phone and desktop: navigation, 13 screens, RU labels, visible disabled states, responsive layout, dark/light theme, keyboard and mic permission lifecycle.
- [ ] Configure separate test Telegram bot and corresponding test-only webhook/Mini App domain for a staging environment. Do not modify production BotFather settings to point at the Preview URL.
- [ ] Configure dedicated Neon **test** database/branch and owner-scoped staging encryption key before exercising archive or MTProto flows.
- [ ] With two consenting test accounts, verify code / QR login, 2FA, owner separation, Anti-Delete consent and genuine deletion after enablement, Stories publish and viewer Analytics accuracy, cancellation/invalid permissions, and logout/key cleanup.
- [ ] Only after live positive checks: enable per-feature switches selectively with quotas, observe logs, and decide whether to promote the reviewed commit into Production with rollback.

**This report describes a successful protected Preview build, NOT a production release or full Telegram end-to-end certification.**
