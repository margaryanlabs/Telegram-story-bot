import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const projectSrc=read('public/story-project.js');
function harness(){
  const realPhoto=Buffer.from([0xff,0xd8,0xff,...Array.from({length:120},(_,i)=>i%251),0xff,0xd9]);
  const created=[];
  class TestFile {
    constructor(parts,name,opts={}){
      this.name=name;this.type=opts.type||'';
      this.bytes=Buffer.concat(parts.map(part=>{
        if(Buffer.isBuffer(part))return part;
        if(part?.bytes)return part.bytes;
        if(typeof part==='string')return Buffer.from(part,'utf8');
        if(part instanceof Uint8Array)return Buffer.from(part);
        throw Error('Unexpected test file type');
      }));
      this.size=this.bytes.length;
    }
    async text(){return this.bytes.toString('utf8');}
  }
  const context={
    window:{},Date,Number,String,Uint8Array,Buffer,Math,Promise,JSON,
    atob:base64=>Buffer.from(base64,'base64').toString('binary'),
    File:TestFile,
    document:{createElement:()=>{
      const canvas={
        width:0,height:0,
        getContext:()=>({fillRect(){},drawImage(photo,...args){created.push({photo,args});}}),
        toBlob(callback){callback(new Blob([realPhoto],{type:'image/jpeg'}));},
      };
      return canvas;
    }},
    FileReader:class{
      readAsDataURL(blob){
        void blob.arrayBuffer().then(bytes=>{
          this.result='data:image/jpeg;base64,'+Buffer.from(bytes).toString('base64');
          this.onload?.();
        });
      }
    },
  };
  vm.runInNewContext(projectSrc,context);
  return {api:context.window.VetoStoryProject,TestFile,realPhoto,created};
}
test('editable VETO Story project roundtrips on device without sending any network request',async()=>{
  const {api,created}=harness();
  const settings={
    look:'cinematic',brightness:-4,contrast:20,saturation:-10,warmth:-12,
    vignette:50,zoom:1.17,panX:-0.55,panY:0.2,
    text:'Открытие магазина',textSize:70,textPosition:'center',
    eyebrow:'NEW COLLECTION',callToAction:'DISCOVER MORE',accent:'#e5edef',
  };
  const image={naturalWidth:2000,naturalHeight:1500};
  const file=await api.create(image,settings);
  assert.ok(file.name.endsWith('.vetostory'));
  assert.equal(file.type,'application/json');
  assert.ok(file.size<api.maxFileBytes);
  const json=JSON.parse(await file.text());
  assert.equal(json.signature,'VETO-STORY');
  assert.equal(json.version,1);
  assert.ok(json.photo.startsWith('data:image/jpeg;base64,'));
  assert.equal(json.settings.text,settings.text);
  assert.equal(created.length,1);
  const restored=await api.parse(file);
  assert.equal(restored.file.type,'image/jpeg');
  assert.equal(restored.settings.callToAction,'DISCOVER MORE');
  assert.equal(restored.settings.eyebrow,'NEW COLLECTION');
  assert.equal(restored.settings.accent,'#e5edef');
  assert.equal(restored.settings.panX,-.55);
  assert.equal(restored.settings.look,'cinematic');
  for(const forbidden of ['fetch(', 'XMLHttpRequest', 'sendBeacon', 'localStorage',
    'sessionStorage', 'indexedDB', 'SUPABASE', 'telegram.initData'])
    assert.ok(!projectSrc.includes(forbidden),'No network/persistence '+forbidden);
});
test('tampered or untrusted project settings are clamped and HTML can never be injected',()=>{
  const {api}=harness();
  const result=api.normalize({
    zoom:1000,panX:-9,saturation:900,brightness:'NaN',
    text:'👀'.repeat(160),callToAction:'BUY!'.repeat(70),
    textPosition:'javascript:alert(1)',look:'unknown',accent:'red',
    eyebrow:'x'.repeat(300),unknownProperty:'secret',
  });
  assert.equal(result.zoom,2.3);
  assert.equal(result.panX,-1);
  assert.equal(result.saturation,70);
  assert.equal(result.brightness,0);
  assert.equal(result.text.length,140);
  assert.equal(result.callToAction.length,32);
  assert.equal(result.eyebrow.length,32);
  assert.equal(result.textPosition,'bottom');
  assert.equal(result.look,'editorial');
  assert.equal(result.accent,'#ffffff');
  assert.equal(result.unknownProperty,undefined);
});
test('malformed photo payload and wrong VETO project version fail closed',async()=>{
  const {api,TestFile,realPhoto}=harness();
  const file=(value)=>new TestFile([JSON.stringify({...value,padding:'x'.repeat(120)})],'bad.vetostory',
    {type:'application/json'});
  const photo='data:image/jpeg;base64,'+realPhoto.toString('base64');
  await assert.rejects(()=>api.parse(file({signature:'INVALID',version:1,photo})),
    /не поддерживаемый/);
  await assert.rejects(()=>api.parse(file({signature:'VETO-STORY',version:999,photo})),
    /не поддерживаемый/);
  await assert.rejects(()=>api.parse(file({signature:'VETO-STORY',version:1,photo:'https://evil.test/photo.jpg'})),
    /неподдерживаемое фото/);
  await assert.rejects(()=>api.parse(file({signature:'VETO-STORY',version:1,photo:'data:text/html;base64,PHNjcmlwdD4='})),
    /неподдерживаемое фото/);
  const fake='data:image/jpeg;base64,'+Buffer.from('this is not a jpg '.repeat(12)).toString('base64');
  await assert.rejects(()=>api.parse(file({signature:'VETO-STORY',version:1,photo:fake})),
    /повреждённое/);
  const giant=new TestFile([Buffer.alloc(api.maxFileBytes+1)],'giant.vetostory');
  await assert.rejects(()=>api.parse(giant),/слишком большой/);
});
test('creator surface has real user-photo look previews and independent CTA/eyebrow layers in export',()=>{
  const js=read('public/story-editor.js'),html=read('public/studio.html');
  assert.ok(js.includes("context.fillText(eyebrow"));
  assert.ok(js.includes("context.fillText(call.toUpperCase()"));
  assert.ok(js.includes("drawFrame(canvas,context,image,{...settings,...preset,text:'',eyebrow:'',callToAction:''})"));
  for(const name of ['editorial','cinematic','minimal','warm','original']){
    assert.ok(html.includes('data-story-look-preview="'+name+'"'));
  }
  assert.ok(js.includes("'vetoStoryEyebrow','eyebrow',32"));
  assert.ok(js.includes("'vetoStoryCallToAction','callToAction',32"));
  assert.ok(js.includes('if(exporting||!image)return'));
  assert.ok(js.includes('if(generation!==epoch||panel.hidden)return'));
  assert.ok(html.includes('Сохрани проект файлом'));
  assert.ok(html.includes('.vetostory'));
});

test('three campaign starters create editable layered photo Stories without AI calls',()=>{
  const html=read('public/studio.html'),js=read('public/story-editor.js');
  for(const key of ['launch','event','offer']){
    assert.ok(html.includes('data-story-campaign="'+key+'"'));
    assert.ok(js.includes(key+':{eyebrow:'));
  }
  assert.ok(js.includes('settings={...settings,...preset};syncControls();commitEdit();requestRender()'));
  assert.ok(js.includes("showState('Шаблон применён."));
  assert.ok(!js.includes('OpenAI'));
  assert.ok(!js.includes('fetch('));
});

test('campaign elements render actual badge and CTA on the same 9:16 Canvas as the photograph',()=>{
  const src=read('public/story-editor.js');
  const start=src.indexOf('  function coverGeometry(');
  const stop=src.indexOf('  function renderLookPreviews(){',start);
  assert.ok(start>0&&stop>start);
  const api=vm.runInNewContext(src.slice(start,stop)+'\n({drawFrame})',{
    W:720,H:1280,
    cap:(v,min,max)=>Math.min(max,Math.max(min,Number(v)||0)),
    photoSize:p=>({width:p.width,height:p.height}),
  });
  const drawn=[];
  const context={
    filter:'none',fillStyle:'#fff',save(){},restore(){},clearRect(){},
    drawImage:(...args)=>drawn.push(['image',...args]),
    fillRect:(...args)=>drawn.push(['rectangle',...args]),
    createRadialGradient:()=>({addColorStop(){}}),
    createLinearGradient:()=>({addColorStop(){}}),
    measureText:t=>({width:String(t).length*12}),
    fillText:(...args)=>drawn.push(['label',...args]),
  };
  api.drawFrame({width:1080,height:1920},context,{width:1200,height:1200},{
    brightness:0,contrast:10,saturation:0,warmth:0,zoom:1,vignette:20,
    panX:0,panY:0,look:'editorial',text:'Новое меню',
    textPosition:'center',textSize:56,
    eyebrow:'TONIGHT',callToAction:'ЗАБРОНИРОВАТЬ',
    accent:'#e3c3a1',
  });
  assert.ok(drawn.some(x=>x[0]==='image'));
  assert.ok(drawn.some(x=>x[0]==='label'&&x[1]==='TONIGHT'));
  assert.ok(drawn.some(x=>x[0]==='label'&&x[1]==='ЗАБРОНИРОВАТЬ'));
  assert.ok(drawn.some(x=>x[0]==='label'&&x[1].includes('меню')));
  assert.ok(drawn.filter(x=>x[0]==='rectangle').length>=3);
});
