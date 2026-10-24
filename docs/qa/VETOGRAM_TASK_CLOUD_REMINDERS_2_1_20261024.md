# VETOGRAM Task Cloud + Reminders 2.1 — owner-safe consistency (draft only)

24 October 2026. Existing repo `margaryanlabs/Telegram-story-bot`, draft PR #181 / branch `feat/vetogram-ai-story-unified-20261023`.

## Race condition addressed

Previously `scheduleOwnerReminder` loaded and decrypted the saved task from Neon, then scheduled a reminder in a separate database call. A second device could save/erase the encrypted task between those two calls. Likewise the task-cloud save endpoint relied on the client remembering to cancel pending reminders. Client-side checks are not sufficient when devices disagree.

## Atomic owner-level policy

The previously **unapplied** sixth migration (`migrations/vetogram-reminders-20261024.sql`) now stages a new `public.vetogram_task_cloud_write(owner,revision,ciphertext,erase)` procedure. It performs create, versioned save, or versioned wipe under the *same owner-scoped PostgreSQL advisory transaction lock* used by `public.vetogram_schedule_reminder`. A write fails with `VETO_TASK_PENDING_REMINDERS` if any pending reminder belongs to the owner; no task ciphertext, message text, title, contact or prompt is stored in reminder metadata. A write with a stale revision fails without modifying cloud data.

Reminder scheduling now takes `p_cloud_revision` (sixth positional argument) and verifies it against the authoritative owner cloud row, with non-null ciphertext **after acquiring the owner transaction lock**. If a second device has modified or deleted the cloud snapshot since the server's read, scheduling fails with `VETO_REMINDER_TASK_REVISION_CONFLICT`. The Node API maps both cases to HTTP 409 with Russian recovery text. Existing Bot API sending and task text encryption are unchanged.

**Conservative UX tradeoff:** while *any* pending reminder exists for the owner, all cloud saves and erases are rejected, even changes to an unrelated task. This avoids decrypting text inside PostgreSQL and ensures a safe invariant. User must explicitly cancel pending reminders first; already claimed/in-progress reminders may still send, as previously disclosed. A future more granular policy would require a separately reviewed per-task metadata data model.

Existing optimistic CAS, deletion tombstones and owner validation remain. Conflicting requests do not silently overwrite content, automatically cancel alerts or send notifications.

## Test additions and evidence

- `tests/vetogram-task-cloud.test.js`: shared lock, pending reminder denial, no plaintext task fields, usage of the atomic procedure.
- `tests/vetogram-reminders.test.js`: schedule revision parameter and SQL lock ordering.
- `scripts/vetogram-ai-postgres-smoke.sql`: SQL-only smoke scenarios for pending-save block, cancel-before-save success, stale schedule conflict and owner isolation; smoke uses synthetic owner IDs and fake ciphertext only and is wrapped in `BEGIN` / `ROLLBACK`.
- Offline release contract strengthened to demand shared lock and revision guard.
- Manually evaluated current offline migration and runtime gate source in a JS isolate: migrations **PASS**, runtime **PASS**; syntax parsing of changed server JavaScript **PASS**. This is static contract evaluation, not a full npm/test runner, PostgreSQL or Telegram integration test.

## Release instructions and blockers

1. Do **not** modify live Neon schema or Vercel configuration until full parent PRs #179 and #180 readiness is verified, including fixed `package-lock.json` and encrypted Telegram v4 key fingerprint readiness.
2. Execute `npm run check && npm test` on a trusted checkout. Run all six additive migrations in a disposable PostgreSQL instance in order, then `scripts/vetogram-ai-postgres-smoke.sql` and concurrent owner-save/schedule/cancel tests.
3. Validate two-owner, two-device Telegram Mini App: one device schedules while the other edits, cancels, or wipes. Confirm expected 409 errors, untouched ciphertext on conflict, and explicit recovery UI.
4. Verify actual external scheduler, Bot API messages, clock drift, race with claimed/in-progress reminders, and encryption backup/rotation, separately.
5. Keep all feature flags default-OFF until gates pass. No merge into main, Neon write, live Telegram action or Vercel deploy has been done by this work.

**Operational caution:** The staged revision of the sixth migration changes the scheduling function signature from five to six arguments. It is safe to revise only because this sixth migration has **not been applied**. If any environment has independently applied an older version, pause and write a separately reviewed migration that reconciles old functions and grants; do not blindly replay this revised SQL onto that environment.


## 24 October follow-up — expired queue reconciliation and list priority

When a worker is unavailable, a reminder whose allowed delivery window has passed must not stay pending forever and block the owner's encrypted task updates. The staged sixth SQL migration now defines `vetogram_expire_owner_reminders(owner)` under the existing per-owner PostgreSQL transaction lock. It marks only this owner's truly expired **pending** reminders `skipped`, with two strict limits: more than 60 minutes after `remind_at`, **or** more than 10 minutes after the saved `task_due_at`. Both boundaries match the existing worker's pure logic. It neither invokes Bot API nor retries a message.

Encrypted Task Cloud mutations run this reconciliation *inside* the owner lock before checking whether pending reminders remain. Owner reminder listing calls the same function before reading records, so stale pending rows become visible as skipped even without a scheduled worker. Global worker cleanup now uses both bounds. Queued, still-deliverable reminders continue to block cloud saves/erases; the user can cancel them explicitly. Claimed/in-progress sends are not reverted.

The 40-record per-owner list now sorts `pending` first (soonest due first), then `claimed`, then history, preventing old sent/skipped records from hiding active cancellable reminders.

**Validation recorded:** 6/6 pure reminder checks and offline six-migration preflight passed from connected GitHub code; source-based regression cases and disposable-Postgres smoke SQL were updated. Real PostgreSQL SQL execution, runner-based npm suite, Telegram Bot API and mobile WebView QA remain unverified. No production migrations or scheduler configuration were performed.
