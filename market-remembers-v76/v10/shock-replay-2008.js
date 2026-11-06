/* MARKET REMEMBERS V20.2 — historically sourced, read-only Shock Replay.
 * The timeline is chronological, NOT a live trading animation or price series.
 * Only the 2008 dossier opts in. No story data, accounts or storage.
 */
(function () {
  'use strict';
  if (window.MarketShockReplay2008) return;
  const FED_TIMELINE = 'https://fraser.stlouisfed.org/timeline/financial-crisis';
  const FDIC_HISTORY = 'https://www.fdic.gov/history/2000-2009';
  const LAW = 'https://www.govinfo.gov/app/details/PLAW-110publ343/PLAW-110publ343';
  // "fact" is described in the listed official record. "reading" is an
  // explicitly editorial explanation, not a claimed statistical relationship.
  const STAGES = Object.freeze([
    {
      id:'gse',date:'07 СЕН',iso:'2008-09-07',label:'ПРЕДЫСТОРИЯ',
      title:'Fannie Mae и Freddie Mac',
      fact:'FHFA перевело Fannie Mae и Freddie Mac под государственное управление (conservatorship).',
      reading:'Слабость ипотечного финансирования стала частью более широкого кризиса доверия.',
      mechanism:'Ипотечные обязательства',source:'St. Louis Fed · хроника',url:FED_TIMELINE
    },
    {
      id:'lehman',date:'15 СЕН',iso:'2008-09-15',label:'ПЕРЕЛОМ',
      title:'Lehman Brothers подаёт на банкротство',
      fact:'Lehman Brothers Holdings Inc. подала заявление о защите от кредиторов по главе 11 Кодекса США о банкротстве.',
      reading:'Этот эпизод позволяет исследовать, как риск контрагента влияет на доверие и краткосрочное финансирование.',
      mechanism:'Контрагенты и фондирование',source:'St. Louis Fed · хроника',url:FED_TIMELINE
    },
    {
      id:'fund',date:'16 СЕН',iso:'2008-09-16',label:'РАСПРОСТРАНЕНИЕ',
      title:'Reserve Primary Fund теряет паритет',
      fact:'Стоимость пая Reserve Primary Fund опустилась ниже 1 доллара; в его портфеле были инструменты Lehman Brothers.',
      reading:'Стресс перестал восприниматься только как проблема инвестиционного банка: давление затронуло денежные фонды.',
      mechanism:'Фонды денежного рынка',source:'FDIC · историческая хроника',url:FDIC_HISTORY
    },
    {
      id:'aig',date:'16 СЕН',iso:'2008-09-16',label:'ЭКСТРЕННАЯ МЕРА',
      title:'ФРС санкционирует кредит AIG',
      fact:'Совет управляющих ФРС разрешил Федеральному резервному банку Нью-Йорка предоставить AIG кредитную линию до 85 млрд долларов.',
      reading:'Решение отражало обеспокоенность риском дальнейшего распространения системного стресса.',
      mechanism:'Страхование и деривативы',source:'FDIC · историческая хроника',url:FDIC_HISTORY
    },
    {
      id:'guarantee',date:'19 СЕН',iso:'2008-09-19',label:'СДЕРЖИВАНИЕ',
      title:'Гарантии фондам денежного рынка',
      fact:'Минфин США объявил временную программу гарантий для участвующих фондов денежного рынка с использованием ресурсов Exchange Stabilization Fund.',
      reading:'Целью меры было укрепление доверия к краткосрочным сбережениям и финансированию.',
      mechanism:'Доверие к ликвидности',source:'St. Louis Fed · хроника',url:FED_TIMELINE
    },
    {
      id:'tarp',date:'03 ОКТ',iso:'2008-10-03',label:'СИСТЕМНЫЙ ОТВЕТ',
      title:'Принят закон, учредивший TARP',
      fact:'Emergency Economic Stabilization Act of 2008 подписан 3 октября. Закон учредил программу TARP с полномочиями до 700 млрд долларов.',
      reading:'Ответ перешёл от отдельных экстренных решений к общесистемной законодательной программе.',
      mechanism:'Государственная стабилизация',source:'GovInfo · Public Law 110-343',url:LAW
    }
  ].map(record => Object.freeze(record)));
  const escape = value => String(value).replace(/[&<>"']/g, key => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[key]);
  let host = null;
  let index = 0;
  let speed = 1;
  let playing = false;
  let timer = 0;
  const DELAY = 4700;

  // Reuse the existing 2008 globe beacon. The timeline never invents
  // spherical coordinates for events occurring on different days.
  function syncScene() {
    const app=document.getElementById('app');
    if (!app || !host) return;
    app.dataset.mhReplayStep=String(index+1);
    app.dataset.mhReplayPlaying=String(playing);
    const beacon=document.querySelector('#mhEventLayer [data-mh-beacon="2008"]');
    if (beacon) {
      beacon.dataset.mhReplayStage=STAGES[index].date;
      beacon.setAttribute('title','2008 · '+STAGES[index].title);
    }
  }
  function clearScene() {
    const app=document.getElementById('app');
    if (app) {
      delete app.dataset.mhReplayStep;
      delete app.dataset.mhReplayPlaying;
    }
    const beacon=document.querySelector('#mhEventLayer [data-mh-beacon="2008"]');
    if (beacon) {
      delete beacon.dataset.mhReplayStage;
      beacon.removeAttribute('title');
    }
  }

  function clearTimer() {
    if (timer) window.clearTimeout(timer);
    timer = 0;
  }
  function pause() {
    clearTimer();
    playing = false;
    render();
  }
  function unmount() {
    clearTimer();
    playing = false;
    if (host) host.removeEventListener('click', onClick);
    clearScene();
    host = null;
  }
  function render() {
    if (!host) return;
    const stage=STAGES[index];
    syncScene();
    const progress=Math.round((index + 1)/STAGES.length*100);
    host.innerHTML =
      '<div class="mh-replay-header"><div><span class="mh-replay-eyebrow">◉ SHOCK REPLAY / 2008</span>'+
      '<h3>Как распространялся кризис</h3>'+
      '<p>Шесть подтверждённых исторических этапов. Не график цен и не модель причинности.</p></div>'+
      '<span class="mh-replay-count">'+String(index+1).padStart(2,'0')+
      ' <i>/</i> '+String(STAGES.length).padStart(2,'0')+'</span></div>'+
      '<div class="mh-replay-rail" role="group" aria-label="Шесть этапов кризиса 2008 года">'+
      STAGES.map((item,i)=>'<button type="button" data-mh-replay-index="'+i+
        '" class="'+(i===index?'is-current':'')+'" aria-pressed="'+(i===index)+
        '" aria-label="Этап '+(i+1)+': '+escape(item.title)+', '+escape(item.iso)+'">'+
        '<span>'+String(i+1).padStart(2,'0')+'</span><strong>'+escape(item.date)+
        '</strong></button>').join('')+'</div>'+
      '<div class="mh-replay-progress" role="progressbar" aria-label="Прогресс хронологии" '+
      'aria-valuemin="0" aria-valuemax="'+STAGES.length+
      '" aria-valuenow="'+(index+1)+'"><span style="width:'+progress+'%"></span></div>'+
      '<article class="mh-replay-stage" aria-label="Выбранный этап хронологии">'+
      '<div class="mh-replay-stage-top"><span>'+escape(stage.label)+'</span>'+
      '<time datetime="'+stage.iso+'">'+escape(stage.iso)+'</time></div>'+
      '<h4>'+escape(stage.title)+'</h4>'+
      '<div class="mh-replay-fact"><b>ДОКУМЕНТИРОВАННЫЙ ФАКТ</b><p>'+
      escape(stage.fact)+'</p></div>'+
      '<div class="mh-replay-reading"><b>РЕДАКЦИОННОЕ ОБЪЯСНЕНИЕ</b><p>'+
      escape(stage.reading)+'</p></div>'+
      '<div class="mh-replay-bottom"><span>Канал: '+escape(stage.mechanism)+'</span>'+
      '<a href="'+escape(stage.url)+'" target="_blank" rel="noopener noreferrer" '+
      'aria-label="Открыть источник этапа '+(index+1)+': '+escape(stage.source)+'">'+
      escape(stage.source)+' ↗</a></div></article>'+
      '<div class="mh-replay-controls" role="group" aria-label="Управление воспроизведением">'+
      '<button type="button" data-mh-replay-action="prev" '+(index===0?'disabled':'')+
      ' aria-label="Предыдущий этап">← Назад</button>'+
      '<button type="button" class="mh-replay-play" data-mh-replay-action="toggle" aria-pressed="'+playing+'">'+
      (playing?'Ⅱ Пауза':'▶ Смотреть')+'</button>'+
      '<button type="button" data-mh-replay-action="next" '+(index===STAGES.length-1?'disabled':'')+
      ' aria-label="Следующий этап">Вперёд →</button>'+
      '<button type="button" class="mh-replay-speed" data-mh-replay-action="speed" '+
      'aria-label="Скорость перелистывания: '+speed+'x">'+speed+'×</button></div>'+
      '<p class="mh-replay-note">Даты и события подтверждены источниками; объяснения помечены отдельно. '+
      'Автоперелистывание включается только по нажатию. Никаких искусственных рыночных значений.</p>';
  }
  function schedule() {
    clearTimer();
    if (!playing || !host) return;
    timer=window.setTimeout(()=>{
      timer=0;
      if (!host || document.hidden || !playing) { pause(); return; }
      if (index===STAGES.length-1) { pause(); return; }
      index++;
      if (index===STAGES.length-1) {
        playing=false;
        render();
        return;
      }
      render();
      schedule();
    }, Math.round(DELAY/speed));
  }
  function choose(next, keepPlaying = false) {
    const value=Number(next);
    if (!Number.isInteger(value)||value<0||value>=STAGES.length) return;
    index=value;
    if (!keepPlaying) {clearTimer();playing=false;}
    render();
    if (playing) schedule();
  }
  function onClick(event) {
    if (!(event.target instanceof Element)) return;
    const stageButton=event.target.closest('[data-mh-replay-index]');
    const command=event.target.closest('[data-mh-replay-action]');
    if (!stageButton && !command) return;
    event.stopPropagation();
    if (stageButton) {
      choose(Number(stageButton.dataset.mhReplayIndex), playing);
      const focus=host?.querySelector('[data-mh-replay-index="'+index+'"]');
      focus?.focus({preventScroll:true});
      focus?.scrollIntoView?.({block:'nearest',inline:'nearest'});
      return;
    }
    const action=command.dataset.mhReplayAction;
    if (action==='toggle') {
      if (playing) {pause();}
      else {
        if (index===STAGES.length-1) index=0;
        playing=true;render();schedule();
      }
    } else if (action==='speed') {
      speed=speed===1?1.5:speed===1.5?2:1;
      render();if(playing)schedule();
    } else if (action==='prev') choose(index-1);
    else if (action==='next') choose(index+1);
    const focus=host?.querySelector('[data-mh-replay-action="'+action+'"]');
    focus?.focus({preventScroll:true});
  }
  function mount(element) {
    if (!element || element===host) return;
    unmount();
    host=element;
    index=0;
    speed=1;
    playing=false;
    host.addEventListener('click',onClick);
    render();
  }
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&playing)pause();});
  window.MarketShockReplay2008=Object.freeze({
    mount,unmount,pause,syncScene,
    get stages(){return STAGES.map(({id,iso,title,source,url})=>({id,iso,title,source,url}));},
    get state(){return {index,speed,playing,mounted:!!host};}
  });
})();