/* VETOGRAM 3.0: lightweight recent-tool navigation. No user data, messages,
   account identifiers, storage, network requests or background activity. */
(()=>{
  'use strict';
  const holder=document.getElementById('vg26ResumeRecent');
  if(!holder)return;
  const registry=Object.freeze({
    telegram:{label:'Чаты',symbol:'◉'},
    privacy:{label:'Личный архив',symbol:'↶'},
    publish:{label:'Истории',symbol:'◎'},
    'story-engine':{label:'Студия историй',symbol:'✧'},
    ai:{label:'VETO AI',symbol:'✦'},
    voice:{label:'Голосовая студия',symbol:'♫'},
    viewers:{label:'Просмотры',symbol:'◈'},
    studio:{label:'Студия стикеров',symbol:'✳'},
    relay:{label:'Relay',symbol:'⇄'},
    analytics:{label:'Аналитика',symbol:'▥'},
    archive:{label:'Архив',symbol:'▤'}
  });
  const recent=[];
  function render(){
    holder.replaceChildren();
    if(!recent.length){
      const hint=document.createElement('span');
      hint.className='vg26-resume-empty';
      hint.textContent='Начни с чатов, историй или ИИ — здесь появятся твои быстрые переходы.';
      holder.append(hint);
      return;
    }
    for(const id of recent){
      const item=registry[id];
      if(!item)continue;
      const button=document.createElement('button');
      button.type='button';
      button.className='vg26-resume-chip';
      button.dataset.vg26Recent=id;
      button.setAttribute('aria-label','Открыть '+item.label);
      const symbol=document.createElement('span');
      symbol.textContent=item.symbol;
      symbol.setAttribute('aria-hidden','true');
      const label=document.createElement('strong');
      label.textContent=item.label;
      const arrow=document.createElement('em');
      arrow.textContent='↗';
      button.append(symbol,label,arrow);
      button.addEventListener('click',()=>{
        if(typeof window.VetoTelegramNavigate==='function'){
          window.VetoTelegramNavigate(id);
          return;
        }
        const fallback=document.querySelector('[data-nav="'+id+'"]')||
          document.querySelector('[data-open-screen="'+id+'"]');
        fallback?.click();
      });
      holder.append(button);
    }
  }
  function observeCurrent(){
    const active=document.querySelector('.screen.active');
    const id=active?.dataset?.screen;
    if(!id||!Object.hasOwn(registry,id)||recent[0]===id)return;
    const old=recent.indexOf(id);
    if(old!==-1)recent.splice(old,1);
    recent.unshift(id);
    if(recent.length>3)recent.length=3;
    render();
  }
  render();
  const screens=Array.from(document.querySelectorAll('.screen[data-screen]'));
  if(typeof MutationObserver==='function'){
    const observer=new MutationObserver(observeCurrent);
    for(const screen of screens)observer.observe(screen,{attributes:true,attributeFilter:['class']});
  }
  observeCurrent();
  // Report only navigation names; never expose chat content, account info
  // or private records as a "recent" item.
})();
