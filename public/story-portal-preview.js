import {normalizePortal,safeExternalUrl,PORTAL_TYPES,trimText} from './story-engine-core.js';

/** Interactive LOCAL Portal preview: no public URL or server-side response storage. */
export function showPortalPreview(raw,{stillAuthorized=()=>true}={}) {
  if(!stillAuthorized())throw Error('Telegram-аккаунт изменился');
  const portal=normalizePortal(raw);
  const doc=document,returnFocus=doc.activeElement;
  const overlay=doc.createElement('div');overlay.className='se-portal-demo-overlay';
  const panel=doc.createElement('section');panel.className='se-portal-demo';
  panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');
  panel.setAttribute('aria-label','Предпросмотр VETO Portal');panel.tabIndex=-1;
  const close=doc.createElement('button');close.type='button';close.textContent='×';
  close.className='se-portal-demo-close';close.setAttribute('aria-label','Закрыть Portal');
  const type=doc.createElement('p');type.className='se-portal-demo-label';
  type.textContent=(PORTAL_TYPES.find(p=>p.id===portal.type)?.name||'PORTAL').toUpperCase()+' / LIVE PREVIEW';
  const title=doc.createElement('h2');title.textContent=portal.title||'VETO PORTAL';
  const desc=doc.createElement('p');desc.textContent=portal.description||'Продолжение твоей Story';
  const actions=doc.createElement('div');actions.className='se-portal-demo-actions';
  const feedback=doc.createElement('p');feedback.className='se-portal-demo-feedback';
  feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');
  const disclaimer=doc.createElement('p');disclaimer.className='se-portal-demo-disclaimer';
  disclaimer.textContent='Локальный интерактивный предпросмотр: голосования, приглашения и заявки не отправляются и не хранятся на сервере. Публичного Portal пока нет.';
  const oldOverflow=doc.body.style.overflow;
  let closed=false;
  const done=()=>{
    if(closed)return;
    closed=true;
    doc.removeEventListener('keydown',onKeys);
    window.removeEventListener('veto:screen-changed',onContextChange);
    window.removeEventListener('pageshow',onContextChange);
    window.removeEventListener('focus',onContextChange);
    overlay.remove();doc.body.style.overflow=oldOverflow;returnFocus?.focus?.();
  };
  const onContextChange=e=>{
    if(e?.type==='veto:screen-changed'&&e.detail?.screen!=='story-engine')return done();
    if(!stillAuthorized())done();
  };
  const onKeys=e=>{
    if(e.key==='Escape'){e.preventDefault();done();return}
    if(e.key==='Tab'){
      const focusables=[...panel.querySelectorAll('a[href],button:not(:disabled)')];
      if(!focusables.length)return;
      const first=focusables[0],last=focusables[focusables.length-1];
      if(e.shiftKey&&doc.activeElement===first){e.preventDefault();last.focus()}
      else if(!e.shiftKey&&doc.activeElement===last){e.preventDefault();first.focus()}
    }
  };
  close.addEventListener('click',done);
  overlay.addEventListener('click',e=>{if(e.target===overlay)done()});
  const button=(label,onClick,primary=false)=>{
    const b=doc.createElement('button');b.type='button';
    b.className='se-portal-demo-action'+(primary?' primary':'');
    b.textContent=trimText(label,80)||'Открыть';b.addEventListener('click',onClick);actions.append(b);return b;
  };
  const link=(label,href,primary=false)=>{
    const safe=safeExternalUrl(href);if(!safe)return;
    const a=doc.createElement('a');a.href=safe;a.target='_blank';a.rel='noopener noreferrer';
    a.className='se-portal-demo-action'+(primary?' primary':'');
    const caption=doc.createElement('span');caption.textContent=trimText(label,60)||'Открыть';
    const host=doc.createElement('small');host.textContent='↗ '+new URL(safe).hostname;
    a.append(caption,host);actions.append(a);
  };
  const acknowledgement=()=>{
    feedback.textContent='Действие показано только в предпросмотре. Реальная заявка не создана.';
  };
  if(portal.type==='poll'){
    portal.options.forEach((value,index)=>{
      const b=button(value,()=>{
        actions.querySelectorAll('button').forEach(el=>{
          el.classList.toggle('selected',el===b);
          el.setAttribute('aria-pressed',el===b?'true':'false');
        });
        feedback.textContent='Выбран вариант '+(index+1)+'. Голос не отправлен и не сохранён.';
      });
      b.setAttribute('aria-pressed','false');
    });
  }else if(portal.type==='links'){
    if(portal.link)link(portal.cta,portal.link);
    portal.links.forEach(item=>link(item.label,item.url));
    if(!actions.childElementCount)button('Добавь HTTPS-ссылку',()=>{feedback.textContent='Сначала добавь ссылку в настройках Portal.'});
  }else if(portal.type==='offer'&&portal.link){
    link(portal.cta,portal.link,true);
  }else if(portal.type==='offer'){
    button('Добавь ссылку на предложение',()=>{feedback.textContent='Добавь HTTPS-ссылку в настройках.'});
  }else{
    button(portal.cta,acknowledgement,true);
    if(portal.type==='waitlist')feedback.textContent='Контакты не собираются: форма ожидания пока не опубликована.';
  }
  panel.append(close,type,title,desc,actions,feedback,disclaimer);
  overlay.append(panel);doc.body.append(overlay);
  doc.body.style.overflow='hidden';doc.addEventListener('keydown',onKeys);
  window.addEventListener('veto:screen-changed',onContextChange);
  window.addEventListener('pageshow',onContextChange);
  window.addEventListener('focus',onContextChange);
  close.focus();
  return {close:done};
}
