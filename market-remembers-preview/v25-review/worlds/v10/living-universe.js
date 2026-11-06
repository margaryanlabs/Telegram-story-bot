window.MarketV10 = window.MarketV10 || {};
window.MarketV10.install = function(api) {
  const V=window.MarketV10;
  const $=id=>document.getElementById(id);
  let router,travelling=false,archiveReturn=null;
  const clear=()=>{$('drawer').classList.remove('v10-reader','v10-archive','v10-legacy');};
  function modal() {
    const covered=!$('drawer').hidden||!$('birthOverlay').hidden||!$('memoryDive').hidden;
    document.querySelectorAll('.header,.mobile-nav,main,.scene,.version-compare').forEach(el=>el.inert=covered);
    if(!covered)$('app').removeAttribute('data-v10-modal');else $('app').dataset.v10Modal='true';
  }
  function active(view) {
    document.querySelectorAll('[data-open]').forEach(button=>{
      const current=button.dataset.open===(view==='story'?'universe':view);
      button.classList.toggle('is-on',current);button.setAttribute('aria-current',current?'page':'false');
    });
  }
  const shared={...api,modal,active,
    story:record=>wrappers.showStory(record),archive:()=>wrappers.showArchive(),
    previousView:()=>router?.previousView()||null,
    legacy:()=>wrappers.showLegacy(),create:()=>wrappers.showCreate(),
    close:skip=>api.base.closeDrawer(skip),cancel:()=>api.base.cancelDive(true),
    focus:index=>{api.lensAll();api.focus(index,false);},
    archiveState(params){
      api.setArchive(params.get('theme')||'All',(params.get('q')||'').slice(0,240));
      V.archive.setSort(params.get('sort'));
    },
    syncArchive(sort=V.archive.getSort()) {
      if(router?.read().view==='archive')router.visit('archive',{...api.getArchive(),sort},true);
    },
    // Crossing from a clearly fictional PEOPLE story into sourced financial
    // history is a thematic research route, never an implied real-life link.
    toEvent(year) {
      const modes=window.MarketHistoryModes;
      if(!modes||!modes.events.some(item=>item.id===String(year)))return;
      api.base.closeDrawer(true);
      modal();
      router.visit('universe');
      modes.setMode('events',true,()=>modes.selectEvent(String(year)));
    },
    travel(record) {
      const index=api.stories.findIndex(item=>String(item.id)===String(record?.id));
      if(index>=0)wrappers.beginDive(index);
    },
    locate(record) {
      api.base.closeDrawer(true);modal();api.lensAll();api.focus(api.stories.indexOf(record),false);
      api.restoreStar();router.visit('universe',{star:String(record.id)});
      ($('focusMode').getAttribute('aria-pressed')==='true'?$('focusMode'):(innerWidth<820?$('dockOpen'):$('openSelected'))).focus({preventScroll:true});
    },
    save(data) {
      const success=api.save(data);
      if(success)router.visit('universe',{star:String(api.stories.at(-1).id)},true);
      modal();return success;
    }
  };
  const wrappers={
    showStory(record) {
      clear();api.base.showStory(record);
      // Set the real route before mounting the enhanced reader: the back
      // control reads the prior hash to choose Archive / previous star / sky.
      // Deep-link replays are guarded by navigation.replay.
      router.visit('story',{id:String(record.id)});
      V.reader.mount(record,shared);V.trails.onStory(record,shared);V.motion.seen(record);
      modal();
    },
    showArchive() {
      const returning=router.replay&&archiveReturn?.hash===location.hash;
      clear();router.visit('archive',{...api.getArchive(),sort:V.archive.getSort()});
      api.base.showArchive();modal();
      if(returning){
        const drawer=$('drawer');
        // The original archive DOM is fully rebuilt after a history return.
        // Restore the previous reading position, bounded by new results.
        const max=Math.max(0,drawer.scrollHeight-drawer.clientHeight);
        drawer.scrollTop=Math.max(0,Math.min(archiveReturn.top,max));
        const card=[...$('archiveGrid').querySelectorAll('button[data-story-id]')]
          .find(el=>el.dataset.storyId===archiveReturn.storyId);
        card?.focus({preventScroll:true});
        archiveReturn=null;
      }else if(!router.replay)archiveReturn=null;
    },
    drawArchive() {
      api.base.drawArchive();V.archive.mount(shared);V.trails.mountArchive(shared);shared.syncArchive();
    },
    showLegacy() {clear();api.base.showLegacy();router.visit('legacy');modal();},
    showCreate() {clear();V.legacy.mount(shared);router.visit('create');modal();},
    beginDive(index) {
      if(!api.stories.length)return;
      const safeIndex=((index%api.stories.length)+api.stories.length)%api.stories.length;
      const record=api.stories[safeIndex];
      // Save the exact scroll/focus origin before leaving the filtered archive.
      // This remains in-memory only and is never persisted or shared.
      if(router.read().view==='archive'&&!$('drawer').hidden){
        archiveReturn={
          hash:location.hash,
          top:Math.max(0,$('drawer').scrollTop),
          storyId:String(record.id)
        };
      }
      router.visit('story',{id:String(record.id)});travelling=true;
      try {
        if(V.motion.skip(record)) {
          api.base.cancelDive(true);api.base.closeDrawer(true);api.closeLens();api.lensAll();api.focus(safeIndex,false);
          wrappers.showStory(record);
        } else api.base.beginDive(safeIndex);
      } finally {travelling=false;modal();}
    },
    closeDrawer(skipReturn=false) {
      const wasOpen=!$('drawer').hidden;
      const wasStory=router.read().view==='story';
      const starId=router.read().id;
      const previous=wasStory?router.previousView():null;
      const returnToContent=skipReturn!==true&&
        (previous==='archive'||previous==='story');
      const target=api.returnTarget();
      // A return to Archive/story must not launch the legacy camera-to-globe
      // animation behind the newly opened reader or search results.
      api.base.closeDrawer(returnToContent?true:skipReturn);modal();
      if(wasOpen&&skipReturn!==true&&!travelling){
        if(!returnToContent)target?.focus({preventScroll:true});
        if(wasStory){
          if(returnToContent)router.dismiss();
          else router.visit('universe',{star:starId},true);
        }else router.dismiss();
      }
    }
  };
  router=V.navigation(shared);
  V.reader.init();V.atmosphere.init();
  const observer=new MutationObserver(modal);
  ['drawer','birthOverlay','memoryDive'].forEach(id=>observer.observe($(id),{attributes:true,attributeFilter:['hidden']}));
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&!$('memoryDive').hidden){
      event.preventDefault();event.stopImmediatePropagation();api.base.cancelDive(true);modal();api.returnTarget()?.focus({preventScroll:true});router.dismiss();return;
    }
    const overlay=!$('birthOverlay').hidden?$('birthOverlay'):!$('memoryDive').hidden?$('memoryDive'):null;
    if(event.key==='Tab'&&overlay){
      const buttons=[...overlay.querySelectorAll('button:not([disabled])')].filter(el=>el.getClientRects().length);
      const first=buttons[0],last=buttons.at(-1);
      if(event.shiftKey&&(document.activeElement===first||!overlay.contains(document.activeElement))){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&(document.activeElement===last||!overlay.contains(document.activeElement))){event.preventDefault();first?.focus();}
    }
  },true);
  function controls() {
    document.querySelectorAll('[data-open="universe"]').forEach(button=>button.onclick=()=>{api.base.cancelDive(true);api.base.closeDrawer(true);api.reset();modal();router.visit('universe');});
    $('brandHome').onclick=event=>{event.preventDefault();api.base.closeDrawer(true);api.reset();modal();router.visit('universe');};
    const name=(id,text)=>{$(id).textContent=text;};
    const theme=V.data.themes;
    const icon=path=>'<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">'+path+'</svg>';
    const arrow=icon('<path d="M5 19 19 5M5 5h14v14"/>');
    $('dockOpen').innerHTML=arrow;$('plusZoom').textContent='+';
    $('resetCamera').innerHTML=icon('<path d="M4 9a8 8 0 1 1 0 7M4 3v6h6"/>');
    document.querySelectorAll('#heroCreate>span,#headerCreate>span:last-child,#openSelected>span').forEach(el=>el.innerHTML=arrow);
    function labels(){
      name('globeScale','Масштаб');
      name('focusMode',$('focusMode').getAttribute('aria-pressed')==='true'?'Обзор':'Погружение');
      name('toggleAtlas','Связи');name('lensToggle','Темы');
      $('signalHint').textContent=$('toggleAtlas').getAttribute('aria-pressed')==='true'?'ТЕМАТИЧЕСКИЕ СВЯЗИ / ПОКАЗАНЫ':'ТЕМАТИЧЕСКИЕ СВЯЗИ / СКРЫТЫ';
      const spinning=$('autoRotate').getAttribute('aria-pressed')==='true';
      $('autoRotate').setAttribute('aria-label',spinning?'Остановить вращение':'Включить вращение');
      $('autoRotate').innerHTML=icon(spinning?'<path d="M8 5v14M16 5v14"/>':'<path d="m8 5 10 7-10 7Z"/>');
    }
    const controlsObserver=new MutationObserver(labels);
    controlsObserver.observe($('autoRotate'),{attributes:true,attributeFilter:['aria-pressed']});
    controlsObserver.observe($('toggleAtlas'),{attributes:true,attributeFilter:['aria-pressed']});
    ['globeScale','focusMode','lensToggle'].forEach(id=>controlsObserver.observe($(id),{attributes:true,attributeFilter:['aria-pressed','aria-label','aria-expanded']}));
    // Text updates from the existing engine are relabelled after their click.
    $('worldControls')?.addEventListener('click',labels);
    $('lensPanel').addEventListener('click',labels);
    document.querySelectorAll('[data-lens]').forEach(button=>{
      const text=button.querySelector('strong');if(text&&theme[button.dataset.lens])text.textContent=theme[button.dataset.lens];
    });
    const preference=document.createElement('label');preference.className='v10-motion-preference';
    const input=document.createElement('input');input.type='checkbox';input.onchange=()=>V.motion.preference(input.checked);
    preference.append(input,document.createTextNode('Открывать истории без перелёта'));
    $('lensPanel').append(preference);labels();
  }
  V.start=()=>{controls();router.start();};
  V.stats=()=>({...V.atmosphere.stats(),view:router.read().view});
  return wrappers;
};
