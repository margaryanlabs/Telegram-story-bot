-- Vetogram Play 002: append-only verified results and opt-in public leaderboard.
-- MANUAL ONLY, isolated development Neon database. Apply AFTER 001.
-- No existing production database changes are performed by this file creation.

CREATE TABLE IF NOT EXISTS public.vetogram_play_profiles (
  player_id varchar(20) PRIMARY KEY CHECK (player_id ~ '^[0-9]{1,20}$'),
  public_alias varchar(15) NOT NULL UNIQUE CHECK (public_alias ~ '^VP-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{10}$'),
  leaderboard_visible boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vetogram_play_ttt_results (
  room_code varchar(8) NOT NULL REFERENCES public.vetogram_play_ttt_rooms(code) ON DELETE RESTRICT,
  round integer NOT NULL CHECK (round BETWEEN 1 AND 10000),
  x_player_id varchar(20) NOT NULL CHECK (x_player_id ~ '^[0-9]{1,20}$'),
  o_player_id varchar(20) NOT NULL CHECK (o_player_id ~ '^[0-9]{1,20}$'),
  winner varchar(4) NOT NULL CHECK (winner IN ('X','O','draw')),
  final_board char(9) NOT NULL CHECK (final_board ~ '^[XO.]{9},
  finished_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (room_code,round),
  CHECK (x_player_id <> o_player_id)
);

CREATE INDEX IF NOT EXISTS vetogram_play_ttt_results_x_history
  ON public.vetogram_play_ttt_results (x_player_id,finished_at DESC);
CREATE INDEX IF NOT EXISTS vetogram_play_ttt_results_o_history
  ON public.vetogram_play_ttt_results (o_player_id,finished_at DESC);

-- Results are written ONLY by a conditional UPDATE + INSERT in a single
-- statement from the authoritative server room engine. Repeating a completion
-- cannot insert a second result due to (room_code, round) primary key.
-- There is NO client-facing SQL access. No unrestricted public users table.
-- Do not run a cleanup of rooms referenced by the results table: results
-- deliberately preserve a valid source room/round for auditability.
),
  finished_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (room_code,round),
  CHECK (x_player_id <> o_player_id)
);

CREATE INDEX IF NOT EXISTS vetogram_play_ttt_results_x_history
  ON public.vetogram_play_ttt_results (x_player_id,finished_at DESC);
CREATE INDEX IF NOT EXISTS vetogram_play_ttt_results_o_history
  ON public.vetogram_play_ttt_results (o_player_id,finished_at DESC);

-- Results are written ONLY by a conditional UPDATE + INSERT in a single
-- statement from the authoritative server room engine. Repeating a completion
-- cannot insert a second result due to (room_code, round) primary key.
-- There is NO client-facing SQL access. No unrestricted public users table.
-- Do not run a cleanup of rooms referenced by the results table: results
-- deliberately preserve a valid source room/round for auditability.
