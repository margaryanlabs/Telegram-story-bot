/* VETOGRAM 6.1 Media Home and VETO VAULT — personal, local-only index. */
(()=>{
 'use strict';
 const api=window.VetogramUniverse,core=window.VetogramUniverse61Core;
 if(!api||!core)return;
 const $=id=>document.getElementById(id);
 const home=$('v6MediaHome'),search=$('v61Search'),results=$('v61Results'),
       resultList=$('v61ResultsList'),continueList=$('v61ContinueList'),
       continueSection=$('v61Continue'),vault=$('v61VaultPanel'),
       vaultList=$('v61VaultList'),vaultStatus=$('v61VaultStatus');
 if(!home||!search||!resultList||!vault)return;
 let scope='',cachedItems=null;
 let filter='all',searchLimit=35,vaultLimit=50;
 const kindLabel={music:'Музыка',cinema:'Кино',books:'Книги',link:'Ссылка'};
 const icon={music:'♫',cinema:'▷',books:'▤',link:'↗'};
 const getScope=()=>{
   const c=api.context(),id=String(c.user?.id||'');
   return c.initData&&/^\d{1,20}$/.test(id)?'owner-'+id:'device';
 };
 const key=suffix=>'vetogram-v61-'+suffix+':'+scope;
 const storage=()=>{
   try{return window.localStorage;}catch{return null;}
 };
 const read=(suffix,fallback)=>core.read(storage(),key(suffix),fallback);
 const store=(suffix,value)=>{
   try{
     const target=storage();
     if(!target)return false; // Never claim success when private storage is blocked.
     target.setItem(key(suffix),JSON.stringify(value));
     cachedItems=null;
     return true;
   }catch{return false;}
 };
 const el=(tag,className,label)=>{
   const node=document.createElement(tag);
   if(className)node.className=className;
   if(label!==undefined)node.textContent=label;
   return node;
 };
 const entryButton=item=>{
   const button=el('button','v61-item');button.type='button';
   const glyph=el('span','v61-item-icon',icon[item.kind]||'◈');
   const body=el('span','v61-item-copy');
   const title=el('strong','',item.title),metadata=el('small','',
      [kindLabel[item.kind],item.subtitle,item.description].filter(Boolean).join(' · '));
   body.append(title,metadata);button.append(glyph,body,el('span','v61-item-go','↗'));
   if(item.progress>0&&item.progress<.99){
     const track=el('span','v61-item-progress'),line=el('i');
     line.style.width=Math.round(item.progress*100)+'%';track.append(line);body.append(track);
   }
   button.addEventListener('click',()=>{
     if(item.kind==='link'){
      const safe=core.url(item.href);
      if(safe){
       if(typeof window.Telegram?.WebApp?.openLink==='function')window.Telegram.WebApp.openLink(safe);
       else window.open(safe,'_blank','noopener,noreferrer');
      }
     }
     else api.open(item.kind,item.kind==='music'?'library':undefined,item.id);
   });
   return button;
 };
 const items=()=>cachedItems||(cachedItems=core.collect(storage(),scope));
 const renderResults=()=>{
   const term=search.value.trim(),show=!!term,matched=show?core.search(items(),term,filter):[];
   home.classList.toggle('v61-searching',show);
   results.hidden=!show;resultList.replaceChildren();
   const more=$('v61SearchMore');
   more.hidden=!show||matched.length<=searchLimit;
   more.textContent='Показать ещё · '+Math.min(35,Math.max(0,matched.length-searchLimit))+' из '+matched.length;
   if(!show)return;
   $('v61ResultsTitle').textContent='Результаты в личной коллекции · '+matched.length;
   if(!matched.length)resultList.append(el('p','v61-empty','Пока ничего не сохранено с таким названием. Можешь искать в каталогах ниже.'));
   else resultList.append(...matched.slice(0,searchLimit).map(entryButton));
 };
 const renderContinue=()=>{
   const found=core.latest(items());
   continueSection.hidden=!found.length;continueList.replaceChildren(...found.map(entryButton));
 };
 const renderVault=()=>{
   const saved=items().filter(x=>x.source==='liked'||x.source==='saved'||x.source==='progress'||x.kind==='link');
   const filtered=core.search(saved,'',filter);
   $('v61VaultCount').textContent=String(saved.length);
   const more=$('v61VaultMore');
   more.hidden=vault.hidden||filtered.length<=vaultLimit;
   more.textContent='Показать ещё · '+Math.min(50,Math.max(0,filtered.length-vaultLimit))+' из '+filtered.length;
   vaultList.replaceChildren();
   if(vault.hidden)return;
   if(!filtered.length)vaultList.append(el('p','v61-empty','Твоя коллекция пока пуста. Добавь музыку, книгу или собственную ссылку.'));
   else vaultList.append(...filtered.slice(0,vaultLimit).map(item=>{
    const itemRow=el('div','v61-vault-row');itemRow.append(entryButton(item));
    if(item.kind==='link'){
     const remove=el('button','v61-link-remove','×');remove.type='button';remove.title='Удалить ссылку';remove.setAttribute('aria-label','Удалить ссылку '+item.title);
     remove.addEventListener('click',()=>{
      const links=read('links',[]);
      if(!Array.isArray(links))return;
      if(store('links',links.filter(x=>x.href!==item.href))){vaultStatus.textContent='Ссылка удалена из локальной коллекции.';refresh();}
     });
     itemRow.append(remove);
    }
    return itemRow;
   }));
 };
 const refresh=()=>{
   cachedItems=null; // Re-read only on real data/identity/focus changes.
   const next=getScope();
   if(scope!==next){
     scope=next; search.value=''; filter='all'; searchLimit=35;vaultLimit=50;vault.hidden=true;
     $('v61VaultButton').setAttribute('aria-expanded','false');
     home.classList.remove('v61-searching');
     document.querySelectorAll('[data-v61-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.v61Filter==='all')));
   }
   renderContinue();renderVault();renderResults();
 };
 function remember(data){
   if(!data||!['music','cinema','books'].includes(data.kind))return;
   const id=core.text(data.id,220),title=core.text(data.title);
   if(!id||!title)return;
   const existing=read('recent',[]);
   const entry={kind:data.kind,id,title,subtitle:core.text(data.subtitle,110),at:Date.now(),
     progress:Math.max(0,Math.min(1,Number(data.progress)||0)),source:'recent'};
   const list=[entry,...(Array.isArray(existing)?existing:[]).filter(x=>x?.kind!==entry.kind||x?.id!==entry.id)].slice(0,25);
   if(store('recent',list)){renderContinue();renderVault();if(search.value.trim())renderResults();}
 }
 window.addEventListener('vetogram:music-library',event=>{
   if(getScope()!==scope)refresh();
   const incoming=event.detail?.items;
   if(!Array.isArray(incoming))return;
   if(store('music',incoming.slice(0,250))){renderContinue();renderVault();renderResults();}
 });
 window.addEventListener('vetogram:media-library',event=>{
   if(getScope()!==scope)refresh();
   const incoming=event.detail?.items;
   if(!Array.isArray(incoming))return;
   if(store('cinema',incoming.slice(0,120))){renderContinue();renderVault();renderResults();}
 });
 window.addEventListener('vetogram:media-recent',event=>{
   if(getScope()!==scope)refresh();
   remember(event.detail);
 });
 $('v61SearchForm').addEventListener('submit',event=>event.preventDefault());
 search.addEventListener('input',()=>{searchLimit=35;renderResults();});
 $('v61SearchMore').addEventListener('click',()=>{searchLimit+=35;renderResults();});
 $('v61VaultMore').addEventListener('click',()=>{vaultLimit+=50;renderVault();});
 $('v61SearchClear').addEventListener('click',()=>{search.value='';renderResults();search.focus()});
 document.querySelectorAll('[data-v61-filter]').forEach(button=>{
   button.addEventListener('click',()=>{
     filter=button.dataset.v61Filter;searchLimit=35;vaultLimit=50;
     document.querySelectorAll('[data-v61-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
     renderResults();renderVault();
   });
 });
 $('v61VaultButton').addEventListener('click',()=>{
   vault.hidden=!vault.hidden;
   if(!vault.hidden)vaultLimit=50;
   $('v61VaultButton').setAttribute('aria-expanded',String(!vault.hidden));
   renderVault();
   if(!vault.hidden)vault.scrollIntoView({behavior:'smooth',block:'nearest'});
 });
 $('v61VaultClose').addEventListener('click',()=>{$('v61VaultButton').click()});
 $('v61SaveLink').addEventListener('submit',event=>{
   event.preventDefault();
   const title=core.text($('v61LinkTitle').value,110),href=core.url($('v61LinkUrl').value);
   if(!title||!href){vaultStatus.textContent='Введи название и действительную ссылку HTTPS.';return;}
   const existing=read('links',[]);
   const list=[{kind:'link',id:href,title,subtitle:new URL(href).hostname,href,at:Date.now()},
     ...(Array.isArray(existing)?existing:[]).filter(x=>x?.href!==href)].slice(0,75);
   if(!store('links',list)){vaultStatus.textContent='Не удалось сохранить ссылку на устройстве.';return;}
   $('v61LinkTitle').value='';$('v61LinkUrl').value='';
   vaultStatus.textContent='Ссылка сохранена только в твоей личной коллекции.';
   refresh();
 });
 $('v61VaultList').addEventListener('click',()=>{vaultStatus.textContent=''});
 window.addEventListener('vetogram:identity-change',refresh);
 window.addEventListener('focus',refresh);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
 window.addEventListener('storage',event=>{if(event.key?.includes('vetogram'))refresh()});
 // Refresh the continue shelf when coming back from a reader or a movie session.
 window.addEventListener('veto:screen-changed',event=>{if(event.detail?.screen==='media')refresh()});
 refresh();
})();
