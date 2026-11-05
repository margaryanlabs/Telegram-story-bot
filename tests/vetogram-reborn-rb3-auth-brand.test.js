import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('Telegram session errors consistently identify Vetogram, never old brands',()=>{
  for(const path of ['api/telegram-chats.js','api/telegram-chat-updates.js','api/telegram-send.js']){
    const source=read(path);
    assert.match(source,/Открой Vetogram внутри/);
    assert.doesNotMatch(source,/Открой (?:StoryLab|VETO) внутри/);
  }
});

test('send remains protected by signed owner and explicit nonce, despite error copy update',()=>{
  const source=read('api/telegram-send.js');
  assert.match(source,/validateTelegramMiniApp/);
  assert.match(source,/sameTelegramAccount\(userId,session.telegram_account_user_id\)/);
  assert.match(source,/verifyTelegramClientOwner\(client,userId\)/);
  assert.match(source,/validateSendNonce\(body.nonce\)/);
  assert.match(source,/sendOwnerMessage\(client,dialogs/);
});
