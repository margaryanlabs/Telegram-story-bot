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


## Release hardening: atomic SQL grants + actual AI Memory deletion (23 Oct 2026)

**Changes in the existing draft PR only; no live database or deployment writes.**

### Critical Postgres concurrency fix
- Prior to this patch, grant issue used a direct INSERT/ON CONFLICT that locked the grant row first, then the BEFORE trigger acquired the control row. Concurrent pause acquired control first, then attempted to revoke the grant. This inverted lock order could cause deadlocks on concurrent issue/pause.
- Issue now calls `public.vetogram_ai_issue_draft_grant(...)` in one database transaction. That function and `public.vetogram_ai_set_drafting_pause(...)` acquire the SAME per-owner advisory transaction lock first, followed by the control row, followed by the grant row.
- Replacing a grant now writes TWO audit entries: revoke the superseded grant, then issue the replacement. The change is part of the database transaction.
- The SQL procedure is part of the **unapplied** fourth migration `migrations/vetogram-ai-agent-control-20261023.sql`. Draft grant issuing will fail closed until that migration has been installed and DB privileges reviewed.

### AI Memory erase semantics
- The previous UI “delete cloud copy” action wrote an empty encrypted snapshot; the database still retained an owner row. This was misleading.
- Added a new `erase` action to `/api/vetogram-ai-memory`, with signed owner auth, explicit memory consent, and compare-and-swap revision protection.
- The database operation is `DELETE FROM ... WHERE owner_id=$1 AND revision=$2 RETURNING owner_id`. A stale tab gets a 409 revision conflict; no other owner can be deleted.
- UI now invokes that action directly, requires confirmation, and retains local in-window notes exactly as disclosed. This deletes the VETOGRAM application table row, but cannot by itself guarantee immediate eradication from independent Neon point-in-time backups or external infrastructure snapshots. Retention / backup disclosures require approval.

### Automated static preflight
- Added `npm run ai:preflight`, backed by `scripts/vetogram-ai-release-gate.mjs` and pure `lib/vetogram-ai-release-gate.js`.
- Checks four additive migrations, consistent owner-lock order for grant/pause, grant replacement audit, owner auth, action consent, default-off backend feature flags, AI quota protection, and lack of direct Telegram sending tools in AI endpoints.
- Added mutation tests demonstrating that the preflight rejects missing migrations, broken lock ordering, and unsafe API capabilities.
- `npm run vercel-build` now runs the offline AI preflight BEFORE the existing syntax and Node test suite.
- The preflight **does not** parse or execute SQL against PostgreSQL, prove migrations safe on the real database, run Telegram E2E, or override Vercel build rate limiting. The migration procedure and tests still require a disposable Postgres instance, two-account QA and an authorized release process.

**Current state:** No production changes. PR #181 stays draft, based on Story Engine PR #180 and onboarding PR #179. All Neon migration files are staged but unapplied.


## 23 October CI expansion — separate Node and disposable PostgreSQL checks
- Added GitHub Actions workflow `.github/workflows/vetogram-ai-ci.yml` for the PR branch.
  **Node job:** lockfile npm install, `npm run vercel-build` (offline AI preflight,
  JS syntax, Node tests), with all AI flags forced OFF and no user secrets.
  **Database job:** temporary PostgreSQL 16 service with invented test data,
  four staged migrations, `scripts/vetogram-ai-postgres-smoke.sql` and
  `scripts/vetogram-ai-postgres-race.sh`.
- SQL smoke covers grant issue/replace/audit, emergency pause, blocked issue while
  paused, owner isolation, resume not reactivating old grants, owner daily quota
  rejection and version-aware AI Memory UPDATE/DELETE.
- Race script opens two separate sessions and deliberately holds a per-owner
  advisory lock while a second session executes emergency pause. It uses DB
  lock/statement timeouts; final invariant is no active grant after pause.
- The first GitHub Actions runs report `failure`, but connector job metadata
  contains **no step details**, and job log download returns BlobNotFound/404.
  Therefore no actual Node or PostgreSQL execution is claimed as PASS. This
  can indicate a run-infrastructure/billing issue but the exact reason remains
  **unconfirmed**. Do not mistake it for a passing migration or conclude from it
  that the SQL itself failed. Vercel still reports build-rate-limit.
- In-process checks via GitHub file retrieval + pure JavaScript execution:
  AI release structural migration/API gates PASS, wrong grant-lock mutation
  rejected, bounded negotiation cases PASS; source-level parser checks PASS.
  These do **not** replace the blocked GitHub Actions and runtime tests.
- Once GitHub Actions execution is available, inspect job steps/logs and repair
  failures before any migration, deployment, secret configuration or merge.
- No production database or Vercel environment changes were made in this step.


## Follow-up quality fixes — negotiating actual message wording and long prompts

- Hardened the Negotiator's visible-message price scanner to reject false structured quotes when the draft contains mismatching local-language pricing, including "450 долларов", "450$", "450 USD", reversed "USD 450", mixed currencies and ambiguous values. Multiple inconsistent offers fail closed. Explicitly reported amounts still require manual sender confirmation.
- New test cases include valid and invalid USD price forms in English and Russian. In-memory execution of 17 targeted JS parse / currency / oversized-prompt checks completed successfully. This is not a live AI/provider or PostgreSQL test.
- Updated prompt validation: requests over 3000 characters are **rejected** instead of silently truncated. This guards the end of a translation or negotiation from disappearing. The Telegram WebView presents the limit before sending, and regression tests verify this behavior.
- Verified the existing Vercel adapter has a configured `maxDuration` of 60 seconds, while the AI provider AbortController timeout is 17 seconds. No deployment timeout adjustments were needed.
- Tried an isolated `git clone` to run tests locally; local container DNS could not resolve github.com. Existing GitHub Actions jobs remained unsuccessful with unavailable detailed logs. Therefore full repo tests, live AI calls, browser E2E and PostgreSQL smoke remain **unverified**, and Vercel production was left unchanged.
- PR #181 remains draft. Parent Story Engine PR #180 and onboarding PR #179 are still required for release.


## Dialog paging and owner-chosen older chat — next continuation

- Previously the AI reply selector called `/api/telegram-chats` only for page zero (24 dialogs). Older live conversations were not selectable, including a chat that the owner explicitly opened before tapping "Reply with VETO AI."
- Now `loadChats` supports explicit incremental "Ещё чаты" buttons in both the Reply review panel and Negotiator Lab. A target selected by the owner in an already open Telegram thread can be sought across server-provided dialog pages, stopping once the exact owner-chosen numeric chat ID is located.
- Client page/recipient logic lives in testable pure `public/vetogram-ai-dialogs-core.js`; deduplicates ID rows and excludes archive-only, invalid, non-sendable or channel rows. Bounded to up to 11 pages (API maximum 500 dialogs), and DOES NOT automatically crawl all chats without an explicit sought recipient. Neither list previews nor full message content are transmitted to any LLM.
- Added `tests/vetogram-ai-dialogs.test.js` and a syntax check to `package.json`. UI buttons are hidden when no further page exists and share the owner-account request guard. An Approval Center draft for an older chat now resolves that recipient on demand before confirming send.
- Performed 14 targeted in-memory JS behavioral/parser checks for page limits, deduplication, sendable-type filtering, targets, HTML wiring and module syntax, all passed. This is not the full Node suite or Telegram E2E.
- Build remains blocked by Vercel build-rate-limit and unverified GitHub Actions jobs. No production DB, Telegram session, deployed app, or customer message was changed.


## Vercel GitHub status discrepancy (23 October continuation)
- Vercel project inspection used the explicitly intended second connected
  account, project `veto` under labsmargaryan. The latest PR #181 deployment
  `dpl_FaUHh1rWAxhPoEJDCtUqWBgThc9B` for
  `1aa24b29120fc1fef4601903e3133d058b7b4dfa` reports
  `CANCELED`, `target=null` and
  `https://vercel.com/docs/platform/projects#ignored-build-step` as errorLink.
  **It is not a ready Preview even though GitHub's Vercel commit status says success.**
- Connected Vercel project production listing shows a READY deployment at a
  different main/production commit `6504a387d2b88961df3689792cd1c6d4d0e68571`.
  The combined AI + Story Engine branch is therefore not publicly deployed.
- Check Ignored Build Step / project Git settings and build quotas in the intended
  Vercel account before requesting another Preview. This investigation
  inspected deployment metadata only, changed no Vercel configuration or domains.
- GitHub Actions workflow conclusion remains failure without accessible job steps.
  Real Node and disposable PostgreSQL test execution remain **unverified**.


## 23 Oct continuation — account isolation, full send confirmation, CI investigation
- **Fixed a real disclosure risk on Telegram account switch.** The controller
  previously cleared AI thread, approvals and Memory but left hidden recipient
  options in Negotiator and hidden Story Director / Portal text fields. Reset
  now clears every one of those hidden drafts, price/goal fields, quota banner,
  recipient selections, consent and pending send nonce; returns AI to Chat mode.
  Added regression test to prevent cross-owner UI state carry-over.
- **Fixed truncated send confirmation.** The native confirmation previously
  showed only the first 650 characters while sending up to 4096. It now passes
  the complete outgoing string to the confirmation; the editable review textbox
  retains the whole message. Native dialog rendering of very long text still
  requires Android/iOS QA, since WebView itself may truncate a modal visually.
  Added regression assertion ensuring the 650-character slice is absent.
- Connected GitHub REST returned two CI jobs concluding failure in ~3–4 seconds,
  with no runner assignment, no steps, and `billable.UBUNTU.total_ms=0`.
  Therefore these are **pre-execution runner/scheduling failures**, not a
  demonstrated Node assertion or PostgreSQL migration failure. CI must be
  enabled/runner access reviewed in GitHub organization/repository and billing
  before normal QA can be trusted.
- CI Node version adjusted from 20 to **24**, matching the connected Vercel
  project runtime. The adjustment has not been verified by a runner.
- Connected Vercel project `veto` on the SECOND user's account showed canceled
  branch previews linked to Ignored Build Step, while production's READY
  deployment is based on another earlier commit. No setting was modified
  and no build was triggered; changing skip-build behavior would potentially
  consume deployment quota.
- Vercel project's current `vercel.json` uses explicit legacy `builds`
  configuration. Vercel documents that Project Build & Development settings
  are ignored for legacy `builds`. Do not assume `vercel-build` is executed
  by Vercel itself: that script is expressly invoked by our GitHub Actions
  job, whose runners have not yet started. Release requires separate green
  Node/SQL test evidence.
- All four AI migrations remain unapplied and AI backend switches remain
  unconfigured/off; no new Preview, production, payment or Telegram send.


## Product development before one combined release: VETO AI Action

**Build-only milestone; no merge, Preview, live provider connection, database
migration, scheduled task or Telegram message has been executed.**

- Adds a seventh VETO AI mode: **AI Action**. The owner may ask
  "Напиши Артуру, что завтра созвонимся" in the normal AI chat or the dedicated
  AI Action tab; explicit messages beginning with /msg or /message also switch
  to reviewed drafting. Ordinary writing requests such as "Напиши мне текст"
  remain in chat. The new mode produces a structured JSON **draft_message**
  or a **clarify** question only.
- The AI provider never sees Telegram dialogs or MTProto recipient IDs.
  It produces only the owner-provided recipient-name hint and a draft message.
  Frontend `public/vetogram-ai-action-core.js` matches that hint locally
  against separately owner-verified Telegram dialog metadata. No contact
  selection is automatic; an owner must click **Использовать выбранный чат**.
- Duplicate names remain separate options, with chat ID displayed to aid
  disambiguation. Recipient change resets the approval. The final untruncated
  message still requires the existing independent user-confirmed
  `/api/telegram-send` action. Existing Approval Center may queue a confirmed
  draft but never schedule or send it in the background.
- A model output asking to send, publish, delete, transfer funds, or call tools
  is denied as an unsupported action; only `draft_message` and `clarify`
  pass server typed validation. Draft mode included in conservative AI
  quota reservation. No contacts are auto-read and no replies are auto-sent.
- Adds `tests/vetogram-ai-action.test.js` for strict parsing,
  no-action clarification, recipient matching, UI permission state, prohibited
  intents and quota. Updates AI core, budget, test expectations, UI and CSS.
- Targeted in-memory validation: explicit-command cases, JS parser,
  64 current AI DOM selectors, action draft and manual recipient logic passed.
  **Not verified:** actual LLM structured outputs, Android/iOS Telegram UX,
  full `npm test`, PostgreSQL integration or Vercel Preview.
- **Release batching agreement:** keep VETOGRAM NEXT development in this
  draft PR, finish modules, validate all parent dependencies, then perform one
  separately approved controlled deployment/migration/release. No partial
  publishing or intermediate main merge.


## Continued development — VETO Second Brain / evidence-backed commitments

- Added an eighth AI mode, `brief`, to the existing VETOGRAM AI screen. The owner may paste up to 3000 characters of permitted chat text or explicitly use **◈** in an open owner-linked Telegram thread to copy the latest visible incoming message into a **local draft** only. The chat entrypoint has separate user confirmation; the AI-provider request still requires separate `vtaiConsent` and deliberate submit. No automatic ingestion or background watch.
- Backend only accepts typed JSON with short summary and **up to five** candidate tasks (`task`, `followup`, `meeting`, `payment`). Each card must include a literal `sourceQuote` from the user-provided text. Any `deadlineText` must also appear verbatim in that source or the response is rejected; omitted dates are represented as `null`. This is model-generated candidate extraction, **not guaranteed factual verification**.
- Frontend renders source-linked cards with the quoted original text, explicit/unverified labels and plain-text DOM rendering. The owner can copy a candidate or explicitly confirm saving it as a **session-only** AI Memory note (subject to the existing eight-note cap). Cloud saving remains a separate user action. No scheduled reminders, Calendar access, negotiations, payments or outgoing Telegram messages occur.
- Added `tests/vetogram-ai-brief.test.js`: source-based quote/deadline enforcement, missing/evidence-free data, zero items, quota, local prefill and no autonomous model calls. Existing AI modes expectation updated to eight; conservative per-user and global usage estimator includes `brief`. Existing `/api/vetogram-ai` verifies each extracted quote against the already normalized, explicitly provided owner text.
- Targeted in-memory evaluation confirmed mode registration, accepted literal evidence, rejected fabricated deadline/quote, unsafe kind and fabricated certainty, and all 67 referenced AI DOM IDs. Syntax checks of changed source modules passed. **Full npm test suite, provider responses, disposable PostgreSQL, mobile Telegram WebView and Vercel Preview are not verified.**
- These changes stay in the draft PR #181. Per the owner's release decision, **do not merge, deploy, apply production migrations or change live env** until all VETOGRAM NEXT modules and prerequisite QA are complete; release in one controlled batch.


## Smart Inbox + Follow-up Focus — unified development, staged only

- Extended **the existing** Smart Inbox scoring (question/action hints, Telegram unread
  count) rather than inventing a parallel inbox or falsely claiming new unread
  state. The **Follow-up Focus** panel resides in the existing VETO AI screen.
- The owner explicitly loads dialog metadata through the existing owner-verified
  `/api/telegram-chats` flow. The API now marks `lastMessageOut` as true/false
  only when the last live message direction is known. It distinguishes
  `previewFromArchive` if a newer preserved copy was substituted for the live
  last-message preview.
- Pure testable `public/vetogram-followup-core.js` ranks up to eight candidates
  per view. It **rejects** unknown or outgoing direction, saved-only/archive
  previews, non-sendable chats, channels, zero unread count, and previews
  without existing server question/action signals. Labels are **possible**
  questions or deadlines, not established obligations.
- Each Focus card shows a short excerpt, an explainable reason and unread count
  from Telegram. Actions: manually prefill AI Reply, manually prefill Second
  Brain, or hide in the current WebView session. Both AI handoffs require a
  local-copy confirmation and reset third-party AI text consent before any
  provider call. A new Reply prefill invalidates the previous model answer and
  send nonce; no earlier prepared text can be sent accidentally.
- Hidden items and dialog metadata stay in session RAM, cleared on Telegram
  owner switch, with no follow-up worker, notifications, Telegram read-status
  changes, persistence or automatic messages. The UI can request additional
  chat pages explicitly within the existing bounded 500-dialog limit.
- Regression tests: `tests/vetogram-followup-focus.test.js`, including live
  direction, archived-copy exclusion, score sorting, cap, DOM controls, and
  explicit consent/reply reset. Syntax check added to `package.json`.
- Performed 12 targeted syntax/source/behavior checks, all passed in this run;
  **not** a full Node suite, live Telegram two-account E2E, mobile Preview,
  Neon migration or AI-provider QA. No production or deployment changes.
- Keep this in the same **draft PR #181** for the one coordinated VETOGRAM
  release after dependent Story Engine/onboarding work and complete QA.


## VETO Task Center — review-first tasks, no scheduling (continued development)

- Added **VETO Task Center** to the EXISTING VETO AI screen alongside
  Second Brain, Focus, Approval Center and Story Director.
- The user must explicitly confirm each candidate extracted by Second Brain
  before it becomes a task. Exact source quotes and literal relative deadline
  phrases are retained; the AI cannot turn "tomorrow" into a fabricated
  absolute calendar date.
- New pure module `public/vetogram-task-center-core.js` enforces:
  - owner-bound IDs and source evidence, valid task kind and UUID;
  - maximum 24 tasks per open WebView session;
  - prevention of duplicate title/source items;
  - allowed states: open / deferred / done;
  - only status and explicit ISO manual due date may be edited;
  - due/overdue display is based solely on a date manually chosen by owner.
- Task Center UI can filter by status; mark complete/deferred/reopen; choose
  exact due dates via `datetime-local`, clear those dates, individually
  delete tasks, copy the list with confirmation, and clear all.
- "Prepare follow-up" opens an editable **local AI Reply prompt**, clears
  previous send intent/AI output and earlier recipient, unchecks AI consent,
  and requires the owner to select a Telegram chat and separately approve
  any future send. No message is sent while managing tasks.
- Task state stays strictly in the authenticated owner's **current browser
  memory**. It is erased on account switch/closing WebView. This is
  explicitly disclosed; the cloud AI Memory store is a different product
  surface and is NOT silently synchronized.
- No background worker, notification schedule, Calendar, localStorage,
  server task table, Telegram sending, or billing is added in this milestone.
  A true reminder service would require explicit opt-in and independent
  server persistence/worker/notification tests and consent before release.
- Added `tests/vetogram-task-center.test.js`, responsive task-date controls
  and syntax check in `package.json`. 17/17 executed source/parser/pure
  behavior checks passed. Full Node test suite, Vercel Preview, Neon SQL,
  multi-device or Telegram WebView testing NOT completed.
- The combined PR remains **draft**, no intermediate deployment, main merge,
  Neon migration or change to Telegram production sessions. Release planned
  as one reviewed batch once all modules and QA are complete.


## Task Center 2.0 — opt-in encrypted cloud snapshots (still NOT DEPLOYED)

- Added the **fifth** staged additive SQL migration:
  `migrations/vetogram-task-cloud-20261023.sql`. It creates an owner-bound
  snapshot table with opaque ciphertext, integer revision and update time.
  The migration is NOT applied to live Neon and the new endpoint is OFF by
  default (`VETOGRAM_TASKS_CLOUD_ENABLED` must be explicitly set to true).
- Uses independent `VETOGRAM_TASKS_KEY` (64 hexadecimal digits, 32 random
  bytes, server-only), AES-256-GCM with randomized IV, authentication tag and
  per-owner AAD. Distinct encryption domain from session keys and AI Memory.
  The VETOGRAM backend holding this key can decrypt content; **NOT E2EE**.
  Do not reuse or expose Telegram-session or AI Memory encryption secrets.
- Owner authentication relies on signed Telegram Mini App initData; the client
  never selects the owner ID for database operations. Payload validation
  enforces 24-task cap, UUIDs, owner-bound content, source quotes, manual ISO
  due dates, allowed status and duplicated-task rejection.
- Client offers **manual** load, save and erase controls. Cloud revisions use
  optimistic compare-and-swap so a stale device cannot silently overwrite a
  newer saved snapshot; loading requires explicit confirmation if it replaces
  unsaved local tasks. Any subsequent local edits are NOT auto-synchronized.
- Cloud erase removes `encrypted_snapshot` from the active table and
  increments the revision; a **technical owner/revision tombstone** remains to
  block stale restoration. Backups and retained infrastructure snapshots may
  preserve encrypted historical versions until their retention expires.
  "Erase" never deletes local in-window tasks and has a separate confirmation.
- No task worker, actual reminders, Telegram sends, app notifications, contact
  scanning, automatic AI ingestion or payment integration added.
- Added `tests/vetogram-task-cloud.test.js`; wired a fifth migration into
  static release preflight, CI disposable Postgres migration order and
  compare-and-swap/tombstone smoke, and registered `/api/vetogram-tasks`
  through the existing Vercel Hobby API router. No new Vercel Function.
- Verified 16 source/parser/DOM/release-contract checks and 12 pure validation
  behavioral checks in the authoring environment. Full Node tests, live AES
  test runtime, disposable Postgres, end-to-end Telegram/Vercel remain
  unverified due to existing external CI runner/Preview issues.
- **Release order:** apply parent Story and AI migrations only after separate
  approval, apply fifth task migration, configure distinct production key and
  retention policy, enable opt-in feature flag, run all unit/API/Postgres/mobile
  checks, then one controlled batch release. None of those live operations
  were performed.


## VETO Reminders — opt-in one-shot self-notifications, UNRELEASED (24 Oct)

- Added SIXTH staged migration `migrations/vetogram-reminders-20261024.sql`
  (not applied). It stores ONLY reminder metadata: Telegram owner ID, task
  UUID, exact UTC trigger/due time, owner's IANA timezone, consented/pending
  state and one delivery-attempt token. NO task title, source quote, chat text,
  LLM messages, session keys or alternate recipients in the queue.
- New `/api/vetogram-reminders` (same Vercel router/function) provides
  owner-authenticated list, schedule and pending-only cancellation. Creation and
  cancellation require `x-vetogram-reminder-consent: yes`; the client asks the
  owner before **each** action. Scheduling validates that the same signed owner
  has previously saved an active task with manually chosen cloud due time.
  Time must be at least two minutes ahead, at most 365 days ahead, <= task due
  and have a valid IANA time zone. Up to 24 pending reminders per owner.
- Task UI supports `0/15/60/1440` minutes before the owner's selected due
  date; reminders screen shows latest metadata and permits canceling only
  pending jobs. Updates to tasks are NOT automatically synchronized; if the
  encrypted cloud task was deleted/completed/changed or its due time changed,
  the worker skips it when due. UI prompts first to open/start the Telegram
  bot, since Telegram Bot API cannot initiate conversations with users.
- New `/api/vetogram-reminder-worker` requires the existing
  `neonCronAuthorized` server-only bearer verifier (Neon cron enabled) and
  **two default-off flags**:
  `VETOGRAM_REMINDERS_ENABLED=true` and
  `VETOGRAM_REMINDERS_WORKER_ENABLED=true`. No scheduled invocation or Vercel
  cron was configured. No live notifications were sent.
- Worker sends ONLY generic self-notification (no private details). SQL
  `FOR UPDATE SKIP LOCKED` atomically changes pending -> claimed and sets
  immutable attempt UUID *before* the Bot API request. Delivery result is
  marked sent/failed/skipped once. It is at-most-one-attempt, NOT guaranteed
  exactly-once delivery. Uncertain network outcomes are never retried
  automatically to prevent duplicate messages; delivery can be missed.
  Pending jobs > 24h late become skipped. Cancellation after claim cannot
  guarantee prevention of send. Owners should be warned accordingly.
- Sixth migration and new runtime checks added to the offline release
  preflight, disposable PostgreSQL smoke, CI migration order, Node syntax
  checks; regression test `tests/vetogram-reminders.test.js` validates
  time zone/range, owner consent, active task check, atomic claims, no plain
  message text and client cancellation.
- Current source-only validation passed: six-migration static preflight and
  all new reminder-specific API/worker contracts, reminder pure-function
  behavior, JS parser checks and DOM bindings. The full Node suite, actual
  SQL execution/concurrency, Telegram Bot API, timezone UI in WebView,
  worker scheduler availability and true delivery guarantees remain
  **UNVERIFIED** until the final release QA.
- No changes to `main`, production Vercel settings/domains, live Neon, or
  real Telegram conversations. **Do not** enable reminder worker flags or
  schedule cron before isolated delivery testing, a Bot API consent/bot-start
  flow, user-facing retention terms and explicit combined release approval.


## Reminders control hardening — pending cancellation and Hobby schedule limits

- This branch already contains VETO Reminders from the coordinated development
  stream: signed Telegram owner API, optional worker, metadata-only queue,
  time-zone checked one-shot reminders, separate consent, at-most-once
  network attempt, generic Bot API self-notification, and user cancellation.
  The new work did **not** duplicate those existing modules.
- Added a single explicit owner-only action `cancel_all` to cancel **every
  pending** reminder with one atomic SQL update. Both owner signed initData
  and the existing `x-vetogram-reminder-consent: yes` are required.
  Worker-claimed or completed attempts are not retroactively canceled,
  and the API response explicitly reports `claimedMayStillSend:true`.
- UI includes **Отменить все ожидающие**, warns clearly that in-flight
  sends may continue, and refreshes the owner-scoped list after success.
  Task cards disclose outstanding server-side reminders even after locally
  changing their due date or status; local edits alone do not cancel a
  previously saved server reminder.
- Added signed-API and client regression assertions and disposable-Postgres
  owner-isolation checks for cancel-all (other owners and already-sent
  reminders remain untouched). Source/parser/DOM assertions were checked
  locally; CI full Node/Postgres runner execution remains unverified.
- Official Vercel Cron documentation (2026) says Hobby cron runs at most
  **once per day** and may execute anywhere in the hour. Therefore the
  current Hobby project cannot truthfully promise a reminder exactly
  15 minutes before a meeting without an independent reliable scheduling
  worker such as the planned VPS / external scheduler. A dedicated
  authenticated scheduler with operational logging and clock accuracy
  checks is a release dependency. No cron was activated or deployed here.
  See https://vercel.com/docs/cron-jobs/usage-and-pricing
- Telegram Bot API delivery to private accounts requires that the person
  has already initiated the bot conversation; otherwise a generic
  `sendMessage` may receive a forbidden error. No bot notifications
  were actually sent during this work.
- Feature flags remain OFF; no production DB, keys, bot sessions,
  main-branch merge or deployment were changed in this stage.
