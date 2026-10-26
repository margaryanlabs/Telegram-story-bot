/* VETO MEDIA beta · isolated from VETOGRAM authentication and messaging.
 * Music: Audius public read-only catalog. Books: Gutendex/Project Gutenberg.
 * Audio books: LibriVox. No scraping, download bypass, or premium gating bypass.
 */
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const API = Object.freeze({
    music: "https://api.audius.co/v1",
    books: "https://gutendex.com/books",
    audiobooks: "https://librivox.org/api/feed/audiobooks/"
  });
  const STATE_KEY = "veto-media-beta-v1";
  const state = { tab: "music", tracks: [], books: [], audiobooks: [], current: -1,
    lang: "all", musicMode: "trending", search: "", readerBook: null, audioBookPlayback: null, readerSize: 19,
    favorites: { tracks: [], books: [] }, progress: {} };
  const audio = $("audio");
  let searchTimer = 0;
  let readerSaveTimer = 0;
  let toastTimer = 0;
  let activeRequest = 0;
  function getSaved() {
    try {
      const saved = JSON.parse(localStorage.getItem(STATE_KEY) || "{}");
      if (saved && typeof saved === "object") {
        state.favorites.tracks = Array.isArray(saved.tracks) ? saved.tracks.slice(0, 300) : [];
        state.favorites.books = Array.isArray(saved.books) ? saved.books.slice(0, 300) : [];
        state.progress = saved.progress && typeof saved.progress === "object" ? saved.progress : {};
        state.readerSize = Number(saved.readerSize) || 19;
      }
    } catch (_) { /* browser storage may be unavailable */ }
  }
  function persist() {
    try { localStorage.setItem(STATE_KEY, JSON.stringify({
      tracks: state.favorites.tracks, books: state.favorites.books, progress: state.progress,
      readerSize: state.readerSize
    })); } catch (_) { toast("Память браузера недоступна. Закладки могут не сохраниться."); }
  }
  function node(tag, className, content) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (content !== undefined && content !== null) e.textContent = String(content);
    return e;
  }
  function safeURL(value) {
    try { const url = new URL(String(value)); return url.protocol === "https:" ? url.href : ""; }
    catch (_) { return ""; }
  }
  function addImage(parent, src, cls, alt) {
    const url = safeURL(src);
    if (!url) return false;
    const img = node("img", cls);
    img.src = url; img.alt = alt || ""; img.loading = "lazy";
    img.referrerPolicy = "no-referrer";
    img.addEventListener("error", () => img.remove());
    parent.append(img);
    return true;
  }
  function urlBackground(url) {
    return safeURL(url) ? 'url(' + JSON.stringify(safeURL(url)) + ')' : "";
  }
  function toast(message) {
    const e = $("toast"); e.textContent = message; e.classList.remove("hidden");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => e.classList.add("hidden"), 4500);
  }
  async function getJSON(url) {
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("HTTP " + response.status);
    return response.json();
  }
  function time(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    const s = Math.floor(seconds);
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  }
  function setTab(next) {
    if (!["home", "music", "films", "books", "audiobooks", "library"].includes(next)) return;
    state.tab = next; state.search = ""; $("searchInput").value = "";
    document.querySelectorAll(".tab").forEach(x => {
      x.classList.toggle("is-active", x.dataset.tab === next);
      x.setAttribute("aria-current", x.dataset.tab === next ? "page" : "false");
    });
    document.querySelectorAll(".view").forEach(x => x.classList.toggle("is-active", x.id === next + "View"));
    $("sourceLabel").textContent = ({
      home: "Вся медиавселенная · VETO", music: "Независимые артисты · Audius", films: "Архивное кино · Internet Archive", books: "Книги общественного достояния · Gutenberg",
      audiobooks: "Классика голосом · LibriVox", library: "Сохранено на устройстве"
    })[next];
    $("searchSection").classList.toggle("hidden", next === "audiobooks");
    if (next === "music") loadMusic();
    if (next === "films") window.VetoFilms?.load();
    if (next === "books") loadBooks();
    if (next === "audiobooks") loadAudioBooks();
    if (next === "library") renderLibrary();
  }
  function trackFrom(raw) {
    if (!raw || !raw.id || !raw.title) return null;
    return {
      id: String(raw.id), title: String(raw.title), artist: String(raw.user?.name || raw.user?.handle || "Независимый артист"),
      artwork: safeURL(raw.artwork?.["480x480"] || raw.artwork?.["150x150"] || raw.artwork?._480x480 || raw.artwork?._150x150 || ""),
      duration: Number(raw.duration) || 0, url: safeURL(raw.permalink || ""),
      gated: Boolean(raw.is_stream_gated || raw.is_delete || raw.is_unlisted || raw.is_scheduled_release)
    };
  }
  async function loadMusic() {
    const request = ++activeRequest;
    $("tracksList").replaceChildren(node("div", "loading", "Подбираем треки…"));
    $("musicCount").textContent = "Поиск";
    const query = state.search.trim();
    let endpoint = API.music + (query ? "/tracks/search?query=" + encodeURIComponent(query) + "&limit=25"
      : "/tracks/" + (state.musicMode === "latest" ? "latest" : "trending") + "?limit=25");
    try {
      const result = await getJSON(endpoint);
      if (request !== activeRequest || state.tab !== "music") return;
      state.tracks = (Array.isArray(result?.data) ? result.data : [])
        .map(trackFrom).filter(x => x && !x.gated);
      renderTracks(state.tracks, $("tracksList"));
      $("musicCount").textContent = state.tracks.length + " треков";
      setFeature(state.tracks[0]);
    } catch (err) {
      if (request !== activeRequest || state.tab !== "music") return;
      $("tracksList").replaceChildren(node("div", "error", "Audius сейчас не отвечает. Проверь соединение и попробуй ещё раз."));
      $("musicCount").textContent = "Нет соединения";
    }
  }
  function isTrackFavorite(id) { return state.favorites.tracks.some(x => x.id === id); }
  function isBookFavorite(id) { return state.favorites.books.some(x => x.id === id); }
  function renderTracks(tracks, parent) {
    parent.replaceChildren();
    if (!tracks.length) { parent.append(node("div", "empty", "Пока ничего не найдено.")); return; }
    tracks.forEach((t, index) => {
      const row = node("div", "track-row" + (state.current >= 0 && state.tracks[state.current]?.id === t.id ? " is-active" : ""));
      row.append(node("span", "track-number", String(index + 1).padStart(2, "0")));
      const imgWrapper = node("div", "track-placeholder", "♫");
      imgWrapper.className = "track-placeholder";
      imgWrapper.textContent = "";
      if (!addImage(imgWrapper, t.artwork, "track-image", "")) imgWrapper.textContent = "♫";
      row.append(imgWrapper);
      const meta = node("div", "track-meta");
      meta.append(node("strong", "", t.title), node("small", "", t.artist));
      row.append(meta);
      row.append(node("small", "track-number", time(t.duration)));
      const heart = node("button", "track-button track-heart" + (isTrackFavorite(t.id) ? " is-on" : ""), isTrackFavorite(t.id) ? "♥" : "♡");
      heart.type = "button"; heart.setAttribute("aria-label", "Сохранить " + t.title);
      heart.addEventListener("click", () => { toggleTrack(t); renderTracks(tracks, parent); updateHeart(); });
      row.append(heart);
      if (t.url) {
        const sourceLink = node("a", "track-button", "↗");
        sourceLink.href = t.url; sourceLink.target = "_blank";
        sourceLink.rel = "noopener noreferrer"; sourceLink.title = "На Audius";
        row.append(sourceLink);
      }
      const play = node("button", "track-button", "▶");
      play.type = "button"; play.setAttribute("aria-label", "Слушать " + t.title);
      play.addEventListener("click", () => {
        const foundIndex = state.tracks.findIndex(x => x.id === t.id);
        if (foundIndex >= 0) playTrack(foundIndex);
        else { state.tracks = tracks.slice(); playTrack(index); }
      });
      row.append(play); parent.append(row);
    });
  }
  function setFeature(track) {
    const el = $("featureTrack");
    el.classList.toggle("has-art", Boolean(track?.artwork));
    el.style.backgroundImage = track?.artwork ?
      "linear-gradient(0deg, rgba(13,19,33,.5), rgba(12,16,27,.20)), " + urlBackground(track.artwork) : "";
    const title = el.querySelector(".feature-title");
    const desc = el.querySelector("p");
    title.textContent = track?.title || "Музыка, которая остаётся.";
    desc.textContent = track?.artist || "Выбери трек — и пространство оживёт.";
  }
  function playTrack(index) {
    const t = state.tracks[index];
    if (!t || t.gated) { toast("Этот трек недоступен для воспроизведения."); return; }
    state.current = index; state.audioBookPlayback = null;
    $("favoriteNow").classList.remove("hidden");
    $("player").classList.remove("hidden");
    $("playerTitle").textContent = t.title;
    $("playerArtist").textContent = t.artist;
    $("playerCover").style.backgroundImage = urlBackground(t.artwork);
    $("duration").textContent = time(t.duration);
    $("seek").value = "0"; $("currentTime").textContent = "0:00";
    setFeature(t); updateHeart();
    // Endpoint belongs to Audius and streams only publicly accessible tracks.
    audio.src = API.music + "/tracks/" + encodeURIComponent(t.id) + "/stream";
    audio.play().catch(() => { syncPlayUI(); toast("Не удалось воспроизвести. Возможно, запись недоступна в этом регионе или Telegram WebView."); });
    renderTracks(state.tracks, $("tracksList"));
    if ("mediaSession" in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: t.title, artist: t.artist, album: "VETO MEDIA · Audius",
          artwork: t.artwork ? [{ src: t.artwork, sizes: "480x480" }] : []
        });
      } catch (_) {}
    }
  }
  function syncPlayUI() {
    const isPlaying = !audio.paused && !audio.ended;
    $("playButton").textContent = isPlaying ? "Ⅱ" : "▶";
    $("playButton").setAttribute("aria-label", isPlaying ? "Пауза" : "Воспроизвести");
    document.body.classList.toggle("is-playing", isPlaying);
  }
  function toggleTrack(t) {
    const at = state.favorites.tracks.findIndex(x => x.id === t.id);
    if (at >= 0) state.favorites.tracks.splice(at, 1);
    else state.favorites.tracks.unshift(t);
    persist();
  }
  function updateHeart() {
    const t = state.tracks[state.current];
    const yes = t && isTrackFavorite(t.id);
    $("favoriteNow").textContent = yes ? "♥" : "♡";
    $("favoriteNow").classList.toggle("is-on", Boolean(yes));
  }
  function bookFrom(raw) {
    if (!raw || raw.copyright !== false || !raw.id || !raw.title) return null;
    const formats = raw.formats || {};
    const textKey = Object.keys(formats).find(k => k.includes("text/plain") && k.includes("utf-8")) ||
      Object.keys(formats).find(k => k.includes("text/plain"));
    return { id: String(raw.id), title: String(raw.title),
      author: String(raw.authors?.[0]?.name || "Неизвестный автор"),
      language: String(raw.languages?.[0] || ""), cover: safeURL(formats["image/jpeg"] || ""),
      textURL: safeURL(formats[textKey] || ""), original: "https://www.gutenberg.org/ebooks/" + encodeURIComponent(String(raw.id)),
      source: "gutenberg" };
  }
  async function loadBooks() {
    const request = ++activeRequest;
    $("booksGrid").replaceChildren(node("div", "loading", "Загружаем книги…"));
    const params = new URLSearchParams({ copyright: "false" });
    if (state.lang !== "all") params.set("languages", state.lang);
    if (state.search.trim()) params.set("search", state.search.trim());
    try {
      const result = await getJSON(API.books + "?" + params);
      if (request !== activeRequest || state.tab !== "books") return;
      state.books = (Array.isArray(result?.results) ? result.results : []).map(bookFrom).filter(Boolean);
      renderBooks(state.books, $("booksGrid"));
    } catch (_) {
      if (request !== activeRequest || state.tab !== "books") return;
      $("booksGrid").replaceChildren(node("div", "error", "Каталог сейчас недоступен. Можно открыть собственный TXT-файл."));
    }
  }
  function bookCard(book) {
    const card = node("article", "book-card");
    const cover = node("div", "book-cover");
    if (!addImage(cover, book.cover, "", "Обложка: " + book.title)) cover.append(node("span", "", book.title));
    card.append(cover);
    const details = node("div", "book-details");
    details.append(node("strong", "", book.title), node("small", "", book.author));
    const actions = node("div", "book-action");
    const read = node("button", "", "Читать");
    read.type = "button"; read.addEventListener("click", () => openBook(book));
    const save = node("button", "", isBookFavorite(book.id) ? "♥" : "♡");
    save.type = "button"; save.setAttribute("aria-label", "В библиотеку");
    save.addEventListener("click", () => { toggleBook(book); renderBooks(state.tab === "library" ? state.favorites.books : state.books, state.tab === "library" ? $("favoriteBooks") : $("booksGrid")); });
    actions.append(read, save);
    if (safeURL(book.original)) {
      const source = node("a", "", "↗"); source.href = safeURL(book.original); source.target = "_blank"; source.rel = "noopener noreferrer"; source.title = "Оригинальный источник"; actions.append(source);
    }
    details.append(actions); card.append(details); return card;
  }
  function renderBooks(books, parent) {
    parent.replaceChildren();
    if (!books.length) { parent.append(node("div", "empty", "В этой коллекции пока ничего нет.")); return; }
    books.forEach(b => parent.append(bookCard(b)));
  }
  function toggleBook(book) {
    const at = state.favorites.books.findIndex(x => x.id === book.id);
    if (at >= 0) state.favorites.books.splice(at, 1);
    else state.favorites.books.unshift(book);
    persist();
  }
  function openReaderShell(book) {
    state.readerBook = book;
    $("readerTitle").textContent = book.title;
    $("readerAuthor").textContent = book.author;
    $("readerBackdrop").classList.remove("hidden");
    $("readerContent").style.fontSize = state.readerSize + "px";
    $("readerContent").replaceChildren(node("div", "loading", "Открываем книгу…"));
    $("readingProgress").textContent = "0%";
    $("openOriginal").href = safeURL(book.original) || "https://www.gutenberg.org/";
    document.body.style.overflow = "hidden";
  }
  async function openBook(book) {
    openReaderShell(book);
    if (!book.textURL) {
      $("readerContent").textContent = "У этой книги нет доступного TXT-файла. Можно прочитать её на странице источника.";
      return;
    }
    try {
      const response = await fetch(book.textURL);
      if (!response.ok) throw new Error("Cannot open");
      if (state.readerBook?.id !== book.id) return;
      const text = await response.text();
      if (text.length > 9000000) throw new Error("Too large");
      $("readerContent").textContent = text;
      restoreProgress(book.id);
    } catch (_) {
      if (state.readerBook?.id !== book.id) return;
      $("readerContent").textContent = "Источник не разрешил загрузить полный текст в Telegram. Откройте оригинал по ссылке ниже. Можно также загрузить свой TXT-файл.";
    }
  }
  function restoreProgress(id) {
    const el = $("readerContent");
    const fraction = Number(state.progress[id]) || 0;
    requestAnimationFrame(() => { el.scrollTop = Math.max(0, el.scrollHeight - el.clientHeight) * Math.min(1, Math.max(0, fraction)); updateReadingProgress(); });
  }
  function updateReadingProgress() {
    const el = $("readerContent");
    const max = el.scrollHeight - el.clientHeight;
    const fraction = max > 0 ? el.scrollTop / max : 0;
    $("readingProgress").textContent = Math.round(100 * fraction) + "%";
    if (state.readerBook) {
      state.progress[state.readerBook.id] = Math.round(fraction * 10000) / 10000;
      clearTimeout(readerSaveTimer); readerSaveTimer = setTimeout(persist, 350);
    }
  }
  function closeReader() {
    clearTimeout(readerSaveTimer); persist();
    $("readerBackdrop").classList.add("hidden");
    document.body.style.overflow = "";
    state.readerBook = null;
  }
  async function loadAudioBooks() {
    const request = ++activeRequest;
    $("audioBooksGrid").replaceChildren(node("div", "loading", "Загружаем аудиокниги…"));
    try {
      const result = await getJSON(API.audiobooks + "?format=json&limit=18&coverart=1");
      if (request !== activeRequest || state.tab !== "audiobooks") return;
      state.audiobooks = (Array.isArray(result?.books) ? result.books : []).filter(b => safeURL(b.url_librivox));
      const el = $("audioBooksGrid"); el.replaceChildren();
      for (const b of state.audiobooks) {
        const card = node("article", "book-card");
        const cover = node("div", "book-cover");
        if (!addImage(cover, b.coverart_thumbnail, "", b.title)) cover.append(node("span", "", b.title));
        card.append(cover);
        const details = node("div", "book-details");
        details.append(node("strong", "", b.title), node("small", "", b.authors?.[0] ? (b.authors[0].first_name || "") + " " + (b.authors[0].last_name || "") : "LibriVox"));
        const button = node("button", "import-btn", "Слушать здесь ▶");
        button.type = "button"; button.addEventListener("click", () => playAudioBook(b));
        const link = node("a", "source-note", "Источник ↗");
        link.href = safeURL(b.url_librivox); link.target = "_blank"; link.rel = "noopener noreferrer";
        details.append(button, link); card.append(details); el.append(card);
      }
      if (!state.audiobooks.length) el.append(node("div", "empty", "Записей не найдено."));
    } catch (_) {
      const el = $("audioBooksGrid"); el.replaceChildren();
      const info = node("div", "empty", "Встроенный каталог временно недоступен. ");
      const link = node("a", "", "Открыть LibriVox ↗");
      link.href = "https://librivox.org/search"; link.target = "_blank"; link.rel = "noopener noreferrer";
      info.append(link); el.append(info);
    }
  }
  async function playAudioBook(book) {
    try {
      toast("Подключаем запись LibriVox…");
      const response = await getJSON(API.audiobooks + "?id=" + encodeURIComponent(String(book.id)) + "&format=json&extended=1");
      const details = response?.books?.[0];
      const sections = (Array.isArray(details?.sections) ? details.sections : []).filter(x => safeURL(x.listen_url));
      if (!sections.length) { toast("Для этой книги доступен только оригинальный источник."); return; }
      state.audioBookPlayback = { book, sections, index: 0 };
      playAudioBookChapter(0);
    } catch (_) { toast("LibriVox не разрешил загрузить главы. Открой оригинальный источник по ссылке."); }
  }
  function playAudioBookChapter(index) {
    const playback = state.audioBookPlayback;
    if (!playback || index < 0 || index >= playback.sections.length) return;
    playback.index = index; state.current = -1;
    const section = playback.sections[index];
    $("player").classList.remove("hidden");
    $("favoriteNow").classList.add("hidden");
    $("playerTitle").textContent = playback.book.title;
    $("playerArtist").textContent = section.title || "Глава " + (index + 1);
    $("playerCover").style.backgroundImage = urlBackground(playback.book.coverart_thumbnail);
    $("seek").value = "0"; $("currentTime").textContent = "0:00";
    $("duration").textContent = time(Number(section.playtime) || 0);
    audio.src = safeURL(section.listen_url);
    audio.play().catch(() => toast("Не удалось запустить главу. Используй ссылку на LibriVox."));
  }
  function renderLibrary() {
    renderTracks(state.favorites.tracks, $("favoriteTracks"));
    renderBooks(state.favorites.books, $("favoriteBooks"));
  }
  function performSearch() {
    state.search = $("searchInput").value.slice(0, 100);
    if (state.tab === "music") loadMusic();
    if (state.tab === "books") loadBooks();
    if (state.tab === "library") {
      const q = state.search.trim().toLowerCase();
      renderTracks(state.favorites.tracks.filter(x => (x.title + " " + x.artist).toLowerCase().includes(q)), $("favoriteTracks"));
      renderBooks(state.favorites.books.filter(x => (x.title + " " + x.author).toLowerCase().includes(q)), $("favoriteBooks"));
    }
  }
  function init() {
    getSaved();
    document.querySelectorAll(".tab").forEach(el => el.addEventListener("click", () => setTab(el.dataset.tab)));
    $("discoverButton").addEventListener("click", () => { setTab("music"); $("musicView").scrollIntoView({ behavior: "smooth" }); });
    $("booksButton").addEventListener("click", () => { setTab("books"); $("booksView").scrollIntoView({ behavior: "smooth" }); });
    $("trendingButton").addEventListener("click", () => {
      state.musicMode = "trending"; $("trendingButton").classList.add("is-active"); $("newButton").classList.remove("is-active"); loadMusic();
    });
    $("newButton").addEventListener("click", () => {
      state.musicMode = "latest"; $("newButton").classList.add("is-active"); $("trendingButton").classList.remove("is-active"); loadMusic();
    });
    document.querySelectorAll("[data-booklang]").forEach(b => b.addEventListener("click", () => {
      state.lang = b.dataset.booklang;
      document.querySelectorAll("[data-booklang]").forEach(x => x.classList.toggle("is-active", x === b));
      loadBooks();
    }));
    $("searchInput").addEventListener("input", () => { clearTimeout(searchTimer); searchTimer = setTimeout(performSearch, 360); });
    $("searchClear").addEventListener("click", () => { $("searchInput").value = ""; performSearch(); });
    $("themeButton").addEventListener("click", () => document.body.classList.toggle("light"));
    $("playButton").addEventListener("click", () => audio.paused ? audio.play().catch(() => toast("Этот источник недоступен.")) : audio.pause());
    $("prevButton").addEventListener("click", () => {
      if (state.audioBookPlayback) playAudioBookChapter(Math.max(0, state.audioBookPlayback.index - 1));
      else if (state.tracks.length) playTrack((state.current - 1 + state.tracks.length) % state.tracks.length);
    });
    $("nextButton").addEventListener("click", () => {
      if (state.audioBookPlayback) playAudioBookChapter(Math.min(state.audioBookPlayback.sections.length - 1, state.audioBookPlayback.index + 1));
      else if (state.tracks.length) playTrack((state.current + 1) % state.tracks.length);
    });
    $("favoriteNow").addEventListener("click", () => {
      const t = state.tracks[state.current]; if (!t) return; toggleTrack(t); updateHeart(); renderTracks(state.tracks, $("tracksList"));
    });
    audio.addEventListener("play", syncPlayUI); audio.addEventListener("pause", syncPlayUI);
    audio.addEventListener("ended", () => {
      syncPlayUI();
      if (state.audioBookPlayback) {
        if (state.audioBookPlayback.index + 1 < state.audioBookPlayback.sections.length) playAudioBookChapter(state.audioBookPlayback.index + 1);
      } else if (state.tracks.length > 1) playTrack((state.current + 1) % state.tracks.length);
    });
    audio.addEventListener("error", () => {
      if (audio.src) toast("Аудиопоток не загрузился. Возможно, источник ограничил доступ к записи."); syncPlayUI();
    });
    audio.addEventListener("timeupdate", () => {
      $("currentTime").textContent = time(audio.currentTime);
      $("duration").textContent = time(Number.isFinite(audio.duration) ? audio.duration : state.tracks[state.current]?.duration);
      if (Number.isFinite(audio.duration) && audio.duration > 0) $("seek").value = String(Math.round(1000 * audio.currentTime / audio.duration));
    });
    $("seek").addEventListener("input", () => { if (Number.isFinite(audio.duration) && audio.duration > 0) audio.currentTime = Number($("seek").value) / 1000 * audio.duration; });
    $("bookUpload").addEventListener("change", async (ev) => {
      const file = ev.target.files?.[0]; if (!file) return;
      if (file.size > 2 * 1024 * 1024) { toast("TXT-файл должен быть не больше 2 МБ."); return; }
      const book = { id: "local:" + file.name + ":" + file.size, title: file.name.replace(/\.txt$/i, ""), author: "Мой файл", original: "", source: "local" };
      openReaderShell(book);
      $("readerContent").textContent = await file.text();
      restoreProgress(book.id); ev.target.value = "";
    });
    $("closeReader").addEventListener("click", closeReader);
    $("readerBackdrop").addEventListener("click", (ev) => { if (ev.target === $("readerBackdrop")) closeReader(); });
    document.addEventListener("keydown", (ev) => { if (ev.key === "Escape" && !$("readerBackdrop").classList.contains("hidden")) closeReader(); });
    $("readerContent").addEventListener("scroll", updateReadingProgress, { passive: true });
    $("decreaseFont").addEventListener("click", () => { state.readerSize = Math.max(14, state.readerSize - 1); $("readerContent").style.fontSize = state.readerSize + "px"; persist(); });
    $("increaseFont").addEventListener("click", () => { state.readerSize = Math.min(29, state.readerSize + 1); $("readerContent").style.fontSize = state.readerSize + "px"; persist(); });
    $("saveBook").addEventListener("click", () => {
      const b = state.readerBook; if (!b) return;
      if (b.source === "local") { toast("Для локального TXT сохраняется позиция чтения, но сам файл нужно открыть повторно."); return; }
      toggleBook(b); toast(isBookFavorite(b.id) ? "Книга сохранена" : "Книга удалена из избранного");
    });
    const tg = window.Telegram?.WebApp;
    try { tg?.ready(); tg?.expand(); } catch (_) {}
    setTab("home");
  }
  init();
})();