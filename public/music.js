/* Vetogram Music: openly-licensed discovery only.
   Sources: Openverse (https://api.openverse.org/v1/).
   VK/Yandex playback is intentionally NOT implemented: no distribution license.
*/
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const API = 'https://api.openverse.org/v1/audio/';
  const FAVORITES_KEY = 'vetogram:music:favorites:v1';
  const ACCEPTED = new Set(['cc0', 'pdm', 'by']);
  const state = { tracks: [], favorites: [], view: 'all', query: 'electronic', page: 1, pageCount: 1, loading: false, controller: null, active: null };
  const audio = $('audio');
  const tg = window.Telegram && window.Telegram.WebApp;
  try { if (tg) { tg.ready(); tg.expand(); } } catch (_) {}

  function message(value) { $('message').textContent = value || ''; }
  function safeUrl(raw) {
    if (typeof raw !== 'string') return '';
    try { const u = new URL(raw); return u.protocol === 'https:' ? u.href : ''; } catch (_) { return ''; }
  }
  function formatTime(sec) {
    sec = Math.max(0, Math.floor(Number(sec) || 0));
    return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
  }
  function normalize(item) {
    if (!item || !ACCEPTED.has(String(item.license || '').toLowerCase()) || item.mature) return null;
    const stream = safeUrl(item.url);
    const source = safeUrl(item.foreign_landing_url);
    const licenseUrl = safeUrl(item.license_url);
    if (!stream || !source || !licenseUrl || !item.id) return null;
    if (item.category && item.category !== 'music') return null;
    return {
      id: String(item.id).slice(0, 120),
      title: String(item.title || 'Без названия').slice(0, 200),
      artist: String(item.creator || 'Неизвестный исполнитель').slice(0, 200),
      cover: safeUrl(item.thumbnail),
      stream, source, licenseUrl,
      license: String(item.license).toUpperCase(),
      duration: Math.max(0, Number(item.duration) || 0) / 1000
    };
  }
  function loadFavorites() {
    try {
      const parsed = JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]');
      if (Array.isArray(parsed)) return parsed.slice(0, 120).map(normalizeFavorite).filter(Boolean);
    } catch (_) {}
    return [];
  }
  function normalizeFavorite(t) {
    if (!t || !t.id || !safeUrl(t.stream) || !safeUrl(t.source) || !safeUrl(t.licenseUrl) || !ACCEPTED.has(String(t.license).toLowerCase())) return null;
    return {
      id: String(t.id).slice(0, 120), title: String(t.title || '').slice(0, 200),
      artist: String(t.artist || '').slice(0, 200), cover: safeUrl(t.cover),
      stream: safeUrl(t.stream), source: safeUrl(t.source), licenseUrl: safeUrl(t.licenseUrl),
      license: String(t.license).toUpperCase(), duration: Number(t.duration) || 0
    };
  }
  state.favorites = loadFavorites();
  function hasFavorite(track) { return state.favorites.some(t => t.id === track.id); }
  function persistFavorites() {
    try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(state.favorites)); } catch (_) { message('Не удалось сохранить избранное на этом устройстве.'); }
    $('favoriteCount').textContent = String(state.favorites.length);
  }
  function toggleFavorite(track) {
    if (hasFavorite(track)) state.favorites = state.favorites.filter(t => t.id !== track.id);
    else state.favorites = [track].concat(state.favorites).slice(0, 120);
    persistFavorites();
    render();
    updatePlayer();
  }
  function element(tag, className, label) {
    const x = document.createElement(tag);
    if (className) x.className = className;
    if (label !== undefined) x.textContent = label;
    return x;
  }
  function createTrackCard(track) {
    const card = element('article', 'track' + (state.active && state.active.id === track.id ? ' playing' : ''));
    const cover = element('div', 'cover', '♫');
    if (track.cover) {
      const image = document.createElement('img'); image.src = track.cover;
      image.alt = ''; image.loading = 'lazy'; image.decoding = 'async';
      image.addEventListener('error', () => image.remove());
      cover.append(image);
    }
    const play = element('button', 'play-overlay', state.active && state.active.id === track.id && !audio.paused ? 'Ⅱ' : '▶');
    play.type = 'button'; play.setAttribute('aria-label', 'Слушать: ' + track.title);
    play.addEventListener('click', () => choose(track)); cover.append(play);
    const body = element('div', 'track-body');
    const title = element('div', 'track-title', track.title); title.title = track.title;
    const artist = element('div', 'track-artist', track.artist); artist.title = track.artist;
    const foot = element('div', 'track-foot');
    const license = element('span', 'license', track.license + ' · ' + (track.duration ? formatTime(track.duration) : 'Аудио'));
    const buttons = element('div', 'track-controls');
    const favorite = element('button', hasFavorite(track) ? 'saved' : '', hasFavorite(track) ? '♥' : '♡');
    favorite.type = 'button'; favorite.setAttribute('aria-label', hasFavorite(track) ? 'Убрать из избранного' : 'Добавить в избранное');
    favorite.addEventListener('click', () => toggleFavorite(track));
    const source = element('a', '', 'Источник ↗'); source.href = track.source; source.target = '_blank'; source.rel = 'noopener noreferrer'; source.title = 'Открыть страницу оригинала';
    buttons.append(favorite, source); foot.append(license, buttons);
    body.append(title, artist, foot); card.append(cover, body);
    return card;
  }
  function activeList() { return state.view === 'favorites' ? state.favorites : state.tracks; }
  function render() {
    const list = $('trackList');
    list.replaceChildren();
    const tracks = activeList();
    for (const track of tracks) list.append(createTrackCard(track));
    $('allButton').classList.toggle('on', state.view === 'all');
    $('favoritesButton').classList.toggle('on', state.view === 'favorites');
    $('allButton').setAttribute('aria-pressed', String(state.view === 'all'));
    $('favoritesButton').setAttribute('aria-pressed', String(state.view === 'favorites'));
    $('catalogTitle').textContent = state.view === 'favorites' ? 'Твои любимые' : 'Открой новое';
    $('searchSubtitle').textContent = state.view === 'favorites' ? 'Сохранено на этом устройстве' : 'Открыто лицензированные композиции · ' + state.query;
    $('loadMore').hidden = state.view !== 'all' || state.loading || state.page >= state.pageCount;
    if (!state.loading) message(tracks.length ? '' : (state.view === 'favorites' ? 'Сохрани понравившиеся треки — они появятся здесь.' : 'Ничего не найдено. Попробуй другой запрос.'));
  }
  async function search(query, append = false) {
    const q = String(query || '').trim().slice(0, 100);
    if (!q) return;
    if (state.controller) state.controller.abort();
    const controller = new AbortController();
    state.controller = controller;
    const page = append ? state.page + 1 : 1;
    state.loading = true;
    state.query = q;
    state.view = 'all';
    $('loadMore').hidden = true;
    message('Ищем музыку…');
    try {
      const params = new URLSearchParams({
        q, page: String(page), page_size: '24',
        license: 'cc0,pdm,by', category: 'music', filter_dead: 'true'
      });
      const response = await fetch(API + '?' + params.toString(), { signal: controller.signal, credentials: 'omit', headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(response.status === 429 ? 'Лимит запросов. Попробуй чуть позже.' : 'Каталог временно недоступен (' + response.status + ').');
      const data = await response.json();
      const incoming = (Array.isArray(data.results) ? data.results : []).map(normalize).filter(Boolean);
      state.tracks = append ? state.tracks.concat(incoming.filter(t => !state.tracks.some(old => old.id === t.id))) : incoming;
      state.page = page;
      state.pageCount = Math.max(1, Number(data.page_count) || 1);
      state.loading = false; render();
    } catch (error) {
      if (error && error.name === 'AbortError') return;
      state.loading = false;
      $('loadMore').hidden = true;
      message((error && error.message) || 'Нет соединения с музыкальным каталогом. Попробуй позже.');
    }
  }
  function updatePlayer() {
    const track = state.active;
    if (!track) return;
    $('player').hidden = false;
    $('playerTitle').textContent = track.title;
    $('playerArtist').textContent = track.artist;
    const art = $('playerArt'); art.replaceChildren();
    if (track.cover) { const img = document.createElement('img'); img.src = track.cover; img.alt = ''; img.addEventListener('error', () => { art.textContent = '♫'; }); art.append(img); }
    else art.textContent = '♫';
    $('playButton').textContent = audio.paused ? '▶' : 'Ⅱ';
    $('playButton').setAttribute('aria-label', audio.paused ? 'Воспроизвести' : 'Пауза');
    $('sourceLink').href = track.source;
    $('playerHeart').textContent = hasFavorite(track) ? '♥' : '♡';
    $('playerHeart').classList.toggle('saved', hasFavorite(track));
    $('totalTime').textContent = formatTime(Number.isFinite(audio.duration) ? audio.duration : track.duration);
    renderPlayingHighlights();
  }
  function renderPlayingHighlights() {
    for (const card of $('trackList').children) {
      const idx = Array.prototype.indexOf.call($('trackList').children, card);
      const item = activeList()[idx];
      card.classList.toggle('playing', !!item && !!state.active && item.id === state.active.id);
      const btn = card.querySelector('.play-overlay');
      if (btn) btn.textContent = item && state.active && item.id === state.active.id && !audio.paused ? 'Ⅱ' : '▶';
    }
  }
  async function choose(track) {
    if (state.active && state.active.id === track.id) {
      if (!audio.paused) audio.pause();
      else await tryPlay();
      return;
    }
    audio.pause();
    state.active = track;
    audio.src = track.stream;
    audio.load();
    updatePlayer();
    await tryPlay();
  }
  async function tryPlay() {
    try { await audio.play(); message(''); } catch (_) { message('Не удалось воспроизвести запись. Возможно, источник ограничивает доступ или файл недоступен.'); }
    updatePlayer();
  }
  function move(offset) {
    const tracks = activeList();
    if (!tracks.length) return;
    const pos = Math.max(0, tracks.findIndex(t => state.active && t.id === state.active.id));
    choose(tracks[(pos + offset + tracks.length) % tracks.length]);
  }
  function share() {
    if (!state.active) return;
    const url = state.active.source;
    const text = state.active.title + ' — ' + state.active.artist + ' · Vetogram Music';
    const tgUrl = 'https://t.me/share/url?url=' + encodeURIComponent(url) + '&text=' + encodeURIComponent(text);
    if (tg && typeof tg.openTelegramLink === 'function') tg.openTelegramLink(tgUrl);
    else window.open(tgUrl, '_blank', 'noopener,noreferrer');
  }
  $('searchForm').addEventListener('submit', e => {
    e.preventDefault();
    const q = $('searchInput').value.trim();
    if (q) {
      for (const chip of document.querySelectorAll('.chip')) { chip.classList.remove('active'); chip.setAttribute('aria-pressed', 'false'); }
      search(q);
    }
  });
  $('genreBar').addEventListener('click', e => {
    const chip = e.target.closest('button[data-genre]');
    if (!chip) return;
    document.querySelectorAll('.chip').forEach(c => { c.classList.toggle('active', c === chip); c.setAttribute('aria-pressed', String(c === chip)); });
    $('searchInput').value = '';
    search(chip.dataset.genre);
  });
  $('allButton').addEventListener('click', () => { state.view = 'all'; render(); });
  $('favoritesButton').addEventListener('click', () => { state.view = 'favorites'; render(); });
  $('loadMore').addEventListener('click', () => search(state.query, true));
  $('playButton').addEventListener('click', () => { if (!state.active) return; if (audio.paused) tryPlay(); else audio.pause(); });
  $('prevButton').addEventListener('click', () => move(-1));
  $('nextButton').addEventListener('click', () => move(1));
  $('playerHeart').addEventListener('click', () => { if (state.active) toggleFavorite(state.active); });
  $('shareButton').addEventListener('click', share);
  $('progress').addEventListener('input', e => {
    if (Number.isFinite(audio.duration) && audio.duration > 0) audio.currentTime = (Number(e.target.value) / 1000) * audio.duration;
  });
  audio.addEventListener('timeupdate', () => {
    $('currentTime').textContent = formatTime(audio.currentTime);
    if (Number.isFinite(audio.duration) && audio.duration > 0) $('progress').value = String(Math.round(1000 * audio.currentTime / audio.duration));
  });
  audio.addEventListener('durationchange', updatePlayer);
  audio.addEventListener('play', updatePlayer);
  audio.addEventListener('pause', updatePlayer);
  audio.addEventListener('ended', () => move(1));
  audio.addEventListener('error', () => { if (state.active) { message('Запись сейчас недоступна на сервере источника. Выбери другой трек.'); updatePlayer(); } });
  persistFavorites();
  search(state.query);
})();