# VETOGRAM Reminders — scheduler readiness gate (draft only)

24 October 2026. Branch `feat/vetogram-ai-story-unified-20261023`, PR #181.

## Problem
An authenticated owner could schedule a reminder with `VETOGRAM_REMINDERS_ENABLED=true` even when the background worker had no runnable cron schedule. A pending record in Neon could look like an active promise even though no worker would ever claim it.

## Change
- `reminderSchedulingConfigured` fails closed unless **all three** explicit operator flags are `true`: `VETOGRAM_REMINDERS_ENABLED`, `VETOGRAM_REMINDERS_WORKER_ENABLED`, `VETOGRAM_REMINDERS_SCHEDULER_READY`.
- Signed-owner `list` returns `schedulingConfigured` so the client can report readiness; no secrets or internal cron credentials are exposed.
- Signed-owner `schedule` refuses requests when readiness is false. The existing `list`, `cancel` and `cancel_all` actions still work when the reminders feature flag itself is on, so queued notifications can be inspected or canceled.
- The worker refuses claims and sends until the same readiness guard passes; it still requires `neonCronAuthorized`.
- The UI blocks new scheduling before showing confirmation when server-read readiness is false, and explains that viewing and cancellation remain available.
- Regression tests cover missing/false readiness flags and protected scheduling. Offline release-gate fixtures now include the reminder core and all pre-existing contracted modules.

## Operator verification required before any flag enablement
1. Configure an independently authenticated external minute-level scheduler or a reliable VPS task runner. Vercel Hobby daily Cron is not sufficient for timely minute-level reminders.
2. Verify the target project, Neon schema/migrations, unique Bot API credentials, server-only scheduler authentication, task-cloud encryption key, and user bot-start precondition.
3. Run `npm run check && npm test`, disposable PostgreSQL smoke/race tests, Telegram Bot API E2E and Android/iOS tests in a trusted checkout.
4. Test scheduled, canceled, claimed, skipped, expired, failed and cross-device task changes with distinct test owners. Verify the worker cannot send while readiness is unset.
5. Set `VETOGRAM_REMINDERS_SCHEDULER_READY=true` only when the scheduler is actually configured and monitoring/revocation procedures exist. Setting a flag alone does **not** demonstrate delivery.

No environment variable, Neon migration, worker schedule, live Telegram send, main merge, Vercel deployment or production task was changed. Delivery remains best-effort and one-attempt only; a claimed send cannot be canceled reliably.
