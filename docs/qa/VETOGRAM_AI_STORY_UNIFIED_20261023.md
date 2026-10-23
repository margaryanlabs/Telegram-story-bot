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


## Approval Center + AI Memory continuation (23 October 2026)

- Added **Approval Center** inside the original VETOGRAM AI screen. Owner-scoped, session-only queue: up to 12 editable draft messages, each expiring after 30 minutes. Users can review, reject and explicitly confirm real Telegram sends. No timed/background sends. A previously verified recipient is rechecked by the original send API. Queue and send nonce are cleared on account change.
- Added **AI Memory beta**, intentionally not advertised as durable memory. Maximum eight user-written session-only notes, up to three manually selected per AI request. Existing consent checkbox is required, plus a separate opt-in for note transmission; the note opt-in automatically resets after a request. No Telegram chats are auto-read or stored.
- API normalizes and bounds the user-supplied reference notes. The provider receives them inside the **untrusted user message**, not a system/developer prompt; the quota reservation includes those notes. No notes are logged or persisted by VETOGRAM.
- Added **Reply with AI** directly from a live Telegram chat: explicit confirmation copies only the latest available incoming text to the local AI draft. No model call until AI consent and user action. Outgoing, deleted and preserved-only messages are excluded. Chat ID remains owner-scoped and recipient is revalidated on send.
- Added shared browser+Node testable `public/vetogram-ai-workspace-core.js`, markup/CSS, regression tests in `tests/vetogram-ai-workspace.test.js`. Changed the AI controller script to a browser ES module. UI elements and module wiring validated by static source checks.
- **Privacy limitation:** session-only queue and notes disappear when the Mini App is closed or refreshed; they are not encrypted cloud data or persistent records. They must not be marketed as durable CRM/AI Memory. No autonomous negotiations or scheduled follow-ups have been implemented.
- **Validation limitation:** source inspection and local JS parser/model checks only. The complete npm test suite, provider/API requests, Neon transaction integration, Android/iOS WebView and deployment have **not** been run on the actual repo runtime. Main/production, Telegram permissions, Neon database and published Stories remain unchanged.

Next: real owner-separated mobile QA; per-chat consent and granular, revocable agent scopes; encrypted durable action/audit ledger before Autopilot. The parent PR #179/#180 gates still apply.


## Negotiator Lab + stricter accounting (23 October, later continuation)

### Implemented in the same Mini App / PR #181
- New **Negotiator Lab** within VETO AI. This is a single-request,
  human-reviewed **drafting simulator**, NOT an active negotiation agent.
  Nothing can read chats, watch users, send automatically, commit to a sale,
  transfer money or accept a contract in the background.
- User selects **one already accessible chat**, currency
  (USD/EUR/AMD/RUB/GEL/GBP), asking price, hard minimum price,
  maximum discount 0–30%, permission duration 5–120 minutes and negotiation
  goal. They supply the customer text explicitly and approve transmission
  before calling AI.
- `public/vetogram-negotiator-core.js` creates a session-only frozen policy
  bound to owner and recipient. Effective minimum is the greater of the
  stated floor and the asking price minus allowed discount. Responses are
  strict JSON drafts. The local review gate rejects wrong owner, wrong chat,
  expired policy, invalid action/currency, prices outside bounds, and a
  mismatch between AI's numeric quote and the price visibly written in its
  reply. Ambiguous money formats block instead of being guessed.
- The model never receives the Telegram chat ID; the ID stays local for
  recipient validation. The only provider input is the user-supplied
  scenario, non-secret numeric limits and any separately consented notes.
- Allowed drafts still require an **explicit, separate human confirmation**
  through the pre-existing `/api/telegram-send` backend. The AI endpoint
  has no Telegram sending capability and grants no server-side autonomous
  privileges. Editing/reviewing an Approval Center draft is a separate
  human action; do not advertise this as an agent that enforces monetary
  restrictions after arbitrary manual rewrites.
- Negotiation requests longer than 3,000 characters **including constraints**
  are rejected rather than silently trimmed before transmission.
- AI daily usage accounting now includes the exact provider-facing prompt
  (including user-selected notes); still a conservative usage-unit budget,
  not verified token spend or actual USD billing.
- New `tests/vetogram-negotiator.test.js` covers owner/dialog binding, TTL,
  price range, discount bound, currencies, mismatched visible offers, strict
  JSON validation and forbidden background actions. AI mode and budget
  regression tests updated. JS syntax and deterministic function checks
  were performed; full CI, WebView, Neon/provider integration still unverified.

### Launch restrictions
- Keep feature branch and parent PR #180 unreleased until #179 prerequisites
  and other mobile/production checks complete.
- No durable grant/permissions ledger, webhook automation or permanent
  AI Memory has been shipped. For real AI Autopilot/Negotiator add
  server-enforced grant scopes, revocation, stateful workers, anti-abuse
  enforcement and privacy/legal review before touching live inbound chats.
- Database migration for AI usage remains staged but **not applied**.


## Encrypted AI Memory + server-scoped Negotiator grants (continuation)

### Code added in PR #181 (NOT DEPLOYED)
- **AI Memory server storage**: `lib/vetogram-ai-memory-crypto.js` implements AES-256-GCM with independent `VETOGRAM_AI_MEMORY_KEY` (64 hex digits / 32 bytes), authenticated owner ID in AAD and versioned ciphertext envelope. This is **server-side encryption at rest**, NOT end-to-end encryption: authorized backend instances holding the key can decrypt notes.
- Manual **additive** `migrations/vetogram-ai-memory-20261023.sql` creates `public.vetogram_ai_memory_store` with owner ID, encrypted snapshot and monotonic revision. Label and content are stored inside the encrypted snapshot, not as plaintext columns.
- `/api/vetogram-ai-memory` requires signed Telegram Mini App auth on every request; explicit header consent for snapshot writes; maximum 8 validated notes. A revision-based compare-and-swap prevents stale writes from silently overwriting another device's changes (HTTP 409). No automatic AI prompt ingestion, data extraction from Telegram or backups are implemented.
- User-initiated **load / save / clear cloud copy** actions in the existing AI Memory UI, with revision and account-switch protection. Locally edited notes still live only in the current WebView until the owner explicitly uploads. Cloud wipes do not alter unsaved local notes.

### Server-side draft grants
- Manual **additive** `migrations/vetogram-ai-draft-grants-20261023.sql` creates one current drafting grant per Telegram owner. Fields: chat, currency, price bounds, allowed discount, expiry and revocation time. No private messages stored.
- `/api/vetogram-ai-grants` allows issuing/status/revoking a **draft-only** permission after signed owner auth; creating/revoking requires a consent header. Issuing a new grant atomically replaces the previous one.
- The **Negotiator AI API** now requires an existing unexpired server grant for the exact owner and chat ID **before** reserving budget or reaching the model. It re-reads grant state after the model returns, validates monetary output against server-held bounds and rejects out-of-policy drafts (HTTP 422). The Telegram chat ID is NOT forwarded to the model.
- Client explicitly asks owner consent before creating the grant and provides a manual revoke action.
- **No autonomous sending privileges** are granted. Existing `/api/telegram-send` remains an owner-confirmed direct action, not a delegated tool. Revoking a draft grant does not control Telegram's independent manual-send permissions.

### Release operations (not completed)
1. Confirm PR #179 / #180 prerequisites, schemas, permissions and Vercel build readiness.
2. Review/backup target Neon schema. **Manually** apply the two migrations to the intended DB only when authorized; test CAS concurrency, revoke races, migration idempotence and DB role grants.
3. Generate distinct server-only secrets and handle secure key backup and rotation. The memory key must not be the Telegram-session encryption key. Losing the memory key makes existing cloud notes undecryptable.
4. Enable only after tests: `VETOGRAM_AI_MEMORY_ENABLED=true`, `VETOGRAM_AI_GRANTS_ENABLED=true`, and existing AI provider/quota flags, as appropriate. Do not expose these secrets in client JS.
5. Run full `npm run check && npm test` with a real dependency install, validate the Vercel Preview, run Android/iOS Telegram E2E with two accounts and external provider billing safety checks. **Not yet run**.
6. Validate privacy disclosures, retention/deletion and applicable Telegram permissions for cross-user content before granting any background agent actions.
7. GitHub commit CI reported `Vercel – veto` failure with upgrade-to-Pro / build-rate-limit URL during this work. Do not treat as passing QA or deploy ready.

Current source-level validation: JS modules and newly introduced tests parse, bounded note/UUID and owner/grant policy checks pass. Production, live DB, provider account, BotFather and Telegram user sessions remain unchanged.

Next independent milestone: server-side request audit entries and *explicit* per-chat opt-in for any AI ingestion. No 24/7 autonomous negotiator or durable workflow worker is part of this PR.

## Agent Control metadata audit + emergency stop (continued 23 October)
- In the same draft PR, added **`migrations/vetogram-ai-agent-control-20261023.sql`**. Must be applied **after** `vetogram-ai-draft-grants-20261023.sql` and only after human authorization. It creates an owner-scoped drafting-control table, a metadata-only event journal and PostgreSQL triggers for grant issuance/revocation.
- `vetogram_ai_set_drafting_pause(owner,boolean)` is transaction-scoped. Pause flips the owner control flag, revokes any current drafting grant, and journals the change within a single PostgreSQL transaction. A BEFORE grant trigger checks the control row with `FOR UPDATE`, blocking newly issued grants while paused. A new issuance after resume still requires separate signed owner consent. The control is for *drafting only*: it does not disable ordinary user-confirmed Telegram sending.
- `/api/vetogram-ai-agent`: signed Telegram Mini App authorization on every request. `status` and `history` are read-only; `pause`/`resume` require explicit change consent. The audit query is limited to the latest 30 rows for the authenticated owner.
- Journal stores only event type, timestamp, owner ID, grant UUID and chat ID. No message content, prompts, generated AI replies, keys or Telegram sessions are stored. Retention/deletion policy must be approved before launch. Draft actions themselves are not logged in this phase.
- Mini App **Agent Control** UI has explicit pause/resume, status refresh and history; entries are rendered with `textContent` to avoid interpreting metadata as HTML.
- Added `tests/vetogram-ai-agent-control.test.js` covering event projection, no plaintext messages, owner's pause and revocation boundaries, code integration and request auth.
- Completed JavaScript parser inspection of the changed modules, 56 client DOM IDs checked, and basic deterministic event projection tests. Full Node test suite, SQL migration, concurrent pause/issue tests and real Telegram/Vercel Preview remain unverified.
- Vercel has a build-rate-limit blocker. This PR remains **draft**, and the production site and Neon DB were not modified.

### Release order and critical operations
1. Validate parent PRs #179 and #180, verify Neon v5 and current encryption keys.
2. Test all three AI migrations plus this fourth Agent Control migration on disposable Postgres, including concurrent issue/revoke/pause edge cases.
3. Review DB function permissions and logging retention; test signed-owner denial with separate Telegram accounts.
4. Establish provider billing caps and safe environment key rotation.
5. Execute full checks, build, mobile Telegram E2E and explicit owner approval before any merge or deployment.
