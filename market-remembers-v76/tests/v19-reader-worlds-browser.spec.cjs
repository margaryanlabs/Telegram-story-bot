const {test,expect}=require('./browser-fixtures.cjs');

test('V19 PEOPLE presents concise real source material rather than four invented chapters',async({page})=>{
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
 await panel.locator('.mh-timeline [data-mh-event="1907"]').focus();
 await page.keyboard.press('ArrowRight');
 await expect(page).toHaveURL(/event=1987/);
 await expect(panel.locator('.mh-timeline [data-mh-event="1987"]')).toBeFocused();
});
