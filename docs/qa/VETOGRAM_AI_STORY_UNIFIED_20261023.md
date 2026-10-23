# VETOGRAM NEXT — AI Command + Story Engine unified branch

23 October 2026. Implementation is inside existing repository margaryanlabs/Telegram-story-bot.

## Base and isolation
- Branch: feat/vetogram-ai-story-unified-20261023
- Branched from current feat/vetogram-story-engine-20261022 / PR #180, which depends on draft consent/onboarding PR #179.
- main, original Story Engine PR, owner Telegram sessions, Neon schema and production were not modified.
- Integrates with existing screen navigator, Telegram owner session send endpoint, and Story Engine, not a new app.

## Implemented in this branch (not production)
- VETO AI screen reachable from Vetogram home, chat thread header and Story Engine.
- Four bounded modes: AI chat, on-demand translation, suggested reply, structured Story Director (title/subtitle/caption). In-memory short AI chat context; no browser persistence.
- Server-side Gemini 2.5 Flash-Lite or OpenAI Responses API integration using configured environment credentials. Nothing is described as a real AI response when provider is not available.
- Signed Telegram Mini App owner validation, per-request checkbox consent and header guard, size-bounded prompts, max output and 17-second provider timeout. Server never reads Telegram chats and cannot send.
- User may load a bounded list of their own Telegram conversations for recipient selection; no message previews, contents or history are passed to the AI backend automatically.
- User edits AI draft, explicitly confirms recipient+message, then existing owner-verified /api/telegram-send performs the actual send. Telegram server validates dialog identity and send nonce; no automatic sends.
- Story Director text can be reviewed then passed into the **current** device-local Story Engine draft via owner-scoped browser event. Existing photo, layers, Portal, privacy and explicit Telegram story publish continue unmodified.
- All 32 existing single-function Hobby routes retained and one new AI route added.
- New node:test contracts in tests/vetogram-ai-command.test.js and JS syntax guards.

## Current release gates (do not launch as-is)
- VETOGRAM_AI_ENABLED must remain unset/false until durable per-account usage quotas, global budget caps, provider error monitoring and privacy review exist. API keys must be provisioned as secrets in intended deployment; no keys in GitHub.
- Do not auto-fetch, summarize or store Telegram message content with external models without appropriate consent; user-supplied text only.
- No autonomous negotiator/autopilot, background agent, AI Memory persistence, bulk sends, billing, streaming, Presence, or AI image/video generation were implemented in this stage.
- Running code on real Telegram accounts and mobile WebViews is **not verified**. Verify the full npm run check / npm test + preview (blocked by Vercel quota and GitHub Actions billing on previous branch).
- Manually test recipient selection, draft editing, translation target language, Telegram send retry uncertainty, account switching mid-request, Story image preservation and Story publish handoff.
- PR #179 requires Neon v5 migration + key preflight + two-account test; PR #180 Portal public cards are stateless only; real public submissions require separate approved data model.
- Until the release gates pass, do not merge this branch into main or deploy to production.

## Next technical milestone
Build a per-owner durable AI usage ledger with daily limits and user-visible allowance before enabling credentials. Then add opt-in per-chat context and an Approval Center with audit history, only after privacy and Telegram policy review. Maintain Story Engine developments via careful rebasing; do not overwrite parallel changes.


## 23 October continuation: AI quota, Story-to-Sale and hardened handoff (source only)

- Added manual additive SQL migration `migrations/vetogram-ai-usage-20261023.sql`.
  DB procedure reserves conservative AI usage units atomically across all
  instances using a transaction-scoped PostgreSQL advisory lock. Each UTC-day
  ledger row stores owner ID, count and reserved units only — not prompts,
  AI output, Telegram chats or provider keys. A failed per-owner reservation
  rolls back its global reservation in the same transaction.
- `VETOGRAM_AI_QUOTA_READY=true` required in addition to existing
  `VETOGRAM_AI_ENABLED=true`, actual provisioned secrets and the completed
  manual migration. No DB migration/production environment mutation executed.
- Defaults: eight requests per owner UTC day, 80,000 conservative usage units
  per owner/day and 1,000,000 units globally/day. Override via
  `VETOGRAM_AI_DAILY_REQUEST_LIMIT`,
  `VETOGRAM_AI_DAILY_OWNER_UNITS`,
  `VETOGRAM_AI_DAILY_GLOBAL_UNITS`. Limits are not accurate USD charges; use
  provider billing ceilings and alerts too. A reservation counts even if a
  provider later times out; this intentionally errs on the side of safety.
- Added visible remaining daily request count after successful AI requests.
- Story Director handoff now awaits the initialized Story draft and verifies
  current Telegram owner before acknowledging successful transfer. Existing
  image, movable layers, publish audience and permission gates remain untouched.
- Added `campaign` / **Story-to-Sale** mode. The model returns strictly
  validated Story title/subtitle/caption plus optional `offer`,
  `invite`, `waitlist` or `poll` Portal copy (type/title/description/CTA).
  User may edit the content and separately opt into replacing the current
  local Portal configuration. No AI-generated HTTPS links can be introduced.
  Real RSVP, orders, payment, audience stats and user data collection remain
  unimplemented.
- Owner-switch clears in-memory AI consent and draft/action state.
- Uncertain Telegram send retries reuse the same MTProto random ID for
  the identical sender/chat/message intent while the WebView remains open;
  no background sends or persistent queued messages.
- Added new deterministic tests covering budget caps, conservative usage,
  Postgres quota SQL invariants, Story-to-Sale output validation, and owner
  safeguards. A local parser-level contract inspection is not equivalent
  to running the full Node test suite or a real Neon/Postgres migration.

## Release gates after continuation
1. Validate and apply the additive migration **only after explicit owner approval**,
   to the correct Neon environment, checking function owner and permissions.
2. Configure both AI enabling flags and provider API key only with daily
   provider-side spend limit and monitoring. Never commit API keys.
3. Run full `npm run check && npm test`, inspect Vercel build/preview,
   validate concurrency limits against real Neon, and test Android/iOS WebView.
4. Test international translation, a Story-to-Sale Portal handoff that
   preserves photos/layers, explicit recipient confirmation, and uncertain
   delivery/retry behavior with two separate Telegram test accounts.
5. Hold parent PR #179 and Story Engine #180 release dependencies unchanged;
   no merges/deploys to main from this draft until gates pass.
