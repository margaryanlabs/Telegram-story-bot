/* VETOGRAM Books — dependency-free, mobile-first Telegram Mini App */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const state = {source:'translated',original:'en',cursor:null,nextCursor:null,books:[], page:1, nextPage:null, count:null, query:'', lang:'all', topic:'', loading:false, current:null, pages:[], currentPage:0, request:0, requestBook:0, chapters:[],activeChapter:null,isTranslationIndex:false,theme:'dark'};
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
  const rememberedSource=readJSON('source','translated');
  if(['translated','ru','hy','gutenberg'].includes(rememberedSource))state.source=rememberedSource;
  const rememberedOriginal=readJSON('original','en');
  if(['en','fr','de','it','es'].includes(rememberedOriginal))state.original=rememberedOriginal;
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
  function isWiki(book){return book?.provider==='wikisource' && ['ru','hy'].includes(book.wiki);}
  function bookKey(book){return isWiki(book)?'ws-'+book.wiki+'-'+book.id:String(book?.id||'');}
  function setSourceInfo(){
    const isGutenberg=state.source==='gutenberg';
    const isTranslated=state.source==='translated';
    $('translationFilters').hidden=!isTranslated;
    $('languageFilter').hidden=!isGutenberg;
    document.querySelector('.topics').hidden=!isGutenberg;
    const choices={
      translated:['Зарубежные писатели · русские переводы из Викитеки','Зарубежная классика на русском','https://ru.wikisource.org/wiki/Special:Copyright'],
      ru:['Русская Викитека · классическая литература и исторические тексты','Русская классика','https://ru.wikisource.org/wiki/Special:Copyright'],
      hy:['Հայերեն Վիքիդարան · հայկական գրականություն и тексты на армянском','Հայ գրականություն','https://hy.wikisource.org/wiki/Special:Copyright'],
      gutenberg:['Project Gutenberg · публичный каталог классических произведений','Мировая классика','https://www.gutenberg.org/policy/terms_of_use']
    };
    const item=choices[state.source]||choices.ru;
    $('sourceDescription').textContent=item[0];
    $('sourceLegal').textContent=isGutenberg
      ?'Источник: Project Gutenberg. Статус произведения зависит от законодательства вашей страны и перевода.'
      :isTranslated?'Источник: Русская Викитека. Категории определяют язык оригинала; авторские права на перевод и издание проверяются отдельно.'
      :'Источник: Викитека. Права зависят от произведения, перевода и страны; проверьте условия на странице оригинала.';
    $('sourceLegalLink').href=item[2];
    $('catalogCountLabel').textContent=isGutenberg?'книг в каталоге':isTranslated?'переводных произведений':'результатов в подборке';
    $('bookSearch').placeholder=state.source==='hy'?'Գրքի անուն կամ հեղինակ…'
      :isTranslated?'Название зарубежной книги или автор…':'Название книги или автор…';
    for(const button of document.querySelectorAll('[data-original-lang]')){
      const selected=state.original===button.dataset.originalLang;
      button.classList.toggle('active',selected);
      button.setAttribute('aria-pressed',String(selected));
    }
    const authors=state.source==='ru'
      ? ['Пушкин','Толстой','Чехов','Достоевский','Гоголь']
      :state.source==='hy'
      ? ['Թումանյան','Աբովյան','Րաֆֆի','Աղայան','Չարենց']
      :isTranslated
      ? ({
          en:['Шекспир','Дойль','Диккенс','Уэллс','Лондон'],
          fr:['Дюма','Верн','Гюго','Бальзак','Мопассан'],
          de:['Гёте','Гейне','Гофман','Шиллер','Гримм'],
          it:['Данте','Петрарка','Сальгари','Боккаччо'],
          es:['Сервантес','Кальдерон','Лопе де Вега']
        }[state.original]||[])
      :['Shakespeare','Austen','Dickens','Wells','Twain'];
    const authorHolder=$('authorDiscovery');
    authorHolder.replaceChildren(node('span','',state.source==='hy'?'Հեղինակներ':'Авторы:'));
    for(const name of authors){
      const b=node('button','',name);b.type='button';b.addEventListener('click',()=>{
        state.query=name;$('bookSearch').value=name;loadCatalog(true);
      });authorHolder.append(b);
    }
    for(const b of document.querySelectorAll('[data-books-source]')){
      const active=b.dataset.booksSource===state.source;
      b.classList.toggle('active',active);
      b.setAttribute('aria-pressed',String(active));
    }
  }
  function updateSavedCount(){ $('savedCount').textContent=Object.keys(saved).length; }
  function compactTitle(title){return String(title||'Без названия').slice(0,160);}
  function fullName(book){return (book.authors||[]).join(', ') || (isWiki(book)?(book.wiki==='hy'?'Հայերեն Վիքիդարան':'Русская Викитека'):'Автор неизвестен');}
  function formatCount(n){return Number(n||0).toLocaleString('ru-RU');}
  function refreshTabs() {
    for(const b of document.querySelectorAll('.topics [data-topic]')){
      b.classList.toggle('active',b.dataset.topic===state.topic);
    }
    $('shelfTitle').textContent=state.query?'Результаты поиска':state.source==='translated'?'Зарубежные книги на русском':state.source==='ru'?'Русская классика':state.source==='hy'?'Հայ գրականություն':state.topic?'По вашему выбору':'Популярные книги';
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
    meta.append(node('span','',(book.language||'').toUpperCase()),node('span','',progress[bookKey(book)] ? 'Продолжить ↗' : 'Читать ↗'));
    if(book.isTranslation) {
      const label=node('span','translation-tag','РУССКИЙ ПЕРЕВОД');
      main.append(label);
    }
    main.append(meta);
    main.addEventListener('click',()=>openBook(book));
    article.append(main);
    const save=node('button','book-saved',saved[bookKey(book)]?'♥':'♡');
    save.title=saved[bookKey(book)]?'Убрать из библиотеки':'Сохранить в библиотеку';
    save.setAttribute('aria-label',save.title);
    save.addEventListener('click',()=> {
      if(saved[bookKey(book)])delete saved[bookKey(book)]; else saved[bookKey(book)]=book;
      persist('saved',saved);updateSavedCount();
      save.textContent=saved[bookKey(book)]?'♥':'♡';
      save.title=saved[bookKey(book)]?'Убрать из библиотеки':'Сохранить в библиотеку';
      save.setAttribute('aria-label',save.title);
      toast(saved[bookKey(book)]?'Книга добавлена на полку':'Книга убрана с полки');
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
    if(reset){state.page=1;state.cursor=null;state.nextCursor=null;state.books=[];$('catalogGrid').replaceChildren();$('catalogStatus').textContent='Загружаем книги…';}
    $('loadMore').hidden=true;
    refreshTabs();
    const params=new URLSearchParams({page:String(state.page)});
    if(state.source==='gutenberg')params.set('lang',state.lang);
    else if(state.source==='translated'){
      params.set('collection','translations');
      params.set('original',state.original);
      if(!state.query && state.cursor)params.set('cursor',state.cursor);
    }else params.set('wiki',state.source);
    if(state.query)params.set('q',state.query);
    if(state.topic && state.source==='gutenberg')params.set('topic',state.topic);
    try {
      const endpoint=state.source==='gutenberg'?'/api/books':'/api/books-wikisource';
      const response=await fetch(endpoint+'?'+params,{signal:abort.signal});
      const data=await response.json();
      if(!response.ok||!data.ok)throw new Error(data.error||'Сервис книг временно недоступен');
      if(request!==state.request)return;
      state.count=data.count;state.nextPage=data.nextPage;state.nextCursor=data.nextCursor||null;
      const seen=new Set(state.books.map(bookKey));
      const incoming=data.books.filter(b=>!seen.has(bookKey(b)));
      state.books.push(...incoming);
      $('catalogCount').textContent=Number.isFinite(data.count)?formatCount(data.count):'—';
      const grid=$('catalogGrid');
      incoming.forEach(book=>grid.append(card(book)));
      if(!state.books.length){grid.append(node('div','empty-state','Пока не нашли книг по этому запросу. Попробуйте другое название или язык.'));}
      $('catalogStatus').textContent=Number.isFinite(state.count)
        ? state.count ? 'Найдено: '+formatCount(state.count) : 'Нет результатов'
        : 'Загружено переводов и редакций: '+formatCount(state.books.length);
      $('loadMore').hidden=!(state.nextPage||state.nextCursor);
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
      const req=db.transaction('texts','readonly').objectStore('texts').get(String(id));
      req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>resolve(null);
    }catch{resolve(null);}});
  }
  async function cacheText(key, data){
    const db=await database();if(!db)return;
    try{
      const tx=db.transaction('texts','readwrite');
      tx.objectStore('texts').put({id:String(key),book:data.book,text:data.text,chapters:data.chapters||[],attribution:data.attribution||null,isTranslationIndex:!!data.isTranslationIndex,at:Date.now()});
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
  function bookmarkToken(){return String(state.activeChapter??'root')+':'+state.currentPage;}
  function showPage(page, scroll=true){
    if(!state.current||!state.pages.length)return;
    state.currentPage=Math.min(Math.max(0,page),state.pages.length-1);
    const currentPageText=state.pages[state.currentPage];
    $('readerCopy').textContent=currentPageText;
    const chapterName=state.activeChapter===null?'':state.chapters[state.activeChapter]?.label;
    $('chapterTitle').textContent=chapterName || chapterFromPage(currentPageText,state.currentPage);
    $('pageNumber').textContent='СТРАНИЦА '+(state.currentPage+1);
    $('readerPageLabel').textContent=(state.currentPage+1)+' / '+state.pages.length;
    $('progressFill').style.width=((state.currentPage+1)/state.pages.length*100)+'%';
    $('prevPage').disabled=state.currentPage===0 && (state.activeChapter===null || !isWiki(state.current));
    $('nextPage').disabled=state.currentPage===state.pages.length-1 && (!isWiki(state.current) || !state.chapters.length || state.activeChapter===state.chapters.length-1);
    const key=bookKey(state.current);
    const mark=bookmarkToken();
    const isMarked=progress[key]?.bookmarks?.includes(mark);
    $('bookmarkButton').textContent=isMarked?'♥':'♧';
    progress[key]={
      ...(progress[key]||{}),id:state.current.id,provider:state.current.provider||'gutenberg',
      wiki:state.current.wiki||null,chapter:state.activeChapter,page:state.currentPage,
      at:Date.now(),title:state.current.title,authors:state.current.authors,
      cover:state.current.cover,language:state.current.language,sourceUrl:state.current.sourceUrl
    };
    persist('progress',progress);
    if(scroll)$('readerScroll').scrollTop=0;
  }
  function renderChapters(){
    const wrap=$('readerChapters'),select=$('chapterSelect');
    wrap.hidden=!state.chapters.length || !isWiki(state.current);
    const label=$('readerChapters').querySelector('label');
    if(label)label.textContent=state.isTranslationIndex?'Перевод / издание':'Содержание';
    select.replaceChildren(new Option(state.isTranslationIndex?'Выберите перевод…':'Начало книги',''));
    for(let i=0;i<state.chapters.length;i++){
      select.add(new Option(state.chapters[i].label.slice(0,110),String(i)));
    }
    select.value=state.activeChapter===null?'':String(state.activeChapter);
  }
  async function loadChapter(book,chapter=null,resume=false){
    const key=bookKey(book);
    const request=++state.requestBook;
    state.pages=[];state.activeChapter=chapter;state.isTranslationIndex=false;
    $('readerCopy').textContent='Загружаем текст…';
    $('readerPageLabel').textContent='…';
    const cacheId=key+':'+(chapter===null?'root':chapter);
    try{
      let data=await cachedText(cacheId);
      if(!data?.text){
        const params=new URLSearchParams({mode:'text',id:String(book.id)});
        if(isWiki(book))params.set('wiki',book.wiki);
        if(chapter!==null && isWiki(book))params.set('chapter',String(chapter));
        const endpoint=isWiki(book)?'/api/books-wikisource':'/api/books';
        const response=await fetch(endpoint+'?'+params);
        const result=await response.json();
        if(!response.ok || !result.ok)throw new Error(result.error||'Не удалось открыть полный текст');
        data={book:result.book,text:result.text,chapters:result.chapters||[],attribution:result.attribution||null,isTranslationIndex:result.isTranslationIndex||false};
        await cacheText(cacheId,data);
      }
      if($('reader').hidden || state.requestBook!==request || bookKey(state.current)!==key)return;
      state.current={...book,...(data.book||{})};
      state.chapters=data.chapters||[];
      state.isTranslationIndex=!!data.isTranslationIndex;
      state.activeChapter=chapter;
      $('readerTitle').textContent=compactTitle(state.current.title);
      $('readerAuthor').textContent=fullName(state.current);
      $('readerSourceLink').href=data.attribution?.source||state.current.sourceUrl||'https://www.gutenberg.org/';
      renderChapters();
      if(state.isTranslationIndex && chapter===null && state.chapters.length) {
        $('readerSettings').hidden=false;
        $('readerSettingsButton').setAttribute('aria-expanded','true');
      }
      const text=isWiki(book)?data.text:stripGutenbergFrame(data.text);
      state.pages=paginate(text);
      const p=progress[key];
      showPage(resume && p?.chapter===chapter ? Number(p.page)||0 : 0);
    }catch(e){
      if(!$('reader').hidden && state.requestBook===request){
        $('readerCopy').textContent='Не удалось открыть текст. Вернитесь к книгам и попробуйте другой результат.';
        $('readerPageLabel').textContent='—';
        toast(e.message||'Сервис чтения недоступен');
      }
    }
  }
  async function openBook(book){
    if(!book||!Number.isSafeInteger(Number(book.id))||Number(book.id)<1)return;
    ++state.requestBook;
    state.current=book;state.pages=[];state.chapters=[];state.activeChapter=null;
    $('reader').hidden=false;
    $('readerTitle').textContent=compactTitle(book.title);
    $('readerAuthor').textContent=fullName(book);
    $('readerSettings').hidden=true;
    $('readerSettingsButton').setAttribute('aria-expanded','false');
    $('readerSourceLink').href=book.sourceUrl||'https://www.gutenberg.org/';
    $('readerChapters').hidden=true;
    applyPrefs();
    const old=progress[bookKey(book)];
    const chapter=isWiki(book)&&Number.isInteger(old?.chapter)&&old.chapter>=0?old.chapter:null;
    await loadChapter(book,chapter,true);
  }
  function closeReader(){
    ++state.requestBook;
    $('reader').hidden=true;state.current=null;state.pages=[];state.chapters=[];
    state.activeChapter=null;
    $('readerSettings').hidden=true;
    updateSavedCount();
  }
  function flip(dir){
    if(!state.pages.length || !state.current)return;
    const target=state.currentPage+dir;
    if(target>=0 && target<state.pages.length){showPage(target);return;}
    if(!isWiki(state.current) || !state.chapters.length)return;
    if(dir>0 && state.activeChapter===null){void loadChapter(state.current,0);return;}
    if(dir>0 && state.activeChapter<state.chapters.length-1){void loadChapter(state.current,state.activeChapter+1);return;}
    if(dir<0 && state.activeChapter!==null){void loadChapter(state.current,state.activeChapter===0?null:state.activeChapter-1);return;}
  }
  function bookmark(){
    if(!state.current)return;
    const id=bookKey(state.current);
    const list=[...(progress[id]?.bookmarks||[])];
    const token=bookmarkToken();
    const i=list.indexOf(token);
    if(i===-1)list.push(token);else list.splice(i,1);
    progress[id]={...(progress[id]||{}),bookmarks:list};
    persist('progress',progress);showPage(state.currentPage,false);
    toast(i===-1?'Закладка сохранена':'Закладка удалена');
  }
  function quote(){
    if(!state.current)return;
    const selection=window.getSelection()?.toString().trim().slice(0,800);
    if(!selection||selection.length<4){toast('Сначала выделите фразу в тексте');return;}
    quotes.unshift({bookId:bookKey(state.current),title:state.current.title,page:state.currentPage,chapter:state.activeChapter,quote:selection,at:Date.now()});
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
        const book=saved[id]||{id:Number(p.id||id.split('-').at(-1)),provider:p.provider,wiki:p.wiki,title:p.title,authors:p.authors,cover:p.cover,language:p.language,sourceUrl:p.sourceUrl};
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

  for(const button of document.querySelectorAll('[data-original-lang]'))button.addEventListener('click',()=>{
    if(state.original===button.dataset.originalLang)return;
    state.original=button.dataset.originalLang;
    persist('original',state.original);
    state.query='';
    $('bookSearch').value='';
    setSourceInfo();
    loadCatalog(true);
  });
  for(const button of document.querySelectorAll('[data-books-source]'))button.addEventListener('click',()=>{
    if(state.source===button.dataset.booksSource)return;
    state.source=button.dataset.booksSource;
    persist('source',state.source);
    state.query='';state.topic='';state.page=1;
    $('bookSearch').value='';
    setSourceInfo();loadCatalog(true);
  });
  $('chapterSelect').addEventListener('change',()=>{
    if(!state.current)return;
    const value=$('chapterSelect').value;
    void loadChapter(state.current,value===''?null:Number(value));
  });
  $('searchForm').addEventListener('submit',event=>{
    event.preventDefault();state.query=$('bookSearch').value.trim();loadCatalog(true);
  });
  $('langSelect').addEventListener('change',()=>{
    state.lang=$('langSelect').value;loadCatalog(true);
  });
  for(const button of document.querySelectorAll('.topics button'))button.addEventListener('click',()=>{
    state.topic=button.dataset.topic;loadCatalog(true);
  });
  $('loadMore').addEventListener('click',()=>{
    if(state.nextPage){state.page=state.nextPage;state.cursor=null;loadCatalog(false);}
    else if(state.nextCursor){state.page+=1;state.cursor=state.nextCursor;loadCatalog(false);}
  });
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
  updateSavedCount();applyPrefs();setSourceInfo();loadCatalog(true);
})();
