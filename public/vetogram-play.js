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
  window.addEventListener('veto:screen-changed', event => {
    if (event?.detail?.screen !== 'play') {
      if (reactionState === 'waiting' || reactionState === 'ready') reactionCancel();
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && (reactionState === 'waiting' || reactionState === 'ready')) reactionCancel();
  });
  reactionCancel();
  resetMemory();
  refreshScores();
})();
