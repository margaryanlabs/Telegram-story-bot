# VETOGRAM Story Engine — phased integration (22 October 2026)

## Why a dependent branch
This feature branch starts from the unmerged VETOGRAM 2.0 onboarding PR #179 head, not from production `main`. It intentionally preserves the Neon migration/release gates and should be integrated **after** #179 is validated and merged. Do not deploy this branch to production and do not mistake it for a separate application.

## Shipped in the feature branch (code, not production release)
- Original cinematic 9:16 Story editor screen directly embedded in `public/studio.html`, reachable from the home tools and the existing bottom Studio tab.
- Ten themed design templates, editable title/subtitle/caption, JPG/PNG/WEBP photo upload, 540×960 interactive canvas preview, high-quality 1080×1920 JPEG download.
- **Existing Telegram Story publisher reused:** Export creates a local JPEG, assigns it to the existing `storyFileInput`, raises the file change event, switches to the existing publish screen and populates its caption. The user must still check audience and explicitly confirm the real publish. Existing Telegram Business rights, privacy and owner checks are not bypassed.
- Five independently editable Portal configurations (Invite, Offer, Links, Waitlist, Poll) and in-app preview. HTTPS links validated; **no public landing page, no external form response collection, no Telegram media-area link** until a secure backend is integrated.
- Device-only IndexedDB drafts: 7/30/90/180/365 day retention chosen per draft, cleaned opportunistically on own-vault opening; local owner-scoped enumeration; explicitly user-triggered delete and copy. Drafts contain images locally in browser storage; **not encrypted or synced**. Deleting browser data also loses them.
- Remix forks the user's own approved draft only, never carries its image bytes or Portal linkage.
- Offline keyword-based template suggestions. **No AI model is called or billed; this must not be marketed as generative AI.**
- Watermark is **opt-in**, not forced.
- Existing Emoji/Sticker Studio remains accessible as `creator`; the Studio tab now opens Story Engine.

## Not yet implemented and not represented as live
- Browser video editing, H.265 output, automated motion compositing and server-side renders.
- Public shareable Portals, actual RSVP/waitlist/poll collection, Portal→Story clickable Telegram media areas, Remix gallery across users, conversions and analytics.
- AI image/video generation or smart caption inference from private media.
- Cross-device cloud draft syncing or server-side scheduled expiry. Local IndexedDB is not a privacy-preserving encrypted vault; warn users and introduce a server-authorized, encrypted store only after an approved migration and key management audit.
- Payments/subscriptions and rate limits.

## Tests and release criteria
- `tests/vetogram-story-engine.test.js`: validates model invariants, owner isolation, retention, safe Portal URLs, Remix media isolation, offline brief, Mini App registration, and honest capability boundaries.
- `npm run check` now includes syntax checks for `public/story-engine.js` and `public/story-engine-core.js`; `npm test` includes the new test file.
- Static review/parser verification was performed in the source-editing session, but a full `npm test` / `npm run vercel-build` for this branch is **not confirmed**.
- Existing Vercel account hit `api-deployments-free-per-day` quota, and the unrelated GitHub Actions account billing lock remains unresolved. Vercel ignores this branch by the configured build-step rule; **do not infer deployment success**.
- Before release: confirm all tests and WebView visual rendering on real Android/iOS; check account switching and IndexedDB quota; test JPEG handoff + Telegram publish and caption; check privacy claims.
- The parent PR #179 still requires Neon v5 lease migration, original v4 key preflight and live two-account Telegram tests.

## Proposed next iterations
1. Build **private**, owner-verified Story drafts / Portal persistence on an approved schema, with encryption, retention and real secure public publication identifiers.
2. Sign canonical share/Remix tokens with expirations and revocations; enforce template ownership, link domain policy, report abuse; no private photo inheritance.
3. The stateless public Portal card route is now coded in this branch; follow with signed, revocable, owner-managed Portal routes, protected form storage, anti-abuse, enforced TTL, privacy disclosure and data export/deletion.
4. Add local video editing pipeline and Telegram-supported video encoding if target devices support it.
5. Add optional metered generative AI provider abstraction after budget/consent and meaningful demand.
6. Release Stars subscriptions/referrals only after feature costs and Telegram Platform policies are reviewed.


## Owner-switch asynchronous safety check

The Story Engine controller now snapshots the active Telegram owner and draft ID before asynchronous FileReader image imports and canvas export, and checks both again before mutating the draft or handing media to the legacy Story publisher. IndexedDB write completion cannot restore an old owner's draft onto a newly active account; the draft list abandons stale reads; picture decoding similarly aborts if the owner or draft changes. Loss of Telegram initData clears the previous canvas and draft list on focus, page-show and screen re-entry. The regression test `tests/vetogram-story-engine.test.js` includes source guards for these cases.

**Verification scope:** static source contract and syntax parser checks passed for the new modules; 35 distinct editor element IDs referenced in the module were matched in the existing Mini App HTML. The full Node test suite and real Telegram WebView image-to-publisher flow remain unverified while build authorization/quota is blocked. Device-local draft data is not encrypted and does not constitute a secure cloud vault; do not store unusually sensitive media until an encrypted implementation exists.

## Story Engine 1.1 — photo grading and draggable layers (23 October 2026)

- Added six validated photo effects, cover zoom 100–250%, bounded X/Y crop pans. These are applied in the actual Canvas rendering shared by preview and the 1080×1920 JPEG publisher handoff.
- Introduced six independent local text layers per draft: plain text, accent pill, outline; selectable list, individual font sizing and direct pointer/touch repositioning on the preview. Inputs are text-only Canvas drawing; no HTML injection or remote AI use.
- Expanded the owner-scoped IndexedDB draft model to persist photo grading and layer placement, while normalizing values and discarding unsafe/invalid layers. Existing drafts default to original photo and no layers.
- Remix of a private draft does not inherit private image, Portal or original layer text; it keeps only the shape and editable layout with placeholder text.
- Added model and UI contract regression tests. No server migrations, credentials, production rollout, Story publish API changes, or paid AI calls.
- Remaining: live Android/iOS WebView gestures, actual preview build tests, video editing, trusted Portal response/analytics pipeline, cryptographically signed public link revocation, cross-account cloud storage and generative AI.

## Portal interactions — 23 October 2026

The existing five Portal categories now have functional **local-only previews**:
- Invite and Waitlist expose an explicit acknowledgement button, clearly marked as a simulation (no contact information collection).
- Offer opens only an explicitly configured HTTPS URL, after a click and with the hostname visible.
- Links supports one primary HTTPS destination and up to four additional labeled, validated HTTPS destinations.
- Poll supports two to five distinct options, keyboard-operable choice controls, and on-screen selection feedback; votes are never sent or stored.

The editor persists options and link-hub links alongside other Portal configuration in the owner-scoped device-local draft. Rendering uses DOM textContent instead of user-derived markup. External links use rel="noopener noreferrer". Preview modals close on app navigation and Telegram owner/draft change and clean up event listeners.

**Not yet released:** public URLs, event/RSVP/waitlist submissions, actual vote counts, analytics, or backend persistence of Portal responses. These need a specifically approved backend schema, authentication, moderation, retention, user-facing privacy notice and anti-abuse limits. No Neon schema changes, Vercel production deployment or AI charges were performed. Portal previews must not be advertised as deployed public mini-sites.

### Verification

Static JavaScript syntax and UI element wiring inspected. Added unit/source contract checks for poll choices, safe link hubs and interactive preview. Full Node test suite and phone/browser E2E tests remain unconfirmed until a build environment allows testing; do not treat GitHub status or canceled Vercel deployments as proof of successful compilation.

## Shareable public Portal cards — 23 October 2026

Implemented a no-database delivery stage **without migrating Neon or modifying the personal-message vault**:

- `/portal.html` is a static, privacy-isolated page with responsive VETOGRAM styling, accessible buttons, a Story continuation CTA, and a visible host for any outgoing HTTPS link.
- The owner explicitly confirms before generating a shareable URL from `Story Engine → Portal → Создать ссылку`. Copy and open actions are available, and the text is selectable if clipboard access fails.
- `story-portal-share.js` serializes **only** normalized, bounded Portal fields (type, title, description, CTA, HTTPS destinations, poll choices) into a base64url fragment. The fragment is not part of HTTP requests and no Telegram owner IDs, draft media, history, or authentication tokens are included. Max payload 3400 UTF-8 bytes.
- The recipient can load the Portal page without connecting a Telegram account. Poll votes, RSVP or waitlist acknowledgements are visibly **local-only**; links open only on a user's click.
- A **client-enforced 30-day expiry** is checked. It is not cryptographically secure: the fragment is deliberately **unsigned and editable**, cannot be revoked, and can be re-encoded by anyone. It must NOT be marketed as private, signed, or as an enforceable link TTL.
- `vercel.json` configures CSP to prevent network connections/form submissions, no-referrer, noindex, nosniff, camera/mic/location restrictions, and no-store on the public Portal page.
- Public HTML contains no user-supplied innerHTML. All fields are rendered with textContent. Only HTTPS destination links with validated domains can be shown.
- No generated VETOGRAM share URL is functional on a public domain until **this PR and its parent PR #179 have been reviewed, tested, approved, and deployed**.
- The visual CTA embedded in a JPEG Story is **not** a clickable Telegram media area. Links are separately shareable only. Publishing clickable media areas, actual vote/lead collection, moderation, analytics, strong expiry/revocation, and owner-managed public Portal editing require an authorized backend release.

Added `tests/vetogram-public-portal.test.js` for serialization, UTF-8, sanitization, owner-private-data isolation, expiry, CSP, static hosting and explicit consent. No production deploy, migration or billable AI call was made.
