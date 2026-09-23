(() => {
  const tg = window.Telegram?.WebApp;
  const $ = id => document.getElementById(id);

  let privacyState = {
    loading: false,
    settings: {
      antiDelete: false,
      editHistory: false,
      ghostInbox: false,
      retentionDays: 30,
    },
    threads: [],
    activeThread: null,
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

  async function request(action = null, payload = {}) {
    if (!tg?.initData) throw new Error('Открой Story Pilot внутри Telegram');

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
      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Ghost Inbox временно недоступен');
      }
      return data;
    } catch (error) {
      if (error?.name === 'AbortError') throw new Error('Ghost Inbox отвечает слишком долго');
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  function render() {
    const settings = privacyState.settings || {};
    const enabled = Boolean(settings.antiDelete || settings.editHistory || settings.ghostInbox);
    const pill = $('privacyStatusPill');
    const statusText = $('privacyStatusText');

    pill?.classList.toggle('ready', enabled);
    pill?.classList.toggle('warn', !enabled && !privacyState.loading);
    if (statusText) {
      statusText.textContent = privacyState.loading
        ? 'Синхронизация'
        : enabled
          ? 'Ghost активен'
          : 'Режим выключен';
    }

    if ($('privacyHeroText')) {
      $('privacyHeroText').textContent = enabled
        ? 'Новые доступные Business-сообщения обрабатываются сервером Story Pilot — iPhone может показывать их здесь.'
        : 'Включи нужные функции — новые события начнут попадать сюда автоматически.';
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

    if ($('privacyRetentionLabel')) {
      $('privacyRetentionLabel').textContent = `Хранение · ${Number(settings.retentionDays || 30)} дней`;
    }

    const threads = privacyState.threads || [];
    if ($('privacyThreadCount')) $('privacyThreadCount').textContent = String(threads.length);
    const empty = $('privacyEmpty');
    const list = $('privacyThreads');
    if (empty) empty.classList.toggle('show', threads.length === 0);
    if (!list) return;

    list.innerHTML = threads.map(thread => {
      const deleted = Number(thread.deletedCount || 0);
      const edited = Number(thread.editedCount || 0);
      const badges = [
        deleted ? `<i class="deleted">↶ ${deleted}</i>` : '',
        edited ? `<i class="edited">≋ ${edited}</i>` : '',
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

  async function refresh({ silent = false } = {}) {
    if (!tg?.initData || privacyState.loading) return;
    privacyState.loading = true;
    render();
    try {
      const data = await request();
      privacyState.settings = { ...privacyState.settings, ...(data.settings || {}) };
      privacyState.threads = Array.isArray(data.threads) ? data.threads : [];
    } catch (error) {
      if (!silent) toast(error.message);
    } finally {
      privacyState.loading = false;
      render();
    }
  }

  async function saveSettings(patch) {
    const previous = { ...privacyState.settings };
    privacyState.settings = { ...privacyState.settings, ...patch };
    render();
    haptic();
    try {
      const data = await request('update_settings', { settings: patch });
      privacyState.settings = { ...privacyState.settings, ...(data.settings || {}) };
      privacyState.threads = Array.isArray(data.threads) ? data.threads : privacyState.threads;
      render();
      toast('Privacy сохранена');
    } catch (error) {
      privacyState.settings = previous;
      render();
      toast(error.message);
      try { tg?.HapticFeedback?.notificationOccurred('error'); } catch {}
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
    if ($('sheetBackdrop')) $('sheetBackdrop').hidden = true;
    if ($('sheet')) $('sheet').hidden = true;
    try { tg?.BackButton?.hide(); } catch {}
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
      const sender = message.direction === 'outgoing'
        ? 'Вы'
        : (message.sender_display_name || (message.sender_username ? '@' + message.sender_username : thread.title));
      return `
        <article class="privacy-message ${message.direction === 'outgoing' ? 'outgoing' : ''} ${deleted ? 'deleted' : ''}">
          <header><span>${escapeHtml(sender)}</span><span>${escapeHtml(formatWhen(message.sent_at))}</span></header>
          <p>${messageBody(message)}</p>
          <footer>
            ${deleted ? '<span class="deleted">Удалено в Telegram</span>' : ''}
            ${edited ? `<button class="mini-chip" type="button" data-privacy-versions="${escapeHtml(message.message_id)}" data-privacy-chat-id="${escapeHtml(message.chat_id)}">История правок</button>` : ''}
          </footer>
        </article>`;
    }).join('');

    openSheet(`
      <span class="kicker">Ghost Inbox</span>
      <h2>${escapeHtml(thread.title || 'Telegram chat')}</h2>
      <p>Архивная копия. Открытие этого экрана не вызывает Telegram Bot API метод readBusinessMessage.</p>
      <div class="privacy-message-list">${rows || '<div class="intel-empty">Сообщений пока нет.</div>'}</div>
      <div class="sheet-actions"><button data-privacy-close="1">Закрыть</button></div>
    `);
  }

  async function openThread(chatId) {
    const thread = privacyState.threads.find(item => String(item.chatId) === String(chatId))
      || { chatId, title: 'Telegram chat' };
    try {
      const data = await request('list_messages', { chatId, limit: 120 });
      renderThreadSheet(thread, data.messages || []);
    } catch (error) {
      toast(error.message);
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
        <p>Сохраняются только версии, которые Story Pilot фактически получил после включения Edit History.</p>
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

  async function clearArchive() {
    const run = async () => {
      try {
        await request('clear_archive');
        privacyState.threads = [];
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

  $('privacyAntiDeleteSwitch')?.addEventListener('change', event => saveSettings({ antiDelete: event.target.checked }));
  $('privacyEditHistorySwitch')?.addEventListener('change', event => saveSettings({ editHistory: event.target.checked }));
  $('privacyGhostInboxSwitch')?.addEventListener('change', event => saveSettings({ ghostInbox: event.target.checked }));
  $('privacyRefreshButton')?.addEventListener('click', () => refresh());
  $('privacyClearButton')?.addEventListener('click', clearArchive);
  document.querySelector('[data-nav="privacy"]')?.addEventListener('click', () => refresh({ silent: true }));

  $('privacyThreads')?.addEventListener('click', event => {
    const target = event.target.closest('[data-privacy-chat]');
    if (target) openThread(target.dataset.privacyChat);
  });

  $('sheet')?.addEventListener('click', event => {
    const versionButton = event.target.closest('[data-privacy-versions]');
    if (versionButton) {
      openVersions(versionButton.dataset.privacyChatId, Number(versionButton.dataset.privacyVersions));
      return;
    }
    if (event.target.closest('[data-privacy-back]') && privacyState.activeThread) {
      renderThreadSheet(privacyState.activeThread.thread, privacyState.activeThread.messages);
      return;
    }
    if (event.target.closest('[data-privacy-close]')) closeSheet();
  });

  document.addEventListener('visibilitychange', () => {
    const active = document.querySelector('.screen.active')?.dataset?.screen;
    if (!document.hidden && active === 'privacy') refresh({ silent: true });
  });

  render();
})();
