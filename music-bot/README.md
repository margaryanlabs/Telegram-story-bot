# Vetogram Music — dedicated personal Telegram music bot

**Status:** Code implemented in the separate Vetogram Music branch, **not deployed**. A new bot identity and secrets are required; existing VETOGRAM messaging bot and production are unchanged.

**Architecture decision:** choose **opt-in personal bot-scoped `file_id` reuse** over a hidden pirated Telegram channel or unofficial protected VK/Yandex stream extractors.

## What is implemented
- `server.mjs` receives only **private audio sent by its real chat owner**, via Telegram webhook with `X-Telegram-Bot-Api-Secret-Token`. MP3/M4A replies use Telegram `sendAudio` with the same bot-scoped `file_id`, so Telegram clients can use the native music player.
- `library.mjs` stores **only metadata and bot-scoped file IDs**, no music bytes, no VK/Yandex credentials. Per-user JSON libraries under a private persistent directory, atomic rename, mode 0600 files, serialised writes, maximum 300 recordings per user. Existing `file_unique_id` recordings are deduplicated.
- Bot commands: `/start`, `/help`, `/list` (pages up to 20), `/play 1`, `/search название`, `/delete 1`. Numbering is relative to current user library; uploading new tracks changes positions. Deleting removes **our library metadata only**, not Telegram messages/files.
- Protects against cross-user access: messages must be in a private chat where `message.chat.id===message.from.id`. Other chats and bot senders ignored. Webhook body limited to 128 KiB; outbound API calls have timeouts, no secrets or user data logged.
- Dockerfile and Compose: unprivileged Node 24, private persistent named volume, read-only root filesystem, only localhost port 8787 exposed, no cap privileges. Connect to your existing HTTPS reverse proxy; nothing is billed until separately hosted.
- `set-webhook.mjs` registers only a HTTPS endpoint with Telegram `allowed_updates: ["message"]` and secret; it does not print secrets.

## Deploy when a separate bot is available
1. Create a **new** bot with @BotFather (do not use the VETOGRAM messaging bot token).
2. Provision an HTTPS hostname and proxy `/telegram/music-webhook` to `127.0.0.1:8787`; the bot backend MUST have a durable filesystem at `/data`. No Vercel serverless storage.
3. From repository root on the private VPS, prepare environment (do not commit `.env`):
   ```sh
   cp music-bot/.env.example music-bot/.env
   chmod 600 music-bot/.env
   # Edit the three VETOGRAM_MUSIC_* settings in the local .env.
   docker compose --env-file music-bot/.env -f music-bot/compose.yaml up -d --build
   ```
4. Verify `curl -fsS http://127.0.0.1:8787/health`. Then use Node 24 with the three same secret environment variables to run `node music-bot/set-webhook.mjs`. It registers the public HTTPS webhook with Telegram. Do not pass bot token in a command-line argument or send it in chat.
5. Test via bot's private chat: `/start`, send a permitted MP3, `/list`, `/search`, `/play 1`, `/delete 1`. Test headphone controls, screen lock and background behavior on both Android and iPhone.

## Security and production caveats
- Only a bot receiving the file can reuse its own `file_id`. IDs from a different bot are not transferable; this approach is **not** converting `file_id` into a public playable URL for a Mini App.
- If the Mini App must stream such a private recording **inside its HTML5 player**, it needs a separate verified user authorization, server-side `getFile` / private media proxy, access controls and a short-lived session. **Bot API downloads have a 20 MB limit**; Telegram's separately hosted Local Bot API Server can remove that specific download limit. Never put a bot token or file path URL in browser source. No such proxy is implemented in this branch.
- Bot code resends user-selected files privately through the native Telegram audio player. Native player behavior can often outlast the Mini App WebView; actual Android/iOS behavior needs device tests. It is NOT a guarantee of continuous playback from an HTML Mini App background tab.
- In-memory processed update IDs make webhook re-delivery mostly idempotent during one process lifetime, and audio duplicates are deduplicated in storage. Multi-replica production needs durable update-idempotency and a database rather than filesystem JSON. Back up the mounted data volume and define retention/deletion policy.
- Respect file rights and Telegram rules. A hidden channel full of unlicensed recordings does not turn protected tracks into legal public streams.
- **VK/Yandex wrappers:** may retrieve metadata or work for an authenticated user; not a stable, authorized mass-music backend. This implementation neither scrapes gated catalogs nor bypasses captcha, logins or DRM.

Official references:
- https://core.telegram.org/bots/api#sendaudio
- https://core.telegram.org/bots/api#sending-files
- https://core.telegram.org/bots/api#getfile
- https://core.telegram.org/bots/webapps

## Tests
- Existing: `tests/vetogram-music-bot.test.mjs`
- Added: `tests/vetogram-music-library.test.mjs`
- Run locally from repository root with Node 24: `node --test tests/vetogram-music-bot.test.mjs tests/vetogram-music-library.test.mjs`
- A JavaScript-isolate smoke test of the updated bot command dispatcher passed checks for private upload, user-scoped list/search/play/delete, cross-user and impersonated-sender rejection; the full Node test runner is not available through the GitHub connector in this session.

**Music-only public frontend** (unchanged by the bot backend): https://vetogram-music-live.vercel.app/
