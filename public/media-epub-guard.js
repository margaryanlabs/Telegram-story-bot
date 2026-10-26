/* EPUB ZIP preflight · rejects expansion bombs, traversal paths, encrypted/ZIP64 archives.
   Reads central directory metadata only. No decompression or file upload.
   It is a resource guard, not a substitute for sandboxing epub.js content. */
((root)=>{
  "use strict";
  const MAX_ENTRIES=2000,MAX_UNCOMPRESSED=120*1024*1024,MAX_ENTRY=35*1024*1024;
  const error=(why)=>{throw new Error("EPUB отклонён: "+why)};
  function inspect(buffer){
    if(!(buffer instanceof ArrayBuffer) || buffer.byteLength<22 || buffer.byteLength>35*1048576)
      error("недопустимый размер файла");
    const view=new DataView(buffer),bytes=new Uint8Array(buffer),len=buffer.byteLength;
    // EOCD can be followed by at most 65535 bytes of ZIP comment.
    let eocd=-1;
    for(let i=len-22;i>=Math.max(0,len-65557);--i){
      if(view.getUint32(i,true)===0x06054b50){eocd=i;break}
    }
    if(eocd<0)error("нет конца центрального каталога ZIP");
    const rd16=p=>view.getUint16(p,true),rd32=p=>view.getUint32(p,true);
    const disk=rd16(eocd+4),cdDisk=rd16(eocd+6);
    const here=rd16(eocd+8),total=rd16(eocd+10),size=rd32(eocd+12),start=rd32(eocd+16),comment=rd16(eocd+20);
    if(eocd+22+comment>len)error("повреждён ZIP-комментарий");
    if(disk!==0||cdDisk!==0||here!==total)error("многотомные ZIP не поддерживаются");
    if(total<1||total>MAX_ENTRIES||total===65535)error("слишком много элементов");
    if(size===0xffffffff||start===0xffffffff)error("ZIP64 не поддерживается");
    if(start+size>eocd||start+size>len)error("центральный каталог повреждён");
    let at=start,count=0,expanded=0,hasMime=false;
    const decoder=new TextDecoder("utf-8",{fatal:false}),seen=new Set();
    while(at<start+size){
      if(at+46>len||rd32(at)!==0x02014b50)error("запись каталога повреждена");
      const flags=rd16(at+8),method=rd16(at+10),compressed=rd32(at+20),raw=rd32(at+24);
      const n=rd16(at+28),extra=rd16(at+30),note=rd16(at+32),local=rd32(at+42);
      const next=at+46+n+extra+note;
      if(!n||next>start+size||next>len)error("некорректное имя файла");
      if((flags&1)!==0)error("зашифрованные EPUB/ZIP не поддерживаются");
      if(method!==0&&method!==8)error("неподдерживаемое сжатие ZIP");
      if(raw===0xffffffff||compressed===0xffffffff||local===0xffffffff)error("ZIP64 не поддерживается");
      if(raw>MAX_ENTRY)error("один элемент слишком большой");
      expanded+=raw;
      if(expanded>MAX_UNCOMPRESSED)error("суммарный размер после распаковки превышает 120 МБ");
      if(compressed===0&&raw>0 || compressed>0&&raw/compressed>250)error("подозрительная степень сжатия");
      const name=decoder.decode(bytes.subarray(at+46,at+46+n)).replace(/\\/g,"/");
      if(name.startsWith("/")||name.split("/").some(p=>p===".."||p===".")||/^[A-Za-z]:/.test(name))
        error("небезопасный путь в ZIP");
      if(seen.has(name))error("повторяющиеся имена внутри ZIP");
      seen.add(name);
      if(name==="mimetype")hasMime=true;
      if(local+30>len||rd32(local)!==0x04034b50)error("битая ссылка на файл ZIP");
      count++;if(count>MAX_ENTRIES)error("слишком много элементов");
      at=next;
    }
    if(at!==start+size||count!==total)error("несоответствие центрального каталога");
    if(!hasMime)error("отсутствует обязательный файл mimetype");
    return Object.freeze({entries:count,uncompressedBytes:expanded,compressedBytes:len});
  }
  root.VetoEpubGuard=Object.freeze({inspect});
})(typeof window==="object"?window:globalThis);
