import test from 'node:test';
import assert from 'node:assert/strict';
import {confirmedBotStoryId} from '../lib/vetogram-story-publish-result.js';

test('only Telegram-confirmed positive integer Story ID may be persisted',()=>{
  assert.equal(confirmedBotStoryId({ok:true,result:{id:123}}),123);
  for(const id of [undefined,null,0,-1,'123',1.5,Number.MAX_SAFE_INTEGER+1]){
    assert.throws(()=>confirmedBotStoryId({ok:true,result:{id}}),
      /STORY_PUBLISH_RESULT_UNCERTAIN/);
  }
  assert.throws(()=>confirmedBotStoryId({ok:true}),/STORY_PUBLISH_RESULT_UNCERTAIN/);
});
test('Telegram errors never count as a successful Story publication',()=>{
  for(const result of [{ok:false,result:{id:12}},{result:{id:12}},null]){
    assert.throws(()=>confirmedBotStoryId(result),/STORY_PUBLISH_NOT_CONFIRMED/);
  }
});
