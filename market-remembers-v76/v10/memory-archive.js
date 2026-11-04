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
  }
  return {mount,reorder,getSort:()=>sort,setSort(value){sort=['curated','alias','newest','oldest'].includes(value)?value:'curated';}};
})();
