const {test,expect}=require('./browser-fixtures.cjs');

test('V19 PEOPLE presents concise supplied source material rather than four invented chapters',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/#story/1');
 const reader=page.locator('#drawer');
 await expect(reader).toBeVisible();
 await expect(reader.locator('.v12-memory-hero')).toBeVisible();
 await expect(reader.locator('.v10-chapter')).toHaveCount(2);
 await expect(reader.locator('[data-chapter="decision"]')).toHaveCount(0);
 await expect(reader.locator('.v19-source-coverage')).toBeVisible();
 await reader.locator('[data-v10-chapter="1"]').click();
 await expect(reader.locator('[data-v10-chapter="1"]')).toHaveAttribute('aria-current','step');
 await expect(reader.locator('.v12-story-actions #memoryBack')).toBeVisible();
 await reader.locator('#memoryBack').click();
 await expect(reader).toBeHidden();
});

test('V19 EVENT globe selects a year without opening the large information dossier',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/?mm=events#universe');
 const panel=page.locator('#mhHistoryPanel');
 await expect(page.locator('#mhPlanetSurface')).toBeVisible();
 await expect(panel).toBeVisible();
 await expect(panel.locator('.mh-timeline button')).toHaveCount(4);
 await panel.locator('.mh-timeline [data-mh-event="1987"]').click();
 await expect(panel).not.toHaveClass(/is-expanded/);
 await expect(panel.locator('.mh-v19-preview')).toBeVisible();
 await expect(panel).toContainText('Чёрный понедельник');
 await panel.locator('.mh-panel-grip').click();
 await expect(panel).toHaveClass(/is-expanded/);
 await expect(panel.locator('.mh-v19-context')).toBeVisible();
 await expect(panel.locator('.mh-v19-neighbors')).toBeVisible();
 await expect(panel.locator('.mh-v16-research-card')).toHaveCount(3);
 await panel.locator('.mh-v19-neighbors [data-mh-event="2008"]').click();
 await expect(panel).not.toHaveClass(/is-expanded/);
 await expect(panel).toContainText('Банкротство Lehman Brothers');
 await page.locator('#mhBackToPeople').click();
 await expect(page.locator('#gl')).toBeVisible();
 await expect(page.locator('#mhPlanetSurface')).toBeHidden();
});

test('V19.1 research bridge opens dated event and Back restores PEOPLE on Android',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/#story/13'); // QUARTZ: explicitly fictional and fully authored.
 const reader=page.locator('#drawer');
 await expect(reader.locator('.v10-chapter')).toHaveCount(4);
 const parallel=reader.locator('.v19-history-bridge');
 await expect(parallel).toContainText('1987');
 await expect(parallel).toContainText('тематическая аналогия');
 await parallel.locator('button').click();
 await expect(page.locator('#mhHistoryPanel')).toBeVisible();
 await expect(page.locator('#mhHistoryPanel')).toContainText('Чёрный понедельник');
 await expect(page).toHaveURL(/mm=events/);
 await expect(reader).toBeHidden();
 await page.goBack();
 await expect(page.locator('#app')).toHaveAttribute('data-mh-mode','people');
 await expect(page).not.toHaveURL(/mm=events/);
});

test('V19.1 event dossier grip preserves keyboard focus and can be collapsed',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/?mm=events#universe');
 const panel=page.locator('#mhHistoryPanel');
 const grip=panel.locator('.mh-panel-grip');
 await grip.focus();
 await page.keyboard.press('Enter');
 await expect(panel).toHaveClass(/is-expanded/);
 await expect(grip).toBeFocused();
 await page.keyboard.press('Enter');
 await expect(panel).not.toHaveClass(/is-expanded/);
 await expect(grip).toBeFocused();
 await page.keyboard.press('Enter');
 await expect(panel).toHaveClass(/is-expanded/);
 await page.keyboard.press('Escape');
 await expect(panel).not.toHaveClass(/is-expanded/);
 await expect(grip).toBeFocused();
 await panel.locator('.mh-timeline [data-mh-event="1907"]').focus();
 await page.keyboard.press('ArrowRight');
 await expect(page).toHaveURL(/event=1987/);
 await expect(panel.locator('.mh-timeline [data-mh-event="1987"]')).toBeFocused();
});

test('V19.2 EVENT globe exposes a live reset button without discarding selected date',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/?mm=events&event=2008#universe');
 const button=page.locator('#mhResetEventView');
 await expect(button).toBeVisible();
 await expect(button).toHaveAttribute('aria-label','Вернуть исторические метки на глобус');
 const original=await page.evaluate(()=>{
  const item=window.MarketHistoryModes.events.find(event=>event.id==='2008');
  return window.MarketEventPlanet.project(item.p).depth;
 });
 await button.click();
 await expect(page.locator('#mhHistoryPanel')).toContainText('Банкротство Lehman Brothers');
 await expect.poll(async()=>page.evaluate(()=>{
  const item=window.MarketHistoryModes.events.find(event=>event.id==='2008');
  return window.MarketEventPlanet.project(item.p).depth;
 })).toBeGreaterThan(Math.max(.90,original-.1));
});

test('V19.3 EVENT supports two-finger zoom and recovers the selected year',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/?mm=events&event=2008#universe');
 const projected=await page.evaluate(()=>{
  const wrapper=document.getElementById('mhPlanetSurface');
  const eventRecords=window.MarketHistoryModes.events;
  const first=eventRecords.find(e=>e.id==='1907').p;
  const second=eventRecords.find(e=>e.id==='2020').p;
  const scale=()=>{
   const a=window.MarketEventPlanet.project(first);
   const b=window.MarketEventPlanet.project(second);
   return Math.hypot(a.x-b.x,a.y-b.y);
  };
  const before=scale();
  const originalCapture=wrapper.setPointerCapture;
  // Synthetic mouse/touch sequence is deterministic; browser capture itself
  // requires a live hardware pointer and is not the subject of this test.
  wrapper.setPointerCapture=()=>{};
  const emit=(type,id,x,y)=>wrapper.dispatchEvent(new PointerEvent(type,{
   bubbles:true,cancelable:true,pointerId:id,pointerType:'touch',
   button:0,buttons:type==='pointerup'?0:1,clientX:x,clientY:y
  }));
  try{
   emit('pointerdown',1,165,290);
   emit('pointerdown',2,220,290);
   emit('pointermove',2,310,290);
   const after=scale();
   emit('pointerup',2,310,290);
   emit('pointerup',1,165,290);
   return{before,after};
  }finally{wrapper.setPointerCapture=originalCapture;}
 });
 expect(projected.after).toBeGreaterThan(projected.before*1.06);
 await page.locator('#mhResetEventView').click();
 await expect(page).toHaveURL(/event=2008/);
 await expect(page.locator('#mhHistoryPanel')).toContainText('Банкротство Lehman Brothers');
});
