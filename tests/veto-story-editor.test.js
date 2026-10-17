import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const js=read('public/story-editor.js');
function geometry(){
  const start=js.indexOf('  function coverGeometry(');
  const end=js.indexOf('  function filterCss(',start);
  assert.ok(start>=0&&end>start);
  const ctx={W:720,H:1280,cap:(v,a,b)=>Math.min(b,Math.max(a,Number(v)||0))};
  return vm.runInNewContext(js.slice(start,end)+'\ncoverGeometry',ctx);
}
test('9:16 crop centers landscape/portrait photos without letterboxing',()=>{
  const cover=geometry();
  const landscape=cover(1920,1080);
  assert.ok(Math.abs(landscape.height-1280)<.001);
  assert.ok(landscape.width>720);
  assert.ok(landscape.dx<0);
  const vertical=cover(1080,1920);
  assert.deepEqual(JSON.parse(JSON.stringify(vertical)),{dx:0,dy:0,width:720,height:1280});
  const moved=cover(1920,1080,1,-1,0);
  assert.equal(moved.dx,2*landscape.dx);
  const clamped=cover(1920,1080,99,4,-4);
  assert.ok(clamped.dx<=0&&clamped.dy<=0);
  assert.ok(clamped.width>720&&clamped.height>1280);
});
test('editor is private: local Canvas API, no remote uploads or automatic publishing',()=>{
  const html=read('public/studio.html'),app=read('public/app.js');
  assert.ok(js.includes("canvas.toBlob("));
  assert.ok(js.includes("'image/jpeg',.87"));
  assert.ok(js.includes("OUTPUT_W=1080,OUTPUT_H=1920"));
  assert.ok(js.includes('drawImage(photo,'));
  assert.ok(js.includes('new File([blob]'));
  assert.ok(js.includes('window.dispatchEvent(new CustomEvent(\'veto:story-edited\''));
  assert.ok(app.includes("window.addEventListener('veto:story-edited'"));
  assert.ok(app.includes('void prepareComposerFile(file)'));
  assert.ok(app.includes("await api('publish_story'"));
  assert.ok(app.includes('telegramAccountReady()'));
  assert.ok(js.includes('Секретные')===false);
  for(const dangerous of ['fetch(','XMLHttpRequest','sendBeacon','localStorage','supabase','BOT_TOKEN'])
    assert.ok(!js.includes(dangerous),'Editor must remain fully client-side: '+dangerous);
  assert.ok(html.includes('id="vetoStoryEditor"'));
  assert.ok(html.includes('id="vetoStoryEditOpen"'));
  assert.ok(html.includes('src="/story-editor.js?'));
  assert.ok(html.includes('href="/story-editor.css?'));
});
test('Magic Styles are accurately labeled LOCAL and let users customize photo and typography',()=>{
  const html=read('public/studio.html'),style=read('public/story-editor.css');
  for(const key of ['editorial','cinematic','minimal','warm','original'])
    assert.ok(html.includes('data-story-look="'+key+'"'));
  for(const key of ['Brightness','Contrast','Saturation','Warmth','Vignette','Zoom','TextSize']){
    assert.ok(html.includes('id="vetoStory'+key+'"'));
  }
  for(const pos of ['top','center','bottom'])
    assert.ok(html.includes('data-story-text-position="'+pos+'"'));
  assert.ok(js.includes('maxLines=3'));
  assert.ok(js.includes('cap(settings.panX+'));
  assert.ok(js.includes('filterCss(s)'));
  assert.ok(html.includes('без AI-генерации'));
  assert.ok(style.includes('prefers-reduced-motion:reduce'));
  assert.ok(style.includes('env(safe-area-inset-top'));
  assert.ok(style.includes('@media(min-width:790px)'));
});
test('no unrequested automated Story publishing, and editor integration respects existing audience gates',()=>{
  const app=read('public/app.js'),html=read('public/studio.html');
  assert.ok(app.includes("if (state.audience === 'selected' && !state.selected?.length)"));
  assert.ok(app.includes("if (state.excluded?.length && !['all', 'contacts'].includes(state.audience))"));
  assert.ok(app.includes("$('vetoStoryEditEntry').hidden=false"));
  assert.ok(app.includes("if($('vetoStoryEditEntry'))$('vetoStoryEditEntry').hidden=true"));
  assert.ok(app.includes("if(!(file instanceof File)"));
  assert.ok(js.includes('if(file.size>20*1024*1024)'));
  assert.ok(js.includes('thisEpoch!==epoch'));
  assert.ok(js.includes('undoStack.push({...lastCommitted})'));
  assert.ok(js.includes('redoStack=[];lastCommitted={...settings}'));
  assert.ok(js.includes('if(undoStack.length>25)undoStack.shift()'));
  assert.ok(html.includes('id="vetoStoryUndo"'));
  assert.ok(html.includes('id="vetoStoryRedo"'));
  assert.ok(js.includes('moveHistory(undoStack,redoStack)'));
  assert.ok(js.includes('moveHistory(redoStack,undoStack)'));
  assert.ok(js.includes("window.addEventListener('pagehide',()=>close())"));
  assert.ok(html.includes('Черновик'));
  assert.ok(js.includes('a.download=file.name'));
});

test('canvas export actually composes the source photograph, vignette and burned-in caption',()=>{
  const start=js.indexOf('  function coverGeometry(');
  const stop=js.indexOf('  function requestRender(){',start);
  assert.ok(start>0&&stop>start);
  const ctx={W:720,H:1280,cap:(v,a,b)=>Math.min(b,Math.max(a,Number(v)||0)),
    photoSize:p=>({width:p.naturalWidth||p.width,height:p.naturalHeight||p.height})};
  const draw=vm.runInNewContext(js.slice(start,stop)+'\n({drawFrame,coverGeometry})',ctx);
  const calls=[];
  const noop=()=>{};
  const canvas={width:1080,height:1920};
  const paint={
    clearRect:noop,fillRect:(...values)=>calls.push(['fillRect',...values]),
    save:noop,restore:noop,drawImage:(...values)=>calls.push(['drawImage',...values]),
    createRadialGradient:()=>({addColorStop:noop}),
    createLinearGradient:()=>({addColorStop:noop}),
    measureText:text=>({width:String(text).length*20}),
    fillText:(...values)=>calls.push(['fillText',...values]),
  };
  const photo={naturalWidth:2200,naturalHeight:1400};
  const config={brightness:6,contrast:14,saturation:-9,warmth:3,
    vignette:30,zoom:1.2,panX:0,panY:0,text:'A BEAUTIFUL STORY',
    textPosition:'bottom',textTone:'light',textSize:56};
  draw.drawFrame(canvas,paint,photo,config);
  const image=calls.find(row=>row[0]==='drawImage');
  assert.ok(image);
  assert.equal(image[1],photo);
  assert.ok(image[4]>1080);
  assert.ok(image[5]>=1920);
  assert.ok(String(paint.filter).includes('brightness('));
  assert.ok(calls.some(row=>row[0]==='fillText'&&row[1].includes('STORY')));
  assert.ok(calls.filter(row=>row[0]==='fillRect').length>=2);
});
