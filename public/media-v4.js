/* VETO MEDIA V4 — standalone home and immersive music UI; no user-session access. */
(() => {
  "use strict";
  const $=id=>document.getElementById(id);
  if (!$("homeView")) return;
  document.body.classList.add("veto-v4");
  function node(tag,cls,txt){const x=document.createElement(tag);if(cls)x.className=cls;if(txt!==undefined)x.textContent=String(txt);return x}
  function nav(target,query){
    const b=document.querySelector('.tab[data-tab="'+target+'"]');
    if(!b)return;b.click();
    document.querySelectorAll(".v4-dock button").forEach(x=>x.classList.toggle("active",x.dataset.open===target));
    if(query){const input=$("searchInput");input.value=query;input.dispatchEvent(new Event("input",{bubbles:true}));}
    $("searchSection")?.scrollIntoView({behavior:"smooth",block:"start"});
  }
  const hero=node("div");
  hero.innerHTML='<div class="v4-home-hero"><div class="v4-home-copy"><small>VETO MEDIA / ENTER THE EXPERIENCE</small><h1>Не просто<br>контент.<br><em>Целая вселенная.</em></h1><p>Музыка, которая чувствуется. Кино, в которое проваливаешься. Книги, в которых остаёшься. Один мир развлечений внутри Telegram.</p><div class="v4-home-actions"><button type="button" data-v4-open="music">♫ Почувствовать музыку</button><button type="button" data-v4-open="films">◉ Открыть кино</button></div><div class="v4-home-shortcuts"><button type="button" data-v4-search="ambient">✦ Ambient</button><button type="button" data-v4-search="synthwave">◈ Synthwave</button><button type="button" data-v4-search="jazz">♫ Jazz</button><button type="button" data-v4-open="audiobooks">◎ Аудиокниги</button></div></div><div class="v4-home-scene" aria-hidden="true"><div class="v4-home-orb"></div><div class="v4-floating first"><b>♫ VETO SOUND</b><small>Listen differently</small></div><div class="v4-floating second"><b>◉ VETO CINEMA</b><small>Stay in the story</small></div><div class="v4-floating third"><b>▤ VETO BOOKS</b><small>Reading Lab</small></div></div></div><div class="v4-home-heading"><small>HANDPICKED EXPERIENCES</small><h2>Выбирай не раздел. Выбирай настроение.</h2></div><div class="v4-world-cards"><button type="button" data-v4-search="ambient"><span><small>01 / SOUND JOURNEY</small><strong>На одной волне ↗</strong></span></button><button type="button" data-v4-open="films"><span><small>02 / CINEMA WORLDS</small><strong>Истории после полуночи ↗</strong></span></button><button type="button" data-v4-open="books"><span><small>03 / READING LAB</small><strong>Тишина между строк ↗</strong></span></button></div>';
  $("homeView").append(...Array.from(hero.childNodes));
  document.querySelectorAll("[data-v4-open]").forEach(b=>b.addEventListener("click",()=>nav(b.dataset.v4Open)));
  document.querySelectorAll("[data-v4-search]").forEach(b=>b.addEventListener("click",()=>nav("music",b.dataset.v4Search)));
  const dock=node("nav","v4-dock");dock.setAttribute("aria-label","Навигация VETO MEDIA");
  for(const [id,label,symbol] of [["home","Главная","⌂"],["discover","Поиск","⌕"],["music","Музыка","♫"],["films","Кино","◉"],["books","Книги","▤"],["library","Моё","♡"]]){
    const b=node("button",id==="home"?"active":"");b.dataset.open=id;b.type="button";
    b.append(node("span","",symbol),node("small","",label));
    b.addEventListener("click",()=>nav(id));dock.append(b);
  }
  document.body.append(dock);
  const launch=node("button","v4-listen-trigger hidden","♫ Listening Room ↗");
  launch.id="v4ListenLaunch";launch.type="button";document.body.append(launch);
  const modal=node("div","v4-listening");modal.id="v4Listening";modal.dataset.theme="pulse";
  modal.setAttribute("role","dialog");modal.setAttribute("aria-modal","true");modal.setAttribute("aria-label","Полноэкранный плеер");
  modal.innerHTML='<div class="v4-listening-shell"><div class="v4-listening-top"><span>VETO <em>LISTENING ROOM</em></span><button type="button" id="v4ListenClose" aria-label="Закрыть">×</button></div><div class="v4-listening-main"><div class="v4-listening-art"><div class="v4-record"><img id="v4Cover" class="v4-record-art" src="" alt="" hidden></div><div class="v4-equalizer" aria-hidden="true">'+('<i></i>'.repeat(18))+'</div></div><div class="v4-detail"><small>NOW LISTENING / SOUND EXPERIENCE</small><h2 id="v4TrackName">Включи свою волну</h2><p id="v4ArtistName">Выбери трек из VETO Music</p><div class="v4-progress"><span id="v4TimeNow">0:00</span><input type="range" id="v4TimeSeek" aria-label="Перемотка" min="0" max="1000" value="0"><span id="v4TimeLength">0:00</span></div><div class="v4-listening-controls"><button type="button" id="v4PrevTrack" aria-label="Предыдущий">⏮</button><button type="button" class="main" id="v4PlayPause" aria-label="Воспроизвести">▶</button><button type="button" id="v4NextTrack" aria-label="Следующий">⏭</button></div><div class="v4-themes"><button type="button" class="active" data-theme="pulse">✦ Pulse</button><button type="button" data-theme="aurora">◈ Aurora</button><button type="button" data-theme="midnight">☾ Midnight</button></div><p class="v4-source-note">Анимация отражает состояние воспроизведения, а не частоты аудио. Музыка — Audius; доступность зависит от источника.</p></div></div></div>';
  document.body.append(modal);
  const audio=$("audio");
  function fmt(n){if(!Number.isFinite(n)||n<0)return"0:00";const s=Math.floor(n);return Math.floor(s/60)+":"+String(s%60).padStart(2,"0")}
  function safe(v){try{const u=new URL(String(v));return u.protocol==="https:"?u.href:""}catch{return""}}
  function refresh(){
    $("v4TrackName").textContent=$("playerTitle")?.textContent||"Включи свою волну";
    $("v4ArtistName").textContent=$("playerArtist")?.textContent||"Выбери трек из VETO Music";
    const imageCSS=$("playerCover")?.style.backgroundImage||"";
    const match=imageCSS.match(/url\(["']?(https:\/\/[^)"']+)/);
    const url=safe(match?.[1]||"");const img=$("v4Cover");img.hidden=!url;if(url)img.src=url;
    const isPlaying=!!audio&&!audio.paused&&!audio.ended;
    modal.classList.toggle("is-playing",isPlaying);
    $("v4PlayPause").textContent=isPlaying?"Ⅱ":"▶";
    $("v4TimeNow").textContent=fmt(audio?.currentTime);
    $("v4TimeLength").textContent=fmt(audio?.duration);
    if(audio&&Number.isFinite(audio.duration)&&audio.duration>0)$("v4TimeSeek").value=String(Math.round(audio.currentTime/audio.duration*1000));
    launch.classList.toggle("hidden",$("player")?.classList.contains("hidden")||modal.classList.contains("open"));
  }
  const open=()=>{modal.classList.add("open");document.body.classList.add("v4-listening-open");refresh();$("v4ListenClose").focus()};
  const close=()=>{modal.classList.remove("open");document.body.classList.remove("v4-listening-open");refresh()};
  launch.addEventListener("click",open);$("v4ListenClose").addEventListener("click",close);
  $("v4PlayPause").addEventListener("click",()=>{$("playButton")?.click();refresh()});
  $("v4PrevTrack").addEventListener("click",()=>{$("prevButton")?.click();setTimeout(refresh,100)});
  $("v4NextTrack").addEventListener("click",()=>{$("nextButton")?.click();setTimeout(refresh,100)});
  $("v4TimeSeek").addEventListener("input",()=>{if(!audio||!Number.isFinite(audio.duration)||audio.duration<=0)return;audio.currentTime=Number($("v4TimeSeek").value)*audio.duration/1000;refresh()});
  document.querySelectorAll(".v4-themes button").forEach(b=>b.addEventListener("click",()=>{
    modal.dataset.theme=b.dataset.theme;document.querySelectorAll(".v4-themes button").forEach(x=>x.classList.toggle("active",x===b));
    try{localStorage.setItem("veto-media-v4-theme",b.dataset.theme)}catch{}
  }));
  try{document.querySelector('.v4-themes button[data-theme="'+localStorage.getItem("veto-media-v4-theme")+'"]')?.click()}catch{}
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&modal.classList.contains("open"))close()});
  ["play","pause","ended","loadedmetadata","timeupdate","error"].forEach(evt=>audio?.addEventListener(evt,refresh));
  if($("player"))new MutationObserver(refresh).observe($("player"),{attributes:true,attributeFilter:["class"]});
  refresh();
})();