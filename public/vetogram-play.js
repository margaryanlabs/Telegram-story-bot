/* Vetogram Play: two small offline games. No Telegram messages, account data or remote calls. */
(() => {
  'use strict';
  const root = document.querySelector('.screen[data-screen="play"]');
  if (!root) return;
  const $ = selector => root.querySelector(selector);
  const tg = window.Telegram?.WebApp;
  const BEST_REACTION = 'vetogram:play:reaction-best:v1';
  const BEST_MEMORY = 'vetogram:play:memory-best:v1';
  const readBest = key => {
    try {
      const n = Number(window.localStorage.getItem(key));
      return Number.isFinite(n) && n > 0 ? n : null;
    } catch { return null; }
  };
  const writeBest = (key, value) => {
    try { window.localStorage.setItem(key, String(value)); } catch {}
  };
  const haptic = type => {
    try { tg?.HapticFeedback?.impactOccurred(type || 'light'); } catch {}
  };
  const announce = (el, text) => { if (el) el.textContent = text; };
  const reactionButton = $('#vpReactionButton');
  const reactionInfo = $('#vpReactionInfo');
  const reactionBest = $('#vpReactionBest');
  let reactionState = 'idle';
  let reactionTimeout = null;
  let reactionStarted = 0;
  const now = () => window.performance?.now?.() ?? Date.now();

  function reactionSet(state, label) {
    reactionState = state;
    reactionButton.dataset.state = state;
    reactionButton.textContent = label;
  }
  function reactionCancel() {
    if (reactionTimeout !== null) clearTimeout(reactionTimeout);
    reactionTimeout = null;
    reactionSet('idle', 'Начать проверку реакции');
    announce(reactionInfo, 'Дождись светлого сигнала. Раннее касание не считается.');
  }
  function reactionStart() {
    reactionCancel();
    reactionSet('waiting', 'Жди сигнала…');
    announce(reactionInfo, 'Не нажимай, пока кнопка не станет светлой.');
    reactionTimeout = window.setTimeout(() => {
      reactionTimeout = null;
      reactionStarted = now();
      reactionSet('ready', 'ЖМИ СЕЙЧАС');
      announce(reactionInfo, 'Сигнал!');
      haptic('medium');
    }, 900 + Math.floor(Math.random() * 1900));
  }
  reactionButton?.addEventListener('click', () => {
    if (reactionState === 'waiting') {
      reactionCancel();
      reactionSet('result', 'Раньше времени — повторить');
      announce(reactionInfo, 'Слишком рано. Попробуй ещё раз.');
      haptic('heavy');
      return;
    }
    if (reactionState === 'ready') {
      const elapsed = Math.max(1, Math.round(now() - reactionStarted));
      const best = readBest(BEST_REACTION);
      if (best === null || elapsed < best) writeBest(BEST_REACTION, elapsed);
      reactionSet('result', 'Повторить попытку');
      announce(reactionInfo, `Твоя реакция: ${elapsed} мс. ${best === null || elapsed < best ? 'Новый личный рекорд!' : 'Попробуй улучшить результат.'}`);
      refreshScores();
      haptic('light');
      return;
    }
    reactionStart();
  });

  const memoryGrid = $('#vpMemoryGrid');
  const memoryInfo = $('#vpMemoryInfo');
  const memoryBest = $('#vpMemoryBest');
  const memoryReset = $('#vpMemoryReset');
  const suits = ['♠', '♥', '♣', '♦'];
  let memoryCards = [];
  let openCards = [];
  let matched = new Set();
  let memoryTurns = 0;
  let memoryLocked = false;
  let memoryTimeout = null;

  function randomCards() {
    const items = [...suits, ...suits];
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }
  function refreshScores() {
    const r = readBest(BEST_REACTION), m = readBest(BEST_MEMORY);
    announce(reactionBest, r ? `Рекорд на устройстве: ${r} мс` : 'Рекорд: ещё нет');
    announce(memoryBest, m ? `Рекорд на устройстве: ${m} ходов` : 'Рекорд: ещё нет');
  }
  function displayMemory() {
    if (!memoryGrid) return;
    memoryGrid.replaceChildren();
    memoryCards.forEach((suit, idx) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'vp-memory-card';
      card.dataset.revealed = String(openCards.includes(idx));
      card.dataset.matched = String(matched.has(idx));
      card.textContent = openCards.includes(idx) || matched.has(idx) ? suit : '✦';
      card.setAttribute('aria-label', matched.has(idx) ? 'Найдена пара' : openCards.includes(idx) ? `Карта ${suit}` : `Скрытая карта ${idx + 1}`);
      card.disabled = matched.has(idx) || memoryLocked || openCards.includes(idx);
      card.addEventListener('click', () => openMemory(idx));
      memoryGrid.appendChild(card);
    });
  }
  function resetMemory() {
    if (memoryTimeout !== null) clearTimeout(memoryTimeout);
    memoryTimeout = null;
    memoryCards = randomCards();
    openCards = [];
    matched = new Set();
    memoryTurns = 0;
    memoryLocked = false;
    announce(memoryInfo, 'Найди четыре пары. Меньше ходов — лучше результат.');
    displayMemory();
  }
  function openMemory(idx) {
    if (memoryLocked || matched.has(idx) || openCards.includes(idx)) return;
    openCards.push(idx);
    haptic('light');
    if (openCards.length === 2) {
      memoryTurns += 1;
      const [a, b] = openCards;
      if (memoryCards[a] === memoryCards[b]) {
        matched.add(a); matched.add(b); openCards = [];
        announce(memoryInfo, `Ходы: ${memoryTurns}. Совпадение! ${matched.size / 2} из 4 пар.`);
        if (matched.size === memoryCards.length) {
          const best = readBest(BEST_MEMORY);
          if (best === null || memoryTurns < best) writeBest(BEST_MEMORY, memoryTurns);
          announce(memoryInfo, `Все пары собраны за ${memoryTurns} ходов! ${best === null || memoryTurns < best ? 'Новый рекорд!' : 'Сыграй ещё раз.'}`);
          refreshScores();
        }
      } else {
        memoryLocked = true;
        announce(memoryInfo, `Ходы: ${memoryTurns}. Пара не совпала.`);
        memoryTimeout = window.setTimeout(() => {
          memoryTimeout = null;
          openCards = [];
          memoryLocked = false;
          displayMemory();
        }, 780);
      }
    }
    displayMemory();
  }
  memoryReset?.addEventListener('click', () => { haptic('light'); resetMemory(); });
  function stopBackgroundTimers() {
    if (reactionState === 'waiting' || reactionState === 'ready') reactionCancel();
    // A pending mismatched pair is a transient view, not saved progress.
    // Reset it so delayed callbacks cannot mutate an already closed game.
    if (memoryTimeout !== null) resetMemory();
  }
  window.addEventListener('vetogram:game-close', event => {
    if (event?.detail?.game === 'reaction' && (reactionState === 'waiting' || reactionState === 'ready')) reactionCancel();
    if (event?.detail?.game === 'pairs' && memoryTimeout !== null) resetMemory();
  });
  window.addEventListener('veto:screen-changed', event => {
    if (event?.detail?.screen !== 'play') stopBackgroundTimers();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopBackgroundTimers();
  });
  reactionCancel();
  resetMemory();
  refreshScores();

  // V9 Arcade: progressive enhancement over the SIX real, existing game
  // controllers. No game logic, account data, persistence or remote APIs change.
  const v9Launcher=$('#v9ArcadeLauncher');
  const v9Back=$('#v9ArcadeBack');
  const v9Grid=$('#vpQuickGames');
  const v9Games=[...root.querySelectorAll('#vpQuickGames > .vp-mini[data-vp-game]')];
  const v9Allowed=new Set(['reaction','pairs','tic','2048','mines','snake']);
  let v9Active='';
  const v9Notify=()=>window.dispatchEvent(new CustomEvent('vetogram:game-view-changed'));
  const v9Catalog=({scroll=false}={})=>{
    if(v9Active)window.dispatchEvent(new CustomEvent('vetogram:game-close',{detail:{game:v9Active}}));
    v9Active='';
    v9Games.forEach(item=>{item.hidden=false;});
    root.classList.remove('v9-arcade-active');
    delete root.dataset.v9ActiveGame;
    if(v9Back)v9Back.hidden=true;
    v9Notify();
    if(scroll) v9Launcher?.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
  };
  const v9Open=name=>{
    if(!v9Allowed.has(name)||!v9Grid||!v9Games.some(item=>item.dataset.vpGame===name))return false;
    if(v9Active&&v9Active!==name)window.dispatchEvent(new CustomEvent('vetogram:game-close',{detail:{game:v9Active}}));
    v9Active=name;
    v9Games.forEach(item=>{item.hidden=item.dataset.vpGame!==name;});
    root.classList.add('v9-arcade-active');
    root.dataset.v9ActiveGame=name;
    if(v9Back)v9Back.hidden=false;
    v9Notify();
    v9Grid.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
    return true;
  };
  // Keep old game UI fully operational if this new launcher is unavailable.
  if(v9Launcher&&v9Grid&&v9Back&&v9Games.length===6){
    v9Launcher.querySelectorAll('[data-v9-launch]').forEach(button=>{
      button.addEventListener('click',()=>{if(v9Open(button.dataset.v9Launch))haptic('light');});
    });
    v9Back.addEventListener('click',()=>v9Catalog({scroll:true}));
    root.classList.add('v9-arcade-enhanced');
    v9Launcher.hidden=false;
    window.VetogramV9GameIsOpen=()=>!!v9Active;
    window.VetogramV9GameBack=()=>{if(!v9Active)return false;v9Catalog({scroll:true});return true;};
    window.addEventListener('veto:screen-changed',event=>{
      if(event?.detail?.screen!=='play'&&v9Active)v9Catalog();
    });
  }
})();
