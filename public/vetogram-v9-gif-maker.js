/* Vetogram V9 GIF Studio: user-owned images only, browser-local GIF export. */
import {encodeGif} from './vetogram-v9-gif-core.js';
(() => {
  'use strict';
  const root=document.querySelector('.screen[data-screen="creator"]');
  const $=id=>root?.querySelector('#'+id);
  const canvas=$('v9GifCanvas');
  if(!root||!canvas)return;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  const input=$('v9GifInput'),exportButton=$('v9GifExport'),status=$('v9GifStatus');
  if(!ctx||!exportButton||!status)return;
  const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const effects=new Set(['pulse','float','spin']);
  const SIZE=256,FRAMES=12,MAX_SOURCE=5*1024*1024;
  let image=null,effect='pulse',caption='',busy=false,token=0,frameRequest=0,visible=false;
  const setStatus=message=>{status.textContent=message;};
  function draw(progress=0){
    const t=progress*Math.PI*2;
    ctx.clearRect(0,0,SIZE,SIZE);
    ctx.fillStyle='#090909';ctx.fillRect(0,0,SIZE,SIZE);
    ctx.strokeStyle='#404040';ctx.lineWidth=1;ctx.strokeRect(12.5,12.5,231,231);
    ctx.fillStyle='#eaeaea';ctx.font='700 10px system-ui,sans-serif';
    ctx.fillText('VETOGRAM / GIF STUDIO',23,30);
    if(image){
      const factor=effect==='pulse'?(.84+.08*Math.sin(t)):effect==='spin'?.84:.85;
      const rotation=effect==='spin'?Math.sin(t)*.13:0;
      const y=effect==='float'?Math.sin(t)*9:0;
      const base=Math.min(186/image.naturalWidth,166/image.naturalHeight);
      const width=image.naturalWidth*base*factor,height=image.naturalHeight*base*factor;
      ctx.save();ctx.translate(128,130+y);ctx.rotate(rotation);
      ctx.shadowColor='rgba(255,255,255,.35)';ctx.shadowBlur=12;
      ctx.drawImage(image,-width/2,-height/2,width,height);
      ctx.restore();
    }else{
      ctx.fillStyle='#f5f5f5';ctx.textAlign='center';
      ctx.font='800 74px system-ui,sans-serif';ctx.fillText('V',128,155);
      ctx.textAlign='left';
    }
    if(caption){
      ctx.font='750 16px system-ui,sans-serif';
      let fontSize=16;
      while(ctx.measureText(caption).width>210&&fontSize>10){
        fontSize--;ctx.font='750 '+fontSize+'px system-ui,sans-serif';
      }
      ctx.textAlign='center';
      ctx.fillStyle='rgba(0,0,0,.80)';ctx.fillRect(14,201,228,30);
      ctx.fillStyle='#fff';ctx.fillText(caption,128,222);
      ctx.textAlign='left';
    }
  }
  function stopPreview(){if(frameRequest)cancelAnimationFrame(frameRequest);frameRequest=0;}
  function animate(now){
    if(!visible||document.hidden||reduced?.matches||busy){frameRequest=0;return;}
    draw((now%1200)/1200);
    frameRequest=requestAnimationFrame(animate);
  }
  function syncPreview(){
    stopPreview();draw(0);
    if(visible&&!document.hidden&&!reduced?.matches&&!busy)frameRequest=requestAnimationFrame(animate);
  }
  function applyImage(img){
    image=img;exportButton.disabled=false;
    setStatus('Готово. Анимация создаётся локально; GIF не отправляется на сервер.');
    syncPreview();
  }
  function loadUrl(src){
    const request=++token;
    return new Promise((resolve,reject)=>{
      const img=new Image();
      img.onload=()=>{
        if(request!==token)return resolve(false);
        if(!img.naturalWidth||!img.naturalHeight||img.naturalWidth>4096||img.naturalHeight>4096)
          return reject(new Error('Изображение должно быть не больше 4096×4096.'));
        applyImage(img);resolve(true);
      };
      img.onerror=()=>reject(new Error('Не удалось открыть изображение. Используй PNG, JPG или WEBP.'));
      img.src=src;
    });
  }
  async function loadFile(file){
    if(!file)return;
    if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size<1||file.size>MAX_SOURCE)
      throw new Error('Нужен PNG, JPG или WEBP размером до 5 МБ.');
    const url=URL.createObjectURL(file);
    try{await loadUrl(url);}finally{URL.revokeObjectURL(url);}
  }
  async function exportGif(){
    if(busy||!image)return;
    busy=true;exportButton.disabled=true;stopPreview();
    setStatus('Создаю GIF · 12 кадров · 256×256…');
    try{
      const frames=[];
      for(let i=0;i<FRAMES;i++){
        draw(i/FRAMES);
        frames.push(new Uint8Array(ctx.getImageData(0,0,SIZE,SIZE).data));
      }
      await new Promise(resolve=>setTimeout(resolve,0));
      const bytes=encodeGif({width:SIZE,height:SIZE,frames,delayCs:10,loop:0});
      if(bytes.length>8*1024*1024)throw new Error('GIF слишком большой. Попробуй другое изображение.');
      const url=URL.createObjectURL(new Blob([bytes],{type:'image/gif'}));
      const a=document.createElement('a');a.href=url;a.download='vetogram-motion.gif';
      document.body.append(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),30000);
      setStatus('GIF создан. Если Telegram WebView не скачал файл, открой Vetogram в браузере. Для стикеров Telegram нужен WEBP/WEBM, а не GIF.');
    }catch(error){
      setStatus(error instanceof Error?error.message:'Не удалось создать GIF.');
    }finally{busy=false;exportButton.disabled=!image;syncPreview();}
  }
  input?.addEventListener('change',async event=>{
    try{await loadFile(event.target.files?.[0]);}
    catch(error){setStatus(error.message);}
    finally{event.target.value='';}
  });
  $('v9GifUpload')?.addEventListener('click',()=>input?.click());
  $('v9GifUseStudio')?.addEventListener('click',async()=>{
    const src=document.getElementById('studioAssetImage')?.src||'';
    if(!src.startsWith('data:image/')||src.length>8_000_000){
      setStatus('Сначала загрузи PNG/JPG/WEBP в Студию стикеров выше.');return;
    }
    try{await loadUrl(src);}catch(error){setStatus(error.message);}
  });
  $('v9GifCaption')?.addEventListener('input',event=>{
    caption=String(event.target.value||'').slice(0,24).trim();syncPreview();
  });
  root.querySelectorAll('[data-v9-gif-effect]').forEach(button=>button.addEventListener('click',()=>{
    const next=button.dataset.v9GifEffect;
    if(!effects.has(next))return;
    effect=next;
    root.querySelectorAll('[data-v9-gif-effect]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
    syncPreview();
  }));
  $('v9GifToStickers')?.addEventListener('click',()=>{
    root.querySelector('.studio-workspace')?.scrollIntoView({behavior:reduced?.matches?'auto':'smooth',block:'start'});
    setStatus('Telegram-пакеты создаются выше из PNG/JPG/WEBP или WEBM с явным подтверждением. GIF в пакет напрямую не отправляется.');
  });
  exportButton?.addEventListener('click',exportGif);
  reduced?.addEventListener?.('change',syncPreview);
  document.addEventListener('visibilitychange',syncPreview);
  window.addEventListener('pagehide',stopPreview);
  if(typeof IntersectionObserver==='function'){
    const observer=new IntersectionObserver(entries=>{
      visible=Boolean(entries[0]?.isIntersecting);syncPreview();
    },{threshold:0.01});observer.observe(canvas);
  }else{visible=true;syncPreview();}
  draw(0);
})();
