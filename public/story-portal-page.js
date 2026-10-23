import {decodePublicPortal} from './story-portal-share.js';
import {safeExternalUrl,PORTAL_TYPES,trimText} from './story-engine-core.js';
const $=id=>document.getElementById(id);
const actions=$('publicPortalActions'),feedback=$('publicPortalFeedback'),notice=$('publicPortalNotice'),
  type=$('publicPortalType'),title=$('publicPortalTitle'),desc=$('publicPortalDescription'),share=$('publicPortalShare');
function button(label,callback,primary=false){
  const b=document.createElement('button');b.type='button';b.className='portal-action'+(primary?' primary':'');
  b.textContent=trimText(label,90)||'Продолжить';b.addEventListener('click',callback);actions.append(b);return b;
}
function link(label,value,primary=false){
  const safe=safeExternalUrl(value);if(!safe)return;
  const el=document.createElement('a');el.href=safe;el.target='_blank';el.rel='noopener noreferrer';
  el.className='portal-action'+(primary?' primary':'');
  const caption=document.createElement('span');caption.textContent=trimText(label,50)||'Открыть';
  const host=document.createElement('small');host.textContent='↗ '+new URL(safe).hostname;
  el.append(caption,host);actions.append(el);
}
function render(){
  actions.replaceChildren();feedback.textContent='';share.hidden=true;
  let portal,expires;
  try{({portal,expires}=decodePublicPortal(window.location.hash))}
  catch(e){
    type.textContent='VETO / STORY';
    title.textContent=e.message==='PORTAL_LINK_EXPIRED'?'Время действия ссылки истекло':'Эта ссылка недоступна';
    desc.textContent='Попроси автора создать новую ссылку в VETOGRAM Story Engine.';
    notice.textContent='Этот Portal не отправлял персональную информацию на сервер.';
    return;
  }
  const item=PORTAL_TYPES.find(x=>x.id===portal.type);
  type.textContent=(item?.name||'Portal').toUpperCase()+' · VETO PORTAL';
  title.textContent=portal.title||'VETO Portal';
  desc.textContent=portal.description||'Интерактивное продолжение Story';
  const expiration=new Date(expires).toLocaleDateString('ru-RU');
  notice.textContent='Карточка доступна до '+expiration+'. Её сможет открыть любой, у кого есть ссылка. Ответы, заявки и голоса не отправляются и не сохраняются. Без серверного хранилища отозвать уже распространённую ссылку нельзя.';
  if(portal.type==='poll'){
    portal.options.forEach((choice,index)=>{
      const b=button(choice,()=>{
        actions.querySelectorAll('button').forEach(node=>{
          node.classList.toggle('selected',node===b);
          node.setAttribute('aria-pressed',node===b?'true':'false');
        });
        feedback.textContent='Выбран вариант '+(index+1)+'. Это локальная реакция: голос автору не отправлен.';
      });
      b.setAttribute('aria-pressed','false');
    });
  }else if(portal.type==='links'){
    if(portal.link)link(portal.cta,portal.link);
    portal.links.forEach(v=>link(v.label,v.url));
    if(!actions.childElementCount)feedback.textContent='Автор ещё не добавил ссылки.';
  }else if(portal.type==='offer'){
    if(portal.link)link(portal.cta,portal.link,true);
    else feedback.textContent='Автор не указал адрес предложения.';
  }else{
    button(portal.cta,()=>{
      feedback.textContent=portal.type==='waitlist'?
        'Запись в лист ожидания пока недоступна: контакты не собираются.':
        'Приглашение показано. Подтверждение не сохраняется и автору не отправляется.';
    },true);
  }
  share.hidden=false;
}
$('publicPortalCopy').addEventListener('click',async()=>{
  try{await navigator.clipboard.writeText(window.location.href);
      $('publicPortalCopy').textContent='Скопировано ✓'}
  catch{feedback.textContent='Браузер запретил копирование. Скопируй ссылку из адресной строки.'}
});
window.addEventListener('hashchange',render);
render();
