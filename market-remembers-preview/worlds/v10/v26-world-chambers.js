/* MARKET REMEMBERS V26 — FOUR FUNCTIONAL WORLDS
 * Browser-local interactive labs; do not claim that guilds, discussion
 * participants, or market trades exist on a remote community/backend.
 */
(()=>{
'use strict';
const app=document.getElementById('app'),hub=document.getElementById('v23Cosmos');
if(!app||!hub||document.getElementById('v26Chamber'))return;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const configs={
 decisions:{name:'DECISIONS',number:'03',tag:'THE DECISION LAB',
  summary:'Запиши гипотезу до результата, сроки, условия отмены и уверенность. Так решения становятся исследуемыми, а не переписанными задним числом.'},
 agora:{name:'AGORA',number:'04',tag:'THE ARGUMENT LAB',
  summary:'Идеи проверяются встречными аргументами. Выбери финансовый вопрос, изучи две позиции и сформулируй собственное возражение.'},
 mirror:{name:'MIRROR',number:'05',tag:'THE REFLECTION LAB',
  summary:'Тренируй способность замечать когнитивные ошибки. Сохраняй собственные наблюдения, сравнивай их с ранее записанными гипотезами.'},
 guilds:{name:'GUILDS',number:'06',tag:'THE RESEARCH LAB',
  summary:'Выбирай направления финансового исследования и выполняй небольшие задания. Это личная лаборатория, а не вымышленное сообщество.'}
};
const debates=[
 ['Что важнее при кризисе: наличная ликвидность или качество активов?',
  'Ликвидность дает возможность пережить принудительные продажи и выполнить обязательства.',
  'При долгом горизонте и отсутствии риска маржин-колла качество активов может иметь более высокое значение.'],
 ['Можно ли по прошлым кризисам предсказать следующий?',
  'Исторические механизмы помогают замечать уязвимости и строить стресс-сценарии.',
  'Идентичные комбинации причин не повторяются; избыточная уверенность в аналогиях опасна.'],
 ['Должна ли финансовая гипотеза фиксироваться до сделки?',
  'Запись до результата уменьшает эффект ретроспективного знания и облегчает проверку решений.',
  'Слишком жесткие правила могут мешать адаптации к новой информации; гипотеза должна обновляться прозрачно.']
];
const tracks=[
 ['RISK ENGINEERING','Составь собственную карту рисков',
  ['Назови три независимых источника риска','Опиши сценарий потери ликвидности','Сформулируй условия остановки']],
 ['MARKET HISTORY','Исследуй механизмы прошлых кризисов',
  ['Сравни причинные факторы 1907 и 2008','Отдели факты от интерпретаций','Запиши один риск ошибочной аналогии']],
 ['BEHAVIORAL FINANCE','Проверь качество собственного мышления',
  ['Вспомни решение с эффектом FOMO','Найди независимый контраргумент','Запиши, что изменило бы твое мнение']]
];
const store={
 read(key){try{const v=JSON.parse(localStorage.getItem('mr-v26-'+key)||'[]');return Array.isArray(v)?v.slice(0,24):[];}catch{return[]}},
 write(key,arr){try{localStorage.setItem('mr-v26-'+key,JSON.stringify(arr.slice(0,24)));return true;}catch{return false}}
};
const chamber=document.createElement('section');
chamber.id='v26Chamber';chamber.className='v26-chamber';chamber.hidden=true;
chamber.setAttribute('aria-label','Лаборатория финансового мира');
chamber.innerHTML=[
 '<header class="v26-chamber-header"><div class="v26-chamber-brand"><img class="v27-veto-mark" src="v10/v27-veto-mark.svg" alt="" width="32" height="32"><span><strong>VETO</strong><small>MARKET REMEMBERS / FINANCIAL UNIVERSE</small></span></div><button type="button" class="v26-close" id="v26Back" aria-label="Вернуться к солнечной системе">← ВО ВСЕЛЕННУЮ</button></header>',
 '<div class="v26-chamber-content"><span class="v26-chamber-eyebrow" id="v26Tag"></span><h2 id="v26Title"></h2><p class="v26-chamber-description" id="v26Description"></p>',
 '<div class="v26-sheet" id="v26Tools"></div><p class="v26-note">Личный эксперимент: данные остаются только в этом браузере. Общих аккаунтов и публичных обсуждений пока нет.</p><p id="v26Status" class="v26-status" role="status" aria-live="polite"></p></div>'
].join('');
app.append(chamber);
const el=id=>document.getElementById(id);
let current='',opening=false,timer=0,lastFocus=null;
function nodes(key){return store.read(key)}
function safe(tag,text,className){
 const e=document.createElement(tag);e.textContent=text;if(className)e.className=className;return e;
}
function showRecords(key,container,format){
 if(!container)return;
 container.replaceChildren();
 const records=nodes(key);
 if(!records.length){container.append(safe('p','Здесь пока нет личных записей.','v26-note'));return;}
 for(const record of records.slice(0,6))container.append(safe('div',format(record),'v26-record'));
}
function saveRecord(key,record){
 const previous=nodes(key);previous.unshift({...record,at:new Date().toISOString()});
 const ok=store.write(key,previous);
 el('v26Status').textContent=ok?'Сохранено только на этом устройстве.':'Локальное хранилище недоступно. Попробуй сохранить текст вручную.';
 return ok;
}
function decisionLab(container){
 container.innerHTML=[
 '<h3>DECISION PASSPORT</h3><p>Заполни паспорт гипотезы до того, как узнаешь результат. Это журнал мышления, не торговый сигнал.</p>',
 '<form class="v26-form" id="v26DecisionForm">',
 '<label>Название гипотезы<input name="title" maxlength="120" required placeholder="Что именно я предполагаю?"></label>',
 '<div class="v26-grid-two"><label>Горизонт<select name="horizon"><option>7 дней</option><option>30 дней</option><option>90 дней</option><option>1 год</option></select></label>',
 '<label>Уверенность, %<input name="confidence" type="number" min="1" max="99" value="55" required></label></div>',
 '<label>На чём основано мнение?<textarea name="thesis" maxlength="700" required placeholder="Факты, допущения, неизвестное"></textarea></label>',
 '<label>Что опровергнет гипотезу?<textarea name="invalidation" maxlength="500" required placeholder="Условие пересмотра или выхода"></textarea></label>',
 '<button class="v26-action" type="submit">ЗАФИКСИРОВАТЬ РЕШЕНИЕ ↗</button></form>',
 '<div class="v26-records" id="v26DecisionRecords"></div>'
 ].join('');
 const form=el('v26DecisionForm');
 form.addEventListener('submit',e=>{
  e.preventDefault();const f=new FormData(form),title=String(f.get('title')||'').trim(),thesis=String(f.get('thesis')||'').trim(),invalidation=String(f.get('invalidation')||'').trim();
  if(!title||!thesis||!invalidation)return;
  const record={title:title.slice(0,120),thesis:thesis.slice(0,700),invalidation:invalidation.slice(0,500),horizon:String(f.get('horizon')||''),confidence:Number(f.get('confidence'))};
  if(saveRecord('decisions',record)){form.reset();showRecords('decisions',el('v26DecisionRecords'),d=>d.title+' · '+d.horizon+' · '+d.confidence+'% · '+d.at.slice(0,10));}
 });
 showRecords('decisions',el('v26DecisionRecords'),d=>d.title+' · '+d.horizon+' · '+d.confidence+'% · '+d.at.slice(0,10));
}
function debateLab(container){
 container.innerHTML=[
 '<h3>THE ARGUMENT ROOM</h3><p>Выбери дискуссионный вопрос. Здесь нет вымышленных собеседников: обе позиции представлены как исследовательские аргументы.</p>',
 '<div class="v26-choice" id="v26Topics"></div>',
 '<div class="v26-record" id="v26Arguments"></div>',
 '<form class="v26-form" id="v26DebateForm"><label>Твой аргумент или возражение<textarea name="response" maxlength="600" required placeholder="Какой факт убедил бы тебя изменить позицию?"></textarea></label>',
 '<button class="v26-action" type="submit">СОХРАНИТЬ МОЮ ПОЗИЦИЮ ↗</button></form>',
 '<div class="v26-records" id="v26DebateRecords"></div>'
 ].join('');
 let chosen=0;
 const buttons=el('v26Topics'),box=el('v26Arguments');
 function select(index){
  chosen=index;
  buttons.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.topic)===index)));
  box.replaceChildren();
  box.append(safe('strong',debates[index][0]));
  box.append(safe('p','Тезис: '+debates[index][1]));
  box.append(safe('p','Контраргумент: '+debates[index][2]));
 }
 for(let i=0;i<debates.length;i++){
  const button=safe('button','ВОПРОС '+String(i+1).padStart(2,'0'));button.type='button';button.dataset.topic=String(i);
  button.addEventListener('click',()=>select(i));buttons.append(button);
 }
 select(0);
 el('v26DebateForm').addEventListener('submit',e=>{
  e.preventDefault();const field=e.currentTarget.elements.response,text=field.value.trim();if(!text)return;
  if(saveRecord('debates',{topic:debates[chosen][0],response:text.slice(0,600)})){field.value='';showRecords('debates',el('v26DebateRecords'),r=>r.topic+' — '+r.response);}
 });
 showRecords('debates',el('v26DebateRecords'),r=>r.topic+' — '+r.response);
}
function mirrorLab(container){
 container.innerHTML=[
 '<h3>THE COGNITIVE MIRROR</h3><p id="v26PastDecisions"></p>',
 '<form class="v26-form" id="v26MirrorForm">',
 '<label>Какой тип ошибки заметил?<select name="bias"><option>FOMO — страх упустить</option><option>Confirmation bias — подтверждение своего мнения</option><option>Overconfidence — избыточная уверенность</option><option>Loss aversion — неприятие потерь</option><option>Hindsight bias — знание задним числом</option></select></label>',
 '<label>Что запустило эту реакцию?<textarea name="trigger" maxlength="450" required placeholder="Событие, давление, информация"></textarea></label>',
 '<label>Какой альтернативный вывод возможен?<textarea name="alternative" maxlength="450" required placeholder="Сильнейший контраргумент"></textarea></label>',
 '<button class="v26-action" type="submit">ЗАПОМНИТЬ УРОК ↗</button></form>',
 '<div class="v26-records" id="v26MirrorRecords"></div>'
 ].join('');
 const count=nodes('decisions').length;
 el('v26PastDecisions').textContent='Локально зафиксированных Decision Passport: '+count+'. Сравнивай ошибки с фактическими записями, а не с памятью задним числом.';
 const form=el('v26MirrorForm');
 form.addEventListener('submit',e=>{
  e.preventDefault();const f=new FormData(form),trigger=String(f.get('trigger')||'').trim(),alternative=String(f.get('alternative')||'').trim();
  if(!trigger||!alternative)return;
  if(saveRecord('reflection',{bias:String(f.get('bias')),trigger:trigger.slice(0,450),alternative:alternative.slice(0,450)})){
   form.reset();showRecords('reflection',el('v26MirrorRecords'),r=>r.bias+' · '+r.alternative);
  }
 });
 showRecords('reflection',el('v26MirrorRecords'),r=>r.bias+' · '+r.alternative);
}
function guildLab(container){
 container.innerHTML=[
 '<h3>RESEARCH MISSIONS</h3><p>Вместо вымышленных участников — три настоящих направления личного исследования. Каждое состоит из конкретных шагов.</p>',
 '<div class="v26-choice" id="v26TrackButtons"></div><div class="v26-records" id="v26TrackTasks"></div>',
 '<button class="v26-action" type="button" id="v26TrackSave">ЗАПОМНИТЬ НАПРАВЛЕНИЕ ↗</button>',
 '<div class="v26-records" id="v26TrackRecords"></div>'
 ].join('');
 let chosen=0;const holder=el('v26TrackButtons');
 function select(idx){
  chosen=idx;holder.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.track)===idx)));
  const h=el('v26TrackTasks');h.replaceChildren();
  h.append(safe('div',tracks[idx][1],'v26-record'));
  tracks[idx][2].forEach((step,i)=>h.append(safe('div',String(i+1)+'. '+step,'v26-record')));
 }
 tracks.forEach((track,i)=>{
  const b=safe('button',track[0]);b.dataset.track=String(i);b.type='button';b.addEventListener('click',()=>select(i));holder.append(b);
 });select(0);
 el('v26TrackSave').addEventListener('click',()=>{
  if(saveRecord('missions',{track:tracks[chosen][0],mission:tracks[chosen][1]})){
   showRecords('missions',el('v26TrackRecords'),r=>r.track+' — '+r.mission);
  }
 });
 showRecords('missions',el('v26TrackRecords'),r=>r.track+' — '+r.mission);
}
function renderContent(id){
 const config=configs[id];if(!config)return;
 chamber.dataset.world=id;
 el('v26Tag').textContent='WORLD '+config.number+' / '+config.tag;
 el('v26Title').textContent=config.name;
 el('v26Description').textContent=config.summary;
 el('v26Status').textContent='';
 const target=el('v26Tools');
 if(id==='decisions')decisionLab(target);
 if(id==='agora')debateLab(target);
 if(id==='mirror')mirrorLab(target);
 if(id==='guilds')guildLab(target);
}
function open(id){
 if(!configs[id]||opening||!chamber.hidden)return;
 opening=true;current=id;lastFocus=document.activeElement;
 window.MarketFourPlanets?.zoom(id);
 hub.classList.add('v26-room-active');
 renderContent(id);
 timer=setTimeout(()=>{
  chamber.hidden=false;
  requestAnimationFrame(()=>chamber.classList.add('is-open'));
  el('v26Back').focus({preventScroll:true});
  opening=false;
 },reduced?15:740);
}
function close(){
 if(timer){clearTimeout(timer);timer=0;}
 chamber.classList.remove('is-open');
 chamber.hidden=true;
 hub.classList.remove('v26-room-active');
 window.MarketFourPlanets?.reset();
 const id=current;current='';opening=false;
 const target=hub.querySelector('[data-v23-world="'+id+'"]');
 if(window.MarketNativeUniverse?.active)target?.focus({preventScroll:true});
 else lastFocus?.focus?.({preventScroll:true});
}
el('v26Back').addEventListener('click',close);
chamber.addEventListener('keydown',e=>{
 if(e.key==='Escape'){e.preventDefault();close();}
 if(e.key==='Tab'){
  const candidates=[...chamber.querySelectorAll('button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled])')].filter(n=>n.offsetParent!==null);
  if(candidates.length<2)return;
  if(e.shiftKey&&document.activeElement===candidates[0]){e.preventDefault();candidates.at(-1).focus();}
  else if(!e.shiftKey&&document.activeElement===candidates.at(-1)){e.preventDefault();candidates[0].focus();}
 }
});
window.MarketWorldChambers=Object.freeze({open,close,get active(){return !chamber.hidden;},get world(){return current;},version:'26.0.0'});
})();