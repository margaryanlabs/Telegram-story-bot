(() => {
  const tg = window.Telegram?.WebApp;
  const $ = id => document.getElementById(id);
  const pageParams = new URLSearchParams(window.location.search);
  const ghostDeepLink = {
    chatId: String(pageParams.get('chat') || ''),
    messageId: Number(pageParams.get('message') || 0) || null,
    mode: String(pageParams.get('mode') || ''),
    filter: String(pageParams.get('filter') || ''),
  };
  const allowedInitialFilters = new Set(['smart','action','watch','all','deleted','edited','media']);

  const privacyState = {
    loading: false,
    settings: {
      antiDelete: false,
      editHistory: false,
      ghostInbox: false,
      ghostFocus: true,
      notifyDeletes: true,
      notifyEdits: true,
      retentionDays: 30,
    },
    threads: [],
    smartSummary: null,
    smartBrief: null,
    deletedFeed: [],
    deletedFeedLoaded: false,
    deletedFeedLoading: false,
    deletedFeedHasMore: false,
    backup: { chats:[], selected:null, offsetId:0, totalSaved:0, totalRead:0,
      running:false, stopRequested:false, auto:false, notifyCompletion:true },

    diagnostics: null,
    diagnosticsLoading: false,
    activeThread: null,
    query: '',
    filter: allowedInitialFilters.has(ghostDeepLink.filter) ? ghostDeepLink.filter : 'all',
    deepLinkHandled: false,
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
    if (!tg?.initData) throw new Error('Открой VETO Telegram внутри Telegram');

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

        const error = new Error(data.error || 'VETO Inbox временно недоступен');
        error.status = response.status;
        lastError = error;
        if (!retryable || ![502,503,504].includes(response.status) || attempt === attempts - 1) throw error;
      } catch (error) {
        const normalized = error?.name === 'AbortError'
          ? new Error('VETO Inbox отвечает слишком долго')
          : error;
        lastError = normalized;
        if (!retryable || attempt === attempts - 1) throw normalized;
      } finally {
        clearTimeout(timeout);
      }
    }

    throw lastError || new Error('VETO Inbox временно недоступен');
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
    const filter = privacyState.filter || 'smart';
    const rows = (privacyState.threads || []).filter(thread => {
      if (filter === 'smart' && !['action','watch'].includes(String(thread.smartState || ''))) return false;
      if (filter === 'action' && thread.smartState !== 'action') return false;
      if (filter === 'watch' && thread.smartState !== 'watch') return false;
      if (filter === 'deleted' && Number(thread.deletedCount || 0) === 0) return false;
      if (filter === 'edited' && Number(thread.editedCount || 0) === 0) return false;
      if (filter === 'media' && Number(thread.mediaCount || 0) === 0) return false;
      if (!query) return true;
      return [
        thread.title,
        thread.preview,
        thread.chatId,
        ...(Array.isArray(thread.smartReasons) ? thread.smartReasons : []),
      ].some(value => String(value || '').toLowerCase().includes(query));
    });

    if (['smart','action','watch'].includes(filter)) {
      return rows.sort((left, right) => {
        const scoreDelta = Number(right.smartScore || 0) - Number(left.smartScore || 0);
        if (scoreDelta) return scoreDelta;
        return new Date(right.lastAt || 0).getTime() - new Date(left.lastAt || 0).getTime();
      });
    }
    if (filter === 'deleted') {
      return rows.sort((left, right) =>
        new Date(right.lastDeletedAt || 0).getTime() - new Date(left.lastDeletedAt || 0).getTime()
      );
    }
    if (filter === 'edited') {
      return rows.sort((left, right) =>
        new Date(right.lastEditedAt || 0).getTime() - new Date(left.lastEditedAt || 0).getTime()
      );
    }
    return rows.sort((left, right) =>
      new Date(right.lastAt || 0).getTime() - new Date(left.lastAt || 0).getTime()
    );
  }

  function filteredDeletedFeed() {
    const query = privacyState.query.trim().toLowerCase();
    const rows = Array.isArray(privacyState.deletedFeed) ? privacyState.deletedFeed : [];
    if (!query) return rows;
    return rows.filter(item => [
      item.chatTitle,
      item.senderDisplayName,
      item.senderUsername,
      item.preview,
      item.mediaFileName,
      item.chatId,
    ].some(value => String(value || '').toLowerCase().includes(query)));
  }

  function diagnosticStatusIcon(ok) {
    return ok ? '✓' : '!';
  }

  function renderDiagnosticsSheet(data) {
    const diagnostics = data || privacyState.diagnostics || {};
    const checks = diagnostics.checks || {};
    const rows = Object.values(checks).map(check => `
      <div class="ghost-diagnostic-row ${check?.ok ? 'ready' : 'warn'}">
        <span>${diagnosticStatusIcon(Boolean(check?.ok))}</span>
        <div>
          <strong>${escapeHtml(check?.label || 'Check')}</strong>
          <small>${escapeHtml(check?.detail || '')}</small>
        </div>
      </div>
    `).join('');

    const liveProof = diagnostics.liveDeleteProof?.captured
      ? `
        <div class="ghost-delete-proof ready">
          <span>↶</span>
          <div>
            <strong>Настоящее удаление уже поймано</strong>
            <small>${escapeHtml(diagnostics.liveDeleteProof.chatTitle || 'Telegram chat')} · ${escapeHtml(formatWhen(diagnostics.liveDeleteProof.deletedAt))}</small>
          </div>
        </div>
      `
      : `
        <div class="ghost-delete-proof neutral">
          <span>◌</span>
          <div>
            <strong>Ждём первое настоящее удаление</strong>
            <small>Self-Test не подделывает Telegram delete event. После реального удаления здесь появится proof.</small>
          </div>
        </div>
      `;

    openSheet(`
      <span class="kicker">GHOST DIAGNOSTICS</span>
      <h2>${diagnostics.status === 'ready' ? 'Privacy готова' : 'Нужна проверка'}</h2>
      <p>Проверяю не UI, а реальную цепочку Anti-Delete. Каждый статус ниже приходит с backend/Telegram.</p>
      <div class="ghost-diagnostic-list">${rows}</div>
      ${liveProof}
      <p class="ghost-diagnostic-note">${escapeHtml(diagnostics.note || '')}</p>
      <div class="sheet-actions">
        <button class="accent" data-ghost-diagnostics-refresh="1">Проверить снова</button>
        <button data-ghost-test-alert="1">Отправить тестовый alert</button>
        <button data-privacy-close="1">Закрыть</button>
      </div>
    `);
  }

  async function runGhostDiagnostics({ silent = false } = {}) {
    if (privacyState.diagnosticsLoading) return;
    privacyState.diagnosticsLoading = true;
    const button = $('privacyDiagnosticsButton');
    button?.classList.add('loading');
    try {
      const data = await request('diagnostics');
      privacyState.diagnostics = data.diagnostics || null;
      renderDiagnosticsSheet(privacyState.diagnostics);
      if (!silent) {
        toast(privacyState.diagnostics?.status === 'ready' ? 'Privacy pipeline готов' : 'Есть пункты, которые требуют внимания');
      }
    } catch (error) {
      if (!silent) toast(error.message);
    } finally {
      privacyState.diagnosticsLoading = false;
      button?.classList.remove('loading');
    }
  }

  async function refreshDeletedFeed({ silent = false, force = false } = {}) {
    if (!tg?.initData || privacyState.deletedFeedLoading) return;
    if (privacyState.deletedFeedLoaded && !force) return;

    privacyState.deletedFeedLoading = true;
    try {
      const data = await request('list_deleted', { limit: 160, offset: 0 });
      privacyState.deletedFeed = Array.isArray(data.items) ? data.items : [];
      privacyState.deletedFeedHasMore = data.hasMore === true;
      privacyState.deletedFeedLoaded = true;
    } catch (error) {
      if (!silent) toast(error.message);
    } finally {
      privacyState.deletedFeedLoading = false;
      render();
    }
  }

  async function loadMoreDeletedFeed() {
    if (!tg?.initData || privacyState.deletedFeedLoading || !privacyState.deletedFeedHasMore) return;
    privacyState.deletedFeedLoading = true;
    render();
    try {
      const data = await request('list_deleted', { limit: 160, offset: privacyState.deletedFeed.length });
      const existing = new Set(privacyState.deletedFeed.map(x => String(x.chatId) + ':' + String(x.messageId)));
      for (const item of data.items || []) {
        const id = String(item.chatId) + ':' + String(item.messageId);
        if (!existing.has(id)) { existing.add(id); privacyState.deletedFeed.push(item); }
      }
      privacyState.deletedFeedHasMore = data.hasMore === true;
    } catch (error) { toast(error.message); }
    finally { privacyState.deletedFeedLoading = false; render(); }
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
          ? 'VETO Privacy восстанавливает связь'
          : !privacyState.connection.loaded
            ? 'Проверяю Telegram'
            : complete && !connectionLive
              ? 'Нужно подключить Telegram'
              : complete && connectionLive && !readMessages
                ? 'Нужен доступ к сообщениям'
                : operational
                ? 'VETO Privacy полностью активна'
                : enabled
                  ? 'VETO Privacy частично активна'
                  : 'Режим выключен';
    }

    if ($('privacyHeroText')) {
      $('privacyHeroText').textContent = complete && connectionLive && readMessages
        ? 'Разрешённые сообщения сохраняются в независимый архив на выбранный срок, даже если оригинальную переписку позже очистят в Telegram.'
        : complete && privacyState.connection.loaded && !connectionLive
          ? 'VETO Privacy включена, но Telegram Business ещё не подключён. Подключи его ниже — повторно настраивать VETO Privacy не нужно.'
          : complete && connectionLive && !readMessages
            ? 'Telegram подключён, но VETO Privacy не получила право на сообщения. Разреши доступ к сообщениям в настройках Business-бота.'
            : enabled
            ? 'Часть защиты уже включена. Можно включить всю VETO Privacy одной кнопкой.'
            : 'Включи VETO Privacy одной кнопкой — дальше всё работает автоматически.';
    }

    const enableAll = $('privacyEnableAllButton');
    if (enableAll) {
      enableAll.disabled = privacyState.loading || complete;
      enableAll.classList.toggle('done', complete);
      const label = enableAll.querySelector('b');
      const hint = enableAll.querySelector('small');
      if (label) label.textContent = complete ? 'Защита переписок включена' : 'Защитить переписки';
      if (hint) hint.textContent = complete
        ? 'Anti-Delete · история правок · архив'
        : 'Новые разрешённые сообщения сохранятся до удаления в Telegram';
    }

    for (const [id, key] of [
      ['privacyAntiDeleteSwitch', 'antiDelete'],
      ['privacyEditHistorySwitch', 'editHistory'],
      ['privacyGhostInboxSwitch', 'ghostInbox'],
      ['privacyGhostFocusSwitch', 'ghostFocus'],
      ['privacyNotifyDeletesSwitch', 'notifyDeletes'],
      ['privacyNotifyEditsSwitch', 'notifyEdits'],
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
        ? 'Telegram подключён. VETO Privacy может получать новые сообщения из разрешённых чатов.'
        : connectionLive
          ? 'Telegram подключён, но доступ к сообщениям не разрешён. Включи его, чтобы VETO Privacy надёжно сохраняла изменения и удаления.'
          : 'VETO Privacy сохраняет только те новые чаты и сообщения, к которым Telegram дал Business-боту доступ.';
    }
    if (accessAction) {
      accessAction.textContent = connectionLive && readMessages ? 'Проверить' : 'Настроить';
    }

    const diagnosticsButton = $('privacyDiagnosticsButton');
    if (diagnosticsButton && privacyState.diagnostics) {
      diagnosticsButton.classList.toggle('ready', privacyState.diagnostics.status === 'ready');
      diagnosticsButton.classList.toggle('warn', privacyState.diagnostics.status !== 'ready');
      const action = diagnosticsButton.querySelector('.ghost-diagnostics-action');
      if (action) action.textContent = privacyState.diagnostics.status === 'ready' ? 'Готово ›' : 'Проверить ›';
    }

    const totals = threadTotals();
    const summary = privacyState.smartSummary || {
      action: privacyState.threads.filter(thread => thread.smartState === 'action').length,
      watch: privacyState.threads.filter(thread => thread.smartState === 'watch').length,
      archive: privacyState.threads.filter(thread => thread.smartState === 'archive').length,
      likelyNeedsReply: privacyState.threads.filter(thread => thread.actionLikely).length,
    };
    if ($('smartInboxAction')) $('smartInboxAction').textContent = String(summary.action || 0);
    if ($('smartInboxWatch')) $('smartInboxWatch').textContent = String(summary.watch || 0);
    if ($('smartInboxAll')) $('smartInboxAll').textContent = String(privacyState.threads.length);

    const brief = privacyState.smartBrief || {
      status: summary.action > 0 ? 'action' : summary.watch > 0 ? 'watch' : 'clear',
      title: summary.action > 0
        ? `${summary.action} диалог(а) требуют внимания`
        : summary.watch > 0
          ? `${summary.watch} диалог(а) стоит проверить`
          : 'Срочных сигналов нет',
      detail: 'VETO Telegram использует только доступные Telegram-события и объяснимые правила.',
      primaryChatId: '',
      primaryAction: 'archive',
      reasons: [],
    };
    const briefCard = $('smartBriefCard');
    if (briefCard) {
      briefCard.classList.remove('action','watch','clear');
      briefCard.classList.add(['action','watch','clear'].includes(String(brief.status)) ? String(brief.status) : 'clear');
    }
    if ($('smartBriefTitle')) $('smartBriefTitle').textContent = brief.title || 'VETO Brief';
    if ($('smartBriefDetail')) $('smartBriefDetail').textContent = brief.detail || '';
    if ($('smartBriefStatus')) {
      $('smartBriefStatus').textContent = brief.status === 'action'
        ? 'ACTION'
        : brief.status === 'watch'
          ? 'WATCH'
          : 'CLEAR';
    }
    if ($('smartBriefReasons')) {
      const reasons = Array.isArray(brief.reasons) ? brief.reasons : [];
      $('smartBriefReasons').innerHTML = reasons.map(reason => `<span>${escapeHtml(reason)}</span>`).join('');
    }
    const smartBriefPrimary = $('smartBriefPrimary');
    if (smartBriefPrimary) {
      const chatId = String(brief.primaryChatId || '');
      smartBriefPrimary.hidden = !chatId;
      smartBriefPrimary.dataset.chatId = chatId;
      smartBriefPrimary.textContent = brief.primaryAction === 'reply'
        ? 'Открыть и ответить'
        : brief.primaryAction === 'review_changes'
          ? 'Проверить изменения'
          : 'Открыть диалог';
    }

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
      $('privacyRetentionLabel').textContent = Number(settings.retentionDays || 30) === 3650
        ? 'Хранение · до 10 лет'
        : Number(settings.retentionDays || 30) === 365
          ? 'Хранение · 1 год'
          : `Хранение · ${Number(settings.retentionDays || 30)} дней`;
    }

    const latestDeletedThread = [...privacyState.threads]
      .filter(thread => thread.lastDeletedAt && thread.latestDeletedMessageId)
      .sort((left, right) =>
        new Date(right.lastDeletedAt || 0).getTime() - new Date(left.lastDeletedAt || 0).getTime()
      )[0] || null;
    const latestCard = $('ghostLatestDeletedCard');
    if (latestCard) {
      latestCard.hidden = !latestDeletedThread;
      if (latestDeletedThread) {
        latestCard.dataset.chatId = String(latestDeletedThread.chatId || '');
        latestCard.dataset.messageId = String(latestDeletedThread.latestDeletedMessageId || '');
        if ($('ghostLatestDeletedTitle')) {
          $('ghostLatestDeletedTitle').textContent = latestDeletedThread.title || 'Telegram chat';
        }
        if ($('ghostLatestDeletedPreview')) {
          $('ghostLatestDeletedPreview').textContent = latestDeletedThread.deletedPreview || 'Удалённое сообщение';
        }
        if ($('ghostLatestDeletedTime')) {
          $('ghostLatestDeletedTime').textContent = formatWhen(latestDeletedThread.lastDeletedAt);
        }
      }
    }

    const moreDeleted = $('privacyDeletedMore');
    if (moreDeleted) {
      moreDeleted.hidden = privacyState.filter !== 'deleted' || !privacyState.deletedFeedHasMore;
      moreDeleted.disabled = privacyState.deletedFeedLoading;
      moreDeleted.textContent = privacyState.deletedFeedLoading
        ? 'Загружаю…'
        : 'Показать ещё сохранённые удаления ↓';
    }
    const list = $('privacyThreads');
    const empty = $('privacyEmpty');
    const visible = privacyState.filter === 'deleted' ? filteredDeletedFeed() : filteredThreads();
    if ($('privacyThreadCount')) $('privacyThreadCount').textContent = String(visible.length);

    document.querySelectorAll('[data-privacy-filter]').forEach(button => {
      button.classList.toggle('active', button.dataset.privacyFilter === privacyState.filter);
      const type = button.dataset.privacyFilter;
      if (type === 'smart') button.dataset.count = String((summary.action || 0) + (summary.watch || 0));
      if (type === 'action') button.dataset.count = String(summary.action || 0);
      if (type === 'watch') button.dataset.count = String(summary.watch || 0);
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
          ? 'VETO Privacy ещё не включена'
          : (privacyState.filter === 'deleted' ? privacyState.deletedFeed.length : privacyState.threads.length) && !visible.length
            ? 'Ничего не найдено'
            : privacyState.filter === 'deleted'
              ? 'Удалённых сообщений пока нет'
              : 'VETO Inbox пока пуст';
      }
      if ($('privacyEmptyText')) {
        $('privacyEmptyText').textContent = !enabled
          ? 'Нажми «Включить VETO Privacy» — дальше новые события будут сохраняться автоматически.'
          : (privacyState.filter === 'deleted' ? privacyState.deletedFeed.length : privacyState.threads.length) && !visible.length
            ? 'Измени поиск или фильтр.'
            : privacyState.filter === 'deleted'
              ? 'Когда Telegram пришлёт событие удаления, сохранённая копия появится здесь.'
              : 'Новые доступные Business-сообщения появятся здесь автоматически.';
      }
    }

    if (!list) return;

    if (privacyState.filter === 'deleted') {
      if (privacyState.deletedFeedLoading && !privacyState.deletedFeedLoaded) {
        list.innerHTML = '<div class="deleted-feed-loading">◌ Загружаю удаления</div>';
        return;
      }

      list.innerHTML = visible.map(item => {
        const sender = item.direction === 'outgoing'
          ? 'Вы'
          : (item.senderDisplayName || (item.senderUsername ? '@' + item.senderUsername : 'Telegram user'));
        const mediaState = item.mediaType
          ? item.mediaArchiveStatus === 'archived'
            ? '<i class="vault">◇ Vault</i>'
            : '<i class="media">▣ Media</i>'
          : '';
        return `
          <button class="deleted-feed-item" type="button"
            data-deleted-chat="${escapeHtml(item.chatId)}"
            data-deleted-message="${escapeHtml(item.messageId)}">
            <span class="deleted-feed-icon">↶</span>
            <span class="deleted-feed-copy">
              <strong>${escapeHtml(item.chatTitle || sender)}</strong>
              <em>${escapeHtml(sender)}</em>
              <span>${escapeHtml(item.preview || 'Сообщение')}</span>
              <small>Удалено · ${escapeHtml(formatWhen(item.deletedAt))}</small>
            </span>
            <span class="deleted-feed-meta">
              ${mediaState}
              ${item.editedAt ? '<i class="edited">≋ Edit</i>' : ''}
              <b>›</b>
            </span>
          </button>`;
      }).join('');
      return;
    }

    list.innerHTML = visible.map(thread => {
      const deleted = Number(thread.deletedCount || 0);
      const edited = Number(thread.editedCount || 0);
      const media = Number(thread.mediaCount || 0);
      const vault = Number(thread.vaultCount || 0);
      const state = String(thread.smartState || 'archive');
      const smartBadge = state === 'action'
        ? '<i class="smart-action">Action</i>'
        : state === 'watch'
          ? '<i class="smart-watch">Watch</i>'
          : '';
      const badges = [
        smartBadge,
        deleted ? `<i class="deleted">↶ ${deleted}</i>` : '',
        edited ? `<i class="edited">≋ ${edited}</i>` : '',
        vault ? `<i class="vault">◇ ${vault}</i>` : (media ? `<i class="media">▣ ${media}</i>` : ''),
      ].filter(Boolean).join('');
      const reason = Array.isArray(thread.smartReasons) && thread.smartReasons.length
        ? thread.smartReasons[0]
        : '';

      const displayPreview = privacyState.filter === 'deleted' && thread.deletedPreview
        ? thread.deletedPreview
        : privacyState.filter === 'edited' && thread.editedPreview
          ? thread.editedPreview
          : thread.preview;
      const displayAt = privacyState.filter === 'deleted' && thread.lastDeletedAt
        ? thread.lastDeletedAt
        : privacyState.filter === 'edited' && thread.lastEditedAt
          ? thread.lastEditedAt
          : thread.lastAt;
      const eventReason = privacyState.filter === 'deleted' && thread.lastDeletedAt
        ? 'Последнее удаление · ' + formatWhen(thread.lastDeletedAt)
        : privacyState.filter === 'edited' && thread.lastEditedAt
          ? 'Последнее изменение · ' + formatWhen(thread.lastEditedAt)
          : reason;

      return `
        <button class="privacy-thread" type="button" data-privacy-chat="${escapeHtml(thread.chatId)}">
          <span class="privacy-thread-avatar">${escapeHtml(initials(thread.title))}</span>
          <span class="privacy-thread-copy">
            <strong>${escapeHtml(thread.title || 'Telegram chat')}</strong>
            <span>${escapeHtml(displayPreview || 'Сообщение')}</span>
            ${eventReason ? `<small class="smart-thread-reason">${escapeHtml(eventReason)}</small>` : ''}
          </span>
          <span class="privacy-thread-side">
            <span class="privacy-thread-badges">${badges}</span>
            <small>${escapeHtml(formatWhen(displayAt))}</small>
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
      if (data.smartSummary) privacyState.smartSummary = data.smartSummary;
      privacyState.smartBrief = data.smartBrief || null;
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
      if (privacyState.filter === 'deleted') {
        setTimeout(() => refreshDeletedFeed({ silent:true, force:true }), 0);
      }
      if (!privacyState.deepLinkHandled && ghostDeepLink.chatId) {
        setTimeout(() => maybeOpenGhostDeepLink(), 60);
      }
    }
  }

  async function saveSettings(patch, { quiet = false, confirmRetentionPurge = false } = {}) {
    const previous = { ...privacyState.settings };
    privacyState.settings = { ...privacyState.settings, ...patch };
    render();
    haptic();
    try {
      const data = await request('update_settings', { settings: patch, confirmRetentionPurge });
      privacyState.degraded = false;
      privacyState.settings = { ...privacyState.settings, ...(data.settings || {}) };
      privacyState.threads = Array.isArray(data.threads) ? data.threads : privacyState.threads;
      if (data.smartSummary) privacyState.smartSummary = data.smartSummary;
      privacyState.smartBrief = data.smartBrief || privacyState.smartBrief;
      privacyState.lastTotalMessages = threadTotals().messages;
      render();
      if (!quiet) toast('VETO Privacy настройки сохранены');
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
      ghostFocus: true,
      retentionDays: Number(privacyState.settings.retentionDays || 30),
    }, { quiet:true });
    if (ok) {
      try { tg?.HapticFeedback?.notificationOccurred('success'); } catch {}
      await Promise.all([
        refresh({ silent:true }),
        loadTelegramConnection({ silent:true }),
      ]);
      if (!privacyState.connection.live || !privacyState.connection.readMessages) {
        toast('Защита включена. Осталось разрешить VETO получать сообщения в Telegram Business.');
        privacyBusinessGuideSheet();
      } else {
        toast('Защита включена: новые разрешённые сообщения будут сохраняться в архив.');
      }
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

  function plainMessageBody(message) {
    const text = String(message?.text_content || message?.caption || '').trim();
    if (text) return text;
    if (message?.media_type) return '[' + String(message.media_type) + ']';
    return 'Сообщение';
  }

  async function copyGhostMessage(messageId) {
    const rows = privacyState.activeThread?.messages || [];
    const message = rows.find(item => String(item.message_id) === String(messageId));
    if (!message) {
      toast('Сообщение не найдено');
      return;
    }
    const value = plainMessageBody(message);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const area = document.createElement('textarea');
        area.value = value;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        document.execCommand('copy');
        area.remove();
      }
      haptic('soft');
      toast('Скопировано');
    } catch {
      toast('Не удалось скопировать');
    }
  }

  function openTelegramPeer(username) {
    const clean = String(username || '').replace(/^@/, '').trim();
    if (!clean) return;
    const url = 'https://t.me/' + encodeURIComponent(clean);
    try {
      if (tg?.openTelegramLink) tg.openTelegramLink(url);
      else window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      window.location.href = url;
    }
  }

  function normalizeThreadMode(value) {
    const mode = String(value || 'all');
    return ['all','deleted','edited','focus'].includes(mode) ? mode : 'all';
  }

  function threadModeLabel(mode) {
    if (mode === 'deleted') return 'Удалённые';
    if (mode === 'edited') return 'Изменённые';
    if (mode === 'focus') return 'VETO Focus';
    return 'Все сообщения';
  }

  function messagesForMode(messages, mode, focusMessageId = null) {
    const rows = Array.isArray(messages) ? messages : [];
    if (mode === 'deleted') return rows.filter(message => Boolean(message.deleted_at));
    if (mode === 'edited') return rows.filter(message => Boolean(message.edited_at));
    if (mode === 'focus' && focusMessageId) {
      const index = rows.findIndex(message => String(message.message_id) === String(focusMessageId));
      if (index >= 0) {
        const from = Math.max(0, index - 2);
        const to = Math.min(rows.length, index + 3);
        return rows.slice(from, to);
      }
    }
    return rows;
  }

  function renderThreadSheet(thread, messages, options = {}) {
    const mode = normalizeThreadMode(options.mode || privacyState.activeThread?.mode || 'all');
    const focusMessageId = Number(options.focusMessageId || privacyState.activeThread?.focusMessageId || 0) || null;
    const prior = privacyState.activeThread?.thread?.chatId === thread.chatId
      ? privacyState.activeThread : null;
    const hasMore = options.hasMore ?? prior?.hasMore ?? false;
    const offset = options.offset ?? prior?.offset ?? messages.length;
    privacyState.activeThread = { thread, messages, mode, focusMessageId, hasMore, offset };

    const visibleMessages = messagesForMode(messages, mode, focusMessageId);
    const rows = visibleMessages.map(message => {
      const edited = Boolean(message.edited_at);
      const deleted = Boolean(message.deleted_at);
      const focused = focusMessageId && String(message.message_id) === String(focusMessageId);
      const hasMedia = Boolean(message.media_type);
      const mediaArchived = message.media_archive_status === 'archived';
      const mediaPending = message.media_archive_status === 'pending';
      const mediaFailed = ['failed','too_large'].includes(String(message.media_archive_status || ''));
      const sender = message.direction === 'outgoing'
        ? 'Вы'
        : (message.sender_display_name || (message.sender_username ? '@' + message.sender_username : thread.title));
      return `
        <article class="privacy-message ${message.direction === 'outgoing' ? 'outgoing' : ''} ${deleted ? 'deleted' : ''} ${focused ? 'ghost-focused-message' : ''}"
          data-ghost-message-id="${escapeHtml(message.message_id)}">
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
            ${focused ? '<span class="focus">VETO Focus</span>' : ''}
            ${deleted ? '<span class="deleted">Удалено в Telegram</span>' : ''}
            ${mediaArchived ? '<span class="vault">Media Vault</span>' : ''}
            ${deleted && hasMedia && !mediaArchived ? '<span class="warn">Медиа может зависеть от Telegram</span>' : ''}
            ${deleted || edited ? `<button class="mini-chip" type="button" data-ghost-copy="${escapeHtml(message.message_id)}">Копировать</button>` : ''}
            ${edited ? `<button class="mini-chip" type="button" data-privacy-versions="${escapeHtml(message.message_id)}" data-privacy-chat-id="${escapeHtml(message.chat_id)}">История правок</button>` : ''}
          </footer>
        </article>`;
    }).join('');

    const deletedCount = (messages || []).filter(message => Boolean(message.deleted_at)).length;
    const editedCount = (messages || []).filter(message => Boolean(message.edited_at)).length;
    const focusNote = mode === 'focus'
      ? '<p class="ghost-focus-note">Показываю выбранное событие и до двух сообщений контекста до/после. Это архив Ghost, а не изменение оригинального Telegram-чата.</p>'
      : '';
    const peerUsername = (messages || []).find(message =>
      message.direction !== 'outgoing' && message.sender_username
    )?.sender_username || '';

    openSheet(`
      <div class="privacy-sheet-head">
        <div><span class="kicker">${mode === 'focus' ? 'VETO FOCUS' : 'VETO Inbox'}</span><h2>${escapeHtml(thread.title || 'Telegram chat')}</h2></div>
        <div class="privacy-sheet-head-actions">
          <button class="mini-chip" type="button" data-privacy-close="1">← Список</button>
          <button class="mini-chip" type="button" data-privacy-thread-refresh="${escapeHtml(thread.chatId)}">↻</button>
        </div>
      </div>
      <p>Архивная копия. VETO Telegram не вызывает readBusinessMessage при просмотре этого экрана.</p>
      ${focusNote}
      <div class="ghost-thread-modes">
        <button type="button" class="${mode === 'all' ? 'active' : ''}" data-privacy-thread-mode="all">Все <b>${(messages || []).length}</b></button>
        <button type="button" class="${mode === 'deleted' ? 'active' : ''}" data-privacy-thread-mode="deleted">Удалённые <b>${deletedCount}</b></button>
        <button type="button" class="${mode === 'edited' ? 'active' : ''}" data-privacy-thread-mode="edited">Изменённые <b>${editedCount}</b></button>
      </div>
      <div class="privacy-message-list">${rows || '<div class="intel-empty">В этом режиме сообщений пока нет.</div>'}</div>
      ${hasMore ? '<button class="privacy-more-button" data-privacy-thread-more="1">Загрузить более ранние сообщения ↓</button>' : ''}
      <div class="sheet-actions">
        ${mode === 'focus' ? '<button class="accent" data-privacy-thread-mode="all">Показать весь чат</button>' : ''}
        ${peerUsername ? `<button data-ghost-open-peer="${escapeHtml(peerUsername)}">Открыть чат в Telegram</button>` : ''}
        <button data-privacy-close="1">Закрыть</button>
      </div>
    `);

    if (options.preserveScroll) return;
    requestAnimationFrame(() => {
      const sheet = $('sheet');
      const focused = focusMessageId
        ? sheet?.querySelector(`[data-ghost-message-id="${CSS.escape(String(focusMessageId))}"]`)
        : null;
      if (focused) focused.scrollIntoView({ behavior:'smooth', block:'center' });
      else if (sheet) sheet.scrollTop = sheet.scrollHeight;
    });
  }

  async function openThread(chatId, { silent = false, mode = 'all', focusMessageId = null } = {}) {
    const thread = privacyState.threads.find(item => String(item.chatId) === String(chatId))
      || { chatId, title: 'Telegram chat' };
    try {
      const data = await request('list_messages', { chatId, limit: 150, offset: 0 });
      const items = data.messages || [];
      renderThreadSheet(thread, items, { mode, focusMessageId, hasMore:data.hasMore === true, offset:items.length });
    } catch (error) {
      if (!silent) toast(error.message);
    }
  }

  async function loadOlderThread() {
    const active = privacyState.activeThread;
    if (!active || !active.hasMore || privacyState.loadingOlderThread) return;
    privacyState.loadingOlderThread = true;
    const button = $('sheet')?.querySelector('[data-privacy-thread-more]');
    if (button) { button.disabled = true; button.textContent = 'Загружаю…'; }
    try {
      const data = await request('list_messages', {
        chatId:active.thread.chatId, limit:150, offset:active.offset || 0,
      });
      const older = Array.isArray(data.messages) ? data.messages : [];
      const ids = new Set(active.messages.map(x => String(x.message_id)));
      const additions = older.filter(x => !ids.has(String(x.message_id)));
      const merged = [...additions, ...active.messages];
      renderThreadSheet(active.thread, merged, {
        mode:active.mode, focusMessageId:active.focusMessageId,
        hasMore:data.hasMore === true, offset:(active.offset || 0) + older.length,
        preserveScroll:true,
      });
      // Newly fetched messages remain at the beginning of the archive page.
      const sheet = $('sheet');
      if (sheet) sheet.scrollTop = 0;
    } catch (error) {
      toast(error.message);
      if (button) { button.disabled = false; button.textContent = 'Повторить загрузку'; }
    } finally { privacyState.loadingOlderThread = false; }
  }

  async function maybeOpenGhostDeepLink() {
    if (privacyState.deepLinkHandled || !ghostDeepLink.chatId) return;
    privacyState.deepLinkHandled = true;
    const mode = ghostDeepLink.mode === 'edit'
      ? 'focus'
      : ghostDeepLink.mode === 'focus'
        ? 'focus'
        : 'all';
    await openThread(ghostDeepLink.chatId, {
      silent: false,
      mode,
      focusMessageId: ghostDeepLink.messageId,
    });
    if (ghostDeepLink.mode === 'edit' && ghostDeepLink.messageId) {
      setTimeout(() => openVersions(ghostDeepLink.chatId, ghostDeepLink.messageId), 220);
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
        <p>Здесь только версии, которые VETO Telegram реально получил после включения Edit History.</p>
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
        body = `<img class="privacy-media-preview-image" src="${url}" alt="VETO media" />`;
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
        <span class="kicker">VETO Media</span>
        <h2>${escapeHtml(fileName || (type === 'photo' ? 'Фото' : 'Вложение'))}</h2>
        <p>Медиа загружено через авторизованный VETO Telegram proxy. Прямая Telegram file-id в браузер не отдаётся.</p>
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

  function privacyBusinessGuideSheet() {
    const linked = Boolean(privacyState.connection.live);
    openSheet(`
      <span class="kicker">VETO PRIVATE ARCHIVE · ДЛЯ ТВОИХ ЧАТОВ</span>
      <h2>${linked ? 'Дай разрешение сохранять сообщения' : 'Подключи Telegram Business к архиву'}</h2>
      <p>Обычное подключение Telegram для Stories не включает архив переписок. Для сохранения сообщений необходимо отдельно разрешить VETO Business-доступ в выбранных чатах.</p>
      <div class="sheet-list">
        <div class="sheet-item"><strong>1. Настройки Telegram</strong><span>Telegram → Настройки → Telegram Business → Чат-боты / Автоматизация чатов.</span></div>
        <div class="sheet-item"><strong>2. Выбери VETO</strong><span>Подключи @Storypilotlab_bot и явно выбери чаты, из которых разрешено сохранять сообщения.</span></div>
        <div class="sheet-item"><strong>3. Разреши читать сообщения</strong><span>Включи право на сообщения, затем вернись сюда и нажми «Проверить». Настрой хранение до 10 лет, если нужен долгий архив.</span></div>
      </div>
      <p class="privacy-archive-limit">Важно: сохраняются только сообщения, которые Telegram передал после включения доступа. Очистка чата в Telegram не удаляет уже сохранённую VETO-копию. Ранее удалённые, секретные и неразрешённые чаты восстановить невозможно.</p>
      <div class="sheet-actions">
        <button class="accent" data-privacy-recheck-access="1">Проверить доступ снова</button>
        <button data-privacy-keep-long="1">Хранить копии до 10 лет</button>
        <button data-privacy-close="1">Закрыть</button>
      </div>
    `);
  }

  async function backupApi(action, payload = {}) {
    if (!tg?.initData) throw new Error('Открой VETO внутри Telegram');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    try {
      const response = await fetch('/api/privacy-backup', {
        method:'POST', headers:{
          'x-telegram-init-data':tg.initData,
          'content-type':'application/json',
        },
        body:JSON.stringify({ action,...payload }),
        signal:controller.signal,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || 'Не удалось сохранить переписку');
      return data;
    } catch (error) {
      if (error?.name === 'AbortError') throw new Error('Telegram отвечает слишком долго. Повтори попытку.');
      throw error;
    } finally { clearTimeout(timeout); }
  }

  // Save cursor/aggregate counts only. Telegram message content, auth sessions,
  // contact names and message bodies must never enter localStorage.
  const BACKUP_RESUME_PREFIX = 'veto:history-cursor:v1:';
  function backupResumeKey(chatId) {
    return BACKUP_RESUME_PREFIX + String(tg?.initDataUnsafe?.user?.id || 'unknown')
      + ':' + String(chatId || '');
  }
  function savedBackupCursor(chatId) {
    try {
      const raw = window.localStorage.getItem(backupResumeKey(chatId));
      const item = raw ? JSON.parse(raw) : null;
      if (!item || item.chatId !== String(chatId)
        || !Number.isSafeInteger(item.offsetId) || item.offsetId <= 0
        || !Number.isSafeInteger(item.updatedAt)
        || Date.now() - item.updatedAt > 30 * 86400000) return null;
      return {
        offsetId:item.offsetId, totalSaved:Math.max(0,Math.floor(Number(item.totalSaved || 0))),
        totalRead:Math.max(0,Math.floor(Number(item.totalRead || 0))),
      };
    } catch { return null; }
  }
  function rememberBackupCursor() {
    const b = privacyState.backup;
    if (!b.selected || !Number.isSafeInteger(b.offsetId) || b.offsetId <= 0) return;
    try {
      window.localStorage.setItem(backupResumeKey(b.selected.chatId),
        JSON.stringify({
          chatId:String(b.selected.chatId), offsetId:b.offsetId,
          totalSaved:b.totalSaved, totalRead:b.totalRead, updatedAt:Date.now(),
        }));
    } catch {} // Storage can be disabled in Telegram WebViews.
  }
  function clearBackupCursor(chatId) {
    try { window.localStorage.removeItem(backupResumeKey(chatId)); } catch {}
  }

  function renderBackupList() {
    const backup = privacyState.backup;
    openSheet(`
      <span class="kicker">HISTORY BACKUP · ТОЛЬКО С ТВОЕГО СОГЛАСИЯ</span>
      <h2>Выбери личный чат</h2>
      <p>VETO использует только твой подключённый Telegram-аккаунт. Содержимое выбранного чата сохраняется в VETO — отдельно от оригинала. Другие чаты без выбора не копируются.</p>
      <div class="ghost-backup-summary">Хранение: <b>${Number(privacyState.settings.retentionDays || 30)} дней</b>.
        Для старых сообщений рекомендуем установить 10 лет перед копированием.</div>
      <div class="sheet-actions"><button data-backup-retention-long="1">Продлить хранение до 10 лет</button></div>
      <div class="ghost-backup-list">
        ${backup.chats.length ? backup.chats.map(chat => `
          <button class="ghost-backup-person" data-backup-chat="${escapeHtml(chat.chatId)}" type="button">
            <span class="privacy-thread-avatar">${escapeHtml(initials(chat.title))}</span>
            <span><strong>${escapeHtml(chat.title)}</strong><small>${escapeHtml(chat.username ? '@'+chat.username : 'Личная переписка')}${savedBackupCursor(chat.chatId) ? ' · Есть незавершённая копия' : ''}</small></span><em>${savedBackupCursor(chat.chatId) ? 'Продолжить →' : 'Выбрать →'}</em>
          </button>`).join('') : '<p>В подключённом аккаунте не найдены доступные обычные личные переписки.</p>'}
      </div>
      <p class="privacy-archive-limit">Secret Chats, группы, каналы и сообщения, уже удалённые в Telegram, сюда не входят. Старые медиа сохраняются лишь как название типа вложения, без самих файлов.</p>
      <div class="sheet-actions"><button data-privacy-close="1">Закрыть</button></div>
    `);
  }

  async function openBackupPicker() {
    openSheet('<span class="kicker">HISTORY BACKUP</span><h2>Проверяю личные диалоги…</h2><p>Никаких сообщений без выбора чата не копируем.</p>');
    try {
      const data = await backupApi('list_chats');
      privacyState.backup.chats = Array.isArray(data.chats) ? data.chats : [];
      renderBackupList();
    } catch (error) {
      openSheet(`
        <span class="kicker">HISTORY BACKUP</span><h2>Нужно подключить Telegram</h2>
        <p>${escapeHtml(error.message)}</p>
        <p>Для резервной копии требуется собственный Telegram-аккаунт с номером и кодом. Telegram Business для этого не обязателен.</p>
        <div class="sheet-actions">
          <button class="accent" data-backup-connect="1">Подключить мой Telegram</button>
          <button data-backup-retry="1">Проверить ещё раз</button>
          <button data-privacy-close="1">Закрыть</button>
        </div>`);
    }
  }

  function renderBackupConfirm(chat) {
    privacyState.backup.selected = chat;
    privacyState.backup.offsetId = 0;
    privacyState.backup.totalSaved = 0;
    privacyState.backup.totalRead = 0;
    privacyState.backup.stopRequested = false;
    privacyState.backup.auto = false;
    const saved = savedBackupCursor(chat.chatId);
    openSheet(`
      <span class="kicker">СОГЛАСИЕ НА КОПИРОВАНИЕ · 1 ЧАТ</span>
      <h2>${escapeHtml(chat.title)}</h2>
      <p>Сохранить доступную историю <strong>этого одного чата</strong> в VETO Inbox? В отличие от удаления оригинала в Telegram, копия сохранится на выбранный срок.</p>
      <p>Сейчас срок: <b>${Number(privacyState.settings.retentionDays || 30)} дней</b>. Уже удалённые сообщения вернуть нельзя. Работаем порциями по 45 сообщений.</p>
      ${saved ? `<div class="ghost-backup-summary"><strong>Найдена незавершённая копия</strong><br>Ранее проверено ${saved.totalRead} сообщений. Можно продолжить с сохранённого места — уже скопированное не перезаписывается.</div>` : ''}
      <label class="ghost-backup-notify"><input type="checkbox" id="backupAuto" checked> Продолжать автоматически, пока приложение открыто (максимум 20 порций за запуск)</label>
      <label class="ghost-backup-notify"><input type="checkbox" id="backupNotify" checked> Уведомить меня в Telegram после полного завершения</label>
      <div class="sheet-actions">
        <button class="accent" data-backup-run="1">${saved ? 'Начать заново →' : 'Сохранить доступные сообщения →'}</button>
        ${saved ? '<button data-backup-resume="1">Продолжить с сохранённого места →</button>' : ''}
        <button data-backup-back="1">Назад к чатам</button>
      </div>
    `);
  }

  function renderBackupProgress({ complete = false, error = '', alerted = null, pageLimit = false } = {}) {
    const backup = privacyState.backup;
    const chat = backup.selected;
    if (!chat) return;
    const paused = !backup.running && !complete;
    openSheet(`
      <span class="kicker">VETO PRIVATE ARCHIVE · ${complete ? 'ГОТОВО' : paused ? 'ПАУЗА' : 'КОПИРОВАНИЕ'}</span>
      <h2>${escapeHtml(chat.title)}</h2>
      <div class="ghost-backup-progress"><strong>${backup.totalSaved}</strong><span>новых сообщений сохранено</span></div>
      <p>Проверено: ${backup.totalRead} сообщений. ${complete
        ? 'Доступная история в пределах срока хранения скопирована.'
        : pageLimit ? 'Достигнут предел автоматической проверки. Можно запустить следующие 20 порций.'
        : backup.running ? 'Автоматически продолжаю копирование выбранного чата.' : 'Копирование приостановлено — всё уже сохранённое осталось в VETO.'}</p>
      ${error ? `<p class="privacy-archive-limit">${escapeHtml(error)}</p>` : ''}
      ${complete && backup.notifyCompletion
        ? '<p>Уведомление: ' + (alerted === true ? 'доставлено в бот.' : 'не доставлено. Открой @Storypilotlab_bot и нажми Start.') + '</p>'
        : ''}
      <p class="privacy-archive-limit">Доступны только сообщения, которые Telegram сохранил и предоставил аккаунту. Старые медиа — отметки о вложениях, не файлы.</p>
      <div class="sheet-actions">
        ${complete ? '<button class="accent" data-backup-open-chat="1">Открыть сохранённый чат →</button>'
          : backup.running ? '<button class="ghost-backup-stop" data-backup-pause="1">Приостановить после текущей порции</button>'
          : '<button class="accent" data-backup-next="1">Продолжить копирование →</button>'}
        ${!backup.running ? '<button data-backup-back="1">Выбрать другой чат</button><button data-privacy-close="1">Закрыть</button>'
          : '<small class="ghost-backup-working">Не закрывай Telegram Mini App во время копирования. Если закроешь, можно продолжить позже.</small>'}
      </div>
    `);
  }

  async function runBackupPage(button, offsetId = 0) {
    const backup = privacyState.backup;
    const chat = backup.selected;
    if (backup.running || !chat) return;
    backup.running = true;
    backup.stopRequested = false;
    if (button) { button.disabled=true; button.textContent='Копирую из Telegram…'; }
    let cursor = Number(offsetId || 0);
    let pages = 0;
    let didFinish = false;
    try {
      while (!backup.stopRequested && pages < (backup.auto ? 20 : 1)) {
        const data = await backupApi('backup_chat', {
          chatId:chat.chatId, offsetId:cursor, confirm:true,
          notifyCompletion:backup.notifyCompletion,
        });
        pages += 1;
        backup.totalSaved += Number(data.saved || 0);
        backup.totalRead += Number(data.fetched || 0);
        backup.offsetId = Number(data.nextOffsetId || 0);
        didFinish = !data.hasMore;
        if (didFinish) {
          clearBackupCursor(chat.chatId);
          backup.running = false;
          renderBackupProgress({complete:true, alerted:data.notified});
          await refresh({silent:true});
          if (data.notified) haptic('soft');
          return;
        }
        // On a broken/looping server cursor, stop instead of fetching forever.
        if (!Number.isSafeInteger(backup.offsetId) || backup.offsetId <= 0
            || (cursor > 0 && backup.offsetId >= cursor)) {
          throw new Error('Telegram вернул некорректную страницу. Ранее сохранённые сообщения остались в VETO.');
        }
        cursor = backup.offsetId;
        rememberBackupCursor();
        renderBackupProgress();
        if (backup.auto && !backup.stopRequested && pages < 20) {
          // Yield to the WebView so Stop stays responsive on older phones.
          await new Promise(resolve => setTimeout(resolve, 180));
        }
      }
      backup.running = false;
      renderBackupProgress({pageLimit:pages >= 20});
      await refresh({silent:true});
    } catch (error) {
      backup.running = false;
      renderBackupProgress({error:error.message});
      toast(error.message);
    } finally {
      backup.running = false;
    }
  }

  async function clearArchive() {
    // Clearing a Telegram conversation and deleting VETO's independent archive
    // are separate actions. Use a typed second step to prevent accidental loss.
    openSheet(`
      <span class="kicker">БЕЗВОЗВРАТНОЕ УДАЛЕНИЕ</span>
      <h2>Удалить сохранённые копии VETO?</h2>
      <p>Будут удалены сохранённые сообщения, копии удалений и доступные медиа из VETO. Очистка беседы в обычном Telegram ЭТОГО НЕ ДЕЛАЕТ.</p>
      <p class="privacy-archive-limit"><strong>Это нельзя отменить.</strong> Если цель — очистить оригинальный Telegram-чат, просто закрой это окно. VETO-архив останется.</p>
      <label class="privacy-danger-input">Для подтверждения введи УДАЛИТЬ
        <input id="privacyConfirmDelete" type="text" autocomplete="off" autocapitalize="characters" placeholder="УДАЛИТЬ" />
      </label>
      <div class="sheet-actions">
        <button class="ghost-danger" data-privacy-confirm-clear="1" disabled>Удалить архив VETO навсегда</button>
        <button data-privacy-close="1">Оставить копии</button>
      </div>
    `);
  }

  function startAutoRefresh() {
    if (privacyState.autoTimer) return;
    privacyState.autoTimer = setInterval(() => {
      if (privacyScreenActive() && anyEnabled() && !document.hidden) {
        refresh({ silent:true, background:true });
      }
    }, 12000);
  }

  $('privacyDiagnosticsButton')?.addEventListener('click', () => runGhostDiagnostics());
  $('privacyBackupGuideButton')?.addEventListener('click', privacyBusinessGuideSheet);
  $('privacyBackupHistoryButton')?.addEventListener('click', openBackupPicker);
  $('privacyTestNotificationButton')?.addEventListener('click', async event => {
    const button = event.currentTarget;
    button.disabled=true;
    try { await request('test_alert'); toast('Тест доставлен в Telegram. Проверь чат с VETO.'); }
    catch (error) { toast('Проверь бота @Storypilotlab_bot: '+error.message); }
    finally {button.disabled=false;}
  });
  $('privacyDeletedMore')?.addEventListener('click', loadMoreDeletedFeed);

  $('smartBriefPrimary')?.addEventListener('click', () => {
    const chatId = String($('smartBriefPrimary')?.dataset?.chatId || '');
    if (!chatId) return;
    privacyState.filter = 'smart';
    render();
    openThread(chatId, { mode:'all' });
  });

  $('ghostLatestDeletedCard')?.addEventListener('click', event => {
    const card = event.currentTarget;
    const chatId = String(card?.dataset?.chatId || '');
    const messageId = Number(card?.dataset?.messageId || 0);
    if (!chatId || !messageId) return;
    haptic('soft');
    window.VetoTelegramNavigate?.('chats');
    setTimeout(() => openThread(chatId, { mode:'focus', focusMessageId:messageId }), 60);
  });

  // Chats is a secondary screen: it has no bottom tab to click.
  // Use the main navigator to reveal it and keep the Privacy tab selected.
  $('privacyEnableAllButton')?.addEventListener('click', enableAll);
  document.querySelectorAll('[data-ghost-jump]').forEach(button => {
    button.addEventListener('click', () => {
      const target = String(button.dataset.ghostJump || 'all');
      privacyState.filter = ['deleted','edited','media'].includes(target) ? target : 'all';
      haptic('soft');
      if (privacyState.filter === 'deleted') refreshDeletedFeed({ silent:true });
      render();
      window.VetoTelegramNavigate?.('chats');
      setTimeout(() => $('privacyThreads')?.scrollIntoView({ behavior:'smooth', block:'start' }), 80);
    });
  });
  $('privacyAntiDeleteSwitch')?.addEventListener('change', event => saveSettings({ antiDelete:event.target.checked }));
  $('privacyEditHistorySwitch')?.addEventListener('change', event => saveSettings({ editHistory:event.target.checked }));
  $('privacyGhostInboxSwitch')?.addEventListener('change', event => saveSettings({ ghostInbox:event.target.checked }));
  $('privacyGhostFocusSwitch')?.addEventListener('change', event => saveSettings({ ghostFocus:event.target.checked }));
  $('privacyNotifyDeletesSwitch')?.addEventListener('change', event => saveSettings({ notifyDeletes:event.target.checked }));
  $('privacyNotifyEditsSwitch')?.addEventListener('change', event => saveSettings({ notifyEdits:event.target.checked }));
  $('privacyRefreshButton')?.addEventListener('click', () => refresh());
  $('privacyClearButton')?.addEventListener('click', clearArchive);

  $('privacyRetentionSegment')?.addEventListener('click', async event => {
    const button = event.target.closest('[data-retention]');
    if (!button) return;
    const nextDays = Number(button.dataset.retention || 30);
    const oldDays = Number(privacyState.settings.retentionDays || 30);
    if (nextDays === oldDays) return;
    if (nextDays < oldDays) {
      const text = 'Уменьшение срока с ' + oldDays + ' до ' + nextDays
        + ' дней удалит копии сообщений старше нового срока. Продолжить?';
      const accepted = await new Promise(resolve => {
        if (tg?.showConfirm) tg.showConfirm(text, result => resolve(Boolean(result)));
        else resolve(window.confirm(text));
      });
      if (!accepted) return;
      await saveSettings({ retentionDays:nextDays }, { confirmRetentionPurge:true });
    } else {
      await saveSettings({ retentionDays:nextDays });
    }
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
    if (privacyState.filter === 'deleted') refreshDeletedFeed({ silent:true });
    render();
  });

  document.querySelectorAll('[data-smart-filter]').forEach(button => {
    button.addEventListener('click', () => {
      privacyState.filter = button.dataset.smartFilter || 'smart';
      haptic('soft');
      render();
      $('privacyThreads')?.scrollIntoView({ behavior:'smooth', block:'start' });
    });
  });

  function onVetoScreenChanged(event) {
    const screen = event?.detail?.screen;
    if (screen !== 'privacy' && screen !== 'chats') return;
    refresh({ silent:true });
    loadTelegramConnection({ silent:true });
    if (screen === 'chats' && privacyState.filter === 'deleted') {
      refreshDeletedFeed({ silent:true, force:true });
    }
  }
  window.addEventListener('veto:screen-changed', onVetoScreenChanged);

  $('privacyAccessAction')?.addEventListener('click', async () => {
    await loadTelegramConnection({ silent:false });
    if (privacyState.connection.live && privacyState.connection.readMessages) {
      toast('Доступ подтверждён: новые разрешённые сообщения сохраняются');
      return;
    }
    privacyBusinessGuideSheet();
  });

  $('privacyThreads')?.addEventListener('click', event => {
    const deletedTarget = event.target.closest('[data-deleted-chat][data-deleted-message]');
    if (deletedTarget) {
      openThread(deletedTarget.dataset.deletedChat, {
        mode: 'focus',
        focusMessageId: Number(deletedTarget.dataset.deletedMessage || 0) || null,
      });
      return;
    }

    const target = event.target.closest('[data-privacy-chat]');
    if (!target) return;
    const chatId = target.dataset.privacyChat;
    const thread = privacyState.threads.find(item => String(item.chatId) === String(chatId));

    if (privacyState.filter === 'deleted') {
      openThread(chatId, {
        mode: thread?.latestDeletedMessageId ? 'focus' : 'deleted',
        focusMessageId: thread?.latestDeletedMessageId || null,
      });
      return;
    }

    if (privacyState.filter === 'edited') {
      openThread(chatId, {
        mode: thread?.latestEditedMessageId ? 'focus' : 'edited',
        focusMessageId: thread?.latestEditedMessageId || null,
      });
      return;
    }

    openThread(chatId);
  });

  $('sheet')?.addEventListener('input', event => {
    if (event.target?.id !== 'privacyConfirmDelete') return;
    const accept = $('sheet')?.querySelector('[data-privacy-confirm-clear]');
    if (accept) accept.disabled = String(event.target.value || '').trim() !== 'УДАЛИТЬ';
  });

  $('sheet')?.addEventListener('click', async event => {
    const action = event.target.closest('[data-backup-chat],[data-backup-run],[data-backup-next],[data-backup-back],[data-backup-retry],[data-backup-connect],[data-backup-open-chat],[data-backup-retention-long]');
    if (action) {
      if (action.hasAttribute('data-backup-chat')) {
        const chat = privacyState.backup.chats.find(c => String(c.chatId) === String(action.dataset.backupChat));
        if (chat) renderBackupConfirm(chat);
      } else if (action.hasAttribute('data-backup-run')) {
        privacyState.backup.notifyCompletion = $('backupNotify')?.checked !== false;
        await runBackupPage(action,0);
      } else if (action.hasAttribute('data-backup-next')) {
        await runBackupPage(action,privacyState.backup.offsetId);
      } else if (action.hasAttribute('data-backup-back')) renderBackupList();
      else if (action.hasAttribute('data-backup-retry')) await openBackupPicker();
      else if (action.hasAttribute('data-backup-connect')) {
        closeSheet();
        $('connectTelegramButton')?.click();
      } else if (action.hasAttribute('data-backup-retention-long')) {
        action.disabled=true;
        const changed=await saveSettings({retentionDays:3650});
        if(changed) renderBackupList(); else action.disabled=false;
      } else if (action.hasAttribute('data-backup-open-chat')) {
        closeSheet();
        privacyState.filter='all';
        window.VetoTelegramNavigate?.('chats');
        setTimeout(() => openThread(privacyState.backup.selected.chatId),80);
      }
      return;
    }
    const confirmClear = event.target.closest('[data-privacy-confirm-clear]');
    if (confirmClear) {
      if (String($('privacyConfirmDelete')?.value || '').trim() !== 'УДАЛИТЬ') return;
      confirmClear.disabled = true;
      try {
        await request('clear_archive', { confirm:'DELETE_MY_VETO_ARCHIVE' });
        privacyState.threads = [];
        privacyState.smartSummary = null;
        privacyState.deletedFeed = [];
        privacyState.deletedFeedHasMore = false;
        privacyState.deletedFeedLoaded = true;
        privacyState.lastTotalMessages = 0;
        closeSheet(); render();
        toast('Архив VETO удалён по твоему подтверждению');
      } catch (error) {
        toast(error.message);
        confirmClear.disabled = false;
      }
      return;
    }
    const diagnosticsRefresh = event.target.closest('[data-ghost-diagnostics-refresh]');
    if (diagnosticsRefresh) {
      await runGhostDiagnostics({ silent:true });
      return;
    }

    const testAlert = event.target.closest('[data-ghost-test-alert]');
    if (testAlert) {
      try {
        await request('test_alert');
        toast('Тестовый alert отправлен в бот');
        haptic('soft');
      } catch (error) {
        toast(error.message);
      }
      return;
    }

    const keepLong = event.target.closest('[data-privacy-keep-long]');
    if (keepLong) {
      keepLong.disabled = true;
      const saved = await saveSettings({ retentionDays:3650 });
      if (saved) toast('Архив настроен: хранение копий до 10 лет');
      keepLong.disabled = false;
      return;
    }

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

    const copyButton = event.target.closest('[data-ghost-copy]');
    if (copyButton) {
      await copyGhostMessage(copyButton.dataset.ghostCopy);
      return;
    }

    const openPeerButton = event.target.closest('[data-ghost-open-peer]');
    if (openPeerButton) {
      openTelegramPeer(openPeerButton.dataset.ghostOpenPeer);
      return;
    }

    const threadModeButton = event.target.closest('[data-privacy-thread-mode]');
    if (threadModeButton && privacyState.activeThread) {
      const mode = normalizeThreadMode(threadModeButton.dataset.privacyThreadMode);
      renderThreadSheet(
        privacyState.activeThread.thread,
        privacyState.activeThread.messages,
        { mode, focusMessageId: null },
      );
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

    if (event.target.closest('[data-privacy-thread-more]')) {
      await loadOlderThread();
      return;
    }
    const threadRefresh = event.target.closest('[data-privacy-thread-refresh]');
    if (threadRefresh) {
      openThread(threadRefresh.dataset.privacyThreadRefresh, {
        silent:true,
        mode: privacyState.activeThread?.mode || 'all',
        focusMessageId: privacyState.activeThread?.focusMessageId || null,
      });
      return;
    }

    if (event.target.closest('[data-privacy-back]') && privacyState.activeThread) {
      revokeMediaUrl();
      renderThreadSheet(
        privacyState.activeThread.thread,
        privacyState.activeThread.messages,
        {
          mode: privacyState.activeThread.mode || 'all',
          focusMessageId: privacyState.activeThread.focusMessageId || null,
        },
      );
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
  // Deep links are activated by app.js before this module attaches listeners.
  if (tg?.initData && privacyScreenActive()) onVetoScreenChanged({ detail: { screen: document.querySelector('.screen.active')?.dataset?.screen } });
})();
