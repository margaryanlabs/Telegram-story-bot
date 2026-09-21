# Story Pilot

Telegram bot for publishing Stories through a connected Business account.

## Current production flow

1. User opens `@Storypilotlab_bot`.
2. First-time users see a dedicated connection screen instead of the Story controls.
3. User connects Story Pilot in **Telegram → Settings → Telegram Business / Chat Automation**, enables **Manage Stories**, then taps **I connected — check**.
4. Telegram sends the bot a unique `business_connection` for that user; Story Pilot validates that the connection is enabled and that `can_manage_stories` is granted.
5. User chooses a Story audience:
   - Everyone
   - My Contacts
   - Close Friends
   - Selected users
   - Optional exclusions
6. User sends a photo as a normal message.
7. Story Pilot prepares a 1080×1920 Story image without destructive cropping and publishes it for 24 hours.

No reply/forward workflow is required.

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
- The last published Story can be deleted from Story Pilot with the delete control or `/delete`.
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

- Each Telegram user gets their own Business Connection; accounts are never shared between users.
- Connection is a one-time setup unless the user disables the bot, revokes Story rights, or Telegram invalidates the connection.
- Disconnected users only see onboarding actions: connect, check connection, and how it works.
- A connected account without Story rights is shown as a separate recoverable state instead of being presented as fully connected.
- Successful Business Connection updates produce a fresh visible confirmation near the bottom of the chat.
