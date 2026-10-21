import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('backup completed notification opens the current VETO production app', () => {
  const code = readFileSync(new URL('../api/privacy-backup-worker.js', import.meta.url), 'utf8');
  assert.match(code, /process\.env\.STORY_PILOT_BASE_URL/);
  assert.match(code, /\/studio\.html/);
  assert.doesNotMatch(code, /telegram-story-bot-murex\.vercel\.app/);
});
