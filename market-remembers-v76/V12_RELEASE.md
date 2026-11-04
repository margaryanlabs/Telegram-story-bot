# The Market Remembers V12 — Release Candidate 1

**Current status: REVIEW PREVIEW ONLY.** This is a consolidation and
stability checkpoint, not a claim that user data is publicly published.

## Release composition

This branch is based on V11.7 and includes the earlier cumulative work:
- V10 Living Universe, story identities and cinematic WebGL / Canvas fallback.
- V11 Star Core, responsive observatory shell.
- V11.2 initial star discovery.
- V11.3 four chapter narrative reader.
- V11.4 passage animation and skip/reduced-motion paths.
- V11.5 original live-search Memory Atlas.
- V11.6 opt-in same-origin Memory Trails.
- V11.7 explainable thematic constellations.

**Code location:** `market-remembers-v76/` in
`margaryanlabs/Telegram-story-bot`. The Telegram messenger modules are not
part of this static site build. Moving into a dedicated repository requires a
separate dependency and deployment audit and is not part of this candidate.

## What changed in V12 RC1

- Explicit release title and package version `12.0.0-rc.1`.
- Hardened saved-route hydration: reject entire stored routes if even one ID
  resolves to an absent or private record. Never silently reduce a route.
- Preserve the open state of the route's `details` panel after save/reset.
- Build-time guard for exact, ordered JS modules and required CSS layers.
- Static `release.json` with release metadata: **not** an uptime endpoint.
- Integration-oriented tests for loading order, safe route hydration and
  basic archive/deep-link navigation.

## How to verify

```bash
cd market-remembers-v76
npm test
npm run lint
npm run build
```

Browser QA in Chrome/Android remains mandatory. Use a fresh browser profile
and separately test a profile with existing local preview data.

Manual acceptance:
1. Open universe on an Android device; tap star and cancel during the flight.
2. Open the same star again. Read all four chapters; check source disclaimer.
3. Select a themed connection, inspect the “Почему?” explanation, open target.
4. Expand **Маршрут исследования**, return to previous star, save trail.
5. Archive: search, categories, sort, random story, saved route and deletion.
6. Use Android hardware Back; test direct `#story/{id}` and missing IDs.
7. Disable motion and GPU/WebGL; inspect fallback and keyboard/zoom layouts.
8. Check controls at 320px, 360px, 390px widths, 200% text zoom and landscape.
9. Confirm a local personal story is not visible from another browser/session.
10. Confirm no broken images or external link failures on a live preview.

## Explicit non-goals and unresolved release blockers

- No shared public database or moderation pipeline; user submissions are
  **local to the current browser and current origin**.
- Static files do not prove functional browser interactions or mobile GPU
  performance. Node tests alone cannot approve production.
- Saved routes on V11 previews are not silently transferred to V12's
  different hostname. This is intentional same-origin browser isolation.
- Existing third-party images and historical sources need a separate
  availability/license review before production.
- A dedicated Market Remembers repository should be considered after
  dependency and release continuity verification.
- Production merge, primary domain cutover, billing, analytics and public
  publishing are intentionally **not enabled**.

## Shipping gate

Mark V12 production-ready **only after** mobile/browser QA passes, any
dependency vulnerabilities are triaged, user data/consent and moderation
are resolved if public publishing is planned, and the owner approves the
merge and domain cutover.
