/* VETO MEDIA V5 | Personal universe & cinematic micro-interactions */
(()=>{
  'use strict';
  const $=id=>document.getElementById(id);
  const key='veto-media-personal-v5';
  const themes=['pulse','aurora','midnight'];
  const MAX=60;
  const cap=(v,n=180)=>String(v??'').trim().slice(0,n);
  const safeUrl=v=>{try{const u=new URL(String(v));return u.protocol==='https:'?u.href:''}catch{return''}};
  const now=()=>new Date().toISOString();
  const node=(tag,klass,text)=>{const e=document.createElement(tag);if(klass)e.className=klass;if(text!==undefined)e.textContent=String(text);return e};
  const data={films:[],books:[]};
  try{
    const obj=JSON.parse(localStorage.getItem(key)||'null');
    for(const type of ['films','books']) if(Array.isArray(obj?.[type])) data[type]=obj[type].filter(x=>x&&typeof x.id==='string'&&typeof x.title==='string').slice(0,MAX).map(x=>({id:cap(x.id,500),title:cap(x.title),source:safeUrl(x.source),label:cap(x.label,90),date:cap(x.date,30)}));
  }catch{}
  const persist=()=>{try{localStorage.setItem(key,JSON.stringify(data));return true}catch{toast('Локальное сохранение недоступно в этом режиме просмотра');return false}};
  function toast(message){
    let bar=$('v5Toast');if(!bar){bar=node('div','v5-toast');bar.id='v5Toast';bar.setAttribute('role','status');document.body.append(bar)}
    bar.textContent=message;bar.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>bar.classList.remove('show'),2600);
  }
  function typeName(type){return type==='films'?'Фильм':'Книга'}
  function exists(type,id){return data[type].some(v=>v.id===id)}
  function toggle(type,entry){
    if(!['films','books'].includes(type)||!entry?.id||!entry?.title)return;
    const previous=data[type].slice();
    const found=data[type].findIndex(x=>x.id===entry.id);
    if(found>=0)data[type].splice(found,1);
    else {data[type].unshift({...entry,date:now()});data[type]=data[type].slice(0,MAX)}
    if(!persist()){data[type]=previous;paint();refreshButtons();return}
    toast(typeName(type)+(found>=0?' удалён из коллекции':' добавлен в коллекцию ♡'));
    paint();refreshButtons();
  }
  function getFilm(){
    const title=cap($('movieName')?.textContent||$('vetoFilmModalTitle')?.textContent||'');
    const source=safeUrl($('movieSource')?.href||$('vetoFilmOriginal')?.href||'');
    const detail=cap($('movieOver')?.textContent||$('vetoFilmModalLabel')?.textContent||'',90);
    const concept=!!$('movieTrailer') && !/Смотреть в плеере/.test($('movieTrailer').textContent||'');
    if(!title||!source)return null;
    return {id:'film:'+source+(concept?'#concept:'+title:''),title,source,label:concept?'ВИЗУАЛЬНЫЙ КОНЦЕПТ':detail||'АРХИВНОЕ КИНО'};
  }
  function getBook(){
    const title=cap($('readerTitle')?.textContent||'');
    const source=safeUrl($('bookSource')?.href||$('openOriginal')?.href||'');
    if(!title||!source)return null;
    return {id:'book:'+source,title,source,label:'КНИГА / ИСТОЧНИК'};
  }
  function makeSaveButton(id,container,kind,getter){
    if(!container||$(id))return;
    const b=node('button','v5-save-btn','♡ В коллекцию');b.id=id;b.type='button';b.setAttribute('aria-pressed','false');
    b.onclick=()=>toggle(kind,getter());container.append(b);
  }
  makeSaveButton('v5SaveFilm',$('movieTitle')?.parentElement||$('vetoFilmClose')?.parentElement,'films',getFilm);
  makeSaveButton('v5SaveBook',$('readerTitle')?.closest('.readerhead')||$('saveBook')?.parentElement,'books',getBook);
  function refreshButtons(){
    for(const [id,kind,getter] of [['v5SaveFilm','films',getFilm],['v5SaveBook','books',getBook]]){
      const b=$(id);if(!b)continue;const e=getter();const saved=!!e&&exists(kind,e.id);
      b.disabled=!e;b.textContent=saved?'♥ Сохранено':'♡ В коллекцию';b.classList.toggle('saved',saved);b.setAttribute('aria-pressed',String(saved));
    }
  }
  // Small premium controls directly in the personal screen.
  const shell=node('section','v5-personal');shell.id='v5Personal';
  shell.innerHTML='<div class="v5-personal-head"><div><span class="v5-kicker">VETO / PERSONAL UNIVERSE</span><h3>Твой мир историй</h3><p>Фильмы и книги, которые хочется оставить с собой. Без аккаунта и без загрузки в облако.</p></div><div class="v5-count"><b id="v5Total">0</b><span>СОХРАНЕНО</span></div></div><div class="v5-personal-tabs"><button type="button" data-v5-collection="films" class="active">◉ Фильмы <span id="v5FilmsCount">0</span></button><button type="button" data-v5-collection="books">▤ Книги <span id="v5BooksCount">0</span></button></div><div class="v5-shelf" id="v5Shelf"></div><div class="v5-personal-bottom"><span>Только на этом устройстве. Очистка данных браузера удалит подборку.</span><button type="button" id="v5Export">↗ Экспортировать список</button></div>';
  const mine=$('mine')||$('libraryView');if(mine)mine.prepend(shell);
  let selected='films';
  function paint(){
    const count=data.films.length+data.books.length;
    if($('v5Total'))$('v5Total').textContent=String(count).padStart(2,'0');
    if($('v5FilmsCount'))$('v5FilmsCount').textContent=data.films.length;
    if($('v5BooksCount'))$('v5BooksCount').textContent=data.books.length;
    const root=$('v5Shelf');if(!root)return;root.replaceChildren();
    const source=data[selected];
    if(!source.length){
      const empty=node('div','v5-empty');empty.append(node('span','v5-empty-orb','✧'),node('strong','',selected==='films'?'Пока нет избранных фильмов':'Здесь появятся любимые книги'),node('p','',selected==='films'?'Открой кино, выбери фильм и нажми «В коллекцию».':'Открой книгу и нажми «В коллекцию».'));
      const b=node('button','','Открыть '+(selected==='films'?'кино':'книги')+' ↗');b.onclick=()=>jump(selected==='films'?'films':'books');empty.append(b);root.append(empty);return;
    }
    for(const item of source){
      const card=node('article','v5-library-card');const mark=node('div','v5-card-art',selected==='films'?'◉':'▤');
      const info=node('div','v5-card-info');info.append(node('small','',item.label),node('strong','',item.title),node('span','',new Date(item.date||Date.now()).toLocaleDateString('ru-RU')));
      const actions=node('div','v5-card-actions');
      const a=node('a','','Источник ↗');a.href=item.source||'#';a.target='_blank';a.rel='noopener noreferrer';actions.append(a);
      const b=node('button','','Удалить');b.onclick=()=>toggle(selected,item);actions.append(b);
      info.append(actions);card.append(mark,info);root.append(card);
    }
  }
  function jump(id){
    const selector= '[data-page="'+id+'"],[data-tab="'+(id==='audio'?'audiobooks':id)+'"]';const options=document.querySelectorAll(selector);
    const button=Array.from(options).find(x=>x.offsetParent!==null)||options[0];button?.click();
    if(id==='films')$('filmRail')?.scrollIntoView({behavior:'smooth',block:'start'});
  }
  for(const b of shell.querySelectorAll('[data-v5-collection]'))b.onclick=()=>{selected=b.dataset.v5Collection;shell.querySelectorAll('[data-v5-collection]').forEach(x=>x.classList.toggle('active',x===b));paint()};
  $('v5Export')?.addEventListener('click',()=>{
    const blob=new Blob([JSON.stringify({format:'veto-media-v5-watchlist',version:1,exported:now(),films:data.films,books:data.books},null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='veto-media-collection.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),6000);toast('Список сохранён на устройстве');
  });
  window.VetoPersonal=Object.freeze({
    snapshot:()=>({films:data.films.map(x=>({...x})),books:data.books.map(x=>({...x}))}),
    importCollection(input){
      if(!input||input.format!=='veto-media-v5-watchlist'||input.version!==1)throw Error('Формат резервной копии не поддерживается');
      const updated={};
      for(const kind of ['films','books']){
        if(!Array.isArray(input[kind])||input[kind].length>MAX)throw Error('Слишком много элементов');
        const ids=new Set();updated[kind]=[];
        for(const item of input[kind]){
          if(!item||typeof item.id!=='string'||item.id.length<3||item.id.length>500||
             typeof item.title!=='string'||!item.title.trim()||item.title.length>180||
             typeof item.source!=='string'||item.source.length>1200)throw Error('Некорректная запись в архиве');
          const link=safeUrl(item.source);
          if(!link||ids.has(item.id))throw Error('Недопустимая или повторная ссылка');
          ids.add(item.id);
          updated[kind].push({id:cap(item.id,500),title:cap(item.title),source:link,
            label:cap(item.label,90),date:cap(item.date,30)});
        }
      }
      const original={films:data.films,books:data.books};
      data.films=updated.films;data.books=updated.books;
      if(!persist()){data.films=original.films;data.books=original.books;throw Error('Устройство не разрешило сохранить библиотеку')}
      paint();refreshButtons();
      toast('Коллекция восстановлена: '+(data.films.length+data.books.length)+' элементов');
      return {films:data.films.length,books:data.books.length};
    }
  });
  const observeIds=['movieName','movieTitle','vetoFilmModalTitle','readerTitle','movieTrailer','filmEmbedHost','readerContent'];
  const debounce=()=>{clearTimeout(refreshButtons.timer);refreshButtons.timer=setTimeout(refreshButtons,50)};
  for(const id of observeIds){const element=$(id);if(element)new MutationObserver(debounce).observe(element,{characterData:true,childList:true,subtree:true})}
  // Lightweight cover effects: passive pointer only, disabled for touch and reduced motion.
  if(window.matchMedia?.('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)').matches){
    const cardSelectors='.film-card,.veto-film-item,.mood-tile,.v4-feature-tile';
    document.addEventListener('pointermove',e=>{const card=e.target.closest?.(cardSelectors);if(!card)return;const r=card.getBoundingClientRect();card.style.setProperty('--v5x',Math.round((e.clientX-r.left)/r.width*100)+'%');card.style.setProperty('--v5y',Math.round((e.clientY-r.top)/r.height*100)+'%')},{passive:true});
  }
  window.addEventListener('storage',e=>{if(e.key!==key)return;try{const v=JSON.parse(e.newValue);for(const t of ['films','books'])if(Array.isArray(v[t]))data[t]=v[t].slice(0,MAX);paint();refreshButtons()}catch{}});
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape')return;
    if((e.key===' '||e.key.toLowerCase()==='k')&&!e.altKey&&!e.ctrlKey&&!e.metaKey&&!e.repeat){
      if(e.target.closest('input,textarea,select,button,a,[contenteditable]')||$('movie')&&!$('movie').classList.contains('hidden')||$('reader')&&!$('reader').classList.contains('hidden'))return;
      const player=$('playButton')||$('play');if(player){e.preventDefault();player.click()}
    }
  });
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&$('audioEl')?.paused===false){/* keep playing; browser owns focus */}});
  paint();refreshButtons();
})();