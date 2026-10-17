(() => {
  'use strict';
  // Browser-only VETO Story Studio 1.0. All editing remains on device.
  // Presets are deterministic local styles, not generative AI.
  const $=id=>document.getElementById(id);
  const panel=$('vetoStoryEditor'),preview=$('vetoStoryCanvas');
  if(!panel||!preview)return;
  const ctx=preview.getContext('2d',{alpha:false});
  const effects={
    editorial:{brightness:0,contrast:10,saturation:-12,warmth:0,vignette:22,zoom:1.0,title:'EDITORIAL'},
    cinematic:{brightness:-4,contrast:24,saturation:-18,warmth:-8,vignette:44,zoom:1.04,title:'CINEMATIC'},
    minimal:{brightness:7,contrast:2,saturation:-32,warmth:2,vignette:8,zoom:1.0,title:'MINIMAL'},
    warm:{brightness:7,contrast:12,saturation:8,warmth:23,vignette:20,zoom:1.0,title:'SOFT LIGHT'},
    original:{brightness:0,contrast:0,saturation:0,warmth:0,vignette:0,zoom:1,title:''},
  };
  const defaultSettings=()=>({...effects.editorial,look:'editorial',text:'',textPosition:'bottom',textTone:'light',textSize:56,panX:0,panY:0});
  let image=null,sourceFile=null,sourceUrl='',settings=defaultSettings();
  let painting=false,renderQueued=false,epoch=0,lastPoint=null;
  let undoStack=[],redoStack=[],lastCommitted={...settings};
  const W=720,H=1280,OUTPUT_W=1080,OUTPUT_H=1920;
  const cap=(n,min,max)=>Math.min(max,Math.max(min,Number(n)||0));
  const photoSize=(source)=>({width:source.naturalWidth||source.width,height:source.naturalHeight||source.height});
  function coverGeometry(width,height,zoom=1,panX=0,panY=0,outputWidth=W,outputHeight=H){
    const scale=Math.max(outputWidth/width,outputHeight/height)*cap(zoom,1,2.3);
    const dw=width*scale,dh=height*scale;
    const spareX=Math.max(0,(dw-outputWidth)/2),spareY=Math.max(0,(dh-outputHeight)/2);
    return {
      dx:(outputWidth-dw)/2+cap(panX,-1,1)*spareX,
      dy:(outputHeight-dh)/2+cap(panY,-1,1)*spareY,
      width:dw,height:dh,
    };
  }
  function filterCss(s){
    const brightness=cap(100+s.brightness,45,160);
    const contrast=cap(100+s.contrast,55,160);
    const saturation=cap(100+s.saturation,0,190);
    const sepia=cap(Math.max(0,s.warmth),0,50);
    const hue=cap(Math.min(0,s.warmth),-45,0);
    return `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) sepia(${sepia}%) hue-rotate(${hue}deg)`;
  }
  function wrapLines(context,string,maxWidth,maxLines=3){
    const words=String(string||'').replace(/[\r\n]+/g,' ').split(/\s+/).filter(Boolean);
    const lines=[];let current='';
    for(const word of words){
      if(!current){current=word;continue;}
      if(context.measureText(current+' '+word).width>maxWidth){
        lines.push(current);current=word;
        if(lines.length>=maxLines)break;
      }else current+=' '+word;
    }
    if(current&&lines.length<maxLines)lines.push(current);
    return lines.map(line=>line.slice(0,105));
  }
  function drawFrame(canvas,context,photo,s){
    const w=canvas.width,h=canvas.height,m=w/W,ratio=h/H;
    context.clearRect(0,0,w,h);
    context.fillStyle='#11151b';context.fillRect(0,0,w,h);
    if(photo){
      const dim=photoSize(photo);
      const g=coverGeometry(dim.width,dim.height,s.zoom,s.panX,s.panY,w,h);
      context.save();
      context.filter=filterCss(s);
      context.drawImage(photo,g.dx,g.dy,g.width,g.height);
      context.restore();
    }
    if(s.vignette>0){
      const gradient=context.createRadialGradient(w/2,h*.42,w*.1,w/2,h*.5,h*.9);
      gradient.addColorStop(0,'rgba(0,0,0,0)');
      gradient.addColorStop(1,`rgba(0,0,0,${cap(s.vignette,0,80)/125})`);
      context.fillStyle=gradient;context.fillRect(0,0,w,h);
    }
    const text=String(s.text||'').trim().slice(0,140);
    if(text){
      const pos=s.textPosition||'bottom';
      const gradient=context.createLinearGradient(0,pos==='top'?h*.03:h*.47,0,pos==='top'?h*.57:h);
      gradient.addColorStop(0,pos==='top'?'rgba(0,0,0,.58)':'rgba(0,0,0,0)');
      gradient.addColorStop(1,pos==='top'?'rgba(0,0,0,0)':'rgba(0,0,0,.64)');
      context.fillStyle=gradient;context.fillRect(0,0,w,h);
      const font=cap(s.textSize,34,92)*m;
      context.font=`800 ${font}px Inter, system-ui, Arial, sans-serif`;
      context.textAlign='left';context.textBaseline='middle';
      const lines=wrapLines(context,text,w*.84,3);
      const lineHeight=font*1.12;
      const total=lines.length*lineHeight;
      const center=pos==='top'?h*.22:pos==='center'?h*.5:h*.77;
      context.fillStyle=s.textTone==='dark'?'#152232':'#fff';
      // Contrast protection against variable photograph brightness.
      context.shadowColor=s.textTone==='dark'?'rgba(255,255,255,.45)':'rgba(0,0,0,.65)';
      context.shadowBlur=12*m;
      lines.forEach((line,i)=>context.fillText(line,w*.085,center-total/2+(i+.5)*lineHeight,w*.84));
      context.shadowBlur=0;
    }
  }
  function requestRender(){
    if(renderQueued)return;
    renderQueued=true;
    requestAnimationFrame(()=>{
      renderQueued=false;
      if(image&&panel&&!panel.hidden)drawFrame(preview,ctx,image,settings);
    });
  }
  function showState(message,bad=false){
    const label=$('vetoStoryEditorStatus');
    if(label){label.textContent=message;label.dataset.error=bad?'true':'false';}
  }
  function syncControls(){
    for(const name of ['brightness','contrast','saturation','warmth','vignette','zoom']){
      const input=$('vetoStory'+name.charAt(0).toUpperCase()+name.slice(1));
      if(input){input.value=String(settings[name]);const label=$('vetoStoryValue'+name);if(label)label.textContent=name==='zoom'?settings.zoom.toFixed(2)+'×':settings[name]>0?'+'+settings[name]:String(settings[name]);}
    }
    if($('vetoStoryOverlay'))$('vetoStoryOverlay').value=settings.text;
    if($('vetoStoryTextSize'))$('vetoStoryTextSize').value=String(settings.textSize);
    panel.querySelectorAll('[data-story-look]').forEach(el=>{
      const active=el.dataset.storyLook===settings.look;
      el.classList.toggle('active',active);el.setAttribute('aria-pressed',String(active));
    });
    panel.querySelectorAll('[data-story-text-position]').forEach(el=>{
      const active=el.dataset.storyTextPosition===settings.textPosition;
      el.setAttribute('aria-pressed',String(active));el.classList.toggle('active',active);
    });
  }
  function syncHistory(){
    if($('vetoStoryUndo'))$('vetoStoryUndo').disabled=!undoStack.length;
    if($('vetoStoryRedo'))$('vetoStoryRedo').disabled=!redoStack.length;
  }
  function commitEdit(){
    if(JSON.stringify(lastCommitted)===JSON.stringify(settings))return;
    undoStack.push({...lastCommitted});if(undoStack.length>25)undoStack.shift();
    redoStack=[];lastCommitted={...settings};
    syncHistory();
  }
  function moveHistory(source,target){
    if(!source.length)return;
    target.push({...lastCommitted});
    settings={...source.pop()};lastCommitted={...settings};
    syncControls();syncHistory();requestRender();
  }
  function resetFilters(){
    settings=defaultSettings();syncControls();commitEdit();requestRender();
  }
  function close({dispose=true}={}){
    panel.hidden=true;document.body.classList.remove('veto-story-editing');
    painting=false;lastPoint=null;
    if(dispose){
      epoch++;
      try{image?.close?.();}catch{}
      image=null;sourceFile=null;
      if(sourceUrl){URL.revokeObjectURL(sourceUrl);sourceUrl='';}
    }
  }
  async function open(file){
    if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type)){
      showState('Выбери изображение JPG, PNG или WEBP.',true);
      return;
    }
    if(file.size>20*1024*1024){showState('Максимальный размер — 20 MB.',true);return;}
    const thisEpoch=++epoch;
    if(sourceUrl){URL.revokeObjectURL(sourceUrl);sourceUrl='';}
    try{image?.close?.();}catch{}
    image=null;sourceFile=null;
    panel.hidden=false;document.body.classList.add('veto-story-editing');
    settings=defaultSettings();undoStack=[];redoStack=[];lastCommitted={...settings};
    syncControls();syncHistory();
    showState('Открываю фотографию на устройстве…');
    try{
      let decoded;
      if(window.createImageBitmap){
        try{decoded=await createImageBitmap(file,{imageOrientation:'from-image'});}catch{}
      }
      if(!decoded){
        const url=URL.createObjectURL(file),element=new Image();
        sourceUrl=url;element.decoding='async';element.src=url;
        await element.decode();decoded=element;
      }
      if(thisEpoch!==epoch||panel.hidden){try{decoded.close?.();}catch{}return;}
      const dim=photoSize(decoded);
      if(!dim.width||!dim.height||dim.width*dim.height>36e6)
        throw Error('Фото слишком большое для обработки на этом устройстве.');
      image=decoded;sourceFile=file;
      const size=`${dim.width} × ${dim.height}`;
      $('vetoStoryOriginalSize').textContent=size;
      showState('Локальный редактор · фотографии не отправляются на сервер до публикации.');
      requestRender();
    }catch(error){
      if(thisEpoch===epoch){showState(error.message||'Не удалось открыть фотографию',true);close();}
    }
  }
  async function exportJpeg(){
    if(!image)throw Error('Сначала выбери фотографию.');
    const canvas=document.createElement('canvas');canvas.width=OUTPUT_W;canvas.height=OUTPUT_H;
    const context=canvas.getContext('2d',{alpha:false});
    if(!context)throw Error('Графический редактор недоступен.');
    drawFrame(canvas,context,image,settings);
    const blob=await new Promise((resolve,reject)=>
      canvas.toBlob(value=>value?resolve(value):reject(Error('Экспорт JPEG не удался')),'image/jpeg',.87));
    if(blob.size>18*1024*1024)throw Error('Слишком большой файл — уменьшите детализацию.');
    return new File([blob],`veto-story-${Date.now()}.jpg`,{type:'image/jpeg'});
  }
  function setBusy(busy){
    for(const id of ['vetoStoryApply','vetoStoryDownload']){
      const b=$(id);if(b)b.disabled=busy;
    }
  }
  async function apply(){
    setBusy(true);showState('Готовлю Story 9:16 для публикации…');
    try{
      const file=await exportJpeg();
      // The existing Story publish function still owns audience, permissions,
      // size validation and Telegram upload. Editor never bypasses that path.
      window.dispatchEvent(new CustomEvent('veto:story-edited',{detail:{file}}));
      close();
    }catch(error){showState(error.message||'Не удалось подготовить Story',true);}
    finally{setBusy(false);}
  }
  async function download(){
    setBusy(true);
    try{
      const file=await exportJpeg(),url=URL.createObjectURL(file);
      const a=document.createElement('a');a.href=url;a.download=file.name;
      document.body.appendChild(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),20000);
      showState('Черновик сохранён файлом на устройство. В Telegram ещё не опубликовано.');
    }catch(error){showState(error.message||'Не удалось скачать черновик',true);}
    finally{setBusy(false);}
  }
  panel.addEventListener('click',event=>{
    const look=event.target.closest('[data-story-look]');
    if(look){
      const preset=effects[look.dataset.storyLook];
      if(preset){settings={...settings,...preset,look:look.dataset.storyLook};syncControls();commitEdit();requestRender();}
      return;
    }
    const pos=event.target.closest('[data-story-text-position]');
    if(pos){settings.textPosition=pos.dataset.storyTextPosition;syncControls();commitEdit();requestRender();}
  });
  for(const name of ['brightness','contrast','saturation','warmth','vignette','zoom']){
    $('vetoStory'+name.charAt(0).toUpperCase()+name.slice(1))?.addEventListener('input',event=>{
      settings[name]=Number(event.target.value);syncControls();requestRender();
    });
    $('vetoStory'+name.charAt(0).toUpperCase()+name.slice(1))?.addEventListener('change',commitEdit);
  }
  $('vetoStoryOverlay')?.addEventListener('input',event=>{
    settings.text=event.target.value.slice(0,140);requestRender();
  });
  $('vetoStoryOverlay')?.addEventListener('change',commitEdit);
  $('vetoStoryTextSize')?.addEventListener('input',event=>{
    settings.textSize=Number(event.target.value);requestRender();
  });
  $('vetoStoryTextSize')?.addEventListener('change',commitEdit);
  $('vetoStoryReset')?.addEventListener('click',resetFilters);
  $('vetoStoryUndo')?.addEventListener('click',()=>moveHistory(undoStack,redoStack));
  $('vetoStoryRedo')?.addEventListener('click',()=>moveHistory(redoStack,undoStack));
  $('vetoStoryCancel')?.addEventListener('click',()=>close());
  $('vetoStoryApply')?.addEventListener('click',apply);
  $('vetoStoryDownload')?.addEventListener('click',download);
  preview.addEventListener('pointerdown',event=>{
    if(!image)return;
    painting=true;lastPoint={x:event.clientX,y:event.clientY};preview.setPointerCapture?.(event.pointerId);
  });
  preview.addEventListener('pointermove',event=>{
    if(!painting||!lastPoint)return;
    const dx=event.clientX-lastPoint.x,dy=event.clientY-lastPoint.y;
    const g=coverGeometry(photoSize(image).width,photoSize(image).height,settings.zoom);
    const spareX=Math.max(1,(g.width-W)/2),spareY=Math.max(1,(g.height-H)/2);
    const rect=preview.getBoundingClientRect();
    settings.panX=cap(settings.panX+dx*(W/rect.width)/spareX,-1,1);
    settings.panY=cap(settings.panY+dy*(H/rect.height)/spareY,-1,1);
    lastPoint={x:event.clientX,y:event.clientY};requestRender();
  });
  for(const ev of ['pointerup','pointercancel','lostpointercapture'])
    preview.addEventListener(ev,()=>{if(painting)commitEdit();painting=false;lastPoint=null;});
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&!panel.hidden)close();
  });
  window.addEventListener('pagehide',()=>close());
  // Public API only accepts user-chosen files, no network access.
  window.VetoStoryEditor=Object.freeze({open,close,coverGeometry,exportJpeg});
})();
