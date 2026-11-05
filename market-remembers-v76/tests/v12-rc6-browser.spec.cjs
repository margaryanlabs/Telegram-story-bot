const {test,expect}=require('./browser-fixtures.cjs');

// RC6 cinematic globe acceptance on the REAL production-shaped static page.
// No screenshots or data leave the Playwright test environment.
test('RC6 material compiles in WebGL1 and renders its actual sphere',async({page})=>{
  await page.addInitScript(()=>{
    window.__rc6Compiled=[];
    const orig=WebGLRenderingContext.prototype.compileShader;
    WebGLRenderingContext.prototype.compileShader=function(shader){
      orig.call(this,shader);
      const ok=this.getShaderParameter(shader,this.COMPILE_STATUS);
      window.__rc6Compiled.push({
        type:this.getShaderParameter(shader,this.SHADER_TYPE),
        ok,log:ok?'':this.getShaderInfoLog(shader)
      });
    };
  });
  await page.setViewportSize({width:390,height:844});
  await page.goto('/?qa=1');
  await expect(page.locator('#scene')).toBeVisible();
  await expect(page.locator('#qaStatus')).toContainText('WEBGL1');
  const status=await page.evaluate(()=>{
    const compiled=window.__rc6Compiled||[];
    const canvas=document.getElementById('gl');
    const gl=canvas.getContext('webgl');
    return {compiled,hasGl:!!gl,coreVisible:canvas.style.display!=='none',
      programs:compiled.length};
  });
  expect(status.hasGl).toBe(true);
  expect(status.coreVisible).toBe(true);
  expect(status.programs).toBeGreaterThanOrEqual(6);
  expect(status.compiled.every(x=>x.ok),JSON.stringify(status.compiled)).toBe(true);
  await expect(page.locator('#fallback')).toBeHidden();
});

test('RC6 optical layers do not steal touches; globe zoom and orbit scale together',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  await expect(page.locator('#scene')).toBeVisible();
  const layering=await page.evaluate(()=>{
    const names=['.v124-depth-field','.v81-globe-aura','.v126-orbit-guide','.scene-shading'];
    return names.map(name=>{
      const el=document.querySelector(name),style=el&&getComputedStyle(el);
      return {name,exists:!!el,pointerEvents:style?.pointerEvents||null};
    });
  });
  for(const el of layering){
    expect(el.exists,el.name).toBe(true);
    expect(el.pointerEvents,el.name).toBe('none');
  }
  const aura=page.locator('#v81Aura');
  const before=await aura.evaluate(el=>el.getBoundingClientRect().width);
  await page.locator('#minusZoom').click();
  await expect.poll(()=>aura.evaluate(el=>el.getBoundingClientRect().width)).toBeLessThan(before-2);
  await page.locator('#plusZoom').click();
  await expect.poll(()=>aura.evaluate(el=>el.getBoundingClientRect().width)).toBeGreaterThan(before-5);

  const marker=page.locator('.star-marker[aria-hidden="false"]').first();
  await expect(marker).toBeVisible();
  await marker.click();
  await expect(page.locator('#memoryDive, #drawer').filter({visible:true}).first()).toBeVisible();
});

test('RC6 low-power mobile Canvas fallback keeps silhouette and readable stars',async({page})=>{
  await page.addInitScript(()=>{
    const original=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(type,...args){
      return /^webgl/.test(type)?null:original.call(this,type,...args);
    };
  });
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  await expect(page.locator('#fallback')).toBeVisible();
  const metrics=await page.evaluate(()=>{
    const c=document.getElementById('fallback');
    const ctx=c.getContext('2d');
    const aura=document.getElementById('v81Aura');
    const a=aura.getBoundingClientRect(),cv=c.getBoundingClientRect();
    const x=Math.min(c.width-1,Math.max(0,Math.round((a.left+a.width/2-cv.left)*c.width/cv.width)));
    const y=Math.min(c.height-1,Math.max(0,Math.round((a.top+a.height/2-cv.top)*c.height/cv.height)));
    const pixel=ctx.getImageData(x,y,1,1).data;
    return {width:c.width,height:c.height,pixel:[...pixel],orbit:!!aura.querySelector('.v126-orbit-guide')};
  });
  expect(metrics.width).toBeGreaterThan(0);
  expect(metrics.height).toBeGreaterThan(0);
  expect(metrics.orbit).toBe(true);
  expect(metrics.pixel[3]).toBeGreaterThan(150);
  await expect(page.locator('#dockOpen')).toBeVisible();
});

test('RC6 visual baselines: mobile and desktop universe are inspectable',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  for(const viewport of [{width:390,height:844},{width:1280,height:800}]){
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(page.locator('#scene')).toBeVisible();
    await expect(page.locator('#v81Aura')).toBeVisible();
    await page.screenshot({
      path:'test-results/rc6-universe-'+viewport.width+'x'+viewport.height+'.png',
      animations:'disabled'
    });
    const info=await page.evaluate(()=>({
      scroll:document.documentElement.scrollWidth,
      width:window.innerWidth,
      stars:document.querySelectorAll('.star-marker').length
    }));
    expect(info.scroll).toBeLessThanOrEqual(info.width+1);
    expect(info.stars).toBeGreaterThan(0);
  }
});
