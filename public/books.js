/* VETOGRAM Books — dependency-free, mobile-first Telegram Mini App */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const state = {books:[], page:1, nextPage:null, count:0, query:'', lang:'all', topic:'', loading:false, current:null, pages:[], currentPage:0, request:0, theme:'dark'};
  const STORAGE = 'vetogram-books-v1';
  const readJSON = (key, fallback) => {
    try { const v = JSON.parse(localStorage.getItem(STORAGE + ':' + key)); return v ?? fallback; }
    catch { return fallback; }
  };
  const persist = (key,v) => { try {localStorage.setItem(STORAGE + ':' + key,JSON.stringify(v));}catch{} };
  const saved = readJSON('saved', {});
  const progress = readJSON('progress', {});
  const quotes = readJSON('quotes', []);
  const prefs = Object.assign({font:19,theme:'dark'},readJSON('prefs',{}));
  let abort=null;
  let toastTimer;
  let dbPromise;
  try {
    window.Telegram?.WebApp?.ready();
    window.Telegram?.WebApp?.expand();
    window.Telegram?.WebApp?.setHeaderColor?.('#0a0b0d');
    window.Telegram?.WebApp?.setBackgroundColor?.('#090b10');
  } catch {}

  function toast(s) {
    const el=$('toast');el.textContent=s;el.hidden=false;
    clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.hidden=true,2900);
  }
  function node(tag, cls, label) {
    const n=document.createElement(tag);
    if(cls)n.className=cls;
    if(label!==undefined)n.textContent=label;
    return n;
  }
  function safeCover(url) {
    try {const u=new URL(url);return u.protocol==='https:' && ['www.gutenberg.org','gutenberg.org'].includes(u.hostname)?u.href:'';}
    catch{return '';}
  }
  function updateSavedCount(){ $('savedCount').textContent=Object.keys(saved).length; }
  function compactTitle(title){return String(title||'Без названия').slice(0,160);}
  function fullName(book){return (book.authors||[]).join(', ') || 'Автор неизвестен';}
  function formatCount(n){return Number(n||0).toLocaleString('ru-RU');}
  function refreshTabs() {
    for(const b of document.querySelectorAll('.topics [data-topic]')){
      b.classList.toggle('active',b.dataset.topic===state.topic);
    }
    $('shelfTitle').textContent=state.query ? 'Результаты поиска' : state.topic ? 'По вашему выбору' : 'Популярные книги';
    $('shelfEyebrow').textContent=state.query ? 'SEARCH / RESULTS' : 'DISCOVER / 01';
  }
  function card(book) {
    const article=node('article','book');
    const main=node('button','book-main');
    main.type='button';
    main.setAttribute('aria-label','Читать: '+compactTitle(book.title));
    const cover=node('div','book-cover');
    const imageUrl=safeCover(book.cover);
    if(imageUrl){
      const img=node('img');img.src=imageUrl;img.alt='';img.loading='lazy';img.decoding='async';
      img.onerror=()=>{img.remove();cover.classList.add('placeholder');cover.textContent=compactTitle(book.title);};
      cover.append(img);
    }else{cover.classList.add('placeholder');cover.textContent=compactTitle(book.title);}
    main.append(cover,node('h3','',compactTitle(book.title)),node('p','',fullName(book)));
    const meta=node('div','book-bottom');
    meta.append(node('span','',(book.language||'').toUpperCase()),node('span','',progress[book.id] ? 'Продолжить ↗' : 'Читать ↗'));
    main.append(meta);
    main.addEventListener('click',()=>openBook(book));
    article.append(main);
    const save=node('button','book-saved',saved[book.id]?'♥':'♡');
    save.title=saved[book.id]?'Убрать из библиотеки':'Сохранить в библиотеку';
    save.setAttribute('aria-label',save.title);
    save.addEventListener('click',()=> {
      if(saved[book.id])delete saved[book.id]; else saved[book.id]=book;
      persist('saved',saved);updateSavedCount();
      save.textContent=saved[book.id]?'♥':'♡';
      save.title=saved[book.id]?'Убрать из библиотеки':'Сохранить в библиотеку';
      save.setAttribute('aria-label',save.title);
      toast(saved[book.id]?'Книга добавлена на полку':'Книга убрана с полки');
    });
    article.append(save);
    return article;
  }

  async function loadCatalog(reset=true) {
    if(state.loading && !reset)return;
    if(abort)abort.abort();
    abort=new AbortController();
    const request=++state.request;
    state.loading=true;
    if(reset){state.page=1;state.books=[];$('catalogGrid').replaceChildren();$('catalogStatus').textContent='Загружаем книги…';}
    $('loadMore').hidden=true;
    refreshTabs();
    const params=new URLSearchParams({page:String(state.page),lang:state.lang});
    if(state.query)params.set('q',state.query);
    if(state.topic)params.set('topic',state.topic);
    try {
      const response=await fetch('/api/books?'+params,{signal:abort.signal});
      const data=await response.json();
      if(!response.ok||!data.ok)throw new Error(data.error||'Сервис книг временно недоступен');
      if(request!==state.request)return;
      state.count=data.count;state.nextPage=data.nextPage;state.books.push(...data.books);
      $('catalogCount').textContent=formatCount(data.count);
      const grid=$('catalogGrid');
      data.books.forEach(book=>grid.append(card(book)));
      if(!state.books.length){grid.append(node('div','empty-state','Пока не нашли книг по этому запросу. Попробуйте другое название или язык.'));}
      $('catalogStatus').textContent=state.count ? 'Найдено в каталоге: '+formatCount(state.count) : 'Нет результатов';
      $('loadMore').hidden=!state.nextPage;
    }catch(e){
      if(e.name==='AbortError')return;
      $('catalogStatus').textContent='';
      if(!state.books.length){
        const empty=node('div','empty-state','Не удалось получить каталог. Проверьте интернет и попробуйте снова.');
        const retry=node('button','', 'Повторить');
        retry.type='button';retry.addEventListener('click',()=>loadCatalog(true));
        empty.append(document.createElement('br'),retry);$('catalogGrid').replaceChildren(empty);
      }
      toast(e.message||'Ошибка каталога');
    }finally{
      if(request===state.request)state.loading=false;
    }
  }

  // Store already-opened texts on this device for quick reopen/offline use.
  function database(){
    if(!('indexedDB' in window))return Promise.resolve(null);
    if(!dbPromise) dbPromise=new Promise(resolve=>{
      try{
        const req=indexedDB.open('vetogram-books-cache',1);
        req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('texts'))req.result.createObjectStore('texts',{keyPath:'id'});};
        req.onsuccess=()=>resolve(req.result);req.onerror=()=>resolve(null);req.onblocked=()=>resolve(null);
      }catch{resolve(null);}
    });
    return dbPromise;
  }
  async function cachedText(id) {
    const db=await database();if(!db)return null;
    return new Promise(resolve=>{try{
      const req=db.transaction('texts','readonly').objectStore('texts').get(Number(id));
      req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>resolve(null);
    }catch{resolve(null);}});
  }
  async function cacheText(book,text){
    const db=await database();if(!db)return;
    try{
      const tx=db.transaction('texts','readwrite');
      tx.objectStore('texts').put({id:Number(book.id),book,text,at:Date.now()});
    }catch{}
  }
  function stripGutenbergFrame(value){
    let text=String(value||'').replace(/\r/g,'');
    const start=/\*{3}\s*START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^\n]*\*{3}/i.exec(text);
    const end=/\*{3}\s*END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^\n]*\*{3}/i.exec(text);
    if(start && start.index<12000)text=text.slice(start.index+start[0].length);
    if(end && end.index>100)text=text.slice(0,end.index);
    return text.replace(/\n{4,}/g,'\n\n\n').trim();
  }
  function paginate(value){
    // Logical reading segments, independent from screen size; less DOM/memory than the entire book.
    const paragraphs=value.split(/\n\s*\n/);
    const chunks=[];let current='';
    const flush=()=>{if(current.trim())chunks.push(current.trim());current='';};
    for(let paragraph of paragraphs){
      paragraph=paragraph.trim();
      if(!paragraph)continue;
      if(paragraph.length>9500){
        flush();
        for(let i=0;i<paragraph.length;i+=7600)chunks.push(paragraph.slice(i,i+7600));
        continue;
      }
      if(current.length+paragraph.length>7600 && current)flush();
      current+=(current?'\n\n':'')+paragraph;
    }
    flush();
    return chunks.length?chunks:['Текст недоступен.'];
  }
  function chapterFromPage(text, index){
    const first=text.slice(0,300).split('\n').map(s=>s.trim()).find(s=>
      /^(chapter\s+[ivxlcdm\d]+|глава\s+[ivxlcdm\d]+|part\s+[ivxlcdm\d]+|часть\s+[ivxlcdm\d]+)/i.test(s));
    return first || 'Продолжение истории';
  }
  function applyPrefs(){
    prefs.font=Math.max(14,Math.min(30,Number(prefs.font)||19));
    if(!['dark','light','sepia'].includes(prefs.theme))prefs.theme='dark';
    $('reader').dataset.theme=prefs.theme;
    $('reader').style.setProperty('--reader-size',prefs.font+'px');
    $('fontValue').textContent=prefs.font;
    for(const el of document.querySelectorAll('[data-read-theme]'))el.classList.toggle('active',el.dataset.readTheme===prefs.theme);
    persist('prefs',prefs);
  }
  function showPage(page, scroll=true){
    if(!state.current||!state.pages.length)return;
    state.currentPage=Math.min(Math.max(0,page),state.pages.length-1);
    const currentPageText=state.pages[state.currentPage];
    $('readerCopy').textContent=currentPageText; // Safe: never inject remote text into HTML.
    $('chapterTitle').textContent=chapterFromPage(currentPageText,state.currentPage);
    $('pageNumber').textContent='СТРАНИЦА '+(state.currentPage+1);
    $('readerPageLabel').textContent=(state.currentPage+1)+' / '+state.pages.length;
    $('progressFill').style.width=((state.currentPage+1)/state.pages.length*100)+'%';
    $('prevPage').disabled=state.currentPage===0;
    $('nextPage').disabled=state.currentPage===state.pages.length-1;
    const isMarked=progress[state.current.id]?.bookmarks?.includes(state.currentPage);
    $('bookmarkButton').textContent=isMarked?'♥':'♧';
    progress[state.current.id]={
      ...(progress[state.current.id]||{}),
      page:state.currentPage, at:Date.now(), title:state.current.title,
      authors:state.current.authors, cover:state.current.cover,language:state.current.language
    };
    persist('progress',progress);
    if(scroll)$('readerScroll').scrollTop=0;
  }
  async function openBook(book) {
    if(!book||!Number.isSafeInteger(Number(book.id)))return;
    state.current=book;state.pages=[];
    $('reader').hidden=false;
    $('readerTitle').textContent=compactTitle(book.title);
    $('readerAuthor').textContent=fullName(book);
    $('readerCopy').textContent='Открываем книгу…';
    $('readerPageLabel').textContent='…';
    $('readerSettings').hidden=true;
    $('readerSettingsButton').setAttribute('aria-expanded','false');
    applyPrefs();
    try{
      let data=await cachedText(book.id);
      if(!data?.text){
        const response=await fetch('/api/books?mode=text&id='+encodeURIComponent(book.id));
        const result=await response.json();
        if(!response.ok||!result.ok)throw new Error(result.error||'Не удалось открыть полный текст');
        data={book:result.book,text:result.text};
        await cacheText(result.book,result.text);
      }
      // If the user navigated back while loading, ignore the late response.
      if(!$('reader').hidden && state.current?.id===book.id){
        state.current=data.book||book;
        $('readerTitle').textContent=compactTitle(state.current.title);
        $('readerAuthor').textContent=fullName(state.current);
        state.pages=paginate(stripGutenbergFrame(data.text));
        const resume=progress[book.id]?.page||0;
        showPage(resume);
      }
    }catch(e){
      if(!$('reader').hidden && state.current?.id===book.id){
        $('readerCopy').textContent='Не удалось загрузить полный текст этой книги. Вернитесь в каталог и попробуйте другой экземпляр.';
        $('readerPageLabel').textContent='—';
        toast(e.message||'Сбой источника');
      }
    }
  }
  function closeReader(){
    $('reader').hidden=true;
    state.current=null;state.pages=[];
    $('readerSettings').hidden=true;
    updateSavedCount();
  }
  function flip(dir){if(state.pages.length)showPage(state.currentPage+dir);}
  function bookmark(){
    if(!state.current)return;
    const id=state.current.id;
    const list=[...(progress[id]?.bookmarks||[])];
    const i=list.indexOf(state.currentPage);
    if(i===-1)list.push(state.currentPage);else list.splice(i,1);
    progress[id]={...(progress[id]||{}),bookmarks:list};
    persist('progress',progress);showPage(state.currentPage,false);
    toast(i===-1?'Закладка сохранена':'Закладка удалена');
  }
  function quote(){
    if(!state.current)return;
    const selection=window.getSelection()?.toString().trim().slice(0,800);
    if(!selection||selection.length<4){toast('Сначала выделите фразу в тексте');return;}
    quotes.unshift({bookId:state.current.id,title:state.current.title,page:state.currentPage,quote:selection,at:Date.now()});
    if(quotes.length>80)quotes.length=80;
    persist('quotes',quotes);
    window.getSelection()?.removeAllRanges();
    toast('Цитата сохранена');
  }
  function modal(title){
    $('modalTitle').textContent=title;$('modalContent').replaceChildren();$('bookModal').hidden=false;
    return $('modalContent');
  }
  function modalRow(host,title,subtitle,action,handler){
    const row=node('div','modal-row'),text=node('div');
    text.append(node('strong','',title),node('small','',subtitle));
    const button=node('button','',action);button.type='button';button.addEventListener('click',handler);
    row.append(text,button);host.append(row);
  }
  function library(){
    const host=modal('Моя библиотека');
    const ids=Object.keys(saved);
    const reading=Object.entries(progress).sort((a,b)=>(b[1].at||0)-(a[1].at||0));
    if(!ids.length&&!reading.length)host.append(node('p','empty-state','Здесь появятся сохранённые книги и история чтения.'));
    if(reading.length){
      host.append(node('p','eyebrow','ПРОДОЛЖИТЬ ЧТЕНИЕ'));
      reading.slice(0,12).forEach(([id,p])=>{
        const book=saved[id]||{id:Number(id),title:p.title,authors:p.authors,cover:p.cover,language:p.language};
        modalRow(host,compactTitle(book.title),'Страница '+((p.page||0)+1),'Читать',()=>{$('bookModal').hidden=true;openBook(book);});
      });
    }
    if(ids.length){
      host.append(node('p','eyebrow','СОХРАНЁННЫЕ'));
      ids.slice(0,100).forEach(id=>{
        modalRow(host,compactTitle(saved[id].title),fullName(saved[id]),'Открыть',()=>{$('bookModal').hidden=true;openBook(saved[id]);});
      });
    }
    if(quotes.length){
      host.append(node('p','eyebrow','ЦИТАТЫ'));
      quotes.slice(0,30).forEach(item=>modalRow(host,item.quote,item.title,'Копировать',async()=>{
        try{await navigator.clipboard.writeText(item.quote);toast('Цитата скопирована');}catch{toast('Выделите и скопируйте вручную');}
      }));
    }
  }

  $('searchForm').addEventListener('submit',event=>{
    event.preventDefault();state.query=$('bookSearch').value.trim();loadCatalog(true);
  });
  $('langSelect').addEventListener('change',()=>{
    state.lang=$('langSelect').value;loadCatalog(true);
  });
  for(const button of document.querySelectorAll('.topics button'))button.addEventListener('click',()=>{
    state.topic=button.dataset.topic;loadCatalog(true);
  });
  $('loadMore').addEventListener('click',()=>{if(state.nextPage){state.page=state.nextPage;loadCatalog(false);}});
  $('openSaved').addEventListener('click',library);
  $('myLibrary').addEventListener('click',library);
  $('modalClose').addEventListener('click',()=>$('bookModal').hidden=true);
  $('bookModal').addEventListener('click',event=>{if(event.target===$('bookModal'))$('bookModal').hidden=true;});
  $('readerBack').addEventListener('click',closeReader);
  $('readerSettingsButton').addEventListener('click',()=>{
    $('readerSettings').hidden=!$('readerSettings').hidden;
    $('readerSettingsButton').setAttribute('aria-expanded',String(!$('readerSettings').hidden));
  });
  $('smallerFont').addEventListener('click',()=>{prefs.font-=1;applyPrefs();});
  $('largerFont').addEventListener('click',()=>{prefs.font+=1;applyPrefs();});
  for(const button of document.querySelectorAll('[data-read-theme]'))button.addEventListener('click',()=>{
    prefs.theme=button.dataset.readTheme;applyPrefs();
  });
  $('prevPage').addEventListener('click',()=>flip(-1));
  $('nextPage').addEventListener('click',()=>flip(1));
  $('bookmarkButton').addEventListener('click',bookmark);
  $('saveQuote').addEventListener('click',quote);
  document.addEventListener('keydown',event=>{
    if($('reader').hidden || !$('bookModal').hidden)return;
    if(event.key==='ArrowRight'){event.preventDefault();flip(1);}
    if(event.key==='ArrowLeft'){event.preventDefault();flip(-1);}
    if(event.key==='Escape')closeReader();
  });
  let touchStart=null;
  $('readerScroll').addEventListener('touchstart',e=>{
    if(e.touches.length===1)touchStart={x:e.touches[0].clientX,y:e.touches[0].clientY};
  },{passive:true});
  $('readerScroll').addEventListener('touchend',e=>{
    if(!touchStart||!e.changedTouches.length)return;
    const dx=e.changedTouches[0].clientX-touchStart.x,dy=e.changedTouches[0].clientY-touchStart.y;
    if(Math.abs(dx)>85 && Math.abs(dx)>Math.abs(dy)*2.2)flip(dx<0?1:-1);
    touchStart=null;
  },{passive:true});
  updateSavedCount();applyPrefs();loadCatalog(true);
})();
