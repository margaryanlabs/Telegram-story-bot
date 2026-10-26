# VETOGRAM 5.0 — module and privacy audit

2026-10-26. Existing application and API; no real account messages, storage mutation, provider spending, or infrastructure replacement performed by this audit.

## Concrete fixes

1. `public/telegram-chats.js` contained an unconditional recursive `closeStickerDrawer()` call. Owner reset and successful media cleanup both called it. It could terminate the flow with `RangeError` and display failure after Telegram had already accepted a media send. The function now closes the actual drawer and invalidates pending sticker requests. An executed real-function regression calls it repeatedly and checks termination and state.
2. Native MP4 video and audio file sending now builds real MTProto `DocumentAttributeVideo` / non-voice `DocumentAttributeAudio`, rather than forcing every selected file into a generic document. Video dimensions and duration are read locally after deliberate Send; MIME/container, metadata, and the existing 2 MiB limit are checked before upload. PDF and other document sends retain `forceFile`. This is implemented and tested using real installed constructors, **not yet verified against Telegram with a real account**. Browser codec support can reject an unreadable file. Streaming readiness is not invented.
3. Media parsing/file reads now capture the current thread generation as well as signed owner and chat. A→B→A navigation cannot revive an old send; a late `finally` cannot unlock a newer send. Uncertain retries preserve the same nonce only for the identical file, media kind, recipient, caption, reply and sticker intent. No automatic retry.
4. Success now requires a direct outgoing message ID or Telegram's exact `random_id` mapping. An unrelated `UpdateNewMessage` in an update bundle no longer becomes a false acknowledgement. Missing correlation returns a 502 **uncertain** outcome through the API; the owner must check Telegram before deliberately retrying.
5. Neon media reads, upload signing/finalization and recovery queues enforce retention **at read time**. Previously a known chat/message ID could retrieve an expired Bot API file reference or signed vault URL until cleanup ran. Edit-history queries now require a retained parent with the same owner/chat/message. No data was deleted; asynchronous cleanup remains necessary for physical deletion. Signed URLs issued earlier remain valid until their short expiry.
6. Invalid history timestamps are rejected without aborting the batch. OpenAI Responses calls now explicitly set `store:false`; VETOGRAM supplies history itself. This disables retrievable Response storage, **not a claim of Zero Data Retention or absence of provider abuse-monitoring retention**.

## Source-backed architecture and actual limitations

| Module | Implemented path | Current validation / limit |
| --- | --- | --- |
| Chats | signed Mini App → encrypted owner session → live `getMe` owner check → MTProto dialogs/history | Partial; unit/controller tests pass, real account read/send/receive remains unverified. First 24 dialogs, pagination up to 500; 35 messages/page. |
| Incoming updates | owner-verified short polling of the open thread | Partial; latest 28-message window, no continuous serverless socket and no promise of native Telegram push parity. |
| Sending | owner dialog recheck, stable nonce → `messages.SendMessage` / `SendMedia` | Text, photo, documents, voice, native MP4/audio and server-resolved stickers implemented. 2 MiB raw upload limit. Acceptance is distinct from delivered/read. |
| Chat media | owner-verified live media proxy | Up to 4 MiB photos/attachments; larger media remains unavailable here. |
| Stories viewing | read-only allowlist `GetAllStories` / `GetStoriesByID`, owner verified media download | Active real contacts only; self/channels excluded. Up to 6 pages and 4 MiB/media; larger video receives 413. Real photo/video E2E outstanding. |
| Ghost policy | no `ReadStories` / `IncrementStoryViews` writes | A description of VETOGRAM's request policy; **not a guarantee of anonymity from Telegram**. |
| Story editor | local editor/drafts/export independent of Business | Editor can operate without archive permissions; publishing/viewer availability still depends on Telegram rights and the actual transport. |
| Vault / Anti-Delete | explicit privacy settings, Business events → owner archive → timeline, independent private S3 objects | Partial; read-time retention repaired. No full real receive→persist→delete→display proof in this audit. A toggle is not saved-deletion evidence. |
| Voice Studio | browser microphone/local processing and deliberate preview/send | Independent of Business; real physical WebView microphone/codec check outstanding. |
| AI | explicit content consent → durable global + owner reservation → Gemini or OpenAI → draft | Blocked without enabled provider and working quota procedure. Never sends/publishes by this endpoint. Real provider request not performed. |
| AI grants | Neon stored grant, expiry/revocation and post-generation policy recheck | Negotiator approval-only. Grant never grants arbitrary autonomous send privileges. |
| Backup / Automations | opt-in queues and separately gated workers | Scheduler and actual event delivery must be verified; stored queue/configuration is not completed execution. |
| Viewer Analytics / Emoji / Relay / Settings | existing independent routes preserved | No live success certified by this module audit; release matrix must retain external-dependency states. |

Telegram personal-session operations do not require Telegram Business. Archive-only reads do not create an MTProto connection. AI provider failure cannot disable the editor, Voice, chats or existing archive reads. No Railway dependency was added.

## Secrets and configuration required from the owner

Use protected environment configuration only; never paste values in chat or logs.

- Existing bot and personal-session integration: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`.
- Existing Neon provider: `VETO_STORAGE_PROVIDER=neon`, `VETO_NEON_DATABASE_URL`, **the original existing** `VETO_NEON_SESSION_KEY`. Do not rotate that key casually: saved sessions require it.
- Existing private media bucket: `AWS_ENDPOINT_URL_S3`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`; server validates Neon S3 endpoint and owner-scoped paths.
- One AI secret: `VETOGRAM_GEMINI_API_KEY` **or** `VETOGRAM_OPENAI_API_KEY`; OpenAI model optionally `VETOGRAM_OPENAI_MODEL`.
- AI flags after secure quota preflight: `VETOGRAM_AI_ENABLED=true`, `VETOGRAM_AI_QUOTA_READY=true`; existing durable `public.vetogram_ai_reserve_budget` procedure required. Limits: `VETOGRAM_AI_DAILY_REQUEST_LIMIT`, `VETOGRAM_AI_DAILY_OWNER_UNITS`, `VETOGRAM_AI_DAILY_GLOBAL_UNITS`.
- Defaults are 8 requests/owner/day, 80,000 owner units/day and 1,000,000 global units/day. Units conservatively count UTF-8 context bytes + bounded output allowance; **they are not billed tokens or a dollar cap**. Provider-side spending limits remain necessary.
- Optional independent AI cloud features retain their separate secrets/flags (`VETOGRAM_AI_MEMORY_KEY`, `VETOGRAM_TASKS_KEY`, memory/grants/task/reminder flags). Never enable every worker merely to make chat login succeed.
- Maintenance requires `VETO_NEON_CRON_ENABLED=true` and a protected `CRON_SECRET`, plus a real scheduler. A configured flag does not prove the scheduler runs.

## Validation

New executable suites: `vetogram-v5-media-send`, `vetogram-v5-retention-boundaries`, `vetogram-v5-ai-provider-privacy`. They run the actual controllers/helpers with controlled Telegram/provider/SQL boundaries; no actual send or provider charge occurs. Related send, media retry, quota, readiness, idempotency and retention suites were rerun. Root release work records the complete build/test totals separately.

Outstanding: authorized two-account Telegram E2E, physical Android/Fold/iPhone checks, real small photo/video/audio receive/send, >4 MiB error handling, real Business edit/delete retention cycle, secure database/S3 preflight, one permitted AI-provider call, scheduler run evidence and provider cost monitoring. Commercial readiness is **not established** by these deterministic tests.

Primary references checked during this audit:

- https://core.telegram.org/constructor/documentAttributeVideo
- https://core.telegram.org/constructor/documentAttributeAudio
- https://core.telegram.org/constructor/inputMediaUploadedDocument
- https://developers.openai.com/api/docs/guides/your-data
- https://developers.openai.com/api/reference/resources/responses/methods/create
