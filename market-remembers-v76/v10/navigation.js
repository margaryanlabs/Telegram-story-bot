window.MarketV10 = window.MarketV10 || {};
window.MarketV10.navigation = (api) => {
  let replay=false,lastApplied=null;
  const views=new Set(['universe','archive','legacy','create']);
  function read() {
    const hash=location.hash.slice(1);
    const [path,query='']=hash.split('?');
    const params=new URLSearchParams(query);
    if(path.startsWith('story/')){
      try{return {view:'story',id:decodeURIComponent(path.slice(6)),params};}catch{return {view:'universe',params};}
    }
    return {view:views.has(path)?path:'universe',params};
  }
  function hashFor(view,params={}) {
    if(view==='story')return '#story/'+encodeURIComponent(String(params.id));
    const query=new URLSearchParams();
    for(const [key,value] of Object.entries(params))if(value!==''&&value!=null&&value!=='curated'&&!(key==='theme'&&value==='All'))query.set(key,value);
    return '#'+view+(query.size?'?'+query:'');
  }
  function visit(view,params={},replace=false) {
    if(replay)return;
    const hash=hashFor(view,params);if(location.hash===hash)return;
    const previous=location.hash||'#universe';
    const state={tmrV10:true,prior:replace?(history.state?.prior||null):previous};
    history[replace?'replaceState':'pushState'](state,'',hash);
    lastApplied=location.href;
    api.active(view);
  }
  function apply() {
    if(lastApplied===location.href)return;
    lastApplied=location.href;
    const route=read();replay=true;
    try {
      api.cancel();api.close(true);
      if(route.view==='story') {
        const story=api.stories.find(story=>String(story.id)===route.id);
        if(story){api.focus(api.stories.indexOf(story));api.story(story);}
        else {api.toast('Этой звезды нет в доступном архиве. Личная ссылка работает только в браузере с сохранённой записью.');history.replaceState({tmrV10:true},'','#universe');}
      } else if(route.view==='archive') {
        api.archiveState(route.params);api.archive();
      } else if(route.view==='create')api.create();
      else if(route.view==='legacy')api.legacy();
      else if(route.params.has('star')) {
        const index=api.stories.findIndex(story=>String(story.id)===route.params.get('star'));
        if(index>=0)api.focus(index);
      }
      api.active(route.view);
    } finally {replay=false;api.modal();}
  }
  // Origin must come from this history entry, never from the current
  // reader theme, selected star or a previous page's stale UI state.
  function previousView() {
    const prior=history.state?.tmrV10?history.state?.prior:null;
    if(typeof prior!=='string'||!prior.startsWith('#'))return null;
    const path=prior.slice(1).split('?')[0];
    if(path.startsWith('story/'))return 'story';
    return views.has(path)?path:null;
  }
  function dismiss() {
    if(replay||read().view==='universe')return;
    if(history.state?.tmrV10&&history.state?.prior)history.back();
    else {visit('universe',{},true);api.active('universe');}
  }
  return {read,visit,dismiss,previousView,get replay(){return replay;},start(){
    if(!location.hash)history.replaceState({tmrV10:true,prior:null},'','#universe');
    window.addEventListener('popstate',apply);window.addEventListener('hashchange',()=>{if(!replay)apply();});
    apply();
  }};
};
