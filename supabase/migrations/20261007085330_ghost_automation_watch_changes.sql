-- Ghost Mode Automation Engine v2.
-- Adds owner-only alerts for message edit/delete events.

alter table public.story_pilot_automation_rules
  drop constraint if exists story_pilot_automation_rules_rule_key_check;

alter table public.story_pilot_automation_rules
  add constraint story_pilot_automation_rules_rule_key_check
  check (rule_key in ('security_changes','smart_action','watch_changes','confirmed_viewer'));

create or replace function public.story_pilot_enqueue_automation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rule_key text;
  v_smart boolean;
begin
  v_rule_key := null;

  if new.event_type in ('session.created','session.revoked','security.event') then
    v_rule_key := 'security_changes';
  elsif new.event_type = 'story.view.confirmed' then
    v_rule_key := 'confirmed_viewer';
  elsif new.event_type in ('message.edit','message.delete') then
    v_rule_key := 'watch_changes';
  elsif new.event_type = 'message.new' then
    v_smart := coalesce((new.payload->>'smartAction')::boolean, false);
    if v_smart then
      v_rule_key := 'smart_action';
    end if;
  end if;

  if v_rule_key is not null
     and public.story_pilot_automation_enabled(new.telegram_user_id, v_rule_key) then
    insert into public.story_pilot_automation_jobs (
      telegram_user_id,
      event_id,
      rule_key,
      status,
      available_at
    )
    values (
      new.telegram_user_id,
      new.id,
      v_rule_key,
      'queued',
      now()
    )
    on conflict (event_id, rule_key) do nothing;
  end if;

  return new;
end;
$$;

revoke all on function public.story_pilot_enqueue_automation() from public, anon, authenticated;
