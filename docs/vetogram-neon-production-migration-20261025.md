# VETOGRAM — Neon production migration verification (2026-10-25)

**Scope:** Existing Neon project `small-glitter-11116693`, database `veto_telegram`, primary branch `main` (`br-super-king-b9vfmlr4`). This record is for this connected environment only; SQL is not applied automatically in another environment.

## Applied to Neon main

The following six checked-in SQL files were executed manually **in dependency order** using one SQL statement per call. Two `DROP TRIGGER IF EXISTS` statements were omitted on first creation because the target tables/triggers did not exist; their corresponding `CREATE TRIGGER` statements succeeded.

1. `migrations/vetogram-ai-draft-grants-20261023.sql`
2. `migrations/vetogram-ai-agent-control-20261023.sql` (repaired PL/pgSQL dollar-quote syntax)
3. `migrations/vetogram-ai-memory-20261023.sql`
4. `migrations/vetogram-ai-usage-20261023.sql`
5. `migrations/vetogram-task-cloud-20261023.sql`
6. `migrations/vetogram-reminders-20261024.sql`

**Verified on main:**

- Seven new `public.vetogram_*` tables exist: `vetogram_ai_draft_grants`, `vetogram_ai_agent_control`, `vetogram_ai_agent_events`, `vetogram_ai_memory_store`, `vetogram_ai_usage_daily`, `vetogram_task_cloud`, and `vetogram_reminders`.
- Nine `public.vetogram_*` functions exist and have **no PUBLIC EXECUTE privilege**.
- None of the seven tables grants PUBLIC SELECT, INSERT, UPDATE or DELETE; role ACLs were checked against `pg_catalog`.
- The new draft-grants, event-log, AI memory, task cloud and reminder tables were empty immediately after migration. No user records were inserted as part of verification on main.
- The temporary `vetogram-migration-qa-20261025` Neon branch was deleted after independent migration/function tests. Synthetic test grants, quota reservations, and reminders existed **only** on that deleted branch.

**Authorization and RLS note:** This app uses server-owned Neon Postgres through its backend, not an exposed browser Data API. On these new tables RLS is currently **not** enabled; their exposure relies on revoked PUBLIC grants and owner-controlled backend credentials. Before introducing additional DB roles or exposing any Data API, review and enable appropriate RLS/ownership policies.

## Function checks on disposable Neon branch

- AI drafting permission issue → pause → grant revoked; new issue while paused rejected.
- AI quota owner limit rejected a second reservation; failed transaction did not double-charge global counters.
- Encrypted task-cloud revision write succeeded.
- Consent-based reminder scheduling succeeded; pending reminder prevented conflicting cloud task overwrite.
- No live Telegram message was sent, no AI provider was called, no external reminder worker ran.

## Explicitly NOT done

- No Production Vercel deployment, no toggling of AI/task/reminder feature gates, no changes to Telegram bot credentials, and no real user-facing E2E send/publish test.
- Preview deployments were previously disabled to avoid Hobby deployment-rate limits. Resume them only for a controlled, isolated staging release with separate credentials.
- The last fully reported sandbox build from this release sequence was `fc5580e`: `npm ci`, `npm run vercel-build` passed; 659 tests passed, 1 skipped, 0 failed. Newer commits require fresh verification.

## Release checklist

- [x] Neon main receives additive schema changes; verify 7 tables, 9 functions, no PUBLIC grants
- [x] Delete disposable Neon migration test branch after testing
- [x] Keep AI, reminders and autonomous messaging disabled pending approval
- [ ] Verify the **final intended Git SHA** with `npm ci && npm run vercel-build`
- [ ] Set up isolated Preview test account, database, and secrets; no copy of production Telegram identities
- [ ] Test Telegram login, multi-account separation, anti-delete, publish Stories, voice, AI and error reporting on real consenting test accounts
- [ ] Confirm access permissions and quota limits before exposing optional AI endpoints
- [ ] Release reviewed Git SHA to Production, run smoke tests, retain rollback target
