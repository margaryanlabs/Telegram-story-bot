(() => {
  const tg = window.Telegram?.WebApp;
  const $ = (id) => document.getElementById(id);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const qs = new URLSearchParams(location.search);

  const CODE_AUDIENCE = { s:'standard', a:'all', c:'contacts', f:'close', u:'selected' };

  function decodeHistory(value) {
    return String(value || '').split('~').filter(Boolean).slice(0, 12).map(chunk => {
      const [id, ts36, code, excluded, selected, protect, deleted] = chunk.split('.');
      return {
        id: String(id || ''),
        ts: parseInt(ts36 || '0', 36) || 0,
        audience: CODE_AUDIENCE[code] || 'standard',
        excluded: Number(excluded || 0) || 0,
        selected: Number(selected || 0) || 0,
        protect: protect === '1',
        deleted: deleted === '1',
      };
    }).filter(item => item.id);
  }

  let state = {
    connection: qs.get('bc') ? (qs.get('cs') === '0' ? 'needs_permission' : 'ready') : 'unknown',
    ready: Boolean(qs.get('bc') && qs.get('cs') !== '0'),
    audience: qs.get('aud') || 'standard',
    selected: (qs.get('sel') || '').split(',').filter(Boolean),
    excluded: (qs.get('exc') || '').split(',').filter(Boolean),
    protect: qs.get('prot') === '1',
    lastStory: qs.get('ls') || null,
    history: decodeHistory(qs.get('hist')),
    analytics: null,
    advancedPrivacy: true,
    viewerSync: { available:false, requiresUserSession:true },
    processing: qs.get('pr') === '1',
  };

  let currentScreen = 'publish';
  let selectedViewerStory = state.lastStory || state.history?.[0]?.id || null;
  let toastTimer = null;
  let viewerSearchQuery = '';
  let viewerState = {
    configured: null,
    backgroundReady: false,
    session: null,
    story: null,
    viewers: [],
    error: null,
  };

  function audienceLabel(mode) {
    return ({
      standard:'Стандарт',
      all:'Все',
      contacts:'Контакты',
      close:'Близкие',
      selected:'Выбранные',
    })[mode] || 'Стандарт';
  }

  function audienceLong(mode, item = null) {
    if (mode === 'selected') return `Выбранные${item?.selected ? ` · ${item.selected}` : ''}`;
    if (mode === 'contacts') return `Контакты${item?.excluded ? ` · кроме ${item.excluded}` : ''}`;
    if (mode === 'all') return `Все${item?.excluded ? ` · кроме ${item.excluded}` : ''}`;
    if (mode === 'close') return 'Близкие друзья';
    return 'Стандарт Telegram';
  }

  function haptic(type = 'light') {
    try { tg?.HapticFeedback?.impactOccurred(type); } catch {}
  }

  function notify(type = 'success') {
    try { tg?.HapticFeedback?.notificationOccurred(type); } catch {}
  }

  function showToast(message) {
    const el = $('toast');
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2500);
  }

  function relativeTime(ts) {
    if (!ts) return '—';
    const diff = Math.max(0, Math.floor(Date.now() / 1000) - Number(ts));
    if (diff < 60) return 'сейчас';
    if (diff < 3600) return `${Math.floor(diff / 60)} мин`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} ч`;
    return `${Math.floor(diff / 86400)} дн`;
  }

  function formatDate(ts) {
    if (!ts) return 'Время неизвестно';
    try {
      return new Intl.DateTimeFormat('ru', {
        day:'numeric',
        month:'short',
        hour:'2-digit',
        minute:'2-digit',
      }).format(new Date(Number(ts) * 1000));
    } catch {
      return 'Недавно';
    }
  }

  function computeAnalytics() {
    const history = state.history || [];
    const active = history.filter(item => !item.deleted);
    const audienceCounts = active.reduce((acc, item) => {
      acc[item.audience] = (acc[item.audience] || 0) + 1;
      return acc;
    }, {});
    return {
      storiesTracked: history.length,
      activeTracked: active.length,
      protectedStories: active.filter(item => item.protect).length,
      totalExcluded: active.reduce((sum, item) => sum + (Number(item.excluded) || 0), 0),
      audienceCounts,
      lastPublishedAt: active[0]?.ts || history[0]?.ts || null,
      ...(state.analytics || {}),
    };
  }

  function setAvatar(user) {
    const source = user || tg?.initDataUnsafe?.user || {};
    const avatar = $('avatar');
    const photo = source.photoUrl || source.photo_url;
    if (photo) {
      avatar.innerHTML = '';
      const img = document.createElement('img');
      img.src = photo;
      img.alt = '';
      avatar.appendChild(img);
      return;
    }
    const name = source.firstName || source.first_name || source.username || 'SP';
    avatar.textContent = String(name).slice(0, 2).toUpperCase();
  }

  async function api(action = null, payload = {}) {
    if (!tg?.initData) throw new Error('Открой Story Pilot внутри Telegram');

    const options = {
      method: action ? 'POST' : 'GET',
      headers: {
        'x-telegram-init-data': tg.initData,
        'content-type':'application/json',
      },
    };
    if (action) options.body = JSON.stringify({ action, ...payload });

    const response = await fetch('/api/miniapp', options);
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.error || 'Не удалось обновить Story Pilot');

    if (data.state) {
      state = { ...state, ...data.state };
      if (!selectedViewerStory) selectedViewerStory = state.lastStory || state.history?.[0]?.id || null;
      render();
    }
    if (data.user) setAvatar(data.user);
    return data;
  }

  async function viewerApi(action = null, payload = {}, storyId = selectedViewerStory) {
    if (!tg?.initData) throw new Error('Открой Story Pilot внутри Telegram');

    const query = storyId ? `?storyId=${encodeURIComponent(storyId)}` : '';
    const options = {
      method: action ? 'POST' : 'GET',
      headers: {
        'x-telegram-init-data': tg.initData,
        'content-type':'application/json',
      },
    };
    if (action) options.body = JSON.stringify({ action, ...payload });

    const response = await fetch(`/api/viewer-sync${query}`, options);
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) {
      const error = new Error(data.error || 'Viewer Sync недоступен');
      error.viewerData = data;
      throw error;
    }
    return data;
  }

  async function refreshViewerSync({ silent = false } = {}) {
    try {
      const data = await viewerApi();
      viewerState = {
        configured: Boolean(data.config?.configured),
        backgroundReady: Boolean(data.config?.backgroundReady),
        session: data.session || null,
        story: data.story || null,
        viewers: data.viewers || [],
        error: null,
      };
    } catch (error) {
      const data = error.viewerData || {};
      viewerState = {
        ...viewerState,
        configured: data.config?.configured === false ? false : viewerState.configured,
        backgroundReady: Boolean(data.config?.backgroundReady),
        error: error.message,
      };
      if (!silent && data.config?.configured !== false) showToast(error.message);
    }
    renderViewers();
  }

  function renderConnection() {
    const ready = state.connection === 'ready';
    const permission = state.connection === 'needs_permission';

    $('profileDot').className = 'live-dot ' + (ready ? 'ready' : permission ? 'warn' : '');
    $('heroStatusPill').className = 'status-pill ' + (ready ? 'ready' : permission ? 'warn' : '');

    if (ready) {
      $('heroStatusPill').querySelector('span').textContent = 'Telegram подключён';
      $('connectionIcon').className = 'connection-icon ready';
      $('connectionIcon').textContent = '✓';
      $('connectionTitle').textContent = 'Готов к публикации';
      $('connectionText').textContent = 'Business Connection активен · Stories разрешены';
      $('checkButton').textContent = 'Проверить';
      $('metricAccount').textContent = 'Готово';
      $('heroTitle').innerHTML = 'Stories.<br><span>Под контролем.</span>';
      $('heroText').textContent = 'Аудитория, защита и история публикаций — в одном месте. Отправь фото в чат, когда всё готово.';
    } else if (permission) {
      $('heroStatusPill').querySelector('span').textContent = 'Нужно разрешение';
      $('connectionIcon').className = 'connection-icon warn';
      $('connectionIcon').textContent = '!';
      $('connectionTitle').textContent = 'Разреши управление Stories';
      $('connectionText').textContent = 'Telegram подключён, но нет can_manage_stories';
      $('checkButton').textContent = 'Проверить';
      $('metricAccount').textContent = 'Права';
    } else {
      $('heroStatusPill').querySelector('span').textContent = 'Подключение не подтверждено';
      $('connectionIcon').className = 'connection-icon';
      $('connectionIcon').textContent = '↗';
      $('connectionTitle').textContent = 'Подключи Telegram';
      $('connectionText').textContent = 'Story Pilot пока не получил активный Business Connection';
      $('checkButton').textContent = 'Проверить';
      $('metricAccount').textContent = 'Ожидание';
    }

    $('audienceBlock').classList.toggle('disabled', !ready);
    $('privacyBlock').classList.toggle('disabled', !ready);
  }

  function renderPublish() {
    const latest = (state.history || []).find(item => !item.deleted) || null;
    $('metricAudience').textContent = audienceLabel(state.audience);
    $('metricLast').textContent = latest ? relativeTime(latest.ts) : '—';
    $('heroStoryId').textContent = latest ? `Story #${latest.id}` : 'Story —';

    $$('.audience-card').forEach(button => {
      button.classList.toggle('active', button.dataset.audience === state.audience);
    });

    $('selectedCount').textContent = String(state.selected?.length || 0);
    $('excludedCount').textContent = String(state.excluded?.length || 0);
    $('selectedMeta').textContent = state.selected?.length
      ? `${state.selected.length} выбрано · нажми, чтобы добавить`
      : 'Добавить людей группами по 10';
    $('excludedMeta').textContent = state.excluded?.length
      ? `${state.excluded.length} исключено · нажми, чтобы добавить`
      : 'Для «Все» и «Контакты»';

    $('protectSwitch').checked = Boolean(state.protect);

    if (latest) {
      $('lastStoryTitle').textContent = `Story #${latest.id} · ${audienceLong(latest.audience, latest)}`;
      $('lastStoryMeta').textContent = `${formatDate(latest.ts)}${latest.protect ? ' · защита включена' : ''}`;
    } else {
      $('lastStoryTitle').textContent = 'Пока нет публикаций';
      $('lastStoryMeta').textContent = 'Отправь фото в чат Story Pilot';
    }

    $('deleteStory').disabled = !state.lastStory || !state.ready;
    $('mainButton').querySelector('b').textContent = state.ready
      ? 'Открыть чат и отправить фото'
      : 'Проверить подключение';
  }

  function renderViewers() {
    const item = (state.history || []).find(entry => String(entry.id) === String(selectedViewerStory))
      || (state.history || [])[0]
      || null;

    if (item) {
      selectedViewerStory = item.id;
      $('viewerStoryTitle').textContent = `Story #${item.id} · ${audienceLabel(item.audience)}`;
    } else {
      $('viewerStoryTitle').textContent = 'Нет опубликованных Stories';
    }

    const story = viewerState.story && String(viewerState.story.story_id) === String(selectedViewerStory)
      ? viewerState.story
      : null;
    $('viewerViews').textContent = story ? String(story.last_views_count || 0) : '—';
    $('viewerReactions').textContent = story ? String(story.last_reactions_count || 0) : '—';
    $('viewerForwards').textContent = story ? String(story.last_forwards_count || 0) : '—';

    const syncState = $('viewerSyncState');
    const syncButton = $('viewerSetupButton');
    const connected = viewerState.session?.connected === true;

    syncState.className = 'viewer-sync-state';
    if (viewerState.configured === false) {
      $('viewerSyncTitle').textContent = 'Viewer Sync backend почти готов.';
      $('viewerSyncText').textContent = 'Watcher и авторизация уже установлены. Для фоновых уведомлений нужно отдельное защищённое серверное хранилище.';
      syncState.textContent = 'Нужно завершить серверную настройку Viewer Sync';
      syncState.classList.add('warn');
      syncButton.textContent = 'Что осталось подключить';
    } else if (connected) {
      const account = viewerState.session?.account || {};
      $('viewerSyncTitle').textContent = 'Viewer Sync активен.';
      $('viewerSyncText').textContent = 'Story Pilot снимает разрешённые Telegram snapshots и показывает только подтверждённых зрителей.';
      syncState.textContent = `${account.username ? '@' + account.username : account.firstName || 'Telegram account'} · ${viewerState.backgroundReady ? 'фоновые проверки включены' : 'фоновый cron требует настройки'}`;
      syncState.classList.add(viewerState.backgroundReady ? 'ready' : 'warn');
      syncButton.textContent = 'Управление Viewer Sync';
    } else if (viewerState.session?.status === 'reauth_required') {
      $('viewerSyncTitle').textContent = 'Нужно переподключить Viewer Sync.';
      $('viewerSyncText').textContent = viewerState.session?.lastError || 'Telegram-сессия больше не авторизована.';
      syncState.textContent = 'Требуется повторная авторизация';
      syncState.classList.add('warn');
      syncButton.textContent = 'Переподключить';
    } else {
      $('viewerSyncTitle').textContent = 'Подключи аналитику зрителей.';
      $('viewerSyncText').textContent = 'Отдельная пользовательская MTProto-сессия нужна только для данных твоих собственных Stories. Код входа и 2FA не сохраняются.';
      syncState.textContent = viewerState.configured === null ? 'Проверяю состояние…' : 'Не подключено';
      syncButton.textContent = 'Подключить Viewer Sync';
    }

    const query = viewerSearchQuery.trim().toLowerCase();
    const viewers = (viewerState.viewers || []).filter(viewer => {
      if (!query) return true;
      return [viewer.username, viewer.display_name]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(query));
    });

    $('viewerListBadge').textContent = connected ? `${viewerState.viewers?.length || 0} confirmed` : 'Viewer Sync';

    if (!connected) {
      $('viewerList').innerHTML = '<div class="viewer-empty">Подключи Viewer Sync, чтобы видеть подтверждённых зрителей и историю взаимодействий.</div>';
      return;
    }

    if (!selectedViewerStory) {
      $('viewerList').innerHTML = '<div class="viewer-empty">Сначала опубликуй Story через Story Pilot.</div>';
      return;
    }

    if (!viewers.length) {
      $('viewerList').innerHTML = '<div class="viewer-empty">Подтверждённых зрителей пока нет. Новый просмотр сначала проходит окно приватности Telegram.</div>';
      return;
    }

    $('viewerList').innerHTML = viewers.map(viewer => {
      const name = viewer.display_name || (viewer.username ? '@' + viewer.username : 'Telegram user');
      const username = viewer.username ? '@' + viewer.username : 'без username';
      const viewedAt = viewer.viewed_at
        ? new Date(viewer.viewed_at).toLocaleString('ru-RU', { hour:'2-digit', minute:'2-digit', day:'numeric', month:'short' })
        : '—';
      const initials = String(viewer.display_name || viewer.username || 'TG').trim().slice(0, 2).toUpperCase();
      const reaction = viewer.reaction_json?.value ? ` · ${viewer.reaction_json.value}` : '';
      return `
        <div class="viewer-row">
          <div class="viewer-avatar">${initials}</div>
          <div class="viewer-copy">
            <strong>${name}</strong>
            <span>${username}${viewer.is_contact ? ' · контакт' : ''}</span>
          </div>
          <div class="viewer-side">
            <strong>${viewedAt}</strong>
            <span>confirmed${reaction}</span>
          </div>
        </div>`;
    }).join('');
  }

  function renderAnalytics() {
    const analytics = computeAnalytics();
    $('analyticsStories').textContent = String(analytics.storiesTracked || 0);
    $('analyticsProtected').textContent = String(analytics.protectedStories || 0);
    $('analyticsExcluded').textContent = String(analytics.totalExcluded || 0);
    $('analyticsLast').textContent = analytics.lastPublishedAt ? relativeTime(analytics.lastPublishedAt) : '—';

    const order = ['standard','all','contacts','close','selected'];
    const counts = analytics.audienceCounts || {};
    const max = Math.max(1, ...order.map(key => Number(counts[key] || 0)));
    $('audienceBars').innerHTML = order.map(key => {
      const count = Number(counts[key] || 0);
      const width = count ? Math.max(8, Math.round((count / max) * 100)) : 0;
      return `
        <div class="bar-row">
          <label>${audienceLabel(key)}</label>
          <div class="bar-track"><div class="bar-fill" style="width:${width}%"></div></div>
          <strong>${count}</strong>
        </div>`;
    }).join('');
  }

  function renderArchive() {
    const history = state.history || [];
    const list = $('archiveList');
    const empty = $('archiveEmpty');

    empty.classList.toggle('show', history.length === 0);
    if (!history.length) {
      list.innerHTML = '';
      return;
    }

    list.innerHTML = history.map(item => `
      <article class="archive-item" data-story-id="${item.id}">
        <div class="archive-thumb">#${item.id}</div>
        <div class="archive-copy">
          <strong>${audienceLong(item.audience, item)}</strong>
          <span>${formatDate(item.ts)}${item.protect ? ' · защита' : ''}</span>
        </div>
        <div class="archive-side">
          <span class="archive-status ${item.deleted ? 'deleted' : ''}">${item.deleted ? 'удалена' : 'опубликована'}</span>
          <small>${relativeTime(item.ts)}</small>
        </div>
      </article>
    `).join('');
  }

  function render() {
    renderConnection();
    renderPublish();
    renderViewers();
    renderAnalytics();
    renderArchive();
  }

  function switchScreen(name) {
    currentScreen = name;
    $$('.screen').forEach(screen => screen.classList.toggle('active', screen.dataset.screen === name));
    $$('.nav-item').forEach(button => button.classList.toggle('active', button.dataset.nav === name));
    $('actionDock').classList.toggle('hidden', name !== 'publish');
    haptic();
    window.scrollTo({ top:0, behavior:'smooth' });
  }

  function openSheet(html) {
    $('sheetContent').innerHTML = html;
    $('sheetBackdrop').hidden = false;
    $('sheet').hidden = false;
    try { tg?.BackButton?.show(); } catch {}
  }

  function closeSheet() {
    $('sheetBackdrop').hidden = true;
    $('sheet').hidden = true;
    try { tg?.BackButton?.hide(); } catch {}
  }

  function profileSheet() {
    const ready = state.connection === 'ready';
    openSheet(`
      <span class="kicker">Аккаунт</span>
      <h2>${ready ? 'Story Pilot подключён' : 'Проверь подключение'}</h2>
      <p>${ready ? 'Business Connection активен. Публикация Stories доступна.' : 'Для публикации нужен Telegram Business Connection и право управления Stories.'}</p>
      <div class="sheet-list">
        <div class="sheet-item"><strong>Business Connection</strong><span>${ready ? 'Активен' : 'Не подтверждён'}</span></div>
        <div class="sheet-item"><strong>Расширенная приватность</strong><span>${state.advancedPrivacy ? 'MTProto готов' : 'Не настроена'}</span></div>
        <div class="sheet-item"><strong>Viewer Sync</strong><span>Требует отдельной пользовательской MTProto-сессии</span></div>
      </div>
      <div class="sheet-actions">
        <button class="accent" data-sheet-action="check">Проверить Telegram</button>
        <button data-sheet-action="close">Закрыть</button>
      </div>
    `);
  }

  function viewerSetupSheet() {
    openSheet(`
      <span class="kicker">Viewer Sync</span>
      <h2>Отдельный контур для viewers</h2>
      <p>Публикация работает через Business Bot Connection. Но Telegram разрешает <code>stories.getStoryViewsList</code> только пользовательской MTProto-сессии владельца Story.</p>
      <div class="sheet-list">
        <div class="sheet-item"><strong>1. Авторизация пользователя</strong><span>Нужен безопасный вход в личную Telegram MTProto-сессию, отдельно от Bot Token.</span></div>
        <div class="sheet-item"><strong>2. Серверное хранилище</strong><span>Сессию и снимки viewers нельзя хранить в URL Mini App. Нужна зашифрованная БД.</span></div>
        <div class="sheet-item"><strong>3. Периодический snapshot</strong><span>Пока Telegram отдаёт список, сервер сохраняет viewers, реакции и публичные репосты.</span></div>
        <div class="sheet-item"><strong>Ограничение Telegram</strong><span>Stealth Mode не раскрывается и уже исчезнувшие viewer-данные задним числом не восстанавливаются.</span></div>
      </div>
      <div class="sheet-actions"><button class="accent" data-sheet-action="close">Понятно</button></div>
    `);
  }

  function viewerStorySheet() {
    const history = (state.history || []).filter(item => !item.deleted);
    const items = history.length
      ? history.map(item => `<button data-viewer-story="${item.id}">Story #${item.id} · ${audienceLabel(item.audience)} · ${formatDate(item.ts)}</button>`).join('')
      : '<div class="sheet-item"><strong>Нет Stories</strong><span>Сначала опубликуй Story через Story Pilot.</span></div>';

    openSheet(`
      <span class="kicker">Viewers</span>
      <h2>Выбери Story</h2>
      <div class="sheet-actions">${items}<button data-sheet-action="close">Закрыть</button></div>
    `);
  }

  async function refresh() {
    $('checkButton').disabled = true;
    try {
      const data = await api();
      if (data.state?.ready) notify('success');
    } catch (error) {
      showToast(error.message);
    } finally {
      $('checkButton').disabled = false;
    }
  }

  async function setAudience(mode) {
    const previous = state.audience;
    state.audience = mode;
    render();
    haptic();
    try {
      await api('audience', { value:mode });
      showToast('Аудитория сохранена');
    } catch (error) {
      state.audience = previous;
      render();
      showToast(error.message);
      notify('error');
    }
  }

  async function setProtect(value) {
    const previous = state.protect;
    state.protect = value;
    render();
    haptic();
    try {
      await api('protect', { value });
      showToast(value ? 'Защита включена' : 'Защита выключена');
    } catch (error) {
      state.protect = previous;
      render();
      showToast(error.message);
      notify('error');
    }
  }

  async function openPicker(kind) {
    try {
      haptic();
      await api(kind === 'selected' ? 'picker_selected' : 'picker_exclude');
      showToast('Открываю выбор людей в чате');
      setTimeout(() => tg?.close(), 180);
    } catch (error) {
      showToast(error.message);
      notify('error');
    }
  }

  async function deleteStory(storyId = state.lastStory) {
    if (!storyId || !state.ready) return;
    const run = async () => {
      try {
        await api('delete_story', { storyId });
        showToast(`Story #${storyId} удалена`);
        notify('success');
      } catch (error) {
        showToast(error.message);
        notify('error');
      }
    };
    if (tg?.showConfirm) tg.showConfirm(`Удалить Story #${storyId}?`, ok => ok && run());
    else if (confirm(`Удалить Story #${storyId}?`)) run();
  }

  $$('.nav-item').forEach(button => button.addEventListener('click', () => switchScreen(button.dataset.nav)));
  $$('.audience-card').forEach(button => button.addEventListener('click', () => setAudience(button.dataset.audience)));
  $('protectSwitch').addEventListener('change', event => setProtect(event.target.checked));
  $('selectedRow').addEventListener('click', () => {
    openSheet(`
      <span class="kicker">Только выбранные</span>
      <h2>${state.selected?.length ? `${state.selected.length} пользователей` : 'Список пока пуст'}</h2>
      <p>Telegram позволяет выбрать до 10 человек за одно открытие. Story Pilot объединяет группы — можешь добавлять дальше.</p>
      <div class="sheet-actions">
        <button class="accent" data-sheet-action="picker-selected">Добавить людей</button>
        ${state.selected?.length ? '<button data-sheet-action="clear-selected">Очистить список</button>' : ''}
        <button data-sheet-action="close">Закрыть</button>
      </div>
    `);
  });
  $('excludeRow').addEventListener('click', () => {
    openSheet(`
      <span class="kicker">Исключения</span>
      <h2>${state.excluded?.length ? `${state.excluded.length} исключено` : 'Никто не исключён'}</h2>
      <p>Исключения применяются к режимам «Все» и «Контакты». Можно добавлять пользователей группами по 10.</p>
      <div class="sheet-actions">
        <button class="accent" data-sheet-action="picker-exclude">Добавить людей</button>
        ${state.excluded?.length ? '<button data-sheet-action="clear-excluded">Очистить исключения</button>' : ''}
        <button data-sheet-action="close">Закрыть</button>
      </div>
    `);
  });
  $('deleteStory').addEventListener('click', () => deleteStory());
  $('checkButton').addEventListener('click', async () => {
    haptic();
    try {
      await api('check');
      showToast(state.ready ? 'Подключение активно' : 'Активное подключение пока не найдено');
    } catch (error) {
      showToast(error.message);
    }
  });
  $('profileButton').addEventListener('click', profileSheet);
  $('viewerSetupButton').addEventListener('click', viewerSetupSheet);
  $('viewerStoryPicker').addEventListener('click', viewerStorySheet);
  $('sheetBackdrop').addEventListener('click', closeSheet);

  $('sheet').addEventListener('click', async event => {
    const action = event.target?.dataset?.sheetAction;
    const storyId = event.target?.dataset?.viewerStory;
    if (action === 'close') closeSheet();
    if (action === 'check') {
      closeSheet();
      await refresh();
    }
    if (action === 'picker-selected') {
      closeSheet();
      await openPicker('selected');
    }
    if (action === 'picker-exclude') {
      closeSheet();
      await openPicker('exclude');
    }
    if (action === 'clear-selected') {
      closeSheet();
      try {
        await api('clear_selected');
        showToast('Список выбранных очищен');
      } catch (error) {
        showToast(error.message);
      }
    }
    if (action === 'clear-excluded') {
      closeSheet();
      try {
        await api('clear_excluded');
        showToast('Исключения очищены');
      } catch (error) {
        showToast(error.message);
      }
    }
    if (storyId) {
      selectedViewerStory = storyId;
      closeSheet();
      renderViewers();
    }
  });

  $('archiveList').addEventListener('click', event => {
    const item = event.target.closest('[data-story-id]');
    if (!item) return;
    const story = (state.history || []).find(entry => String(entry.id) === String(item.dataset.storyId));
    if (!story) return;
    openSheet(`
      <span class="kicker">Story #${story.id}</span>
      <h2>${audienceLong(story.audience, story)}</h2>
      <p>${formatDate(story.ts)} · ${story.protect ? 'Защита включена' : 'Без защиты'}.</p>
      <div class="sheet-list">
        <div class="sheet-item"><strong>Исключено</strong><span>${story.excluded || 0} пользователей</span></div>
        <div class="sheet-item"><strong>Выбрано</strong><span>${story.selected || 0} пользователей</span></div>
        <div class="sheet-item"><strong>Статус</strong><span>${story.deleted ? 'Удалена' : 'Опубликована'}</span></div>
      </div>
      <div class="sheet-actions">
        ${story.deleted ? '' : `<button data-delete-story="${story.id}">Удалить Story</button>`}
        <button data-sheet-action="close">Закрыть</button>
      </div>
    `);
  });

  $('sheet').addEventListener('click', event => {
    const storyId = event.target?.dataset?.deleteStory;
    if (!storyId) return;
    closeSheet();
    deleteStory(storyId);
  });

  $('mainButton').addEventListener('click', async () => {
    if (!state.ready) {
      try {
        await api('check');
        showToast(state.ready ? 'Готово — Telegram подключён' : 'Сначала подключи Telegram Business');
      } catch (error) {
        showToast(error.message);
      }
      return;
    }
    haptic('medium');
    try { tg?.close(); } catch {}
  });

  try {
    tg?.ready();
    tg?.expand();
    tg?.setHeaderColor?.('secondary_bg_color');
    tg?.setBackgroundColor?.('bg_color');
    tg?.disableVerticalSwipes?.();
    tg?.BackButton?.onClick(closeSheet);
  } catch {}

  setAvatar();
  render();

  if (tg?.initData) refresh();
  else showToast('Открой Story Pilot внутри Telegram для управления');
})();
