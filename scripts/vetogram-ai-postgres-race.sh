#!/usr/bin/env bash
set -euo pipefail
# Temporary CI PostgreSQL only. All PG* connection vars come from the workflow.
export PGOPTIONS="-c statement_timeout=12000 -c lock_timeout=7000"
psql -v ON_ERROR_STOP=1 -c "SELECT public.vetogram_ai_set_drafting_pause(98760003,false);" >/dev/null

# Transaction A deliberately holds the same per-owner advisory lock that
# grant issuance and emergency pause use. The second session must serialize.
psql -v ON_ERROR_STOP=1 <<'SQL' >/dev/null &
BEGIN;
SELECT pg_advisory_xact_lock(hashtext('vetogram-ai-agent:98760003')::bigint);
SELECT pg_sleep(2);
DO $$
BEGIN
  PERFORM public.vetogram_ai_issue_draft_grant(
    98760003,'55555555-5555-4555-8555-555555555555'::uuid,
    '56783','USD',47500,50000,5,60);
EXCEPTION WHEN SQLSTATE 'P0001' THEN
  IF SQLERRM <> 'VETOGRAM_DRAFTING_PAUSED' THEN RAISE; END IF;
END $$;
COMMIT;
SQL
writer=$!
sleep 0.5
# Another connection issues emergency pause while writer holds owner lock.
psql -v ON_ERROR_STOP=1 -c \
  "SELECT public.vetogram_ai_set_drafting_pause(98760003,true);" >/dev/null
wait "$writer"

# Irrespective of scheduling, emergency stop must win and leave no grant live.
psql -v ON_ERROR_STOP=1 <<'SQL'
DO $$
DECLARE active_count integer; paused boolean;
BEGIN
  SELECT drafting_paused INTO paused FROM public.vetogram_ai_agent_control
    WHERE owner_id=98760003;
  SELECT count(*) INTO active_count FROM public.vetogram_ai_draft_grants
    WHERE owner_id=98760003 AND revoked_at IS NULL;
  IF paused IS NOT TRUE OR active_count<>0 THEN
    RAISE EXCEPTION 'CI_CONCURRENT_STOP_FAILED paused=% active=%',paused,active_count;
  END IF;
  RAISE NOTICE 'Concurrent grant issue + pause passed: zero active grants';
END $$;
SQL
