(() => {
  const tg = window.Telegram?.WebApp;
  const $ = (id) => document.getElementById(id);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const qs = new URLSearchParams(location.search);

  const CODE_AUDIENCE = { s:'standard', a:'all', c:'contacts', f:'close', u:'selected' };
  const DRAFT_CAPTION_KEY = 'story-pilot:draft-caption';

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
  let viewerRegisteredKey = '';
  let composerFile = null;
  let composerDataUrl = '';
  let composerPreviewUrl = '';
  let composerNonce = '';
  let composerBusy = false;
  let viewerState = {
    configured: null,
    backgroundReady: false,
    session: null,
    story: null,
    viewers: [],
    analytics: null,
    degraded: false,
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
    if (!el) return;
    el.textContent = String(message || 'Что-то пошло не так');
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
  }

  async function requestJson(url, options = {}, { retry = false, timeoutMs = 15000 } = {}) {
    const attempts = retry ? 2 : 1;
    let lastError = null;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        const data = await response.json().catch(() => ({}));
        return { response, data };
      } catch (error) {
        lastError = error?.name === 'AbortError'
          ? new Error('Сервер отвечает слишком долго. Попробуй ещё раз.')
          : error;
        if (attempt < attempts - 1) {
          await new Promise(resolve => setTimeout(resolve, 260));
          continue;
        }
      } finally {
        clearTimeout(timeout);
      }
    }

    throw lastError || new Error('Не удалось связаться с сервером');
  }

  function formatBytes(bytes) {
    const value = Number(bytes || 0);
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }

  async function loadImageSource(file) {
    if (window.createImageBitmap) {
      try {
        return await createImageBitmap(file, { imageOrientation:'from-image' });
      } catch {}
    }

    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.decoding = 'async';
      image.src = url;
      await image.decode();
      return image;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function canvasToBlob(canvas, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error('Не удалось подготовить изображение'));
      }, 'image/jpeg', quality);
    });
  }

  async function compressStoryImage(file) {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(String(file?.type || '').toLowerCase())) {
      throw new Error('Поддерживаются JPG, PNG и WEBP');
    }
    if (file.size > 20 * 1024 * 1024) {
      throw new Error('Исходное фото слишком большое. Максимум 20 MB.');
    }

    const source = await loadImageSource(file);
    const sourceWidth = source.width || source.naturalWidth;
    const sourceHeight = source.height || source.naturalHeight;
    if (!sourceWidth || !sourceHeight) throw new Error('Не удалось прочитать размеры изображения');

    const render = async (maxSide, quality) => {
      const scale = Math.min(1, maxSide / Math.max(sourceWidth, sourceHeight));
      const width = Math.max(1, Math.round(sourceWidth * scale));
      const height = Math.max(1, Math.round(sourceHeight * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { alpha:false });
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(source, 0, 0, width, height);
      return canvasToBlob(canvas, quality);
    };

    let blob = await render(1800, .88);
    if (blob.size > 1.75 * 1024 * 1024) blob = await render(1600, .76);
    if (blob.size > 1.75 * 1024 * 1024) blob = await render(1280, .68);
    if (blob.size > 1.9 * 1024 * 1024) {
      throw new Error('Фото не удалось достаточно сжать. Выбери другое изображение.');
    }

    try { source.close?.(); } catch {}

    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Не удалось прочитать подготовленное фото'));
      reader.readAsDataURL(blob);
    });

    return { blob, dataUrl };
  }

  function resetComposer({ keepCaption = false } = {}) {
    composerFile = null;
    composerDataUrl = '';
    composerNonce = '';
    composerBusy = false;
    if (composerPreviewUrl) URL.revokeObjectURL(composerPreviewUrl);
    composerPreviewUrl = '';
    $('storyFileInput').value = '';

    if (!keepCaption) {
      $('storyCaption').value = '';
      $('captionCounter').textContent = '0 / 2048';
      try { sessionStorage.removeItem(DRAFT_CAPTION_KEY); } catch {}
    }

    $('mediaPreview').hidden = true;
    $('pickStoryMedia').hidden = false;
    renderPublish();
  }

  async function prepareComposerFile(file) {
    if (!file) return;

    composerBusy = true;
    $('composerState').textContent = 'Подготавливаю…';
    $('composerState').className = 'composer-state busy';
    renderPublish();

    try {
      const prepared = await compressStoryImage(file);
      composerFile = file;
      composerDataUrl = prepared.dataUrl;
      composerNonce = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
      if (composerPreviewUrl) URL.revokeObjectURL(composerPreviewUrl);
      composerPreviewUrl = URL.createObjectURL(file);

      $('mediaPreviewImage').src = composerPreviewUrl;
      $('mediaFileName').textContent = file.name || 'Фото';
      $('mediaFileMeta').textContent = `${formatBytes(file.size)} → ${formatBytes(prepared.blob.size)}`;
      $('mediaPreview').hidden = false;
      $('pickStoryMedia').hidden = true;
      notify('success');
    } catch (error) {
      resetComposer({ keepCaption: true });
      notify('error');
      showToast(error.message);
    } finally {
      composerBusy = false;
      renderPublish();
    }
  }

  async function publishComposerStory() {
    if (!state.ready) {
      try { await api('check'); } catch {}
      if (!state.ready) {
        connectionHelpSheet();
        return;
      }
    }
    if (!composerDataUrl) {
      $('storyFileInput').click();
      return;
    }
    if (composerBusy || state.processing) return;

    if (state.audience === 'selected' && !state.selected?.length) {
      showToast('Добавь людей для режима «Выбранные»');
      $('selectedRow').click();
      return;
    }
    if (state.excluded?.length && !['all', 'contacts'].includes(state.audience)) {
      showToast('Для исключений выбери «Все» или «Контакты»');
      return;
    }

    composerBusy = true;
    state.processing = true;
    renderPublish();
    haptic('medium');

    try {
      const result = await api('publish_story', {
        imageBase64: composerDataUrl,
        caption: $('storyCaption').value || '',
        nonce: composerNonce || (window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`),
      });

      const publishedStoryId = result.storyId || state.lastStory;
      selectedViewerStory = publishedStoryId || selectedViewerStory;
      const publishedAudience = audienceLabel(state.audience);
      const cleaned = Array.isArray(result.cleanedUsernames) ? result.cleanedUsernames : [];

      resetComposer();
      notify('success');
      showToast(`Story #${publishedStoryId} опубликована`);

      if (viewerState.session?.connected) {
        await refreshViewerSync({ silent:true });
        await refreshViewerAnalytics({ silent:true });
      }

      openSheet(`
        <span class="kicker">Опубликовано</span>
        <h2>Story #${escapeHtml(publishedStoryId)} уже в Telegram</h2>
        <p>Аудитория: ${escapeHtml(publishedAudience)} · Viewer Sync ${viewerState.session?.connected ? 'подхватит просмотры автоматически' : 'можно подключить позже'}.</p>
        <div class="sheet-list">
          <div class="sheet-item"><strong>Публикация</strong><span>Готово · ${escapeHtml(result.transport || 'Telegram')}</span></div>
          <div class="sheet-item"><strong>Защита</strong><span>${state.protect ? 'Включена' : 'Выключена'}</span></div>
          ${cleaned.length ? `<div class="sheet-item"><strong>Очищены старые usernames</strong><span>${cleaned.map(item => '@' + escapeHtml(item)).join(', ')}</span></div>` : ''}
        </div>
        <div class="sheet-actions">
          <button class="accent" data-sheet-action="go-viewers">Смотреть Viewers</button>
          <button data-sheet-action="go-analytics">Открыть Analytics</button>
          <button data-sheet-action="publish-another">Опубликовать ещё</button>
          <button data-sheet-action="close">Готово</button>
        </div>
      `);
    } catch (error) {
      state.processing = false;
      notify('error');
      showToast(error.message);
      throw error;
    } finally {
      composerBusy = false;
      state.processing = false;
      renderPublish();
    }
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

  function formatDuration(seconds) {
    const value = Number(seconds);
    if (!Number.isFinite(value) || value < 0) return '—';
    if (value < 60) return `${Math.max(1, Math.round(value))}с`;
    if (value < 3600) return `${Math.round(value / 60)}м`;
    if (value < 86400) return `${Math.round(value / 3600)}ч`;
    return `${Math.round(value / 86400)}д`;
  }

  function formatIso(value) {
    if (!value) return '—';
    try {
      return new Intl.DateTimeFormat('ru', {
        day:'numeric',
        month:'short',
        hour:'2-digit',
        minute:'2-digit',
      }).format(new Date(value));
    } catch {
      return '—';
    }
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function activityBandLabel(value) {
    return {
      very_high:'VERY HIGH',
      high:'HIGH',
      medium:'MEDIUM',
      low:'LOW',
    }[String(value || '')] || '—';
  }

  function parseUsernameInput(value) {
    return [...new Set(String(value || '')
      .split(/[\s,;]+/)
      .map(item => item.trim().replace(/^@/, '').replace(/[^a-zA-Z0-9_]/g, ''))
      .filter(Boolean))]
      .slice(0, 100);
  }

  function peopleChips(list) {
    if (!list?.length) return '<span>Список пуст</span>';
    return list.slice(0, 30).map(username => `<span>@${escapeHtml(username)}</span>`).join('');
  }

  function buildTimelinePolyline(points, key, maxValue) {
    const width = 320;
    const height = 116;
    const left = 8;
    const right = 8;
    const top = 10;
    const bottom = 16;
    const usableWidth = width - left - right;
    const usableHeight = height - top - bottom;
    const maxMinutes = Math.max(1, ...points.map((point, index) => Number.isFinite(Number(point.minutes)) ? Number(point.minutes) : index));

    return points.map((point, index) => {
      const minute = Number.isFinite(Number(point.minutes)) ? Number(point.minutes) : index;
      const value = Math.max(0, Number(point[key] || 0));
      const x = left + (minute / maxMinutes) * usableWidth;
      const y = top + usableHeight - (value / Math.max(1, maxValue)) * usableHeight;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
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

    const { response, data } = await requestJson('/api/miniapp', options, {
      retry: !action || action === 'check' || action === 'publish_story',
      timeoutMs: action === 'publish_story' ? 45000 : 15000,
    });

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

    const { response, data } = await requestJson(`/api/viewer-sync${query}`, options, {
      retry: !action,
      timeoutMs: 18000,
    });

    if (!response.ok || !data.ok) {
      const error = new Error(data.error || 'Viewer Sync временно недоступен');
      error.viewerData = data;
      throw error;
    }
    return data;
  }

  async function refreshViewerAnalytics({ silent = true } = {}) {
    if (!tg?.initData || !viewerState.session?.connected) {
      viewerState.analytics = null;
      renderAnalytics();
      return;
    }

    try {
      const { response, data } = await requestJson('/api/viewer-sync?analytics=1', {
        method: 'GET',
        headers: {
          'x-telegram-init-data': tg.initData,
          'content-type':'application/json',
        },
      }, { retry:true, timeoutMs:18000 });
      if (!response.ok || !data.ok) throw new Error(data.error || 'Не удалось загрузить Viewer Analytics');
      viewerState.analytics = data.analytics || null;
    } catch (error) {
      if (!silent) showToast(error.message);
    }
    renderAnalytics();
  }

  async function refreshViewerSync({ silent = false } = {}) {
    try {
      let data = await viewerApi();

      const history = (state.history || []).filter(item => !item.deleted && Number(item.ts || 0) > 0);
      const historyKey = history.map(item => `${item.id}:${item.ts}:${item.deleted ? 1 : 0}`).join('|');

      if (data.session?.connected && historyKey && historyKey !== viewerRegisteredKey) {
        await viewerApi('register_stories', { stories: history }, null);
        viewerRegisteredKey = historyKey;
        data = await viewerApi();
      }

      if (data.degraded) {
        viewerState = {
          ...viewerState,
          configured: Boolean(data.config?.configured),
          backgroundReady: Boolean(data.config?.backgroundReady),
          degraded: true,
          error: data.storageError || 'Viewer Sync временно восстанавливает соединение',
        };
      } else {
        viewerState = {
          configured: Boolean(data.config?.configured),
          backgroundReady: Boolean(data.config?.backgroundReady),
          session: data.session || null,
          story: data.story || null,
          viewers: data.viewers || [],
          analytics: viewerState.analytics,
          degraded: false,
          error: null,
        };
      }
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
      $('heroText').textContent = 'Фото, аудитория, защита, публикация и аналитика — всё прямо внутри Story Pilot.';
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

    $('composerCard').classList.toggle('disabled', !ready);
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
      ? `${state.selected.length} выбрано · редактировать в приложении`
      : 'Добавить @usernames · до 100';
    $('excludedMeta').textContent = state.excluded?.length
      ? `${state.excluded.length} исключено · редактировать в приложении`
      : 'Добавить @usernames · для «Все» и «Контакты»';

    $('protectSwitch').checked = Boolean(state.protect);
    $('selectedAudienceDesc').textContent = state.selected?.length
      ? `${state.selected.length} пользователей`
      : 'Только конкретные люди';

    $('composerAudience').textContent = `Аудитория: ${audienceLabel(state.audience)}`;
    $('composerProtection').textContent = `Защита: ${state.protect ? 'вкл' : 'выкл'}`;

    const composerState = $('composerState');
    if (composerBusy || state.processing) {
      composerState.textContent = state.processing ? 'Публикую…' : 'Подготавливаю…';
      composerState.className = 'composer-state busy';
    } else if (composerDataUrl) {
      composerState.textContent = 'Готово';
      composerState.className = 'composer-state ready';
    } else {
      composerState.textContent = 'Не выбрано';
      composerState.className = 'composer-state';
    }

    if (latest) {
      $('lastStoryTitle').textContent = `Story #${latest.id} · ${audienceLong(latest.audience, latest)}`;
      $('lastStoryMeta').textContent = `${formatDate(latest.ts)}${latest.protect ? ' · защита включена' : ''}`;
    } else {
      $('lastStoryTitle').textContent = 'Пока нет публикаций';
      $('lastStoryMeta').textContent = 'Выбери фото выше и опубликуй Story';
    }

    $('deleteStory').disabled = !state.lastStory || !state.ready;
    const mainLabel = $('mainButton').querySelector('b');
    const mainIcon = $('mainButton').querySelector('span');
    $('mainButton').disabled = Boolean(composerBusy || state.processing);

    if (!state.ready) {
      mainIcon.textContent = '↻';
      mainLabel.textContent = 'Проверить подключение';
    } else if (composerBusy || state.processing) {
      mainIcon.textContent = '…';
      mainLabel.textContent = state.processing ? 'Публикую Story…' : 'Подготавливаю фото…';
    } else if (!composerDataUrl) {
      mainIcon.textContent = '＋';
      mainLabel.textContent = 'Выбрать фото';
    } else {
      mainIcon.textContent = '↑';
      mainLabel.textContent = 'Опубликовать Story';
    }
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

    const hasStory = Boolean(item && !item.deleted);
    const quickTelegram = $('quickTelegramStatus');
    const quickViewer = $('quickViewerStatus');
    const quickStory = $('quickStoryStatus');
    const quickBadge = $('quickReadyBadge');
    const quickPrimary = $('quickPrimaryButton');
    const testAlertButton = $('testAlertButton');

    quickTelegram.textContent = state.ready ? 'Готово' : 'Нужно подключить';
    quickViewer.textContent = connected ? 'Готово' : 'Нужно подключить';
    quickStory.textContent = hasStory ? `#${item.id}` : 'Нужно опубликовать';

    $('quickTelegramStep').classList.toggle('done', Boolean(state.ready));
    $('quickViewerStep').classList.toggle('done', connected);
    $('quickStoryStep').classList.toggle('done', hasStory);

    const completed = [Boolean(state.ready), connected, hasStory].filter(Boolean).length;
    quickBadge.textContent = completed === 3 ? '3/3 · READY' : `${completed}/3`;
    quickBadge.classList.toggle('ready', completed === 3);

    if (!state.ready) {
      quickPrimary.textContent = 'Проверить Telegram';
    } else if (!connected) {
      quickPrimary.textContent = 'Подключить Viewer Sync';
    } else if (!hasStory) {
      quickPrimary.textContent = 'Опубликовать Story';
    } else {
      quickPrimary.textContent = 'Обновить данные';
    }

    testAlertButton.disabled = !connected;

    syncState.className = 'viewer-sync-state';
    if (viewerState.degraded) {
      $('viewerSyncTitle').textContent = 'Viewer Sync восстанавливает соединение.';
      $('viewerSyncText').textContent = viewerState.error || 'Данные зрителей временно недоступны. Публикация Stories продолжает работать.';
      syncState.textContent = 'Временная проблема хранилища · повторяем автоматически';
      syncState.classList.add('warn');
      syncButton.textContent = connected ? 'Управление Viewer Sync' : 'Обновить';
    } else if (viewerState.configured === false) {
      $('viewerSyncTitle').textContent = 'Viewer Sync backend почти готов.';
      $('viewerSyncText').textContent = 'Watcher и авторизация уже установлены. Для фоновых уведомлений нужно отдельное защищённое серверное хранилище.';
      syncState.textContent = 'Нужно завершить серверную настройку Viewer Sync';
      syncState.classList.add('warn');
      syncButton.textContent = 'Что осталось подключить';
    } else if (connected) {
      const account = viewerState.session?.account || {};
      $('viewerSyncTitle').textContent = 'Viewer Sync активен.';
      $('viewerSyncText').textContent = 'Fast Alerts работают автоматически: новый view замечается в фоне, затем проходит privacy reconciliation.';
      const alertsOn = viewerState.session?.preferences?.notifyEnabled !== false;
      syncState.textContent = `${account.username ? '@' + account.username : account.firstName || 'Telegram account'} · ${viewerState.backgroundReady ? 'фоновые проверки включены' : 'фоновый cron требует настройки'} · уведомления ${alertsOn ? 'вкл' : 'выкл'}`;
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
          <div class="viewer-avatar">${escapeHtml(initials)}</div>
          <div class="viewer-copy">
            <strong>${escapeHtml(name)}</strong>
            <span>${escapeHtml(username)}${viewer.is_contact ? ' · контакт' : ''}</span>
          </div>
          <div class="viewer-side">
            <strong>${escapeHtml(viewedAt)}</strong>
            <span>confirmed${escapeHtml(reaction)}</span>
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

    const intel = viewerState.analytics;
    const connected = viewerState.session?.connected === true;
    $('viewerAnalyticsBadge').textContent = connected ? 'Live data' : 'Viewer Sync';
    $('exportCsvButton').disabled = !connected;
    $('intelUnique').textContent = intel ? String(intel.uniqueViewers || 0) : '—';
    $('intelRepeat').textContent = intel ? String(intel.repeatViewers || 0) : '—';
    $('intelGap').textContent = intel ? String(intel.unattributedViews || 0) : '—';
    $('intelDelay').textContent = intel ? formatDuration(intel.avgDelaySec) : '—';
    $('intelContacts').textContent = intel ? String(intel.contacts || 0) : '—';
    $('intelNonContacts').textContent = intel ? String(intel.nonContacts || 0) : '—';
    $('intelReactions').textContent = intel ? String(intel.reactions || 0) : '—';
    $('intelForwards').textContent = intel ? String(intel.forwards || 0) : '—';

    $('intelEmpty').style.display = intel ? 'none' : 'block';

    const timeline = intel?.latestTimeline || [];
    const timelineStoryId = intel?.latestTimelineStoryId || null;
    if (!timeline.length) {
      $('timelineTitle').textContent = timelineStoryId ? `Story #${timelineStoryId}` : 'Последняя Story';
      $('timelineMeta').textContent = 'snapshots';
      $('timelineChart').innerHTML = '';
      $('timelineChartWrap').style.display = 'none';
      $('timelineEmpty').style.display = 'block';
    } else {
      const maxValue = Math.max(1, ...timeline.map(point => Number(point.totalViews || 0)));
      const totalLine = buildTimelinePolyline(timeline, 'totalViews', maxValue);
      const knownLine = buildTimelinePolyline(timeline, 'identifiedViews', maxValue);
      const gapLine = buildTimelinePolyline(timeline, 'unattributedViews', maxValue);
      const lastPoint = timeline[timeline.length - 1] || {};
      const maxMinutes = Math.max(0, ...timeline.map(point => Number(point.minutes || 0)));

      $('timelineTitle').textContent = timelineStoryId ? `Story #${timelineStoryId}` : 'Последняя Story';
      $('timelineMeta').textContent = `${timeline.length} snapshots · ${lastPoint.totalViews || 0} views · ${maxMinutes}м`;
      $('timelineChartWrap').style.display = 'block';
      $('timelineEmpty').style.display = 'none';
      $('timelineChart').innerHTML = `
        <g class="timeline-grid">
          <line x1="8" y1="10" x2="312" y2="10"></line>
          <line x1="8" y1="55" x2="312" y2="55"></line>
          <line x1="8" y1="100" x2="312" y2="100"></line>
        </g>
        <polyline class="timeline-line timeline-total" points="${totalLine}"></polyline>
        <polyline class="timeline-line timeline-known" points="${knownLine}"></polyline>
        <polyline class="timeline-line timeline-gap" points="${gapLine}"></polyline>
      `;
    }

    const people = intel?.topPeople || [];
    if (!people.length) {
      $('topAudienceList').innerHTML = '<div class="intel-empty">Когда появятся подтверждённые просмотры нескольких Stories, здесь станет видна повторяемость аудитории.</div>';
    } else {
      $('topAudienceList').innerHTML = people.slice(0, 10).map((person, index) => {
        const name = person.displayName || (person.username ? '@' + person.username : 'Telegram user');
        const handle = person.username ? '@' + person.username : (person.isContact ? 'контакт' : 'viewer');
        const fast = Number.isFinite(Number(person.fast15Rate)) ? `${person.fast15Rate}% ≤15м` : 'скорость —';
        const score = Number.isFinite(Number(person.activityScore)) ? Number(person.activityScore) : null;
        const band = activityBandLabel(person.activityBand);
        return `
          <button class="top-person" type="button" data-person-id="${escapeHtml(person.viewerUserId)}">
            <span class="top-rank">${index + 1}</span>
            <span class="top-person-copy">
              <strong>${escapeHtml(name)}</strong>
              <small>${escapeHtml(handle)} · ${person.viewedStories} Stories · ${escapeHtml(fast)}</small>
            </span>
            <span class="top-person-side activity-score-side">
              <strong>${score ?? '—'}</strong>
              <small>${escapeHtml(band)}</small>
            </span>
          </button>`;
      }).join('');
    }

    const performance = intel?.storyPerformance || [];
    if (!performance.length) {
      $('storyPerformanceList').innerHTML = '<div class="intel-empty">После первых snapshots здесь появится скорость набора просмотров.</div>';
    } else {
      $('storyPerformanceList').innerHTML = performance.slice(0, 8).map(story => {
        const milestones = [
          ['5м', story.views5m],
          ['15м', story.views15m],
          ['60м', story.views60m],
        ].map(([label, value]) => `<span><small>${label}</small><strong>${value ?? '—'}</strong></span>`).join('');
        return `
          <article class="performance-row">
            <div>
              <strong>Story #${escapeHtml(story.storyId)}</strong>
              <small>${escapeHtml(formatIso(story.postedAt))} · ${story.views} total · ${Math.max(0, story.views - story.identified)} unattributed</small>
            </div>
            <div class="milestones">${milestones}</div>
          </article>`;
      }).join('');
    }
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
    document.querySelectorAll('.screen').forEach(screen => screen.classList.toggle('active', screen.dataset.screen === name));
    document.querySelectorAll('.nav-item').forEach(button => button.classList.toggle('active', button.dataset.nav === name));
    $('actionDock').classList.toggle('hidden', name !== 'publish');
    haptic();
    window.scrollTo({ top:0, behavior:'smooth' });
    if (name === 'viewers' && tg?.initData) refreshViewerSync({ silent: true });
    if (name === 'analytics' && tg?.initData) refreshViewerAnalytics({ silent: true });
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
        <div class="sheet-item"><strong>Viewer Sync</strong><span>${viewerState.session?.connected ? 'Подключён · фоновые просмотры активны' : 'Не подключён'}</span></div>
      </div>
      <div class="sheet-actions">
        <button class="accent" data-sheet-action="check">Проверить Telegram</button>
        <button data-sheet-action="close">Закрыть</button>
      </div>
    `);
  }

  function connectionHelpSheet() {
    openSheet(`
      <span class="kicker">Telegram Business</span>
      <h2>Одноразовое подключение</h2>
      <p>Саму публикацию, аудиторию, Viewer Sync и аналитику Story Pilot делает внутри Mini App. Только системное разрешение Telegram Business выдаётся в настройках Telegram.</p>
      <div class="sheet-list">
        <div class="sheet-item"><strong>1. Открой Telegram Settings</strong><span>Telegram Business / Business → Chatbots (название пункта может немного отличаться).</span></div>
        <div class="sheet-item"><strong>2. Подключи @Storypilotlab_bot</strong><span>Разреши управление Stories / can_manage_stories.</span></div>
        <div class="sheet-item"><strong>3. Вернись сюда</strong><span>Нажми «Проверить подключение» — остальной процесс остаётся внутри приложения.</span></div>
      </div>
      <div class="sheet-actions">
        <button class="accent" data-sheet-action="check">Проверить подключение</button>
        <button data-sheet-action="close">Закрыть</button>
      </div>
    `);
  }

  function viewerSetupSheet() {
    if (viewerState.configured === false) {
      openSheet(`
        <span class="kicker">Viewer Sync</span>
        <h2>Watcher уже в коде</h2>
        <p>Осталось подключить отдельную серверную БД и ключ шифрования. До этого Story Pilot не будет просить Telegram-код: пользовательскую сессию нельзя хранить небезопасно.</p>
        <div class="sheet-list">
          <div class="sheet-item"><strong>Realtime watcher</strong><span>Проверка Stories по расписанию и уведомления уже реализованы.</span></div>
          <div class="sheet-item"><strong>Privacy reconciliation</strong><span>Сразу приходит обезличенное уведомление. Имя появляется только если просмотр остаётся видимым после окна приватности.</span></div>
          <div class="sheet-item"><strong>Storage</strong><span>Нужны server-only таблицы и AES-GCM master key для MTProto-сессии.</span></div>
        </div>
        <div class="sheet-actions"><button class="accent" data-sheet-action="close">Понятно</button></div>
      `);
      return;
    }

    if (viewerState.session?.connected) {
      const account = viewerState.session.account || {};
      openSheet(`
        <span class="kicker">Viewer Sync</span>
        <h2>Подключено</h2>
        <p>${account.username ? '@' + account.username : account.firstName || 'Telegram account'} используется только для чтения данных твоих собственных Stories.</p>
        <div class="sheet-list">
          <div class="sheet-item preference-item">
            <span class="preference-copy"><strong>Realtime alerts</strong><span>Уведомлять о новых просмотрах.</span></span>
            <label class="switch">
              <input id="viewerNotifySwitch" type="checkbox" data-viewer-pref="notify" ${viewerState.session?.preferences?.notifyEnabled !== false ? 'checked' : ''} />
              <span></span>
            </label>
          </div>
          <div class="sheet-item preference-item">
            <span class="preference-copy"><strong>Unattributed gap</strong><span>Отдельно уведомлять, когда растёт общий счётчик без доступной личности.</span></span>
            <label class="switch">
              <input id="viewerGapSwitch" type="checkbox" data-viewer-pref="gap" ${viewerState.session?.preferences?.notifyAnonymousGap !== false ? 'checked' : ''} />
              <span></span>
            </label>
          </div>
          <div class="sheet-item"><strong>Как работает</strong><span>Новый view → быстрый сигнал → reconciliation → подтверждённый viewer или анонимизация.</span></div>
          <div class="sheet-item"><strong>Последняя проверка</strong><span>${viewerState.session.lastPollAt ? new Date(viewerState.session.lastPollAt).toLocaleString('ru-RU') : 'ещё не запускалась'}</span></div>
        </div>
        <div class="sheet-actions">
          <button data-sheet-action="viewer-disconnect">Отключить Viewer Sync</button>
          <button data-sheet-action="close">Закрыть</button>
        </div>
      `);
      return;
    }

    openSheet(`
      <span class="kicker">Viewer Sync</span>
      <h2>Подключить Telegram</h2>
      <p>Это отдельная пользовательская MTProto-сессия для чтения viewers твоих собственных Stories. Story Pilot не сохраняет код входа или 2FA-пароль.</p>
      <div class="auth-form">
        <div class="auth-field">
          <label for="viewerPhone">Номер Telegram</label>
          <input id="viewerPhone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+374..." />
        </div>
        <div class="auth-help">Telegram отправит код в приложение или другим доступным способом.</div>
      </div>
      <div class="sheet-actions">
        <button class="accent" data-sheet-action="viewer-send-code">Получить код</button>
        <button data-sheet-action="close">Отмена</button>
      </div>
    `);
  }

  function viewerCodeSheet(delivery) {
    openSheet(`
      <span class="kicker">Viewer Sync</span>
      <h2>Введи код Telegram</h2>
      <p>${delivery === 'telegram_app' ? 'Код отправлен в Telegram.' : 'Telegram выбрал доступный способ доставки кода.'}</p>
      <div class="auth-form">
        <div class="auth-field">
          <label for="viewerCode">Код</label>
          <input id="viewerCode" type="text" inputmode="numeric" autocomplete="one-time-code" placeholder="12345" />
        </div>
      </div>
      <div class="sheet-actions">
        <button class="accent" data-sheet-action="viewer-verify-code">Подтвердить</button>
        <button data-sheet-action="close">Отмена</button>
      </div>
    `);
  }

  function viewerPasswordSheet() {
    openSheet(`
      <span class="kicker">Двухэтапная защита</span>
      <h2>Нужен 2FA-пароль</h2>
      <p>Пароль передаётся Telegram только для завершения входа и не сохраняется Story Pilot.</p>
      <div class="auth-form">
        <div class="auth-field">
          <label for="viewerPassword">Telegram 2FA</label>
          <input id="viewerPassword" type="password" autocomplete="current-password" placeholder="Пароль" />
        </div>
      </div>
      <div class="sheet-actions">
        <button class="accent" data-sheet-action="viewer-verify-password">Подключить</button>
        <button data-sheet-action="close">Отмена</button>
      </div>
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

  document.querySelectorAll('.nav-item').forEach(button => button.addEventListener('click', () => switchScreen(button.dataset.nav)));
  document.querySelectorAll('.audience-card').forEach(button => button.addEventListener('click', async () => {
    const mode = button.dataset.audience;
    if (mode === 'selected' && !state.selected?.length) {
      $('selectedRow').click();
      return;
    }
    await setAudience(mode);
  }));
  $('protectSwitch').addEventListener('change', event => setProtect(event.target.checked));
  $('selectedRow').addEventListener('click', () => {
    openSheet(`
      <span class="kicker">Только выбранные</span>
      <h2>${state.selected?.length ? `${state.selected.length} пользователей` : 'Добавь людей'}</h2>
      <p>Вставь @username через пробел, запятую или с новой строки. До 100 человек — без выхода из Story Pilot.</p>
      <div class="people-input-wrap">
        <label for="selectedUsernames">Usernames <small id="selectedInputCount">${state.selected?.length || 0} / 100</small></label>
        <textarea id="selectedUsernames" data-people-input="selected" placeholder="@alex\n@maria">${state.selected?.length ? '@' + state.selected.join('\n@') : ''}</textarea>
      </div>
      <div class="people-chips" id="selectedInputChips">${peopleChips(state.selected)}</div>
      <div class="sheet-actions">
        <button class="accent" data-sheet-action="save-selected">Сохранить</button>
        ${state.selected?.length ? '<button data-sheet-action="clear-selected">Очистить список</button>' : ''}
        <button data-sheet-action="close">Закрыть</button>
      </div>
    `);
  });
  $('excludeRow').addEventListener('click', () => {
    openSheet(`
      <span class="kicker">Исключения</span>
      <h2>${state.excluded?.length ? `${state.excluded.length} исключено` : 'Добавь исключения'}</h2>
      <p>Вставь @username. Если выбран другой режим, Story Pilot сам переключит аудиторию на «Контакты». Всё остаётся внутри приложения.</p>
      <div class="people-input-wrap">
        <label for="excludedUsernames">Usernames <small id="excludedInputCount">${state.excluded?.length || 0} / 100</small></label>
        <textarea id="excludedUsernames" data-people-input="excluded" placeholder="@alex\n@maria">${state.excluded?.length ? '@' + state.excluded.join('\n@') : ''}</textarea>
      </div>
      <div class="people-chips" id="excludedInputChips">${peopleChips(state.excluded)}</div>
      <div class="sheet-actions">
        <button class="accent" data-sheet-action="save-excluded">Сохранить</button>
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
      if (state.ready) showToast('Подключение активно');
      else connectionHelpSheet();
    } catch (error) {
      showToast(error.message);
      connectionHelpSheet();
    }
  });
  $('profileButton').addEventListener('click', profileSheet);
  $('viewerSetupButton').addEventListener('click', viewerSetupSheet);
  $('viewerStoryPicker').addEventListener('click', viewerStorySheet);

  $('quickPrimaryButton').addEventListener('click', async () => {
    const connected = viewerState.session?.connected === true;
    const item = (state.history || []).find(entry => !entry.deleted) || null;

    if (!state.ready) {
      try {
        await api('check');
        showToast(state.ready ? 'Telegram подключён' : 'Нужно подключить Telegram Business');
      } catch (error) {
        showToast(error.message);
      }
      return;
    }

    if (!connected) {
      viewerSetupSheet();
      return;
    }

    if (!item) {
      switchScreen('publish');
      showToast('Выбери фото — всё остальное делается здесь');
      setTimeout(() => $('storyFileInput').click(), 180);
      return;
    }

    await refreshViewerSync({ silent: false });
    await refreshViewerAnalytics({ silent: true });
    showToast('Данные обновлены');
  });

  $('testAlertButton').addEventListener('click', async () => {
    const button = $('testAlertButton');
    if (!viewerState.session?.connected) {
      showToast('Сначала подключи Viewer Sync');
      return;
    }

    const previous = button.textContent;
    button.disabled = true;
    button.textContent = 'Отправляю тест…';

    try {
      await viewerApi('test_alert', {}, null);
      notify('success');
      showToast('Тестовое уведомление отправлено в чат');
      button.textContent = 'Уведомление отправлено ✓';
      setTimeout(() => {
        button.textContent = previous;
        button.disabled = !viewerState.session?.connected;
      }, 1600);
    } catch (error) {
      notify('error');
      showToast(error.message);
      button.textContent = previous;
      button.disabled = !viewerState.session?.connected;
    }
  });
  $('viewerSearch').addEventListener('input', event => {
    viewerSearchQuery = event.target.value || '';
    renderViewers();
  });

  $('exportCsvButton').addEventListener('click', async () => {
    const button = $('exportCsvButton');
    if (!viewerState.session?.connected || button.disabled) {
      showToast('Сначала подключи Viewer Sync');
      return;
    }

    const previous = button.textContent;
    button.disabled = true;
    button.textContent = 'Готовлю CSV…';
    haptic('medium');

    try {
      const result = await viewerApi('export_csv', {}, null);
      notify('success');
      showToast(`CSV отправлен в чат · ${result.storyCount || 0} Stories · ${result.viewerCount || 0} viewers`);
      button.textContent = 'CSV отправлен ✓';
      setTimeout(() => {
        button.textContent = previous;
        button.disabled = !viewerState.session?.connected;
      }, 1800);
    } catch (error) {
      showToast(error.message);
      notify('error');
      button.textContent = previous;
      button.disabled = !viewerState.session?.connected;
    }
  });
  $('topAudienceList').addEventListener('click', event => {
    const row = event.target.closest('[data-person-id]');
    if (!row) return;
    const person = (viewerState.analytics?.topPeople || []).find(
      item => String(item.viewerUserId) === String(row.dataset.personId),
    );
    if (!person) return;

    const name = person.displayName || (person.username ? '@' + person.username : 'Telegram user');
    const handle = person.username ? '@' + person.username : (person.isContact ? 'Контакт Telegram' : 'Без username');
    openSheet(`
      <span class="kicker">Viewer profile</span>
      <h2>${escapeHtml(name)}</h2>
      <p>${escapeHtml(handle)} · только подтверждённые Story interactions.</p>
      <div class="sheet-list">
        <div class="sheet-item score-summary">
          <strong>Activity Score</strong>
          <span><b>${Number.isFinite(Number(person.activityScore)) ? person.activityScore : '—'}</b> · ${escapeHtml(activityBandLabel(person.activityBand))} · confidence ${person.scoreConfidence ?? 0}%</span>
        </div>
        <div class="sheet-item"><strong>Stories viewed</strong><span>${person.viewedStories || 0}</span></div>
        <div class="sheet-item"><strong>First seen</strong><span>${escapeHtml(formatIso(person.firstSeenAt))}</span></div>
        <div class="sheet-item"><strong>Last seen</strong><span>${escapeHtml(formatIso(person.lastSeenAt))}</span></div>
        <div class="sheet-item"><strong>Average delay</strong><span>${escapeHtml(formatDuration(person.avgDelaySec))}</span></div>
        <div class="sheet-item"><strong>Fast views ≤ 15 min</strong><span>${Number.isFinite(Number(person.fast15Rate)) ? person.fast15Rate + '%' : '—'}</span></div>
        <div class="sheet-item"><strong>Reactions</strong><span>${person.reactions || 0}</span></div>
        <div class="sheet-item"><strong>Score factors</strong><span>frequency ${person.scoreFactors?.frequency ?? 0}% · latency ${person.scoreFactors?.latency ?? 0}% · reactions ${person.scoreFactors?.reactions ?? 0}% · recency ${person.scoreFactors?.recency ?? 0}%</span></div>
      </div>
      <div class="sheet-actions"><button class="accent" data-sheet-action="close">Закрыть</button></div>
    `);
  });
  $('sheetBackdrop').addEventListener('click', closeSheet);

  $('sheet').addEventListener('input', event => {
    const kind = event.target?.dataset?.peopleInput;
    if (!kind) return;

    const usernames = parseUsernameInput(event.target.value || '');
    const count = $(kind === 'selected' ? 'selectedInputCount' : 'excludedInputCount');
    const chips = $(kind === 'selected' ? 'selectedInputChips' : 'excludedInputChips');
    if (count) count.textContent = `${usernames.length} / 100`;
    if (chips) chips.innerHTML = peopleChips(usernames);
  });

  $('sheet').addEventListener('change', async event => {
    const pref = event.target?.dataset?.viewerPref;
    if (!pref) return;

    const notifyEnabled = $('viewerNotifySwitch')?.checked !== false;
    const notifyAnonymousGap = $('viewerGapSwitch')?.checked !== false;

    try {
      const data = await viewerApi('preferences', {
        notifyEnabled,
        notifyAnonymousGap,
      }, null);
      if (data.session) viewerState.session = data.session;
      renderViewers();
      showToast('Настройки уведомлений сохранены');
      haptic();
    } catch (error) {
      showToast(error.message);
      notify('error');
    }
  });

  $('sheet').addEventListener('click', async event => {
    const action = event.target?.dataset?.sheetAction;
    const storyId = event.target?.dataset?.viewerStory;
    if (action === 'close') closeSheet();
    if (action === 'check') {
      closeSheet();
      await refresh();
      if (!state.ready) setTimeout(connectionHelpSheet, 120);
    }
    if (action === 'go-viewers') {
      closeSheet();
      switchScreen('viewers');
      await refreshViewerSync({ silent:true });
    }
    if (action === 'go-analytics') {
      closeSheet();
      switchScreen('analytics');
      await refreshViewerAnalytics({ silent:true });
    }
    if (action === 'publish-another') {
      closeSheet();
      switchScreen('publish');
      setTimeout(() => $('storyFileInput').click(), 160);
    }
    if (action === 'save-selected') {
      const usernames = parseUsernameInput($('selectedUsernames')?.value || '');
      try {
        const data = await api('set_selected', { usernames });
        closeSheet();
        showToast(usernames.length ? `${usernames.length} пользователей сохранено` : 'Список очищен');
        if (data.state) state = { ...state, ...data.state };
        render();
      } catch (error) {
        showToast(error.message);
      }
    }
    if (action === 'save-excluded') {
      const usernames = parseUsernameInput($('excludedUsernames')?.value || '');
      try {
        const data = await api('set_excluded', { usernames });
        closeSheet();
        showToast(usernames.length ? `${usernames.length} исключений сохранено` : 'Исключения очищены');
        if (data.state) state = { ...state, ...data.state };
        render();
      } catch (error) {
        showToast(error.message);
      }
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
    if (action === 'viewer-send-code') {
      const phone = $('viewerPhone')?.value || '';
      try {
        const data = await viewerApi('send_code', { phone }, null);
        viewerCodeSheet(data.delivery);
      } catch (error) {
        showToast(error.message);
      }
    }
    if (action === 'viewer-verify-code') {
      const code = $('viewerCode')?.value || '';
      try {
        const data = await viewerApi('verify_code', { code }, null);
        if (data.needsPassword) {
          viewerPasswordSheet();
        } else {
          closeSheet();
          notify('success');
          showToast('Viewer Sync подключён');
          await refreshViewerSync({ silent: true });
          await refreshViewerAnalytics({ silent: true });
        }
      } catch (error) {
        showToast(error.message);
      }
    }
    if (action === 'viewer-verify-password') {
      const password = $('viewerPassword')?.value || '';
      try {
        await viewerApi('verify_password', { password }, null);
        closeSheet();
        notify('success');
        showToast('Viewer Sync подключён');
        await refreshViewerSync({ silent: true });
        await refreshViewerAnalytics({ silent: true });
      } catch (error) {
        showToast(error.message);
      }
    }
    if (action === 'viewer-disconnect') {
      try {
        await viewerApi('disconnect', {}, null);
        closeSheet();
        viewerState = {
          configured: true,
          backgroundReady: viewerState.backgroundReady,
          session: null,
          story: null,
          viewers: [],
          analytics: null,
          degraded: false,
          error: null,
        };
        renderViewers();
        showToast('Viewer Sync отключён');
      } catch (error) {
        showToast(error.message);
      }
    }
    if (storyId) {
      selectedViewerStory = storyId;
      closeSheet();
      renderViewers();
      await refreshViewerSync({ silent: true });
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

  $('pickStoryMedia').addEventListener('click', () => {
    if (!state.ready) {
      showToast('Сначала подключи Telegram Business');
      return;
    }
    $('storyFileInput').click();
  });

  $('storyFileInput').addEventListener('change', event => {
    prepareComposerFile(event.target.files?.[0] || null);
  });

  $('removeStoryMedia').addEventListener('click', () => resetComposer({ keepCaption: true }));

  $('storyCaption').addEventListener('input', event => {
    $('captionCounter').textContent = `${event.target.value.length} / 2048`;
    try { sessionStorage.setItem(DRAFT_CAPTION_KEY, event.target.value || ''); } catch {}
  });

  $('mainButton').addEventListener('click', async () => {
    try {
      await publishComposerStory();
    } catch {}
  });

  try {
    tg?.ready();
    tg?.expand();
    tg?.setHeaderColor?.('secondary_bg_color');
    tg?.setBackgroundColor?.('bg_color');
    tg?.disableVerticalSwipes?.();
    tg?.BackButton?.onClick(closeSheet);
  } catch {}

  try {
    const draftCaption = sessionStorage.getItem(DRAFT_CAPTION_KEY) || '';
    if (draftCaption) {
      $('storyCaption').value = draftCaption.slice(0, 2048);
      $('captionCounter').textContent = `${$('storyCaption').value.length} / 2048`;
    }
  } catch {}

  window.addEventListener('unhandledrejection', event => {
    const message = event?.reason?.message || String(event?.reason || '');
    if (message) {
      console.warn('Story Pilot unhandled rejection', message);
      showToast(message);
    }
  });

  window.addEventListener('error', event => {
    const message = event?.error?.message || event?.message || '';
    if (message) {
      console.warn('Story Pilot UI error', message);
      showToast('Интерфейс восстановился после ошибки');
    }
  });

  setAvatar();
  render();

  if (tg?.initData) {
    refresh();
    refreshViewerSync({ silent: true });
    setInterval(() => {
      if (currentScreen === 'viewers' && viewerState.session?.connected) {
        refreshViewerSync({ silent: true });
      }
      if (currentScreen === 'analytics' && viewerState.session?.connected) {
        refreshViewerAnalytics({ silent: true });
      }
    }, 30000);
  } else {
    showToast('Открой Story Pilot внутри Telegram для управления');
  }
})();
