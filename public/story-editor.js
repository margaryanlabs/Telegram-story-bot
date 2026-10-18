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
  const defaultSettings=()=>({...effects.editorial,look:'editorial',text:'',textPosition:'bottom',textTone:'light',textSize:56,panX:0,panY:0,eyebrow:'',callToAction:'',accent:'#ffffff'});
  const campaignStarters=Object.freeze({
    launch:{eyebrow:'JUST DROPPED',text:'НОВАЯ КОЛЛЕКЦИЯ',callToAction:'УЗНАТЬ БОЛЬШЕ',textPosition:'center',textSize:67,accent:'#ffffff'},
    event:{eyebrow:'TONIGHT',text:'ВСТРЕТИМСЯ СЕГОДНЯ',callToAction:'ЗАБРОНИРОВАТЬ',textPosition:'center',textSize:62,accent:'#e3c3a1'},
    offer:{eyebrow:'LIMITED OFFER',text:'ТОЛЬКО СЕГОДНЯ',callToAction:'ПОСМОТРЕТЬ',textPosition:'center',textSize:71,accent:'#d8e9ff'},
  });
  let image=null,sourceFile=null,sourceUrl='',settings=defaultSettings();
  let painting=false,renderQueued=false,epoch=0,lastPoint=null;
  let undoStack=[],redoStack=[],lastCommitted={...settings};
  let exporting=false,importGeneration=0,previousFocus=null;
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
    const eyebrow=String(s.eyebrow||'').trim().slice(0,32);
    if(eyebrow){
      context.save();
      const font=cap(19*m,10,44);
      context.font=`850 ${font}px Inter, system-ui, sans-serif`;
      context.textAlign='center';context.textBaseline='middle';
      const labelWidth=Math.min(w*.88,context.measureText(eyebrow).width+60*m);
      const left=(w-labelWidth)/2,top=h*.11-21*m,height=42*m;
      context.fillStyle='rgba(7,12,19,.70)';
      context.fillRect(left,top,labelWidth,height);
      context.fillStyle=/^#[0-9a-f]{6}$/i.test(s.accent||'')?s.accent:'#ffffff';
      context.shadowColor='rgba(0,0,0,.75)';context.shadowBlur=7*m;
      context.fillText(eyebrow,w/2,top+height/2,labelWidth-20*m);
      context.restore();
    }
    const call=String(s.callToAction||'').trim().slice(0,32);
    if(call){
      context.save();
      const left=w*.12,top=h*.875,width=w*.76,height=74*m;
      context.fillStyle=/^#[0-9a-f]{6}$/i.test(s.accent||'')?s.accent:'#ffffff';
      context.fillRect(left,top,width,height);
      const hex=context.fillStyle;
      const red=parseInt(hex.slice(1,3),16),green=parseInt(hex.slice(3,5),16),blue=parseInt(hex.slice(5,7),16);
      const luminance=(red*299+green*587+blue*114)/1000;
      context.fillStyle=luminance>155?'#152030':'#ffffff';
      context.font=`850 ${20*m}px Inter, system-ui, sans-serif`;
      context.textAlign='center';context.textBaseline='middle';
      context.fillText(call.toUpperCase(),w/2,top+height/2,width-28*m);
      context.restore();
    }
  }
  function renderLookPreviews(){
    if(!image)return;
    panel.querySelectorAll('[data-story-look-preview]').forEach(canvas=>{
      const preset=effects[canvas.dataset.storyLookPreview];
      const context=canvas.getContext('2d',{alpha:false});
      if(!preset||!context)return;
      drawFrame(canvas,context,image,{...settings,...preset,text:'',eyebrow:'',callToAction:''});
    });
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
    if($('vetoStoryEyebrow'))$('vetoStoryEyebrow').value=settings.eyebrow||'';
    if($('vetoStoryCallToAction'))$('vetoStoryCallToAction').value=settings.callToAction||'';
    if($('vetoStoryAccent'))$('vetoStoryAccent').value=settings.accent||'#ffffff';
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
    try{previousFocus?.focus?.();}catch{}
    previousFocus=null;
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
    if(panel.hidden)previousFocus=document.activeElement;
    panel.hidden=false;document.body.classList.add('veto-story-editing');
    $('vetoStoryCancel')?.focus?.();
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
      renderLookPreviews();
      requestRender();
      return true;
    }catch(error){
      if(thisEpoch===epoch){showState(error.message||'Не удалось открыть фотографию',true);close();}
      return false;
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
    for(const id of ['vetoStoryApply','vetoStoryDownload','vetoStorySaveProject','vetoStoryOpenProject']){
      const b=$(id);if(b)b.disabled=busy;
    }
  }
  async function apply(){
    if(exporting||!image)return;
    exporting=true;setBusy(true);showState('Готовлю Story 9:16 для публикации…');
    const generation=epoch;
    try{
      const file=await exportJpeg();
      if(generation!==epoch||panel.hidden)return;
      // The existing Story publish function still owns audience, permissions,
      // size validation and Telegram upload. Editor never bypasses that path.
      window.dispatchEvent(new CustomEvent('veto:story-edited',{detail:{file}}));
      close();
    }catch(error){if(generation===epoch)showState(error.message||'Не удалось подготовить Story',true);}
    finally{exporting=false;setBusy(false);}
  }
  async function download(){
    if(exporting||!image)return;
    exporting=true;setBusy(true);
    try{
      const generation=epoch;
      const file=await exportJpeg();
      if(generation!==epoch||panel.hidden)return;
      let shared=false;
      if(navigator.canShare?.({files:[file]})&&typeof navigator.share==='function'){
        try{
          await navigator.share({files:[file],title:'VETO Story · черновик'});
          shared=true;
        }catch(error){
          if(error?.name==='AbortError'){
            showState('Сохранение отменено. Story не опубликована.');return;
          }
        }
      }
      if(!shared){
        const url=URL.createObjectURL(file);
        const a=document.createElement('a');a.href=url;a.download=file.name;
        document.body.appendChild(a);a.click();a.remove();
        setTimeout(()=>URL.revokeObjectURL(url),20000);
      }
      showState(shared
        ?'Черновик передан через системное меню. В Telegram не опубликовано.'
        :'Запущено скачивание JPEG. Если Telegram заблокировал скачивание, открой VETO в браузере.');
    }catch(error){showState(error.message||'Не удалось скачать черновик',true);}
    finally{exporting=false;setBusy(false);}
  }
  async function shareOrDownload(file){
    // Sharing a file requires explicit user interaction. Never send drafts
    // through Telegram APIs or external AI services without user approval.
    if(navigator.canShare?.({files:[file]})&&typeof navigator.share==='function'){
      try{await navigator.share({files:[file],title:'VETO Story · редактируемый проект'});return 'shared';}
      catch(error){if(error?.name==='AbortError')return 'cancelled';}
    }
    const url=URL.createObjectURL(file);
    const anchor=document.createElement('a');
    anchor.href=url;anchor.download=file.name;document.body.appendChild(anchor);
    anchor.click();anchor.remove();
    setTimeout(()=>URL.revokeObjectURL(url),20000);
    return 'downloaded';
  }
  async function saveProject(){
    if(exporting||!image||!window.VetoStoryProject)return;
    exporting=true;setBusy(true);
    const generation=epoch;
    showState('Собираю редактируемый проект на устройстве…');
    try{
      const file=await window.VetoStoryProject.create(image,settings);
      if(generation!==epoch||panel.hidden)return;
      const result=await shareOrDownload(file);
      showState(result==='cancelled'
        ?'Сохранение отменено. Проект остался открытым.'
        :result==='shared'
          ?'Файл проекта передан через системное меню. Сохрани его в приватном месте.'
          :'Запущено скачивание проекта. Проверь файлы устройства — внутри есть личная фотография.');
    }catch(error){if(generation===epoch)showState(error.message||'Не удалось сохранить проект',true);}
    finally{exporting=false;setBusy(false);}
  }
  function openProjectPicker(){
    if(exporting)return;
    const input=$('vetoStoryProjectFile');
    if(input){input.value='';input.click();}
  }
  async function importProject(file){
    if(!file||exporting||!window.VetoStoryProject)return;
    const generation=++importGeneration;
    exporting=true;setBusy(true);
    showState('Проверяю формат проекта и загружаю фотографию…');
    try{
      const project=await window.VetoStoryProject.parse(file);
      if(generation!==importGeneration)return;
      const opened=await open(project.file);
      if(!opened||generation!==importGeneration)return;
      settings={...defaultSettings(),...project.settings};
      undoStack=[];redoStack=[];lastCommitted={...settings};
      syncControls();syncHistory();renderLookPreviews();requestRender();
      showState('Редактируемый проект восстановлен локально. До публикации данные не отправляются.');
    }catch(error){showState(error.message||'Не удалось открыть проект',true);}
    finally{exporting=false;setBusy(false);}
  }
  panel.addEventListener('click',event=>{
    const look=event.target.closest('[data-story-look]');
    if(look){
      const preset=effects[look.dataset.storyLook];
      if(preset){settings={...settings,...preset,look:look.dataset.storyLook};syncControls();commitEdit();requestRender();}
      return;
    }
    const campaign=event.target.closest('[data-story-campaign]');
    if(campaign){
      const preset=campaignStarters[campaign.dataset.storyCampaign];
      if(preset){
        settings={...settings,...preset};syncControls();commitEdit();requestRender();
        showState('Шаблон применён. Каждую надпись и цвет можно изменить перед публикацией.');
      }
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
  for(const [id,key,max] of [
    ['vetoStoryEyebrow','eyebrow',32],['vetoStoryCallToAction','callToAction',32],
  ]){
    $(id)?.addEventListener('input',event=>{
      settings[key]=event.target.value.slice(0,max);requestRender();
    });
    $(id)?.addEventListener('change',commitEdit);
  }
  $('vetoStoryAccent')?.addEventListener('input',event=>{
    if(/^#[0-9a-fA-F]{6}$/.test(event.target.value)){
      settings.accent=event.target.value;requestRender();
    }
  });
  $('vetoStoryAccent')?.addEventListener('change',commitEdit);
  $('vetoStoryReset')?.addEventListener('click',resetFilters);
  $('vetoStoryUndo')?.addEventListener('click',()=>moveHistory(undoStack,redoStack));
  $('vetoStoryRedo')?.addEventListener('click',()=>moveHistory(redoStack,undoStack));
  $('vetoStoryCancel')?.addEventListener('click',()=>close());
  $('vetoStoryApply')?.addEventListener('click',apply);
  $('vetoStoryDownload')?.addEventListener('click',download);
  $('vetoStorySaveProject')?.addEventListener('click',saveProject);
  $('vetoStoryOpenProject')?.addEventListener('click',openProjectPicker);
  $('vetoStoryImportLaunch')?.addEventListener('click',openProjectPicker);
  $('vetoStoryProjectFile')?.addEventListener('change',event=>{
    void importProject(event.target.files?.[0]);
  });
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
    if(panel.hidden)return;
    if(event.key==='Escape'){event.preventDefault();close();return;}
    if(event.key!=='Tab')return;
    // A real modal must keep keyboard focus within the private editor.
    const focusable=[...panel.querySelectorAll(
      'button:not([disabled]),input:not([disabled]):not([type=hidden]),textarea:not([disabled])',
    )].filter(el=>el.getClientRects().length>0);
    if(!focusable.length)return;
    const first=focusable[0],last=focusable[focusable.length-1];
    if(event.shiftKey&&(document.activeElement===first||!panel.contains(document.activeElement))){
      event.preventDefault();last.focus();
    }else if(!event.shiftKey&&(document.activeElement===last||!panel.contains(document.activeElement))){
      event.preventDefault();first.focus();
    }
  });
  window.addEventListener('pagehide',()=>close());
  // Public API only accepts user-chosen files, no network access.
  window.VetoStoryEditor=Object.freeze({open,close,coverGeometry,exportJpeg,importProject,saveProject,openProjectPicker});
})();
