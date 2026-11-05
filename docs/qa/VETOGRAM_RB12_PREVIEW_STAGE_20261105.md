# Vetogram REBORN RB12 — isolated preview verification

This branch is an isolated, non-production review candidate from PR #235 with a unified cache key for all 74 local CSS/JS links in `public/studio.html` to satisfy `MIXED_RELEASE_ASSET_VERSIONS` release-surface gate.

- Does not merge or change the `main` branch.
- Does not change credentials, sessions, databases, or production endpoints.
- Requires full end-to-end verification in Telegram Android before release.

Deployment purpose: allow visual and interaction review without changing the existing 8.5 Render review.
