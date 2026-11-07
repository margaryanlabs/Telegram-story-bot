import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../public/studio.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/vetogram-v9-story-engine.css',import.meta.url),'utf8');

test('the actual app source parses as classic JavaScript',()=>{
  assert.doesNotThrow(()=>new vm.Script(app));
});

test('uncertain publish response blocks a duplicate send of the same photo',()=>{
  assert.match(app,/let composerPublishUncertain = false;/);
  assert.match(app,/if\(composerPublishUncertain\)\{\s*showToast\(/);
  assert.match(app,/if\(error\?\.uncertain===true\)\{[\s\S]*?composerPublishUncertain=true;/);
  assert.match(app,/mainButton'\)\.disabled = Boolean\(composerBusy \|\| state\.processing \|\| composerPublishUncertain\)/);
});

test('the old owner or replaced attachment cannot poison the current draft',()=>{
  assert.match(app,/if\(!isPublishOwner\(\)\|\|publishingGeneration!==composerGeneration\)return;/);
  assert.match(app,/composerGeneration\+\+;[\s\S]*?composerPublishUncertain = false;/);
  assert.match(app,/composerFile=null;composerDataUrl='';composerOwner='';composerNonce='';\s*composerPublishUncertain=false;/);
});

test('uncertain failure branch executes correctly, not just a source-string contract',async()=>{
  const match=app.match(/\} catch \(error\) \{\n      if\(!isPublishOwner\(\)\|\|publishingGeneration!==composerGeneration\)return;[\s\S]*?\n    \} finally \{/);
  assert.ok(match,'publisher catch branch exists');
  const block=match[0].replace(/^\} catch \(error\) \{\n/,'').replace(/\n    \} finally \{$/,'');
  const run=async ({uncertain,ownerCurrent=true,generationCurrent=true})=>{
    const messages=[];
    const ctx=vm.createContext({
      Error,composerPublishUncertain:false,composerGeneration:2,
      publishingGeneration:generationCurrent?2:1,
      state:{processing:true},isPublishOwner:()=>ownerCurrent,
      notify:value=>messages.push('notify:'+value),
      showToast:value=>messages.push('toast:'+value)
    });
    new vm.Script('async function onFailure(error){'+block+'\n} this.onFailure=onFailure;').runInContext(ctx);
    const error=Object.assign(new Error('Lost Telegram response'),{uncertain});
    if(ownerCurrent&&generationCurrent)await assert.rejects(ctx.onFailure(error),/Lost Telegram response/);
    else await ctx.onFailure(error);
    return {locked:ctx.composerPublishUncertain,messages,processing:ctx.state.processing};
  };
  const ambiguous=await run({uncertain:true});
  assert.equal(ambiguous.locked,true);
  assert.equal(ambiguous.processing,false);
  assert.equal(ambiguous.messages.length,2);
  assert.equal((await run({uncertain:false})).locked,false);
  assert.equal((await run({uncertain:true,ownerCurrent:false})).locked,false);
  assert.equal((await run({uncertain:true,generationCurrent:false})).locked,false);
});

test('recovery is explicit and does not automatically resend to Telegram',()=>{
  assert.match(app,/storyUncertainNewDraft'\)\?\.addEventListener\('click'/);
  assert.match(app,/resetComposer\(\{keepCaption:true\}\);\s*\$\('storyFileInput'\)\.click\(\)/);
  assert.match(html,/id="storyPublishUncertain" role="alert" hidden/);
  assert.match(html,/id="storyUncertainNewDraft"/);
  assert.match(html,/Повтор этой фотографии заблокирован/);
});

test('story controls and failure panel use a real V9 stylesheet with motion and theme fallbacks',()=>{
  const version=html.match(/\/app\.js\?v=([^"'&#]+)/)?.[1];
  assert.ok(version,'app.js release version required');
  assert.ok(html.includes('/vetogram-v9-story-engine.css?v='+version),
    'story engine and publisher must share release key');
  assert.match(css,/\.v9-story-uncertain\[hidden\]\{display:none!important\}/);
  assert.match(css,/prefers-reduced-motion:reduce/);
  assert.match(css,/data-veto-theme="pearl"/);
  assert.match(css,/data-veto-theme="linen"/);
  assert.match(css,/\.se-template\.active/);
});

test('the publish recovery panel has unique IDs and never silently requests Business access',()=>{
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
  for(const id of ['storyPublishUncertain','storyUncertainNewDraft'])
    assert.equal(ids.filter(x=>x===id).length,1);
  assert.doesNotMatch(css,/telegram\.org|fetch\(|localStorage|sessionStorage/);
  assert.doesNotMatch(app.slice(app.indexOf("  $('storyUncertainNewDraft')?.addEventListener"),
    app.indexOf("  $('storyCaption').addEventListener")) ,/publish_story|business_wizard|sendMessage/);
});
