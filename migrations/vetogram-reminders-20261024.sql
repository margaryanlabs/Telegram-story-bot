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

-- Single owner-specific transaction lock serializes quota and upsert,
-- and a claimed job is NEVER reissued without a fresh explicit new request
-- (the UI does not expose replacing a claimed job).
CREATE OR REPLACE FUNCTION public.vetogram_schedule_reminder(
  p_owner bigint,p_task uuid,p_remind_at timestamptz,
  p_due_at timestamptz,p_zone text
) RETURNS text LANGUAGE plpgsql SECURITY INVOKER
SET search_path=public,pg_temp AS $$
DECLARE n integer; current_state text;
BEGIN
  IF p_owner IS NULL OR p_owner<=0 OR p_task IS NULL OR
     p_remind_at IS NULL OR p_due_at IS NULL OR
     p_remind_at<now()+interval '2 minutes' OR
     p_remind_at>now()+interval '365 days' OR p_remind_at>p_due_at OR
     p_zone IS NULL OR length(p_zone) NOT BETWEEN 1 AND 64 THEN
    RAISE EXCEPTION 'VETO_REMINDER_INVALID' USING ERRCODE='P0001';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('veto-reminders:'||p_owner::text)::bigint);
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
  bigint,uuid,timestamptz,timestamptz,text) FROM PUBLIC;

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
       AND r.remind_at<=now() AND r.remind_at>=now()-interval '1 day'
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
