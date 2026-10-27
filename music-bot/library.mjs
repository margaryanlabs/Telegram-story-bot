/* Vetogram Music private personal-library store.
   Per-user JSON, atomic writes, never contains audio bytes or bot credentials.
   Requires persistent private filesystem on VPS (not Vercel serverless). */
import {mkdir,readFile,rename,unlink,writeFile} from "node:fs/promises";
import {join,resolve} from "node:path";
import {randomBytes} from "node:crypto";

const MAX_TRACKS=300;
const validId=id=>typeof id==="number"&&Number.isSafeInteger(id)&&id>0;
const trim=(v,n)=>String(v??"").replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,n);
function normalizeAudio(audio){
  if(!audio||typeof audio.file_id!=="string"||audio.file_id.length<1||audio.file_id.length>512)return null;
  if(audio.mime_type&&!/^(audio\/mpeg|audio\/mp4|audio\/x-m4a|audio\/m4a)$/i.test(audio.mime_type))return null;
  return {
    file_id:audio.file_id,file_unique_id:trim(audio.file_unique_id,150),
    title:trim(audio.title||audio.file_name?.replace(/\.(mp3|m4a)$/i,"")||"Моя музыка",110),
    performer:trim(audio.performer||"Неизвестный исполнитель",95),
    duration:Number.isSafeInteger(audio.duration)?Math.max(0,Math.min(audio.duration,108000)):0,
    created_at:typeof audio.created_at==="string"&&/^\d{4}-\d\d-\d\dT/.test(audio.created_at)?audio.created_at:new Date().toISOString()
  };
}
export function createMusicStore({directory=process.env.VETOGRAM_MUSIC_STORE_PATH||"./music-bot/data"}={}){
  const base=resolve(directory),locks=new Map();
  const pathFor=id=>{if(!validId(id))throw Error("Invalid user ID");return join(base,String(id)+".json")};
  async function load(userId){
    let raw;
    try{raw=await readFile(pathFor(userId),"utf8")}catch(e){if(e.code==="ENOENT")return[];throw e}
    const decoded=JSON.parse(raw);
    if(!Array.isArray(decoded))throw Error("Invalid library file");
    // Defensive validation: no IDs, endpoints or file paths from untrusted data.
    return decoded.slice(0,MAX_TRACKS).map(normalizeAudio).filter(Boolean);
  }
  async function write(userId,records){
    await mkdir(base,{recursive:true,mode:0o700});
    const name=pathFor(userId),temp=join(base,"."+String(userId)+"-"+randomBytes(8).toString("hex")+".tmp");
    try{
      await writeFile(temp,JSON.stringify(records),{mode:0o600,flag:"wx"});
      await rename(temp,name);
    }finally{await unlink(temp).catch(()=>{})}
  }
  function serialize(userId,work){
    if(!validId(userId))return Promise.reject(Error("Invalid user ID"));
    const prior=locks.get(userId)||Promise.resolve();
    const next=prior.catch(()=>{}).then(work);
    locks.set(userId,next);
    next.finally(()=>{if(locks.get(userId)===next)locks.delete(userId)}).catch(()=>{});
    return next;
  }
  async function add(userId,audio){
    const item=normalizeAudio(audio);
    if(!item)throw Error("Invalid audio");
    return serialize(userId,async()=>{
      const records=await load(userId);
      const match=records.findIndex(x=>(item.file_unique_id&&x.file_unique_id===item.file_unique_id)||x.file_id===item.file_id);
      if(match!==-1){
        // Refresh bot-scoped file_id if Telegram issued a new one.
        records[match]={...records[match],file_id:item.file_id};await write(userId,records);
        return {count:records.length,added:false,track:records[match]}
      }
      const latest=[item,...records].slice(0,MAX_TRACKS);await write(userId,latest);
      return {count:latest.length,added:true,track:item};
    });
  }
  async function list(userId,{offset=0,limit=12}={}){
    if(!validId(userId))throw Error("Invalid user ID");
    const all=await serialize(userId,()=>load(userId));
    const begin=Math.min(Math.max(0,Math.floor(offset)||0),all.length);
    return {total:all.length,tracks:all.slice(begin,begin+Math.min(30,Math.max(1,limit))),offset:begin};
  }
  async function get(userId,index){
    if(!Number.isSafeInteger(index)||index<1||index>MAX_TRACKS)return null;
    const data=await list(userId,{offset:index-1,limit:1});
    return data.tracks[0]||null;
  }
  async function search(userId,term,{limit=20}={}){
    if(!validId(userId))throw Error("Invalid user ID");
    const q=trim(term,70).toLocaleLowerCase();
    if(q.length<2)return[];
    const all=await serialize(userId,()=>load(userId));
    return all.map((track,i)=>({...track,index:i+1}))
      .filter(t=>(t.title+" "+t.performer).toLocaleLowerCase().includes(q))
      .slice(0,Math.min(30,Math.max(1,limit)));
  }
  async function remove(userId,index){
    if(!Number.isSafeInteger(index)||index<1||index>MAX_TRACKS)return false;
    return serialize(userId,async()=>{
      const rows=await load(userId);
      if(index>rows.length)return false;
      rows.splice(index-1,1);await write(userId,rows);return true;
    });
  }
  return Object.freeze({add,list,get,remove,search,directory:base});
}
export {normalizeAudio};
