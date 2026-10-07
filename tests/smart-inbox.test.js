import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function read(path) {
  return readFileSync(new URL('../' + path, import.meta.url), 'utf8');
}

test('Smart Inbox v2 exposes an explainable next action', () => {
  const store = read('supabase/functions/story-pilot-store/index.ts');
  const privacy = read('public/privacy.js');
  const html = read('public/studio.html');

  assert.match(store, /smartNextAction/);
  assert.match(store, /smartBrief/);
  assert.match(store, /review_changes/);
  assert.match(privacy, /smartBriefPrimary/);
  assert.match(html, /GHOST BRIEF/);
});

test('Smart Inbox does not claim Telegram unread state', () => {
  const html = read('public/studio.html');
  assert.match(html, /не называет сообщения «непрочитанными»/);
});

test('Automation v2 migration maps edits and deletes to watch_changes', () => {
  const migration = read('supabase/migrations/20261007085330_ghost_automation_watch_changes.sql');
  assert.match(migration, /message\.edit/);
  assert.match(migration, /message\.delete/);
  assert.match(migration, /watch_changes/);
});
