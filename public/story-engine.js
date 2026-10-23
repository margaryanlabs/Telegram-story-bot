
import { STORY_TEMPLATES,PORTAL_TYPES,RETENTION_DAYS,templateById,
  trimText,safeExternalUrl,newStoryDraft,normalizeDraft,normalizePortal,
  remixDraft,draftFromBrief,isExpired,PHOTO_EFFECTS,STORY_LAYER_STYLES,
  normalizeStoryLayer,normalizeStoryLayers } from './story-engine-core.js';

// VETO Story Engine lives inside the existing Telegram Mini App.
// No asset or draft is uploaded to a backend. The device-local vault is not
// cross-device cloud storage and should not be used for sensitive media.
const $=id=>document.getElementById(id);
const canvas=$('seCanvas');
const root=$('seEngine');
if(!canvas||!root)throw new Error('STORY_ENGINE_SCREEN_MISSING');
const state={draft:null,owner:null,db:null,image:null,imageSrc:null,busy:false,revision:0,loaded:false,selectedLayer:null,dragLayer:null};
const tg=window.Telegram?.WebApp;
const owner=()=>tg?.initData && /^\d{1,20}$/.test(String(tg.initDataUnsafe?.user?.id||''))?
  String(tg.initDataUnsafe.user.id):'';
const notify=(message,error=false)=>{
  const el=$('seNotice');if(!el)return;
  el.textContent=message;el.classList.toggle('error',error);
  el.hidden=false;
};
function openVault(){
  if(!('indexedDB' in window))return Promise.reject(Error('Local storage unavailable'));
  return new Promise((resolve,reject)=>{
    const r=indexedDB.open('vetogram-story-engine-device-v1',1);
    r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('drafts'))r.result.createObjectStore('drafts',{keyPath:'key'});};
    r.onsuccess=()=>resolve(r.result);
    r.onerror=()=>reject(r.error||Error('Draft storage unavailable'));
  });
}
async function transact(mode,fn){
  if(!state.db)state.db=await openVault();
  return new Promise((resolve,reject)=>{
    const tx=state.db.transaction('drafts',mode);
    const st=tx.objectStore('drafts');
    const request=fn(st);
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error||Error('Local draft operation failed'));
    tx.onabort=()=>reject(tx.error||Error('Local storage transaction aborted'));
  });
}
const storageKey=d=>d.ownerId+':'+d.id;
async function saveDraft(){
  requireOwner();
  const d=normalizeDraft({...state.draft,updatedAt:Date.now()},state.owner);
  if(d.imageDataUrl.length>12000000)throw Error('Изображение слишком большое для черновика');
  await transact('readwrite',st=>st.put({key:storageKey(d),ownerId:d.ownerId,draft:d}));
  // IndexedDB is async: a changed Telegram identity must never restore an old
  // owner's image or draft on the newly active screen.
  if(state.owner!==d.ownerId || owner()!==d.ownerId || state.draft?.id!==d.id)return;
  state.draft=d;notify('Черновик сохранён только на этом устройстве');
  await listDrafts();
}
async function listDrafts(){
  if(!state.owner)return;
  const requestedOwner=state.owner;
  const rows=await transact('readonly',st=>st.getAll());
  if(owner()!==requestedOwner || state.owner!==requestedOwner)return;
  const mine=rows.filter(r=>r.ownerId===requestedOwner);
  const expired=mine.filter(r=>isExpired(r.draft));
  for(const row of expired)await transact('readwrite',st=>st.delete(row.key));
  const live=mine.filter(r=>!isExpired(r.draft)).sort((a,b)=>b.draft.updatedAt-a.draft.updatedAt).slice(0,40);
  if(owner()!==requestedOwner || state.owner!==requestedOwner)return;
  const holder=$('seDraftList');holder.replaceChildren();
  if(!live.length){const empty=document.createElement('p');empty.className='se-quiet';empty.textContent='Черновиков пока нет. Создай Story и нажми «Сохранить».';holder.append(empty);return}
  for(const row of live){
    const d=row.draft,t=templateById(d.templateId);
    const card=document.createElement('article');card.className='se-draft-card';
    const preview=document.createElement('div');preview.className='se-draft-preview';
    preview.style.background=`linear-gradient(145deg,${t.start},${t.end})`;
    preview.textContent=(d.title||t.title).slice(0,34);
    const meta=document.createElement('div');meta.className='se-draft-meta';
    const title=document.createElement('strong');title.textContent=d.title||t.name;
    const time=document.createElement('small');time.textContent=new Date(d.updatedAt).toLocaleDateString('ru-RU')+' · '+d.retentionDays+' дн.';
    meta.append(title,time);
    const actions=document.createElement('div');actions.className='se-draft-actions';
    for(const [act,label] of [['open','Открыть'],['copy','Копия'],['delete','Удалить']]){
      const btn=document.createElement('button');btn.type='button';btn.textContent=label;
      btn.addEventListener('click',async()=>{
        try{
          requireOwner();
          if(state.owner!==requestedOwner || d.ownerId!==requestedOwner)
            throw Error('Аккаунт изменился. Открой черновики заново.');
          if(act==='delete'){
            if(!window.confirm('Удалить локальный черновик?'))return;
            if(state.owner!==requestedOwner || owner()!==requestedOwner)return;
            await transact('readwrite',st=>st.delete(row.key));
            if(state.owner!==requestedOwner || owner()!==requestedOwner)return;
            if(state.draft?.id===d.id)applyDraft(newStoryDraft({ownerId:requestedOwner}));
            await listDrafts();return;
          }
          if(act==='copy'){
            // Copy is an explicitly user-directed duplication of their own draft.
            const src={...d,remixable:true};applyDraft(remixDraft(src,state.owner));
            await saveDraft();return;
          }
          applyDraft(d);notify('Черновик загружен с этого устройства');
        }catch(error){notify(error.message,true)}
      });
      actions.append(btn);
    }
    card.append(preview,meta,actions);holder.append(card);
  }
}
function requireOwner(){
  const user=owner();
  if(!user || user!==state.owner)throw Error('Открой VETOGRAM внутри своего Telegram');
  if(!state.draft)throw Error('Создай Story');
}
function drawLines(ctx,text,x,y,maxWidth,fontSize,align='left',maxLines=3){
  ctx.textAlign=align;
  const words=String(text||'').split(/\s+/).filter(Boolean);
  const lines=[];let line='';
  for(const w of words){
    const candidate=line?line+' '+w:w;
    if(ctx.measureText(candidate).width>maxWidth && line){lines.push(line);line=w;}else line=candidate;
  }
  if(line)lines.push(line);
  const out=lines.slice(0,maxLines);out.forEach((part,i)=>ctx.fillText(part,x,y+i*fontSize*1.19,maxWidth));
  return out.length*fontSize*1.19;
}
function paint(target){
  const d=state.draft||newStoryDraft({ownerId:'0',templateId:'noir'});
  const t=templateById(d.templateId);
  const ctx=target.getContext('2d');
  const w=target.width,h=target.height;
  ctx.setTransform(1,0,0,1,0,0);ctx.scale(w/540,h/960);
  const g=ctx.createLinearGradient(0,0,500,960);g.addColorStop(0,t.start);g.addColorStop(1,t.end);
  ctx.fillStyle=g;ctx.fillRect(0,0,540,960);
  if(state.image?.complete&&state.image.naturalWidth){
    const iw=state.image.naturalWidth,ih=state.image.naturalHeight,r=Math.max(540/iw,960/ih),sw=iw*r,sh=ih*r;
    const zoom=Math.max(1,Math.min(2.5,Number(d.photoZoom)||1));
    const zw=sw*zoom,zh=sh*zoom,px=Math.max(-1,Math.min(1,Number(d.photoX)||0)),py=Math.max(-1,Math.min(1,Number(d.photoY)||0));
    const dx=(540-zw)/2+(zw-540)*px/2,dy=(960-zh)/2+(zh-960)*py/2;
    const filters={original:'none',cinema:'contrast(1.22) saturate(.84)',mono:'grayscale(1) contrast(1.12)',
      warm:'sepia(.26) saturate(1.25) contrast(1.07)',cool:'hue-rotate(14deg) saturate(.75) contrast(1.1)',
      vivid:'saturate(1.55) contrast(1.08)'};
    ctx.save();ctx.filter=filters[d.photoEffect]||'none';
    ctx.drawImage(state.image,dx,dy,zw,zh);ctx.restore();
    const tint=ctx.createLinearGradient(0,0,0,960);
    tint.addColorStop(0,'rgba(0,0,0,.24)');tint.addColorStop(.53,'rgba(4,5,9,.22)');tint.addColorStop(1,'rgba(0,0,0,.85)');
    ctx.fillStyle=tint;ctx.fillRect(0,0,540,960);
  }
  ctx.strokeStyle='rgba(255,255,255,.30)';ctx.lineWidth=1;
  ctx.strokeRect(30,30,480,900);
  ctx.fillStyle=t.accent;ctx.fillRect(51,61,36,3);
  ctx.font='600 12px system-ui,sans-serif';ctx.textAlign='left';
  ctx.fillStyle='rgba(255,255,255,.91)';ctx.fillText('VETO / STORY',100,66);
  const center=t.layout==='center';
  const x=center?270:53,start=Math.max(260,Math.min(740,Number(d.textY)|| (center?388:675)));
  const titleSize=Math.max(32,Math.min(66,Number(d.fontSize)||51));
  ctx.textAlign=center?'center':'left';
  ctx.fillStyle=t.accent;ctx.font='600 13px system-ui,sans-serif';
  ctx.fillText('A MOMENT WORTH SHARING',x,start-49);
  ctx.fillStyle='#ffffff';ctx.font='800 '+titleSize+'px system-ui,sans-serif';
  const used=drawLines(ctx,d.title||t.title,x,start,center?440:435,titleSize,center?'center':'left',3);
  ctx.font='400 21px system-ui,sans-serif';ctx.fillStyle='rgba(255,255,255,.88)';
  drawLines(ctx,d.subtitle||t.subtitle,x,start+used+12,center?400:410,21,center?'center':'left',3);
  // Separate editable text layers. Canvas pixels are exported as-is; no DOM,
  // remote media or scripts are executed from user-supplied text.
  for(const layer of normalizeStoryLayers(d.layers)){
    const lx=layer.x*540,ly=layer.y*960;
    ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.font='800 '+layer.size+'px system-ui,sans-serif';
    const boxWidth=Math.min(455,ctx.measureText(layer.text).width+35);
    if(layer.style==='pill'){
      ctx.fillStyle=t.accent;ctx.beginPath();
      ctx.roundRect(lx-boxWidth/2,ly-layer.size*.83,boxWidth,layer.size*1.7,13);ctx.fill();
      ctx.fillStyle='#0c0d12';ctx.fillText(layer.text,lx,ly,boxWidth-22);
    } else if(layer.style==='outline'){
      ctx.strokeStyle='rgba(0,0,0,.82)';ctx.lineWidth=5;ctx.lineJoin='round';
      ctx.strokeText(layer.text,lx,ly,455);ctx.fillStyle='#fff';ctx.fillText(layer.text,lx,ly,455);
    } else{
      ctx.shadowColor='rgba(0,0,0,.68)';ctx.shadowBlur=12;
      ctx.fillStyle='#fff';ctx.fillText(layer.text,lx,ly,455);
    }
    ctx.restore();
  }
  if(d.portal){
    const txt=trimText(d.portal.cta,30).toUpperCase();
    const y=center?825:857;
    ctx.fillStyle=t.accent;ctx.beginPath();ctx.roundRect(center?112:53,y,center?316:290,49,14);ctx.fill();
    ctx.font='700 15px system-ui,sans-serif';ctx.fillStyle='#0b0c10';ctx.textAlign='center';
    ctx.fillText(txt,center?270:198,y+30,260);
  }
  ctx.fillStyle='rgba(255,255,255,.7)';ctx.textAlign='right';ctx.font='500 11px system-ui,sans-serif';
  if(d.branding===true)ctx.fillText('MADE WITH VETOGRAM',487,914);
}
function renderLayers(){
  const layers=normalizeStoryLayers(state.draft?.layers),holder=$('seLayerList');
  holder.replaceChildren();
  if(!layers.some(layer=>layer.id===state.selectedLayer))state.selectedLayer=null;
  if(!layers.length){
    const note=document.createElement('div');note.className='se-layer-empty';
    note.textContent='Добавь надпись: её можно будет переместить прямо на изображении.';
    holder.append(note);
  }
  for(const layer of layers){
    const button=document.createElement('button');button.type='button';
    button.className='se-layer-chip'+(state.selectedLayer===layer.id?' active':'');
    const name=document.createElement('span');name.textContent=layer.text;
    const style=document.createElement('small');style.textContent=layer.style;
    button.append(name,style);
    button.setAttribute('aria-pressed',state.selectedLayer===layer.id?'true':'false');
    button.addEventListener('click',()=>{
      state.selectedLayer=layer.id;
      $('seLayerText').value=layer.text;
      $('seLayerStyle').value=layer.style;
      renderLayers();paint(canvas);
    });
    holder.append(button);
  }
  $('seLayerRemove').disabled=!state.selectedLayer;
  $('seLayerSize').disabled=!state.selectedLayer;
  const selected=layers.find(layer=>layer.id===state.selectedLayer);
  if(selected)$('seLayerSize').value=String(selected.size);
}
function render(){
  if(!state.draft)return;
  $('seTitle').value=state.draft.title;
  $('seSubtitle').value=state.draft.subtitle;
  $('seCaption').value=state.draft.caption;
  $('seRetention').value=String(state.draft.retentionDays);
  $('seRemixAllowed').checked=state.draft.remixable;
  $('seBranding').checked=state.draft.branding===true;
  $('seTextY').value=String(state.draft.textY);
  $('seFontSize').value=String(state.draft.fontSize);
  $('sePhotoEffect').value=state.draft.photoEffect||'original';
  $('sePhotoZoom').value=String(Math.round((state.draft.photoZoom||1)*100));
  $('sePhotoX').value=String(Math.round((state.draft.photoX||0)*100));
  $('sePhotoY').value=String(Math.round((state.draft.photoY||0)*100));
  renderLayers();
  const p=state.draft.portal;
  $('sePortalType').value=p?.type||'';
  $('sePortalTitle').value=p?.title||'';
  $('sePortalDescription').value=p?.description||'';
  $('sePortalLink').value=p?.link||'';
  $('sePortalCta').value=p?.cta||'';
  const portal=$('sePortalPreview');portal.replaceChildren();
  if(p){
    const type=PORTAL_TYPES.find(v=>v.id===p.type);
    for(const [tag,txt] of [['small',type?.name||'PORTAL'],['strong',p.title||'Твой Portal'],['p',p.description||'Заполни описание'],['span',p.cta]]){
      const node=document.createElement(tag);node.textContent=txt;portal.append(node);
    }
  }else{
    const prompt=document.createElement('p');prompt.textContent='Выбери тип Portal и создай интерактивное продолжение Story.';portal.append(prompt);
  }
  $('seTemplateName').textContent=templateById(state.draft.templateId).name;
  document.querySelectorAll('[data-se-template]').forEach(b=>b.classList.toggle('active',b.dataset.seTemplate===state.draft.templateId));
  paint(canvas);
}
function loadImageForDraft(){
  state.image=null;state.imageSrc=null;
  const url=state.draft?.imageDataUrl;
  if(!url){paint(canvas);return}
  const sourceOwner=state.owner,sourceId=state.draft.id;
  const i=new Image();i.onload=()=>{
    if(state.owner!==sourceOwner || owner()!==sourceOwner ||
       state.draft?.id!==sourceId || state.draft?.imageDataUrl!==url)return;
    if(i.naturalWidth*i.naturalHeight>16000000){
      notify('Для плавной работы выбери изображение до 16 мегапикселей',true);
      state.draft.imageDataUrl='';paint(canvas);return;
    }
    state.image=i;state.imageSrc=url;paint(canvas);
  };
  i.onerror=()=>notify('Не удалось загрузить изображение',true);
  i.src=url;
}
function applyDraft(d){
  state.selectedLayer=null;state.dragLayer=null;
  state.draft=normalizeDraft(d,state.owner||'0');loadImageForDraft();render();
}
async function init(){
  const current=owner();
  if(!current){
    $('seAccountStatus').textContent='Для сохранения открой в Telegram';
    // Telegram may revoke initData while this WebView stays open. Reset any
    // previous account's canvas and fields immediately, even without reload.
    if(state.owner!=='0'){
      state.owner='0';state.image=null;
      applyDraft(newStoryDraft({ownerId:'0'}));
      $('seDraftList').replaceChildren();
    }
    return;
  }
  if(current!==state.owner){
    state.owner=current;state.image=null;
    applyDraft(newStoryDraft({ownerId:current}));
  }
  $('seAccountStatus').textContent='Черновики только на этом устройстве';
  try{await listDrafts()}catch(error){notify('Черновики недоступны: '+error.message,true)}
}
async function exportToPublisher(){
  requireOwner();
  if(state.busy)return;
  state.busy=true;$('sePublish').disabled=true;
  try{
    if(state.draft.imageDataUrl && state.imageSrc!==state.draft.imageDataUrl)throw Error('Дождись загрузки фотографии перед экспортом');
    const out=document.createElement('canvas');out.width=1080;out.height=1920;paint(out);
    const exportOwner=state.owner,exportDraftId=state.draft.id;
    const blob=await new Promise(resolve=>out.toBlob(resolve,'image/jpeg',.88));
    if(owner()!==exportOwner || state.owner!==exportOwner ||
       state.draft?.id!==exportDraftId)throw Error('Аккаунт или черновик изменился. Повтори экспорт.');
    if(!blob||blob.size>10*1024*1024)throw Error('Экспорт не удался: превышен лимит изображения');
    const input=$('storyFileInput');
    if(!input||typeof DataTransfer!=='function')throw Error('Telegram не поддерживает прямую передачу файла. Используй экспорт JPEG.');
    const file=new File([blob],'vetogram-story.jpg',{type:'image/jpeg'});
    const dt=new DataTransfer();dt.items.add(file);input.files=dt.files;
    input.dispatchEvent(new Event('change',{bubbles:true}));
    $('storyCaption').value=state.draft.caption||'';
    $('storyCaption').dispatchEvent(new Event('input',{bubbles:true}));
    window.VetoTelegramNavigate?.('publish');
    notify('Изображение передано в публикацию. Проверь аудиторию и подтверди отправку.');
  }catch(error){notify(error.message,true)}
  finally{state.busy=false;$('sePublish').disabled=false}
}
async function downloadJpg(){
  if(!state.draft)return;
  if(state.draft.imageDataUrl && state.imageSrc!==state.draft.imageDataUrl)throw Error('Дождись загрузки фотографии перед экспортом');
    const out=document.createElement('canvas');out.width=1080;out.height=1920;paint(out);
  const exportOwner=state.owner,exportDraftId=state.draft.id;
  const blob=await new Promise(resolve=>out.toBlob(resolve,'image/jpeg',.88));
  if(owner()!==exportOwner || state.owner!==exportOwner ||
     state.draft?.id!==exportDraftId)throw Error('Аккаунт или черновик изменился. Повтори экспорт.');
  if(!blob)throw Error('Экспорт недоступен');
  const url=URL.createObjectURL(blob);
  try{const a=document.createElement('a');a.download='vetogram-story.jpg';a.href=url;a.click();}
  finally{setTimeout(()=>URL.revokeObjectURL(url),5000)}
}
function setup(){
  const holder=$('seTemplates');
  for(const t of STORY_TEMPLATES){
    const b=document.createElement('button');b.type='button';b.dataset.seTemplate=t.id;b.className='se-template';
    b.style.setProperty('--se-start',t.start);b.style.setProperty('--se-end',t.end);b.style.setProperty('--se-accent',t.accent);
    const mark=document.createElement('i'),title=document.createElement('strong'),small=document.createElement('small');
    title.textContent=t.name;small.textContent=t.mood;b.append(mark,title,small);
    b.addEventListener('click',()=>{
      if(!state.draft)return;state.draft.templateId=t.id;
      state.draft.title=t.title;state.draft.subtitle=t.subtitle;render();
    });
    holder.append(b);
  }
  for(const days of RETENTION_DAYS){
    const el=document.createElement('option');el.value=days;el.textContent=days+' дней';$('seRetention').append(el);
  }
  for(const p of PORTAL_TYPES){
    const el=document.createElement('option');el.value=p.id;el.textContent=p.name;$('sePortalType').append(el);
  }
  const update=(key,max)=>e=>{if(!state.draft)return;state.draft[key]=trimText(e.target.value,max);paint(canvas)};
  $('seTitle').addEventListener('input',update('title',90));
  $('seSubtitle').addEventListener('input',update('subtitle',180));
  $('seCaption').addEventListener('input',e=>{if(state.draft)state.draft.caption=trimText(e.target.value,800)});
  $('seRetention').addEventListener('change',e=>{if(state.draft)state.draft.retentionDays=Number(e.target.value)});
  $('seRemixAllowed').addEventListener('change',e=>{if(state.draft)state.draft.remixable=e.target.checked});
  $('seBranding').addEventListener('change',e=>{if(state.draft){state.draft.branding=e.target.checked;paint(canvas)}});
  $('seTextY').addEventListener('input',e=>{if(state.draft){state.draft.textY=Number(e.target.value);paint(canvas)}});
  $('seFontSize').addEventListener('input',e=>{if(state.draft){state.draft.fontSize=Number(e.target.value);paint(canvas)}});
  for(const [id,key,factor] of [['sePhotoZoom','photoZoom',100],['sePhotoX','photoX',100],['sePhotoY','photoY',100]]){
    $(id).addEventListener('input',e=>{if(state.draft){state.draft[key]=Number(e.target.value)/factor;paint(canvas)}});
  }
  $('sePhotoEffect').addEventListener('change',e=>{
    if(state.draft){state.draft.photoEffect=PHOTO_EFFECTS.includes(e.target.value)?e.target.value:'original';paint(canvas)}
  });
  $('sePhotoReset').addEventListener('click',()=>{
    if(!state.draft)return;
    Object.assign(state.draft,{photoZoom:1,photoX:0,photoY:0,photoEffect:'original'});render();
  });
  $('seLayerAdd').addEventListener('click',()=>{
    if(!state.draft)return;
    const text=trimText($('seLayerText').value,90);
    if(!text)return notify('Напиши текст нового слоя',true);
    if((state.draft.layers||[]).length>=6)return notify('Максимум 6 текстовых слоёв',true);
    const id=window.crypto?.randomUUID?.()||Date.now().toString(36)+'_'+Math.random().toString(36).slice(2);
    const layer=normalizeStoryLayer({id,text,style:$('seLayerStyle').value,x:.5,y:.52,size:27});
    state.draft.layers=normalizeStoryLayers([...(state.draft.layers||[]),layer]);
    state.selectedLayer=layer.id;renderLayers();paint(canvas);
    notify('Слой добавлен — перетащи его прямо на Story');
  });
  $('seLayerRemove').addEventListener('click',()=>{
    if(!state.draft||!state.selectedLayer)return;
    state.draft.layers=(state.draft.layers||[]).filter(layer=>layer.id!==state.selectedLayer);
    state.selectedLayer=null;renderLayers();paint(canvas);
  });
  $('seLayerSize').addEventListener('input',e=>{
    const layer=state.draft?.layers?.find(item=>item.id===state.selectedLayer);
    if(layer){layer.size=Number(e.target.value);paint(canvas)}
  });
  $('seLayerText').addEventListener('input',e=>{
    const layer=state.draft?.layers?.find(item=>item.id===state.selectedLayer);
    if(layer){layer.text=trimText(e.target.value,90);paint(canvas);renderLayers()}
  });
  $('seLayerStyle').addEventListener('change',e=>{
    const layer=state.draft?.layers?.find(item=>item.id===state.selectedLayer);
    if(layer){layer.style=STORY_LAYER_STYLES.includes(e.target.value)?e.target.value:'plain';renderLayers();paint(canvas)}
  });
  function pointerRatio(event){
    const r=canvas.getBoundingClientRect();
    return {x:Math.min(.91,Math.max(.09,(event.clientX-r.left)/r.width)),
      y:Math.min(.91,Math.max(.09,(event.clientY-r.top)/r.height))};
  }
  canvas.addEventListener('pointerdown',event=>{
    if(!state.draft||state.owner!==owner())return;
    const p=pointerRatio(event);
    const layers=state.draft.layers||[];
    const hit=[...layers].reverse().find(layer=>Math.abs(layer.x-p.x)<.24 && Math.abs(layer.y-p.y)<.055);
    if(!hit)return;
    state.selectedLayer=hit.id;state.dragLayer={owner:state.owner,draftId:state.draft.id,pointerId:event.pointerId};
    canvas.setPointerCapture?.(event.pointerId);event.preventDefault();
    $('seLayerText').value=hit.text;$('seLayerStyle').value=hit.style;
    renderLayers();
  });
  canvas.addEventListener('pointermove',event=>{
    const drag=state.dragLayer;
    if(!drag||drag.pointerId!==event.pointerId)return;
    if(owner()!==drag.owner||state.owner!==drag.owner||state.draft?.id!==drag.draftId){
      state.dragLayer=null;return;
    }
    const layer=state.draft.layers?.find(item=>item.id===state.selectedLayer);
    if(!layer)return;
    const p=pointerRatio(event);layer.x=p.x;layer.y=p.y;
    paint(canvas);event.preventDefault();
  });
  const endDrag=()=>{state.dragLayer=null;};
  canvas.addEventListener('pointerup',endDrag);
  canvas.addEventListener('pointercancel',endDrag);
  $('seNew').addEventListener('click',()=>{if(!state.owner || state.owner==='0')return notify('Открой VETOGRAM в Telegram',true);applyDraft(newStoryDraft({ownerId:state.owner}));notify('Новая Story готова')});
  $('seUpload').addEventListener('click',()=>$('seFile').click());
  $('seFile').addEventListener('change',async e=>{
    const file=e.target.files?.[0];e.target.value='';
    if(!file||!state.draft)return;
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>8*1024*1024)return notify('Поддерживаются JPG/PNG/WEBP до 8 МБ',true);
    const reader=new FileReader();
    reader.onerror=()=>notify('Ошибка чтения файла',true);
    const selectedOwner=state.owner,selectedDraftId=state.draft.id;
    reader.onload=()=>{
      // A slow FileReader callback must not attach account A's photo to account B.
      if(owner()!==selectedOwner || state.owner!==selectedOwner ||
         state.draft?.id!==selectedDraftId)return;
      const data=String(reader.result||'');
      if(data.length>12000000)return notify('Изображение слишком велико для локального черновика',true);
      state.draft.imageDataUrl=data;state.draft.imageMime=file.type;loadImageForDraft();
      notify('Фото загружено. Исходник остаётся на устройстве.');
    };
    reader.readAsDataURL(file);
  });
  $('seClearPhoto').addEventListener('click',()=>{if(!state.draft)return;state.draft.imageDataUrl='';state.draft.imageMime='';loadImageForDraft()});
  $('seSave').addEventListener('click',async()=>{try{await saveDraft()}catch(e){notify(e.message,true)}});
  $('seRemix').addEventListener('click',()=>{
    try{requireOwner();applyDraft(remixDraft({...state.draft,remixable:true},state.owner));notify('Независимая копия создана. Исходный черновик не изменён.')}
    catch(e){notify(e.message,true)}
  });
  $('seBriefGenerate').addEventListener('click',()=>{
    try{requireOwner();
      const phrase=$('seBrief').value.trim();
      if(!phrase)throw Error('Напиши тему истории');
      applyDraft(draftFromBrief(phrase,state.owner));
      notify('Идея и оформление подобраны локально, без платного AI и загрузки данных.');
    }catch(e){notify(e.message,true)}
  });
  function readPortal(){
    if(!state.draft)return;
    const type=$('sePortalType').value;
    if(!type){state.draft.portal=null;render();return}
    try{
      const raw={type,title:$('sePortalTitle').value,description:$('sePortalDescription').value,
        cta:$('sePortalCta').value,link:$('sePortalLink').value};
      state.draft.portal=normalizePortal(raw);render();
      notify('Portal добавлен в текущий проект. Нажми «Сохранить», чтобы записать его на устройстве. Публичной ссылки пока нет.');
    }catch(e){notify(e.message,true)}
  }
  $('sePortalSave').addEventListener('click',readPortal);
  $('sePortalRemove').addEventListener('click',()=>{if(!state.draft)return;state.draft.portal=null;render();notify('Portal отвязан')});
  $('sePortalType').addEventListener('change',()=>{
    const item=PORTAL_TYPES.find(p=>p.id===$('sePortalType').value);
    if(item)$('sePortalCta').value=item.cta;
  });
  $('sePublish').addEventListener('click',exportToPublisher);
  $('seDownload').addEventListener('click',()=>downloadJpg().catch(e=>notify(e.message,true)));
  window.addEventListener('veto:screen-changed',e=>{if(e.detail?.screen==='story-engine')void init()});
  // Coming back from Telegram app switch may change owner; do not reuse an old user's draft.
  window.addEventListener('pageshow',()=>{if(state.owner!==owner())void init()});
  window.addEventListener('focus',()=>{if(state.owner!==owner())void init()});
  applyDraft(newStoryDraft({ownerId:'0'}));init();
}
setup();
