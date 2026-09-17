# Telegram Story Bot — POC

A minimal proof-of-concept for testing Telegram Bot API `postStory` through a Business Connection.

## What it tests

1. User connects the bot as a Telegram Business bot with `Manage Stories` permission.
2. Bot receives the `business_connection` update.
3. Bot sends a special reply target containing the connection ID.
4. User replies to that message with a photo.
5. The bot crops/resizes the photo to 1080×1920 and calls the official `postStory` API.
6. The bot reports Telegram's real server response, including `PREMIUM_ACCOUNT_REQUIRED` if Telegram rejects the account.

## Required environment variable

- `TELEGRAM_BOT_TOKEN` — token from @BotFather. Never commit it to GitHub.

## Deploy

Deploy the repo to Vercel, add `TELEGRAM_BOT_TOKEN` for Production, then open:

`https://YOUR-PROJECT.vercel.app/api/setup`

The setup endpoint registers the Telegram webhook and bot commands.

## Test

- Open the bot and send `/start`.
- Connect it in Telegram Business / Chatbots with Manage Stories enabled.
- Reply to the bot's `STORY_CONNECTION:...` message with a photo.
- Check the bot response and your Telegram profile.
