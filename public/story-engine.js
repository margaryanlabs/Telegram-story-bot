import {setupStorySoundtrack} from './story-soundtrack.js';
import {createStoryHistory} from './story-history-core.js';

import {showPortalPreview} from './story-portal-preview.js';
import {makePublicPortalUrl} from './story-portal-share.js';
import { STORY_TEMPLATES,PORTAL_TYPES,RETENTION_DAYS,templateById,
  trimText,safeExternalUrl,newStoryDraft,normalizeDraft,normalizePortal,
  remixDraft,draftFromBrief,isExpired,applyStoryTemplate,calculatePhotoPinch,PHOTO_EFFECTS,STORY_LAYER_STYLES,
  normalizeStoryLayer,normalizeStoryLayers } from './story-engine-core.js';

// VETO Story Engine lives inside the existing Telegram Mini App.
// No asset or draft is uploaded to a backend. The device-local vault is not
// cross-device cloud storage and should not be used for sensitive media.
const $=id=>document.getElementById(id);
const canvas=$('seCanvas');
const root=$('seEngine');
if(!canvas||!root)throw new Error('STORY_ENGINE_SCREEN_MISSING');
const state={draft:null,owner:null,db:null,image:null,imageSrc:null,busy:false,revision:0,loaded:false,selectedLayer:null,dragLayer:null,aiUndo:null};
const tg=window.Telegram?.WebApp;
const history=createStoryHistory();
let historyGroup='';
let soundtrack=null;
const editorIdentity=()=>owner()||'0';
function updateHistoryButtons(){
  if($('seUndo'))$('seUndo').disabled=!history.canUndo;
  if($('seRedo'))$('seRedo').disabled=!history.canRedo;
}
function recordEdit(id){
  // Consecutive keystrokes share one undo checkpoint, but each keystroke
  // still invalidates any IndexedDB save snapshot currently in flight.
  if(historyGroup!==id){checkpoint();historyGroup=id;}
  state.revision++;
}
function checkpoint(){
  if(editorIdentity()!==state.owner)return;
  state.revision++;
  history.checkpoint(state.draft,state.owner);
  queueMicrotask(updateHistoryButtons);
}
function restoreHistory(direction){
  historyGroup='';
  if(editorIdentity()!==state.owner)return;
  const d=history[direction](state.draft,state.owner);
  if(!d){updateHistoryButtons();return;}
  applyDraft(d,true);updateHistoryButtons();
  notify(direction==='undo'?'Действие отменено':'Действие повторено');
}
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
  const reference=state.draft,revision=state.revision;
  const d=normalizeDraft({...state.draft,updatedAt:Date.now()},state.owner);
  if(d.imageDataUrl.length>12000000)throw Error('Изображение слишком большое для черновика');
  await transact('readwrite',st=>st.put({key:storageKey(d),ownerId:d.ownerId,draft:d}));
  // IndexedDB is async: a changed owner, draft or edits after the button
  // press may never be overwritten with an older saved snapshot.
  if(state.owner!==d.ownerId || owner()!==d.ownerId || state.draft?.id!==d.id)return;
  const hasNewEdits=state.draft!==reference || state.revision!==revision;
  if(!hasNewEdits)state.draft.updatedAt=d.updatedAt;
  notify(hasNewEdits
    ?'Версия на момент нажатия сохранена. Есть более новые правки — нажми «Сохранить» ещё раз.'
    :'Черновик сохранён только на этом устройстве');
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
let templatePreviewPending=false;
let templatePreviewLastDraw=0;
let activePhotoGesture=false;
function scheduleTemplatePreviews(){
  const holder=$('seTemplates');
  if(templatePreviewPending||!holder?.children.length||!state.draft||
      !root.classList.contains('active')||activePhotoGesture)return;
  templatePreviewPending=true;
  const requestedOwner=state.owner,requestedDraft=state.draft.id;
  const delay=Math.max(0,240-(Date.now()-templatePreviewLastDraw));
  setTimeout(()=>{
    requestAnimationFrame(()=>{
      templatePreviewPending=false;
      if(!state.draft||state.owner!==requestedOwner||state.draft.id!==requestedDraft||
        (requestedOwner!=='0'&&owner()!==requestedOwner)||
        !root.classList.contains('active'))return;
      templatePreviewLastDraw=Date.now();
      for(const tile of holder.querySelectorAll('[data-se-template]')){
        const preview=tile.querySelector('canvas.se-template-canvas');
        if(!preview)continue;
        const d=applyStoryTemplate(state.draft,tile.dataset.seTemplate);
        paint(preview,d);
      }
    });
  },delay);
}
function paint(target,draftOverride=null){
  const d=draftOverride||state.draft||newStoryDraft({ownerId:'0',templateId:'noir'});
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
  ctx.fillStyle='rgba(255,255,255,.91)';ctx.fillText('VETOGRAM / ИСТОРИЯ',100,66);
  const center=t.layout==='center';
  const x=center?270:53,start=Math.max(260,Math.min(740,Number(d.textY)|| (center?388:675)));
  const titleSize=Math.max(32,Math.min(66,Number(d.fontSize)||51));
  ctx.textAlign=center?'center':'left';
  ctx.fillStyle=t.accent;ctx.font='600 13px system-ui,sans-serif';
  ctx.fillText('МОМЕНТ, КОТОРЫМ СТОИТ ПОДЕЛИТЬСЯ',x,start-49,435);
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
  if(target===canvas&&state.selectedLayer){
    const selected=(d.layers||[]).find(layer=>layer.id===state.selectedLayer);
    if(selected){
      ctx.save();ctx.strokeStyle='#ff7887';ctx.lineWidth=2;ctx.setLineDash([5,5]);
      ctx.strokeRect(selected.x*540-120,selected.y*960-selected.size,240,selected.size*2);
      ctx.restore();
    }
  }
  if(d.portal){
    const txt=trimText(d.portal.cta,30).toUpperCase();
    const y=center?825:857;
    ctx.fillStyle=t.accent;ctx.beginPath();ctx.roundRect(center?112:53,y,center?316:290,49,14);ctx.fill();
    ctx.font='700 15px system-ui,sans-serif';ctx.fillStyle='#0b0c10';ctx.textAlign='center';
    ctx.fillText(txt,center?270:198,y+30,260);
  }
  ctx.fillStyle='rgba(255,255,255,.7)';ctx.textAlign='right';ctx.font='500 11px system-ui,sans-serif';
  if(d.branding===true)ctx.fillText('СОЗДАНО В VETOGRAM',487,914);
  if(target===canvas)scheduleTemplatePreviews();
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
    const style=document.createElement('small');style.textContent=({plain:'Текст',pill:'Плашка',outline:'Контур'})[layer.style]||'Текст';
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
function clearPublicPortalLink(){
  $('sePortalShareResult').hidden=true;
  $('sePortalPublicLink').value='';
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
  $('sePortalOptions').value=(p?.options||[]).join(String.fromCharCode(10));
  $('sePortalLinks').value=(p?.links||[]).map(x=>x.label+' | '+x.url).join(String.fromCharCode(10));
  $('sePortalPollFields').hidden=$('sePortalType').value!=='poll';
  $('sePortalLinksFields').hidden=$('sePortalType').value!=='links';
  $('sePortalTry').disabled=!p;
  $('sePortalCreateLink').disabled=!p;
  $('sePortalAttachStory').disabled=!p;
  if(!p)$('sePortalAttachStory').checked=false;
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
  document.querySelectorAll('[data-se-template]').forEach(b=>{const active=b.dataset.seTemplate===state.draft.templateId;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
  paint(canvas);
  if($('sePreviewDialog')?.open)paint($('sePreviewCanvas'));
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
  i.onerror=()=>{
    if(state.owner!==sourceOwner || owner()!==sourceOwner ||
       state.draft?.id!==sourceId || state.draft?.imageDataUrl!==url)return;
    notify('Не удалось загрузить изображение',true);
  };
  i.src=url;
}
function discardAiUndo(){
  state.aiUndo=null;
  const control=$('seUndoAiText');
  if(control){control.hidden=true;control.disabled=true;control.style.display='none';}
}
// Restore only AI-edited text/Portal; never replace media, layers or photos.
const aiEditableFields=(draft,portalIncluded)=>JSON.stringify({
  title:draft.title,subtitle:draft.subtitle,caption:draft.caption,
  ...(portalIncluded?{portal:draft.portal}: {})
});
function undoAiStorySuggestion(){
  const undo=state.aiUndo;
  if(!undo)return false;
  if(!owner()||owner()!==state.owner||undo.ownerId!==state.owner||
     !state.draft||state.draft.id!==undo.draftId){
    discardAiUndo();return false;
  }
  if(aiEditableFields(state.draft,undo.portalIncluded)!==undo.after){
    discardAiUndo();
    notify('После AI ты изменил текст или Portal вручную. Отмена недоступна, чтобы сохранить твои правки.',true);
    return false;
  }
  checkpoint();
  state.draft.title=undo.before.title;
  state.draft.subtitle=undo.before.subtitle;
  state.draft.caption=undo.before.caption;
  if(undo.portalIncluded){
    state.draft.portal=undo.before.portal;
    clearPublicPortalLink();$('sePortalAttachStory').checked=false;
  }
  discardAiUndo();render();
  notify('AI-изменения отменены. Фото, слои и настройки Story сохранены.');
  return true;
}
function applyDraft(d,preserveHistory=false){
  state.revision++;
  if(!preserveHistory){soundtrack?.clear();history.reset(state.owner||'0',d.id);historyGroup='';}
  $('sePreviewDialog')?.close?.();
  discardAiUndo();
  clearPublicPortalLink();
  // Publishing a public clickable link always needs a fresh opt-in.
  $('sePortalAttachStory').checked=false;
  state.selectedLayer=null;state.dragLayer=null;
  state.draft=normalizeDraft(d,state.owner||'0');loadImageForDraft();render();updateHistoryButtons();
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
    const attachPortal=$('sePortalAttachStory').checked && Boolean(state.draft.portal);
    // No URL is sent unless the owner explicitly selected the checkbox.
    const portalLink=attachPortal?makePublicPortalUrl(state.draft.portal,window.location.origin):null;
    input.dispatchEvent(new Event('change',{bubbles:true}));
    window.VetoTelegramPortalHandoff=portalLink?{
      url:portalLink,ownerId:exportOwner,draftId:exportDraftId
    }:null;
    window.dispatchEvent(new CustomEvent('veto:portal-handoff'));

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
// VETO AI can apply *text only* after checking the active Telegram owner.
// No async task may cross accounts. Media, Portal, audience and publish state stay untouched.
async function applyAiStorySuggestion(requested){
  const requestedOwner=String(requested?.ownerId||'');
  if(!requestedOwner||owner()!==requestedOwner)return false;
  await init();
  if(owner()!==requestedOwner||state.owner!==requestedOwner||!state.draft)return false;
  const incoming=requested.story;
  if(!incoming||typeof incoming!=='object')return false;
  const title=trimText(incoming.title,90),subtitle=trimText(incoming.subtitle,180);
  if(!title||!subtitle)return false;
  let approvedPortal=null;
  if(requested.replacePortal===true){
    try{
      // Only owner-approved text fields. Never inherit model URLs, chat data,
      // media, external form endpoints or existing private Portal responses.
      approvedPortal=normalizePortal({
        type:requested.portal?.type,
        title:requested.portal?.title,description:requested.portal?.description,
        cta:requested.portal?.cta,link:'',links:[],options:[]
      });
    }catch{return false;}
  }
  const draftId=state.draft.id;
  if(owner()!==requestedOwner||state.draft.id!==draftId)return false;
  const portalIncluded=requested.replacePortal===true;
  checkpoint();
  const before={
    title:state.draft.title,subtitle:state.draft.subtitle,
    caption:state.draft.caption,
    ...(portalIncluded?{portal:state.draft.portal==null?null:
      JSON.parse(JSON.stringify(state.draft.portal))}: {})
  };
  state.draft.title=title;
  state.draft.subtitle=subtitle;
  state.draft.caption=trimText(incoming.caption,800);
  if(requested.replacePortal===true){
    state.draft.portal=approvedPortal;
    clearPublicPortalLink();
    $('sePortalAttachStory').checked=false;
  }
  state.aiUndo={
    ownerId:requestedOwner,draftId,portalIncluded,before,
    after:aiEditableFields(state.draft,portalIncluded)
  };
  const undo=$('seUndoAiText');
  if(undo){undo.hidden=false;undo.disabled=false;undo.style.display='';}
  render();
  notify('AI-текст добавлен в Story. Проверь или отмени изменения перед сохранением.');
  return true;
}
window.VetoTelegramApplyAiStory=applyAiStorySuggestion;
window.addEventListener('vetogram:ai-story-suggestion',event=>{
  void applyAiStorySuggestion(event?.detail).catch(()=>{});
});

function setup(){
  soundtrack=setupStorySoundtrack({paint,notify,
    scope:()=>({owner:state.owner,id:state.draft?.id}),
    isCurrent:value=>Boolean(value&&value.owner===state.owner&&editorIdentity()===state.owner&&value.id===state.draft?.id)});
  // Each editing handler records its own pre-mutation snapshot.
  root.addEventListener('focusout',()=>{historyGroup='';});
  $('seUndo').addEventListener('click',()=>restoreHistory('undo'));
  $('seRedo').addEventListener('click',()=>restoreHistory('redo'));
  root.addEventListener('keydown',event=>{
    if(!(event.ctrlKey||event.metaKey)||event.altKey||event.target.closest('input,textarea,select'))return;
    if(event.key.toLowerCase()==='z'){
      event.preventDefault();restoreHistory(event.shiftKey?'redo':'undo');
    }
  });
  const tabs=[...root.querySelectorAll('[data-se-tool]')];
  function selectTool(tool,focus=false){
    tabs.forEach(tab=>{
      const selected=tab.dataset.seTool===tool;
      tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;
      const panel=$(tab.getAttribute('aria-controls'));if(panel)panel.hidden=!selected;
      if(selected&&focus)tab.focus();
    });
  }
  tabs.forEach(tab=>{
    tab.addEventListener('click',()=>selectTool(tab.dataset.seTool));
    tab.addEventListener('keydown',event=>{
      const visible=tabs.filter(item=>!item.hidden),index=visible.indexOf(tab);
      let next;
      if(event.key==='ArrowRight')next=(index+1)%visible.length;
      if(event.key==='ArrowLeft')next=(index+visible.length-1)%visible.length;
      if(event.key==='Home')next=0;if(event.key==='End')next=visible.length-1;
      if(next!==undefined){event.preventDefault();selectTool(visible[next].dataset.seTool,true);}
    });
  });
  function selectMode(mode){
    root.querySelectorAll('[data-se-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.seMode===mode)));
    root.querySelector('.se-editor-shell').dataset.mode=mode;
    tabs.forEach(tab=>{tab.hidden=mode==='quick'&&['Layers','Portal'].includes(tab.dataset.seTool);});
    selectTool(mode==='director'?'Director':mode==='pro'?'Layers':'Text');
  }
  root.querySelectorAll('[data-se-mode]').forEach(button=>button.addEventListener('click',()=>selectMode(button.dataset.seMode)));
  selectMode('quick');
  $('seMagicRemix').addEventListener('click',()=>{
    if(!state.draft||editorIdentity()!==state.owner)return;
    checkpoint();
    const index=STORY_TEMPLATES.findIndex(t=>t.id===state.draft.templateId);
    const next=STORY_TEMPLATES[(index+1)%STORY_TEMPLATES.length];
    state.draft.templateId=next.id;state.draft.textY=next.layout==='center'?388:675;
    render();notify('Новый стиль применён локально. Фото, текст и слои сохранены. Можно отменить.');
  });
  $('sePreview').addEventListener('click',()=>{
    if(!state.draft||editorIdentity()!==state.owner)return;
    if(state.draft.imageDataUrl&&state.imageSrc!==state.draft.imageDataUrl)return notify('Дождись загрузки фотографии',true);
    paint($('sePreviewCanvas'));$('sePreviewDialog').showModal();
  });
  $('sePreviewClose').addEventListener('click',()=>$('sePreviewDialog').close());
  window.addEventListener('veto:screen-changed',()=>{$('sePreviewDialog').close();});
  window.addEventListener('veto:screen-changed',event=>{if(event.detail?.screen==='story-engine')scheduleTemplatePreviews();});
  window.addEventListener('pagehide',()=>{$('sePreviewDialog').close();});
  canvas.addEventListener('keydown',event=>{
    const deltas={ArrowLeft:[-.01,0],ArrowRight:[.01,0],ArrowUp:[0,-.01],ArrowDown:[0,.01]};
    const delta=deltas[event.key],layer=state.draft?.layers?.find(l=>l.id===state.selectedLayer);
    if(!delta||!layer||state.owner!==owner())return;
    event.preventDefault();if(!event.repeat)checkpoint();
    const step=event.shiftKey?5:1;
    layer.x=Math.max(.09,Math.min(.91,layer.x+delta[0]*step));
    layer.y=Math.max(.09,Math.min(.91,layer.y+delta[1]*step));paint(canvas);
  });
  $('seUndoAiText').addEventListener('click',()=>void undoAiStorySuggestion());
  const holder=$('seTemplates');
  for(const t of STORY_TEMPLATES){
    const b=document.createElement('button');b.type='button';b.dataset.seTemplate=t.id;b.className='se-template';
    b.style.setProperty('--se-start',t.start);b.style.setProperty('--se-end',t.end);b.style.setProperty('--se-accent',t.accent);
    const thumbnail=document.createElement('canvas');
    thumbnail.className='se-template-canvas';
    thumbnail.width=108;thumbnail.height=192;
    thumbnail.setAttribute('aria-hidden','true');
    const mark=document.createElement('i'),title=document.createElement('strong'),small=document.createElement('small');
    title.textContent=t.name;small.textContent=t.mood;
    const type=document.createElement('span');type.className='noir-template-type';type.textContent=t.title;
    b.setAttribute('aria-label',t.name+' · '+t.mood);b.setAttribute('aria-pressed','false');
    b.append(thumbnail,mark,type,title,small);
    b.addEventListener('click',()=>{
      if(!state.draft||state.owner!==owner())return;
      if(state.draft.templateId===t.id)return;
      historyGroup='';checkpoint();
      state.draft=applyStoryTemplate(state.draft,t.id);
      render();notify('Оформление изменено — твой текст и фото сохранены');
    });
    holder.append(b);
  }
  scheduleTemplatePreviews();
  for(const days of RETENTION_DAYS){
    const el=document.createElement('option');el.value=days;el.textContent=days+' дней';$('seRetention').append(el);
  }
  for(const p of PORTAL_TYPES){
    const el=document.createElement('option');el.value=p.id;el.textContent=p.name;$('sePortalType').append(el);
  }
  const update=(key,max)=>e=>{if(!state.draft)return;recordEdit(e.target.id);state.draft[key]=trimText(e.target.value,max);paint(canvas)};
  $('seTitle').addEventListener('input',update('title',90));
  $('seSubtitle').addEventListener('input',update('subtitle',180));
  $('seCaption').addEventListener('input',e=>{if(state.draft){recordEdit(e.target.id);state.draft.caption=trimText(e.target.value,800)}});
  $('seRetention').addEventListener('change',e=>{if(state.draft){checkpoint();state.draft.retentionDays=Number(e.target.value)}});
  $('seRemixAllowed').addEventListener('change',e=>{if(state.draft){checkpoint();state.draft.remixable=e.target.checked}});
  $('seBranding').addEventListener('change',e=>{if(state.draft){checkpoint();state.draft.branding=e.target.checked;paint(canvas)}});
  $('seTextY').addEventListener('input',e=>{if(state.draft){recordEdit(e.target.id);state.draft.textY=Number(e.target.value);paint(canvas)}});
  $('seFontSize').addEventListener('input',e=>{if(state.draft){recordEdit(e.target.id);state.draft.fontSize=Number(e.target.value);paint(canvas)}});
  for(const [id,key,factor] of [['sePhotoZoom','photoZoom',100],['sePhotoX','photoX',100],['sePhotoY','photoY',100]]){
    $(id).addEventListener('input',e=>{if(state.draft){recordEdit(e.target.id);state.draft[key]=Number(e.target.value)/factor;paint(canvas)}});
  }
  $('sePhotoEffect').addEventListener('change',e=>{
    if(state.draft){checkpoint();state.draft.photoEffect=PHOTO_EFFECTS.includes(e.target.value)?e.target.value:'original';paint(canvas)}
  });
  $('sePhotoReset').addEventListener('click',()=>{
    if(!state.draft)return;
    checkpoint();Object.assign(state.draft,{photoZoom:1,photoX:0,photoY:0,photoEffect:'original'});render();
  });
  $('seLayerAdd').addEventListener('click',()=>{
    if(!state.draft)return;
    const text=trimText($('seLayerText').value,90);
    if(!text)return notify('Напиши текст нового слоя',true);
    if((state.draft.layers||[]).length>=6)return notify('Максимум 6 текстовых слоёв',true);
    const id=window.crypto?.randomUUID?.()||Date.now().toString(36)+'_'+Math.random().toString(36).slice(2);
    const layer=normalizeStoryLayer({id,text,style:$('seLayerStyle').value,x:.5,y:.52,size:27});
    checkpoint();state.draft.layers=normalizeStoryLayers([...(state.draft.layers||[]),layer]);
    state.selectedLayer=layer.id;renderLayers();paint(canvas);
    notify('Слой добавлен — перетащи его прямо на Story');
  });
  $('seLayerRemove').addEventListener('click',()=>{
    if(!state.draft||!state.selectedLayer)return;
    checkpoint();state.draft.layers=(state.draft.layers||[]).filter(layer=>layer.id!==state.selectedLayer);
    state.selectedLayer=null;renderLayers();paint(canvas);
  });
  $('seLayerSize').addEventListener('input',e=>{
    const layer=state.draft?.layers?.find(item=>item.id===state.selectedLayer);
    if(layer){recordEdit(e.target.id);layer.size=Number(e.target.value);paint(canvas)}
  });
  $('seLayerText').addEventListener('input',e=>{
    const layer=state.draft?.layers?.find(item=>item.id===state.selectedLayer);
    if(layer){recordEdit(e.target.id);layer.text=trimText(e.target.value,90);paint(canvas);renderLayers()}
  });
  $('seLayerStyle').addEventListener('change',e=>{
    const layer=state.draft?.layers?.find(item=>item.id===state.selectedLayer);
    if(layer){checkpoint();layer.style=STORY_LAYER_STYLES.includes(e.target.value)?e.target.value:'plain';renderLayers();paint(canvas)}
  });
  function pointerRatio(event){
    const r=canvas.getBoundingClientRect();
    return {x:Math.min(.91,Math.max(.09,(event.clientX-r.left)/r.width)),
      y:Math.min(.91,Math.max(.09,(event.clientY-r.top)/r.height))};
  }
  let pendingTextTap=null,pendingHeadingTap=null;
  canvas.addEventListener('pointerdown',event=>{
    if(!state.draft||state.owner!==owner())return;
    const p=pointerRatio(event);
    const layers=state.draft.layers||[];
    const hit=[...layers].reverse().find(layer=>Math.abs(layer.x-p.x)<.24 && Math.abs(layer.y-p.y)<.055);
    if(!hit){
      const headingY=Math.max(260,Math.min(740,Number(state.draft.textY)||388))/960;
      pendingHeadingTap=root.classList.contains('v4-studio-focus')&&
        Math.abs(p.y-headingY)<.13
        ?{pointerId:event.pointerId,ownerId:state.owner,draftId:state.draft.id,
          x:event.clientX,y:event.clientY,moved:false}
        :null;
      return;
    }
    pendingHeadingTap=null;
    // Merely tapping a layer opens its inspector; don't create an undo entry
    // or move the layer for natural finger jitter.
    state.selectedLayer=hit.id;state.dragLayer={
      owner:state.owner,draftId:state.draft.id,pointerId:event.pointerId,
      startX:event.clientX,startY:event.clientY,started:false
    };
    canvas.setPointerCapture?.(event.pointerId);event.preventDefault();
    $('seLayerText').value=hit.text;$('seLayerStyle').value=hit.style;
    renderLayers();
    pendingTextTap={pointerId:event.pointerId,layerId:hit.id,
      ownerId:state.owner,draftId:state.draft.id,
      x:event.clientX,y:event.clientY,moved:false};
  });
  canvas.addEventListener('pointermove',event=>{
    if(pendingTextTap?.pointerId===event.pointerId &&
       Math.hypot(event.clientX-pendingTextTap.x,event.clientY-pendingTextTap.y)>12)
      pendingTextTap.moved=true;
    if(pendingHeadingTap?.pointerId===event.pointerId &&
       Math.hypot(event.clientX-pendingHeadingTap.x,event.clientY-pendingHeadingTap.y)>12)
      pendingHeadingTap.moved=true;
    const drag=state.dragLayer;
    if(!drag||drag.pointerId!==event.pointerId)return;
    if(owner()!==drag.owner||state.owner!==drag.owner||state.draft?.id!==drag.draftId){
      state.dragLayer=null;return;
    }
    const layer=state.draft.layers?.find(item=>item.id===state.selectedLayer);
    if(!layer||activePhotoGesture)return;
    if(!drag.started){
      if(Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY)<12)return;
      // Exactly one history checkpoint for a real drag, never for selection.
      historyGroup='';checkpoint();drag.started=true;
      if(pendingTextTap?.pointerId===event.pointerId)pendingTextTap.moved=true;
    }
    const p=pointerRatio(event);layer.x=p.x;layer.y=p.y;
    paint(canvas);event.preventDefault();
  });
  const endDrag=()=>{state.dragLayer=null;};
  canvas.addEventListener('pointerup',event=>{
    const candidate=pendingTextTap;
    const heading=pendingHeadingTap;
    pendingTextTap=null;pendingHeadingTap=null;endDrag();
    if(heading&&heading.pointerId===event.pointerId&&!heading.moved &&
      !activePhotoGesture&&state.owner===heading.ownerId&&
      state.draft?.id===heading.draftId&&owner()===heading.ownerId){
      window.dispatchEvent(new CustomEvent('vetogram:story-heading-selected'));
      return;
    }
    if(!candidate||candidate.pointerId!==event.pointerId||candidate.moved||
       activePhotoGesture||state.owner!==candidate.ownerId||
       state.draft?.id!==candidate.draftId||owner()!==candidate.ownerId)return;
    window.dispatchEvent(new CustomEvent('vetogram:story-layer-selected',{
      detail:{layerId:candidate.layerId}
    }));
  });
  canvas.addEventListener('pointercancel',()=>{pendingTextTap=null;pendingHeadingTap=null;endDrag();});
  // Two-finger gestures alter ONLY the owner's loaded photo. One finger still
  // drags text layers through the original handler above. This is a local
  // canvas interaction and never triggers publishing or network requests.
  const photoPointers=new Map();
  let photoGesture=null;
  function releasePhotoPointer(event){
    photoPointers.delete(event.pointerId);
    if(photoPointers.size<2){
      const wasActive=Boolean(photoGesture);
      photoGesture=null;activePhotoGesture=false;
      if(wasActive&&state.draft&&state.owner===owner()){
        paint(canvas);
        scheduleTemplatePreviews();
      }
    }
  }
  function clearPhotoGesture(){
    photoPointers.clear();photoGesture=null;activePhotoGesture=false;
    pendingTextTap=null;pendingHeadingTap=null;
  }
  canvas.addEventListener('pointerdown',event=>{
    if(event.pointerType!=='touch'||!state.image?.naturalWidth||
       !state.draft||state.owner!==owner())return;
    photoPointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(photoPointers.size===2){
      const [a,b]=[...photoPointers.values()];
      const distance=Math.hypot(a.x-b.x,a.y-b.y);
      if(distance<12)return;
      historyGroup='';checkpoint();
      state.dragLayer=null;
      pendingTextTap=null;pendingHeadingTap=null;
      const d=state.draft;
      photoGesture={owner:state.owner,draftId:d.id,zoom:Number(d.photoZoom)||1,
        photoX:Number(d.photoX)||0,photoY:Number(d.photoY)||0,
        distance,centerX:(a.x+b.x)/2,centerY:(a.y+b.y)/2};
      activePhotoGesture=true;
      event.preventDefault();
    }
  });
  canvas.addEventListener('pointermove',event=>{
    if(!photoPointers.has(event.pointerId))return;
    photoPointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    const g=photoGesture;
    if(!g||photoPointers.size!==2)return;
    if(owner()!==g.owner||state.owner!==g.owner||state.draft?.id!==g.draftId){
      clearPhotoGesture();return;
    }
    const [a,b]=[...photoPointers.values()];
    const rect=canvas.getBoundingClientRect();
    try{
      Object.assign(state.draft,calculatePhotoPinch(g,a,b,rect.width,rect.height));
    }catch{return;}
    $('sePhotoZoom').value=String(Math.round(state.draft.photoZoom*100));
    $('sePhotoX').value=String(Math.round(state.draft.photoX*100));
    $('sePhotoY').value=String(Math.round(state.draft.photoY*100));
    paint(canvas);event.preventDefault();
  });
  canvas.addEventListener('pointerup',releasePhotoPointer);
  canvas.addEventListener('pointercancel',releasePhotoPointer);
  canvas.addEventListener('lostpointercapture',releasePhotoPointer);
  window.addEventListener('veto:screen-changed',event=>{
    if(event.detail?.screen!=='story-engine')clearPhotoGesture();
  });
  // Double-tap/double-click provides a one-action zoom reset/toggle.
  canvas.addEventListener('dblclick',event=>{
    if(!state.image?.naturalWidth||!state.draft||state.owner!==owner())return;
    event.preventDefault();historyGroup='';checkpoint();
    const zoomed=(Number(state.draft.photoZoom)||1)>1.08;
    state.draft.photoZoom=zoomed?1:1.65;
    if(zoomed){state.draft.photoX=0;state.draft.photoY=0;}
    render();
    notify(zoomed?'Фото возвращено к исходному масштабу':'Фото увеличено. Два пальца — масштаб и положение.');
  });
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
      checkpoint();state.draft.imageDataUrl=data;state.draft.imageMime=file.type;loadImageForDraft();
      notify('Фото загружено. Исходник остаётся на устройстве.');
    };
    reader.readAsDataURL(file);
  });
  $('seClearPhoto').addEventListener('click',()=>{if(!state.draft)return;checkpoint();state.draft.imageDataUrl='';state.draft.imageMime='';loadImageForDraft()});
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
    if(!type){checkpoint();state.draft.portal=null;render();return}
    try{
      const raw={type,title:$('sePortalTitle').value,description:$('sePortalDescription').value,
        cta:$('sePortalCta').value,link:$('sePortalLink').value,
        optionsText:$('sePortalOptions').value,linksText:$('sePortalLinks').value};
      const normalizedPortal=normalizePortal(raw);checkpoint();state.draft.portal=normalizedPortal;
      clearPublicPortalLink();render();
      notify('Portal добавлен в текущий проект. Нажми «Сохранить», чтобы записать его на устройстве. Публичной ссылки пока нет.');
    }catch(e){notify(e.message,true)}
  }
  $('sePortalSave').addEventListener('click',readPortal);
  $('sePortalCreateLink').addEventListener('click',()=>{
    try{
      requireOwner();
      const portal=state.draft.portal;
      if(!portal)throw Error('Сначала сохрани Portal');
      if(!window.confirm('Создать публичную ссылку? Текст Portal и его ссылки станут доступны каждому получателю. Ссылку нельзя отозвать и её содержимое можно изменить. Фото, чаты и данные Telegram в неё не попадут.'))return;
      const url=makePublicPortalUrl(portal,window.location.origin);
      $('sePortalPublicLink').value=url;
      $('sePortalShareResult').hidden=false;
      notify('Ссылка подготовлена. Она заработает после выпуска Story Engine на сайт.');
    }catch(error){notify(error.message,true)}
  });
  $('sePortalCopyLink').addEventListener('click',async()=>{
    try{
      requireOwner();
      const value=$('sePortalPublicLink').value;
      if(!value)throw Error('Сначала создай ссылку');
      if(!navigator.clipboard?.writeText)throw Error('Копирование недоступно');
      await navigator.clipboard.writeText(value);
      notify('Ссылка скопирована');
    }catch(error){
      $('sePortalPublicLink').select();
      notify('Скопируй выделенный адрес вручную: '+error.message,true);
    }
  });
  $('sePortalOpenLink').addEventListener('click',()=>{
    try{
      requireOwner();
      const url=$('sePortalPublicLink').value;
      if(!url)throw Error('Сначала создай ссылку');
      if(tg?.openLink)tg.openLink(url);
      else window.open(url,'_blank','noopener,noreferrer');
    }catch(error){notify(error.message,true)}
  });
  $('sePortalTry').addEventListener('click',()=>{
    try{
      requireOwner();
      if(!state.draft.portal)throw Error('Сначала настрой Portal и нажми «Сохранить Portal»');
      const currentOwner=state.owner,currentDraftId=state.draft.id;
      showPortalPreview(state.draft.portal,{
        stillAuthorized:()=>owner()===currentOwner && state.owner===currentOwner &&
          state.draft?.id===currentDraftId
      });
    }catch(error){notify(error.message,true)}
  });
  $('sePortalRemove').addEventListener('click',()=>{
    if(!state.draft)return;
    checkpoint();state.draft.portal=null;clearPublicPortalLink();render();notify('Portal отвязан');
  });
  $('sePortalType').addEventListener('change',()=>{
    const item=PORTAL_TYPES.find(p=>p.id===$('sePortalType').value);
    if(item)$('sePortalCta').value=item.cta;
    $('sePortalPollFields').hidden=$('sePortalType').value!=='poll';
    $('sePortalLinksFields').hidden=$('sePortalType').value!=='links';
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
