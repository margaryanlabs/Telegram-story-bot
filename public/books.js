/* VETOGRAM Books — dependency-free, mobile-first Telegram Mini App */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const state = {source:'complete',original:'en',spotlight:'now',readingGenre:'novels',cursor:null,nextCursor:null,books:[], page:1, nextPage:null, count:null, query:'', lang:'all', topic:'', loading:false, current:null, pages:[], currentPage:0, request:0, requestBook:0, chapters:[],activeChapter:null,isTranslationIndex:false,theme:'dark',rawText:'',pageOffsets:[],focus:false,flow:false,flowIndex:0,flowParagraphs:[],audioToken:0,audioActive:false};
  const STORAGE = 'vetogram-books-v1';
  const readJSON = (key, fallback) => {
    try { const v = JSON.parse(localStorage.getItem(STORAGE + ':' + key)); return v ?? fallback; }
    catch { return fallback; }
  };
  const persist = (key,v) => { try {localStorage.setItem(STORAGE + ':' + key,JSON.stringify(v));}catch{} };
  const saved = readJSON('saved', {});
  const progress = readJSON('progress', {});
  const quotes = readJSON('quotes', []);
  const readingNotes = readJSON('readingNotes', []);
  const prefs = Object.assign({font:19,theme:'dark',fontFace:'literary',leading:'comfortable',width:'normal',speed:1},readJSON('prefs',{}));
  const rememberedSource=readJSON('source','complete');
  if(['complete','translated','ru','hy','gutenberg','spotlight','genres','local'].includes(rememberedSource))state.source=rememberedSource;
  const rememberedSpotlight=readJSON('spotlight','now');
  if(['now','new','fantasy','detective','romance','nonfiction','business','youth','classics'].includes(rememberedSpotlight))state.spotlight=rememberedSpotlight;
  const rememberedGenre=readJSON('readingGenre','novels');
  if(['novels','stories','novellas','fantasy','poems','folktales'].includes(rememberedGenre))state.readingGenre=rememberedGenre;
  const rememberedOriginal=readJSON('original','en');
  if(['en','fr','de','it','es'].includes(rememberedOriginal))state.original=rememberedOriginal;
  let abort=null;
  let googleViewerPromise=null;
  let offlineEditionToken=0;
  let offlineSavedBook=null;
  const pendingChapterPrefetch=new Map();
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
    try{
      const u=new URL(url);
      return u.protocol==='https:' && ['www.gutenberg.org','gutenberg.org','books.google.com','books.google.ru','books.googleusercontent.com','www.googleapis.com','covers.openlibrary.org'].includes(u.hostname)?u.href:'';
    }catch{return '';}
  }
  function safeBookLink(url){
    try{
      const u=new URL(url);
      return u.protocol==='https:'&&['books.google.com','books.google.ru','play.google.com','books.googleusercontent.com','openlibrary.org'].includes(u.hostname)?u.href:'';
    }catch{return '';}
  }
  function isWiki(book){return book?.provider==='wikisource' && ['ru','hy'].includes(book.wiki);}
  function isLocal(book){return book?.provider==='local' && Number.isSafeInteger(Number(book.id));}
  function isCatalogBook(book){return ['googlebooks','openlibrary'].includes(book?.provider);}
  function bookKey(book){return isLocal(book)?'local-'+book.id:book?.provider==='googlebooks'?'gb-'+String(book.id):book?.provider==='openlibrary'?'ol-'+String(book.id):isWiki(book)?'ws-'+book.wiki+'-'+book.id:String(book?.id||'');}
  // Curated, real whole-page editions from Russian Wikisource, independently
  // sampled on 27 October 2026. Exact edition licenses remain source-specific.
  const verifiedWholeEditions=[[1007153,"Красное и чёрное","Стендаль",969917],[1012811,"Золотой вулкан","Жюль Верн",614475],[1002630,"Кавалер Красного замка","Александр Дюма",684771],[1002606,"Дама с камелиями","Александр Дюма-сын",316340],[1043860,"Авантюристы","Гюстав Эмар",506690],[1006903,"Жизнь","Ги де Мопассан",410352],[17623,"Белые ночи","Фёдор Достоевский",104437],[1028921,"Алтарь победы","Валерий Брюсов",860994],[1002632,"Тысяча и один призрак","Александр Дюма",265199],[1002620,"Графиня Салисбюри","Александр Дюма",472980],[1002619,"Капитан Поль","Александр Дюма",234915],[1016200,"Авиатор Тихого океана","Эмиль Дриан",526205],[1004780,"Из Парижа в Бразилию","Луи Буссенар",549463],[1004212,"Украденное ожерелье","Фортюне дю Буагобей",435780],[1007015,"Полудевы","Марсель Прево",381579],[1009370,"Агония","Ломбар",639318],[1026179,"Алчущие","Александр Шеллер-Михайлов",711791],[1002637,"Путешествие Дюма по Северной Африке","Александр Дюма",187069]];
  const completeEditionBooks=verifiedWholeEditions.map(([id,title,author,verifiedChars])=>({
    id,title,authors:[author],language:'ru',wiki:'ru',provider:'wikisource',
    source:'Русская Викитека · цельный текст',
    sourceUrl:'https://ru.wikisource.org/w/index.php?curid='+id,
    cover:'',readable:true,curatedWholeText:true,verifiedChars,
    summary:'Большой цельный текст издания, прочитанный из первоисточника.',
    rightsNotice:'Условия использования конкретного издания и перевода смотрите в оригинале.'
  }));
  function filterCompleteEditionBooks(query){
    const value=String(query||'').trim().toLocaleLowerCase('ru');
    return value?completeEditionBooks.filter(b=>
      (b.title+' '+b.authors.join(' ')).toLocaleLowerCase('ru').includes(value)
    ):completeEditionBooks;
  }
  function setSourceInfo(){
    document.body.dataset.booksSource=state.source;
    const isGutenberg=state.source==='gutenberg';
    const isComplete=state.source==='complete';
    const isTranslated=state.source==='translated';
    const isSpotlight=state.source==='spotlight';
    const isPrivate=state.source==='local';
    const isGenres=state.source==='genres';
    $('readingGenres').hidden=!isGenres;
    $('importBanner').hidden=!isPrivate;
    $('catalogSearch').hidden=isPrivate;
    $('spotlightFilters').hidden=!isSpotlight;
    $('translationFilters').hidden=!isTranslated;
    $('languageFilter').hidden=!isGutenberg;
    document.querySelector('.topics').hidden=!isGutenberg;
    const choices={
      complete:['18 проверенных объёмных изданий · цельный текст доступен в читалке','КНИГИ ЦЕЛИКОМ','https://ru.wikisource.org/wiki/Special:Copyright'],
      genres:['Романы, рассказы, повести, фантастика, стихи и сказки на русском','Читать сейчас','https://ru.wikisource.org/wiki/Special:Copyright'],
      local:['Моя личная библиотека · EPUB, FB2 и TXT без загрузки на сервер','Личные книги',''],
      spotlight:['Русскоязычные издания · современные книги и официальные страницы','Новые книги на русском','https://books.google.com/'],
      translated:['Зарубежные писатели · русские переводы из Викитеки','Зарубежная классика на русском','https://ru.wikisource.org/wiki/Special:Copyright'],
      ru:['Русская Викитека · классическая литература и исторические тексты','Русская классика','https://ru.wikisource.org/wiki/Special:Copyright'],
      hy:['Հայերեն Վիքիդարան · հայկական գրականություն и тексты на армянском','Հայ գրականություն','https://hy.wikisource.org/wiki/Special:Copyright'],
      gutenberg:['Project Gutenberg · публичный каталог классических произведений','Мировая классика','https://www.gutenberg.org/policy/terms_of_use']
    };
    const item=choices[state.source]||choices.ru;
    $('sourceDescription').textContent=item[0];
    $('sourceLegal').textContent=isComplete?'Объёмные тексты Русской Викитеки, проверенные по первоисточнику. Права на переводы могут различаться по странам.'
      :isPrivate?'Личные книги находятся только в памяти этого устройства. Добавляйте файлы, которыми имеете право пользоваться.'
      :isGutenberg?'Источник: Project Gutenberg. Статус произведения зависит от законодательства вашей страны и перевода.'
      :isSpotlight?'Новые книги: справочные каталоги Google Books и Open Library. Официальные страницы, без обещания бесплатных полных текстов.'
      :isTranslated?'Источник: Русская Викитека. Категории определяют язык оригинала; авторские права на перевод и издание проверяются отдельно.'
      :'Источник: Викитека. Права зависят от произведения, перевода и страны; проверьте условия на странице оригинала.';
    $('sourceLegalLink').hidden=isPrivate;
    if(!isPrivate)$('sourceLegalLink').href=item[2];
    $('catalogCountLabel').textContent=isComplete?'цельных изданий в подборке':isGenres?'произведений в выборке':isPrivate?'личных книг на этом устройстве':isSpotlight?'русскоязычных изданий в результате':isGutenberg?'книг в каталоге':isTranslated?'переводных произведений':'результатов в подборке';
    $('bookSearch').placeholder=state.source==='hy'?'Գրքի անուն կամ հեղինակ…'
      :isSpotlight?'Найти современную книгу на русском…':isTranslated?'Название зарубежной книги или автор…':'Название книги или автор…';
    for(const button of document.querySelectorAll('[data-original-lang]')){
      const selected=state.original===button.dataset.originalLang;
      button.classList.toggle('active',selected);
      button.setAttribute('aria-pressed',String(selected));
    }
    for(const button of document.querySelectorAll('[data-spotlight]')){
      const selected=state.spotlight===button.dataset.spotlight;
      button.classList.toggle('active',selected);
      button.setAttribute('aria-pressed',String(selected));
    }
    for(const button of document.querySelectorAll('[data-reading-genre]')){
      const selected=state.readingGenre===button.dataset.readingGenre;
      button.classList.toggle('active',selected);
      button.setAttribute('aria-pressed',String(selected));
    }
    const authors=state.source==='ru'
      ? ['Пушкин','Толстой','Чехов','Достоевский','Гоголь']
      :state.source==='hy'
      ? ['Թումանյան','Աբովյան','Րաֆֆի','Աղայան','Չարենց']
      :isPrivate?[]:isGenres?['Достоевский','Толстой','Чехов','Грин','Беляев']:isSpotlight?['Дюна','Атомные привычки','Четвёртое крыло','Гарри Поттер','1984','Психология денег']
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
    authorHolder.hidden=isPrivate;
    authorHolder.replaceChildren(node('span','',state.source==='hy'?'Հեղինակներ':isSpotlight?'Искать книги:':'Авторы:'));
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
  function bookFromProgress(key,item){
    const id=Number(item.id||String(key).split('-').at(-1));
    if(!Number.isSafeInteger(id)||id<1)return null;
    return saved[key]||{
      id,provider:item.provider,wiki:item.wiki,title:item.title,
      authors:item.authors,cover:item.cover,language:item.language,
      sourceUrl:item.sourceUrl
    };
  }
  function renderContinueShelf(){
    const shelf=$('continueShelf');
    const latest=Object.entries(progress)
      .filter(([key,item])=>item && item.title && Number.isFinite(Number(item.at)))
      .sort((a,b)=>(b[1].at||0)-(a[1].at||0))[0];
    if(!latest){shelf.hidden=true;return;}
    const [key,p]=latest;
    const book=bookFromProgress(key,p);
    if(!book){shelf.hidden=true;return;}
    shelf.hidden=false;
    $('continueTitle').textContent=compactTitle(book.title);
    const name=(book.authors||[]).join(', ');
    const position=p.chapter!==null && Number.isInteger(p.chapter)
      ?'Часть '+(p.chapter+1)+' · '+(Math.max(0,Number(p.page)||0)+1)+' стр.'
      :'Страница '+(Math.max(0,Number(p.page)||0)+1);
    $('continueDetails').textContent=(name?name+' · ':'')+position;
    $('continueFill').style.width=Math.round(Math.max(0,Math.min(1,Number(p.fraction)||0))*100)+'%';
    $('continueAction').onclick=()=>openBook(book);
  }
  function setFocus(enabled){
    const value=Boolean(enabled);
    state.focus=value;
    $('reader').dataset.focus=String(value);
    $('readerFocusButton').setAttribute('aria-pressed',String(value));
    $('readerFocusButton').title=value?'Вернуть управление':'Режим погружения';
    $('readerFocusExit').hidden=!value;
    if(value){
      $('readerSettings').hidden=true;
      $('readerSettingsButton').setAttribute('aria-expanded','false');
    }
    reflowReader();
  }
  // Procedural jacket art: every work gets a stable cover with no external
  // image generator, no stock asset, no layout shift, and no made-up reviews.
  function coverArtwork(host,book){
    host.replaceChildren();
    host.classList.add('placeholder','artwork-cover');
    const name=compactTitle(book.title);
    let checksum=0;
    for(const letter of name)checksum=(checksum*31+letter.codePointAt(0))%1000003;
    host.dataset.coverStyle=String(checksum%6);
    host.append(
      node('span','artwork-imprint','VETOGRAM · BOOKS'),
      node('span','artwork-symbol',['✦','◌','◇','✧','⌁','⋆'][checksum%6]),
      node('strong','artwork-title',name),
      node('span','artwork-author',fullName(book)),
      node('span','artwork-bottom','LIBRARY EDITION · '+(book.language||'RU').toUpperCase())
    );
  }
  function updateSavedCount(){ $('savedCount').textContent=Object.keys(saved).length; }
  function compactTitle(title){return String(title||'Без названия').slice(0,160);}
  function fullName(book){return (book.authors||[]).join(', ') || (isWiki(book)?(book.wiki==='hy'?'Հայերեն Վիքիդարան':'Русская Викитека'):'Автор неизвестен');}
  function formatCount(n){return Number(n||0).toLocaleString('ru-RU');}
  function refreshTabs() {
    for(const b of document.querySelectorAll('.topics [data-topic]')){
      b.classList.toggle('active',b.dataset.topic===state.topic);
    }
    $('shelfTitle').textContent=state.query?'Результаты поиска':state.source==='complete'?'Книги, которые читаются целиком':state.source==='local'?'Мои книги на устройстве':state.source==='genres'?'Книги для чтения':state.source==='spotlight'?'Новинки и книги на слуху':state.source==='translated'?'Зарубежные книги на русском':state.source==='ru'?'Русская классика':state.source==='hy'?'Հայ գրականություն':state.topic?'По вашему выбору':'Популярные книги';
    $('shelfEyebrow').textContent=state.query ? 'SEARCH / RESULTS' : 'DISCOVER / 01';
  }
  function bookExtent(book){
    if(isCatalogBook(book))return {kind:'metadata',label:'КАРТОЧКА · НЕТ ТЕКСТА'};
    if(isLocal(book))return {kind:'local',label:'ЛИЧНЫЙ ФАЙЛ · '+(book.format||'ТЕКСТ').toUpperCase()};
    if(book?.curatedWholeText)return {kind:'full',label:'ЦЕЛЬНЫЙ ТЕКСТ · '+Math.round(book.verifiedChars/1000)+' ТЫС. ЗНАКОВ'};
    if(isWiki(book))return {kind:'partial',label:book.isTranslation?'ПЕРЕВОД · ПРОВЕРИТЬ ОБЪЁМ':'ТЕКСТ / ЧАСТИ · ПРОВЕРИТЬ'};
    if(book?.readable && book?.source==='Project Gutenberg')return {kind:'full',label:'ПОЛНЫЙ ТЕКСТ ИСТОЧНИКА'};
    return {kind:'metadata',label:'ОБЪЁМ НЕ ПОДТВЕРЖДЁН'};
  }
  function officialWikisourceEpubUrl(book){
    if(!isWiki(book)||typeof book.title!=='string'||book.title.length>230)return '';
    const params=new URLSearchParams({
      format:'epub',lang:book.wiki,page:book.title.replace(/ /g,'_')
    });
    return 'https://ws-export.wmcloud.org/?'+params.toString();
  }
  function updateWholeEditionControls(book){
    const container=$('readerDownloadBar');
    const eligible=isWiki(book)&&!state.isTranslationIndex;
    container.hidden=!eligible;
    if(!eligible)return;
    const count=state.chapters.length;
    const button=$('readerSaveAllChapters');
    button.hidden=count>160;
    button.disabled=false;
    if(offlineSavedBook?.sourceWikiId===book.id&&offlineSavedBook?.sourceWiki===book.wiki){
      button.textContent='ЧИТАТЬ ОФЛАЙН ↗';
    }else{
      button.textContent=count?'СОХРАНИТЬ '+count+' ГЛАВ ↧':'СОХРАНИТЬ ТЕКСТ ↧';
    }
    $('readerDownloadHint').textContent=count
      ?'Загрузим '+count+' доступных частей подряд. Если глава не найдена, не создадим неполную копию.'
      :'Сохраним весь загруженный текст на устройстве.';
    const link=$('readerOfficialEpub');
    const url=officialWikisourceEpubUrl(book);
    link.hidden=!url;
    if(url)link.href=url;
  }
  /** Full-work offline pack. User-triggered, per-chapter, bounded, fail closed.
   * Does not conflate alternative translations with successive chapters.
   */
  async function saveWholeEditionOffline(){
    const book=state.current;
    if(!isWiki(book)||state.isTranslationIndex)return;
    if(offlineSavedBook?.sourceWikiId===book.id&&offlineSavedBook?.sourceWiki===book.wiki){
      const local=offlineSavedBook;
      await openBook(local);
      return;
    }
    const importer=window.VetogramBooksImport;
    if(!importer?.saveWikisourceEdition){toast('Офлайн-хранилище недоступно');return;}
    const chapters=state.chapters.length
      ?state.chapters.map(x=>({title:x.title,label:x.label}))
      :[{title:book.title,label:'Весь текст'}];
    if(chapters.length>160){toast('Для этого издания используйте официальный EPUB');return;}
    const token=++offlineEditionToken;
    const button=$('readerSaveAllChapters');
    button.disabled=true;
    const sourceId=book.id,wiki=book.wiki;
    const texts=[];
    try{
      for(let i=0;i<chapters.length;i++){
        if(token!==offlineEditionToken||$('reader').hidden)throw new Error('Сборка отменена');
        button.textContent='ГЛАВА '+(i+1)+' / '+chapters.length;
        $('readerDownloadHint').textContent='Собираем книгу: '+Math.round(i/chapters.length*100)+'% · не закрывайте читалку';
        if(!state.chapters.length){
          if(!state.rawText?.trim())throw new Error('Текст книги не загружен');
          texts.push(state.rawText);
          break;
        }
        const key=bookKey(book)+':'+i;
        const cached=await cachedText(key);
        let value=cached?.text;
        if(!value){
          const query=new URLSearchParams({mode:'text',wiki,id:String(sourceId),chapter:String(i)});
          const response=await fetch('/api/books-wikisource?'+query);
          const payload=await response.json();
          if(!response.ok||!payload.ok||!payload.text)throw new Error('Глава '+(i+1)+' недоступна. Офлайн-сборка не создана.');
          value=payload.text;
          await cacheText(key,{book:payload.book,text:value,chapters:payload.chapters||[],attribution:payload.attribution||null,isTranslationIndex:false,coverage:payload.coverage||null});
        }
        if(value.length<60)throw new Error('Глава '+(i+1)+' слишком короткая; сборка остановлена');
        texts.push(value);
      }
      if(token!==offlineEditionToken||$('reader').hidden)throw new Error('Сборка отменена');
      const local=await importer.saveWikisourceEdition(book,chapters,texts);
      local.sourceWikiId=book.id;
      local.sourceWiki=book.wiki;
      offlineSavedBook=local;
      saved[bookKey(local)]=local;
      persist('saved',saved);updateSavedCount();
      $('readerDownloadHint').textContent='Сохранено '+chapters.length+' доступных частей. Нажмите, чтобы открыть одну офлайн-книгу.';
      button.textContent='ЧИТАТЬ ОФЛАЙН ↗';
      toast('Книга сохранена на устройстве — все доступные части');
    }catch(error){
      $('readerDownloadHint').textContent=error?.message||'Не удалось загрузить книгу';
      button.textContent='ПОПРОБОВАТЬ СНОВА';
      toast(error?.message||'Офлайн-сборка не завершена');
    }finally{button.disabled=false;}
  }
  function setVolumeStatus(book,coverage){
    const status=$('readerVolumeStatus');
    if(!status)return;
    const local=isLocal(book),wik=isWiki(book);
    let message='',kind='unverified';
    if(local){
      message='Личный файл · загружены все поддерживаемые главы';
      kind='complete';
    }else if(wik){
      if(book.curatedWholeText){
        message='Цельный текст издания · '+Math.round(book.verifiedChars/1000)+' тыс. символов в источнике';
        kind='complete';
      }
      const count=state.chapters.length;
      const limited=coverage?.limited;
      if(book.curatedWholeText){}
      else if(coverage?.kind==='editions'){
        message='Варианты переводов: '+count+' · выберите одно издание';
        kind='index';
      }else if(count){
        message='Части произведения: '+count+(limited?' · каталог ограничен':' · полнота не подтверждена');
      }else{
        message='Текст отдельной страницы · полнота книги не подтверждена';
      }
    }else if(book?.source==='Project Gutenberg'){
      message='Полный текст доступного издания Project Gutenberg';
      kind='complete';
    }else message='Объём текста источника не подтверждён';
    status.textContent=message;status.dataset.kind=kind;
    const toc=$('readerTocButton');
    toc.hidden=!state.chapters.length||(!wik&&!local);
    $('readerChapterCount').textContent=state.chapters.length+' частей';
    updateWholeEditionControls(book);
  }
  function card(book) {
    const article=node('article','book');
    const main=node('button','book-main');
    main.type='button';
    main.setAttribute('aria-label',(isCatalogBook(book)?'Подробнее: ':'Читать: ')+compactTitle(book.title));
    const cover=node('div','book-cover');
    const imageUrl=safeCover(book.cover);
    if(imageUrl){
      const img=node('img');img.src=imageUrl;img.alt='';img.loading='lazy';img.decoding='async';
      img.onerror=()=>coverArtwork(cover,book);
      cover.append(img);
    }else{coverArtwork(cover,book);}
    main.append(cover,node('h3','',compactTitle(book.title)),node('p','',fullName(book)));
    const meta=node('div','book-bottom');
    meta.append(node('span','',(book.language||'').toUpperCase()),
      node('span','',isCatalogBook(book)?(book.previewUrl?'Превью ↗':'О книге ↗'):progress[bookKey(book)]?'Продолжить ↗':'Читать ↗'));
    if(book.provider==='openlibrary')main.append(node('span','translation-tag','КАТАЛОГ · RU'));
    if(book.isTranslation) {
      const label=node('span','translation-tag','РУССКИЙ ПЕРЕВОД');
      main.append(label);
    }
    if(isLocal(book))main.append(node('span','translation-tag','НА ЭТОМ УСТРОЙСТВЕ'));
    main.append(meta);
    const extent=bookExtent(book);
    const badge=node('span','book-extent-badge',extent.label);
    badge.dataset.kind=extent.kind;
    main.append(badge);
    main.addEventListener('click',()=>isCatalogBook(book)?showDiscoverBook(book):openBook(book));
    article.append(main);
    const save=node('button','book-saved',isLocal(book)?'×':saved[bookKey(book)]?'♥':'♡');
    save.title=isLocal(book)?'Удалить эту личную книгу':saved[bookKey(book)]?'Убрать из библиотеки':'Сохранить в библиотеку';
    save.setAttribute('aria-label',save.title);
    save.addEventListener('click',async()=> {
      if(isLocal(book)){
        if(!window.confirm('Удалить локальную книгу «'+compactTitle(book.title)+'» и её прогресс с этого устройства?'))return;
        try{
          await window.VetogramBooksImport.remove(book.id);
          const identity=bookKey(book);
          delete saved[identity];delete progress[identity];
          for(let i=quotes.length-1;i>=0;i--)if(quotes[i].bookId===identity)quotes.splice(i,1);
          for(let i=readingNotes.length-1;i>=0;i--)if(readingNotes[i].bookId===identity)readingNotes.splice(i,1);
          persist('saved',saved);persist('progress',progress);
          persist('quotes',quotes);persist('readingNotes',readingNotes);
          updateSavedCount();
          if(state.source==='local')await loadCatalog(true);
          renderContinueShelf();toast('Книга удалена с устройства');
        }catch(error){toast(error.message||'Не удалось удалить книгу');}
        return;
      }
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

  function showCatalogSkeleton(){
    const grid=$('catalogGrid');
    grid.replaceChildren();
    for(let i=0;i<8;i++){
      const article=node('article','book book-skeleton');
      article.setAttribute('aria-hidden','true');
      const image=node('div','skeleton-cover');
      const line=node('div','skeleton-text');
      const small=node('div','skeleton-text skeleton-small');
      article.append(image,line,small);
      grid.append(article);
    }
  }
  async function loadCatalog(reset=true) {
    if(state.loading && !reset)return;
    if(abort)abort.abort();
    abort=new AbortController();
    const request=++state.request;
    state.loading=true;
    if(reset){state.page=1;state.cursor=null;state.nextCursor=null;state.books=[];showCatalogSkeleton();$('catalogStatus').textContent='Загружаем книги…';}
    $('loadMore').hidden=true;
    refreshTabs();
    const params=new URLSearchParams({page:String(state.page)});
    if(state.source==='gutenberg')params.set('lang',state.lang);
    else if(state.source==='spotlight')params.set('collection',state.spotlight);
    else if(state.source==='genres'){
      params.set('collection','genres');params.set('genre',state.readingGenre);
      if(!state.query && state.cursor)params.set('cursor',state.cursor);
    }
    else if(state.source==='translated'){
      params.set('collection','translations');
      params.set('original',state.original);
      if(!state.query && state.cursor)params.set('cursor',state.cursor);
    }else params.set('wiki',state.source);
    if(state.query)params.set('q',state.query);
    if(state.topic && state.source==='gutenberg')params.set('topic',state.topic);
    try {
      let data;
      if(state.source==='complete'){
        const books=filterCompleteEditionBooks(state.query);
        data={ok:true,books,count:books.length,nextPage:null,nextCursor:null};
      }else if(state.source==='local'){
        const importer=window.VetogramBooksImport;
        if(!importer)throw new Error('Не загружен локальный импортёр книг');
        const works=(await importer.list()).sort((a,b)=>b.id-a.id);
        data={ok:true,books:works,count:works.length,nextPage:null,nextCursor:null};
      }else{
        const endpoint=state.source==='gutenberg'?'/api/books':state.source==='spotlight'?'/api/books-discover':'/api/books-wikisource';
        const response=await fetch(endpoint+'?'+params,{signal:abort.signal});
        data=await response.json();
        if(!response.ok)throw new Error(data.error||'Сервис временно недоступен');
      }
      if(!data?.ok)throw new Error(data?.error||'Сервис книг временно недоступен');
      if(request!==state.request)return;
      state.count=data.count;state.nextPage=data.nextPage;state.nextCursor=data.nextCursor||null;
      const seen=new Set(state.books.map(bookKey));
      const incoming=data.books.filter(b=>!seen.has(bookKey(b)));
      state.books.push(...incoming);
      $('catalogCount').textContent=Number.isFinite(data.count)?formatCount(data.count):'—';
      const grid=$('catalogGrid');
      if(reset)grid.replaceChildren();
      incoming.forEach(book=>grid.append(card(book)));
      if(!state.books.length){grid.append(node('div','empty-state',state.source==='local'?'Пока нет личных книг. Нажмите «Добавить книгу» и выберите EPUB, FB2 или TXT.':'По этому запросу нет подходящих книг. Попробуйте другого автора, название или подборку.'));}
      $('catalogStatus').textContent=Number.isFinite(state.count)
        ? state.count ? 'Найдено: '+formatCount(state.count) : 'Нет результатов'
        : state.source==='genres'?'Загружено произведений: '+formatCount(state.books.length)
        : 'Загружено переводов и редакций: '+formatCount(state.books.length);
      $('loadMore').hidden=!(state.nextPage||state.nextCursor);
    }catch(e){
      if(e.name==='AbortError')return;
      $('catalogStatus').textContent='';
      if(!state.books.length){
        const empty=node('div','empty-state',state.source==='spotlight'
          ?'Официальный каталог временно недоступен. Русская и зарубежная классика остаются в других разделах.'
          :'Не удалось получить каталог. Проверьте интернет и попробуйте снова.');
        if(state.source==='spotlight'){
          const query=state.query||'русские книги';
          const official=node('a','discover-source-fallback','Искать книгу в Google Books ↗');
          official.href='https://books.google.com/books?q='+encodeURIComponent(query);
          official.target='_blank';official.rel='noopener noreferrer';
          empty.append(document.createElement('br'),official);
        }
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
  function readableViewport(){
    const paper=$('readerPaper');
    const scroll=$('readerScroll');
    const idealWidth=prefs.width==='narrow'?520:640;
    const actualWidth=Math.min(idealWidth,Math.max(260,scroll?.clientWidth||window.innerWidth||390));
    const contentWidth=Math.max(205,actualWidth-(actualWidth<500?45:92));
    const height=Math.max(260,scroll?.clientHeight||window.innerHeight-140||570);
    const leading={compact:1.48,comfortable:1.72,airy:1.96}[prefs.leading]||1.72;
    const font=Math.max(14,Math.min(30,Number(prefs.font)||19));
    const lines=Math.max(9,Math.floor((height-215)/(leading*font)));
    const capacity=Math.floor((contentWidth/(font*(prefs.fontFace==='modern'?.55:.52)))*lines*.9);
    return Math.max(280,Math.min(2900,capacity));
  }
  function paginate(value){
    // Responsive logical pages. Reflows when viewport, font or leading changes.
    // Keep absolute character offsets so a typography change never jumps to
    // the wrong part of a long book.
    const text=String(value||'').replace(/\r\n?/g,'\n').trim();
    state.rawText=text;
    state.pageOffsets=[];
    if(!text){state.pageOffsets=[0];return ['Текст недоступен.'];}
    const budget=readableViewport();
    const pages=[];
    let cursor=0, guard=0;
    while(cursor<text.length && guard++<30000){
      let end=Math.min(text.length,cursor+budget);
      if(end<text.length){
        const minBreak=cursor+Math.floor(budget*.64);
        const para=text.lastIndexOf('\n\n',end);
        const sentenceSlice=text.slice(minBreak,end);
        const endings=[...sentenceSlice.matchAll(/[.!?…]\s+/g)];
        const sentence=endings.length?minBreak+endings[endings.length-1].index+endings[endings.length-1][0].length:-1;
        const space=text.lastIndexOf(' ',end);
        if(para>=minBreak)end=para+2;
        else if(sentence>=minBreak)end=sentence;
        else if(space>=minBreak)end=space+1;
      }
      if(end<=cursor)end=Math.min(text.length,cursor+Math.max(1,budget));
      state.pageOffsets.push(cursor);
      pages.push(text.slice(cursor,end).trim());
      cursor=end;
      while(cursor<text.length && /\s/.test(text.charAt(cursor)))cursor++;
    }
    return pages.length?pages:['Текст недоступен.'];
  }
  function nearestPage(offset){
    const offsets=state.pageOffsets;
    let low=0,high=offsets.length-1,result=0;
    while(low<=high){
      const mid=Math.floor((low+high)/2);
      if(offsets[mid]<=offset){result=mid;low=mid+1;}
      else high=mid-1;
    }
    return result;
  }
  function reflowReader(){
    if(!state.pages.length || !state.current || !state.rawText)return;
    const offset=state.pageOffsets[state.currentPage]||0;
    state.pages=paginate(state.rawText);
    showPage(nearestPage(offset));
  }
  function chapterFromPage(text, index){
    const first=text.slice(0,300).split('\n').map(s=>s.trim()).find(s=>
      /^(chapter\s+[ivxlcdm\d]+|глава\s+[ivxlcdm\d]+|part\s+[ivxlcdm\d]+|часть\s+[ivxlcdm\d]+)/i.test(s));
    return first || 'Продолжение истории';
  }
  function applyPrefs(reflow=false){
    prefs.font=Math.max(14,Math.min(30,Number(prefs.font)||19));
    prefs.speed=Math.max(.7,Math.min(1.4,Number(prefs.speed)||1));
    if(!['dark','light','sepia'].includes(prefs.theme))prefs.theme='dark';
    if(!['literary','modern'].includes(prefs.fontFace))prefs.fontFace='literary';
    if(!['compact','comfortable','airy'].includes(prefs.leading))prefs.leading='comfortable';
    if(!['narrow','normal'].includes(prefs.width))prefs.width='normal';
    const reader=$('reader');
    reader.dataset.theme=prefs.theme;
    reader.dataset.font=prefs.fontFace;
    reader.dataset.leading=prefs.leading;
    reader.dataset.width=prefs.width;
    reader.style.setProperty('--reader-size',prefs.font+'px');
    $('fontValue').textContent=prefs.font;
    for(const selector of ['read-theme','read-font','read-leading','read-width']){
      const current=selector==='read-theme'?prefs.theme:selector==='read-font'?prefs.fontFace:selector==='read-leading'?prefs.leading:prefs.width;
      for(const el of document.querySelectorAll('[data-'+selector+']')){
        const active=el.dataset[selector.replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]===current;
        el.classList.toggle('active',active);
        el.setAttribute('aria-pressed',String(active));
      }
    }
    for(const el of document.querySelectorAll('[data-read-speed]')){
      const active=Number(el.dataset.readSpeed)===prefs.speed;
      el.classList.toggle('active',active);
      el.setAttribute('aria-pressed',String(active));
    }
    persist('prefs',prefs);
    if(reflow)reflowReader();
  }
  // Read-aloud uses the device's Web Speech implementation, when available.
  // It never sends full text to a VETOGRAM speech server. Device voice
  // implementations may still involve a manufacturer/network voice service.
  function stopNarration(){
    ++state.audioToken;state.audioActive=false;
    $('readerAudioButton').setAttribute('aria-pressed','false');
    $('readerAudioButton').textContent='♫';
    $('readerAudioButton').title='Читать вслух';
    try{window.speechSynthesis?.cancel();}catch{}
  }
  function speakSegment(token){
    if(token!==state.audioToken||!state.current||!state.pages.length||!state.audioActive)return;
    const engine=window.speechSynthesis;
    if(!engine || typeof window.SpeechSynthesisUtterance!=='function') {
      stopNarration();toast('На этом устройстве нет поддержки чтения вслух');return;
    }
    const text=state.flow
      ?state.flowParagraphs[state.flowIndex]?.textContent||''
      :state.pages[state.currentPage]||'';
    if(!text.trim()){stopNarration();return;}
    try{
      const phrase=new window.SpeechSynthesisUtterance(text.slice(0,2800));
      const lang=state.current.language==='hy'?'hy-AM':state.current.language==='ru'?'ru-RU':'en-US';
      phrase.lang=lang;
      phrase.rate=Math.max(.7,Math.min(1.4,Number(prefs.speed)||1));
      const voices=engine.getVoices?.()||[];
      const preferred=voices.find(v=>v.lang?.toLowerCase()===lang.toLowerCase() && v.localService)
        ||voices.find(v=>v.lang?.toLowerCase().startsWith(lang.slice(0,2).toLowerCase()));
      if(preferred)phrase.voice=preferred;
      phrase.onerror=()=>{if(token===state.audioToken){stopNarration();toast('Озвучивание недоступно для этого текста');}};
      phrase.onend=()=>{
        if(token!==state.audioToken||!state.audioActive)return;
        if(state.flow){
          if(state.flowIndex+1<state.flowParagraphs.length){setFlowIndex(state.flowIndex+1);speakSegment(token);}
          else if(state.currentPage+1<state.pages.length){showPage(state.currentPage+1);speakSegment(token);}
          else stopNarration();
        }else if(state.currentPage+1<state.pages.length){
          showPage(state.currentPage+1);speakSegment(token);
        }else stopNarration();
      };
      engine.speak(phrase);
    }catch{stopNarration();toast('Чтение вслух недоступно');}
  }
  function toggleNarration(){
    if(state.audioActive){stopNarration();return;}
    if(!state.current||!state.pages.length)return;
    if(!window.speechSynthesis||typeof window.SpeechSynthesisUtterance!=='function'){
      toast('Голосовое чтение не поддерживается этим браузером');return;
    }
    stopNarration();
    state.audioActive=true;
    $('readerAudioButton').setAttribute('aria-pressed','true');
    $('readerAudioButton').textContent='Ⅱ';
    $('readerAudioButton').title='Остановить чтение вслух';
    speakSegment(state.audioToken);
  }
  // VETO FLOW: highlight only the paragraph being read. No AI network call,
  // no external tracking, and no untrusted HTML inserted into the page.
  function setFlow(enabled){
    stopNarration();
    state.flow=Boolean(enabled);
    $('reader').dataset.flow=String(state.flow);
    $('readerFlowButton').setAttribute('aria-pressed',String(state.flow));
    $('readerFlowButton').classList.toggle('active',state.flow);
    $('flowGuide').hidden=!state.flow;
    state.flowIndex=0;
    if(state.pages.length)showPage(state.currentPage,false);
    else updateFlow();
  }
  function renderFlowText(textValue){
    const host=$('readerCopy');
    host.replaceChildren();
    state.flowParagraphs=[];
    if(!state.flow){host.textContent=textValue;return;}
    const paras=String(textValue||'').split(/\n\s*\n/g).filter(x=>x.trim());
    const readableSegments=paras.length>150?[...paras.slice(0,149),paras.slice(149).join('\n\n')]:paras;
    for(const part of readableSegments){
      const p=node('p','flow-paragraph',part.trim());
      p.tabIndex=0;p.setAttribute('role','button');
      p.setAttribute('aria-label','Фокус на абзаце');
      const idx=state.flowParagraphs.length;
      p.addEventListener('click',event=>{event.stopPropagation();setFlowIndex(idx);});
      p.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();setFlowIndex(idx);}});
      host.append(p);state.flowParagraphs.push(p);
    }
    if(!state.flowParagraphs.length){host.textContent=textValue;}
    state.flowIndex=0;updateFlow();
  }
  function updateFlow(){
    const total=state.flowParagraphs.length;
    $('flowPosition').textContent=total?String(Math.min(total,state.flowIndex+1))+' / '+total:'—';
    $('flowPrevious').disabled=!total||(!state.flowIndex&&state.currentPage===0);
    $('flowNext').disabled=!total||state.flowIndex===total-1&&state.currentPage===state.pages.length-1&&!state.chapters.length;
    for(let i=0;i<total;i++){
      const selected=i===state.flowIndex;
      state.flowParagraphs[i].classList.toggle('active',selected);
      state.flowParagraphs[i].setAttribute('aria-current',selected?'true':'false');
    }
  }
  function setFlowIndex(index){
    if(!state.flowParagraphs.length)return;
    state.flowIndex=Math.max(0,Math.min(state.flowParagraphs.length-1,index));
    updateFlow();
    const el=state.flowParagraphs[state.flowIndex];
    if(el && typeof el.scrollIntoView==='function'){
      const reduce=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      el.scrollIntoView({behavior:reduce?'instant':'smooth',block:'center'});
    }
  }
  function stepFlow(dir){
    if(!state.flow)return;
    if(state.audioActive)stopNarration();
    const index=state.flowIndex+dir;
    if(index>=0&&index<state.flowParagraphs.length){setFlowIndex(index);return;}
    const nextPage=state.currentPage+dir;
    if(nextPage>=0&&nextPage<state.pages.length){
      showPage(nextPage);
      if(dir<0)setFlowIndex(state.flowParagraphs.length-1);
    }else flip(dir);
  }
  function bookmarkToken(){return String(state.activeChapter??'root')+':@'+(state.pageOffsets[state.currentPage]||0);}
  // One-chapter-ahead prefetch only. No page preloading during metered or
  // data-saver connections; no duplicate requests and no UI-facing failures.
  async function prefetchNextChapter(){
    const book=state.current;
    if(!isWiki(book)||state.isTranslationIndex||!state.chapters.length)return;
    const connectivity=navigator.connection;
    if(connectivity?.saveData||/2g/i.test(connectivity?.effectiveType||''))return;
    const chapter=Number.isInteger(state.activeChapter)?state.activeChapter+1:0;
    if(chapter<0||chapter>=state.chapters.length)return;
    const cacheId=bookKey(book)+':'+chapter;
    if(pendingChapterPrefetch.has(cacheId))return;
    const request=(async()=>{
      const cached=await cachedText(cacheId);
      if(cached?.text)return;
      const params=new URLSearchParams({mode:'text',wiki:book.wiki,id:String(book.id),chapter:String(chapter)});
      const response=await fetch('/api/books-wikisource?'+params);
      if(!response.ok)return;
      const payload=await response.json();
      if(!payload.ok||!payload.text||payload.isTranslationIndex)return;
      await cacheText(cacheId,{book:payload.book,text:payload.text,chapters:payload.chapters||[],
        attribution:payload.attribution||null,isTranslationIndex:false,coverage:payload.coverage||null});
    })().catch(()=>{}).finally(()=>pendingChapterPrefetch.delete(cacheId));
    pendingChapterPrefetch.set(cacheId,request);
    await request;
  }
  function showPage(page, scroll=true){
    if(!state.current||!state.pages.length)return;
    state.currentPage=Math.min(Math.max(0,page),state.pages.length-1);
    const currentPageText=state.pages[state.currentPage];
    renderFlowText(currentPageText);
    const paper=$('readerPaper');
    paper.classList.toggle('is-continuation',state.currentPage>0);
    paper.classList.remove('turn-forward','turn-backward');
    const chapterName=state.activeChapter===null?'':state.chapters[state.activeChapter]?.label;
    $('chapterTitle').textContent=chapterName || chapterFromPage(currentPageText,state.currentPage);
    $('pageNumber').textContent='СТРАНИЦА '+(state.currentPage+1);
    $('readerPageLabel').textContent=(state.currentPage+1)+' / '+state.pages.length;
    const offset=state.pageOffsets[state.currentPage]||0;
    const percentage=state.rawText.length ? Math.max(0,Math.min(100,offset/state.rawText.length*100)) : 0;
    const sequential=state.chapters.length>0&&!state.isTranslationIndex
      && (isWiki(state.current)||isLocal(state.current));
    const chapterIndex=sequential?Math.max(0,Number(state.activeChapter)||0):0;
    // Chapter progress is an approximate whole-book location because parts can
    // differ greatly in length. Never present this as an exact character count.
    const overall=sequential
      ?(chapterIndex+percentage/100)/state.chapters.length*100
      :percentage;
    $('progressFill').style.width=Math.round(overall)+'%';
    $('readerProgressPercent').textContent=(sequential?'≈ ':'')+Math.round(overall)+'%';
    $('readerProgressLabel').textContent=sequential
      ?'Часть '+(chapterIndex+1)+' из '+state.chapters.length+' · оценка прогресса книги'
      :'Место в текущем тексте';
    const chaptersAvailable=state.chapters.length>0&&(isWiki(state.current)||isLocal(state.current));
    const previousChapter=chaptersAvailable && state.activeChapter!==null && state.activeChapter>0;
    $('prevPage').disabled=state.currentPage===0 && !previousChapter;
    const nextChapter=chaptersAvailable &&
      (state.activeChapter===null || state.activeChapter<state.chapters.length-1);
    $('nextPage').disabled=state.currentPage===state.pages.length-1 && !nextChapter;
    const key=bookKey(state.current);
    const mark=bookmarkToken();
    const isMarked=progress[key]?.bookmarks?.includes(mark);
    $('bookmarkButton').textContent=isMarked?'♥':'♧';
    progress[key]={
      ...(progress[key]||{}),id:state.current.id,provider:state.current.provider||'gutenberg',
      wiki:state.current.wiki||null,chapter:state.activeChapter,page:state.currentPage,offset:state.pageOffsets[state.currentPage]||0,fraction:state.rawText.length?(state.pageOffsets[state.currentPage]||0)/state.rawText.length:0,
      at:Date.now(),title:state.current.title,authors:state.current.authors,
      cover:state.current.cover,language:state.current.language,sourceUrl:state.current.sourceUrl
    };
    persist('progress',progress);
    if(scroll)$('readerScroll').scrollTop=0;
    if(state.pages.length && state.currentPage>=state.pages.length-2)
      void prefetchNextChapter();

  }
  function renderChapters(){
    const wrap=$('readerChapters'),select=$('chapterSelect');
    wrap.hidden=!state.chapters.length || !(isWiki(state.current)||isLocal(state.current));
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
      let data;
      if(isLocal(book)){
        const work=await window.VetogramBooksImport?.get(book.id);
        if(!work || !work.contents?.length)throw new Error('Локальная книга не найдена. Импортируйте файл заново.');
        const index=work.chapters.length?(Number.isInteger(chapter)?chapter:0):0;
        if(index<0 || index>=work.contents.length)throw new Error('Глава не найдена в файле');
        chapter=work.chapters.length?index:null;
        data={book:work.book,text:work.contents[index],chapters:work.chapters||[],attribution:null,isTranslationIndex:false,coverage:{kind:'local-complete',completeness:'source-imported'}};
      }else{
        data=await cachedText(cacheId);
        if(!data?.text){
          const params=new URLSearchParams({mode:'text',id:String(book.id)});
          if(isWiki(book))params.set('wiki',book.wiki);
          if(chapter!==null && isWiki(book))params.set('chapter',String(chapter));
          const endpoint=isWiki(book)?'/api/books-wikisource':'/api/books';
          const response=await fetch(endpoint+'?'+params);
          const result=await response.json();
          if(!response.ok||!result.ok)throw new Error(result.error||'Не удалось открыть полный текст');
          data={book:result.book,text:result.text,chapters:result.chapters||[],attribution:result.attribution||null,isTranslationIndex:result.isTranslationIndex||false,coverage:result.coverage||null};
          await cacheText(cacheId,data);
        }
      }
      if($('reader').hidden || state.requestBook!==request || bookKey(state.current)!==key)return;
      state.current={...book,...(data.book||{})};
      state.chapters=data.chapters||[];
      state.isTranslationIndex=!!data.isTranslationIndex;
      state.activeChapter=chapter;
      $('readerTitle').textContent=compactTitle(state.current.title);
      $('readerAuthor').textContent=fullName(state.current);
      $('readerSourceLink').hidden=isLocal(book)&&!book.licensedSource;
      if(!isLocal(book)||book.licensedSource)$('readerSourceLink').href=data.attribution?.source||state.current.sourceUrl||'https://www.gutenberg.org/';
      renderChapters();
      setVolumeStatus(state.current,data.coverage);
      if(state.isTranslationIndex && chapter===null && state.chapters.length) {
        $('readerSettings').hidden=false;
        $('readerSettingsButton').setAttribute('aria-expanded','true');
      }
      const text=isWiki(book)||isLocal(book)?data.text:stripGutenbergFrame(data.text);
      if(isWiki(book)&&chapter===null&&!state.isTranslationIndex&&state.chapters.length>0
        && String(text||'').trim().length<1100){
        await loadChapter(book,0,resume);
        return;
      }
      state.pages=paginate(text);
      const p=progress[key];
      const position=resume&&p?.chapter===chapter
        ? Number.isFinite(Number(p.offset))?nearestPage(Math.max(0,Number(p.offset))):Math.max(0,Number(p.page)||0)
        :0;
      showPage(position);
    }catch(e){
      if(!$('reader').hidden && state.requestBook===request){
        $('readerCopy').textContent='Не удалось открыть текст. Вернитесь к книгам и попробуйте другой результат.';
        $('readerPageLabel').textContent='—';
        toast(e.message||'Сервис чтения недоступен');
      }
    }
  }
  async function openBook(book){
    stopNarration();
    if(isCatalogBook(book)){showDiscoverBook(book);return;}
    if(!book||!Number.isSafeInteger(Number(book.id))||Number(book.id)<1)return;
    ++state.requestBook;
    state.current=book;state.pages=[];state.chapters=[];state.activeChapter=null;state.rawText='';state.pageOffsets=[];
    setFlow(false);
    setFocus(false);
    $('reader').hidden=false;
    try{window.Telegram?.WebApp?.BackButton?.show();}catch{}
    $('readerTitle').textContent=compactTitle(book.title);
    $('readerAuthor').textContent=fullName(book);
    $('readerSettings').hidden=true;
    $('readerSettingsButton').setAttribute('aria-expanded','false');
    $('readerSourceLink').hidden=isLocal(book)&&!book.licensedSource;
    if(!isLocal(book)||book.licensedSource)$('readerSourceLink').href=book.sourceUrl||'https://www.gutenberg.org/';
    $('readerChapters').hidden=true;
    $('readerTocButton').hidden=true;
    $('readerDownloadBar').hidden=true;
    $('readerVolumeStatus').textContent='Проверяем доступный объём…';
    $('readerVolumeStatus').dataset.kind='unverified';
    applyPrefs();
    const old=progress[bookKey(book)];
    const chapter=(isWiki(book)||isLocal(book))&&Number.isInteger(old?.chapter)&&old.chapter>=0?old.chapter:isLocal(book)&&book.format==='epub'?0:null;
    await loadChapter(book,chapter,true);
  }
  function closeReader(){
    ++offlineEditionToken;
    stopNarration();
    ++state.requestBook;
    $('reader').hidden=true;state.current=null;state.pages=[];state.chapters=[];
    try{window.Telegram?.WebApp?.BackButton?.hide();}catch{}
    state.activeChapter=null;state.rawText='';state.pageOffsets=[];
    setFlow(false);setFocus(false);
    $('readerSettings').hidden=true;
    updateSavedCount();renderContinueShelf();
  }
  function flip(dir){
    if(!state.pages.length || !state.current)return;
    if(state.audioActive)stopNarration();
    const target=state.currentPage+dir;
    if(target>=0 && target<state.pages.length){
      showPage(target);
      if(!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches){
        const paper=$('readerPaper');
        paper.classList.remove('turn-forward','turn-backward');
        void paper.offsetWidth;
        paper.classList.add(dir>0?'turn-forward':'turn-backward');
      }
      return;
    }
    if(!(isWiki(state.current)||isLocal(state.current)) || !state.chapters.length)return;
    if(dir>0 && state.activeChapter===null){void loadChapter(state.current,0);return;}
    if(dir>0 && state.activeChapter<state.chapters.length-1){void loadChapter(state.current,state.activeChapter+1);return;}
    if(dir<0 && state.activeChapter!==null){
      if(state.activeChapter===0 && isLocal(state.current))return;
      void loadChapter(state.current,state.activeChapter===0?null:state.activeChapter-1);return;
    }
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
    const currentPage=String(state.pages[state.currentPage]||'');
    const withinPage=currentPage.toLocaleLowerCase().indexOf(selection.toLocaleLowerCase());
    const approximateOffset=(state.pageOffsets[state.currentPage]||0)+Math.max(0,withinPage);
    quotes.unshift({bookId:bookKey(state.current),title:state.current.title,page:state.currentPage,
      chapter:state.activeChapter,offset:approximateOffset,quote:selection,at:Date.now()});
    if(quotes.length>80)quotes.length=80;
    persist('quotes',quotes);
    window.getSelection()?.removeAllRanges();
    toast('Цитата сохранена');
  }
  // VETO COMPASS: in-book map, search and persistent user landmarks.
  // Only searches text already loaded in the reader. No network API calls.
  function parseBookmarkToken(token){
    const found=/^(root|\d+):(@?)(\d+)$/.exec(String(token||''));
    if(!found)return null;
    const chapter=found[1]==='root'?null:Number(found[1]);
    if(chapter!==null && !Number.isSafeInteger(chapter))return null;
    return {chapter,offset:found[2]?Number(found[3]):null,page:found[2]?null:Number(found[3])};
  }
  async function jumpToReadingPoint(target){
    if(!state.current)return;
    const book=state.current,identity=bookKey(book);
    const part=target.chapter===null||target.chapter===undefined?null:Number(target.chapter);
    if(part!==null && (!Number.isSafeInteger(part)||part<0||part>=state.chapters.length)){
      toast('Глава больше недоступна');return;
    }
    $('bookModal').hidden=true;
    stopNarration();
    if(part!==state.activeChapter){
      await loadChapter(book,part);
    }
    if($('reader').hidden||!state.current||bookKey(state.current)!==identity||!state.pages.length)return;
    const offset=Number(target.offset);
    const fallback=Number(target.page);
    const page=Number.isFinite(offset)&&target.offset!==null&&target.offset!==undefined
      ?nearestPage(Math.max(0,offset))
      :Number.isSafeInteger(fallback)&&fallback>=0?fallback:0;
    showPage(page);
    if(target.highlight)highlightReadingMatch(target.highlight);
  }
  function highlightReadingMatch(value){
    if(state.flow)return;
    const content=String(state.pages[state.currentPage]||'');
    const term=String(value||'').trim().slice(0,160);
    if(!term)return;
    const index=content.toLocaleLowerCase().indexOf(term.toLocaleLowerCase());
    if(index<0)return;
    const marker=node('mark','reader-search-mark',content.slice(index,index+term.length));
    $('readerCopy').replaceChildren(document.createTextNode(content.slice(0,index)),
      marker,document.createTextNode(content.slice(index+term.length)));
  }
  function compassSection(host,title){
    const section=node('section','compass-section');
    section.append(node('h3','',title));host.append(section);return section;
  }
  function showReaderCompass(){
    if(!state.current||!state.pages.length)return;
    const key=bookKey(state.current);
    const host=modal('VETO COMPASS');
    host.classList.add('compass-content');
    const intro=node('div','compass-intro');
    intro.append(node('span','compass-eyebrow','YOUR READING UNIVERSE'),
      node('strong','',compactTitle(state.current.title)),
      node('p','','Поиск и закладки в загруженной главе. Всё работает прямо в читалке.'));
    host.append(intro);
    const chapter=state.activeChapter;
    const timeline=compassSection(host,'Карта текущей части');
    const rail=node('div','compass-rail'),range=node('input','compass-range');
    range.type='range';range.min='0';range.max='1000';range.step='1';
    range.value=String(state.rawText.length?Math.round((state.pageOffsets[state.currentPage]||0)/state.rawText.length*1000):0);
    range.setAttribute('aria-label','Перемещение по текущей главе');
    const percent=node('output','compass-percent',Math.round(Number(range.value)/10)+'%');
    range.addEventListener('input',()=>{percent.textContent=Math.round(Number(range.value)/10)+'%';});
    range.addEventListener('change',()=>{void jumpToReadingPoint({chapter,offset:Math.floor(state.rawText.length*Number(range.value)/1000)});});
    rail.append(range,percent);timeline.append(rail);
    const quick=node('div','compass-quick');
    const beginning=node('button','','В начало');
    beginning.type='button';beginning.addEventListener('click',()=>{void jumpToReadingPoint({chapter,offset:0});});
    const ending=node('button','','В конец главы');
    ending.type='button';ending.addEventListener('click',()=>{void jumpToReadingPoint({chapter,offset:state.rawText.length});});
    quick.append(beginning,ending);timeline.append(quick);

    const find=compassSection(host,'Найти в тексте');
    const field=node('input','compass-input');
    field.type='search';field.maxLength=100;field.placeholder='Слово или фраза…';
    field.setAttribute('aria-label','Поиск по текущей главе');
    const results=node('div','compass-results');
    find.append(field,results);
    const renderMatches=()=>{
      results.replaceChildren();
      const needle=field.value.trim().toLocaleLowerCase();
      if(needle.length<2){
        results.append(node('p','compass-hint','Введите минимум 2 символа.'));
        return;
      }
      const haystack=state.rawText.toLocaleLowerCase();
      let position=0,found=0;
      while(found<40){
        const offset=haystack.indexOf(needle,position);
        if(offset<0)break;
        const snippetStart=Math.max(0,offset-65);
        const snippetEnd=Math.min(state.rawText.length,offset+needle.length+100);
        const preview=state.rawText.slice(snippetStart,snippetEnd).replace(/\s+/g,' ').trim();
        const item=node('button','compass-match');
        item.type='button';
        const at=Math.floor(offset/Math.max(1,state.rawText.length)*100);
        item.append(node('span','',preview),node('small','',at+'% главы'));
        item.addEventListener('click',()=>{void jumpToReadingPoint({chapter,offset,highlight:field.value.trim()});});
        results.append(item);
        found++;position=offset+Math.max(1,needle.length);
      }
      if(!found)results.append(node('p','compass-hint','Совпадений в текущей главе нет.'));
      if(found===40)results.append(node('p','compass-hint','Показаны первые 40 совпадений.'));
    };
    field.addEventListener('input',renderMatches);
    renderMatches();

    const bookmarks=compassSection(host,'Ваши закладки');
    const renderMarks=()=>{
      [...bookmarks.children].filter(c=>c.className==='compass-row').forEach(x=>x.remove());
      const savedMarks=progress[key]?.bookmarks||[];
      if(!savedMarks.length){bookmarks.append(node('p','compass-hint','Поставьте закладку кнопкой ♧ на странице.'));return;}
      for(const token of savedMarks.slice(-60).reverse()){
        const target=parseBookmarkToken(token);
        if(!target)continue;
        const row=node('button','compass-row');
        row.type='button';row.textContent=
          (target.chapter===null?'Начало':(state.chapters[target.chapter]?.label||'Часть '+(target.chapter+1)))+
          ' · '+(target.offset===null?'стр. '+((target.page||0)+1):'позиция '+(target.offset+1));
        row.addEventListener('click',()=>{void jumpToReadingPoint(target);});
        bookmarks.append(row);
      }
    };
    renderMarks();

    const notebook=compassSection(host,'Цитаты из книги');
    const own=quotes.filter(x=>x.bookId===key).slice(0,35);
    if(!own.length)notebook.append(node('p','compass-hint','Выделите фразу и нажмите ❝ для сохранения.'));
    for(const item of own){
      const group=node('div','compass-quote');
      const visit=node('button','compass-quote-open','❝ '+String(item.quote||'').slice(0,350));
      visit.type='button';
      visit.addEventListener('click',()=>{void jumpToReadingPoint({chapter:item.chapter,offset:item.offset??null,page:item.page,highlight:item.quote});});
      const copy=node('button','compass-quote-copy','Копировать');
      copy.type='button';
      copy.addEventListener('click',async()=>{
        try{await navigator.clipboard.writeText(item.quote);toast('Цитата скопирована');}
        catch{toast('Копирование недоступно в этом браузере');}
      });
      group.append(visit,copy);notebook.append(group);
    }
    const thoughts=compassSection(host,'Мои заметки на полях');
    thoughts.append(node('p','compass-hint','Привязываются к текущему месту в тексте. Хранятся только на устройстве.'));
    const editor=node('textarea','compass-note-editor');
    editor.rows=3;editor.maxLength=500;
    editor.placeholder='Что хочется запомнить об этой странице?';
    editor.setAttribute('aria-label','Новая заметка к текущему месту чтения');
    const saveNote=node('button','compass-note-save','Сохранить мысль');
    saveNote.type='button';
    const notesList=node('div','compass-notes');
    const renderNotes=()=>{
      notesList.replaceChildren();
      const ownNotes=readingNotes.filter(x=>x.bookId===key).slice(0,45);
      if(!ownNotes.length){notesList.append(node('p','compass-hint','Здесь появятся ваши мысли о книге.'));return;}
      for(const item of ownNotes){
        const row=node('div','compass-note');
        const visit=node('button','compass-note-visit',String(item.text||'').slice(0,500));
        visit.type='button';visit.addEventListener('click',()=>{
          void jumpToReadingPoint({chapter:item.chapter,offset:item.offset,page:item.page});
        });
        const remove=node('button','compass-note-remove','Удалить');
        remove.type='button';remove.addEventListener('click',()=>{
          const index=readingNotes.indexOf(item);
          if(index>=0){readingNotes.splice(index,1);persist('readingNotes',readingNotes);renderNotes();}
        });
        row.append(visit,remove);notesList.append(row);
      }
    };
    saveNote.addEventListener('click',()=>{
      const value=editor.value.trim();
      if(!value){toast('Напишите заметку перед сохранением');return;}
      readingNotes.unshift({
        bookId:key,text:value.slice(0,500),chapter:state.activeChapter,
        page:state.currentPage,offset:state.pageOffsets[state.currentPage]||0,at:Date.now()
      });
      if(readingNotes.length>120)readingNotes.length=120;
      persist('readingNotes',readingNotes);
      editor.value='';renderNotes();toast('Заметка сохранена на устройстве');
    });
    thoughts.append(editor,saveNote,notesList);
    renderNotes();
    field.focus({preventScroll:true});
  }

  function modal(title){
    $('modalTitle').textContent=title;$('modalContent').classList.remove('compass-content');
    $('modalContent').replaceChildren();$('bookModal').hidden=false;
    return $('modalContent');
  }
  function modalRow(host,title,subtitle,action,handler){
    const row=node('div','modal-row'),text=node('div');
    text.append(node('strong','',title),node('small','',subtitle));
    const button=node('button','',action);button.type='button';button.addEventListener('click',handler);
    row.append(text,button);host.append(row);
  }
  function loadLicensedViewer(){
    if(window.google?.books?.DefaultViewer)return Promise.resolve(window.google.books);
    if(googleViewerPromise)return googleViewerPromise;
    googleViewerPromise=new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src='https://www.google.com/books/jsapi.js';
      script.async=true;
      let done=false;
      const timeout=setTimeout(()=>finish(new Error('Preview loader timed out')),11000);
      const finish=error=>{
        if(done)return;done=true;clearTimeout(timeout);
        if(error){googleViewerPromise=null;reject(error);}
        else resolve(window.google.books);
      };
      script.onload=()=>{
        try{
          if(!window.google?.books)throw Error('Viewer library not available');
          window.google.books.load({language:'ru'});
          window.google.books.setOnLoadCallback(()=>finish(null));
        }catch(error){finish(error);}
      };
      script.onerror=()=>finish(new Error('Could not load Google Books preview'));
      document.head.append(script);
    });
    return googleViewerPromise;
  }
  async function showLicensedPreview(book){
    if(!book?.embeddable || !/^[A-Za-z0-9_-]{3,100}$/.test(String(book.id)))return;
    const host=$('modalContent');
    const pane=node('section','licensed-preview');
    const title=node('strong','','Разрешённый фрагмент Google Books');
    const help=node('p','','Загрузка официального встроенного просмотра. Доступность зависит от страны и издателя.');
    const canvas=node('div','official-preview-canvas');
    pane.append(title,help,canvas);
    host.append(pane);
    try{
      const lib=await loadLicensedViewer();
      if(!$('bookModal').hidden && pane.isConnected){
        const viewer=new lib.DefaultViewer(canvas);
        viewer.load('https://books.google.com/books?id='+encodeURIComponent(book.id),
          ()=>{help.textContent='Встроенный просмотр недоступен в этом регионе или для данного издания. Используйте официальную ссылку выше.';},
          ()=>{help.textContent='Просмотр предоставлен Google Books. Доступен только разрешённый правообладателем материал.';});
      }
    }catch{
      help.textContent='Встроенный просмотр не поддерживается этим браузером. Откройте официальную ссылку выше.';
    }
  }
  function showDiscoverBook(book){
    const host=modal('О книге');
    const panel=node('div','discover-detail');
    const coverUrl=safeCover(book.cover);
    const cover=node('div','discover-detail-cover');
    if(coverUrl){
      const image=node('img');image.alt='Обложка книги '+compactTitle(book.title);
      image.src=coverUrl;image.loading='lazy';cover.append(image);
    }else cover.textContent=compactTitle(book.title);
    const body=node('div','discover-detail-body');
    body.append(node('span','discover-label','РУССКОЯЗЫЧНОЕ ИЗДАНИЕ'),
      node('h3','',compactTitle(book.title)),node('p','discover-author',fullName(book)));
    if(book.subtitle)body.append(node('p','discover-subtitle',book.subtitle));
    if(book.publishedDate||book.publisher){
      body.append(node('p','discover-meta',[book.publisher,book.publishedDate,book.pageCount?book.pageCount+' стр.':null].filter(Boolean).join(' · ')));
    }
    panel.append(cover,body);host.append(panel);
    if(book.summary)host.append(node('p','discover-summary',String(book.summary).replace(/<[^>]*>/g,'').slice(0,640)));
    const actions=node('div','discover-actions');
    const addLink=(label,href,primary=false)=>{
      const link=safeBookLink(href);
      if(!link)return;
      const a=node('a',primary?'discover-primary':'discover-secondary',label+' ↗');
      a.href=link;a.target='_blank';a.rel='noopener noreferrer';a.referrerPolicy='no-referrer';
      actions.append(a);
    };
    if(book.embeddable){
      const embed=node('button','discover-embed','Читать фрагмент здесь ↗');
      embed.type='button';
      embed.addEventListener('click',()=>{
        embed.disabled=true;
        void showLicensedPreview(book);
      });
      actions.append(embed);
    }
    addLink(book.access==='official-full-view'?'Официальная полная версия':'Посмотреть фрагмент',book.previewUrl,Boolean(book.previewUrl));
    addLink('Официальная страница книги',book.sourceUrl,!book.previewUrl);
    addLink('Купить у издателя',book.buyUrl);
    host.append(actions);
    host.append(node('p','discover-disclaimer',
      'Это карточка книги, не встроенный полный текст. Для современных защищённых произведений чтение доступно только через официальные страницы и разрешённые фрагменты.'));
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
        modalRow(host,compactTitle(saved[id].title),fullName(saved[id]),'Открыть',()=>{$('bookModal').hidden=true;isCatalogBook(saved[id])?showDiscoverBook(saved[id]):openBook(saved[id]);});
      });
    }
    if(quotes.length){
      host.append(node('p','eyebrow','ЦИТАТЫ'));
      quotes.slice(0,30).forEach(item=>modalRow(host,item.quote,item.title,'Копировать',async()=>{
        try{await navigator.clipboard.writeText(item.quote);toast('Цитата скопирована');}catch{toast('Выделите и скопируйте вручную');}
      }));
    }
  }

  for(const button of document.querySelectorAll('[data-reading-genre]'))button.addEventListener('click',()=>{
    if(state.readingGenre===button.dataset.readingGenre)return;
    state.readingGenre=button.dataset.readingGenre;
    persist('readingGenre',state.readingGenre);
    state.query='';$('bookSearch').value='';
    setSourceInfo();loadCatalog(true);
  });
  for(const button of document.querySelectorAll('[data-spotlight]'))button.addEventListener('click',()=>{
    state.spotlight=button.dataset.spotlight;
    persist('spotlight',state.spotlight);
    state.query='';$('bookSearch').value='';
    setSourceInfo();loadCatalog(true);
  });
  for(const button of document.querySelectorAll('[data-original-lang]'))button.addEventListener('click',()=>{
    if(state.original===button.dataset.originalLang)return;
    state.original=button.dataset.originalLang;
    persist('original',state.original);
    state.query='';
    $('bookSearch').value='';
    setSourceInfo();
    loadCatalog(true);
  });
  $('importButton').addEventListener('click',()=>$('importFile').click());
  $('importFile').addEventListener('change',async()=>{
    const file=$('importFile').files?.[0];
    if(!file)return;
    $('importButton').disabled=true;
    $('importStatus').textContent='Подготавливаем книгу на устройстве…';
    try{
      const book=await window.VetogramBooksImport.importFile(file);
      saved[bookKey(book)]=book;persist('saved',saved);updateSavedCount();
      $('importStatus').textContent='«'+compactTitle(book.title)+'» сохранена на устройстве.';
      if(state.source==='local')await loadCatalog(true);
      toast('Книга готова — открываем читалку');
      await openBook(book);
    }catch(error){
      $('importStatus').textContent=error.message||'Не удалось импортировать книгу';
      toast(error.message||'Ошибка импорта');
    }finally{$('importFile').value='';$('importButton').disabled=false;}
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
  $('smallerFont').addEventListener('click',()=>{prefs.font-=1;applyPrefs(true);});
  $('largerFont').addEventListener('click',()=>{prefs.font+=1;applyPrefs(true);});
  for(const button of document.querySelectorAll('[data-read-theme]'))button.addEventListener('click',()=>{
    prefs.theme=button.dataset.readTheme;applyPrefs(false);
  });
  for(const selector of ['read-font','read-leading','read-width']){
    for(const button of document.querySelectorAll('[data-'+selector+']')){
      button.addEventListener('click',()=>{
        if(selector==='read-font')prefs.fontFace=button.dataset.readFont;
        if(selector==='read-leading')prefs.leading=button.dataset.readLeading;
        if(selector==='read-width')prefs.width=button.dataset.readWidth;
        applyPrefs(true);
      });
    }
  }
  $('readerAudioButton').addEventListener('click',toggleNarration);
  for(const button of document.querySelectorAll('[data-read-speed]'))button.addEventListener('click',()=>{
    prefs.speed=Number(button.dataset.readSpeed)||1;applyPrefs();
    if(state.audioActive){stopNarration();toggleNarration();}
  });
  $('readerFlowButton').addEventListener('click',()=>setFlow(!state.flow));
  $('flowPrevious').addEventListener('click',()=>stepFlow(-1));
  $('flowNext').addEventListener('click',()=>stepFlow(1));
  $('readerFocusButton').addEventListener('click',()=>setFocus(!state.focus));
  $('readerFocusExit').addEventListener('click',()=>setFocus(false));
  $('readerScroll').addEventListener('click',event=>{
    if(!state.pages.length||!state.current||!event.isTrusted)return;
    if(event.target.closest('button,a,input,select'))return;
    const selection=window.getSelection();
    if(selection && !selection.isCollapsed)return;
    const box=$('readerScroll').getBoundingClientRect();
    const relativeX=event.clientX-box.left;
    if(relativeX<box.width*.16)flip(-1);
    else if(relativeX>box.width*.84)flip(1);
  });
  let resizeDebounce;
  window.addEventListener('resize',()=>{
    if($('reader').hidden||!state.pages.length)return;
    clearTimeout(resizeDebounce);
    resizeDebounce=setTimeout(reflowReader,150);
  });
  try{
    const tgBack=window.Telegram?.WebApp?.BackButton;
    if(tgBack){
      tgBack.onClick(()=>{if(!$('reader').hidden)closeReader();});
    }
  }catch{}
  $('prevPage').addEventListener('click',()=>flip(-1));
  $('nextPage').addEventListener('click',()=>flip(1));
  $('heroReadNow').addEventListener('click',()=>{
    const btn=document.querySelector('[data-books-source="complete"]');
    btn?.click();
    $('catalogGrid').scrollIntoView({behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
  });
  // Motion has no network payload; respects OS reduced-motion preferences.
  const hero=document.querySelector('.hero-veto');
  if(hero && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches){
    hero.addEventListener('pointermove',event=>{
      if(event.pointerType==='touch')return;
      const rect=hero.getBoundingClientRect();
      const centerX=(event.clientX-rect.left)/rect.width-.5;
      const centerY=(event.clientY-rect.top)/rect.height-.5;
      hero.style.setProperty('--veto-tilt-x',(centerX*7).toFixed(2)+'deg');
      hero.style.setProperty('--veto-tilt-y',(-centerY*6).toFixed(2)+'deg');
    });
    hero.addEventListener('pointerleave',()=>{
      hero.style.setProperty('--veto-tilt-x','0deg');
      hero.style.setProperty('--veto-tilt-y','0deg');
    });
  }
  $('heroMyBooks').addEventListener('click',()=>{
    document.querySelector('[data-books-source="local"]')?.click();
    $('importBanner').scrollIntoView({behavior:'smooth',block:'center'});
  });
  $('readerSaveAllChapters').addEventListener('click',()=>{void saveWholeEditionOffline();});
  $('readerTocButton').addEventListener('click',()=>{
    $('readerSettings').hidden=false;
    $('readerSettingsButton').setAttribute('aria-expanded','true');
    $('chapterSelect').focus({preventScroll:true});
  });
  $('readerCompassButton').addEventListener('click',showReaderCompass);
  $('bookmarkButton').addEventListener('click',bookmark);
  $('saveQuote').addEventListener('click',quote);
  document.addEventListener('keydown',event=>{
    if(!$('bookModal').hidden){if(event.key==='Escape'){$('bookModal').hidden=true;event.preventDefault();}return;}
    if($('reader').hidden)return;
    if(['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName))return;
    if(state.flow && event.key==='ArrowDown'){event.preventDefault();stepFlow(1);return;}
    if(state.flow && event.key==='ArrowUp'){event.preventDefault();stepFlow(-1);return;}
    if(event.key==='ArrowRight'){event.preventDefault();flip(1);}
    if(event.key==='ArrowLeft'){event.preventDefault();flip(-1);}
    if(event.key==='Escape'){ if(state.focus)setFocus(false);else closeReader(); }
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
  updateSavedCount();applyPrefs();renderContinueShelf();setSourceInfo();loadCatalog(true);
})();
