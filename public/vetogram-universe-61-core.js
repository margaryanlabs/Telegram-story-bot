/* VETOGRAM 6.1: small, dependency-free personal media index.
 * Never indexes Telegram chats, tokens, file bytes or other owners' storage. */
(function (host) {
  'use strict';
  const text = (value, max = 150) => String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f<>]/g,' ').trim().slice(0,max);
  const url = value => {
    try {const u = new URL(String(value)); return u.protocol === 'https:' ? u.href : '';} catch {return '';}
  };
  const number = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
  const read = (store, key, fallback) => {
    try {const data = JSON.parse(store.getItem(key) || 'null'); return data === null ? fallback : data;}
    catch {return fallback;}
  };
  function collect(store, scope) {
    const items = [];
    const add = value => {
      if (!value || !['music','cinema','books','link'].includes(value.kind)) return;
      const id = text(value.id, 220), title = text(value.title), subtitle = text(value.subtitle, 110);
      if (!id || !title) return;
      items.push({kind:value.kind,id,title,subtitle,
        at:number(value.at,0,4102444800000), progress:number(value.progress,0,1),
        href:value.kind === 'link' ? url(value.href) : '',
        source:text(value.source,24),description:text(value.description,40)});
    };
    const runtimeMusic=read(store,'vetogram-v61-music:'+scope,[]);
    if(Array.isArray(runtimeMusic))runtimeMusic.slice(0,250).forEach(add);
    const savedMusic = read(store,'vetogram-music-v1:'+scope,{});
    if (Array.isArray(savedMusic.liked)) savedMusic.liked.slice(0,250).forEach(item => add({
      kind:'music',id:item.id,title:item.title,subtitle:item.artist || 'Музыка',source:'liked'
    }));
    const booksRoot='vetogram-books-v1:'+scope;
    const bookProgress=read(store,booksRoot+':progress',{});
    if (bookProgress && typeof bookProgress==='object' && !Array.isArray(bookProgress))
      Object.entries(bookProgress).slice(0,350).forEach(([key,b]) => {
        if (!b || !b.title) return;
        add({kind:'books',id:key,title:b.title,subtitle:Array.isArray(b.authors)?b.authors.join(', '):'Книга',
          at:b.at,progress:b.workFraction ?? b.fraction,source:'progress'});
      });
    const bookSaved=read(store,booksRoot+':saved',{});
    if (bookSaved && typeof bookSaved==='object' && !Array.isArray(bookSaved))
      Object.entries(bookSaved).slice(0,350).forEach(([key,b]) => {
        if(b && b.title)add({kind:'books',id:key,title:b.title,subtitle:Array.isArray(b.authors)?b.authors.join(', '):'Книга',source:'saved'});
      });
    const cinemaIndex=read(store,'vetogram-v61-cinema:'+scope,[]);
    if(Array.isArray(cinemaIndex))cinemaIndex.slice(0,120).forEach(add);
    const cinemaLibrary=read(store,'vetogram.cinema.library.v1:'+scope,{});
    const cinemaProgress=cinemaLibrary && typeof cinemaLibrary==='object' ? cinemaLibrary.progress||{} : {};
    const recent=read(store,'vetogram-v61-recent:'+scope,[]);
    if(Array.isArray(recent)) recent.slice(0,30).forEach(item=>{
      const p=item?.kind==='cinema'?cinemaProgress?.[item.id]:null;
      add(p&&p.d?{...item,at:Math.max(Number(p.at)||0,Number(item.at)||0),progress:number(p.t/p.d,0,1)}:item);
    });
    const ownLinks=read(store,'vetogram-v61-links:'+scope,[]);
    if(Array.isArray(ownLinks))ownLinks.slice(0,75).forEach(link=>{
      if(url(link?.href))add({...link,kind:'link',source:'saved'});
    });
    const lookup = new Map();
    for (const item of items) {
      const key=item.kind+':'+item.id;
      const prev=lookup.get(key);
      if(!prev || item.at>prev.at) lookup.set(key,{...prev,...item,source:['saved','liked','progress'].includes(prev?.source)?prev.source:item.source});
    }
    return [...lookup.values()].sort((a,b)=>b.at-a.at||a.title.localeCompare(b.title,'ru')).slice(0,1200);
  }
  const search=(items,query,kind='all')=>{
    const terms=text(query,100).toLocaleLowerCase().split(/\s+/).filter(Boolean);
    return items.filter(x => (kind==='all'||x.kind===kind) && terms.every(w=>
      (x.title+' '+x.subtitle).toLocaleLowerCase().includes(w)));
  };
  const latest=items=>items.filter(x=>x.at>0&&['books','cinema','music'].includes(x.kind)).sort((a,b)=>b.at-a.at).slice(0,4);
  host.VetogramUniverse61Core=Object.freeze({collect,search,latest,text,url,read});
})(typeof window !== 'undefined' ? window : globalThis);
