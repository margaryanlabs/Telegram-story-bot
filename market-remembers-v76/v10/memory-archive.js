window.MarketV10 = window.MarketV10 || {};
window.MarketV10.archive = (() => {
  let sort='curated',api;
  function mount(context) {
    api=context;
    const grid=document.getElementById('archiveGrid');if(!grid)return;
    document.getElementById('drawer').classList.add('v10-archive');
    const toolbar=document.querySelector('.v79-archive-toolbar');
    if(!document.getElementById('v10ArchiveSort')) {
      const row=document.createElement('div');row.className='v10-archive-sort';
      const label=document.createElement('label');label.htmlFor='v10ArchiveSort';label.textContent='Порядок записей';
      const select=document.createElement('select');select.id='v10ArchiveSort';select.className='field-select';
      for(const [value,text] of [['curated','По коллекции'],['alias','По имени'],['newest','Новые личные записи'],['oldest','Ранние личные записи']]){
        const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option);
      }
      select.value=sort;select.onchange=()=>{sort=select.value;reorder();api.syncArchive(sort);};
      row.append(label,select);toolbar.append(row);
    }
    const heading=document.querySelector('.v79-archive-header h2');
    if(heading)heading.innerHTML='Архив <em>памяти.</em>';
    ensureAtlas();
    reorder();
  }
  function reorder() {
    const grid=document.getElementById('archiveGrid');if(!grid||!api)return;
    // The original search/filter function supplies the live, eligible records.
    const cards=[...grid.querySelectorAll('.v79-archive-record')];
    const entries=cards.map(button=>({button,record:api.stories.find(record=>String(record.id)===button.dataset.storyId)})).filter(item=>item.record);
    entries.sort((a,b)=>{
      if(sort==='alias')return a.record.alias.localeCompare(b.record.alias,'ru');
      if(sort==='newest'||sort==='oldest'){
        if(a.record.local!==b.record.local)return a.record.local?-1:1;
        const delta=(Date.parse(a.record.createdAt)||0)-(Date.parse(b.record.createdAt)||0);
        return sort==='newest'?-delta:delta;
      }
      return api.stories.indexOf(a.record)-api.stories.indexOf(b.record);
    });
    for(const {button,record} of entries){
      const row=document.createElement('div');row.className='v10-archive-row';
      const locate=document.createElement('button');locate.type='button';locate.className='v10-locate-star';
      locate.textContent='✧';locate.setAttribute('aria-label','Найти звезду '+record.alias+' во вселенной');
      locate.title='Найти звезду во вселенной';locate.onclick=()=>api.locate(record);
      row.append(button,locate);grid.append(row);
    }
    grid.querySelectorAll('.v10-archive-row').forEach(row=>{if(!row.querySelector('.v79-archive-record'))row.remove();});
    updateAtlas();
  }
  const topics=[
    {id:'Risk',title:'Риск',x:23,y:24},
    {id:'Discipline',title:'Дисциплина',x:77,y:24},
    {id:'FOMO',title:'FOMO',x:23,y:77},
    {id:'Patience',title:'Терпение',x:77,y:77}
  ];
  function ensureAtlas(){
    if(document.getElementById('v115ArchiveAtlas'))return;
    const index=document.querySelector('.v79-archive-index');
    if(!index)return;
    const section=document.createElement('section');section.id='v115ArchiveAtlas';
    section.className='v115-atlas';section.setAttribute('aria-label','Карта тем архива');
    const eyebrow=document.createElement('div');eyebrow.className='v115-atlas-eyebrow';
    eyebrow.textContent='MEMORY ATLAS / ТЕМАТИЧЕСКАЯ КАРТА';
    const header=document.createElement('div');header.className='v115-atlas-head';
    const h=document.createElement('h3');h.textContent='Четыре созвездия решений.';
    const description=document.createElement('p');
    description.textContent='Выбери тему, чтобы исследовать соответствующие записи. Линии показывают категории, а не знакомства людей.';
    header.append(h,description);
    const map=document.createElement('div');map.className='v115-atlas-map';
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('viewBox','0 0 100 100');svg.setAttribute('preserveAspectRatio','none');
    svg.setAttribute('aria-hidden','true');svg.classList.add('v115-atlas-lines');
    const ns='http://www.w3.org/2000/svg';
    for(const topic of topics){
      const path=document.createElementNS(ns,'line');
      path.setAttribute('x1','50');path.setAttribute('y1','50');
      path.setAttribute('x2',String(topic.x));path.setAttribute('y2',String(topic.y));
      svg.append(path);
    }
    const center=document.createElement('span');center.className='v115-atlas-center';
    center.textContent='✧';center.setAttribute('aria-hidden','true');
    map.append(svg,center);
    for(const topic of topics){
      const node=document.createElement('button');node.type='button';
      node.className='v115-topic';node.dataset.topic=topic.id;
      node.style.setProperty('--x',String(topic.x)+'%');
      node.style.setProperty('--y',String(topic.y)+'%');
      node.setAttribute('aria-label','Показать истории по теме '+topic.title);
      const sparkle=document.createElement('span');sparkle.className='v115-topic-symbol';
      sparkle.textContent='✦';sparkle.setAttribute('aria-hidden','true');
      const label=document.createElement('span');label.className='v115-topic-name';label.textContent=topic.title;
      const count=document.createElement('strong');count.className='v115-topic-count';count.textContent='0';
      node.append(sparkle,label,count);
      node.onclick=()=>document.querySelector('#archiveFilters button[data-archive-filter="'+topic.id+'"]')?.click();
      map.append(node);
    }
    const actions=document.createElement('div');actions.className='v115-atlas-actions';
    const all=document.createElement('button');all.type='button';all.className='v115-atlas-all';
    all.textContent='Все истории';all.onclick=()=>document.querySelector('#archiveFilters button[data-archive-filter="All"]')?.click();
    const surprise=document.createElement('button');surprise.type='button';
    surprise.className='v115-atlas-surprise';surprise.id='v115Surprise';
    surprise.textContent='Случайная история ↗';
    surprise.onclick=()=>{
      const cards=[...document.querySelectorAll('#archiveGrid .v79-archive-record')];
      if(!cards.length)return;
      cards[Math.floor(Math.random()*cards.length)].click();
    };
    const status=document.createElement('p');status.className='v115-atlas-status';status.id='v115AtlasStatus';
    status.setAttribute('aria-live','off');
    status.textContent='Выбери тему или открой случайную историю из результатов.';
    actions.append(all,surprise);
    section.append(eyebrow,header,map,actions,status);
    index.parentNode.insertBefore(section,index);
  }
  function updateAtlas(){
    const atlas=document.getElementById('v115ArchiveAtlas');
    if(!atlas||!api)return;
    // Uses exactly the original archive matcher; counts reflect the current text search.
    const q=document.getElementById('archiveSearch')?.value||'';
    const matching=api.archiveSelect('All',q);
    const selected=api.getArchive().theme;
    for(const topic of topics){
      const node=atlas.querySelector('[data-topic="'+topic.id+'"]');
      if(!node)continue;
      const count=matching.filter(record=>record.category===topic.id).length;
      node.querySelector('.v115-topic-count').textContent=String(count);
      node.setAttribute('aria-pressed',String(selected===topic.id));
    }
    const all=atlas.querySelector('.v115-atlas-all');
    all?.setAttribute('aria-pressed',String(selected==='All'));
    const cards=document.querySelectorAll('#archiveGrid .v79-archive-record');
    const surprise=document.getElementById('v115Surprise');
    if(surprise)surprise.disabled=cards.length===0;
    const status=document.getElementById('v115AtlasStatus');
    if(status)status.textContent=matching.length+' записей по запросу. Выбранная тема: '+
       (topics.find(topic=>topic.id===selected)?.title||'Все истории')+
       '. Кнопка случайной истории выбирает только из текущего списка.';
  }
  return {mount,reorder,getSort:()=>sort,setSort(value){sort=['curated','alias','newest','oldest'].includes(value)?value:'curated';}};
})();
