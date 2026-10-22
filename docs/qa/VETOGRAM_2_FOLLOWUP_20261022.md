# VETOGRAM 2.0 — follow-up implementation review (22 October 2026)

**Status: DRAFT. Not production-ready. This report describes changes after the original independent audit, not a rerun of that audit.**

## Commits after the original audit

Base reviewed head: `70737f6f077ac6e4229e80fb450eb2a3fd534423`.

Changes:
- `46ea249`: New owner defaults to **all existing and future private chats** and sees **one explicit combined permission checkbox**, covering Anti-Delete/Edit History/notifications and Business management of Stories. The user still must actively check consent and click confirm. A more restrictive scope may be selected before consent. No automatic Telegram permissions without consent.
- `cf54548`: Onboarding controller tests for bundled consent, selected-only scope enforcement, and preserved existing rights.
- `dc009ca`: Existing owner can change only Business recipients without being forced to grant additional Stories or archive permissions. A first-time owner cannot use this shortcut.
- `f6592e7`: Returning-owner UI supports scope-only edits.
- `18f7e87`, `40e95a2`: Regression cases for scope-only edits in the frontend and signed API.

Only `public/privacy.js`, `api/business-wizard.js`, and their two focused test files changed in this follow-up. Original Ghost View, Story publisher, main Story API, cryptography, user sessions, and existing webhook implementations were **not modified**.

## Consent semantics

1. New user: login by QR/code, then **one permission screen**; all-private is suggested, no checkbox preselected; the opt-in explicitly covers both storing new messages and managing Stories via @Vetotg_bot.
2. Existing own Business bot: preserves existing scope and rights by default; any new Story or archive permission remains opt-in.
3. Existing owner changing only chat scope: must explicitly accept the new scope; no additional features required or granted.
4. The manual Telegram setup path remains as a recovery fallback. Telegram must approve the rights. No premium bypass or guaranteed Ghost View anonymity is asserted by this code change.

## Validation status — important distinction

The preceding audit reported **305/305 local tests**, but those were run against code commit `55f6887`, **not** against the commits in this follow-up. New test cases were written but **full local npm vercel-build was not rerun** in this follow-up.

At post-change head `40e95a2`, GitHub Actions Vetogram Verification run `39755817073` reported **failure**. Previous workflows had `steps:null` and no downloadable logs. Root cause is not established.

The connected second Vercel account returned HTTP 403 (team scope authorization), so deployment settings, runtime health and browser preview could not be validated. The Vercel GitHub status badge alone is not proof of a READY preview.

## Blockers not solved by these UX changes

- **Reliable alert delivery:** `api/webhook-v7.js` catches Telegram sendMessage failure and may acknowledge the archive event with `alert_sent:false`. Durable idempotent outbox/worker for delete/edit alerts requires storage API and gateway support, not just an in-memory retry.
- **Global Business connection synchronization:** current per-instance owner lock cannot serialize mutations across Vercel instances or Telegram clients. Need durable owner-scoped serialization and a safe monotonic connection-state persistence contract at the storage backend.
- **Storage backend:** `lib/viewer-sync-store.js` currently calls `https://xvtmgzzaomolnvkcgosk.supabase.co/functions/v1/story-pilot-store`. Verify whether and how this gateway forwards to Neon. Do not assume Neon is being used or perform migrations blindly.
- **Live testing:** non-Premium Business Story publication before/after, two-account Ghost View receipt, actual message/edit/delete notification, Android and iPhone Telegram WebViews.
- **CI and preview:** resolve GitHub Actions job failure and get a real working Vercel preview.

## Release guard

Do not merge or promote `main` or configure production env `VETOGRAM_UNIFIED_ONBOARDING=1` before user explicitly commands **ДЕПЛОЙ** and the release blockers are resolved. The production gate remains off by default. Do not disconnect existing Telegram Business bots, reset sessions or touch stored archives.
