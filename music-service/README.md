# Vetogram Music Gateway · first backend block

A separate, dependency-free Node 20+ API project scoped to `music-service/`. It exposes ONE browser-facing catalog interface; video and messenger features are not involved.

## Endpoints

| GET path | Action | Result |
| --- | --- | --- |
| `/api/music?action=health` | health | Service health, no upstream fetch |
| `/api/music?action=providers` | providers | Honest provider capabilities and unavailable commercial streaming providers |
| `/api/music?action=search&q=Armenian%20music` | search | Normalized Audius tracks with permissible provider stream endpoints |
| `/api/music?action=charts&period=week&genre=Electronic` | charts | Audius ranking with period/genre |
| `/api/music?action=radio&q=Yerevan` | radio | Supported HTTPS Radio Browser station metadata and source streams |

Response schema: `{ ok:true, provider:"audius", type:"search", items:[{id,source,title,artist,artwork,permalink,stream_url,playable}], count, checked_at }`. Failed responses return `{ok:false,error}` with a non-200 HTTP status.

The API does **not** relay protected music files. Audius streams are served by Audius; broadcaster streams are served by broadcasters. User-provided local and M3U music stays in the existing client-only Vetogram Music library.

## Current source status

- **Audius:** real search, trending charts, provider stream URLs. Gated/deleted/unlisted entries filtered.
- **Radio Browser:** real station search with limited, broadcaster-hosted stream URLs. HTTPS/non-HLS filtering.
- **VK / Yandex:** metadata-only user playlist imports remain in the frontend. We do not treat unofficial tokens, captcha bypass, DRM circumvention or downloaded paywalled URLs as a stable public source. Future rights-cleared partner adapters can use the same response schema.

## Operational safeguards

- Public read-only GET/OPTIONS requests; precise allowed browser origins. Input length and genre/period whitelist.
- Upstream 9-second cancellation, response cap 2 MB, 90-second per-instance metadata cache, 50 request/min per-instance best-effort throttle.
- Do not deploy as a public, unmetered relay for arbitrary file URLs. For real scale, add edge-level shared throttling, health monitoring, observability, provider quotas and client integration tests.
- Never put Telegram BOT_TOKEN, VK/Yandex credentials or session cookies in the browser.
- Default code does not contain a provider account token.

## Deployment and existing site

Vercel project: `vetogram-music-api`. First backend build `dpl_ARPhpEdVVeVNCX1REd8rKTsZNLSo` got **READY**.

**Launch blocker:** the new Vercel project was auto-protected by deployment authentication and updating that security setting was rejected by tooling. Its `https://vetogram-music-api.vercel.app/api/music` endpoint must **not** be described as publicly accessible until the project owner reviews deployment protection and verifies requests. A standalone client adapter exists as `public/vetogram-music-gateway.js`, but inserting its script into the existing Music HTML and routing existing player/search through it was blocked by the GitHub write tool. As a result the public music frontend continues its established direct Audius and Radio Browser integration. Do not claim the new API is already wired.

## Verify locally

```sh
cd music-service
node --test tests/*.test.mjs
```

The tests use built-in Node modules and fake responses; no protected tracks or provider accounts are needed. A full end-to-end Telegram WebView test and Audius stream compatibility test are not part of these checks.

## UI integration once writes are available

Load `vetogram-music-gateway.js` **before** `vetogram-music.js`, map backend `items` into the app's existing track shape, call `VetogramGateway.search/trending/radio`, and preserve the direct-provider fallback. Check both public API CORS and playback on Android/iOS.
