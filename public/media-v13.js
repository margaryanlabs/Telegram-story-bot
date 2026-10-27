/* VETO MEDIA V13 — IMMERSIVE SOUND STUDIO
 * Standalone WebView-friendly fullscreen audio UI. One shared HTMLAudioElement.
 * Moving visual field reflects play/pause + progress, NOT frequency analysis.
 * Original synthesized demo is generated locally on explicit user action.
 */
(()=>{
  'use strict';
  const $=id=>document.getElementById(id);
  const audio=$('audioEl')||$('audio');
  if(!audio || $('v13Studio'))return;
  const node=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=String(text);return n};
  const el=node('div','v13-studio');el.id='v13Studio';el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-label','VETO Immersive Sound Studio');el.setAttribute('aria-hidden','true');
  el.dataset.scene='ember';el.dataset.playing='false';
  el.innerHTML=`<div class="v13-aura" aria-hidden="true"><i></i><i></i><i></i></div>
    <div class="v13-grain" aria-hidden="true"></div><div class="v13-stars" aria-hidden="true"></div>
    <div class="v13-layout">
      <header class="v13-head"><div class="v13-brand"><span class="v13-monogram">V</span><span><b>VETO<span class="v13-brand-accent">MUSIC</span></b><small>IMMERSIVE SOUND STUDIO / 013</small></span></div>
        <div class="v13-headright"><span class="v13-quality"><i></i> PERSONAL SOUND EXPERIENCE</span><button type="button" id="v13Close" class="v13-close" aria-label="Закрыть плеер">×</button></div></header>
      <div class="v13-columns">
        <div class="v13-left"><div class="v13-section-label"><span class="v13-section-dot"></span> A DIFFERENT WAY TO FEEL MUSIC <span>01 / 02</span></div>
          <div class="v13-sphere" id="v13Sphere"><div class="v13-orbit v13-orbit-one"></div><div class="v13-orbit v13-orbit-two"></div><div class="v13-orbit v13-orbit-three"></div>
            <div class="v13-disc-wrap"><div class="v13-progress-halo" id="v13Halo"></div><div class="v13-disc" id="v13Disc"><div class="v13-disc-surface"><div class="v13-cover" id="v13Cover"><span>V</span><img id="v13Art" alt="Обложка текущего трека" hidden></div></div><div class="v13-center-dot"></div></div></div>
            <div class="v13-particles" aria-hidden="true"></div>
          </div>
          <div class="v13-wave-row" id="v13Waves" aria-hidden="true"></div>
          <div class="v13-stage-caption"><span>LIVE SOUNDSCAPE</span><span>VISUAL MOTION ENGINE</span></div>
        </div>
        <div class="v13-right"><div class="v13-player-top"><span class="v13-eyebrow">✦ &nbsp; NOW PLAYING</span><span class="v13-state" id="v13State">ГОТОВ К ЗАПУСКУ</span></div>
          <div class="v13-big-label">Lose yourself<br><em>in the sound.</em></div>
          <div class="v13-track-block"><span class="v13-track-kicker">YOUR AUDIO UNIVERSE</span><h1 id="v13Title">Включи свою волну</h1><p id="v13Artist">Выбери трек или попробуй звук VETO</p></div>
          <div class="v13-progress"><div class="v13-time"><span id="v13Current">0:00</span><span id="v13Duration">0:00</span></div><input id="v13Seek" type="range" min="0" max="1000" value="0" aria-label="Перемотка" step="1"></div>
          <div class="v13-controls"><button type="button" class="v13-small-control" id="v13Shuffle" aria-label="Включить или выключить перемешивание" title="Перемешивание">⇄</button><button type="button" class="v13-skip" id="v13Prev" aria-label="Предыдущий трек">|◀</button><button type="button" class="v13-main-control" id="v13Play" aria-label="Воспроизвести">▶</button><button type="button" class="v13-skip" id="v13Next" aria-label="Следующий трек">▶|</button><button type="button" class="v13-small-control" id="v13Repeat" aria-label="Режим повтора" title="Повтор">↻</button></div>
          <div class="v13-utility"><div><label for="v13Volume">ГРОМКОСТЬ</label><div class="v13-field"><span>◖))</span><input id="v13Volume" type="range" min="0" max="100" value="85" aria-label="Громкость" /></div></div>
            <div><label for="v13Speed">СКОРОСТЬ</label><select id="v13Speed"><option value="0.75">0.75×</option><option selected value="1">1×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option><option value="2">2×</option></select></div>
            <div><label for="v13Sleep">ТАЙМЕР СНА</label><select id="v13Sleep"><option value="0">Выкл.</option><option value="15">15 мин</option><option value="30">30 мин</option><option value="60">60 мин</option></select></div></div>
          <div class="v13-themes"><div class="v13-themes-title">CHOOSE YOUR ATMOSPHERE <span>02 / 02</span></div><div class="v13-theme-row">
            <button type="button" data-v13-scene="ember" class="active"><i></i><span>Ember Glow</span></button><button type="button" data-v13-scene="aurora"><i></i><span>Aurora</span></button><button type="button" data-v13-scene="noir"><i></i><span>Midnight</span></button></div></div>
          <div class="v13-bottom-actions"><button type="button" id="v13Demo" class="v13-demo">♫ &nbsp; Слушать тестовый звук VETO <span>↗</span></button><button type="button" id="v13Library" class="v13-library">Моя музыка →</button></div>
          <div class="v13-message" id="v13Message" role="status" aria-live="polite">Выбирай атмосферу. Цвет и движение реагируют на состояние воспроизведения.</div>
        </div></div>
      <footer class="v13-footer"><span>VETO / SOUND WITHOUT BOUNDARIES</span><span>ДИНАМИЧЕСКИЙ ФОН · НЕ ЧАСТОТНЫЙ АНАЛИЗ</span><span id="v13TimerReadout">MADE TO FEEL</span></footer>
    </div>`;
  document.body.append(el);
  const launcher=node('button','v13-launch','✦  IMMERSIVE PLAYER');launcher.id='v13Launch';launcher.type='button';launcher.setAttribute('aria-label','Открыть музыкальный плеер VETO');document.body.append(launcher);
  const home=$('home')||$('homeView');if(home){const a=node('button','v13-hero-entry','✦  Погрузиться в звук  ↗');a.type='button';a.addEventListener('click',open);home.append(a)}
  const waves=$('v13Waves');for(let i=0;i<47;i++){const b=node('i');b.style.setProperty('--i',String(i));b.style.setProperty('--delay',(i%17*-.083)+'s');b.style.setProperty('--sz',String(10+(i*17%52)));waves.append(b)}
  let demoUrl='',demoIndex=-1,demoShuffle=false,demoRepeat='all',deadline=0,sleepTimer=null,frame=0,lastFocused=null,wasOpen=false;
  const demos=[{title:'ORBIT / Afterglow',key:[0,7,12,19],base:110},{title:'NOCTURNE / Neon Rain',key:[0,3,7,10],base:123.47},{title:'AURORA / Velvet Sky',key:[0,5,9,14],base:130.81}];
  let prevTitle='',prevArtist='',prevCover='';
  function pick(...ids){for(const id of ids){const x=$(id);if(x)return x}return null}
  const fmt=seconds=>{if(!Number.isFinite(seconds)||seconds<0)return '0:00';const n=Math.floor(seconds);return Math.floor(n/60)+':'+String(n%60).padStart(2,'0')};
  function isDemo(){return !!(demoUrl&&audio.currentSrc===demoUrl || demoUrl&&audio.src===demoUrl)}
  function getTitle(){const text=pick('playerTitle','song')?.textContent?.trim();return text&&text!=='—'&&text!=='-'?text:'Включи свою волну'}
  function getArtist(){const text=pick('playerArtist','artist')?.textContent?.trim();return text&&text!=='—'&&text!=='-'?text:'Выбери трек или попробуй звук VETO'}
  function getArt(){const existing=pick('v4Art','v4Cover','cover');if(existing?.src&&existing.src.startsWith('https:')&&!existing.hidden)return existing.src;
    const bg=$('playerCover')?.style.backgroundImage||'';const matched=bg.match(/https:\/\/[^"'\)\s]+/);return matched?.[0]||''}
  function sync(){const playing=!audio.paused&&!audio.ended&&!!audio.currentSrc;
    el.dataset.playing=String(playing);$('v13State').textContent=playing?'●  СЕЙЧАС ИГРАЕТ':'○  ПАУЗА / ГОТОВ';$('v13Play').textContent=playing?'Ⅱ':'▶';$('v13Play').setAttribute('aria-label',playing?'Пауза':'Воспроизвести');
    const title=getTitle(),artist=getArtist();$('v13Title').textContent=title;$('v13Artist').textContent=artist;
    if(title!==prevTitle||artist!==prevArtist){const tint=((title.length*29+artist.length*17)%120-60);el.style.setProperty('--v13-tilt',tint+'deg');prevTitle=title;prevArtist=artist;}
    const image=$('v13Art'),art=getArt();if(art&&art!==prevCover){image.src=art;image.hidden=false;prevCover=art;}
    if(!art){image.hidden=true;prevCover=''}
    $('v13Current').textContent=fmt(audio.currentTime);$('v13Duration').textContent=fmt(audio.duration);
    const valid=Number.isFinite(audio.duration)&&audio.duration>0;
    if(valid){const percent=Math.max(0,Math.min(100,audio.currentTime/audio.duration*100));$('v13Seek').value=String(Math.round(percent*10));el.style.setProperty('--v13-progress',percent.toFixed(2)+'%');}
    else if(audio.paused){$('v13Seek').value='0';el.style.setProperty('--v13-progress','0%');}
    $('v13Seek').disabled=!valid;
    const sh=$('v9Shuffle'),rep=$('v9Repeat');$('v13Shuffle').hidden=!sh&&!isDemo();$('v13Repeat').hidden=!rep&&!isDemo();
    $('v13Shuffle').classList.toggle('active',sh?sh.getAttribute('aria-pressed')==='true':demoShuffle);
    $('v13Repeat').classList.toggle('active',rep?rep.classList.contains('active'):demoRepeat!=='off');
    $('v13Repeat').title=rep?rep.textContent:'Повтор: '+({all:'все',one:'один',off:'выкл.'})[demoRepeat];
    $('v13Volume').value=String(Math.round(audio.volume*100));$('v13Speed').value=String(audio.playbackRate);
    $('v13Demo').textContent=isDemo()?'♫  Переключить тестовый звук ↗':'♫  Слушать тестовый звук VETO ↗';
  }
  function open(){if(!wasOpen)lastFocused=document.activeElement;wasOpen=true;el.classList.add('open');el.setAttribute('aria-hidden','false');document.body.classList.add('v13-open');sync();window.VetoTelegramMedia?.syncBack?.();$('v13Close').focus()}
  function close(){wasOpen=false;el.classList.remove('open');el.setAttribute('aria-hidden','true');document.body.classList.remove('v13-open');window.VetoTelegramMedia?.syncBack?.();lastFocused?.focus?.();}
  launcher.addEventListener('click',open);$('v13Close').addEventListener('click',close);
  function switchScene(scene){if(!['ember','aurora','noir'].includes(scene))return;el.dataset.scene=scene;
    el.querySelectorAll('[data-v13-scene]').forEach(b=>{const yes=b.dataset.v13Scene===scene;b.classList.toggle('active',yes);b.setAttribute('aria-pressed',String(yes))});
    try{localStorage.setItem('veto-media-v13-scene',scene)}catch{}}
  el.querySelectorAll('[data-v13-scene]').forEach(b=>b.addEventListener('click',()=>switchScene(b.dataset.v13Scene)));
  try{switchScene(localStorage.getItem('veto-media-v13-scene')||'ember')}catch{switchScene('ember')}
  function playToggle(){if(audio.paused)audio.play().catch(()=>message('Не удалось воспроизвести. Попробуй тестовый звук.'));else audio.pause()}
  $('v13Play').addEventListener('click',playToggle);
  function step(delta){if(isDemo()){const next=demoShuffle&&delta>0?Math.floor(Math.random()*(demos.length-1))+(demoIndex===0?1:0):(demoIndex+delta+demos.length)%demos.length;demo(next);return;}
    pick(delta<0?'prevButton':'nextButton',delta<0?'prev':'next')?.click();}
  $('v13Prev').addEventListener('click',()=>step(-1));$('v13Next').addEventListener('click',()=>step(1));
  $('v13Shuffle').addEventListener('click',()=>{const other=$('v9Shuffle');if(other&&!isDemo())other.click();else{demoShuffle=!demoShuffle;message(demoShuffle?'Тестовые композиции перемешиваются':'Перемешивание выключено');}sync()});
  $('v13Repeat').addEventListener('click',()=>{const other=$('v9Repeat');if(other&&!isDemo())other.click();else{demoRepeat=demoRepeat==='all'?'one':demoRepeat==='one'?'off':'all';message('Повтор тестового звука: '+({all:'все',one:'один',off:'выкл.'})[demoRepeat]);}sync()});
  $('v13Seek').addEventListener('input',()=>{if(Number.isFinite(audio.duration)&&audio.duration>0)audio.currentTime=audio.duration*Number($('v13Seek').value)/1000;sync()});
  $('v13Volume').addEventListener('input',()=>{audio.volume=Number($('v13Volume').value)/100;const v=$('v8Volume');if(v)v.value=$('v13Volume').value});
  $('v13Speed').addEventListener('change',()=>{audio.playbackRate=Number($('v13Speed').value);const v=$('v8Speed');if(v)v.value=$('v13Speed').value});
  function message(text){$('v13Message').textContent=text}
  function timer(){if(!deadline)return;const left=Math.ceil((deadline-Date.now())/1000);if(left<=0){audio.pause();deadline=0;clearInterval(sleepTimer);sleepTimer=null;$('v13Sleep').value='0';$('v13TimerReadout').textContent='ТАЙМЕР ЗАВЕРШЁН';return;}
    $('v13TimerReadout').textContent='СОН ЧЕРЕЗ '+Math.floor(left/60)+':'+String(left%60).padStart(2,'0')}
  $('v13Sleep').addEventListener('change',()=>{if(sleepTimer)clearInterval(sleepTimer);const mins=Number($('v13Sleep').value);deadline=mins?Date.now()+mins*60000:0;if(mins){timer();sleepTimer=setInterval(timer,1000)}else{$('v13TimerReadout').textContent='MADE TO FEEL';sleepTimer=null}});
  $('v13Library').addEventListener('click',()=>{close();const b=document.querySelector('[data-page="music"],[data-tab="music"]');b?.click();$('v8LocalQueue')?.scrollIntoView({behavior:'smooth',block:'center'})});
  document.addEventListener('keydown',e=>{if(!el.classList.contains('open'))return;
    if(e.key==='Escape'){e.stopPropagation();close();return}
    if(e.key==='Tab'){const els=[...el.querySelectorAll('button:not([hidden]):not(:disabled),input:not(:disabled),select:not(:disabled)')];const first=els[0],last=els.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}
  },true);
  const demoData=()=>{
    // 20 seconds of original, generated-only ambient music, 16 kHz mono PCM WAV.
    const d=demos[demoIndex],rate=16000,secs=20,frames=rate*secs,bytes=44+frames*2;
    const buffer=new ArrayBuffer(bytes),view=new DataView(buffer);let p=0;
    const str=s=>{for(let i=0;i<s.length;i++)view.setUint8(p++,s.charCodeAt(i))};const u16=n=>{view.setUint16(p,n,true);p+=2};const u32=n=>{view.setUint32(p,n,true);p+=4};
    str('RIFF');u32(bytes-8);str('WAVEfmt ');u32(16);u16(1);u16(1);u32(rate);u32(rate*2);u16(2);u16(16);str('data');u32(frames*2);
    const notes=d.key.map(n=>d.base*Math.pow(2,n/12));let prev=0;const twoPI=Math.PI*2;
    for(let i=0;i<frames;i++){
      const t=i/rate,fade=Math.min(1,t/1.5,(secs-t)/2),sway=.74+.26*Math.sin(twoPI*t/7);
      let sample=0;
      for(let j=0;j<notes.length;j++){
        const hz=notes[j],slow=Math.sin(twoPI*(hz*t+.00016*t*t*hz));
        sample+=(slow*.35+Math.sin(twoPI*(hz*.502*t))*.20+Math.sin(twoPI*(hz*1.999*t))*.065)*(1+.14*Math.sin(twoPI*t/(3.1+j)))/(j+1);
      }
      const pulseTime=t%1.25;const beat=Math.exp(-pulseTime*15)*Math.sin(twoPI*51*pulseTime);
      const shimmer=Math.sin(twoPI*notes[2]*2.005*t)*(.07+.03*Math.sin(twoPI*t*.25));
      const val=(sample*.36*sway +beat*.095+shimmer)*Math.max(0,fade);prev=prev*.24+val*.76;
      view.setInt16(p,Math.round(Math.max(-1,Math.min(1,prev))*32760),true);p+=2;
    }
    return new Blob([buffer],{type:'audio/wav'});
  };
  function demo(index){
    demoIndex=index;const d=demos[index];if(demoUrl){if(isDemo())audio.pause();URL.revokeObjectURL(demoUrl);demoUrl=''}
    demoUrl=URL.createObjectURL(demoData());
    const label=pick('song','playerTitle'),artist=pick('artist','playerArtist');if(label)label.textContent=d.title;if(artist)artist.textContent='VETO ORIGINAL · TEST SOUND';
    const player=$('player');player?.classList.remove('hidden');
    audio.src=demoUrl;audio.load();message('Это оригинальный тестовый звук VETO, синтезированный локально. Не трек из внешнего каталога.');
    sync();audio.play().catch(()=>message('Автовоспроизведение заблокировано — нажми центральную кнопку ▶.'));
  }
  $('v13Demo').addEventListener('click',()=>demo((demoIndex+1)%demos.length));
  audio.addEventListener('ended',e=>{if(isDemo()){e.stopImmediatePropagation();const idx=demoIndex;sync();if(demoRepeat==='one')demo(idx);else if(demoRepeat==='all')step(1);}},true);
  audio.addEventListener('loadstart',()=>{if(demoUrl&&audio.src!==demoUrl){URL.revokeObjectURL(demoUrl);demoUrl='';demoIndex=-1;}});
  window.addEventListener('pagehide',()=>{if(demoUrl){URL.revokeObjectURL(demoUrl);demoUrl='';}if(sleepTimer)clearInterval(sleepTimer)});
  for(const name of ['play','pause','loadedmetadata','timeupdate','durationchange','seeked','emptied','error','ended','volumechange','ratechange'])audio.addEventListener(name,sync);
  const frameLoop=()=>{frame=0;if(el.classList.contains('open'))sync();};
  const obs=pick('playerTitle','song');if(obs)new MutationObserver(frameLoop).observe(obs,{childList:true,characterData:true,subtree:true});
  const other=pick('playerArtist','artist');if(other)new MutationObserver(frameLoop).observe(other,{childList:true,characterData:true,subtree:true});
  window.VetoSoundStudio=Object.freeze({open,close,demo:()=>demo(0),isOpen:()=>el.classList.contains('open')});
  sync();
})();