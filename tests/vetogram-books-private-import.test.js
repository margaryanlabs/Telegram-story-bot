import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const importerCode=readFileSync(new URL('../public/books-import.js',import.meta.url),'utf8');
function harness(){
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
  vm.runInNewContext(importerCode,{window,indexedDB,TextDecoder,DOMParser:class{},Blob,DecompressionStream},{timeout:5000});
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
