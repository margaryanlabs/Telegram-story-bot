-- Event-to-automation rule mapping; idempotent trigger creation
CREATE OR REPLACE FUNCTION public.veto_neon_enqueue_automation()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE rule text; enabled_rule boolean; default_state boolean;
BEGIN
 IF NEW.event_type IN ('security.event','session.created','session.revoked',
                         'connection.created','connection.revoked') THEN rule:='security_changes'; default_state:=true;
 ELSIF NEW.event_type='message.new' AND COALESCE(NEW.payload->>'smartAction','false')='true'
 THEN rule:='smart_action'; default_state:=false;
 ELSIF NEW.event_type IN ('message.edit','message.delete') THEN rule:='watch_changes';default_state:=false;
 ELSIF NEW.event_type='story.view.confirmed' THEN rule:='confirmed_viewer';default_state:=false;
 ELSE RETURN NEW;
 END IF;
 SELECT COALESCE((SELECT enabled FROM public.story_pilot_automation_rules
 WHERE telegram_user_id=NEW.telegram_user_id AND rule_key=rule),default_state) INTO enabled_rule;
 IF enabled_rule THEN
  INSERT INTO public.story_pilot_automation_jobs(telegram_user_id,event_id,rule_key)
  VALUES(NEW.telegram_user_id,NEW.id,rule) ON CONFLICT(telegram_user_id,event_id,rule_key) DO NOTHING;
 END IF;
 RETURN NEW;
END $$;

DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_trigger
 WHERE tgname='veto_neon_event_automation' AND tgrelid='public.story_pilot_events'::regclass)
 THEN CREATE TRIGGER veto_neon_event_automation AFTER INSERT ON public.story_pilot_events
 FOR EACH ROW EXECUTE FUNCTION public.veto_neon_enqueue_automation(); END IF;
END $$;

INSERT INTO public.veto_storage_migrations(version,note)
 VALUES(4,'Event based automation trigger with owner scoped preferences') ON CONFLICT(version) DO NOTHING;
