# VETO Telegram — launch gate & safe rebrand (2026-10-20)

Status: **PRELAUNCH / NOT YET VERIFIED FOR GENERAL AVAILABILITY**. A Vercel `READY` deployment means the build completed; it does **not** establish that account linking, payment, deletion archive or end-to-end stories work reliably for independent accounts.

## Non-negotiable launch gates

1. **Public access.** Verify the final production domain in a fresh, unauthenticated browser. At audit time the Vercel project had SSO protection set to `all_except_custom_domains` and only `.vercel.app` domains listed. Fix only once release gates are satisfied. Confirm HTTPS, correct Telegram BotFather web app URL and real launch inside Telegram on Android, iOS, Desktop.
2. **Sign-in and segregation.** Test two separate real Telegram accounts from fresh sessions: QR, phone+code, 2FA, failed/expired code, account switch, session disconnect and revoked Telegram session. No data from Account A may appear for B. The account link must never ask for the bot token.
3. **Live messaging.** Test loading chats, first and older pages, slow connection, removed and archived chat, incoming/outgoing text, photo, video, voice/sticker, reply, duplicate-submit protection and transient send failures. Never resend automatically when send status is uncertain.
4. **Privacy and archive.** Obtain explicit owner opt-in; verify Telegram Business rights are present before capturing eligible updates; test edit/delete events, retention, restored archive, data deletion and revoked rights. Inform users that no Telegram service can guarantee recovering events that occurred before connection or outside permissions.
5. **Stories.** Verify fresh story creation, audience/exclusion, story deletion, contacts list and media. Ghost View implementation avoids explicit read-receipt RPCs, but this is **not a guarantee** that Telegram or another logged-in client will not record a view. Fail closed if the required response-mode proof is absent.
6. **Resilience.** Verify backups/restoration, storage quotas, encrypted session health, timeouts/rate limits, revocation, worker leases, Supabase database access, Vercel spend budget and application error alerting.
7. **Security.** Confirm `SETUP_SECRET` for setup POST, Bot API webhook secret, server-only credentials, no session/token/phone logging, no user data in third-party analytics, no client-side payment entitlement granting, and all protected endpoints owner-scoped.
8. **Legal and support.** Publish Privacy Policy, Terms, user data deletion process, support contact, complaints/refunds flow, payment policy; review Telegram API/Business terms and applicable privacy rules.
9. **Payments.** Do not show paywall until a test Star invoice, `pre_checkout_query`, confirmed `successful_payment`, idempotent durable ledger, entitlement activation, renewal/expiry, refund and `/paysupport` have been verified.

## Safe change-of-brand workflow

Telegram distinguishes **display name** from **@username**. Keep the existing bot token, owner, webhook, bot id and database when rebranding the display name. Telegram's bot documentation states @username is not changeable for an existing bot. If a different @username is essential, create a new bot and run an opt-in transition; do not promise that users or conversation histories automatically migrate.

The setup route can overwrite a manually chosen public identity if it resynchronizes profile fields. This patch makes those writes explicit opt-in:

- `BOT_PROFILE_SYNC=true`: permits legacy automatic name, short description and full description synchronization from `api/setup.js`.
- `BOT_PROFILE_PHOTO_SYNC=true` **together with** `BOT_PROFILE_SYNC=true`: permits overwriting Telegram profile photo.
- Default: do **not** change Telegram display name, bio or profile photo through `/api/setup`. Webhook registration, commands and web app menu continue working.
- **Before choosing a new name**, inventory and prepare all old user-facing occurrences of `VETO Telegram` and `StoryLab` in front end, server text, icons, support, legal pages, links and contact material. Do not rename internal database fields, signed callback formats or environment variables during the cosmetic brand rollout.
- Do a brand staging PR, verify onboarding/menu/chat/deep link on two accounts, then update BotFather display name and photo and release the staged UI together.
- Keep an owner-only feature flag to revert UI copy while preserving the original bot token, Telegram user ids and archive.

## Monetization architecture (proposal; NOT implemented)

Digital goods/services sold **inside** Telegram bots / Mini Apps are paid in **Telegram Stars (XTR)** under Telegram's published rules, including for users in Russia. Do not embed Russian card gateways, SBP, YooKassa or crypto checkout as a substitute for Stars in the Mini App. Such methods may be considered for genuinely separate eligible web services outside Telegram after legal/payment-provider review, not as an in-app payment bypass.

Suggested first experiments (30-day prices; Stars are not equivalent to a fixed USD/RUB price):

| Plan | XTR / 30 days | Scope |
| --- | ---: | --- |
| Free | 0 | Live chats, connection management, basic story browsing and security status; small transparent quotas |
| Plus | 399 | Opt-in 30-day archive, advanced Stories and basic intelligence, limited Studio packs |
| Pro | 999 | Opt-in 180-day archive, smart search, richer Intelligence, automations, more Studio packs |
| Creator | 1999 | Brand packs, priority exports, higher capped Studio quotas, creator-oriented analytics |
| One-off packs | 49–199 | Credits for clearly priced asset processing, separate from monthly renewals |

Costs and unit economics must be checked before publication. Explicitly limit compute-heavy AI generation, image rendering, retained encrypted bytes and background watchers per tier. Treat these as proposed price points, not actual configured payment products.

Payments implementation sequence: new owner-scoped subscription/ledger tables → catalog → createInvoiceLink/sendInvoice in XTR → pre_checkout_query validation with a bounded response time → successful_payment idempotent verification by charge id → grant entitlement server-side → renewal, cancellations and expiry → refundStarPayment, `/terms`, `/support`, `/paysupport` → abuse/rate protections → Telegram test environment → opt-in release. Until this exists, **never claim active billing**.

Source references:
- https://core.telegram.org/bots/payments-stars
- https://core.telegram.org/bots/features
- https://core.telegram.org/bots/api
