const {test,expect}=require('./browser-fixtures.cjs');
const sizes=[{width:320,height:568},{width:390,height:844},{width:760,height:420},{width:768,height:1024},{width:1440,height:900}];
async function open(page,path='/'){await page.goto(path);await expect(page.locator('#scene')).toBeVisible();}
async function reduced(page){await page.emulateMedia({reducedMotion:'reduce'});}
async function step(page,field,text){await page.locator('#'+field).fill(text);await page.locator('#v10FormNext').click();}
async function compose(page){
 await page.locator('#heroCreate').click();await step(page,'alias','NIGHT OWL');
 await step(page,'before','Я наблюдал за рынком и боялся упустить движение.');
 await step(page,'decision','Я принял решение снизить риск и не увеличивать позицию.');
 await step(page,'consequences','Спокойствие помогло мне оценить последствия и остановиться.');
 await page.locator('#rule').fill('Перед каждым входом записываю допустимый риск.');
 await page.locator('#quote').fill('Я могу отказаться от сделки и сохранить внимание.');
 await page.locator('#v10FormNext').click();await expect(page.locator('#v10LegacyReview')).toContainText('NIGHT OWL');await page.locator('#localConsent').check();
}
for(const size of sizes)test('composition '+size.width+'×'+size.height,async({page})=>{
 await page.setViewportSize(size);const errors=[];page.on('pageerror',e=>errors.push(e.message));await open(page);await page.waitForTimeout(400);
 expect(await page.locator('body').evaluate(e=>e.scrollWidth)).toBeLessThanOrEqual(size.width);
 const hero=await page.locator('#hero').boundingBox(),controls=await page.locator('#worldControls').boundingBox();
 expect(hero.y+hero.height).toBeLessThan(controls.y+4);
 if(size.width<820){const dock=await page.locator('#signalDock').boundingBox();expect(dock.y+dock.height).toBeLessThanOrEqual(controls.y+4);
  for(const button of await page.locator('#worldControls button:visible').all())expect((await button.boundingBox()).height).toBeGreaterThanOrEqual(size.height<450?40:44);
 }else{const selected=await page.locator('#selectedCard').boundingBox();expect(selected.y+selected.height).toBeLessThanOrEqual(controls.y+4);}
 await page.screenshot({path:'test-results/v10-'+size.width+'x'+size.height+'.png',animations:'disabled'});expect(errors).toEqual([]);
});
test('native WebGL compiles and sphere survives context loss',async({page})=>{
 await open(page,'/?qa=1');await expect(page.locator('#qaStatus')).toContainText('WEBGL1');await expect(page.locator('#qaStatus')).toContainText('Render errors: 0');
 await page.locator('#gl').evaluate(canvas=>canvas.getContext('webgl').getExtension('WEBGL_lose_context').loseContext());await expect(page.locator('#fallback')).toBeVisible();
 await page.locator('#qaPanel').evaluate(el=>el.hidden=true);await page.locator('#openSelected').click();await expect(page.locator('.v10-chapter')).toHaveCount(2);
});
test('fallback without WebGL keeps reader usable',async({page})=>{
 await page.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/.test(type)?null:get.call(this,type,...args);};});
 await reduced(page);await page.setViewportSize({width:390,height:844});await open(page);await expect(page.locator('#fallback')).toBeVisible();
 await page.locator('#dockOpen').click();await expect(page.locator('.v10-chapter')).toHaveCount(2);await page.locator('#closeDrawer').click();await expect(page.locator('#drawer')).toBeHidden();
});
test('flight is skippable and omitted on repeat visits',async({page})=>{
 await page.setViewportSize({width:390,height:844});await open(page);await page.locator('#dockOpen').click();await expect(page.locator('#memoryDive')).toBeVisible();
 await page.locator('#cancelDive').click();await expect(page.locator('#memoryTitle')).toHaveText('@NORTHSTAR');await expect(page).toHaveURL(/#story\/1$/);
 await page.locator('#closeDrawer').click();await expect(page).toHaveURL(/#universe\?star=1$/);await page.locator('#dockOpen').click();
 await expect(page.locator('#drawer')).toBeVisible();await expect(page.locator('#memoryDive')).toBeHidden();
});
test('Escape cancels passage and Back restores universe',async({page})=>{
 await page.setViewportSize({width:390,height:844});await open(page);await page.locator('#dockOpen').click();await page.keyboard.press('Escape');
 await expect(page.locator('#memoryDive')).toBeHidden();await expect(page.locator('#drawer')).toBeHidden();await expect(page).toHaveURL(/#universe$/);
 await reduced(page);await page.reload();await page.locator('#dockOpen').click();await page.goBack();await expect(page.locator('#drawer')).toBeHidden();await expect(page.locator('#dockAlias')).toContainText('NORTHSTAR');
});
test('chapters, constellation and keyboard modal',async({page})=>{
 await reduced(page);await page.setViewportSize({width:390,height:844});await open(page,'/#story/1');await expect(page.locator('.v10-chapter')).toHaveCount(2);
 await expect(page.locator('.v19-source-coverage')).toBeVisible();
 await expect(page.locator('[data-chapter=decision]')).toHaveCount(0);await page.locator('[data-v10-chapter="1"]').click();await expect(page.locator('[data-v10-chapter="1"]')).toHaveAttribute('aria-current','step');
 await expect(page.locator('.v10-constellation-star')).toHaveCount(3);await page.locator('.v10-constellation-list summary').click();await expect(page.locator('.v10-constellation-list li')).toHaveCount(3);
 await page.locator('.v10-constellation-list li button').first().click();await expect(page.locator('#memoryTitle')).not.toHaveText('@NORTHSTAR');await expect(page.locator('.v78-thread-breadcrumb')).toBeVisible();
 for(let i=0;i<15;i++){await page.keyboard.press('Tab');expect(await page.locator('#drawer').evaluate(el=>el.contains(document.activeElement))).toBe(true);}
 const alias=await page.locator('.v93-observatory-alias').innerText();
 await page.locator('.v93-back-to-star').click();await expect(page.locator('#drawer')).toBeHidden();await expect(page.locator('#dockAlias')).toContainText(alias.replace(/^[@★]\s*/,''));
});
test('archive filter URL, search, sorting, locate and history',async({page})=>{
 await reduced(page);await page.setViewportSize({width:390,height:844});await open(page);await page.locator('.mobile-nav [data-open=archive]').click();
 await page.locator('#archiveSearch').fill('MIRA');await expect(page.locator('.v10-archive-row')).toHaveCount(1);await expect(page).toHaveURL(/q=MIRA/);
 await page.locator('#v10ArchiveSort').selectOption('alias');await expect(page).toHaveURL(/sort=alias/);await page.reload();await expect(page.locator('#archiveSearch')).toHaveValue('MIRA');await expect(page.locator('.v10-archive-row')).toHaveCount(1);
 await page.locator('.v10-locate-star').click();await expect(page).toHaveURL(/#universe\?star=2/);await expect(page.locator('#dockAlias')).toContainText('MIRA');await page.goBack();await expect(page.locator('#archiveSearch')).toHaveValue('MIRA');
});
test('all 30 stars have stable deep links and sourced legends keep attribution',async({page})=>{
 await reduced(page);await open(page,'/#archive');const ids=await page.locator('[data-story-id]').evaluateAll(els=>els.map(el=>el.dataset.storyId));expect(new Set(ids).size).toBe(30);
 for(const id of ids){await page.goto('/#story/'+encodeURIComponent(id));await expect(page.locator('.memory-experience')).toBeVisible();
  if(await page.locator('#drawer').evaluate(el=>el.classList.contains('legend-detail')))await expect(page.locator('.legend-source a')).toHaveAttribute('href',/^https:/);else await expect(page.locator('.v10-chapter')).toHaveCount([13,14,15,20].includes(Number(id))?4:2);
 }
});
test('private creation, stable link, reload, JSON export and deletion',async({page})=>{
 await reduced(page);await page.setViewportSize({width:390,height:844});await open(page);await compose(page);await expect(page.locator('#birthOverlay')).toBeHidden();
 await page.locator('#v10FormSave').click();await expect(page.locator('#birthOverlay')).toBeVisible();const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('veto-market-remembers-demo-v4')));
 expect(saved).toHaveLength(1);expect(saved[0].id).toMatch(/^local-/);expect(saved[0].chapters.decision).toContain('снизить риск');
 await page.locator('#birthContinue').click();await page.goto('/#story/'+saved[0].id);await expect(page.locator('[data-chapter=decision]')).toContainText('снизить риск');await page.reload();await expect(page.locator('[data-chapter=consequences]')).toContainText('Спокойствие');
 await page.goto('/#legacy');const download=page.waitForEvent('download');await page.locator('#exportLegacy').click();expect((await download).suggestedFilename()).toMatch(/json$/);
 page.once('dialog',dialog=>dialog.accept());await page.locator('#deleteLegacy').click();await expect(page.locator('#createFromLegacy')).toBeVisible();expect(await page.evaluate(()=>localStorage.getItem('veto-market-remembers-demo-v4'))).toBeNull();
});
test('failed storage never creates star or reports success',async({page})=>{
 await reduced(page);await page.setViewportSize({width:390,height:844});await open(page);await compose(page);
 await page.evaluate(()=>{Storage.prototype.setItem=function(){throw new DOMException('Quota','QuotaExceededError');};});await page.locator('#v10FormSave').click();
 await expect(page.locator('#v10FormError')).toContainText('не опубликована');await expect(page.locator('#birthOverlay')).toBeHidden();await expect(page.locator('#v10LegacyReview')).toContainText('NIGHT OWL');
});
test('reduced motion parks idle and covered rendering',async({page})=>{
 await reduced(page);await open(page);await page.waitForTimeout(300);const before=await page.evaluate(()=>MarketV10.stats().draws);await page.waitForTimeout(300);expect(await page.evaluate(()=>MarketV10.stats().draws)).toBe(before);
 await page.locator('#openSelected').click();const during=await page.evaluate(()=>MarketV10.stats().draws);await page.waitForTimeout(300);expect(await page.evaluate(()=>MarketV10.stats().draws)).toBe(during);
});
test('Android touch, bounded DPR and CPU-throttled responsiveness',async({browser},testInfo)=>{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:3,
  userAgent:'Mozilla/5.0 (Linux; Android 13; Pixel 6a) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36'});
 const page=await context.newPage();const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
 await page.goto('/?qa=1');await page.waitForTimeout(9300);
 const metrics=await page.evaluate(async()=>{
  const frames=[];let previous=performance.now();const end=previous+2000;
  await new Promise(resolve=>{function frame(now){frames.push(now-previous);previous=now;if(now<end)requestAnimationFrame(frame);else resolve();}requestAnimationFrame(frame);});
  return {meanFrameMs:frames.reduce((a,b)=>a+b,0)/frames.length,maxFrameMs:Math.max(...frames),frames:frames.length,
   renderer:document.getElementById('qaStatus').textContent,bufferWidth:document.getElementById('gl').width,screenWidth:innerWidth};
 });
 expect(metrics.bufferWidth).toBeLessThanOrEqual(390*1.35+1);expect(metrics.maxFrameMs).toBeLessThan(1500);
 await page.locator('#qaPanel').evaluate(el=>el.hidden=true);
 const marker=page.locator('.star-marker[aria-hidden="false"]').first();const box=await marker.boundingBox();const start=Date.now();await page.touchscreen.tap(box.x+box.width/2,box.y+box.height/2);await expect(page.locator('.memory-experience')).toBeVisible();
 metrics.touchToReaderMs=Date.now()-start;expect(metrics.touchToReaderMs).toBeLessThan(4500);
 await testInfo.attach('android-cpu4-metrics',{body:JSON.stringify(metrics,null,2),contentType:'application/json'});await context.close();
});
test('structured chapters survive backup normalization and archive searches consequences',async({page})=>{
 await reduced(page);await page.setViewportSize({width:390,height:844});await open(page);await compose(page);await page.locator('#v10FormSave').click();
 await expect(page.locator('#birthOverlay')).toBeVisible();await page.locator('#birthContinue').click();await page.goto('/#archive');await page.locator('#archiveSearch').fill('Спокойствие помогло');
 await expect(page.locator('.v10-archive-row')).toHaveCount(1);
});
