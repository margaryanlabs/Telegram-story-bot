(() => {
  'use strict';
  // Minimal encrypted local metadata preview, NOT an offline message archive.
  // A successful signed server verification for the current Telegram owner is
  // required before load(). Entries expire after 15 minutes.
  // Non-extractable CryptoKey limits accidental plain-text at rest; malicious
  // same-origin script or an unlocked device is outside this protection.
  const DB='veto-chat-preview-v1',TTL=15*60*1000,MAX=60;
  const validOwner=id=>/^[1-9][0-9]{0,18}$/.test(String(id||''));
  const subtle=globalThis.crypto?.subtle;
  let openPromise=null;
  const invalidation=new Map();
  function openDb(){
    if(!globalThis.indexedDB||!subtle)return Promise.reject(Error('LOCAL_CACHE_UNAVAILABLE'));
    if(openPromise)return openPromise;
    openPromise=new Promise((resolve,reject)=>{
      const req=indexedDB.open(DB,1);
      req.onupgradeneeded=()=>{
        const db=req.result;
        if(!db.objectStoreNames.contains('snapshots'))db.createObjectStore('snapshots');
        if(!db.objectStoreNames.contains('keys'))db.createObjectStore('keys');
      };
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error||Error('LOCAL_CACHE_UNAVAILABLE'));
      req.onblocked=()=>reject(Error('LOCAL_CACHE_BLOCKED'));
    }).catch(error=>{openPromise=null;throw error;});
    return openPromise;
  }
  async function txOp(db,store,mode,key,value){
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(store,mode);
      const operation=mode==='readonly'?tx.objectStore(store).get(key)
        :tx.objectStore(store).put(value,key);
      operation.onsuccess=()=>resolve(operation.result);
      operation.onerror=()=>reject(operation.error||Error('CACHE_IO'));
      tx.onabort=()=>reject(tx.error||Error('CACHE_ABORT'));
    });
  }
  async function ownerKey(db,id,create){
    let key=await txOp(db,'keys','readonly','owner:'+id);
    if(!key&&create){
      key=await subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
      await txOp(db,'keys','readwrite','owner:'+id,key);
    }
    return key;
  }
  function clean(rows){
    if(!Array.isArray(rows))return [];
    return rows.slice(0,MAX).filter(row=>/^-?\d{1,22}$/.test(String(row?.id||'')))
      .map(row=>({
        id:String(row.id),title:String(row.title||'').slice(0,100),
        type:['private','bot','group','channel','saved','copy'].includes(row.type)?row.type:'other',
        date:typeof row.date==='string'?row.date.slice(0,32):null,
        unreadCount:Math.min(99999,Math.max(0,Number(row.unreadCount)||0)),
        pinned:row.pinned===true,archived:row.archived===true,
        verified:row.verified===true,savedCopy:row.savedCopy===true,
        archiveOnly:row.archiveOnly===true,
        savedCount:Math.min(99999,Math.max(0,Number(row.savedCount)||0)),
        deletedCount:Math.min(99999,Math.max(0,Number(row.deletedCount)||0)),
        // Deliberately omitted: text, preview, last message, inbox, sender,
        // media, session, login code, raw username and Telegram authorization.
      }));
  }
  async function save(ownerId,rows){
    const id=String(ownerId);
    if(!validOwner(id)||!subtle)return false;
    const epoch=invalidation.get(id)||0;
    try{
      const db=await openDb();
      const key=await ownerKey(db,id,true);
      if(epoch!==(invalidation.get(id)||0))return false;
      const savedAt=Date.now();
      const iv=crypto.getRandomValues(new Uint8Array(12));
      const payload=JSON.stringify({v:1,savedAt,rows:clean(rows)});
      const cipher=await subtle.encrypt({
        name:'AES-GCM',iv,additionalData:new TextEncoder().encode('veto-chat-owner:'+id),
      },key,new TextEncoder().encode(payload));
      if(epoch!==(invalidation.get(id)||0))return false;
      await txOp(db,'snapshots','readwrite','owner:'+id,{
        v:1,savedAt,iv:Array.from(iv),cipher:Array.from(new Uint8Array(cipher)),
      });
      if(epoch!==(invalidation.get(id)||0)){
        await clear(id);
        return false;
      }
      return true;
    }catch{return false;}
  }
  async function load(ownerId){
    const id=String(ownerId);
    if(!validOwner(id)||!subtle)return null;
    try{
      const db=await openDb();
      const entry=await txOp(db,'snapshots','readonly','owner:'+id);
      if(!entry)return null;
      if(entry.v!==1||Date.now()-entry.savedAt>TTL||entry.savedAt>Date.now()+60000){
        // Expiry is physical deletion, not just hiding stale metadata.
        await clear(id);
        return null;
      }
      const key=await ownerKey(db,id,false);
      if(!key)return null;
      const plain=await subtle.decrypt({
        name:'AES-GCM',iv:new Uint8Array(entry.iv),
        additionalData:new TextEncoder().encode('veto-chat-owner:'+id),
      },key,new Uint8Array(entry.cipher));
      const data=JSON.parse(new TextDecoder().decode(plain));
      if(data.v!==1||Math.abs(data.savedAt-entry.savedAt)>1)return null;
      return {rows:clean(data.rows),savedAt:data.savedAt};
    }catch{return null;}
  }
  async function clear(ownerId){
    const id=String(ownerId);
    if(!validOwner(id))return;
    invalidation.set(id,(invalidation.get(id)||0)+1);
    try{
      const db=await openDb();
      await new Promise((resolve,reject)=>{
        const tx=db.transaction(['snapshots','keys'],'readwrite');
        tx.objectStore('snapshots').delete('owner:'+id);
        tx.objectStore('keys').delete('owner:'+id);
        tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
      });
    }catch{}
  }
  window.VetoChatsSnapshot=Object.freeze({load,save,clear,MAX,TTL});
})();
