/* THE MARKET REMEMBERS — Local Founder Studio. No backend, payment, or published profiles. */
(() => {
  'use strict';
  const STORIES_KEY = 'market-remembers-demo-local-stories-v1';
  const CHECKS_KEY = 'market-remembers-local-challenge-v1';
  const $ = id => document.getElementById(id);
  const pad = n => String(n).padStart(6,'0');
  const limit = (x,max) => typeof x === 'string' ? x.slice(0,max) : '';
  const read = (key,fallback) => { try { const x=JSON.parse(localStorage.getItem(key)||'null'); return x==null?fallback:x; } catch{return fallback;} };
  const stories = () => {const x=read(STORIES_KEY,[]);return Array.isArray(x)?x.filter(s=>s&&s.local===true&&Number.isSafeInteger(s.id)&&s.id>=100001).slice(-80):[];};
  const checkins = () => {const x=read(CHECKS_KEY,{});return x&&typeof x==='object'&&!Array.isArray(x)?x:{};};
  const dateKey = d => [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
  const localDay = d => new Date(d.getFullYear(),d.getMonth(),d.getDate());
  const diffDays = (a,b) => Math.round((Date.UTC(b.getFullYear(),b.getMonth(),b.getDate()) - Date.UTC(a.getFullYear(),a.getMonth(),a.getDate()))/86400000);
  const addDays = (a,n) => new Date(a.getFullYear(),a.getMonth(),a.getDate()+n);
  const text = (id,v) => {const el=$(id);if(el)el.textContent=v;};
  function render(){
    const s=stories().at(-1), empty=$('legacyEmpty'), active=$('legacyActive');
    empty.hidden=!!s;active.hidden=!s;
    if(!s)return;
    const started=s.createdAt && Number.isFinite(Date.parse(s.createdAt))?new Date(s.createdAt):new Date();
    const start=localDay(started),today=localDay(new Date()),elapsed=diffDays(start,today),todayKey=dateKey(today);
    const all=checkins(), history=all[String(s.id)]&&typeof all[String(s.id)]==='object'&&!Array.isArray(all[String(s.id)])?all[String(s.id)]:{};
    const kept=Object.values(history).filter(x=>x==='kept').length;
    const missed=Object.values(history).filter(x=>x==='missed').length;
    text('legacyId','LOCAL STAR · #'+pad(s.id));text('legacyAlias',limit(s.alias,32)||'TRADER');
    text('legacyQuote','“'+limit(s.quote,260)+'”');text('legacyRule',limit(s.rule,140)||'Правило пока не записано');
    text('legacyCounter',kept+' / 30 KEPT');
    const tags=$('legacyTags');tags.replaceChildren();
    [limit(s.market,20),limit(s.category,20),'DEVICE ONLY'].forEach(t=>{const node=document.createElement('span');node.textContent=t;tags.append(node);});
    const ended=elapsed>=30;
    text('legacyToday',ended?'30 дней завершены. Соблюдал: '+kept+'; не получилось: '+missed+'. Это личные записи, не проверенные результаты.':elapsed<0?'Проверь часы устройства: дата записи в будущем.':history[todayKey]==='kept'?'Сегодня: правило соблюдено.':history[todayKey]==='missed'?'Сегодня: не получилось. Можно честно исправить отметку.':'День '+(elapsed+1)+' из 30. Можно отметить сегодняшнее решение.');
    for(const [id,status] of [['legacyKept','kept'],['legacyMissed','missed']]){
      const button=$(id);button.disabled=ended||elapsed<0;
      button.classList.toggle('is-selected',history[todayKey]===status);
      button.setAttribute('aria-pressed',String(history[todayKey]===status));
    }
    const grid=$('legacyDays');grid.replaceChildren();
    for(let i=0;i<30;i++){
      const day=addDays(start,i), key=dateKey(day), val=history[key];
      const cell=document.createElement('span');cell.className='legacy-day'+(val==='kept'?' kept':val==='missed'?' missed':'')+(i===elapsed?' is-today':'')+(i>elapsed?' is-future':'');
      cell.textContent=val==='kept'?'✓':val==='missed'?'×':String(i+1);
      cell.title='День '+(i+1)+': '+key+' — '+(val==='kept'?'соблюдено':val==='missed'?'не получилось':'нет отметки');
      cell.setAttribute('aria-label',cell.title);grid.append(cell);
    }
    const capsule=limit(s.capsule,360), unlocked=Date.now()>=started.getTime()+30*86400000;
    const button=$('legacyCapsuleOpen');button.hidden=!capsule||!unlocked;button.disabled=false;button.textContent='Открыть послание ✧';
    text('legacyCapsule',!capsule?'Ты не оставил послания.':unlocked?'Твои 30 дней прошли. Ты можешь открыть своё сообщение.':'Капсула откроется примерно '+new Date(started.getTime()+30*86400000).toLocaleDateString('ru-RU')+'.');
    button.onclick=()=>{text('legacyCapsule',capsule);button.disabled=true;button.textContent='Послание открыто';};
  }
  function mark(status){
    const s=stories().at(-1);if(!s)return;
    const started=s.createdAt&&Number.isFinite(Date.parse(s.createdAt))?new Date(s.createdAt):new Date();
    const today=new Date(),elapsed=diffDays(started,today);if(elapsed<0||elapsed>=30)return;
    const all=checkins(),id=String(s.id),history=all[id]&&typeof all[id]==='object'&&!Array.isArray(all[id])?all[id]:{};
    history[dateKey(today)]=status;all[id]=history;
    try{localStorage.setItem(CHECKS_KEY,JSON.stringify(all));render();}
    catch{text('legacyToday','Браузер запретил сохранение. Проверь разрешения локального хранилища.');}
  }
  async function share(){
    const s=stories().at(-1);if(!s)return;
    const value='THE MARKET REMEMBERS / PERSONAL DEMO\n@'+limit(s.alias,32)+'\n“'+limit(s.quote,260)+'”\nМоё правило: '+limit(s.rule,140)+'\nПрофиль локальный, не опубликован. #TheMarketRemembers';
    try{await navigator.clipboard.writeText(value);text('legacyToday','История скопирована. Публичной ссылки пока нет.');}
    catch{window.prompt('Скопируй свою историю:',value);}
  }
  function exportData(){
    const list=stories(),ids=new Set(list.map(s=>String(s.id))),history=Object.fromEntries(Object.entries(checkins()).filter(([k])=>ids.has(k)));
    const obj={format:'market-remembers-local-export-v1',notPublished:true,createdAt:new Date().toISOString(),stories:list,checkins:history};
    const blob=new Blob([JSON.stringify(obj,null,2)],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download='market-remembers-my-data.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
  }
  function erase(){
    if(!window.confirm('Удалить все локальные истории, правила и отметки на этом устройстве? Отменить нельзя.'))return;
    try{localStorage.removeItem(STORIES_KEY);localStorage.removeItem(CHECKS_KEY);window.location.reload();}
    catch{window.alert('Браузер не дал удалить данные.');}
  }
  $('createLegacy').addEventListener('click',()=>$('joinDialog').showModal());
  $('legacyKept').addEventListener('click',()=>mark('kept'));
  $('legacyMissed').addEventListener('click',()=>mark('missed'));
  $('legacyShare').addEventListener('click',share);
  $('legacyExport').addEventListener('click',exportData);
  $('legacyDelete').addEventListener('click',erase);
  window.addEventListener('market:story-added',()=>{render();$('my-legacy').scrollIntoView({behavior:'smooth',block:'start'});});
  render();
})();
