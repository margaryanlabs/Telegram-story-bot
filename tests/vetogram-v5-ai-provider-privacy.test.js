import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {normalizeAiInput,normalizeAiOutput,systemInstruction} from '../lib/vetogram-ai-core.js';

const source=readFileSync(new URL('../api/vetogram-ai.js',import.meta.url),'utf8')
 .replace(/^import[^\n]*\n/gm,'').replace('export default async function handler','async function handler');

test('actual OpenAI request disables retrievable response storage after quota and consent checks',async()=>{
 const calls=[];
 let reserved=false;
 const handler=vm.runInNewContext(source+';handler',{
  process:{env:{TELEGRAM_BOT_TOKEN:'fixture-only',VETOGRAM_AI_ENABLED:'true',VETOGRAM_OPENAI_API_KEY:'fixture-only'}},
  validateTelegramMiniApp:()=>({id:'123'}),normalizeAiInput,normalizeAiOutput,systemInstruction,
  reserveAiBudget:async()=>{reserved=true;return {utcDay:'2026-10-26',ownerRemainingRequests:7}},
  AbortController,setTimeout,clearTimeout,
  fetch:async(url,request)=>{assert.equal(reserved,true);calls.push({url,request});
   return {ok:true,json:async()=>({output_text:'Ответ'})}},
 });
 const res={statusCode:0,body:null,setHeader(){},status(n){this.statusCode=n;return this},json(v){this.body=v;return this}};
 await handler({method:'POST',headers:{'x-telegram-init-data':'signed-owner','x-vetogram-ai-consent':'yes'},
  body:{mode:'chat',prompt:'Привет',history:[]}},res);
 assert.equal(res.statusCode,200);
 assert.equal(calls.length,1);
 assert.equal(calls[0].url,'https://api.openai.com/v1/responses');
 const body=JSON.parse(calls[0].request.body);
 assert.equal(body.store,false);
 assert.equal(body.max_output_tokens,700);
 assert.equal(body.conversation,undefined);
 assert.equal(body.previous_response_id,undefined);
 assert.equal(res.body.sent,false);
 assert.equal(res.body.published,false);
 assert.equal(res.body.requiresOwnerApproval,true);
});
