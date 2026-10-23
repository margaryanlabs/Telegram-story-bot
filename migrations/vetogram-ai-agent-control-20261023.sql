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

CREATE OR REPLACE FUNCTION public.vetogram_ai_set_drafting_pause(
  p_owner_id bigint,p_pause boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER
SET search_path=public,pg_temp AS $$
DECLARE previous boolean;
BEGIN
  IF p_owner_id IS NULL OR p_owner_id<1 OR p_pause IS NULL THEN
    RAISE EXCEPTION 'VETOGRAM_AGENT_INVALID_CHANGE' USING ERRCODE='P0001';
  END IF;
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
