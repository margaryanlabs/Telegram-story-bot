/* VETOGRAM Music licensed Archive provider.
 * Metadata only. Never copies, downloads, or proxies audio bytes.
 * Only CC0 and CC BY releases; rights still require uploader attribution checks.
 */
const ARCHIVE="https://archive.org";
const LICENSES=Object.freeze({
 cc0:{label:"CC0",url:"http://creativecommons.org/publicdomain/zero/1.0/"},
 by3:{label:"CC BY 3.0",url:"http://creativecommons.org/licenses/by/3.0/"},
 by4:{label:"CC BY 4.0",url:"http://creativecommons.org/licenses/by/4.0/"}
});
const MAX_PAGE=300,ROWS=4,MAX_AUDIO_PER_ITEM=12;
const cache=new Map(),users=new Map(),TTL=240000;
function clean(x,max=160){return String(x??"").replace(/[\u0000-\u001f\u007f]/g," ").replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim().slice(0,max)}
function licenseType(link){
 let uri;try{uri=new URL(String(link).trim())}catch{return""}
 if(!["http:","https:"].includes(uri.protocol)||!["creativecommons.org","www.creativecommons.org"].includes(uri.hostname))return"";
 const p=uri.pathname.replace(/\/+$/,"")+"/";
 if(p==="/publicdomain/zero/1.0/")return"CC0";
 const m=p.match(/^\/licenses\/by\/(2\.0|2\.5|3\.0|4\.0)\/$/);
 return m?"CC BY "+m[1]:"";
}
function safeId(id){const x=String(id||"");return /^[A-Za-z0-9._-]{1,130}$/.test(x)?x:""}
function validFilename(n){return typeof n==="string"&&n.length>0&&n.length<280&&!n.includes("\\")&&!n.startsWith("/")&&!n.includes("../")&&!/[\u0000-\u001f]/.test(n)&&/\.mp3$/i.test(n)}
function fileTrack(f,meta,id,lic){
 if(!f||!validFilename(f.name)||!/^\d+$/.test(String(f.size||""))||Number(f.size)<20000||Number(f.size)>52428800)return null;
 if(f.private||f.is_dark||f.viruscheck==="failed")return null;
 const title=clean(f.title||f.name.replace(/\.mp3$/i,"").replace(/[_-]+/g," "),150);
 const artist=clean(f.artist||f.creator||meta.creator||"Independent artist",95);
 if(!title||!artist)return null;
 const file=encodeURIComponent(f.name).replace(/%2F/g,"/");
 return {id:"archive:"+id+":"+String(f.name).slice(0,120),source:"archive",provider:"Internet Archive",title,artist,
 artwork:ARCHIVE+"/services/img/"+encodeURIComponent(id),
 stream:ARCHIVE+"/download/"+encodeURIComponent(id)+"/"+file,
 permalink:ARCHIVE+"/details/"+encodeURIComponent(id),
 license:lic,license_url:String(meta.licenseurl),playable:true};
}
export function mapArchiveItem(data){
 const meta=data?.metadata||{};
 const id=safeId(meta.identifier);if(!id||meta.mediatype!=="audio")return [];
 const lic=licenseType(Array.isArray(meta.licenseurl)?meta.licenseurl[0]:meta.licenseurl);
 if(!lic)return[];
 const files=Array.isArray(data.files)?data.files:[];
 // Prefer original encodings; avoid two MP3 variants of a single source.
 return files.filter(f=>f.source==="original"&&/\.mp3$/i.test(String(f.name||"")))
   .concat(files.filter(f=>f.source==="derivative"&&/\.mp3$/i.test(String(f.name||""))))
   .slice(0,60).map(f=>fileTrack(f,meta,id,lic)).filter(Boolean).slice(0,MAX_AUDIO_PER_ITEM);
}
export function archiveSearchUrl(group,page){
 if(!Object.hasOwn(LICENSES,group)||!Number.isInteger(page)||page<1||page>MAX_PAGE)throw Error("Invalid archive search");
 const q="collection:netlabels AND mediatype:audio AND licenseurl:\""+LICENSES[group].url+"\"";
 const p=new URLSearchParams({q,rows:String(ROWS),page:String(page),output:"json"});
 for(const field of ["identifier","title","licenseurl"])p.append("fl[]",field);
 return ARCHIVE+"/advancedsearch.php?"+p.toString();
}
async function upstream(url,signal,bytes=3000000){
 const r=await fetch(url,{signal,headers:{Accept:"application/json","User-Agent":"VetogramMusic/1.0 (licensed metadata only)"}});
 if(!r.ok)throw Error("Archive temporarily unavailable ("+r.status+")");
 if(Number(r.headers.get("content-length")||0)>bytes)throw Error("Archive response exceeded limit");
 const body=await r.text();if(body.length>bytes)throw Error("Archive response exceeded limit");
 return JSON.parse(body);
}
function response(res,code,value){
 res.statusCode=code;res.setHeader("Content-Type","application/json; charset=utf-8");
 res.setHeader("X-Content-Type-Options","nosniff");
 res.setHeader("Cache-Control",code===200?"public, s-maxage=120, stale-while-revalidate=240":"no-store");
 res.end(JSON.stringify(value));
}
function limited(req){
 const key=String(req.headers?.["x-real-ip"]||req.socket?.remoteAddress||"unknown").slice(0,96);
 const now=Date.now(),record=users.get(key)||{start:now,count:0};
 if(now-record.start>60000){record.start=now;record.count=0}
 users.set(key,record);record.count++;
 if(users.size>1000)for(const [k,v] of users)if(now-v.start>120000)users.delete(k);
 return record.count<=20;
}
export default async function handler(req,res){
 if(req.method!=="GET"){response(res,405,{ok:false,error:"GET only"});return}
 if(!limited(req)){response(res,429,{ok:false,error:"Слишком много запросов. Повтори через минуту."});return}
 let url;try{url=new URL(req.url||"/api/music-archive","https://vetogram-music-live.vercel.app")}catch{response(res,400,{ok:false,error:"Invalid request"});return}
 const group=url.searchParams.get("license")||"cc0",page=Number(url.searchParams.get("page")||"1");
 if(!Object.hasOwn(LICENSES,group)||!Number.isInteger(page)||page<1||page>MAX_PAGE){response(res,400,{ok:false,error:"Неподдерживаемая лицензия или страница"});return}
 const key=group+":"+page,now=Date.now(),old=cache.get(key);
 if(old&&now-old.t<TTL){response(res,200,old.data);return}
 const ctl=new AbortController(),timeout=setTimeout(()=>ctl.abort(),14500);
 try{
  const search=await upstream(archiveSearchUrl(group,page),ctl.signal,1500000);
  const rows=Array.isArray(search?.response?.docs)?search.response.docs:[];
  const candidateIds=rows.map(x=>safeId(x.identifier)).filter(Boolean);
  const records=await Promise.allSettled(candidateIds.map(id=>upstream(ARCHIVE+"/metadata/"+encodeURIComponent(id),ctl.signal,3500000)));
  const tracks=records.flatMap(r=>r.status==="fulfilled"?mapArchiveItem(r.value):[]);
  const data={ok:true,provider:"Internet Archive",license:group,page,releaseCount:Number(search?.response?.numFound||0),
    items:tracks.slice(0,ROWS*MAX_AUDIO_PER_ITEM),hasMore:page*ROWS<Number(search?.response?.numFound||0),
    notice:"Only CC0 / CC BY metadata. Audio served by archive.org; verify attribution and embedded rights before commercial redistribution."};
  cache.set(key,{t:Date.now(),data});if(cache.size>60)cache.delete(cache.keys().next().value);
  response(res,200,data);
 }catch(err){response(res,err?.name==="AbortError"?504:502,{ok:false,error:"Музыкальный архив временно не отвечает. Попробуй другую подборку."})}
 finally{clearTimeout(timeout)}
}
