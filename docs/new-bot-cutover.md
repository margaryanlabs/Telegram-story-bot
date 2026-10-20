# VetoTG @Vetotg_bot cutover — no customer migration

**Scope:** Replace the legacy @Storypilotlab_bot public entrypoint with the already created @Vetotg_bot, while keeping the current VetoTG repository, Mini App and database schema.

## 0. Confirm the selected identity

- **Confirmed target username:** `@Vetotg_bot`; proposed display name: `VetoTG`. Bot ownership must be confirmed in BotFather. Do not create another bot.
- `@Vetotg_bot` already exists according to the owner. Confirm it appears in the owner's BotFather `/mybots` list; no username availability search or new bot is needed.
- User-facing strings now target VetoTG; keep internal `story_pilot_*` database names and callbacks for backwards compatibility.
- Do not delete the existing bot yet.

## 1. Owner verifies existing bot and retrieves its token securely

Open https://t.me/BotFather → `/mybots` → choose **@Vetotg_bot** → **API Token** (or `/token` if rotation is necessary). **Do not create a new bot**, and do not paste the token into GitHub, tickets or ChatGPT. Store it only in the protected server-side Vercel environment variable.

In BotFather configure a recognizable picture, long and short descriptions, and the Mini App menu after final production domain is selected. Do not activate public promotion until smoke tests pass.

## 2. Stage the cutover (safe & reproducible)

1. Preserve a secure snapshot of current Vercel config, Supabase data and the working production deployment. Never publish secrets in screenshots or logs.
2. Make sure the final HTTPS production domain loads without Vercel SSO in **an unauthenticated Telegram WebView**. The last inspection listed only `.vercel.app` domains and `all_except_custom_domains` SSO mode; the deployment's `READY` alone is insufficient.
3. Set these server-only Vercel environment variables on the **correct project** (`telegram-story-bot`), never in frontend bundles:
   - `TELEGRAM_BOT_TOKEN` — the new BotFather token; changing it also changes Mini App initData verification and derived crypto inputs.
   - `TELEGRAM_EXPECTED_BOT_USERNAME=Vetotg_bot` — intended username, with or without `@`. The setup endpoint now refuses to register a webhook if Bot API `getMe` identifies another bot.
   - Keep `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`, `SETUP_SECRET` and existing stable storage settings untouched unless they require a documented migration.
   - Keep `BOT_PROFILE_SYNC` unset/false: profile edits in BotFather remain authoritative. Never enable `BOT_PROFILE_PHOTO_SYNC` unintentionally.
4. Deploy reviewed code and update the production environment; verify `GET /api/setup` reports the intended `bot` and `expected_bot_match: true`. This GET is read-only.
5. Only then call authenticated `POST /api/setup` with the existing `SETUP_SECRET` via an owner-controlled terminal/secret-safe workflow (never via an open web URL). The endpoint registers the new bot webhook, commands and menu.
6. In BotFather configure the Mini App domain/menu to the exact live HTTPS site. Test `/start` and Web App opening from the **new bot**; `initData` from the old bot cannot authenticate against the new bot token.

## 3. Smoke test matrix (two real Telegram accounts)

- /start, Mini App, user name, login QR + phone code/2FA, owner mismatch, account disconnect
- Chats: first page, older pages, text sends, voice, images, stickers and error handling
- Stories: view, publish, audience, delete; do not guarantee anonymity outside our own receipt RPC policy
- Privacy: optional Business connection, explicit consent, delete/edit archive and removal rights
- Security: wrong expected username triggers **409 before setWebhook**, no credentials in logs, `/api/health` is healthy
- Android/iOS/Desktop; new Telegram users without an existing account session
- Check any premium/billing screens are not presented as live payments before Stars backend is implemented

## 4. Rollback and retirement

If there is a problem, preserve the new bot token securely, stop promotion, revert the reviewed deployment and previous Vercel environment secret mapping as needed, and re-register the old bot's webhook only using the original authorized account. A token swap is not just a new name: the old bot ID and existing sessions do **not** carry over. With no customer base, starting fresh is acceptable.

Only after a successful public dry run should the owner disable the legacy bot (by clearing its webhook or marking it retired). Deleting the legacy bot with BotFather is irreversible and should be the *last* optional action.

## 5. VetoTG public copy (ready for BotFather)

- Bot name: `VetoTG`
- Username: `@Vetotg_bot`
- Short description: `Чаты, Stories, приватность и умные инструменты Telegram — в одном приложении.`
- Full description: `Подключай свой Telegram, работай с переписками, публикуй истории, используй приватный архив, поиск и инструменты для контента. Подключения и архивы управляются отдельно; возможности зависят от разрешений Telegram.`
- /start: `Открыть <FINAL_PUBLIC_NAME>`
- Menu: `Открыть <FINAL_PUBLIC_NAME>`

Reference: https://core.telegram.org/bots/features
