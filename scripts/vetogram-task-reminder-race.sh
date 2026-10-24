#!/usr/bin/env bash
set -euo pipefail
# Disposable CI PostgreSQL ONLY. No production credentials, Bot API or plaintext tasks.
# The workflow first applies both Task Cloud and Reminder migrations.
export PGOPTIONS="-c statement_timeout=12000 -c lock_timeout=7000"

# Synchronize against the actual advisory lock instead of relying on a fixed
# sleep in an arbitrarily scheduled CI runner. A successful try-lock is scoped
# only to its own one-statement transaction and releases immediately.
wait_for_owner_lock(){
  local owner="$1" result
  for ((i=0;i<40;i++)); do
    result="$(psql -v ON_ERROR_STOP=1 -Atq -c "SELECT pg_try_advisory_xact_lock(hashtext('veto-reminders:${owner}')::bigint)")"
    if [[ "$result" == "f" ]]; then return 0; fi
    sleep 0.1
  done
  printf 'CI_OWNER_LOCK_NOT_OBSERVED owner=%s\n' "$owner" >&2
  return 1
}

# Device A edits the encrypted cloud snapshot while device B has read revision 1.
psql -v ON_ERROR_STOP=1 <<'SQL' >/dev/null
SELECT public.vetogram_task_cloud_write(98760005,0,'ci.device-a.v1',false);
SQL
psql -v ON_ERROR_STOP=1 <<'SQL' >/dev/null &
BEGIN;
SELECT pg_advisory_xact_lock(hashtext('veto-reminders:98760005')::bigint);
SELECT pg_sleep(2);
SELECT public.vetogram_task_cloud_write(98760005,1,'ci.device-a.v2',false);
COMMIT;
SQL
editor=$!
wait_for_owner_lock 98760005
# A stale device may pass an old pre-lock read, but its reminder MUST fail
# after the shared advisory lock is released and the current revision is checked.
psql -v ON_ERROR_STOP=1 <<'SQL' >/dev/null
DO $$
DECLARE rejected boolean:=false;
BEGIN
  BEGIN
    PERFORM public.vetogram_schedule_reminder(
      98760005,'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1'::uuid,
      now()+interval '10 minutes',now()+interval '20 minutes','UTC',1);
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    IF SQLERRM='VETO_REMINDER_TASK_REVISION_CONFLICT'
      THEN rejected:=true; ELSE RAISE; END IF;
  END;
  IF NOT rejected THEN
    RAISE EXCEPTION 'CI_STALE_REMINDER_ACCEPTED_DURING_CLOUD_EDIT';
  END IF;
END $$;
SQL
wait "$editor"

# Device A first commits a reminder, while device B wants to save. The
# second edit must wait for the lock and then fail before changing ciphertext.
psql -v ON_ERROR_STOP=1 <<'SQL' >/dev/null
SELECT public.vetogram_task_cloud_write(98760006,0,'ci.device-b.v1',false);
SQL
psql -v ON_ERROR_STOP=1 <<'SQL' >/dev/null &
BEGIN;
SELECT pg_advisory_xact_lock(hashtext('veto-reminders:98760006')::bigint);
SELECT pg_sleep(2);
SELECT public.vetogram_schedule_reminder(
  98760006,'b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2'::uuid,
  now()+interval '10 minutes',now()+interval '20 minutes','UTC',1);
COMMIT;
SQL
scheduler=$!
wait_for_owner_lock 98760006
psql -v ON_ERROR_STOP=1 <<'SQL' >/dev/null
DO $$
DECLARE rejected boolean:=false;
BEGIN
  BEGIN
    PERFORM public.vetogram_task_cloud_write(
      98760006,1,'ci.device-b.should-not-commit',false);
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    IF SQLERRM='VETO_TASK_PENDING_REMINDERS'
      THEN rejected:=true; ELSE RAISE; END IF;
  END;
  IF NOT rejected THEN
    RAISE EXCEPTION 'CI_CLOUD_EDIT_ALLOWED_DURING_REMINDER_SCHEDULE';
  END IF;
END $$;
SQL
wait "$scheduler"

# A second owner and the immutable data boundary are checked explicitly.
psql -v ON_ERROR_STOP=1 <<'SQL'
DO $$
DECLARE count_valid integer; ciphertext text; stored_revision integer;
BEGIN
  SELECT count(*) INTO count_valid FROM public.vetogram_reminders
    WHERE owner_id=98760005 AND state='pending';
  IF count_valid<>0 THEN
    RAISE EXCEPTION 'CI_STALE_OWNER_HAS_UNEXPECTED_PENDING_REMINDER';
  END IF;
  SELECT c.encrypted_snapshot,c.revision INTO ciphertext,stored_revision
    FROM public.vetogram_task_cloud c WHERE c.owner_id=98760005;
  IF ciphertext<>'ci.device-a.v2' OR stored_revision<>2 THEN
    RAISE EXCEPTION 'CI_CLOUD_REVISION_LOST_AFTER_SCHEDULE_RACE';
  END IF;
  SELECT c.encrypted_snapshot,c.revision INTO ciphertext,stored_revision
    FROM public.vetogram_task_cloud c WHERE c.owner_id=98760006;
  IF ciphertext<>'ci.device-b.v1' OR stored_revision<>1 THEN
    RAISE EXCEPTION 'CI_CLOUD_WRITE_BYPASSED_PENDING_REMINDER';
  END IF;
  SELECT count(*) INTO count_valid FROM public.vetogram_reminders
    WHERE owner_id=98760006 AND state='pending';
  IF count_valid<>1 THEN
    RAISE EXCEPTION 'CI_VALID_REMINDER_LOST_AFTER_WRITE_RACE';
  END IF;
  RAISE NOTICE 'Task Cloud / reminder cross-device concurrency checks PASS';
END $$;
SQL
