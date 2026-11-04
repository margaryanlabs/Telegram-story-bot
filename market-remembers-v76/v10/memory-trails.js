/* Market Remembers V11.6 — Memory Trails.
 * In-memory exploration until the visitor explicitly saves a route.
 * Only curated (non-local) story IDs may be persisted on this origin.
 * No network requests, inferred social relations or personal story text.
 */
window.MarketV10 = window.MarketV10 || {};
window.MarketV10.trails = (() => {
  const KEY='tmr:v116:saved-routes:1';
  const MAX_STEPS=7,MAX_ROUTES=4;
  const idsOf=stories=>new Map(stories.map(record=>[String(record.id),record]));
  const safeId=value=>{
    const id=String(value??'');
    return id.length>0&&id.length<=128&&!/[<>\u0000-\u001f]/.test(id)?id:'';
  };
  const shareable=record=>!!record&&!record.local&&
    ['fictional','editorial','legend'].includes(record.type)&&!!safeId(record.id);
  function createModel(storage){
    let visited=[];
    let saved=[];
    let sequence=0;
    try{
      const parsed=JSON.parse(storage?.getItem(KEY)||'null');
      if(parsed?.version===1&&Array.isArray(parsed.routes)){
        saved=parsed.routes.slice(0,MAX_ROUTES).filter(route=>
          route&&Array.isArray(route.ids)&&route.ids.length>=2&&route.ids.length<=MAX_STEPS
        ).map(route=>({
          id:safeId(route.id),
          ids:route.ids.map(safeId).filter(Boolean)
        })).filter(route=>route.id&&route.ids.length>=2);
      }
    }catch{/* inaccessible or stale storage is not an error and never uploads data */}
    function persist(next){
      try{
        if(!storage?.setItem)return false;
        storage.setItem(KEY,JSON.stringify({version:1,routes:next}));
        saved=next;
        return true;
      }catch{return false}
    }
    return {
      visit(record){
        const id=safeId(record?.id);if(!id)return;
        if(visited.at(-1)===id)return;
        visited.push(id);
        if(visited.length>MAX_STEPS)visited=visited.slice(-MAX_STEPS);
      },
      viewed(stories){
        const catalog=idsOf(stories);
        return visited.map(id=>catalog.get(id)).filter(Boolean);
      },
      reset(record){visited=[];this.visit(record);},
      saved(stories){
        const catalog=idsOf(stories);
        return saved.map(route=>({
          id:route.id,
          records:route.ids.map(id=>catalog.get(id))
        })).filter(route=>route.records.length>=2&&route.records.every(shareable));
      },
      save(stories){
        const catalog=idsOf(stories);
        if(visited.length<2)return {ok:false,reason:'Сначала исследуй хотя бы две звезды.'};
        const records=visited.map(id=>catalog.get(id));
        if(records.some(record=>!shareable(record)))
          return {ok:false,reason:'Маршрут с личной записью нельзя сохранять в этом режиме.'};
        if(saved.some(route=>route.ids.join('|')===visited.join('|')))
          return {ok:true,duplicate:true};
        const route={id:String(Date.now())+'-'+String(++sequence),ids:visited.slice()};
        const next=[route,...saved].slice(0,MAX_ROUTES);
        return persist(next)?{ok:true,duplicate:false}:
          {ok:false,reason:'Сохранение в браузере недоступно.'};
      },
      remove(id){
        const next=saved.filter(route=>route.id!==id);
        return next.length<saved.length&&persist(next);
      }
    };
  }
  let store;
  try{store=window.localStorage}catch{store=null}
  const model=createModel(store);
  const $=(id)=>document.getElementById(id);
  const label=record=>String(record.alias||'Звезда').slice(0,90);
  const theme=record=>window.MarketV10.data.themes[record.category]||String(record.category||'Опыт');
  function node(tag,cls,text){
    const el=document.createElement(tag);if(cls)el.className=cls;
    if(text!=null)el.textContent=text;
    return el;
  }
  function renderStory(record,api){
    const article=$('drawer')?.querySelector('.memory-experience');
    if(!article)return;
    const previous=article.querySelector('.v116-trail');
    const wasOpen=!!previous?.open;
    previous?.remove();
    const records=model.viewed(api.stories);
    const panel=node('details','v116-trail');
    panel.open=wasOpen;
    const summary=node('summary','v116-trail-summary','✦ МАРШРУТ ИССЛЕДОВАНИЯ · '+records.length+' / '+MAX_STEPS);
    const caption=node('p','v116-trail-caption',
      'Истории, которые ты открыл в этом сеансе. Это личный порядок просмотра, а не связь между людьми.');
    const list=node('ol','v116-trail-steps');
    for(const item of records){
      const li=node('li','v116-trail-step');
      if(String(item.id)===String(record.id))li.classList.add('is-current');
      const star=node('span','v116-step-symbol','✦');star.setAttribute('aria-hidden','true');
      const text=node('span','v116-step-name','@'+label(item));
      const kind=node('small','v116-step-kind',item.local?'Личная звезда':theme(item));
      const line=node('span','v116-step-text');line.append(text,kind);
      if(String(item.id)===String(record.id)){
        const current=node('span','v116-step-current');current.append(star,line);
        current.setAttribute('aria-current','step');li.append(current);
      }else{
        const open=node('button','v116-step-open');
        open.type='button';open.setAttribute('aria-label','Вернуться к звезде '+label(item));
        open.append(star,line);open.onclick=()=>api.travel(item);
        li.append(open);
      }
      list.append(li);
    }
    const actions=node('div','v116-trail-actions');
    const save=node('button','v116-trail-save','Сохранить маршрут на устройстве');
    save.type='button';
    const safe=records.length>=2&&records.every(shareable);
    save.disabled=!safe;
    if(!safe)save.title=records.some(record=>record.local)?
      'Маршруты с личными записями не сохраняются':'Открой хотя бы две истории';
    save.onclick=()=>{
      const result=model.save(api.stories);
      api.toast(result.ok?(result.duplicate?
        'Этот маршрут уже сохранён на устройстве.':
        'Маршрут сохранён только в этом браузере.'):result.reason);
      if(result.ok)renderStory(record,api);
    };
    const clear=node('button','v116-trail-reset','Начать новый маршрут');
    clear.type='button';
    clear.onclick=()=>{model.reset(record);renderStory(record,api);};
    actions.append(save,clear);
    const note=node('p','v116-trail-note',
      'Сохранение происходит только после нажатия. В браузере хранятся ID редакционных звёзд, не личные истории. Сохранённые маршруты доступны в Архиве на этом же адресе.');
    panel.append(summary,caption,list,actions,note);
    // In V12, the story artifact must be the first narrative element. Trails
    // follow the artifact rather than obscuring it on every story open.
    const artifact=article.querySelector('.v12-memory-hero');
    const topline=article.querySelector('.memory-topline');
    if(artifact)artifact.after(panel);
    else if(topline)topline.after(panel);
    else article.prepend(panel);
  }
  function renderArchive(api,force=false){
    const index=document.querySelector('.v79-archive-index');
    if(!index)return;
    const existing=document.getElementById('v116SavedRoutes');
    if(existing&&!force)return; // Preserve archive scroll and input focus on every filter redraw.
    existing?.remove();
    const panel=node('section','v116-saved-routes');
    panel.id='v116SavedRoutes';
    panel.setAttribute('aria-label','Маршруты, сохранённые на этом устройстве');
    const head=node('div','v116-saved-head');
    const intro=node('span','v116-saved-eyebrow','PRIVATE / ROUTES ON THIS DEVICE');
    const title=node('h3',null,'Твои маршруты по памяти.');
    const desc=node('p',null,'Только в этом браузере и на этом адресе. Не публикуются и не переносятся на другие устройства.');
    head.append(intro,title,desc);panel.append(head);
    const routes=model.saved(api.stories);
    if(!routes.length){
      panel.append(node('p','v116-saved-empty',
        'Пока маршрутов нет. Открой две звезды, затем сохрани путь из истории.'));
    }
    for(const [i,route] of routes.entries()){
      const item=node('div','v116-route-item');
      const h=node('strong','v116-route-title','МАРШРУТ '+String(i+1).padStart(2,'0')+' · '+route.records.length+' ЗВЁЗДЫ');
      const list=node('ol','v116-route-list');
      for(const record of route.records){
        const li=node('li','v116-route-step');
        const button=node('button',null,'@'+label(record));
        button.type='button';
        button.setAttribute('aria-label','Открыть звезду '+label(record)+' из сохранённого маршрута');
        button.onclick=()=>api.travel(record);
        li.append(button);list.append(li);
      }
      const remove=node('button','v116-route-remove','Удалить маршрут');
      remove.type='button';
      remove.setAttribute('aria-label','Удалить сохранённый маршрут '+(i+1));
      remove.onclick=()=>{
        if(model.remove(route.id)){renderArchive(api,true);api.toast('Сохранённый маршрут удалён из браузера.');}
        else api.toast('Не удалось удалить маршрут из хранилища браузера.');
      };
      item.append(h,list,remove);panel.append(item);
    }
    index.parentNode.insertBefore(panel,index);
  }
  return {
    createModel,
    onStory(record,api){model.visit(record);renderStory(record,api);},
    mountArchive(api){renderArchive(api);}
  };
})();