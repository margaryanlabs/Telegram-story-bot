import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyTelegramClientOwner,telegramOwnerError} from '../lib/telegram-owner-runtime.js';

test('A verified Mini App owner gets only their own connected MTProto identity',async()=>{
 const good=await verifyTelegramClientOwner({
   getMe:async()=>({id:{toString:()=> '123456'},firstName:'Тест',username:'myaccount'}),
 },'123456');
 assert.equal(good.verified,true);
 assert.equal(good.username,'myaccount');
 assert.equal(good.name,'Тест');
});
test('An authenticated Telegram session belonging to another user fails closed',async()=>{
 await assert.rejects(
   verifyTelegramClientOwner({
     getMe:async()=>({id:'99999',firstName:'Чужой'}),
     getDialogs:async()=>{throw Error('should not access dialogs')},
   },'123456'),
   error=>error.code==='TELEGRAM_OWNER_MISMATCH');
 const result=telegramOwnerError({code:'TELEGRAM_OWNER_MISMATCH'});
 assert.equal(result.status,409);
 assert.match(result.error,/заблокирован/);
});
test('MTProto user lookup unavailable never falls back to a guessed account',async()=>{
 await assert.rejects(
  verifyTelegramClientOwner({getMe:async()=>{throw Error('sensitive provider details')}},'123456'),
  error=>error.code==='TELEGRAM_OWNER_UNVERIFIED'
    &&!error.message.includes('sensitive provider details'));
 const result=telegramOwnerError({code:'TELEGRAM_OWNER_UNVERIFIED'});
 assert.equal(result.status,503);
 assert.equal(telegramOwnerError(new Error('temporary network issue')),null);
});
