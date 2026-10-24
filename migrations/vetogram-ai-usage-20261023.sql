-- VETOGRAM AI: additive, fail-closed daily quota. MANUAL MIGRATION ONLY.
-- Run after explicit release approval on intended Neon database.
-- Stores only owner ID, UTC date, request count and conservative usage units.
-- NEVER stores prompts, model output, Telegram messages or provider keys.
CREATE TABLE IF NOT EXISTS public.vetogram_ai_usage_daily (
  day_utc date NOT NULL,
  owner_id bigint NOT NULL CHECK (owner_id >= 0),
  request_count integer NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  reserved_units bigint NOT NULL DEFAULT 0 CHECK (reserved_units >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (day_utc, owner_id)
);
REVOKE ALL ON TABLE public.vetogram_ai_usage_daily FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.vetogram_ai_reserve_budget(
  p_owner_id bigint,
  p_units integer,
  p_owner_request_limit integer,
  p_owner_unit_limit bigint,
  p_global_unit_limit bigint
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path=public,pg_temp
AS $$
DECLARE
  d date := (now() AT TIME ZONE 'UTC')::date;
  used_global bigint;
  used_owner bigint;
  counted_owner integer;
BEGIN
  IF p_owner_id < 1 OR p_units < 1 OR p_units > 25000 OR
     p_owner_request_limit < 1 OR p_owner_request_limit > 500 OR
     p_owner_unit_limit < p_units OR p_global_unit_limit < p_units THEN
    RAISE EXCEPTION 'VETOGRAM_AI_BAD_QUOTA_CONFIG' USING ERRCODE='P0001';
  END IF;

  -- One transaction-level lock per UTC day serializes both global and owner
  -- reservations across all Vercel instances. No in-memory counters.
  PERFORM pg_advisory_xact_lock(hashtext('vetogram-ai-budget:' || d::text)::bigint);

  INSERT INTO public.vetogram_ai_usage_daily
    (day_utc, owner_id, request_count, reserved_units)
  VALUES (d, 0, 1, p_units)
  ON CONFLICT (day_utc, owner_id) DO UPDATE
    SET request_count=public.vetogram_ai_usage_daily.request_count+1,
        reserved_units=public.vetogram_ai_usage_daily.reserved_units+excluded.reserved_units,
        updated_at=now()
    WHERE public.vetogram_ai_usage_daily.reserved_units + excluded.reserved_units <= p_global_unit_limit
  RETURNING reserved_units INTO used_global;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'VETOGRAM_AI_GLOBAL_LIMIT' USING ERRCODE='P0001';
  END IF;

  INSERT INTO public.vetogram_ai_usage_daily
    (day_utc, owner_id, request_count, reserved_units)
  VALUES (d, p_owner_id, 1, p_units)
  ON CONFLICT (day_utc, owner_id) DO UPDATE
    SET request_count=public.vetogram_ai_usage_daily.request_count+1,
        reserved_units=public.vetogram_ai_usage_daily.reserved_units+excluded.reserved_units,
        updated_at=now()
    WHERE public.vetogram_ai_usage_daily.request_count < p_owner_request_limit
      AND public.vetogram_ai_usage_daily.reserved_units + excluded.reserved_units <= p_owner_unit_limit
  RETURNING request_count,reserved_units INTO counted_owner,used_owner;
  IF NOT FOUND THEN
    -- Raising here rolls back the global reservation too.
    RAISE EXCEPTION 'VETOGRAM_AI_OWNER_LIMIT' USING ERRCODE='P0001';
  END IF;

  RETURN jsonb_build_object(
    'utcDay',d,'ownerRemainingRequests',p_owner_request_limit-counted_owner,
    'ownerRemainingUnits',p_owner_unit_limit-used_owner,
    'globalRemainingUnits',p_global_unit_limit-used_global,
    'reservedUnits',p_units
  );
END;
$$;
REVOKE ALL ON FUNCTION public.vetogram_ai_reserve_budget(bigint,integer,integer,bigint,bigint) FROM PUBLIC;

-- Audit/validation, no user text:
-- SELECT to_regclass('public.vetogram_ai_usage_daily');
-- SELECT routine_name FROM information_schema.routines WHERE routine_name='vetogram_ai_reserve_budget';
