-- VETOGRAM REBORN: atomic, owner-scoped Telegram login-code request leases.
-- REVIEW ONLY. Do not apply until the coordinated release and its DB preflight.
-- This schema is additive and does not read, alter or expose existing sessions.
CREATE TABLE IF NOT EXISTS public.veto_login_code_leases (
  telegram_user_id bigint PRIMARY KEY,
  lease_token uuid NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON TABLE public.veto_login_code_leases FROM PUBLIC;
CREATE INDEX IF NOT EXISTS veto_login_code_leases_expires_at_idx
  ON public.veto_login_code_leases (expires_at);
INSERT INTO public.veto_storage_migrations(version,note)
VALUES(6,'Atomic cross-instance Telegram login code lease; no session changes')
ON CONFLICT(version) DO NOTHING;
