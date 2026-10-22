import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const src=readFileSync(new URL('../lib/neon-media-store.js',import.meta.url),'utf8');
test('Neon privacy retention deletes expired message versions before the parent row',()=>{
  const body=src.slice(src.indexOf("case 'cleanup_privacy_retention_global'"));
  const snapshots=body.indexOf('DELETE FROM public.story_pilot_message_versions');
  const messages=body.indexOf('DELETE FROM public.story_pilot_messages');
  assert.ok(snapshots>=0 && messages>snapshots);
  assert.match(body,/telegram_user_id=\$1::bigint AND chat_id=\$2::bigint AND message_id=\$3/);
});
test('Neon retention removes media before purging version and message metadata',()=>{
  const body=src.slice(src.indexOf("case 'cleanup_privacy_retention_global'"));
  assert.ok(body.indexOf('await removeFiles(')<body.indexOf('DELETE FROM public.story_pilot_message_versions'));
});
