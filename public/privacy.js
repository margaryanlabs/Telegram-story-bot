(() => {
  const tg = window.Telegram?.WebApp;
  const $ = id => document.getElementById(id);

  const privacyState = {
    loading: false,
    settings: {
      antiDelete: false,
      editHistory: false,
      ghostInbox: false,
      retentionDays: 30,
    },
    threads: [],
    activeThread: null,
    query: '',
    filter: 'all',
    lastTotalMessages: 0,
    lastRefreshAt: null,
    mediaObjectUrl: null,
    autoTimer: null,
    degraded: false,
    connection: {
      loaded: false,
      live: false,
      ready: false,
      state: 'unknown',
      readMessages: false,
      error: false,
    },
  };

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function formatWhen(value) {
    if (!value) return '—';
    try {
      return new Intl.DateTimeFormat('ru', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(value));
    } catch {
      return '—';
    }
  }

  function formatBytes(value) {
    const bytes = Number(value || 0);
    if (!Number.isFinite(bytes) || bytes <= 0) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
  }

  function initials(value) {
    const clean = String(value || 'TG').replace(/^@/, '').trim();
    return clean.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'TG';
  }

  function toast(message) {
    const el = $('toast');
    if (!el) return;
    el.textContent = String(message || '');
    el.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  function haptic(type = 'light') {
    try { tg?.HapticFeedback?.impactOccurred(type); } catch {}
  }

  function privacyScreenActive() {
    const screen = document.querySelector('.screen.active')?.dataset?.screen;
    return screen === 'privacy' || screen === 'chats';
  }

  function fullyEnabled(settings = privacyState.settings) {
    return Boolean(settings.antiDelete && settings.editHistory && settings.ghostInbox);
  }

  function anyEnabled(settings = privacyState.settings) {
    return Boolean(settings.antiDelete || settings.editHistory || settings.ghostInbox);
  }

  async function loadTelegramConnection({ silent = true } = {}) {
    if (!tg?.initData || navigator.onLine === false) return privacyState.connection;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch('/api/miniapp', {
        method: 'GET',
        headers: {
          'x-telegram-init-data': tg.initData,
          'content-type': 'application/json',
        },
        signal: controller.signal,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || 'Не удалось проверить Telegram');

      privacyState.connection = {
        loaded: true,
        live: Boolean(data.state?.live),
        ready: Boolean(data.state?.ready),
        state: String(data.state?.connection || 'unknown'),
        readMessages: Boolean(data.state?.readPermission),
        error: false,
      };
      render();
      return privacyState.connection;
    } catch (error) {
      privacyState.connection = {
        ...privacyState.connection,
        loaded: true,
        error: true,
      };
      render();
      if (!silent) toast(error?.name === 'AbortError' ? 'Telegram отвечает слишком долго' : error.message);
      return privacyState.connection;
    } finally {
      clearTimeout(timeout);
    }
  }

  async function request(action = null, payload = {}) {
    if (!tg?.initData) throw new Error('Открой Story Pilot внутри Telegram');

    const retryable = !action || action === 'list_messages' || action === 'versions';
    const attempts = retryable ? 2 : 1;
    let lastError = null;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      if (attempt) await new Promise(resolve => setTimeout(resolve, 550));

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 16000);
      try {
        const response = await fetch('/api/privacy', {
          method: action ? 'POST' : 'GET',
          headers: {
            'x-telegram-init-data': tg.initData,
            'content-type': 'application/json',
          },
          body: action ? JSON.stringify({ action, ...payload }) : undefined,
          signal: controller.signal,
        });
        const data = await response.json().catch(() => ({}));
        if (response.ok && data.ok) return data;

        const error = new Error(data.error || 'Ghost Inbox временно недоступен');
        error.status = response.status;
        lastError = error;
        if (!retryable || ![502,503,504].includes(response.status) || attempt === attempts - 1) throw error;
      } catch (error) {
        const normalized = error?.name === 'AbortError'
          ? new Error('Ghost Inbox отвечает слишком долго')
          : error;
        lastError = normalized;
        if (!retryable || attempt === attempts - 1) throw normalized;
      } finally {
        clearTimeout(timeout);
      }
    }

    throw lastError || new Error('Ghost Inbox временно недоступен');
  }

  function threadTotals(threads = privacyState.threads) {
    return threads.reduce((acc, thread) => {
      acc.messages += Number(thread.messageCount || 0);
      acc.deleted += Number(thread.deletedCount || 0);
      acc.edited += Number(thread.editedCount || 0);
      acc.media += Number(thread.mediaCount || 0);
      acc.vault += Number(thread.vaultCount || 0);
      return acc;
    }, { messages:0, deleted:0, edited:0, media:0, vault:0 });
  }

  function filteredThreads() {
    const query = privacyState.query.trim().toLowerCase();
    return (privacyState.threads || []).filter(thread => {
      if (privacyState.filter === 'deleted' && Number(thread.deletedCount || 0) === 0) return false;
      if (privacyState.filter === 'edited' && Number(thread.editedCount || 0) === 0) return false;
      if (privacyState.filter === 'media' && Number(thread.mediaCount || 0) === 0) return false;
      if (!query) return true;
      return [
        thread.title,
        thread.preview,
        thread.chatId,
      ].some(value => String(value || '').toLowerCase().includes(query));
    });
  }

  function render() {
    const settings = privacyState.settings || {};
    const enabled = anyEnabled(settings);
    const complete = fullyEnabled(settings);
    const connectionLive = Boolean(privacyState.connection?.live);
    const readMessages = Boolean(privacyState.connection?.readMessages);
    const operational = complete && connectionLive && readMessages && !privacyState.degraded;
    const pill = $('privacyStatusPill');
    const statusText = $('privacyStatusText');

    pill?.classList.toggle('ready', operational);
    pill?.classList.toggle('warn', (!complete && !privacyState.loading) || privacyState.degraded);
    if (statusText) {
      statusText.textContent = privacyState.loading
        ? 'Синхронизация'
        : privacyState.degraded
          ? 'Ghost восстанавливает связь'
          : !privacyState.connection.loaded
            ? 'Проверяю Telegram'
            : complete && !connectionLive
              ? 'Нужно подключить Telegram'
              : complete && connectionLive && !readMessages
                ? 'Нужен доступ к сообщениям'
                : operational
                ? 'Ghost полностью активен'
                : enabled
                  ? 'Ghost частично активен'
                  : 'Режим выключен';
    }

    if ($('privacyHeroText')) {
      $('privacyHeroText').textContent = complete && connectionLive && readMessages
        ? 'Готово. Новые доступные Business-сообщения, правки и удаления обрабатываются автоматически.'
        : complete && privacyState.connection.loaded && !connectionLive
          ? 'Ghost включён, но Telegram Business ещё не подключён. Подключи его ниже — повторно настраивать Ghost не нужно.'
          : complete && connectionLive && !readMessages
            ? 'Telegram подключён, но Ghost не получил право на сообщения. Разреши доступ к сообщениям в настройках Business-бота.'
            : enabled
            ? 'Часть защиты уже включена. Можно включить весь Ghost одной кнопкой.'
            : 'Включи Ghost одной кнопкой — дальше всё работает автоматически.';
    }

    const enableAll = $('privacyEnableAllButton');
    if (enableAll) {
      enableAll.disabled = privacyState.loading || complete;
      enableAll.classList.toggle('done', complete);
      const label = enableAll.querySelector('b');
      const hint = enableAll.querySelector('small');
      if (label) label.textContent = complete ? 'Ghost включён' : 'Включить Ghost целиком';
      if (hint) hint.textContent = complete
        ? 'Anti-Delete + Edit History + Ghost Inbox активны'
        : 'Anti-Delete + Edit History + Ghost Inbox';
    }

    for (const [id, key] of [
      ['privacyAntiDeleteSwitch', 'antiDelete'],
      ['privacyEditHistorySwitch', 'editHistory'],
      ['privacyGhostInboxSwitch', 'ghostInbox'],
    ]) {
      const el = $(id);
      if (el) {
        el.checked = Boolean(settings[key]);
        el.disabled = privacyState.loading;
      }
    }

    document.querySelectorAll('[data-retention]').forEach(button => {
      button.classList.toggle('active', Number(button.dataset.retention) === Number(settings.retentionDays || 30));
      button.disabled = privacyState.loading;
    });

    const accessStrip = $('privacyAccessStrip');
    const accessIcon = $('privacyAccessIcon');
    const accessTitle = $('privacyAccessTitle');
    const accessText = $('privacyAccessText');
    const accessAction = $('privacyAccessAction');
    if (accessStrip) accessStrip.classList.toggle('ready', connectionLive && readMessages);
    if (accessIcon) accessIcon.textContent = connectionLive && readMessages ? '✓' : '◌';
    if (accessTitle) {
      accessTitle.textContent = !privacyState.connection.loaded
        ? 'Проверяю Telegram'
        : connectionLive && readMessages
          ? 'Telegram Business подключён'
          : connectionLive && !readMessages
            ? 'Разреши доступ к сообщениям'
            : privacyState.connection.error
            ? 'Не удалось проверить Telegram'
            : 'Нужно подключить Telegram Business';
    }
    if (accessText) {
      accessText.textContent = connectionLive && readMessages
        ? 'Business Connection активен. Ghost может получать новые сообщения из разрешённых Telegram-чатов.'
        : connectionLive
          ? 'Подключение есть, но Telegram не дал право can_read_messages. Ghost не сможет надёжно ловить удаления, пока это право не включено.'
          : 'Ghost сохраняет только те новые чаты и сообщения, к которым Telegram дал Business-боту доступ.';
    }
    if (accessAction) {
      accessAction.textContent = connectionLive && readMessages ? 'Проверить' : 'Настроить';
    }

    const totals = threadTotals();
    const statMap = {
      privacyStatThreads: privacyState.threads.length,
      privacyStatDeleted: totals.deleted,
      privacyStatEdited: totals.edited,
      privacyStatMessages: totals.messages,
      privacyStatVault: totals.vault,
    };
    for (const [id, value] of Object.entries(statMap)) {
      if ($(id)) $(id).textContent = String(value);
    }

    if ($('privacyRetentionLabel')) {
      $('privacyRetentionLabel').textContent = `Хранение · ${Number(settings.retentionDays || 30)} дней`;
    }

    const list = $('privacyThreads');
    const empty = $('privacyEmpty');
    const visible = filteredThreads();
    if ($('privacyThreadCount')) $('privacyThreadCount').textContent = String(visible.length);

    document.querySelectorAll('[data-privacy-filter]').forEach(button => {
      button.classList.toggle('active', button.dataset.privacyFilter === privacyState.filter);
      const type = button.dataset.privacyFilter;
      if (type === 'deleted') button.dataset.count = String(totals.deleted);
      if (type === 'edited') button.dataset.count = String(totals.edited);
      if (type === 'media') button.dataset.count = String(totals.media);
    });

    const liveDot = $('privacyLiveDot');
    if (liveDot) {
      liveDot.classList.toggle('active', enabled && connectionLive && readMessages && navigator.onLine !== false && !privacyState.degraded);
      liveDot.classList.toggle('degraded', privacyState.degraded);
    }
    if ($('privacyLiveText')) {
      $('privacyLiveText').textContent = navigator.onLine === false
        ? 'Offline'
        : privacyState.degraded
          ? 'Восстановление'
          : enabled && (!connectionLive || !readMessages)
            ? 'Ждёт Telegram'
            : enabled
              ? 'Авто · 12с'
              : 'Авто';
    }

    if (empty) {
      empty.classList.toggle('show', visible.length === 0);
      if ($('privacyEmptyTitle')) {
        $('privacyEmptyTitle').textContent = !enabled
          ? 'Ghost ещё не включён'
          : privacyState.threads.length && !visible.length
            ? 'Ничего не найдено'
            : 'Ghost Inbox пока пуст';
      }
      if ($('privacyEmptyText')) {
        $('privacyEmptyText').textContent = !enabled
          ? 'Нажми «Включить Ghost целиком» — дальше новые события будут сохраняться автоматически.'
          : privacyState.threads.length && !visible.length
            ? 'Измени поиск или фильтр.'
            : 'Новые доступные Business-сообщения появятся здесь автоматически.';
      }
    }

    if (!list) return;
    list.innerHTML = visible.map(thread => {
      const deleted = Number(thread.deletedCount || 0);
      const edited = Number(thread.editedCount || 0);
      const media = Number(thread.mediaCount || 0);
      const vault = Number(thread.vaultCount || 0);
      const badges = [
        deleted ? `<i class="deleted">↶ ${deleted}</i>` : '',
        edited ? `<i class="edited">≋ ${edited}</i>` : '',
        vault ? `<i class="vault">◇ ${vault}</i>` : (media ? `<i class="media">▣ ${media}</i>` : ''),
      ].filter(Boolean).join('');

      return `
        <button class="privacy-thread" type="button" data-privacy-chat="${escapeHtml(thread.chatId)}">
          <span class="privacy-thread-avatar">${escapeHtml(initials(thread.title))}</span>
          <span class="privacy-thread-copy">
            <strong>${escapeHtml(thread.title || 'Telegram chat')}</strong>
            <span>${escapeHtml(thread.preview || 'Сообщение')}</span>
          </span>
          <span class="privacy-thread-side">
            <span class="privacy-thread-badges">${badges}</span>
            <small>${escapeHtml(formatWhen(thread.lastAt))}</small>
          </span>
        </button>`;
    }).join('');
  }

  async function refresh({ silent = false, background = false } = {}) {
    if (!tg?.initData || privacyState.loading || navigator.onLine === false) return;
    privacyState.loading = !background;
    if (!background) render();

    const before = privacyState.lastTotalMessages || threadTotals().messages;
    try {
      const data = await request();
      privacyState.degraded = Boolean(data.degraded);
      if (data.settings) {
        privacyState.settings = { ...privacyState.settings, ...data.settings };
      }
      if (Array.isArray(data.threads)) {
        privacyState.threads = data.threads;
      }
      privacyState.lastRefreshAt = Date.now();

      const after = threadTotals().messages;
      privacyState.lastTotalMessages = after;
      if (data.degraded) {
        if (!silent && data.storageError) toast(data.storageError);
      } else if (background && before > 0 && after > before && privacyScreenActive()) {
        const added = after - before;
        toast(`Новых сообщений: ${added}`);
        haptic('soft');
      }
    } catch (error) {
      privacyState.degraded = true;
      if (!silent) toast(error.message);
    } finally {
      privacyState.loading = false;
      render();
    }
  }

  async function saveSettings(patch, { quiet = false } = {}) {
    const previous = { ...privacyState.settings };
    privacyState.settings = { ...privacyState.settings, ...patch };
    render();
    haptic();
    try {
      const data = await request('update_settings', { settings: patch });
      privacyState.degraded = false;
      privacyState.settings = { ...privacyState.settings, ...(data.settings || {}) };
      privacyState.threads = Array.isArray(data.threads) ? data.threads : privacyState.threads;
      privacyState.lastTotalMessages = threadTotals().messages;
      render();
      if (!quiet) toast('Ghost настройки сохранены');
      return true;
    } catch (error) {
      privacyState.settings = previous;
      render();
      toast(error.message);
      try { tg?.HapticFeedback?.notificationOccurred('error'); } catch {}
      return false;
    }
  }

  async function enableAll() {
    const ok = await saveSettings({
      antiDelete: true,
      editHistory: true,
      ghostInbox: true,
      retentionDays: Number(privacyState.settings.retentionDays || 30),
    }, { quiet:true });
    if (ok) {
      toast('Ghost полностью включён');
      try { tg?.HapticFeedback?.notificationOccurred('success'); } catch {}
      await Promise.all([
        refresh({ silent:true }),
        loadTelegramConnection({ silent:true }),
      ]);
    }
  }

  function openSheet(html) {
    const content = $('sheetContent');
    const backdrop = $('sheetBackdrop');
    const sheet = $('sheet');
    if (!content || !backdrop || !sheet) return;
    content.innerHTML = html;
    backdrop.hidden = false;
    sheet.hidden = false;
    try { tg?.BackButton?.show(); } catch {}
  }

  function closeSheet() {
    revokeMediaUrl();
    if ($('sheetBackdrop')) $('sheetBackdrop').hidden = true;
    if ($('sheet')) $('sheet').hidden = true;
    try { tg?.BackButton?.hide(); } catch {}
  }

  function revokeMediaUrl() {
    if (privacyState.mediaObjectUrl) {
      URL.revokeObjectURL(privacyState.mediaObjectUrl);
      privacyState.mediaObjectUrl = null;
    }
  }

  function messageBody(message) {
    const text = String(message.text_content || message.caption || '').trim();
    if (text) return escapeHtml(text);
    if (message.media_type) {
      const names = {
        photo: 'Фото',
        video: 'Видео',
        voice: 'Голосовое сообщение',
        audio: 'Аудио',
        document: message.media_file_name || 'Документ',
        animation: 'GIF / анимация',
        sticker: 'Стикер',
        video_note: 'Видеосообщение',
      };
      return escapeHtml(names[message.media_type] || message.media_type);
    }
    return 'Сообщение';
  }

  function renderThreadSheet(thread, messages) {
    privacyState.activeThread = { thread, messages };
    const rows = (messages || []).map(message => {
      const edited = Boolean(message.edited_at);
      const deleted = Boolean(message.deleted_at);
      const hasMedia = Boolean(message.media_type);
      const mediaArchived = message.media_archive_status === 'archived';
      const mediaPending = message.media_archive_status === 'pending';
      const mediaFailed = ['failed','too_large'].includes(String(message.media_archive_status || ''));
      const sender = message.direction === 'outgoing'
        ? 'Вы'
        : (message.sender_display_name || (message.sender_username ? '@' + message.sender_username : thread.title));
      return `
        <article class="privacy-message ${message.direction === 'outgoing' ? 'outgoing' : ''} ${deleted ? 'deleted' : ''}">
          <header><span>${escapeHtml(sender)}</span><span>${escapeHtml(formatWhen(message.sent_at))}</span></header>
          <p>${messageBody(message)}</p>
          ${hasMedia ? `
            <button class="privacy-media-button" type="button"
              data-privacy-media="${escapeHtml(message.message_id)}"
              data-privacy-chat-id="${escapeHtml(message.chat_id)}"
              data-privacy-media-type="${escapeHtml(message.media_type)}"
              data-privacy-media-name="${escapeHtml(message.media_file_name || '')}">
              <span>▣</span><b>Открыть ${escapeHtml(message.media_type === 'photo' ? 'фото' : 'медиа')}</b>
              <small>${escapeHtml([
                mediaArchived ? 'Vault защищён' : mediaPending ? 'Vault сохраняется' : mediaFailed ? 'Только Telegram' : 'Telegram',
                formatBytes(message.media_file_size)
              ].filter(Boolean).join(' · '))}</small>
            </button>` : ''}
          <footer>
            ${deleted ? '<span class="deleted">Удалено в Telegram</span>' : ''}
            ${mediaArchived ? '<span class="vault">Media Vault</span>' : ''}
            ${deleted && hasMedia && !mediaArchived ? '<span class="warn">Медиа может зависеть от Telegram</span>' : ''}
            ${edited ? `<button class="mini-chip" type="button" data-privacy-versions="${escapeHtml(message.message_id)}" data-privacy-chat-id="${escapeHtml(message.chat_id)}">История правок</button>` : ''}
          </footer>
        </article>`;
    }).join('');

    openSheet(`
      <div class="privacy-sheet-head">
        <div><span class="kicker">Ghost Inbox</span><h2>${escapeHtml(thread.title || 'Telegram chat')}</h2></div>
        <button class="mini-chip" type="button" data-privacy-thread-refresh="${escapeHtml(thread.chatId)}">↻</button>
      </div>
      <p>Архивная копия. Story Pilot не вызывает readBusinessMessage при просмотре этого экрана.</p>
      <div class="privacy-message-list">${rows || '<div class="intel-empty">Сообщений пока нет.</div>'}</div>
      <div class="sheet-actions"><button data-privacy-close="1">Закрыть</button></div>
    `);

    requestAnimationFrame(() => {
      const sheet = $('sheet');
      if (sheet) sheet.scrollTop = sheet.scrollHeight;
    });
  }

  async function openThread(chatId, { silent = false } = {}) {
    const thread = privacyState.threads.find(item => String(item.chatId) === String(chatId))
      || { chatId, title: 'Telegram chat' };
    try {
      const data = await request('list_messages', { chatId, limit: 150 });
      renderThreadSheet(thread, data.messages || []);
    } catch (error) {
      if (!silent) toast(error.message);
    }
  }

  async function openVersions(chatId, messageId) {
    try {
      const data = await request('versions', { chatId, messageId });
      const versions = data.versions || [];
      const body = versions.map((item, index) => `
        <div class="privacy-version">
          <strong>${index === versions.length - 1 ? 'Последняя версия' : 'Версия ' + (index + 1)} · ${escapeHtml(formatWhen(item.observed_at))}</strong>
          <span>${escapeHtml(item.text_content || item.caption || (item.media_type ? '[' + item.media_type + ']' : 'Сообщение'))}</span>
        </div>
      `).join('');

      openSheet(`
        <span class="kicker">Edit History</span>
        <h2>История сообщения</h2>
        <p>Здесь только версии, которые Story Pilot реально получил после включения Edit History.</p>
        <div class="privacy-version-list">${body || '<div class="intel-empty">Предыдущих версий нет.</div>'}</div>
        <div class="sheet-actions">
          <button class="accent" data-privacy-back="1">Назад</button>
          <button data-privacy-close="1">Закрыть</button>
        </div>
      `);
    } catch (error) {
      toast(error.message);
    }
  }

  async function loadMedia(chatId, messageId, mediaType, fileName = '') {
    const button = document.querySelector(`[data-privacy-media="${CSS.escape(String(messageId))}"][data-privacy-chat-id="${CSS.escape(String(chatId))}"]`);
    const original = button?.innerHTML;
    if (button) {
      button.disabled = true;
      button.innerHTML = '<span>◌</span><b>Загружаю…</b><small></small>';
    }

    try {
      const query = new URLSearchParams({ chatId:String(chatId), messageId:String(messageId) });
      const response = await fetch(`/api/privacy-media?${query}`, {
        headers: { 'x-telegram-init-data': tg?.initData || '' },
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Не удалось открыть медиа');
      }

      const blob = await response.blob();
      revokeMediaUrl();
      privacyState.mediaObjectUrl = URL.createObjectURL(blob);
      const url = privacyState.mediaObjectUrl;
      const type = String(mediaType || '');
      let body = '';

      if (type === 'photo' || blob.type.startsWith('image/')) {
        body = `<img class="privacy-media-preview-image" src="${url}" alt="Ghost media" />`;
      } else if (['video','animation','video_note'].includes(type) || blob.type.startsWith('video/')) {
        body = `<video class="privacy-media-preview-video" src="${url}" controls playsinline autoplay></video>`;
      } else if (['voice','audio'].includes(type) || blob.type.startsWith('audio/')) {
        body = `<audio class="privacy-media-preview-audio" src="${url}" controls autoplay></audio>`;
      } else {
        body = `
          <div class="privacy-document-preview">
            <span>▣</span>
            <strong>${escapeHtml(fileName || 'Telegram file')}</strong>
            <small>${escapeHtml(blob.type || 'file')} · ${escapeHtml(formatBytes(blob.size))}</small>
            <a href="${url}" download="${escapeHtml(fileName || 'telegram-file')}">Скачать</a>
          </div>`;
      }

      openSheet(`
        <span class="kicker">Ghost Media</span>
        <h2>${escapeHtml(fileName || (type === 'photo' ? 'Фото' : 'Вложение'))}</h2>
        <p>Медиа загружено через авторизованный Story Pilot proxy. Прямая Telegram file-id в браузер не отдаётся.</p>
        <div class="privacy-media-preview-wrap">${body}</div>
        <div class="sheet-actions">
          <button class="accent" data-privacy-back="1">Назад</button>
          <button data-privacy-close="1">Закрыть</button>
        </div>
      `);
    } catch (error) {
      toast(error.message);
      if (button) {
        button.disabled = false;
        button.innerHTML = original;
      }
    }
  }

  async function clearArchive() {
    const run = async () => {
      try {
        await request('clear_archive');
        privacyState.threads = [];
        privacyState.lastTotalMessages = 0;
        render();
        toast('Ghost Inbox очищен');
        try { tg?.HapticFeedback?.notificationOccurred('success'); } catch {}
      } catch (error) {
        toast(error.message);
      }
    };

    if (tg?.showConfirm) {
      tg.showConfirm('Удалить все сохранённые сообщения Ghost Inbox?', ok => ok && run());
    } else if (window.confirm('Удалить все сохранённые сообщения Ghost Inbox?')) {
      run();
    }
  }

  function startAutoRefresh() {
    if (privacyState.autoTimer) return;
    privacyState.autoTimer = setInterval(() => {
      if (privacyScreenActive() && anyEnabled() && !document.hidden) {
        refresh({ silent:true, background:true });
      }
    }, 12000);
  }

  $('privacyEnableAllButton')?.addEventListener('click', enableAll);
  $('privacyAntiDeleteSwitch')?.addEventListener('change', event => saveSettings({ antiDelete:event.target.checked }));
  $('privacyEditHistorySwitch')?.addEventListener('change', event => saveSettings({ editHistory:event.target.checked }));
  $('privacyGhostInboxSwitch')?.addEventListener('change', event => saveSettings({ ghostInbox:event.target.checked }));
  $('privacyRefreshButton')?.addEventListener('click', () => refresh());
  $('privacyClearButton')?.addEventListener('click', clearArchive);

  $('privacyRetentionSegment')?.addEventListener('click', event => {
    const button = event.target.closest('[data-retention]');
    if (!button) return;
    saveSettings({ retentionDays:Number(button.dataset.retention || 30) });
  });

  $('privacySearch')?.addEventListener('input', event => {
    privacyState.query = String(event.target.value || '');
    render();
  });

  $('privacyFilters')?.addEventListener('click', event => {
    const button = event.target.closest('[data-privacy-filter]');
    if (!button) return;
    privacyState.filter = button.dataset.privacyFilter || 'all';
    haptic('soft');
    render();
  });

  document.querySelector('[data-nav="privacy"]')?.addEventListener('click', () => {
    refresh({ silent:true });
    loadTelegramConnection({ silent:true });
  });

  $('privacyAccessAction')?.addEventListener('click', async () => {
    if (privacyState.connection.live && privacyState.connection.readMessages) {
      await loadTelegramConnection({ silent:false });
      toast('Telegram и доступ к сообщениям подключены');
      return;
    }

    if (privacyState.connection.live && !privacyState.connection.readMessages) {
      openSheet(`
        <span class="kicker">Telegram Business</span>
        <h2>Разреши сообщения для Ghost</h2>
        <p>Открой Telegram → Настройки → Telegram Business / Автоматизация чатов → Story Pilot. Включи доступ к сообщениям / чтению сообщений и выбери чаты, которые Story Pilot может обрабатывать.</p>
        <p>Это право нужно, чтобы Telegram присылал Ghost события удалений. Story Pilot всё равно не вызывает readBusinessMessage при просмотре Ghost Inbox.</p>
        <div class="sheet-actions">
          <button class="accent" data-privacy-recheck-access="1">Проверить снова</button>
          <button data-privacy-close="1">Закрыть</button>
        </div>
      `);
      return;
    }

    document.querySelector('[data-nav="publish"]')?.click();
    setTimeout(() => $('checkButton')?.click(), 140);
  });

  $('privacyThreads')?.addEventListener('click', event => {
    const target = event.target.closest('[data-privacy-chat]');
    if (target) openThread(target.dataset.privacyChat);
  });

  $('sheet')?.addEventListener('click', event => {
    const recheckAccess = event.target.closest('[data-privacy-recheck-access]');
    if (recheckAccess) {
      await loadTelegramConnection({ silent:false });
      if (privacyState.connection.live && privacyState.connection.readMessages) {
        closeSheet();
        toast('Готово — доступ к сообщениям включён');
        try { tg?.HapticFeedback?.notificationOccurred('success'); } catch {}
      } else {
        toast('Telegram пока не показывает право на сообщения');
      }
      return;
    }

    const mediaButton = event.target.closest('[data-privacy-media]');
    if (mediaButton) {
      loadMedia(
        mediaButton.dataset.privacyChatId,
        Number(mediaButton.dataset.privacyMedia),
        mediaButton.dataset.privacyMediaType,
        mediaButton.dataset.privacyMediaName,
      );
      return;
    }

    const versionButton = event.target.closest('[data-privacy-versions]');
    if (versionButton) {
      openVersions(versionButton.dataset.privacyChatId, Number(versionButton.dataset.privacyVersions));
      return;
    }

    const threadRefresh = event.target.closest('[data-privacy-thread-refresh]');
    if (threadRefresh) {
      openThread(threadRefresh.dataset.privacyThreadRefresh, { silent:true });
      return;
    }

    if (event.target.closest('[data-privacy-back]') && privacyState.activeThread) {
      revokeMediaUrl();
      renderThreadSheet(privacyState.activeThread.thread, privacyState.activeThread.messages);
      return;
    }

    if (event.target.closest('[data-privacy-close]')) closeSheet();
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && privacyScreenActive()) refresh({ silent:true });
  });

  window.addEventListener('online', () => {
    render();
    if (privacyScreenActive()) {
      refresh({ silent:true });
      loadTelegramConnection({ silent:true });
    }
  });
  window.addEventListener('offline', render);

  startAutoRefresh();
  render();
})();
