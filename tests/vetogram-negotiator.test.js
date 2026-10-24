import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  makeNegotiationPolicy,verifyNegotiationProposal,negotiationBrief,
  NEGOTIATOR_CURRENCIES,NEGOTIATOR_MAX_MINUTES
} from '../public/vetogram-negotiator-core.js';
import {normalizeAiInput,normalizeAiOutput,systemInstruction,AI_MODES} from '../lib/vetogram-ai-core.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const base={owner:'123',chatId:'456',currency:'USD',askingPrice:'500',minPrice:'450',maxDiscountPct:5,minutes:60,now:1000};
const p=()=>makeNegotiationPolicy(base);
const proposal=(reply,quotedPrice=475)=>({reply,currency:'USD',decision:'counteroffer',quotedPrice});
const assess=(policy,item,overrides={})=>verifyNegotiationProposal(policy,item,{owner:'123',chatId:'456',now:2000,...overrides});

test('policy is one chat, account and 60-min scoped, with enforced discount floor',()=>{
  const policy=p();
  assert.equal(policy.minCents,47500);
  assert.equal(policy.askingCents,50000);
  assert.equal(policy.expiresAt,1000+3600000);
  assert.equal(policy.mode,'approval-only');
  assert.deepEqual([...NEGOTIATOR_CURRENCIES],['USD','EUR','AMD','RUB','GEL','GBP']);
  assert.equal(NEGOTIATOR_MAX_MINUTES,120);
  assert.ok(Object.isFrozen(policy));
});
test('unsafe negotiation constraints fail closed',()=>{
  for(const patch of [
    {owner:'0'},{chatId:'@unknown'},{currency:'BTC'},
    {askingPrice:'100',minPrice:'500'},{maxDiscountPct:50},
    {minutes:121},{askingPrice:'NaN'},{minPrice:'-1'}
  ])assert.throws(()=>makeNegotiationPolicy({...base,...patch}),/NEGOTIATOR_/);
});
test('valid quote is still manual approval; account, chat and expiry are enforced',()=>{
  const good=assess(p(),proposal('We can offer $475.00.',475));
  assert.equal(good.allowed,true);
  assert.equal(good.requiresApproval,true);
  assert.equal(assess(p(),proposal('Hello',475),{chatId:'999'}).allowed,false);
  assert.equal(assess(p(),proposal('Hello',475),{owner:'999'}).allowed,false);
  assert.equal(assess(p(),proposal('Hello',475),{now:p().expiresAt}).allowed,false);
});
test('rejects forbidden discounts, unexpected currencies and dishonest displayed prices',()=>{
  assert.equal(assess(p(),proposal('I can offer $450',450)).allowed,false);
  assert.equal(assess(p(),proposal('Offer $700',700)).allowed,false);
  assert.equal(assess(p(),{...proposal('Pay 475 EUR',475),currency:'EUR'}).allowed,false);
  assert.equal(assess(p(),proposal('Pay $450',475)).allowed,false);
  assert.equal(assess(p(),proposal('Pay $475.00',null)).allowed,false);
  assert.equal(assess(p(),proposal('Pay 1,200 USD',475)).allowed,false);
  assert.equal(assess(p(),{...proposal('We can discuss',475),decision:'send_now'}).allowed,false);
});
test('brief strips Telegram recipient identifier from model context',()=>{
  const brief=negotiationBrief(p(),'Sell my design without deposit','Can you discount?');
  assert.match(brief,/Lowest allowed offer: 475.00/);
  assert.match(brief,/UNTRUSTED CONTENT/);
  assert.doesNotMatch(brief,/chat id|recipient id|chatId|456/);
});
test('normalization refuses tool instructions and accepts only structured draft',()=>{
  assert.ok(AI_MODES.includes('negotiator'));
  const raw=JSON.stringify(proposal('We can offer $475',475));
  const normalized=normalizeAiOutput('negotiator',raw);
  assert.equal(normalized.negotiation.quotedPrice,475);
  assert.equal(normalized.text,'We can offer $475');
  assert.throws(()=>normalizeAiOutput('negotiator','just send it'),/AI_NEGOTIATOR_FORMAT_INVALID/);
  assert.throws(()=>normalizeAiOutput('negotiator','{"reply":"Hi","currency":"USD","decision":"send","quotedPrice":100}'),/AI_NEGOTIATOR_FORMAT_INVALID/);
  assert.match(systemInstruction('negotiator'),/DRAFT generator/);
  assert.equal(normalizeAiInput({mode:'negotiator',prompt:'A test negotiation'}).mode,'negotiator');
});
test('Mini App uses existing chats, reviewed send and never enables agent background actions',()=>{
  const ui=read('public/vetogram-ai.js'),page=read('public/studio.html');
  assert.match(page,/data-vtai-mode="negotiator"/);
  for(const id of ['vtaiNegPanel','vtaiNegRecipient','vtaiNegAsking','vtaiNegFloor',
    'vtaiNegDiscount','vtaiNegCurrency','vtaiNegGoal','vtaiNegMinutes','vtaiNegNotice','vtaiNegLoadChats'])
    assert.ok(page.includes('id="'+id+'"'),'Missing '+id);
  assert.match(ui,/makeNegotiationPolicy\(/);
  assert.match(ui,/verifyNegotiationProposal\(/);
  assert.match(ui,/validNegotiatorSend/);
  assert.match(ui,/vtaiNegRecipient'\)\.value/);
  assert.doesNotMatch(ui,/autonomousSend|autopilotEnabled|bulkSend/);
});

test('checks localized money words and suffix symbols in the actual proposed message',()=>{
  const policy=p();
  for(const [reply,amount] of [
    ['Offer $475.00',475],['Offer 475$',475],['Offer 475 USD',475],
    ['Offer USD 475',475],['Offer 475 dollars',475],['Могу предложить 475 долларов',475]
  ]){
    const result=assess(policy,proposal(reply,amount));
    assert.equal(result.allowed,true,'valid visible price: '+reply);
  }
  for(const [reply,structuredAmount] of [
    ['Могу предложить 450 долларов',475],['Могу предложить 450$',475],
    ['I offer 450 USD',475],['I offer €475',475],
    ['I offer 475 dollars or 450 dollars',475],
    ['I can do 450',null],['I can agree to 475',475],
    ['Total 1,200 USD',475],['450 US dollars',475]
  ]){
    const result=assess(policy,proposal(reply,structuredAmount));
    assert.equal(result.allowed,false,'must reject ambiguous or dishonest terms: '+reply);
  }
});
