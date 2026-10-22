-- VETOGRAM 2.0: cross-instance owner-scoped Business change lease.
-- Migration is STAGED only; do NOT execute on Neon before the release window.
-- In-flight requests never see or modify Telegram sessions/message contents.
CREATE TABLE IF NOT EXISTS public.veto_business_write_leases (
  telegram_user_id bigint PRIMARY KEY,
  lease_token uuid NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON TABLE public.veto_business_write_leases FROM PUBLIC;
CREATE INDEX IF NOT EXISTS veto_business_write_leases_expires_at_idx
  ON public.veto_business_write_leases (expires_at);
