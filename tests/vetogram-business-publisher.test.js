import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { publishPhotoStory } from '../lib/story-app-publisher.js';
test('standard Business Stories still use Bot API postStory without user Premium or user SendStory',async()=>{
  const previous=globalThis.fetch;let calls=0;
  const image=await sharp({create:{width:80,height:100,channels:3,background:'#112233'}}).png().toBuffer();
  globalThis.fetch=async(url,options)=>{
    calls++;assert.match(String(url),/\/postStory$/);assert.equal(options.method,'POST');
    assert.equal(options.body.get('business_connection_id'),'test-new-connection');
    assert.deepEqual(JSON.parse(options.body.get('content')),{type:'photo',photo:'attach://story'});
    assert.equal(options.body.get('caption'),'consented test');assert.ok(options.body.get('story').size>0);
    return {ok:true,json:async()=>({ok:true,result:{id:123}})};
  };
  try {const result=await publishPhotoStory({token:'fixture',businessConnectionId:'test-new-connection',imageBuffer:image,caption:'consented test'});
    assert.deepEqual(result,{id:123,transport:'bot-api'});assert.equal(calls,1);
  } finally {globalThis.fetch=previous;}
});
