-- DRAFT ONLY: apply after migrations/vetogram-task-cloud-20261023.sql.
-- Metadata-only reminder table. No message text, source quote, contact name,
-- phone, MTProto session or LLM contents in this queue.
CREATE TABLE IF NOT EXISTS public.vetogram_reminders (
  owner_id bigint NOT NULL CHECK(owner_id>0),
  task_id uuid NOT NULL,
  remind_at timestamptz NOT NULL,
  task_due_at timestamptz NOT NULL,
  time_zone text NOT NULL CHECK(length(time_zone) BETWEEN 1 AND 64),
  state text NOT NULL DEFAULT 'pending'
    CHECK(state IN ('pending','claimed','sent','failed','canceled','skipped')),
  enabled_by_owner boolean NOT NULL DEFAULT true,
  attempt_id uuid,
  attempted_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(owner_id,task_id),
  CHECK(remind_at<=task_due_at)
);
CREATE INDEX IF NOT EXISTS vetogram_reminders_due_idx
  ON public.vetogram_reminders(remind_at) WHERE state='pending';
REVOKE ALL ON TABLE public.vetogram_reminders FROM PUBLIC;

-- Expired jobs can never be safely delivered again. Reconcile them even
-- when the external worker was unavailable, using a per-owner advisory lock.
-- This changes ONLY this owner's pending reminder metadata.
CREATE OR REPLACE FUNCTION public.vetogram_expire_owner_reminders(p_owner bigint)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER
SET search_path=public,pg_temp AS $$
DECLARE changed integer;
BEGIN
  IF p_owner IS NULL OR p_owner<=0 THEN
    RAISE EXCEPTION 'VETO_REMINDER_OWNER_INVALID' USING ERRCODE='P0001';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('veto-reminders:'||p_owner::text)::bigint);
  UPDATE public.vetogram_reminders SET state='skipped',
    completed_at=now(),updated_at=now()
    WHERE owner_id=p_owner AND state='pending' AND
      (remind_at<now()-interval '1 hour' OR
       task_due_at<now()-interval '10 minutes');
  GET DIAGNOSTICS changed=ROW_COUNT;
  RETURN changed;
END; $$;
REVOKE ALL ON FUNCTION public.vetogram_expire_owner_reminders(bigint) FROM PUBLIC;

-- Task Cloud + Reminders 2.1: both task mutations and reminder scheduling
-- acquire the SAME per-owner transaction lock. All task snapshots are opaque.
-- Conservatively block any cloud write/erase while this owner has a PENDING
-- reminder, because PostgreSQL cannot inspect task fields inside ciphertext.
-- Explicitly cancel pending reminders before saving a changed task snapshot.
CREATE OR REPLACE FUNCTION public.vetogram_task_cloud_write(
  p_owner bigint,p_revision integer,p_ciphertext text,p_erase boolean
) RETURNS TABLE(next_revision integer,next_updated_at timestamptz)
LANGUAGE plpgsql SECURITY INVOKER
SET search_path=public,pg_temp AS $$
DECLARE changed integer;
BEGIN
  IF p_owner IS NULL OR p_owner<=0 OR p_revision IS NULL OR
     p_revision<0 OR p_revision>2147483646 OR p_erase IS NULL OR
     (p_erase AND (p_revision=0 OR p_ciphertext IS NOT NULL)) OR
     (NOT p_erase AND (p_ciphertext IS NULL OR
       length(p_ciphertext)<1 OR length(p_ciphertext)>60000)) THEN
    RAISE EXCEPTION 'VETO_TASK_WRITE_INVALID' USING ERRCODE='P0001';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('veto-reminders:'||p_owner::text)::bigint);
  -- Owner-scoped expiry cannot race with another owner's reminder queue.
  PERFORM public.vetogram_expire_owner_reminders(p_owner);
  IF EXISTS(SELECT 1 FROM public.vetogram_reminders
    WHERE owner_id=p_owner AND state='pending') THEN
    RAISE EXCEPTION 'VETO_TASK_PENDING_REMINDERS' USING ERRCODE='P0001';
  END IF;
  IF p_erase THEN
    UPDATE public.vetogram_task_cloud SET encrypted_snapshot=NULL,
       revision=revision+1,updated_at=now()
     WHERE owner_id=p_owner AND revision=p_revision
       AND encrypted_snapshot IS NOT NULL;
  ELSIF p_revision=0 THEN
    INSERT INTO public.vetogram_task_cloud(owner_id,encrypted_snapshot,revision)
      VALUES(p_owner,p_ciphertext,1) ON CONFLICT(owner_id) DO NOTHING;
  ELSE
    UPDATE public.vetogram_task_cloud SET encrypted_snapshot=p_ciphertext,
       revision=revision+1,updated_at=now()
     WHERE owner_id=p_owner AND revision=p_revision;
  END IF;
  GET DIAGNOSTICS changed=ROW_COUNT;
  IF changed<>1 THEN
    RAISE EXCEPTION 'VETO_TASK_REVISION_CONFLICT' USING ERRCODE='P0001';
  END IF;
  RETURN QUERY SELECT c.revision,c.updated_at FROM public.vetogram_task_cloud c
    WHERE c.owner_id=p_owner;
END; $$;
REVOKE ALL ON FUNCTION public.vetogram_task_cloud_write(bigint,integer,text,boolean) FROM PUBLIC;

-- Single owner-specific transaction lock serializes quota and upsert,
-- and a claimed job is NEVER reissued without a fresh explicit new request
-- (the UI does not expose replacing a claimed job).
CREATE OR REPLACE FUNCTION public.vetogram_schedule_reminder(
  p_owner bigint,p_task uuid,p_remind_at timestamptz,
  p_due_at timestamptz,p_zone text,p_cloud_revision integer
) RETURNS text LANGUAGE plpgsql SECURITY INVOKER
SET search_path=public,pg_temp AS $$
DECLARE n integer; current_state text; cloud_revision integer;
BEGIN
  IF p_owner IS NULL OR p_owner<=0 OR p_task IS NULL OR
     p_remind_at IS NULL OR p_due_at IS NULL OR
     p_remind_at<now()+interval '2 minutes' OR
     p_remind_at>now()+interval '365 days' OR p_remind_at>p_due_at OR
     p_zone IS NULL OR length(p_zone) NOT BETWEEN 1 AND 64 OR
     p_cloud_revision IS NULL OR p_cloud_revision<1 THEN
    RAISE EXCEPTION 'VETO_REMINDER_INVALID' USING ERRCODE='P0001';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('veto-reminders:'||p_owner::text)::bigint);
  -- Reject a stale pre-lock encrypted snapshot from another device.
  SELECT revision INTO cloud_revision FROM public.vetogram_task_cloud
    WHERE owner_id=p_owner AND encrypted_snapshot IS NOT NULL;
  IF cloud_revision IS DISTINCT FROM p_cloud_revision THEN
    RAISE EXCEPTION 'VETO_REMINDER_TASK_REVISION_CONFLICT' USING ERRCODE='P0001';
  END IF;
  SELECT state INTO current_state FROM public.vetogram_reminders
    WHERE owner_id=p_owner AND task_id=p_task FOR UPDATE;
  IF current_state IN ('claimed','sent') THEN
    RAISE EXCEPTION 'VETO_REMINDER_ALREADY_ATTEMPTED' USING ERRCODE='P0001';
  END IF;
  SELECT count(*) INTO n FROM public.vetogram_reminders
    WHERE owner_id=p_owner AND state='pending';
  IF n>=24 AND current_state IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'VETO_REMINDER_LIMIT' USING ERRCODE='P0001';
  END IF;
  INSERT INTO public.vetogram_reminders(
    owner_id,task_id,remind_at,task_due_at,time_zone,state,
    enabled_by_owner,attempt_id,attempted_at,completed_at)
  VALUES(p_owner,p_task,p_remind_at,p_due_at,p_zone,'pending',true,
    NULL,NULL,NULL)
  ON CONFLICT(owner_id,task_id) DO UPDATE SET
    remind_at=EXCLUDED.remind_at,task_due_at=EXCLUDED.task_due_at,
    time_zone=EXCLUDED.time_zone,state='pending',enabled_by_owner=true,
    attempt_id=NULL,attempted_at=NULL,completed_at=NULL,updated_at=now();
  RETURN 'pending';
END; $$;
REVOKE ALL ON FUNCTION public.vetogram_schedule_reminder(
  bigint,uuid,timestamptz,timestamptz,text,integer) FROM PUBLIC;

-- Atomic claim marks the send attempt BEFORE the external network call.
-- A claimed reminder is NOT retried automatically after an uncertain timeout,
-- preventing duplicate reminders at the cost of possible missed deliveries.
CREATE OR REPLACE FUNCTION public.vetogram_claim_reminders(p_limit integer DEFAULT 8)
RETURNS TABLE(owner_id bigint,task_id uuid,remind_at timestamptz,
  task_due_at timestamptz,attempt_id uuid)
LANGUAGE sql SECURITY INVOKER
SET search_path=public,pg_temp AS $$
  WITH due AS (
    SELECT r.owner_id,r.task_id FROM public.vetogram_reminders r
     WHERE r.state='pending' AND r.enabled_by_owner
       AND r.remind_at<=now() AND r.remind_at>=now()-interval '1 hour'
     ORDER BY r.remind_at ASC LIMIT LEAST(GREATEST(p_limit,1),8)
     FOR UPDATE SKIP LOCKED
  ), claimed AS (
    UPDATE public.vetogram_reminders r SET state='claimed',
      attempt_id=gen_random_uuid(),attempted_at=now(),updated_at=now()
      FROM due
     WHERE r.owner_id=due.owner_id AND r.task_id=due.task_id
     RETURNING r.owner_id,r.task_id,r.remind_at,r.task_due_at,r.attempt_id
  )
  SELECT * FROM claimed;
$$;
REVOKE ALL ON FUNCTION public.vetogram_claim_reminders(integer) FROM PUBLIC;
