/* VETOGRAM REBORN — mobile country picker. All phone data stays in the existing
 * local input until the user explicitly requests a Telegram login code.
 * No guessed country, no storage, no automatic API calls.
 */
(() => {
  'use strict';
  const COUNTRIES = Object.freeze([["AM","🇦🇲","Армения","374"],["RU","🇷🇺","Россия","7"],["GE","🇬🇪","Грузия","995"],["KZ","🇰🇿","Казахстан","7"],["AE","🇦🇪","ОАЭ","971"],["UA","🇺🇦","Украина","380"],["BY","🇧🇾","Беларусь","375"],["UZ","🇺🇿","Узбекистан","998"],["KG","🇰🇬","Кыргызстан","996"],["TJ","🇹🇯","Таджикистан","992"],["AZ","🇦🇿","Азербайджан","994"],["TR","🇹🇷","Турция","90"],["US","🇺🇸","США","1"],["CA","🇨🇦","Канада","1"],["GB","🇬🇧","Великобритания","44"],["DE","🇩🇪","Германия","49"],["FR","🇫🇷","Франция","33"],["ES","🇪🇸","Испания","34"],["IT","🇮🇹","Италия","39"],["PL","🇵🇱","Польша","48"],["NL","🇳🇱","Нидерланды","31"],["BE","🇧🇪","Бельгия","32"],["CH","🇨🇭","Швейцария","41"],["AT","🇦🇹","Австрия","43"],["CZ","🇨🇿","Чехия","420"],["SK","🇸🇰","Словакия","421"],["HU","🇭🇺","Венгрия","36"],["RO","🇷🇴","Румыния","40"],["BG","🇧🇬","Болгария","359"],["GR","🇬🇷","Греция","30"],["CY","🇨🇾","Кипр","357"],["PT","🇵🇹","Португалия","351"],["SE","🇸🇪","Швеция","46"],["NO","🇳🇴","Норвегия","47"],["DK","🇩🇰","Дания","45"],["FI","🇫🇮","Финляндия","358"],["IS","🇮🇸","Исландия","354"],["IE","🇮🇪","Ирландия","353"],["EE","🇪🇪","Эстония","372"],["LV","🇱🇻","Латвия","371"],["LT","🇱🇹","Литва","370"],["MD","🇲🇩","Молдова","373"],["RS","🇷🇸","Сербия","381"],["ME","🇲🇪","Черногория","382"],["AL","🇦🇱","Албания","355"],["MK","🇲🇰","Северная Македония","389"],["BA","🇧🇦","Босния и Герцеговина","387"],["HR","🇭🇷","Хорватия","385"],["SI","🇸🇮","Словения","386"],["MT","🇲🇹","Мальта","356"],["LU","🇱🇺","Люксембург","352"],["IL","🇮🇱","Израиль","972"],["SA","🇸🇦","Саудовская Аравия","966"],["QA","🇶🇦","Катар","974"],["KW","🇰🇼","Кувейт","965"],["BH","🇧🇭","Бахрейн","973"],["OM","🇴🇲","Оман","968"],["EG","🇪🇬","Египет","20"],["MA","🇲🇦","Марокко","212"],["TN","🇹🇳","Тунис","216"],["DZ","🇩🇿","Алжир","213"],["IN","🇮🇳","Индия","91"],["PK","🇵🇰","Пакистан","92"],["BD","🇧🇩","Бангладеш","880"],["CN","🇨🇳","Китай","86"],["JP","🇯🇵","Япония","81"],["KR","🇰🇷","Южная Корея","82"],["SG","🇸🇬","Сингапур","65"],["TH","🇹🇭","Таиланд","66"],["VN","🇻🇳","Вьетнам","84"],["MY","🇲🇾","Малайзия","60"],["ID","🇮🇩","Индонезия","62"],["PH","🇵🇭","Филиппины","63"],["KH","🇰🇭","Камбоджа","855"],["LA","🇱🇦","Лаос","856"],["MM","🇲🇲","Мьянма","95"],["HK","🇭🇰","Гонконг","852"],["TW","🇹🇼","Тайвань","886"],["AU","🇦🇺","Австралия","61"],["NZ","🇳🇿","Новая Зеландия","64"],["ZA","🇿🇦","ЮАР","27"],["NG","🇳🇬","Нигерия","234"],["KE","🇰🇪","Кения","254"],["GH","🇬🇭","Гана","233"],["ET","🇪🇹","Эфиопия","251"],["BR","🇧🇷","Бразилия","55"],["AR","🇦🇷","Аргентина","54"],["MX","🇲🇽","Мексика","52"],["CL","🇨🇱","Чили","56"],["CO","🇨🇴","Колумбия","57"],["PE","🇵🇪","Перу","51"],["EC","🇪🇨","Эквадор","593"],["UY","🇺🇾","Уругвай","598"],["PY","🇵🇾","Парагвай","595"],["VE","🇻🇪","Венесуэла","58"],["AF","🇦🇫","Афганистан","93"],["IR","🇮🇷","Иран","98"],["IQ","🇮🇶","Ирак","964"],["JO","🇯🇴","Иордания","962"],["LB","🇱🇧","Ливан","961"],["SY","🇸🇾","Сирия","963"],["NP","🇳🇵","Непал","977"],["LK","🇱🇰","Шри-Ланка","94"],["MN","🇲🇳","Монголия","976"]].map(([iso,flag,name,dial]) =>
    Object.freeze({iso,flag,name,dial})
  ));
  const PRIORITY = new Set(['AM','RU','GE','KZ','AE','UA']);
  const digits = value => String(value||'').replace(/\D/g,'');
  const lookup = value => {
    const phone=String(value||'').trim();
    if (!/^\+\d/.test(phone)) return null;
    const matched=COUNTRIES.filter(c=>digits(phone).startsWith(c.dial))
      .sort((a,b)=>b.dial.length-a.dial.length);
    // Shared calling codes +7 and +1 cannot determine a specific country
    // without a validated national numbering plan. Never guess a flag.
    return matched.length && matched.filter(x=>x.dial===matched[0].dial).length===1
      ? matched[0]:null;
  };
  const find = query => {
    const q=String(query||'').trim().toLocaleLowerCase('ru').replace(/^\+/,'');
    return COUNTRIES.filter(c=>
      !q || c.name.toLocaleLowerCase('ru').includes(q) ||
      c.iso.toLocaleLowerCase().includes(q) || c.dial.startsWith(q)
    ).sort((a,b)=>Number(PRIORITY.has(b.iso))-Number(PRIORITY.has(a.iso))||
      a.name.localeCompare(b.name,'ru'));
  };
  let controller=null;
  function mount(){
    controller?.abort();
    controller=new AbortController();
    const signal=controller.signal;
    const phone=document.getElementById('viewerPhone');
    const trigger=document.getElementById('viewerCountryTrigger');
    const panel=document.getElementById('viewerCountryPicker');
    const search=document.getElementById('viewerCountrySearch');
    const options=document.getElementById('viewerCountryOptions');
    if(!phone||!trigger||!panel||!search||!options)return;
    let selected=lookup(phone.value);
    function syncTrigger(){
      trigger.textContent=selected
        ? selected.flag+' '+selected.name+'  +'+selected.dial
        : '🌐 Выбрать страну';
      trigger.setAttribute('aria-label',selected
        ?'Страна '+selected.name+', код +'+selected.dial+'. Изменить страну.'
        :'Выбрать страну и телефонный код');
    }
    function render(){
      options.replaceChildren();
      const list=find(search.value).slice(0,150);
      if(!list.length){
        const empty=document.createElement('p');
        empty.className='veto-country-empty';
        empty.textContent='Страна не найдена. Код можно ввести вручную.';
        options.append(empty);return;
      }
      for(const country of list){
        const button=document.createElement('button');
        button.type='button';button.className='veto-country-option';
        button.dataset.iso=country.iso;
        button.setAttribute('role','option');
        button.setAttribute('aria-selected',String(selected?.iso===country.iso));
        const flag=document.createElement('span');flag.textContent=country.flag;
        const name=document.createElement('strong');name.textContent=country.name;
        const code=document.createElement('small');code.textContent='+'+country.dial;
        button.append(flag,name,code);options.append(button);
      }
    }
    const close=()=>{
      panel.hidden=true;
      trigger.setAttribute('aria-expanded','false');
    };
    const open=()=>{
      panel.hidden=false;
      trigger.setAttribute('aria-expanded','true');
      search.value='';render();
      search.focus({preventScroll:true});
    };
    trigger.addEventListener('click',()=>panel.hidden?open():close(),{signal});
    search.addEventListener('input',render,{signal});
    options.addEventListener('click',event=>{
      const item=event.target.closest('button[data-iso]');
      if(!item||!options.contains(item))return;
      const next=COUNTRIES.find(c=>c.iso===item.dataset.iso);
      if(!next)return;
      const oldCode=selected?.dial;
      const old=phone.value.trim();
      // Keep the national part only when the OLD number already has the
      // newly selected calling code (for example RU↔KZ +7 or US↔CA +1).
      // Changing AM +374 to GE +995 must not silently carry an Armenian
      // national number into a different country's phone number.
      const sameDial=old.startsWith('+'+next.dial)
        && (!oldCode || oldCode===next.dial);
      const national=sameDial?old.slice(next.dial.length+1).trim():'';
      selected=next;
      phone.value='+'+next.dial+(national?' '+national:' ');
      phone.dispatchEvent(new Event('input',{bubbles:true}));
      syncTrigger();close();
      phone.focus({preventScroll:true});
      phone.setSelectionRange(phone.value.length,phone.value.length);
    },{signal});
    phone.addEventListener('input',()=>{
      if(selected && digits(phone.value).startsWith(selected.dial))return;
      selected=lookup(phone.value);syncTrigger();
    },{signal});
    document.addEventListener('keydown',event=>{
      if(event.key==='Escape'&&!panel.hidden){
        event.preventDefault();close();trigger.focus({preventScroll:true});
      }
    },{signal});
    document.addEventListener('pointerdown',event=>{
      if(!panel.hidden&&!panel.contains(event.target)&&!trigger.contains(event.target))
        close();
    },{signal,passive:true});
    syncTrigger();
  }
  window.VetogramCountryPicker=Object.freeze({mount,countries:COUNTRIES,find,lookup});
})();