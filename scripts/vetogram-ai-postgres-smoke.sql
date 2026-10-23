\set ON_ERROR_STOP on
-- Isolated CI Postgres only, no production or secret data.
BEGIN;
DO $$
DECLARE first jsonb; next_grant jsonb; outcome jsonb;
  n integer; issued integer; revoked integer; blocked boolean:=false;
BEGIN
  first:=public.vetogram_ai_issue_draft_grant(
    98760001,'11111111-1111-4111-8111-111111111111'::uuid,'56780','USD',47500,50000,5,60);
  next_grant:=public.vetogram_ai_issue_draft_grant(
    98760001,'22222222-2222-4222-8222-222222222222'::uuid,'56780','USD',47500,50000,5,60);
  SELECT count(*) INTO issued FROM public.vetogram_ai_agent_events
    WHERE owner_id=98760001 AND kind='grant_issued';
  SELECT count(*) INTO revoked FROM public.vetogram_ai_agent_events
    WHERE owner_id=98760001 AND kind='grant_revoked';
  IF issued<>2 OR revoked<>1 THEN RAISE EXCEPTION 'CI_GRANT_AUDIT_FAILED'; END IF;

  outcome:=public.vetogram_ai_set_drafting_pause(98760001,true);
  IF outcome->>'draftingPaused'<>'true' THEN RAISE EXCEPTION 'CI_PAUSE_FAILED'; END IF;
  SELECT count(*) INTO n FROM public.vetogram_ai_draft_grants
    WHERE owner_id=98760001 AND revoked_at IS NULL;
  IF n<>0 THEN RAISE EXCEPTION 'CI_PAUSE_NOT_REVOKED'; END IF;
  BEGIN
    PERFORM public.vetogram_ai_issue_draft_grant(
      98760001,'33333333-3333-4333-8333-333333333333'::uuid,
      '56780','USD',47500,50000,5,60);
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    IF SQLERRM='VETOGRAM_DRAFTING_PAUSED' THEN blocked:=true; ELSE RAISE; END IF;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'CI_PAUSED_OWNER_COULD_ISSUE'; END IF;
  PERFORM public.vetogram_ai_issue_draft_grant(
    98760002,'44444444-4444-4444-8444-444444444444'::uuid,
    '56781','GEL',90000,100000,10,15);
  outcome:=public.vetogram_ai_set_drafting_pause(98760001,false);
  SELECT count(*) INTO n FROM public.vetogram_ai_draft_grants
    WHERE owner_id=98760001 AND revoked_at IS NULL;
  IF n<>0 THEN RAISE EXCEPTION 'CI_RESUME_REACTIVATED_OLD_GRANT'; END IF;

  outcome:=public.vetogram_ai_reserve_budget(98760001,100,2,1000,2000);
  outcome:=public.vetogram_ai_reserve_budget(98760001,100,2,1000,2000);
  blocked:=false;
  BEGIN
    PERFORM public.vetogram_ai_reserve_budget(98760001,100,2,1000,2000);
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    IF SQLERRM='VETOGRAM_AI_OWNER_LIMIT' THEN blocked:=true; ELSE RAISE; END IF;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'CI_QUOTA_OVERFLOW_ALLOWED'; END IF;

  INSERT INTO public.vetogram_ai_memory_store(owner_id,encrypted_snapshot,revision)
    VALUES(98760001,'mem1.ci-only',1);
  UPDATE public.vetogram_ai_memory_store SET revision=revision+1
    WHERE owner_id=98760001 AND revision=1;
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n<>1 THEN RAISE EXCEPTION 'CI_MEMORY_CAS_UPDATE_FAILED'; END IF;
  DELETE FROM public.vetogram_ai_memory_store
    WHERE owner_id=98760001 AND revision=1;
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n<>0 THEN RAISE EXCEPTION 'CI_STALE_MEMORY_DELETE_ALLOWED'; END IF;
  DELETE FROM public.vetogram_ai_memory_store
    WHERE owner_id=98760001 AND revision=2;
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n<>1 THEN RAISE EXCEPTION 'CI_MEMORY_DELETE_FAILED'; END IF;
  -- Encrypted Task Center rows: owner isolation, CAS and version tombstone.
  INSERT INTO public.vetogram_task_cloud(owner_id,encrypted_snapshot,revision)
    VALUES(98760001,'task1.fake-ci-ciphertext',1);
  UPDATE public.vetogram_task_cloud
    SET encrypted_snapshot='task1.updated-ci-ciphertext',
      revision=revision+1,updated_at=now()
    WHERE owner_id=98760001 AND revision=1;
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n<>1 THEN RAISE EXCEPTION 'CI_TASK_VERSIONED_UPDATE_FAILED'; END IF;
  UPDATE public.vetogram_task_cloud
    SET encrypted_snapshot=NULL,revision=revision+1,updated_at=now()
    WHERE owner_id=98760001 AND revision=1 AND encrypted_snapshot IS NOT NULL;
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n<>0 THEN RAISE EXCEPTION 'CI_TASK_STALE_WIPE_ALLOWED'; END IF;
  UPDATE public.vetogram_task_cloud
    SET encrypted_snapshot=NULL,revision=revision+1,updated_at=now()
    WHERE owner_id=98760001 AND revision=2 AND encrypted_snapshot IS NOT NULL;
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n<>1 THEN RAISE EXCEPTION 'CI_TASK_TOMBSTONE_FAILED'; END IF;
  SELECT count(*) INTO n FROM public.vetogram_task_cloud
    WHERE owner_id=98760001 AND revision=3 AND encrypted_snapshot IS NULL;
  IF n<>1 THEN RAISE EXCEPTION 'CI_TASK_TOMBSTONE_MISSING'; END IF;
  -- A stale client carrying the original revision cannot restore deleted tasks.
  UPDATE public.vetogram_task_cloud
    SET encrypted_snapshot='stale',revision=revision+1
    WHERE owner_id=98760001 AND revision=1;
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n<>0 THEN RAISE EXCEPTION 'CI_TASK_STALE_RESTORE_ALLOWED'; END IF;
  RAISE NOTICE 'VETOGRAM Task Cloud SQL CAS/tombstone smoke PASS';
  -- Dummy ciphertext only: SQL tests owner locking without decryption.
  PERFORM public.vetogram_task_cloud_write(98760001,3,'ci.task.v4',false);
  PERFORM public.vetogram_task_cloud_write(98760002,0,'ci.other.v1',false);
  -- One-shot reminders: owner isolation, pending-only cancel, atomic claims,
  -- no automatic replay after an uncertain attempt.
  PERFORM public.vetogram_schedule_reminder(
    98760001,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
    now()+interval '6 minutes',now()+interval '12 minutes','Asia/Yerevan',4);
  SELECT count(*) INTO n FROM public.vetogram_reminders
    WHERE owner_id=98760001 AND state='pending';
  IF n<>1 THEN RAISE EXCEPTION 'CI_REMINDER_CREATION_FAILED'; END IF;
  blocked:=false;
  BEGIN
    PERFORM public.vetogram_task_cloud_write(98760001,4,'ci.other-device',false);
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    IF SQLERRM='VETO_TASK_PENDING_REMINDERS' THEN blocked:=true; ELSE RAISE; END IF;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'CI_PENDING_REMINDER_ALLOWED_CLOUD_SAVE'; END IF;
  UPDATE public.vetogram_reminders SET state='canceled',enabled_by_owner=false
    WHERE owner_id=98760001 AND task_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid
      AND state='pending';
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n<>1 THEN RAISE EXCEPTION 'CI_REMINDER_CANCEL_FAILED'; END IF;
  PERFORM public.vetogram_task_cloud_write(98760001,4,'ci.after-cancel',false);
  blocked:=false;
  BEGIN
    PERFORM public.vetogram_schedule_reminder(
      98760001,'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'::uuid,
      now()+interval '6 minutes',now()+interval '12 minutes','Asia/Yerevan',4);
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    IF SQLERRM='VETO_REMINDER_TASK_REVISION_CONFLICT' THEN blocked:=true; ELSE RAISE; END IF;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'CI_STALE_REMINDER_SNAPSHOT_ACCEPTED'; END IF;
  PERFORM public.vetogram_schedule_reminder(
    98760001,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
    now()+interval '6 minutes',now()+interval '12 minutes','Asia/Yerevan',5);
  -- Advance CI-only clock by moving a synthetic due row backward.
  UPDATE public.vetogram_reminders SET remind_at=now()-interval '1 minute'
    WHERE owner_id=98760001 AND task_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid;
  SELECT count(*) INTO n FROM public.vetogram_claim_reminders(8);
  IF n<>1 THEN RAISE EXCEPTION 'CI_REMINDER_CLAIM_FAILED'; END IF;
  SELECT count(*) INTO n FROM public.vetogram_claim_reminders(8);
  IF n<>0 THEN RAISE EXCEPTION 'CI_REMINDER_DUPLICATE_CLAIM'; END IF;
  UPDATE public.vetogram_reminders SET state='sent',completed_at=now()
    WHERE owner_id=98760001 AND task_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid
      AND state='claimed';
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n<>1 THEN RAISE EXCEPTION 'CI_REMINDER_COMPLETION_FAILED'; END IF;
  -- Stale scheduling must not override already sent rows without manual action.
  BEGIN
    PERFORM public.vetogram_schedule_reminder(
      98760001,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
      now()+interval '10 minutes',now()+interval '20 minutes','Asia/Yerevan',5);
    RAISE EXCEPTION 'CI_REMINDER_REPLAY_ALLOWED';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    IF SQLERRM <> 'VETO_REMINDER_ALREADY_ATTEMPTED' THEN RAISE; END IF;
  END;
  -- Owner-scoped bulk cancel: other owners and completed attempts survive.
  PERFORM public.vetogram_schedule_reminder(
    98760001,'cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid,
    now()+interval '8 minutes',now()+interval '16 minutes','Asia/Yerevan',5);
  PERFORM public.vetogram_schedule_reminder(
    98760002,'dddddddd-dddd-4ddd-8ddd-dddddddddddd'::uuid,
    now()+interval '8 minutes',now()+interval '16 minutes','Asia/Yerevan',1);
  UPDATE public.vetogram_reminders SET state='canceled',
      enabled_by_owner=false,updated_at=now(),completed_at=now()
    WHERE owner_id=98760001 AND state='pending';
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n<>1 THEN RAISE EXCEPTION 'CI_CANCEL_ALL_COUNT_FAILED'; END IF;
  SELECT count(*) INTO n FROM public.vetogram_reminders
    WHERE owner_id=98760001 AND state='pending';
  IF n<>0 THEN RAISE EXCEPTION 'CI_CANCEL_ALL_LEFT_PENDING'; END IF;
  SELECT count(*) INTO n FROM public.vetogram_reminders
    WHERE owner_id=98760002 AND state='pending';
  IF n<>1 THEN RAISE EXCEPTION 'CI_CANCEL_ALL_CROSSED_OWNER'; END IF;
  SELECT count(*) INTO n FROM public.vetogram_reminders
    WHERE owner_id=98760001 AND state='sent';
  IF n<>1 THEN RAISE EXCEPTION 'CI_CANCEL_ALL_MODIFIED_ALREADY_SENT'; END IF;
  RAISE NOTICE 'VETOGRAM Reminders: metadata-only one-shot claim PASS';
  RAISE NOTICE 'VETOGRAM AI smoke passed: grants, audit, pause, quotas, memory CAS';
END $$;
ROLLBACK;
