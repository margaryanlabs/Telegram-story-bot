// Deterministic, explicitly paged owner-Vault retrieval, without a persisted index.
// Keep per-request work bounded; users choose each continuation themselves.
export const VAULT_BATCH_READS=6;
export const VAULT_ROWS_PER_READ=80;
export const VAULT_MAX_PAGE=199;
export const VAULT_MAX_CHAT_ROWS=5000;
export const VAULT_MAX_THREADS=500;
const validChat=v=>/^-?\d{1,22}$/.test(String(v||''));
const finiteCount=v=>Number.isFinite(Number(v))?Math.max(0,Math.floor(Number(v))):0;
const time=v=>{const t=Date.parse(String(v||''));return Number.isFinite(t)?t:0};
export function validVaultPage(value){
  return Number.isInteger(value)&&value>=0&&value<=VAULT_MAX_PAGE;
}
export function planVaultPage(rows=[],page=0){
  if(!validVaultPage(page))throw Object.assign(new Error('Неверная страница архива'),{status:400});
  if(!Array.isArray(rows))throw new Error('Список архива недоступен');
  const candidates=rows.filter(t=>validChat(t?.chatId)&&finiteCount(t?.messageCount)>0)
    .sort((a,b)=>time(b.lastAt)-time(a.lastAt)||
      String(a.chatId).localeCompare(String(b.chatId)));
  const selected=candidates.slice(0,VAULT_MAX_THREADS);
  const totalSlices=selected.reduce((sum,t)=>
    sum+Math.ceil(Math.min(finiteCount(t.messageCount),VAULT_MAX_CHAT_ROWS)/VAULT_ROWS_PER_READ),0);
  const start=page*VAULT_BATCH_READS,end=start+VAULT_BATCH_READS;
  let position=0;
  const tasks=[];
  let wasTruncated=candidates.length>VAULT_MAX_THREADS;
  for(const thread of selected){
    const count=finiteCount(thread.messageCount);
    if(count>VAULT_MAX_CHAT_ROWS)wasTruncated=true;
    const segments=Math.ceil(Math.min(count,VAULT_MAX_CHAT_ROWS)/VAULT_ROWS_PER_READ);
    if(position+segments<=start){position+=segments;continue}
    if(position>=end)break;
    const from=Math.max(0,start-position),to=Math.min(segments,end-position);
    for(let idx=from;idx<to;idx++){
      const offset=idx*VAULT_ROWS_PER_READ;
      tasks.push({thread,offset,limit:Math.min(VAULT_ROWS_PER_READ,Math.min(count,VAULT_MAX_CHAT_ROWS)-offset)});
    }
    position+=segments;
    if(tasks.length>=VAULT_BATCH_READS)break;
  }
  const nextPage=end<totalSlices&&page<VAULT_MAX_PAGE?page+1:null;
  return {tasks,nextPage,
    totalSlices,availableChats:candidates.length,scannedChats:[...new Set(tasks.map(x=>String(x.thread.chatId)))].length,
    truncated:wasTruncated||Boolean(totalSlices>(VAULT_MAX_PAGE+1)*VAULT_BATCH_READS),
    startSegment:start+1,endSegment:Math.min(end,totalSlices),totalPages:Math.ceil(totalSlices/VAULT_BATCH_READS),
    exhausted:nextPage===null};
}
