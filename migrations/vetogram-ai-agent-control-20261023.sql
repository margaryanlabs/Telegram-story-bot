-- VETOGRAM Agent Control v1 (draft-only). Manually apply AFTER
-- migrations/vetogram-ai-draft-grants-20261023.sql; never auto-run on deploy.
-- Stores metadata only, NO chat text, prompt, AI output or Telegram session.

CREATE TABLE IF NOT EXISTS public.vetogram_ai_agent_control (
  owner_id bigint PRIMARY KEY CHECK(owner_id>0),
  drafting_paused boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON TABLE public.vetogram_ai_agent_control FROM PUBLIC;

CREATE TABLE IF NOT EXISTS public.vetogram_ai_agent_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  owner_id bigint NOT NULL CHECK(owner_id>0),
  kind text NOT NULL CHECK(kind IN ('grant_issued','grant_revoked','drafting_paused','drafting_resumed')),
  grant_id uuid,
  chat_id text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vetogram_ai_agent_events_owner_idx
 ON public.vetogram_ai_agent_events(owner_id,id DESC);
REVOKE ALL ON TABLE public.vetogram_ai_agent_events FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.vetogram_ai_guard_draft_grant()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path=public,pg_temp AS $$
DECLARE is_paused boolean;
BEGIN
  -- Allow revocations even while paused, but forbid new/renewed grants.
  IF TG_OP='INSERT' THEN
    -- An INSERT has no OLD row; check NEW values only.
    IF NEW.revoked_at IS NOT NULL THEN RETURN NEW; END IF;
  ELSIF NEW.revoked_at IS NOT NULL OR
    (OLD.revoked_at IS NULL AND NEW.grant_id IS NOT DISTINCT FROM OLD.grant_id) THEN
    RETURN NEW;
  END IF;
  IF NEW.revoked_at IS NULL THEN
    INSERT INTO public.vetogram_ai_agent_control(owner_id) VALUES(NEW.owner_id)
      ON CONFLICT(owner_id) DO NOTHING;
    SELECT drafting_paused INTO is_paused FROM public.vetogram_ai_agent_control
      WHERE owner_id=NEW.owner_id FOR UPDATE;
    IF is_paused IS DISTINCT FROM false THEN
      RAISE EXCEPTION 'VETOGRAM_DRAFTING_PAUSED' USING ERRCODE='P0001';
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.vetogram_ai_grant_event()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path=public,pg_temp AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    INSERT INTO public.vetogram_ai_agent_events(owner_id,kind,grant_id,chat_id)
      VALUES(NEW.owner_id,'grant_issued',NEW.grant_id,NEW.chat_id);
  ELSIF NEW.grant_id IS DISTINCT FROM OLD.grant_id THEN
    -- Replaced grant is no longer active: record both sides for traceability.
    INSERT INTO public.vetogram_ai_agent_events(owner_id,kind,grant_id,chat_id)
      VALUES(OLD.owner_id,'grant_revoked',OLD.grant_id,OLD.chat_id);
    INSERT INTO public.vetogram_ai_agent_events(owner_id,kind,grant_id,chat_id)
      VALUES(NEW.owner_id,'grant_issued',NEW.grant_id,NEW.chat_id);
  ELSIF NEW.revoked_at IS NOT NULL AND NEW.revoked_at IS DISTINCT FROM OLD.revoked_at THEN
    INSERT INTO public.vetogram_ai_agent_events(owner_id,kind,grant_id,chat_id)
      VALUES(NEW.owner_id,'grant_revoked',NEW.grant_id,NEW.chat_id);
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS vt_ai_guard_grants ON public.vetogram_ai_draft_grants;
CREATE TRIGGER vt_ai_guard_grants BEFORE INSERT OR UPDATE ON public.vetogram_ai_draft_grants
 FOR EACH ROW EXECUTE FUNCTION public.vetogram_ai_guard_draft_grant();

DROP TRIGGER IF EXISTS vt_ai_grant_events ON public.vetogram_ai_draft_grants;
CREATE TRIGGER vt_ai_grant_events AFTER INSERT OR UPDATE ON public.vetogram_ai_draft_grants
 FOR EACH ROW EXECUTE FUNCTION public.vetogram_ai_grant_event();

-- Single owner-wide lock order for issue and pause:
-- advisory lock => control row => grant row. A direct INSERT ON CONFLICT
-- locks the grant row before the trigger sees control, creating a deadlock.
-- All application grant issues MUST use this function, not direct DML.
CREATE OR REPLACE FUNCTION public.vetogram_ai_issue_draft_grant(
 p_owner_id bigint,p_grant_id uuid,p_chat_id text,p_currency text,
 p_min_cents bigint,p_asking_cents bigint,p_max_discount integer,
 p_minutes integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER
SET search_path=public,pg_temp AS $$
DECLARE is_paused boolean;
DECLARE saved public.vetogram_ai_draft_grants%ROWTYPE;
BEGIN
  IF p_owner_id IS NULL OR p_owner_id<1 OR p_grant_id IS NULL OR
     p_chat_id !~ '^-?[0-9]{1,22}$' OR p_chat_id='0' OR
     p_currency NOT IN ('USD','EUR','AMD','RUB','GEL','GBP') OR
     p_min_cents IS NULL OR p_min_cents<1 OR
     p_asking_cents IS NULL OR p_asking_cents<p_min_cents OR
     p_max_discount IS NULL OR p_max_discount NOT BETWEEN 0 AND 30 OR
     p_minutes IS NULL OR p_minutes NOT BETWEEN 5 AND 120 THEN
    RAISE EXCEPTION 'VETOGRAM_GRANT_INVALID_PARAMETERS' USING ERRCODE='P0001';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('vetogram-ai-agent:' || p_owner_id::text)::bigint);
  INSERT INTO public.vetogram_ai_agent_control(owner_id) VALUES(p_owner_id)
    ON CONFLICT(owner_id) DO NOTHING;
  SELECT drafting_paused INTO is_paused FROM public.vetogram_ai_agent_control
    WHERE owner_id=p_owner_id FOR UPDATE;
  IF is_paused IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'VETOGRAM_DRAFTING_PAUSED' USING ERRCODE='P0001';
  END IF;
  INSERT INTO public.vetogram_ai_draft_grants(
    owner_id,grant_id,chat_id,currency,min_cents,asking_cents,
    max_discount,created_at,expires_at,revoked_at,mode)
  VALUES(p_owner_id,p_grant_id,p_chat_id,p_currency,p_min_cents,
    p_asking_cents,p_max_discount,now(),now()+p_minutes*interval '1 minute',
    NULL,'approval-only')
  ON CONFLICT(owner_id) DO UPDATE SET
    grant_id=EXCLUDED.grant_id,chat_id=EXCLUDED.chat_id,
    currency=EXCLUDED.currency,min_cents=EXCLUDED.min_cents,
    asking_cents=EXCLUDED.asking_cents,max_discount=EXCLUDED.max_discount,
    created_at=now(),expires_at=EXCLUDED.expires_at,revoked_at=NULL,mode='approval-only'
  RETURNING * INTO saved;
  RETURN to_jsonb(saved);
END; $$;

REVOKE ALL ON FUNCTION public.vetogram_ai_issue_draft_grant(bigint,uuid,text,text,bigint,bigint,integer,integer) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.vetogram_ai_set_drafting_pause(
  p_owner_id bigint,p_pause boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER
SET search_path=public,pg_temp AS $$
DECLARE previous boolean;
BEGIN
  IF p_owner_id IS NULL OR p_owner_id<1 OR p_pause IS NULL THEN
    RAISE EXCEPTION 'VETOGRAM_AGENT_INVALID_CHANGE' USING ERRCODE='P0001';
  END IF;
  -- Same advisory transaction lock is acquired FIRST by grant issuance.
  PERFORM pg_advisory_xact_lock(hashtext('vetogram-ai-agent:' || p_owner_id::text)::bigint);
  INSERT INTO public.vetogram_ai_agent_control(owner_id) VALUES(p_owner_id)
    ON CONFLICT(owner_id) DO NOTHING;
  -- Serialize with concurrent grant issuance via trigger's row lock.
  SELECT drafting_paused INTO previous FROM public.vetogram_ai_agent_control
    WHERE owner_id=p_owner_id FOR UPDATE;
  IF previous IS DISTINCT FROM p_pause THEN
    UPDATE public.vetogram_ai_agent_control
      SET drafting_paused=p_pause,updated_at=now() WHERE owner_id=p_owner_id;
    IF p_pause THEN
      UPDATE public.vetogram_ai_draft_grants SET revoked_at=now()
        WHERE owner_id=p_owner_id AND revoked_at IS NULL;
    END IF;
    INSERT INTO public.vetogram_ai_agent_events(owner_id,kind)
      VALUES(p_owner_id,CASE WHEN p_pause THEN 'drafting_paused' ELSE 'drafting_resumed' END);
  END IF;
  RETURN jsonb_build_object('draftingPaused',p_pause,'changed',previous IS DISTINCT FROM p_pause);
END; $$;

REVOKE ALL ON FUNCTION public.vetogram_ai_set_drafting_pause(bigint,boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.vetogram_ai_guard_draft_grant() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.vetogram_ai_grant_event() FROM PUBLIC;

-- Verify on a temporary DB, with owner and real credentials:
-- * issue grant -> grant_issued
-- * pause -> grant_revoked + drafting_paused atomically
-- * issue while paused -> blocked; resume -> issue accepted
-- * separate owners remain isolated; concurrent pause/issue serializes.
