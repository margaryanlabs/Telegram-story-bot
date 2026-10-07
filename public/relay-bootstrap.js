(() => {
  const $ = id => document.getElementById(id);
  const CACHE_KEY = 'veto-relay-bootstrap-routes-v1';
  let current = null;
  let routes = [];
  let busy = false;

  function toast(message) {
    const el = $('toast');
    el.textContent = String(message || '');
    el.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  function readCache() {
    try {
      const parsed = JSON.parse(localStorage.getItem(CACHE_KEY) || '[]');
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter(item => item?.connectUrl && item?.manual?.server && item?.manual?.secret)
        .map(item => ({ ...item, source:'cache' }))
        .slice(0, 4);
    } catch {
      return [];
    }
  }

  function writeCache(next) {
    try {
      const unique = [];
      const seen = new Set();
      for (const item of next) {
        const id = String(item?.relay?.id || item?.connectUrl || '');
        if (!id || seen.has(id)) continue;
        seen.add(id);
        unique.push(item);
      }
      localStorage.setItem(CACHE_KEY, JSON.stringify(unique.slice(0, 4)));
    } catch {}
  }

  function setNetwork() {
    const online = navigator.onLine !== false;
    $('networkState').classList.toggle('online', online);
    $('networkState').classList.toggle('offline', !online);
    $('networkState').querySelector('b').textContent = online ? 'Интернет есть' : 'Нет интернета';
    return online;
  }

  function errorMessage(error) {
    const code = String(error?.code || error?.message || '');
    if (navigator.onLine === false) return 'Нет обычного интернет-соединения. Подключи Wi‑Fi или мобильную сеть.';
    if (/timeout|abort/i.test(code)) return 'VETO Relay отвечает слишком долго. Использую сохранённый маршрут, если он есть.';
    if (/relay_not_configured/i.test(code)) return 'Relay Mesh временно не настроен.';
    if (/relay_unavailable/i.test(code)) return 'Сейчас не удалось подтвердить живой маршрут. Попробуй ещё раз или используй сохранённый.';
    return 'Не удалось получить свежий маршрут. Проверяю сохранённый fallback.';
  }

  async function fetchRoute(exclude = []) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5500);
    try {
      const query = exclude.length ? '?exclude=' + encodeURIComponent(exclude.join(',')) : '';
      const response = await fetch('/api/relay-bootstrap' + query, {
        method:'GET',
        cache:'no-store',
        credentials:'same-origin',
        signal:controller.signal,
        headers:{accept:'application/json'},
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok) {
        const error = new Error(data?.error || 'relay_unavailable');
        error.code = data?.error;
        throw error;
      }
      return { ...data, source:'live', cachedAt:Date.now() };
    } finally {
      clearTimeout(timer);
    }
  }

  function render(route, { source = 'live', message = null } = {}) {
    current = route || null;
    const status = $('routeStatus');
    const connect = $('connectButton');
    const has = Boolean(route?.connectUrl);

    connect.disabled = !has;
    $('alternateButton').disabled = routes.length < 2 && !has;

    status.classList.toggle('ready', has && route?.routeHealth === 'verified');
    status.classList.toggle('warn', !has || route?.routeHealth !== 'verified');

    if (!has) {
      $('routeTitle').textContent = navigator.onLine === false ? 'Нет интернет-соединения' : 'Маршрут пока не найден';
      $('routeText').textContent = message || 'Попробуй обновить или используй сохранённый маршрут';
      $('connectHint').textContent = 'Маршрут недоступен';
      $('healthBadge').textContent = '—';
      return;
    }

    const cached = source === 'cache';
    $('routeTitle').textContent = cached ? 'Сохранённый аварийный маршрут готов' : 'Маршрут готов';
    $('routeText').textContent = message || (route.routeHealth === 'verified'
      ? 'VETO edge подтвердил доступность'
      : 'Маршрут доступен как fallback; Telegram проверит соединение');
    $('connectHint').textContent = cached ? 'Использовать сохранённый route' : 'Открыть нативную настройку Telegram';
    $('routeLabel').textContent = route.relay?.label || 'VETO Relay';
    $('routeId').textContent = route.relay?.id ? 'route · ' + route.relay.id : '—';
    $('routeRegion').textContent = route.relay?.region || 'AUTO';
    $('routeLatency').textContent = Number.isFinite(Number(route.relay?.latencyMs)) ? Math.round(Number(route.relay.latencyMs)) + ' ms' : '—';
    $('routeSource').textContent = cached ? 'Saved' : 'Live';
    $('routeSourceHint').textContent = cached ? 'Этот браузер' : 'VETO API';
    $('healthBadge').textContent = route.routeHealth === 'verified' ? 'Verified' : 'Fallback';
    $('healthBadge').className = route.routeHealth === 'verified' ? 'verified' : 'degraded';

    $('manualServer').textContent = route.manual?.server || '—';
    $('manualPort').textContent = route.manual?.port || '—';
    $('manualSecret').textContent = route.manual?.secret || '—';
  }

  function mergeRoutes(fresh, cached = readCache()) {
    const all = [...fresh, ...cached];
    const seen = new Set();
    return all.filter(item => {
      const id = String(item?.relay?.id || item?.connectUrl || '');
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    }).slice(0, 4);
  }

  async function refresh({ rotate = false } = {}) {
    if (busy) return;
    busy = true;
    $('refreshButton').disabled = true;
    $('alternateButton').disabled = true;

    const cached = readCache();
    const exclude = rotate && current?.relay?.id ? [current.relay.id] : [];

    try {
      const primary = await fetchRoute(exclude);
      let fresh = [primary];

      if (primary.alternatives) {
        try {
          const alternate = await fetchRoute([primary.relay?.id].filter(Boolean));
          if (alternate?.relay?.id !== primary?.relay?.id) fresh.push(alternate);
        } catch {}
      }

      routes = mergeRoutes(fresh, cached);
      writeCache(routes);
      render(primary, { source:'live' });
    } catch (error) {
      routes = cached;
      const fallback = rotate && current
        ? routes.find(item => item?.relay?.id !== current?.relay?.id) || routes[0]
        : routes[0];
      render(fallback || null, {
        source:fallback ? 'cache' : 'none',
        message:errorMessage(error),
      });
      if (!fallback) toast(errorMessage(error));
    } finally {
      busy = false;
      $('refreshButton').disabled = false;
      $('alternateButton').disabled = routes.length < 2 && !current?.alternatives;
    }
  }

  function openTelegram() {
    if (!current?.connectUrl && !current?.tgUrl) {
      toast('Маршрут ещё не выбран');
      return;
    }

    // Prefer tg:// so the bootstrap still works when t.me itself is filtered.
    const nativeUrl = current.tgUrl || current.connectUrl;
    const webUrl = current.connectUrl;
    let hidden = false;
    const onVisibility = () => { if (document.visibilityState === 'hidden') hidden = true; };
    document.addEventListener('visibilitychange', onVisibility, { once:true });

    try { location.href = nativeUrl; } catch {}

    if (webUrl && nativeUrl !== webUrl) {
      setTimeout(() => {
        if (!hidden && document.visibilityState === 'visible') {
          try { location.href = webUrl; } catch {}
        }
      }, 900);
    }
  }

  function rotate() {
    const idx = routes.findIndex(item => item?.relay?.id === current?.relay?.id);
    if (routes.length > 1) {
      const next = routes[(idx + 1 + routes.length) % routes.length];
      render(next, { source:next.source === 'live' ? 'live' : 'cache', message:'Выбран альтернативный маршрут' });
      return;
    }
    refresh({ rotate:true });
  }

  async function copyValue(key) {
    const value = current?.manual?.[key];
    if (!value) return toast('Сначала выбери маршрут');
    try {
      await navigator.clipboard.writeText(String(value));
      toast('Скопировано');
    } catch {
      const area = document.createElement('textarea');
      area.value = String(value);
      document.body.appendChild(area);
      area.select();
      try { document.execCommand('copy'); toast('Скопировано'); } catch { toast('Не удалось скопировать'); }
      area.remove();
    }
  }

  window.addEventListener('online', () => { setNetwork(); refresh(); });
  window.addEventListener('offline', () => {
    setNetwork();
    const cached = readCache();
    routes = cached;
    render(cached[0] || null, {
      source:cached[0] ? 'cache' : 'none',
      message:cached[0] ? 'Интернет пропал. Маршрут сохранён, но для Telegram всё равно нужен доступ к сети.' : 'Подключи Wi‑Fi или мобильную сеть.',
    });
  });

  $('connectButton').addEventListener('click', openTelegram);
  $('alternateButton').addEventListener('click', rotate);
  $('refreshButton').addEventListener('click', () => refresh());
  document.querySelectorAll('[data-copy]').forEach(button => button.addEventListener('click', () => copyValue(button.dataset.copy)));

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/relay-sw.js', { scope:'/' }).catch(() => {});
  }

  setNetwork();
  const cached = readCache();
  if (cached.length) {
    routes = cached;
    render(cached[0], { source:'cache', message:'Проверяю, есть ли более свежий маршрут…' });
  }
  refresh();
})();
