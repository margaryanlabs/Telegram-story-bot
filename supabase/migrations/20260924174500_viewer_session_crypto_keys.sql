-- Dedicated keyring for Telegram Control private user-session encryption.
-- Secret material stays in the private schema and is never exposed through PostgREST.

create schema if not exists story_pilot_private;

create table if not exists story_pilot_private.crypto_keys (
  key_id text primary key,
  purpose text not null,
  environment text not null check (environment in ('production', 'preview')),
  secret_value text not null,
  status text not null default 'active' check (status in ('active', 'retired')),
  created_at timestamptz not null default now(),
  retired_at timestamptz
);

create unique index if not exists story_pilot_private_crypto_keys_one_active
  on story_pilot_private.crypto_keys (purpose, environment)
  where status = 'active';

create index if not exists story_pilot_private_crypto_keys_lookup
  on story_pilot_private.crypto_keys (purpose, environment, status, created_at desc);

revoke all on schema story_pilot_private from public, anon, authenticated, service_role;
revoke all on table story_pilot_private.crypto_keys from public, anon, authenticated, service_role;
