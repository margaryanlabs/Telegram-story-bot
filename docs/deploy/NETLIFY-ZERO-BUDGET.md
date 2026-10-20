# Zero-budget Netlify staging for Telegram Story Bot (NOT YET LIVE)

This branch adds a **draft** Netlify deployment target. No Telegram webhook, production domain, or existing Vercel project has been moved. Netlify Free is capped: 300 credits/month; production deploys consume 15 credits; compute, bandwidth and requests also consume credits. All projects pause at the limit. Keep auto-recharge off.

## How to stage safely

1. Create or connect a Netlify Free account and import the **public** GitHub repository `margaryanlabs/Telegram-story-bot`, selecting this branch. Set build command `npm run check`, publish directory `public`, functions directory `netlify/functions`; these are also in `netlify.toml`.
2. Configure required secrets in Netlify Site configuration → Environment variables, **not in git or chat**. Compare only variable **names** with the existing Vercel environment; ensure Telegram bot token, API ID/hash, encrypted-session keys, database connections, owner verification, and other dependencies are available. Existing paused Supabase endpoints will NOT work just by deploying the frontend.
3. Validate `/studio.html`, `/api/webhook-v8` GET and `/api/health`. Test authentication, Telegram session ownership, chat read/send, private media, Stories, Anti-Delete, webhooks and encrypted persistence using a dedicated test account. Check serverless limits for media/MTProto and any recurring background triggers. Do not claim production readiness based on UI alone.
4. Switch Telegram webhook and the Telegram Mini App URL only after passing smoke tests with actual backend and persistent storage. Set `STORY_PILOT_BASE_URL` to the tested custom domain on the new host. Preserve rollback to the original host. Do not delete old deployments or databases.

## Implementation

Existing Vercel Node-style `api/*.js` functions are exposed by 32 Netlify functions at the **same** `/api/<name>` URL paths. `netlify/lib/legacy-adapter.mjs` translates Fetch Request/Response into the limited legacy `req`/`res` interface, including JSON requests and binary responses. It is a compatibility bridge and still requires full end-to-end smoke tests. Some APIs may need native Netlify rewrites for timeouts, streaming or size limits.

Do not merge until a real Netlify preview build succeeds and the Telegram integration passes. Review bundle sizes and Free compute consumption before inviting users.
