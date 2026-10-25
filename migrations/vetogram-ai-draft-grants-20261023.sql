-- Additive and NOT APPLIED. Negotiator remains approval-only, no send rights.
-- Contains only owner id, chat id and numeric drafting limits, never chat content.
CREATE TABLE IF NOT EXISTS public.vetogram_ai_draft_grants(
  owner_id bigint PRIMARY KEY CHECK(owner_id>0),
  grant_id uuid NOT NULL UNIQUE,
  chat_id text NOT NULL CHECK(chat_id ~ '^-?[0-9]{1,22}$'),
  currency text NOT NULL CHECK(currency IN ('USD','EUR','AMD','RUB','GEL','GBP')),
  min_cents bigint NOT NULL CHECK(min_cents>0),
  asking_cents bigint NOT NULL CHECK(asking_cents>=min_cents),
  max_discount integer NOT NULL CHECK(max_discount BETWEEN 0 AND 30),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  mode text NOT NULL DEFAULT 'approval-only' CHECK(mode='approval-only')
);
REVOKE ALL ON TABLE public.vetogram_ai_draft_grants FROM PUBLIC;
-- Each new grant replaces that owner's previous authorization atomically.
-- Revocation is immediate in database; no background agent is wired.
