import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const importerCode=readFileSync(new URL('../public/books-import.js',import.meta.url),'utf8');
function harness(parser=class{}){
  const records=new Map();
  const db={
    objectStoreNames:{contains:()=>false},createObjectStore(){},
    transaction(){
      const tx={};
      const req=(action,input)=>{
        const obj={};
        queueMicrotask(()=>{
          try{obj.result=action(input);obj.onsuccess?.();tx.oncomplete?.();}
          catch(error){obj.error=error;obj.onerror?.();tx.onerror?.();}
        });
        return obj;
      };
      tx.objectStore=()=>({
        get:id=>req(x=>records.get(x),id),
        getAll:()=>req(()=>[...records.values()]),
        put:record=>req(x=>(records.set(x.id,x),x.id),record),
        delete:id=>req(x=>records.delete(x),id)
      });
      return tx;
    }
  };
  const indexedDB={open(){
    const result={result:db};
    queueMicrotask(()=>{result.onupgradeneeded?.();result.onsuccess?.();});
    return result;
  }};
  const window={indexedDB};
  vm.runInNewContext(importerCode,{window,indexedDB,TextDecoder,DOMParser:parser,Blob,DecompressionStream},{timeout:5000});
  return {api:window.VetogramBooksImport,records};
}
function file(name,body){
  const bytes=Buffer.from(body,'utf8');
  return {name,size:bytes.length,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length)};
}
test('offline TXT import, IndexedDB persistence and deletion',async()=>{
  const {api,records}=harness();
  const data=await api.importFile(file('Русская_книга.txt','Много русских слов и один хороший сюжет. '.repeat(9)));
  assert.equal(data.provider,'local');
  assert.equal(data.language,'ru');
  assert.equal(records.size,1);
  const opened=await api.get(data.id);
  assert.match(opened.contents[0],/хороший сюжет/);
  assert.equal((await api.list()).length,1);
  await api.remove(data.id);
  assert.equal((await api.list()).length,0);
});
test('rejects oversized files, unsupported formats and malformed EPUB',async()=>{
  const {api,records}=harness();
  await assert.rejects(api.importFile({name:'oversize.txt',size:15*1024*1024,arrayBuffer:async()=>new ArrayBuffer(0)}),/12 МБ/);
  await assert.rejects(api.importFile(file('test.exe','This is not a readable ebook')),/TXT, FB2 и EPUB/);
  await assert.rejects(api.importFile(file('invalid.epub','Invalid archive that cannot be parsed as a book.')),/ZIP-архивом/);
  await assert.rejects(api.importFile(file('malicious.fb2','<!DOCTYPE x [<!ENTITY x SYSTEM "https://evil.example">]><FictionBook>secret</FictionBook>')),/внешними сущностями/);
  assert.equal(records.size,0);
});

class XmlNode {
  constructor(name,attrs){this.localName=name.split(':').at(-1);this.attributes=attrs;this.children=[];this.parts=[];}
  getAttribute(key){return this.attributes[key]??null;}
  hasAttribute(key){return key in this.attributes;}
  get textContent(){return this.parts.join('')+this.children.map(c=>c.textContent).join('');}
  getElementsByTagName(name){
    return this.children.flatMap(child=>[
      ...(name==='*'||child.localName===name?[child]:[]),
      ...child.getElementsByTagName(name)
    ]);
  }
}
class SimpleDomParser {
  parseFromString(xml){
    const stack=[];let root=null;
    for(const match of String(xml).matchAll(/<[^>]+>|[^<]+/g)){
      const token=match[0];
      if(token.startsWith('<?')||token.startsWith('<!--'))continue;
      if(token.startsWith('</')){stack.pop();continue;}
      if(token.startsWith('<')){
        const name=/^<([\w:.-]+)/.exec(token)?.[1];
        if(!name)continue;
        const attrs={};
        for(const item of token.matchAll(/([\w:.-]+)="([^"]*)"/g))attrs[item[1]]=item[2];
        const element=new XmlNode(name,attrs);
        if(stack.length)stack.at(-1).children.push(element);else root=element;
        if(!token.endsWith('/>'))stack.push(element);
      }else if(stack.length)stack.at(-1).parts.push(token);
    }
    return {documentElement:root,querySelector:()=>null,
      getElementsByTagName:name=>root?.getElementsByTagName(name)||[]};
  }
}
function storedZip(entries){
  const parts=[],central=[];
  let offset=0;
  for(const [name,value] of entries){
    const path=Buffer.from(name),content=Buffer.from(value,'utf8');
    const h=Buffer.alloc(30),c=Buffer.alloc(46);
    h.writeUInt32LE(0x04034b50,0);
    h.writeUInt32LE(content.length,18);h.writeUInt32LE(content.length,22);
    h.writeUInt16LE(path.length,26);
    c.writeUInt32LE(0x02014b50,0);
    c.writeUInt32LE(content.length,20);c.writeUInt32LE(content.length,24);
    c.writeUInt16LE(path.length,28);c.writeUInt32LE(offset,42);
    parts.push(h,path,content);central.push(c,path);
    offset+=h.length+path.length+content.length;
  }
  const directory=Buffer.concat(central),end=Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50,0);
  end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);
  end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
  return Buffer.concat([...parts,directory,end]);
}
test('FB2 extracts Russian title, author and original chapter text',async()=>{
  const {api}=harness(SimpleDomParser);
  const xml='<?xml version="1.0"?><FictionBook><description><title-info>'+
    '<author><first-name>Иван</first-name><last-name>Автор</last-name></author>'+
    '<book-title>Волшебный сад</book-title><lang>ru</lang></title-info></description>'+
    '<body><section><title><p>Глава первая</p></title>'+
    '<p>Здесь начинается первая русская глава с достаточно длинным текстом.</p>'+
    '<p>Второй абзац этой книги сохранён для удобного чтения.</p></section></body></FictionBook>';
  const work=await api.importFile(file('novel.fb2',xml));
  assert.equal(work.title,'Волшебный сад');
  assert.equal(work.authors[0],'Иван Автор');
  const data=await api.get(work.id);
  assert.match(data.contents[0],/Второй абзац/);
  assert.doesNotMatch(data.contents[0],/<section>/);
});
test('EPUB uses ZIP central directory and reads chapters in spine order',async()=>{
  const {api}=harness(SimpleDomParser);
  const zip=storedZip([
    ['META-INF/container.xml','<container><rootfile full-path="OPS/book.opf"/></container>'],
    ['OPS/book.opf','<package><metadata><dc:title>EPUB роман на русском</dc:title>'+
      '<dc:creator>Автор EPUB</dc:creator><dc:language>ru</dc:language></metadata>'+
      '<manifest><item id="a" href="one.xhtml" media-type="application/xhtml+xml"/>'+
      '<item id="b" href="two.xhtml" media-type="application/xhtml+xml"/></manifest>'+
      '<spine><itemref idref="a"/><itemref idref="b"/></spine></package>'],
    ['OPS/one.xhtml','<html><body><h1>Первая глава</h1>'+
      '<p>Читаемый русский текст первой главы достаточно длинный для читалки.</p></body></html>'],
    ['OPS/two.xhtml','<html><body><h1>Вторая глава</h1>'+
      '<p>Продолжение этого увлекательного романа начинается во второй главе.</p></body></html>']
  ]);
  const imported=await api.importFile(file('story.epub',zip));
  assert.equal(imported.format,'epub');
  const record=await api.get(imported.id);
  assert.equal(record.chapters.length,2);
  assert.match(record.contents[0],/Первая глава/);
  assert.match(record.contents[1],/Вторая глава/);
});

test('offline Wikisource edition preserves every chapter in reading order and attribution',async()=>{
  const {api,records}=harness();
  const b={id:593345,provider:'wikisource',wiki:'ru',title:'Американский претендент',authors:['Марк Твен']};
  const chapters=[{title:'Глава I',label:'Глава I'},{title:'Глава II',label:'Глава II'}];
  const texts=['Русский текст первой главы. '.repeat(20),'Русский текст второй главы. '.repeat(20)];
  const imported=await api.saveWikisourceEdition(b,chapters,texts);
  assert.equal(imported.provider,'local');
  assert.equal(imported.licensedSource,'wikisource');
  assert.equal(imported.sourceChapters,2);
  assert.match(imported.sourceUrl,/ru\.wikisource\.org/);
  const saved=await api.get(imported.id);
  assert.deepEqual(Array.from(saved.contents),texts.map(x=>x.trim()));
  assert.equal(saved.chapters[1].label,'Глава II');
  assert.equal(records.size,1);
});
test('offline Wiki edition refuses missing chapters without writing an incomplete book',async()=>{
  const {api,records}=harness();
  const b={id:593345,provider:'wikisource',wiki:'ru',title:'Американский претендент'};
  const chapters=[{title:'Первая глава',label:'Первая глава'},{title:'Вторая глава',label:'Вторая глава'}];
  await assert.rejects(api.saveWikisourceEdition(b,chapters,['Длинный текст. '.repeat(15),'']),/не загрузились/);
  await assert.rejects(api.saveWikisourceEdition(b,chapters,['Длинный текст. '.repeat(15)]),/отсутствуют/);
  await assert.rejects(api.saveWikisourceEdition({...b,wiki:'unknown'},chapters,
    ['Длинный текст. '.repeat(15),'Длинный текст. '.repeat(15)]),/Викитеки/);
  assert.equal(records.size,0);
});
