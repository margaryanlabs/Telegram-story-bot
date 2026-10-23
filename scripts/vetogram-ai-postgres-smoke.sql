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
  RAISE NOTICE 'VETOGRAM AI smoke passed: grants, audit, pause, quotas, memory CAS';
END $$;
ROLLBACK;
