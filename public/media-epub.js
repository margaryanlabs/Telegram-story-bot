/* VETO MEDIA · personal EPUB shelf (browser-local, no upload) */
(() => {
  "use strict";
  const MAX_FILE = 35 * 1048576, MAX_BOOKS = 30, DB = "veto-media-epub-v1";
  const $ = (id) => document.getElementById(id);
  const st = { book:null, rendition:null, currentId:null, toc:[], mode:"pure", notes:{} };
  const tag = (name,cls,text) => { const e=document.createElement(name); if(cls)e.className=cls;if(text!==undefined)e.textContent=String(text);return e; };
  const safeStore = {
    get(key,fallback){try{const x=localStorage.getItem("veto-epub:"+key);return x===null?fallback:JSON.parse(x)}catch{return fallback}},
    set(key,value){try{localStorage.setItem("veto-epub:"+key,JSON.stringify(value))}catch{}}
  };
  const announce=(message)=>{const t=$("toast");if(t){t.textContent=message;t.classList.remove("hidden");setTimeout(()=>t.classList.add("hidden"),3600)}};
  function db() {
    return new Promise((resolve,reject)=>{
      if(!window.indexedDB)return reject(Error("IndexedDB недоступно"));
      const request=indexedDB.open(DB,1);
      request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains("items"))request.result.createObjectStore("items",{keyPath:"id"})};
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error||Error("Ошибка IndexedDB"));
    });
  }
  async function tx(mode,callback) {
    const database=await db();
    return new Promise((resolve,reject)=>{
      const transaction=database.transaction("items",mode);
      let result; const request=callback(transaction.objectStore("items"));
      request.onsuccess=()=>{result=request.result};
      transaction.oncomplete=()=>{database.close();resolve(result)};
      transaction.onerror=()=>{database.close();reject(transaction.error||Error("Ошибка сохранения"))};
      transaction.onabort=()=>{database.close();reject(transaction.error||Error("Операция отменена"))};
    });
  }
  const list=()=>tx("readonly",store=>store.getAll());
  const fetchBook=(id)=>tx("readonly",store=>store.get(id));
  const put=(record)=>tx("readwrite",store=>store.put(record));
  const del=(id)=>tx("readwrite",store=>store.delete(id));
  function close(){
    try{st.rendition?.destroy();st.book?.destroy()}catch{}
    st.book=null;st.rendition=null;st.currentId=null;st.toc=[];
    $("mediaEpubOverlay").classList.add("hidden");document.body.style.overflow="";
  }
  function panel() {
    const wrap=tag("div","epub-intro");
    const header=tag("div","section-top");
    const info=tag("div");
    info.append(tag("span","overline","YOUR PERSONAL READING SPACE"),tag("h2","","Твоя личная EPUB-библиотека"),
      tag("p","","Добавляй книги без DRM. Все файлы остаются только на твоём устройстве."));
    header.append(info);
    const importButton=tag("button","primary-btn","＋ Добавить EPUB");
    importButton.type="button";importButton.onclick=()=>$("mediaEpubInput").click();
    header.append(importButton);wrap.append(header);
    const input=tag("input");input.id="mediaEpubInput";input.type="file";input.accept=".epub,application/epub+zip";input.hidden=true;
    input.addEventListener("change",async(event)=>{
      const file=event.target.files?.[0];event.target.value="";
      if(file)await importFile(file);
    });
    wrap.append(input);
    const msg=tag("div","epub-message","EPUB без DRM · локальное хранение · экспорт книг не требуется");
    msg.id="mediaEpubStatus";wrap.append(msg);
    const shelf=tag("div","epub-shelf");shelf.id="mediaEpubShelf";wrap.append(shelf);
    $("booksView").append(wrap);
  }
  function overlay() {
    const back=tag("div","epub-overlay hidden");back.id="mediaEpubOverlay";
    const container=tag("div","epub-reader");container.setAttribute("role","dialog");
    container.setAttribute("aria-modal","true");container.setAttribute("aria-label","EPUB-читалка");
    const top=tag("div","epub-reader-head");
    const closeButton=tag("button","epub-action","← Назад");closeButton.type="button";closeButton.onclick=close;
    const title=tag("div","epub-book-title");title.id="mediaEpubTitle";title.textContent="EPUB";
    const tocButton=tag("button","epub-action","Оглавление");tocButton.type="button";tocButton.onclick=()=>$("mediaEpubToc").classList.toggle("open");
    const sizeMinus=tag("button","epub-action","A−");sizeMinus.type="button";sizeMinus.onclick=()=>setFont(-1);
    const sizePlus=tag("button","epub-action","A+");sizePlus.type="button";sizePlus.onclick=()=>setFont(1);
    top.append(closeButton,title,tocButton,sizeMinus,sizePlus);
    const modes=tag("div","epub-modes");
    for(const [id,label] of [["pure","PURE"],["cinema","CINEMA"],["deep","DEEP"]]){
      const b=tag("button","epub-mode"+(id==="pure"?" is-active":""),label);b.type="button";b.dataset.mode=id;
      b.onclick=()=>setMode(id);modes.append(b);
    }
    const body=tag("div","epub-reader-body");
    const toc=tag("aside","epub-toc");toc.id="mediaEpubToc";
    const bookStage=tag("div","epub-stage");bookStage.id="mediaEpubStage";
    const deep=tag("aside","epub-deep hidden");deep.id="mediaEpubDeep";
    deep.append(tag("h3","","Мои мысли"));
    const note=tag("textarea");note.id="mediaEpubNote";note.placeholder="Что хочется запомнить из этой книги?";note.maxLength=8000;
    note.addEventListener("input",()=>{if(st.currentId)safeStore.set("notes:"+st.currentId,note.value)});
    deep.append(note,tag("small","","Заметки хранятся только на этом устройстве."));
    body.append(toc,bookStage,deep);
    const bottom=tag("div","epub-reader-footer");
    const prev=tag("button","epub-action","← Назад");prev.type="button";prev.onclick=()=>st.rendition?.prev().catch(err=>status(err.message));
    const progress=tag("span","epub-progress","EPUB");progress.id="mediaEpubProgress";
    const next=tag("button","epub-action","Далее →");next.type="button";next.onclick=()=>st.rendition?.next().catch(err=>status(err.message));
    bottom.append(prev,progress,next);
    container.append(top,modes,body,bottom);back.append(container);
    back.addEventListener("click",(e)=>{if(e.target===back)close()});
    document.body.append(back);
    window.addEventListener("keydown",e=>{if(e.key==="Escape"&&!back.classList.contains("hidden"))close()});
  }
  function status(message){$("mediaEpubStatus").textContent=message;announce(message)}
  function setMode(mode){
    st.mode=mode;
    $("mediaEpubOverlay").dataset.mode=mode;
    document.querySelectorAll(".epub-mode").forEach(b=>b.classList.toggle("is-active",b.dataset.mode===mode));
    $("mediaEpubDeep").classList.toggle("hidden",mode!=="deep");
    safeStore.set("mode",mode);
    if(st.rendition){
      try{st.rendition.themes.default({body:{
        "font-family":mode==="cinema"?"Georgia,serif!important":"Georgia,serif!important",
        "line-height":"1.8!important","background-color":mode==="cinema"?"#121a2d!important":"#f7f2e8!important",
        "color":mode==="cinema"?"#f2e7dc!important":"#302b2a!important",
        "font-size":(safeStore.get("font",19))+"px!important"
      }})}catch{}
      st.rendition.resize();
    }
  }
  function setFont(delta){
    const size=Math.max(14,Math.min(30,safeStore.get("font",19)+delta));
    safeStore.set("font",size);
    if(st.rendition)try{st.rendition.themes.fontSize(size+"px")}catch{}
  }
  async function importFile(file) {
    if(!file.name.toLowerCase().endsWith(".epub")||!file.size||file.size>MAX_FILE){
      status("Нужен EPUB без DRM размером до 35 МБ.");return;
    }
    if(typeof window.ePub!=="function"){status("Рендерер EPUB.js не загрузился. Проверь интернет.");return}
    let opened=null;
    try {
      const items=await list();
      if(items.length>=MAX_BOOKS){status("Достигнут предел 30 EPUB. Удали старую книгу.");return}
      const buffer=await file.arrayBuffer();
      if(!window.VetoEpubGuard?.inspect)throw Error("Модуль проверки EPUB не загрузился");
      window.VetoEpubGuard.inspect(buffer);
      // Hash-based stable ID prevents duplicate imports without sending the book to any server.
      const digest=await crypto.subtle.digest("SHA-256",buffer);
      const id=[...new Uint8Array(digest)].slice(0,16).map(v=>v.toString(16).padStart(2,"0")).join("");
      let title=file.name.replace(/\.epub$/i,""),author="Без автора";
      opened=window.ePub(buffer);
      await opened.ready;
      try {
        const m=await opened.loaded.metadata;
        title=String(m?.title||title).slice(0,160);author=String(m?.creator||author).slice(0,140);
      }catch{}
      await put({id,title,author,added:Date.now(),buffer});
      status("Книга сохранена локально: "+title);
      await renderShelf();await open(id);
    }catch(e){status("Не удалось добавить EPUB: "+e.message)}
    finally{try{opened?.destroy()}catch{}}
  }
  async function renderShelf() {
    const root=$("mediaEpubShelf");root.replaceChildren();
    try{
      const records=(await list()).sort((a,b)=>b.added-a.added);
      if(!records.length){root.append(tag("div","empty","Пока нет EPUB-файлов. Добавь свою книгу — она останется в браузере."));return}
      records.forEach(record=>{
        const card=tag("div","epub-shelf-item");
        const badge=tag("div","epub-shelf-mark","▤");
        const meta=tag("div","epub-shelf-meta");
        meta.append(tag("strong","",record.title),tag("small","",record.author));
        const read=tag("button","chip","Читать");read.type="button";read.onclick=()=>open(record.id);
        const remove=tag("button","chip","Удалить");remove.type="button";
        remove.onclick=async()=>{if(!window.confirm("Удалить EPUB «"+record.title+"» с этого устройства?"))return;await del(record.id);await renderShelf()};
        card.append(badge,meta,read,remove);root.append(card);
      });
    }catch(e){root.append(tag("p","error","Локальная библиотека недоступна: "+e.message))}
  }
  async function open(id) {
    if(typeof window.ePub!=="function"){status("EPUB.js недоступен. Попробуй позднее.");return}
    const record=await fetchBook(id);if(!record)return status("Книга не найдена");
    close();st.currentId=id;
    $("mediaEpubOverlay").classList.remove("hidden");
    document.body.style.overflow="hidden";
    $("mediaEpubTitle").textContent=record.title;
    $("mediaEpubProgress").textContent="Загрузка…";
    $("mediaEpubStage").replaceChildren();
    $("mediaEpubNote").value=safeStore.get("notes:"+id,"");
    setMode(safeStore.get("mode","pure"));
    try {
      const book=window.ePub(record.buffer),rendition=book.renderTo("mediaEpubStage",{
        width:"100%",height:"100%",flow:"paginated",spread:"none",allowScriptedContent:false
      });
      st.book=book;st.rendition=rendition;
      await book.ready;
      const navigation=await book.loaded.navigation;
      st.toc=(navigation?.toc||[]).slice(0,180);
      const menu=$("mediaEpubToc");menu.replaceChildren();
      st.toc.forEach(ch=>{
        const b=tag("button","",ch.label||"Глава");b.type="button";
        b.onclick=()=>{rendition.display(ch.href).catch(err=>$("mediaEpubProgress").textContent=err.message);menu.classList.remove("open")};
        menu.append(b);
      });
      setMode(st.mode);
      const last=safeStore.get("cfi:"+id,null);
      try{await rendition.display(last||undefined)}catch{await rendition.display()}
      rendition.on("relocated",location=>{
        if(location?.start?.cfi){
          safeStore.set("cfi:"+id,location.start.cfi);
          $("mediaEpubProgress").textContent="Место чтения сохранено";
        }
      });
    }catch(e){$("mediaEpubProgress").textContent="Не удалось открыть EPUB: "+e.message}
  }
  document.addEventListener("DOMContentLoaded",()=>{
    if(!$("booksView"))return;
    panel();overlay();renderShelf();
  });
})();