# VETO Telegram

**Private Telegram OS for Stories, Chats, Privacy, Intelligence and Automations.**

VETO Telegram combines privacy, Stories, audience intelligence, creation, security and automations around a connected Telegram account.


## Product positioning

**VETO Telegram** is the product: a private control layer for Telegram that brings together:

- **Ghost Privacy** — Anti-Delete, Edit History, Ghost Inbox, Media Vault and retention controls.
- **Stories** — direct publishing, precise audiences, exclusions and content protection.
- **Creator Studio** — custom emoji, sticker packs and brand assets from a prompt or uploaded logo.
- **Intelligence** — Viewer Sync, audience patterns, reactions and analytics.
- **Chats / Event Vault** — the durable event and message archive that powers Ghost workflows.
- **Security** — connection state, private-session visibility, access checks and revocation controls.
- **Automations** — owner-only signals and alerts triggered by normalized Ghost events.

The product must feel like one private Telegram operating layer, not a collection of unrelated bots or utilities.

## Brand architecture

- **VETO Telegram** — the only user-facing product name.
- **Private Telegram OS** — the category / positioning line, not a second brand.
- **VETO Privacy**, **VETO Stories**, **VETO Intelligence**, **VETO Studio**, **VETO Security** and **VETO Automations** — product modules.
- **Ghost** remains a legacy/internal privacy concept where required for backward compatibility; new user-facing copy should prefer VETO Privacy.
- Legacy technical identifiers such as `STORY_PILOT_BASE_URL`, migration filenames and `storypilot:` callback payloads remain supported for backward compatibility and must not leak into user-facing copy.

## Creator Studio

The Mini App now includes **Ghost Creator Studio**.

Working v1 flow:

1. Open Studio inside the Telegram Mini App.
2. Choose **Custom Emoji** or **Sticker Pack**.
3. Either upload PNG/JPG/WEBP/Telegram-compatible WEBM, or generate a static asset by prompt when `OPENAI_API_KEY` is configured.
4. Ghost Studio normalizes static assets automatically (100×100 for custom emoji, 512×512 for stickers).
5. The backend uploads the asset through the Telegram Bot API and creates a user-owned pack.
6. The returned Telegram deep link opens the new pack immediately.
7. Additional assets can be appended to the same pack from the Studio.

Optional Creator Studio environment:

- `OPENAI_API_KEY` — enables prompt-to-image generation.
- `OPENAI_IMAGE_MODEL` — optional override; defaults to `gpt-image-2.5-flare`.

Animated v1 accepts already Telegram-compatible VP9/WEBM input. Motion generation is intentionally separated from static AI generation so the product never pretends a non-compliant animation is publishable.


### Brand Pack Engine

Creator Studio also includes **Brand Pack Engine**, designed around the product flow:

`one logo -> 6/8/12 consistent assets -> optional motion -> one Telegram pack`

- Works from an uploaded PNG/JPG/WEBP even when AI generation is not configured.
- Removes neutral near-white backgrounds from common logo exports.
- Detects a likely brand accent from the logo and uses it across the pack.
- Generates consistent semantic variants such as Core, Done, Private, Watch, Priority, Focus, Growth, Spark, Shield, Message, Celebrate and Premium.
- Publishes the whole selected set in one Telegram sticker/custom-emoji pack.
- The Mini App can encode simple VP9/WebM motion presets locally when the Telegram WebView exposes MediaRecorder + VP9 support.
- Static output remains the deterministic fallback if local motion encoding is unavailable.

## Current production flow

1. User opens `@Storypilotlab_bot` and launches **VETO Telegram**.
2. First-time users see the VETO onboarding and press **Connect Telegram**.
3. Recommended path: connect the user's normal Telegram account through **QR** or **phone + Telegram code**. The resulting user session is stored encrypted server-side.
4. The connected user session is the primary path for owner Stories and Intelligence. It does not require Telegram Business.
5. **Telegram Business is optional** and exists for server-side message event features such as Anti-Delete, Edit History and Smart Inbox.
6. User chooses a Story audience:
   - Everyone
   - My Contacts
   - Close Friends
   - Selected users
   - Optional exclusions
7. VETO Telegram prepares a 1080×1920 Story image without destructive cropping, publishes it for 24 hours and verifies the requested privacy audience.

The product must not make Telegram Business a blocker for a regular user's first connection.

## v8 UX and reliability improvements

- The native Telegram user picker is kept only for the actual contact selection step.
- Picker prompt / shared-user service messages are removed after the selection is processed, keeping the chat clean.
- Sending a photo now creates visible near-photo progress (`⏳ Публикую Story…`) and a local success/failure confirmation, so the user does not need to scroll back to the main panel.
- Duplicate webhook deliveries are suppressed before publishing, so the same Telegram message should not create duplicate Stories.
- MTProto Story publishing uses a deterministic `random_id` derived from the Business Connection + Telegram message ID for extra idempotency.
- `/status` validates the saved Business Connection live and clears stale connections automatically.
- JPG, PNG and WEBP sent as image documents are accepted in addition to normal Telegram photos.
- `/reset` clears audience / selected users / exclusions while preserving the Business Connection.
- Story limit and privacy errors are translated into short user-facing messages.
- `🛡 Protection` can prevent forwards/saving where Telegram supports it.
- The last published Story can be deleted from VETO Telegram with the delete control or `/delete`.
- The persistent `🚀 Start` Web App closes immediately and exists only as a lightweight launcher/state carrier.
- v8 performs the Telegram webhook secret verification before any Telegram-side UX action.

## Privacy modes

The standard path uses Telegram Bot API `postStory`.

Granular Story privacy uses MTProto `stories.sendStory` with `privacy_rules`. The bot uses the connected business account as the Story peer.

The native Telegram user picker is used for Selected / Excluded users. Telegram only exposes usernames for some selected users; users without an available `@username` currently require manual username input for automated MTProto privacy rules.

## Environment variables

- `TELEGRAM_BOT_TOKEN` — BotFather token
- `TELEGRAM_API_ID` — app API ID from `my.telegram.org`
- `TELEGRAM_API_HASH` — app API hash from `my.telegram.org`
- `STORY_PILOT_BASE_URL` — optional canonical production base URL override

Never commit secrets to GitHub.

## Production endpoints

- `/api/setup` — idempotently registers the current webhook and bot metadata
- `/api/webhook-v8` — current Telegram webhook
- `/api/health` — safe production health check

## Deploy

Deploy to Vercel with the environment variables above, then call:

`https://YOUR-PROJECT.vercel.app/api/setup`

The setup endpoint registers `/api/webhook-v8` and bot commands.

## Operational notes

- Webhook requests are verified with Telegram's secret-token header.
- Bot responses are silent where possible.
- Audience settings are isolated per Telegram private chat.
- The bot checks Business Connection status before publishing.
- MTProto publishing calls `stories.canSendStory` before upload to surface Story limits early.
- Telegram may still return server-side limits such as `PREMIUM_ACCOUNT_REQUIRED`, `STORIES_TOO_MUCH`, weekly/monthly Story limits, or flood limits.

## Connection onboarding

- The default connection is **Account Link**: QR first, phone/code fallback.
- Each Telegram user gets their own encrypted user session; accounts and sessions are never shared between users.
- Telegram Business is a separate optional connection for Privacy message-event features.
- A Business connection without Story rights must never block an already-connected Account Link.
- The Mini App displays Account Link, Story readiness, Business access, Privacy access and encryption as separate statuses.
- Successful connection must immediately refresh Mini App state so the user sees the account as ready without reopening the app.


## Mini App

The persistent **🚀 Старт** menu now opens a full Telegram Mini App instead of immediately closing back to chat.

- Authenticates requests with Telegram Web App `initData`.
- Shows secure Account Link, Business permissions and Story readiness as separate states.
- Lets the user change Story audience and content protection without leaving the Mini App.
- Shows selected/excluded user counts and hands off to Telegram's native picker when those lists need editing.
- Can delete the last Story from the dashboard.
- Keeps the primary publish flow simple: configure in Mini App, close it, then send a photo to the bot chat.
- Uses safe-area insets for Android/iOS but intentionally forces the VETO dark visual system instead of inheriting Telegram's light theme.


## Viewer Sync

VETO Telegram includes a privacy-aware Viewer Sync foundation for analytics on the account owner's own Stories.

### Flow

`Story publish -> user MTProto session -> watcher -> generic view alert -> reconciliation -> confirmed viewer OR anonymized view`

A new visible view can trigger a fast generic notification. Viewer identity is only promoted to a confirmed viewer after the reconciliation window. If Telegram later stops exposing that viewer, VETO Telegram edits the notification to an unattributed view and removes the stored identity instead of preserving a hidden identity.

### Required production configuration

Viewer Sync uses the existing server-only `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`, and `TELEGRAM_BOT_TOKEN` values.

The shared Margaryan Labs Supabase project is the storage target. Vercel does not need a Supabase service-role key: requests to the server-only Supabase Edge storage gateway are signed with Ed25519 using key material derived at runtime from existing Telegram secrets. A separate `VIEWER_SYNC_MASTER_KEY` remains optional; if it is absent, VETO Telegram derives the encryption key from the existing server-only Telegram secrets without persisting the derived key.

Optional tuning:

- `VIEWER_RECONCILE_SECONDS` — default 360 seconds
- `VIEWER_WATCH_OWNER_LIMIT` — default 4 accounts per run
- `VIEWER_WATCH_STORY_LIMIT` — default 4 Stories per account per run
- `VIEWER_WATCH_HOURS` — default 72 hours

Apply `supabase/migrations/20260921_story_pilot_viewer_sync.sql` to a dedicated VETO Telegram database. Viewer tables are server-only: RLS is enabled and no client policies are granted.

Supabase `pg_cron` calls the `story-pilot-watch-trigger` Edge Function every minute. The trigger signs the request to `/api/viewer-watch`, so no Vercel cron secret is required. The watcher is protected by short-lived Ed25519 signatures and a database lease to avoid overlapping runs.

### Session security

Telegram login codes and 2FA passwords are not persisted. The MTProto StringSession is encrypted with AES-256-GCM using `VIEWER_SYNC_MASTER_KEY` before storage. Disconnecting Viewer Sync attempts to log out the Telegram user session and removes the stored session.
