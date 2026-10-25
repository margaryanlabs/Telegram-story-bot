import {missionPresentation} from './vetogram-mission-core.js';

// Mission Control mirrors EXISTING app.js state indicators. This UI has no
// Telegram API, polling, auth, personal data, permissions or persistence.
(()=>{
  const $=id=>document.getElementById(id);
  const holder=$('vg27Mission');
  if(!holder)return;
  const account=$('vetoAccountBadge');
  const privacy=$('vetoPrivacyBadge');
  const stories=$('vetoStoriesBadge');
  const title=$('vg27MissionTitle'),detail=$('vg27MissionDetail');
  const call=$('vg27MissionAction');
  const mapping=[
    ['vg27MissionAccount','account','accountState'],
    ['vg27MissionPrivacy','privacy','privacyState'],
    ['vg27MissionStories','stories','storiesState']
  ];
  let currentAction='connect';
  function sync(){
    const hasStatus=Boolean(account&&account.textContent?.trim()&&
      !/Account\s*·\s*—/.test(account.textContent));
    const present=missionPresentation({
      accountReady:account?.classList.contains('ready')===true,
      privacyPermission:privacy?.classList.contains('ready')===true,
      storiesBusiness:stories?.classList.contains('ready')===true&&
        /Business/i.test(stories?.textContent||''),
      hasStatus
    });
    for(const [id,text,state] of mapping){
      const node=$(id);
      if(!node)continue;
      node.textContent=present[text];
      node.dataset.status=present[state];
    }
    if(title)title.textContent=present.heading;
    if(detail)detail.textContent=present.detail;
    if(call)call.textContent=present.action+' →';
    currentAction=present.actionKind;
  }
  call?.addEventListener('click',()=>{
    if(currentAction==='chats'){
      if(typeof window.VetoTelegramNavigate==='function')
        window.VetoTelegramNavigate('telegram');
      else document.querySelector('[data-nav="telegram"]')?.click();
      return;
    }
    // Explicit click only. Do not launch Telegram login behind the scenes.
    if(typeof window.VetoTelegramOpenAccountConnection==='function')
      void window.VetoTelegramOpenAccountConnection();
    else $('vetoHomeConnectPrimary')?.click();
  });
  if(typeof MutationObserver!=='undefined'){
    const observer=new MutationObserver(sync);
    for(const node of [account,privacy,stories]){
      if(node)observer.observe(node,{attributes:true,attributeFilter:['class'],
        childList:true,characterData:true,subtree:true});
    }
  }
  sync();
})();
