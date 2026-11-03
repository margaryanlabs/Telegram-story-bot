import {test,expect} from '@playwright/test';

const viewports=[
 {width:320,height:568},
 {width:390,height:844},
 {width:760,height:420},
 {width:768,height:1024},
 {width:1440,height:900},
];
for(const viewport of viewports){
 test('first-open cinematic composition '+viewport.width+'x'+viewport.height,async({page})=>{
   await page.setViewportSize(viewport);
   const errors:string[]=[];
   page.on('pageerror',error=>errors.push(error.message));
   await page.goto('/');
   await expect(page.locator('#scene')).toBeVisible();
   await expect(page.locator('.hero h1')).toContainText('MARKET');
   await expect(page.locator('#globeScale')).toBeVisible();
   await expect(page.locator('#v81Aura')).toHaveCSS('display','none');
   await expect(page.locator('#energySweep')).toHaveCSS('display','none');
   const selected=page.locator(viewport.width<820?'#signalDock':'#selectedCard');
   await expect(selected).toBeVisible();
   await page.screenshot({
     path:'test-results/v9-first-open-'+viewport.width+'x'+viewport.height+'.png',
     animations:'disabled'
   });
   expect(errors).toEqual([]);
 });
}
test('chosen star passage can be skipped to its actual reader',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/');
 await page.locator('#dockOpen').click();
 await expect(page.locator('#memoryDive')).toBeVisible();
 await expect(page.locator('#v9PassageStatus')).toContainText('ЗВЕЗДА');
 await page.locator('#cancelDive').click();
 await expect(page.locator('#drawer')).toBeVisible();
 await expect(page.locator('#drawer')).toHaveClass(/memory-detail/);
 await expect(page.locator('#drawerContents')).toContainText('NORTHSTAR');
 await page.locator('#closeDrawer').click();
 await expect(page.locator('#drawer')).toBeHidden();
});
test('ESC cancels a flight without opening the memory drawer',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/');
 await page.locator('#dockOpen').click();
 await expect(page.locator('#memoryDive')).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(page.locator('#memoryDive')).toBeHidden();
 await expect(page.locator('#drawer')).toBeHidden();
});
test('reduced motion goes straight to a real memory',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.setViewportSize({width:390,height:844});
 await page.goto('/');
 await page.locator('#dockOpen').click();
 await expect(page.locator('#drawer')).toBeVisible();
 await expect(page.locator('#memoryDive')).toBeHidden();
});
test('archive search keyboard does not remesh a covered sphere',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/');
 await page.locator('.mobile-nav [data-open="archive"]').click();
 await expect(page.locator('#archiveSearch')).toBeVisible();
 await page.locator('#archiveSearch').fill('Risk');
 await expect(page.locator('#archiveResultStatus')).toContainText('ИЗ');
 await page.locator('#closeDrawer').click();
 await expect(page.locator('#scene')).toBeVisible();
});

test('observatory reader preserves the selected star through entry and return',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/');
 await page.locator('#dockOpen').click();
 await expect(page.locator('#drawer')).toBeVisible();
 await expect(page.locator('.v93-observatory')).toBeVisible();
 await expect(page.locator('.v93-observatory-alias')).toContainText('NORTHSTAR');
 await expect(page.locator('.v93-observatory-kind')).toContainText('ВЫМЫШЛЕННАЯ');
 await expect(page.locator('.v93-reader-stage')).toContainText('КОНТЕКСТ');
 await expect(page.locator('.v93-back-to-star')).toHaveAttribute('aria-label',/выбранной звезде/);
 await page.screenshot({path:'test-results/v9-memory-observatory-mobile.png',animations:'disabled'});
 await page.locator('.v93-back-to-star').click();
 await expect(page.locator('#drawer')).toBeHidden();
 await expect(page.locator('#dockAlias')).toContainText('NORTHSTAR');
});
test('reading room remains usable at narrow 320px viewport',async({page})=>{
 await page.setViewportSize({width:320,height:568});
 await page.goto('/');
 await page.locator('#dockOpen').click();
 await expect(page.locator('.v93-observatory')).toBeVisible();
 const bodyWidth=await page.locator('body').evaluate(el=>el.scrollWidth);
 expect(bodyWidth).toBeLessThanOrEqual(321);
 const back=page.locator('.v93-back-to-star');
 await expect(back).toBeVisible();
 const rect=await back.boundingBox();
 expect(rect?.height||0).toBeGreaterThanOrEqual(44);
});
test('reduced motion opens readable observatory instantly',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.setViewportSize({width:390,height:844});
 await page.goto('/');
 await page.locator('#dockOpen').click();
 await expect(page.locator('#drawer')).toBeVisible();
 await expect(page.locator('.v93-observatory')).toBeVisible();
 await expect(page.locator('#memoryDive')).toBeHidden();
});

test('R4: born star gathers, persists locally, and can be reopened after reload',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/');
 await page.locator('#heroCreate').click();
 await expect(page.locator('#createForm')).toBeVisible();
 await page.locator('#alias').fill('MY V9 STAR');
 await page.locator('#market').selectOption('CRYPTO');
 await page.locator('#category').selectOption('Risk');
 await page.locator('#quote').fill('I learned that preservation is more important than prediction.');
 await page.locator('#story').fill('I wrote the rule before entering the trade.');
 await page.locator('#rule').fill('Never risk money that I cannot afford to lose.');
 await page.locator('#localConsent').check();
 await page.locator('#createForm button[type="submit"]').click();
 await expect(page.locator('#birthOverlay')).toBeVisible({timeout:9000});
 await expect(page.locator('#birthName')).toContainText('@MY V9 STAR');
 await page.screenshot({path:'test-results/v9-r4-star-birth-mobile.png',animations:'disabled'});
 const local=await page.evaluate(()=>{
  const records=JSON.parse(localStorage.getItem('veto-market-remembers-demo-v4')||'[]');
  return records.at(-1)||null;
 });
 expect(local).not.toBeNull();
 expect(local.alias).toBe('MY V9 STAR');
 expect(local.local).toBe(true);
 expect(local.id).toMatch(/^local-/);
 expect(local.p).toHaveLength(3);
 await page.locator('#birthContinue').click();
 await expect(page.locator('#birthOverlay')).toBeHidden();
 await expect(page.locator('#dockAlias')).toContainText('MY V9 STAR');
 await page.reload();
 await page.locator('.mobile-nav [data-open="archive"]').click();
 await page.locator('#archiveFilters button[data-archive-filter="Mine"]').click();
 await expect(page.locator('.archive-grid')).toContainText('MY V9 STAR');
 await page.locator('.archive-grid button').filter({hasText:'MY V9 STAR'}).click();
 await expect(page.locator('#drawer')).toBeVisible({timeout:6000});
 await expect(page.locator('.v93-observatory-alias')).toContainText('MY V9 STAR');
});
test('R4: storage denial does not falsely show a successful birth',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.addInitScript(()=>{
  const original=Storage.prototype.setItem;
  Storage.prototype.setItem=function(key,value){
    if(key==='veto-market-remembers-demo-v4')throw new DOMException('Blocked','QuotaExceededError');
    return original.call(this,key,value);
  };
 });
 await page.goto('/');
 await page.locator('#heroCreate').click();
 await page.locator('#alias').fill('PRIVATE TEST');
 await page.locator('#quote').fill('This record must remain unsaved if storage is blocked.');
 await page.locator('#rule').fill('Only report a successful birth after a successful write.');
 await page.locator('#localConsent').check();
 await page.locator('#createForm button[type="submit"]').click();
 await expect(page.locator('#createForm')).toBeVisible();
 await expect(page.locator('#birthOverlay')).toBeHidden();
 await expect(page.locator('#toast')).toContainText('Не удалось сохранить');
});
test('R4: reduced motion still saves the star and opens the success dialog',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.setViewportSize({width:320,height:568});
 await page.goto('/');
 await page.locator('#heroCreate').click();
 await page.locator('#alias').fill('STILL STAR');
 await page.locator('#quote').fill('Every decision needs a clearly articulated risk.');
 await page.locator('#rule').fill('Write the rule before I take a position.');
 await page.locator('#localConsent').check();
 await page.locator('#createForm button[type="submit"]').click();
 await expect(page.locator('#birthOverlay')).toBeVisible();
 await expect(page.locator('#v94BirthField')).toBeHidden();
 await page.locator('#birthContinue').click();
 await expect(page.locator('#birthOverlay')).toBeHidden();
 await expect(page.locator('#dockAlias')).toContainText('STILL STAR');
});

test('V9 release QA is hidden in normal visits and opt-in on-device',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/');
 await expect(page.locator('#qaPanel')).toBeHidden();
 await page.goto('/?qa=1');
 await expect(page.locator('#qaPanel')).toBeVisible();
 await expect(page.locator('#qaStatus')).toContainText('Renderer:');
 await expect(page.locator('#qaStatus')).toContainText('Viewport: 390 × 844');
 await expect(page.locator('#qaStatus')).toContainText('Graphics:');
 await page.screenshot({path:'test-results/v9-device-qa-390x844.png',animations:'disabled'});
 await page.locator('#qaPanel summary').click();
 await expect(page.locator('#qaPanel')).toBeVisible();
});
test('V9 device QA does not leak private story text to its local status snapshot',async({page})=>{
 await page.addInitScript(()=>{
  localStorage.setItem('veto-market-remembers-demo-v4',JSON.stringify([{
   local:true,id:'local-safe-check',alias:'TOP SECRET NAME',
   quote:'PRIVATE TEXT MUST NOT DISPLAY IN QA',
   story:'PRIVATE STORY MUST NOT DISPLAY IN QA',
   rule:'KEEP LOCAL',p:[0,0,1],market:'CRYPTO',category:'Risk',
   type:'local',createdAt:new Date().toISOString()
  }]));
 });
 await page.goto('/?qa=1');
 const report=await page.locator('#qaStatus').innerText();
 expect(report).not.toContain('TOP SECRET NAME');
 expect(report).not.toContain('PRIVATE TEXT');
 expect(report).not.toContain('PRIVATE STORY');
 expect(report).not.toContain('local-safe-check');
});

test('V9.1: private JSON backup restores a star into an empty mobile archive',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/');
 await page.locator('.mobile-nav [data-open="legacy"]').click();
 await expect(page.locator('#importLegacy')).toBeVisible();
 const backup={
  demo:true,localOnly:true,stories:[{
   id:'local-recovery-test-123',local:true,type:'local',alias:'BACKUP STAR',
   quote:'A long private lesson that belongs to this person alone.',
   story:'I kept my notes in a browser.',rule:'Always keep a separate backup',
   capsule:'Remember the experience',market:'CRYPTO',category:'Risk',
   createdAt:'2026-11-01T12:00:00.000Z',p:[0.3,0.4,0.87]
  }],checkins:{'local-recovery-test-123':{'2026-11-01':'kept'}}
 };
 page.once('dialog',dialog=>dialog.accept());
 await page.locator('#legacyBackupFile').setInputFiles({
   name:'local-backup.json',mimeType:'application/json',
   buffer:Buffer.from(JSON.stringify(backup))
 });
 await expect(page.locator('#drawer')).toBeHidden({timeout:6000});
 await page.locator('.mobile-nav [data-open="legacy"]').click();
 await expect(page.locator('#drawer')).toContainText('BACKUP STAR');
 const restored=await page.evaluate(()=>JSON.parse(localStorage.getItem('veto-market-remembers-demo-v4')||'[]'));
 expect(restored).toHaveLength(1);
 expect(restored[0].id).toBe('local-recovery-test-123');
 await page.reload();
 await page.locator('.mobile-nav [data-open="archive"]').click();
 await expect(page.locator('#archiveGrid')).toContainText('BACKUP STAR');
});
test('V9.1: corrupt backup is rejected without replacing current memories',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.addInitScript(()=>{
  localStorage.setItem('veto-market-remembers-demo-v4',JSON.stringify([{
   id:'local-safe-test-001',local:true,type:'local',alias:'SAFE STAR',
   quote:'A private experience that must never disappear.',
   story:'Still here',rule:'Keep safe copies',capsule:'',
   market:'CRYPTO',category:'Risk',createdAt:'2026-11-01T12:00:00.000Z',p:[0,0,1]
  }]));
 });
 await page.goto('/');
 await page.locator('.mobile-nav [data-open="legacy"]').click();
 await page.locator('#legacyBackupFile').setInputFiles({
   name:'invalid-backup.json',mimeType:'application/json',
   buffer:Buffer.from('{"localOnly":true,"stories":[{"id":"bad"}]}')
 });
 await expect(page.locator('#toast')).toContainText('поврежд');
 await expect(page.locator('#drawer')).toContainText('SAFE STAR');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('veto-market-remembers-demo-v4')||'[]'))).toHaveLength(1);
});


test('V9.3 mobile touch targets and first-frame star passage anchor',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/');
 for(const id of ['#dockOpen','#dockNext','#globeScale','#toggleAtlas','#focusMode','#lensToggle']){
   const target=page.locator(id);
   await expect(target).toBeVisible();
   const rect=await target.boundingBox();
   expect(rect?.height||0,id+' must remain easy to tap').toBeGreaterThanOrEqual(40);
 }
 await page.locator('#dockOpen').click();
 await expect(page.locator('#memoryDive')).toBeVisible();
 const anchor=await page.locator('#memoryDive').evaluate(el=>({
   x:el.style.getPropertyValue('--dx'),y:el.style.getPropertyValue('--dy')
 }));
 expect(anchor.x).toMatch(/^\d+(?:\.\d+)?%$/);
 expect(anchor.y).toMatch(/^\d+(?:\.\d+)?%$/);
 await page.keyboard.press('Escape');
 await expect(page.locator('#memoryDive')).toBeHidden();
 await expect(page.locator('#drawer')).toBeHidden();
});
test('V9.3 narrow mobile preserves readable controls at 320×568',async({page})=>{
 await page.setViewportSize({width:320,height:568});
 await page.goto('/');
 await expect(page.locator('#globeScale')).toBeVisible();
 await expect(page.locator('#dockOpen')).toBeVisible();
 const size=await page.locator('#globeScale').boundingBox();
 expect(size?.height||0).toBeGreaterThanOrEqual(39);
 const width=await page.locator('body').evaluate(el=>el.scrollWidth);
 expect(width).toBeLessThanOrEqual(321);
 await page.screenshot({path:'test-results/v93-mobile-320x568.png',animations:'disabled'});
});


test('V9.4 mobile measured orbital framing is inspectable without private data',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/?qa=1');
 const status=page.locator('#qaStatus');
 await expect(status).toContainText('Orb center:');
 await expect(status).toContainText('Portrait safe band:');
 const report=await status.innerText();
 const frame=report.match(/Orb center: (\d+) × (\d+) \| Radius: (\d+)/);
 expect(frame).not.toBeNull();
 if(frame){
   const [,x,y,r]=frame.map(Number);
   expect(x-r).toBeGreaterThanOrEqual(-1);
   expect(x+r).toBeLessThanOrEqual(391);
   expect(y-r).toBeGreaterThanOrEqual(-1);
   expect(y+r).toBeLessThanOrEqual(845);
 }
 const band=report.match(/Portrait safe band: (\d+)–(\d+) \(MEASURED\)/);
 if(band&&frame){
   const y=Number(frame[2]),r=Number(frame[3]);
   expect(y-r).toBeGreaterThanOrEqual(Number(band[1])-2);
   expect(y+r).toBeLessThanOrEqual(Number(band[2])+2);
 }
 await page.screenshot({path:'test-results/v94-portrait-framing-390x844.png',animations:'disabled'});
});
test('V9.4 narrow phone keeps the ECLIPSE sphere legible',async({page})=>{
 await page.setViewportSize({width:320,height:568});
 await page.goto('/?qa=1');
 const report=await page.locator('#qaStatus').innerText();
 const radius=report.match(/Radius: (\d+)/);
 expect(radius).not.toBeNull();
 expect(Number(radius?.[1]||0)).toBeGreaterThanOrEqual(100);
 await expect(page.locator('#dockOpen')).toBeVisible();
 await expect(page.locator('#globeScale')).toBeVisible();
 await page.screenshot({path:'test-results/v94-narrow-320x568.png',animations:'disabled'});
});


test('V9.5 Canvas fallback hides GPU and keeps the Observatory reader usable',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.addInitScript(()=>{
   const original=HTMLCanvasElement.prototype.getContext;
   HTMLCanvasElement.prototype.getContext=function(type,...args){
     if(type==='webgl')return null;
     return original.call(this,type,...args);
   };
 });
 await page.goto('/?qa=1');
 await expect(page.locator('#fallback')).toBeVisible();
 await expect(page.locator('#gl')).toBeHidden();
 await expect(page.locator('#qaStatus')).toContainText('Renderer: CANVAS2D');
 await page.screenshot({path:'test-results/v95-canvas-fallback-390x844.png',animations:'disabled'});
 await page.locator('#dockOpen').click();
 await expect(page.locator('.v93-observatory')).toBeVisible();
 await expect(page.locator('.v93-back-to-star')).toBeVisible();
 await expect(page.locator('#drawer')).toContainText('NORTHSTAR');
 await page.locator('.v93-back-to-star').click();
 await expect(page.locator('#drawer')).toBeHidden();
});
test('V9.5 Observatory reader handles long local text at 320px without horizontal scroll',async({page})=>{
 await page.setViewportSize({width:320,height:568});
 await page.addInitScript(()=>{
   localStorage.setItem('veto-market-remembers-demo-v4',JSON.stringify([{
     id:'local-v95-long',local:true,type:'local',alias:'MY PRIVATE STAR / '+ 'A'.repeat(100),
     quote:'Очень длинная мысль о дисциплине и рынках '.repeat(12),
     story:'НепрерывныйТекстБезПробелов'.repeat(30),
     rule:'Продолжительное правило '.repeat(12),capsule:'',
     p:[0,0,1],market:'CRYPTO',category:'Risk',
     createdAt:'2026-11-01T12:00:00.000Z'
   }]));
 });
 await page.goto('/');
 await page.locator('.mobile-nav [data-open="archive"]').click();
 await page.locator('#archiveFilters button[data-archive-filter="Mine"]').click();
 await page.locator('#archiveGrid button').filter({hasText:'MY PRIVATE STAR'}).first().click();
 await expect(page.locator('.v93-observatory')).toBeVisible();
 const scrollWidth=await page.locator('body').evaluate(el=>el.scrollWidth);
 expect(scrollWidth).toBeLessThanOrEqual(321);
 const back=page.locator('.v93-back-to-star');
 const rect=await back.boundingBox();
 expect(rect?.height||0).toBeGreaterThanOrEqual(44);
 await page.screenshot({path:'test-results/v95-legacy-reader-320x568.png',animations:'disabled'});
});


test('V9.6 reader return preserves chosen star and restores accessible focus',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/');
 await page.locator('#dockNext').click();
 const chosen=await page.locator('#dockAlias').innerText();
 await page.locator('#dockOpen').click();
 await expect(page.locator('#memoryDive')).toBeVisible();
 await page.locator('#cancelDive').click();
 await expect(page.locator('#drawer')).toBeVisible();
 await expect(page.locator('#drawer')).toHaveClass(/v96-reader-arrival/);
 await expect(page.locator('#drawer')).toHaveClass(/memory-detail/);
 await page.locator('#closeDrawer').click();
 await expect(page.locator('#drawer')).toBeHidden();
 await expect(page.locator('#dockAlias')).toHaveText(chosen);
 expect(await page.evaluate(()=>document.activeElement?.id)).toBe('dockOpen');
});
test('V9.6 Escape cancels the passage without opening reader or losing focus',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/');
 await page.locator('#dockOpen').click();
 await expect(page.locator('#memoryDive')).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(page.locator('#memoryDive')).toBeHidden();
 await expect(page.locator('#drawer')).toBeHidden();
 expect(await page.evaluate(()=>document.activeElement?.id)).toBe('dockOpen');
});
test('V9.6 scrim click closes story and returns focus to globe controls',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/');
 await page.locator('#openSelected').click();
 await page.locator('#cancelDive').click();
 await expect(page.locator('#drawer')).toBeVisible();
 await page.locator('#scrim').evaluate(el=>(el as HTMLElement).click());
 await expect(page.locator('#drawer')).toBeHidden();
 expect(await page.evaluate(()=>document.activeElement?.id)).toBe('openSelected');
});
test('V9.6 reduced motion reader has no landing transform',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.setViewportSize({width:390,height:844});
 await page.goto('/');
 await page.locator('#dockOpen').click();
 await expect(page.locator('#drawer')).toBeVisible();
 await expect(page.locator('#memoryDive')).toBeHidden();
 const animation=await page.locator('.memory-experience').evaluate(el=>getComputedStyle(el).animationName);
 expect(animation).toBe('none');
});
