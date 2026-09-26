import test from 'node:test';
import assert from 'node:assert/strict';
import { automationMessage } from '../api/automation-run.js';

test('security automation links to Security Center', () => {
  const message = automationMessage({
    ruleKey: 'security_changes',
    event: { type: 'session.created', payload: { crypto: 'v3' } },
  });
  assert.equal(message.screen, 'security');
  assert.match(message.text, /Deep Intelligence/);
  assert.match(message.text, /encrypted v3/i);
});

test('Smart Inbox automation never includes raw message content', () => {
  const rawSecret = 'TOP SECRET MESSAGE BODY';
  const message = automationMessage({
    ruleKey: 'smart_action',
    event: {
      type: 'message.new',
      actorDisplayName: 'Alex',
      payload: {
        chatTitle: 'Project chat',
        smartAction: true,
        text_content: rawSecret,
        preview: rawSecret,
      },
    },
  });
  assert.equal(message.screen, 'chats');
  assert.match(message.text, /Alex/);
  assert.match(message.text, /Project chat/);
  assert.equal(message.text.includes(rawSecret), false);
});

test('confirmed viewer automation is factual and story-scoped', () => {
  const message = automationMessage({
    ruleKey: 'confirmed_viewer',
    event: {
      type: 'story.view.confirmed',
      storyId: 42,
      actorUsername: 'alice',
    },
  });
  assert.equal(message.screen, 'viewers');
  assert.match(message.text, /@alice/);
  assert.match(message.text, /Story #42/);
});
