-- Private runtime-secret store for Story Pilot Edge functions.
-- Secret values are injected directly in production and are never committed.

create schema if not exists story_pilot_private;

create table if not exists story_pilot_private.runtime_secrets (
  name text primary key,
  secret_value text not null,
  updated_at timestamptz not null default now()
);

revoke all on schema story_pilot_private from public, anon, authenticated, service_role;
revoke all on table story_pilot_private.runtime_secrets from public, anon, authenticated, service_role;
