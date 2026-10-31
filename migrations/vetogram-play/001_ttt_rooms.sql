-- Vetogram Play v0: server-authoritative 2-player Tic-Tac-Toe.
-- Review and apply manually to a *separate* Neon database/branch.
-- This migration does not run automatically and does not touch Messenger data.
CREATE TABLE IF NOT EXISTS public.vetogram_play_ttt_rooms (
  code varchar(8) PRIMARY KEY
    CHECK (code ~ '^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$'),
  owner_id varchar(20) NOT NULL CHECK (owner_id ~ '^[0-9]{1,20}$'),
  guest_id varchar(20) UNIQUE NULL
    CHECK (guest_id ~ '^[0-9]{1,20}$'),
  board char(9) NOT NULL DEFAULT '.........'
    CHECK (board ~ '^[XO.]{9}$'),
  turn char(1) NOT NULL DEFAULT 'X' CHECK (turn IN ('X','O')),
  status varchar(12) NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting','active','finished')),
  winner varchar(4) NULL CHECK (winner IN ('X','O','draw')),
  version integer NOT NULL DEFAULT 0 CHECK (version >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now()+interval '6 hours'),
  CHECK (guest_id IS NULL OR guest_id <> owner_id),
  CHECK ((status = 'waiting' AND guest_id IS NULL)
    OR (status IN ('active','finished') AND guest_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS vetogram_play_ttt_owner_expiry
  ON public.vetogram_play_ttt_rooms(owner_id,expires_at DESC);
CREATE INDEX IF NOT EXISTS vetogram_play_ttt_expiry
  ON public.vetogram_play_ttt_rooms(expires_at);
-- Recommended maintenance from a trusted scheduled job:
-- DELETE FROM public.vetogram_play_ttt_rooms WHERE expires_at < now() - interval '7 days';
-- Do not grant client-side PUBLIC/anon read/write access. All actions use
-- signed Telegram identity verified by the server handler.
