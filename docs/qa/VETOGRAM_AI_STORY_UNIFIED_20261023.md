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
