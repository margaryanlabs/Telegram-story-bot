/* VETOGRAM Books — personal library. Local-only EPUB, FB2, TXT importer.
 * Untrusted book content is converted to text, never injected as active HTML.
 * Files and converted texts never leave this device.
 */
(() => {
  'use strict';
  const DB_NAME='vetogram-books-personal';
  const STORE='works';
  const MAX_FILE=12*1024*1024;
  const MAX_TOTAL_TEXT=5_000_000;
  const MAX_ENTRY=4_000_000;
  const MAX_CHAPTERS=160;
  let databasePromise=null;

  function database(){
    if(!('indexedDB' in window))return Promise.reject(new Error('Хранилище книг недоступно в браузере'));
    if(databasePromise)return databasePromise;
    databasePromise=new Promise((resolve,reject)=>{
      const req=indexedDB.open(DB_NAME,1);
      req.onupgradeneeded=()=>{
        if(!req.result.objectStoreNames.contains(STORE))
          req.result.createObjectStore(STORE,{keyPath:'id'});
      };
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(new Error('Не удалось открыть библиотеку на устройстве'));
      req.onblocked=()=>reject(new Error('Хранилище занято другой вкладкой'));
    }).catch(error=>{databasePromise=null;throw error;});
    return databasePromise;
  }
  async function transact(mode,action){
    const db=await database();
    return new Promise((resolve,reject)=>{
      let result;
      try{
        const tx=db.transaction(STORE,mode);
        const request=action(tx.objectStore(STORE));
        if(request){
          request.onsuccess=()=>{result=request.result;};
          request.onerror=()=>reject(new Error('Ошибка чтения локальной библиотеки'));
        }
        tx.oncomplete=()=>resolve(result);
        tx.onerror=()=>reject(new Error('Не удалось сохранить книгу. Освободите место на устройстве.'));
        tx.onabort=()=>reject(new Error('Операция сохранения книги отменена.'));
      }catch{reject(new Error('Хранилище книги недоступно'));}
    });
  }
  const get=id=>transact('readonly',store=>store.get(Number(id)));
  const list=()=>transact('readonly',store=>store.getAll()).then(items=>items.map(x=>x.book));
  const remove=id=>transact('readwrite',store=>store.delete(Number(id)));
  const save=record=>transact('readwrite',store=>store.put(record));

  function xmlDocument(value,mime='application/xml'){
    if(/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(value.slice(0,4096)))
      throw new Error('XML с внешними сущностями не поддерживается');
    const document=new DOMParser().parseFromString(value,mime);
    if(document.querySelector('parsererror'))
      throw new Error('Файл книги содержит повреждённый XML');
    return document;
  }
  function nodes(root,name){
    return Array.from(root?.getElementsByTagName('*')||[])
      .filter(element=>element.localName?.toLowerCase()===name.toLowerCase());
  }
  function first(root,name){return nodes(root,name)[0]||null;}
  function short(value,max=180){return String(value||'').replace(/\s+/g,' ').trim().slice(0,max);}
  function filenameTitle(file){
    return short(file.name.replace(/\.(txt|fb2|epub)$/i,'').replace(/[_-]+/g,' '),180)||'Моя книга';
  }
  function bodyText(root){
    if(!root)return '';
    const blockNames=new Set(['p','v','subtitle','h1','h2','h3','h4','h5','h6','li','blockquote','epigraph','cite']);
    const excluded=new Set(['script','style','nav','metadata','binary']);
    const out=[];
    const walk=element=>{
      if(out.length>65000)return;
      const tag=element.localName?.toLowerCase()||'';
      if(excluded.has(tag))return;
      if(blockNames.has(tag)){
        // Preserve inline author styling as plain Unicode text.
        const value=short(element.textContent||'',100000);
        if(value)out.push(value);
        return;
      }
      for(const child of element.children||[])walk(child);
    };
    walk(root);
    return out.join('\n\n').trim().slice(0,MAX_TOTAL_TEXT);
  }
  function guessLanguage(value){
    if((String(value).match(/[\u0530-\u058f]/g)||[]).length>14)return 'hy';
    if((String(value).match(/[А-Яа-яЁё]/g)||[]).length>20)return 'ru';
    return 'en';
  }
  function decodeBook(buffer){
    const head=new TextDecoder('ascii').decode(new Uint8Array(buffer,0,Math.min(buffer.byteLength,300)));
    const encoding=/encoding\s*=\s*["']([^"']+)/i.exec(head)?.[1]||'utf-8';
    let content;
    try{content=new TextDecoder(encoding).decode(buffer);}
    catch{content=new TextDecoder('utf-8').decode(buffer);}
    if((content.match(/\uFFFD/g)||[]).length>Math.max(20,content.length*.004)){
      const alternative=new TextDecoder('windows-1251').decode(buffer);
      if((alternative.match(/\uFFFD/g)||[]).length<(content.match(/\uFFFD/g)||[]).length)content=alternative;
    }
    return content;
  }
  function fromTxt(text,file){
    const value=String(text||'').replace(/\r\n?/g,'\n').replace(/\n{4,}/g,'\n\n\n').trim();
    if(value.length<30)throw new Error('Книга слишком короткая или файл повреждён');
    if(value.length>MAX_TOTAL_TEXT)throw new Error('Слишком длинная книга для мобильной читалки');
    return {title:filenameTitle(file),authors:[],language:guessLanguage(value),contents:[value],chapters:[]};
  }
  function fromFb2(text,file){
    const doc=xmlDocument(text);
    if(doc.documentElement?.localName!=='FictionBook')
      throw new Error('Это не FictionBook (FB2)');
    const info=first(doc,'title-info');
    const title=short(first(info,'book-title')?.textContent,240)||filenameTitle(file);
    const authors=nodes(info,'author').slice(0,4).map(element=>{
      const family=short(first(element,'last-name')?.textContent);
      const given=short(first(element,'first-name')?.textContent);
      return [given,family].filter(Boolean).join(' ')||short(first(element,'nickname')?.textContent);
    }).filter(Boolean);
    const language=short(first(info,'lang')?.textContent,12);
    const body=nodes(doc,'body').find(el=>!el.hasAttribute('name'))||first(doc,'body');
    const value=bodyText(body);
    if(value.length<30)throw new Error('В FB2 нет читаемого текста');
    if(value.length>=MAX_TOTAL_TEXT)throw new Error('FB2 слишком большой для этого устройства');
    return {title,authors,language:language||guessLanguage(value),contents:[value],chapters:[]};
  }
  const pathNormalize=(base,relative)=>{
    const value=decodeURIComponent(String(relative||'').split(/[?#]/)[0]);
    if(!value||value.startsWith('/')||value.includes('\\')||/^[a-z]+:/i.test(value))
      throw new Error('Недопустимый путь внутри EPUB');
    const stack=String(base||'').split('/').filter(Boolean);
    for(const part of value.split('/')){
      if(!part||part==='.')continue;
      if(part==='..'){if(!stack.length)throw new Error('Повреждённая структура EPUB');stack.pop();}
      else stack.push(part);
    }
    return stack.join('/');
  };
  function zipDirectory(buffer){
    const view=new DataView(buffer);
    const bytes=new Uint8Array(buffer);
    const signature=0x06054b50;
    let end=-1;
    for(let p=buffer.byteLength-22;p>=Math.max(0,buffer.byteLength-65557);p--){
      if(view.getUint32(p,true)===signature){end=p;break;}
    }
    if(end<0)throw new Error('EPUB не является ZIP-архивом');
    const number=view.getUint16(end+10,true);
    const start=view.getUint32(end+16,true);
    if(number>600||start>=buffer.byteLength)throw new Error('EPUB слишком большой или использует ZIP64');
    const entries=new Map();
    let p=start;
    for(let n=0;n<number;n++){
      if(p+46>buffer.byteLength||view.getUint32(p,true)!==0x02014b50)
        throw new Error('Повреждённый каталог EPUB');
      const flag=view.getUint16(p+8,true);
      const method=view.getUint16(p+10,true);
      const compressed=view.getUint32(p+20,true);
      const uncompressed=view.getUint32(p+24,true);
      const nameLength=view.getUint16(p+28,true);
      const extra=view.getUint16(p+30,true);
      const comment=view.getUint16(p+32,true);
      const localOffset=view.getUint32(p+42,true);
      if(p+46+nameLength+extra+comment>buffer.byteLength)
        throw new Error('Неправильные метаданные EPUB');
      const name=new TextDecoder().decode(bytes.slice(p+46,p+46+nameLength));
      if((flag&1)!==0)throw new Error('Зашифрованный EPUB не поддерживается');
      if(!name.endsWith('/') && compressed<=MAX_ENTRY && uncompressed<=MAX_ENTRY && (method===0||method===8))
        entries.set(name,{method,compressed,uncompressed,localOffset});
      p+=46+nameLength+extra+comment;
    }
    return entries;
  }
  async function zipRead(buffer,entries,name){
    const entry=entries.get(name);
    if(!entry)throw new Error('Отсутствует глава EPUB: '+short(name,60));
    const view=new DataView(buffer),offset=entry.localOffset;
    if(offset+30>buffer.byteLength||view.getUint32(offset,true)!==0x04034b50)
      throw new Error('Повреждённый файл внутри EPUB');
    const nameLength=view.getUint16(offset+26,true),extraLength=view.getUint16(offset+28,true);
    const start=offset+30+nameLength+extraLength;
    const end=start+entry.compressed;
    if(end>buffer.byteLength)throw new Error('Неполная глава EPUB');
    const data=new Uint8Array(buffer.slice(start,end));
    if(entry.method===0)return new TextDecoder().decode(data);
    if(typeof DecompressionStream!=='function')
      throw new Error('На этом устройстве пока нет встроенной поддержки EPUB');
    let stream;
    try{stream=new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));}
    catch{throw new Error('Версия браузера не поддерживает EPUB. Используйте FB2 или TXT');}
    const reader=stream.getReader();
    const parts=[];let size=0;
    try{
      while(true){
        const {done,value}=await reader.read();if(done)break;
        size+=value.byteLength;
        if(size>MAX_ENTRY){await reader.cancel();throw new Error('EPUB содержит слишком большую главу');}
        parts.push(value);
      }
    }finally{try{reader.releaseLock();}catch{}}
    const output=new Uint8Array(size);let position=0;
    for(const part of parts){output.set(part,position);position+=part.length;}
    return new TextDecoder().decode(output);
  }
  async function fromEpub(buffer,file){
    const zip=zipDirectory(buffer);
    const container=xmlDocument(await zipRead(buffer,zip,'META-INF/container.xml'));
    const rootfile=first(container,'rootfile');
    const opfName=rootfile?.getAttribute('full-path');
    if(!opfName||!zip.has(opfName))throw new Error('В EPUB нет описания книги');
    const opf=xmlDocument(await zipRead(buffer,zip,opfName));
    const metadata=first(opf,'metadata');
    const title=short(first(metadata,'title')?.textContent,240)||filenameTitle(file);
    const authors=nodes(metadata,'creator').slice(0,4).map(el=>short(el.textContent)).filter(Boolean);
    const language=short(first(metadata,'language')?.textContent,12)||'ru';
    const directory=opfName.includes('/')?opfName.slice(0,opfName.lastIndexOf('/')):'';
    const resources=new Map();
    for(const item of nodes(first(opf,'manifest'),'item')){
      const id=item.getAttribute('id');
      const href=item.getAttribute('href');
      if(id&&href)resources.set(id,{path:pathNormalize(directory,href),type:item.getAttribute('media-type')||''});
    }
    const contents=[],chapters=[];
    const spine=nodes(first(opf,'spine'),'itemref');
    // Never truncate silently: a partial imported EPUB must not be labeled a
    // complete book. The user can choose a smaller volume instead.
    if(spine.length>MAX_CHAPTERS)
      throw new Error('EPUB содержит более '+MAX_CHAPTERS+' разделов. Нужен отдельный том: импорт неполного файла запрещён.');
    let total=0;
    for(const link of spine){
      const item=resources.get(link.getAttribute('idref'));
      if(!item||!zip.has(item.path)||!/xhtml|html/i.test(item.type))continue;
      const chapterHtml=await zipRead(buffer,zip,item.path);
      const chapterXml=xmlDocument(chapterHtml,'application/xhtml+xml');
      const body=first(chapterXml,'body');
      const text=bodyText(body);
      if(text.length<12)continue;
      total+=text.length;
      if(total>MAX_TOTAL_TEXT)throw new Error('EPUB слишком большой для хранения на этом устройстве');
      const titleElement=first(body,'h1')||first(body,'h2')||first(body,'h3');
      const label=short(titleElement?.textContent,100)||'Раздел '+(chapters.length+1);
      contents.push(text);
      chapters.push({title:label,label});
    }
    if(!contents.length)throw new Error('В EPUB не найден читаемый текст');
    return {title,authors,language,contents,chapters};
  }
  async function importFile(file){
    if(!file||!file.name)throw new Error('Сначала выберите файл книги');
    const ext=file.name.split('.').pop().toLowerCase();
    if(!['fb2','txt','epub'].includes(ext))throw new Error('Поддерживаются только TXT, FB2 и EPUB');
    if(file.size>MAX_FILE)throw new Error('Файл слишком большой (максимум 12 МБ)');
    if(file.size<25)throw new Error('Пустой или повреждённый файл');
    const buffer=await file.arrayBuffer();
    const parsed=ext==='epub'?await fromEpub(buffer,file)
      :ext==='fb2'?fromFb2(decodeBook(buffer),file):fromTxt(decodeBook(buffer),file);
    const id=Math.floor(Date.now()*1000+Math.random()*999);
    const book={
      id,provider:'local',key:'local-'+id,localOnly:true,
      title:parsed.title,authors:parsed.authors,language:parsed.language,cover:'',
      summary:'Личная книга · сохранена только на устройстве',
      source:'Локальный файл · '+ext.toUpperCase(),readable:true,
      sourceUrl:'',format:ext
    };
    await save({id,book,chapters:parsed.chapters,contents:parsed.contents,at:Date.now()});
    return book;
  }
  /** Preserve all accessible Wikisource chapters together as a reader-owned offline
   * copy. It is never called for licensed catalog metadata or protected providers.
   */
  async function saveWikisourceEdition(sourceBook,chapters,contents){
    if(sourceBook?.provider!=='wikisource'||!['ru','hy'].includes(sourceBook.wiki)
      ||!Number.isSafeInteger(Number(sourceBook.id))||Number(sourceBook.id)<1)
      throw new Error('Офлайн-сборка доступна только для текстов Викитеки');
    if(!Array.isArray(chapters)||!Array.isArray(contents)||!chapters.length
      ||chapters.length!==contents.length||chapters.length>MAX_CHAPTERS)
      throw new Error('Части книги отсутствуют или превышен лимит устройства');
    let total=0;
    const safeChapters=[],safeContents=[];
    for(let i=0;i<chapters.length;i++){
      const title=short(chapters[i]?.label||chapters[i]?.title,120);
      const value=String(contents[i]||'').trim();
      if(!title||value.length<60)throw new Error('Некоторые главы не загрузились. Офлайн-копия не создана');
      total+=value.length;
      if(total>MAX_TOTAL_TEXT)throw new Error('Книга слишком большая для памяти мобильной читалки');
      safeChapters.push({title,label:title});
      safeContents.push(value);
    }
    const id=Math.floor(Date.now()*1000+Math.random()*999);
    const originalUrl='https://'+sourceBook.wiki+'.wikisource.org/wiki/'+
      encodeURIComponent(String(sourceBook.title||'').replace(/ /g,'_')).replace(/%2F/gi,'/');
    const book={
      id,provider:'local',key:'local-'+id,localOnly:true,
      title:short(sourceBook.title,200)||'Книга из Викитеки',
      authors:Array.isArray(sourceBook.authors)?sourceBook.authors.slice(0,5).map(x=>short(x,100)):[],
      language:sourceBook.wiki,cover:'',readable:true,format:'wikisource',
      source:'Викитека · офлайн-сборка доступных глав',
      sourceUrl:originalUrl,licensedSource:'wikisource',
      sourceChapters:safeChapters.length,
      rightsNotice:'Текст и перевод принадлежат авторам/редакторам источника; проверьте его лицензию и правовой статус.'
    };
    await save({id,book,chapters:safeChapters,contents:safeContents,at:Date.now()});
    return book;
  }
  window.VetogramBooksImport=Object.freeze({importFile,saveWikisourceEdition,get,list,remove});
})();
