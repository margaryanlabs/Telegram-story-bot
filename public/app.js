(() => {
  const tg = window.Telegram?.WebApp;
  const $ = (id) => document.getElementById(id);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const qs = new URLSearchParams(location.search);

  const CODE_AUDIENCE = { s:'standard', a:'all', c:'contacts', f:'close', u:'selected' };
  // The old unscoped caption key could expose a previous Telegram user's
  // unpublished text after switching accounts in the same WebView.
  const DRAFT_CAPTION_KEY = 'story-pilot:draft-caption'; // legacy purge only
  const captionDraftStorageKey=()=>{
    const id=String(window.Telegram?.WebApp?.initDataUnsafe?.user?.id||'');
    return window.Telegram?.WebApp?.initData && /^\d{1,20}$/.test(id)
      ? DRAFT_CAPTION_KEY+':owner:'+id : '';
  };
  const VETO_WELCOME_KEY = 'veto-telegram:welcome:v1';

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

  function mergeClientHistory(incoming = [], existing = []) {
    const existingMap = new Map((existing || []).map(item => [String(item.id), item]));
    const merged = [];
    const seen = new Set();

    for (const item of incoming || []) {
      const id = String(item.id || '');
      if (!id || seen.has(id)) continue;
      merged.push({
        ...(existingMap.get(id) || {}),
        ...item,
        countsKnown: item.countsKnown === undefined
          ? (existingMap.get(id)?.countsKnown ?? true)
          : item.countsKnown,
      });
      seen.add(id);
    }

    for (const item of existing || []) {
      const id = String(item.id || '');
      if (!id || seen.has(id)) continue;
      merged.push(item);
      seen.add(id);
    }

    return merged
      .sort((a, b) => Number(b.ts || 0) - Number(a.ts || 0))
      .slice(0, 100);
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
    activity: [],
    analytics: null,
    advancedPrivacy: true,
    accountConnection: { connected:false, account:null },
    businessPermissions: { connected:false, stories:false, messages:false },
    viewerSync: { available:false, requiresUserSession:true },
    processing: qs.get('pr') === '1',
  };

  const SCREEN_ALIASES = {
    home: 'home',
    ai: 'ai',
    vetogramai: 'ai',
    stories: 'publish',
    publish: 'publish',
    ghost: 'privacy',
    privacy: 'privacy',
    chats: 'chats',
    telegram: 'telegram',
    livechats: 'telegram',
    voice:'voice',
    voicestudio:'voice',
    relay: 'relay',
    studio: 'story-engine',
    'story-engine':'story-engine',
    storyengine:'story-engine',
    creator: 'studio',
    intelligence: 'viewers',
    viewers: 'viewers',
    analytics: 'analytics',
    archive: 'archive',
  };
  const requestedScreen = SCREEN_ALIASES[String(qs.get('screen') || '').toLowerCase()] || null;
  let currentScreen = 'home';
  let selectedViewerStory = state.lastStory || state.history?.[0]?.id || null;
  let toastTimer = null;
  let viewerSearchQuery = '';
  let viewerRegisteredKey = '';
  let viewerQrAbortController = null;
  let viewerAuthBusy = false;
  let viewerPendingPhone = '';
  let composerFile = null;
  let composerDataUrl = '';
  let composerPreviewUrl = '';
  let composerNonce = '';
  let composerBusy = false;
  let composerGeneration = 0;
  let composerOwner = '';
  let composerSignedIdentity=String(tg?.initData||'');
  let composerPendingFileName = '';
  let composerPortalHandoff = null;
  // A public Portal link is not part of the caption: Telegram's Story link
  // area exists only for Business Bot API + standard audience.
  function syncComposerPortal(){
    const panel=$('storyPortalHandoff'),consent=$('storyPortalConfirm');
    if(!panel||!consent)return;
    const current=Boolean(composerPortalHandoff &&
      composerPortalHandoff.generation===composerGeneration &&
      composerPortalHandoff.signed===String(tg?.initData||''));
    panel.hidden=!current;
    if(!current)consent.checked=false;
    if(current){
      let host='Portal';
      try{host=new URL(composerPortalHandoff.url).host;}catch{}
      $('storyPortalLinkHost').textContent=
        'Публичная ссылка · '+host+' · требуется отдельное подтверждение';
    }
  }
  function clearComposerPortal(){
    composerPortalHandoff=null;
    if($('storyPortalConfirm'))$('storyPortalConfirm').checked=false;
    syncComposerPortal();
  }
  let viewerState = {
    configured: null,
    backgroundReady: false,
    newConnectionsReady: null,
    secureSessionCrypto: null,
    cipherVersion: null,
    storageStatus: null,
    session: null,
    loginPending: null,
    story: null,
    viewers: [],
    analytics: null,
    degraded: false,
    error: null,
  };

  let automationState = {
    loaded: false,
    rules: {},
    jobs: [],
    busy: false,
    error: null,
  };

  function telegramAccountReady() {
    return Boolean(
      state.ready
      || state.connection === 'ready'
      || state.accountConnection?.connected
      || viewerState.session?.connected
    );
  }

  function activeStoryHistory() {
    return (state.history || []).filter(item => !item.deleted);
  }

  function preferredStory() {
    const active = activeStoryHistory();
    if (selectedViewerStory) {
      const selected = active.find(item => String(item.id) === String(selectedViewerStory));
      if (selected) return selected;
    }
    return active[0] || null;
  }

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
    // Invalidate any in-flight image compression before it can replace a new draft.
    composerGeneration++;
    composerFile = null;
    composerDataUrl = '';
    composerNonce = '';
    composerOwner = '';
    composerPendingFileName = '';
    composerBusy = false;
    clearComposerPortal();
    if (composerPreviewUrl) URL.revokeObjectURL(composerPreviewUrl);
    composerPreviewUrl = '';
    $('storyFileInput').value = '';

    if (!keepCaption) {
      $('storyCaption').value = '';
      $('captionCounter').textContent = '0 / 2048';
      try {
        const key=captionDraftStorageKey();
        if(key)sessionStorage.removeItem(key);
      } catch {}
    }

    $('mediaPreview').hidden = true;
    $('pickStoryMedia').hidden = false;
    renderPublish();
  }

  function ensureComposerIdentity(){
    const current=String(tg?.initData||'');
    if(current===composerSignedIdentity)return;
    composerSignedIdentity=current;
    // Read only the *new* account's draft key before clearing visible media.
    const key=captionDraftStorageKey();
    let ownCaption='';
    try{if(key)ownCaption=sessionStorage.getItem(key)||'';}catch{}
    resetComposer({keepCaption:true});
    $('storyCaption').value=ownCaption.slice(0,2048);
    $('captionCounter').textContent=$('storyCaption').value.length+' / 2048';
    showToast('Telegram-аккаунт изменился. Фото и Portal предыдущей сессии очищены.');
  }
  async function prepareComposerFile(file,{stillCurrent=null}={}) {
    if (!file || state.processing) return false;
    const generation = ++composerGeneration;
    const signedOwner = String(tg?.initData || '');
    // Replacing the photo must never retain an earlier prepared Portal,
    // nonce, image or preview (even while compression is still running).
    clearComposerPortal();
    composerPendingFileName=String(file.name||'');
    composerFile=null;composerDataUrl='';composerOwner='';composerNonce='';
    if(composerPreviewUrl)URL.revokeObjectURL(composerPreviewUrl);
    composerPreviewUrl='';
    $('mediaPreviewImage').removeAttribute('src');
    $('mediaPreview').hidden=true;
    $('pickStoryMedia').hidden=false;
    const isCurrent = () => generation === composerGeneration &&
      signedOwner === String(tg?.initData || '') &&
      (!stillCurrent || stillCurrent()===true);

    composerBusy = true;
    $('composerState').textContent = 'Подготавливаю…';
    $('composerState').className = 'composer-state busy';
    renderPublish();

    try {
      const prepared = await compressStoryImage(file);
      if (!isCurrent()) return false;
      composerFile = file;
      composerOwner = signedOwner;
      syncComposerPortal();
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
      return true;
    } catch (error) {
      if (!isCurrent()) return false;
      resetComposer({ keepCaption: true });
      notify('error');
      showToast(error.message);
      return false;
    } finally {
      if (generation === composerGeneration) {
        if (signedOwner !== String(tg?.initData || '')) {
          // A new Telegram account must not inherit a half-prepared Story.
          resetComposer();
        } else {
          composerBusy = false;
          renderPublish();
        }
      }
    }
  }

  // Direct Story Engine → Publisher bridge. No DataTransfer requirement
  // (missing on some native iOS WebViews), no simulated transfer success.
  // The caller's revision fence runs after every await of image compression.
  window.VetoTelegramStageStory=async ({
    file,caption='',portalLink=null,ownerId='',draftId='',stillCurrent=null
  }={})=>{
    const signed=String(tg?.initData||'');
    const currentId=String(tg?.initDataUnsafe?.user?.id||'');
    if(!signed || !/^\d{1,20}$/.test(currentId) ||
       String(ownerId)!==currentId || typeof stillCurrent!=='function')
      throw Error('Telegram-аккаунт изменился. Передача отменена.');
    if(!file || file.type!=='image/jpeg' || file.size>10*1024*1024)
      throw Error('Story Engine передал неподдерживаемый JPEG.');
    const ready=await prepareComposerFile(file,{stillCurrent});
    if(!ready || signed!==String(tg?.initData||'') || !stillCurrent())
      return false;
    if(portalLink){
      const url=new URL(String(portalLink));
      if(String(portalLink).length>1900 || url.origin!==window.location.origin ||
         url.pathname!=='/portal.html' || url.search || url.username || url.password ||
         !/^#p=[A-Za-z0-9_-]{1,5000}$/.test(url.hash))
        throw Error('Portal-ссылка недействительна или слишком длинная (до 1900 символов). Уменьши описание Portal.');
      composerPortalHandoff={url:url.toString(),signed,
        generation:composerGeneration,draftId:String(draftId||'')};
    }
    syncComposerPortal(); // publisher consent is unchecked by default
    $('storyCaption').value=String(caption||'').slice(0,800);
    $('storyCaption').dispatchEvent(new Event('input',{bubbles:true}));
    return true;
  };

  async function publishComposerStory() {
    ensureComposerIdentity();
    const signedOwner = String(tg?.initData || '');
    if (composerBusy || state.processing) return;
    if(composerPortalHandoff &&
       composerPortalHandoff.signed!==signedOwner){
      resetComposer();
      showToast('Telegram-аккаунт изменился. Подготовь историю заново.');
      return;
    }
    if (!telegramAccountReady()) {
      try { await api('check'); } catch {}
      if (!telegramAccountReady()) {
        connectionHelpSheet();
        return;
      }
    }
    if (signedOwner !== String(tg?.initData || '')) return;
    if (composerDataUrl && composerOwner !== signedOwner) {
      resetComposer();
      showToast('Telegram-аккаунт изменился. Выбери фото заново.');
      return;
    }
    if (!composerDataUrl) {
      $('storyFileInput').click();
      return;
    }
    const attachPortal=Boolean(composerPortalHandoff &&
      composerPortalHandoff.generation===composerGeneration &&
      composerPortalHandoff.signed===signedOwner &&
      $('storyPortalConfirm')?.checked);
    if(attachPortal && state.audience!=='standard'){
      showToast('Portal доступен только для стандартной аудитории Telegram Business. Измени аудиторию или отключи ссылку.');
      return;
    }
    if(attachPortal && state.businessPermissions?.stories!==true){
      showToast('Для кликабельного Portal требуется разрешение Stories в Telegram Business. Отключи ссылку или настрой Business.');
      return;
    }
    // Separate confirmation for a publicly clickable Telegram link area.
    if(attachPortal && !window.confirm(
      'Прикрепить публичную ссылку Portal к истории? Её содержимое увидят все, у кого есть ссылка. Это действие не отменяется удалением черновика.'
    ))return;

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
        ...(attachPortal?{portalLink:composerPortalHandoff.url}:{}),
      });

      const publishedStoryId = String(result.storyId || '');
      if (result.published !== true || !/^[1-9]\d*$/.test(publishedStoryId)) {
        const error = new Error('Telegram не подтвердил ID новой Story. Проверь свои Stories перед повторной публикацией.');
        error.uncertain = true;
        throw error;
      }
      if(attachPortal && result.portalAreaAttached!==true){
        // Story may be live already: NEVER auto-retry to attach a missing link.
        showToast('Story опубликована, но прикрепление Portal не подтверждено. Проверь историю в Telegram.');
      }
      selectedViewerStory = publishedStoryId;
      const publishedAudience = audienceLabel(result.verifiedAudience || state.audience);
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
        <p>Аудитория: ${escapeHtml(publishedAudience)} · Аналитика аудитории ${viewerState.session?.connected ? 'подхватит просмотры автоматически' : 'можно подключить позже'}.</p>
        ${attachPortal ? `<p>${result.portalAreaAttached===true
          ?'Кликабельный Portal подтверждён Telegram Bot API.'
          :'Portal не подтверждён. Проверь Story в Telegram, не отправляй повторно.'}</p>` : ''}
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
    const name = source.firstName || source.first_name || source.username || 'V';
    avatar.textContent = String(name).slice(0, 2).toUpperCase();
  }

  async function api(action = null, payload = {}) {
    const signedOwner = String(tg?.initData || '');
    if (!signedOwner) throw new Error('Открой Vetogram внутри Telegram');

    const options = {
      method: action ? 'POST' : 'GET',
      headers: {
        'x-telegram-init-data': signedOwner,
        'content-type':'application/json',
      },
    };
    if (action) options.body = JSON.stringify({ action, ...payload });

    let response, data;
    try {
      ({ response, data } = await requestJson('/api/miniapp', options, {
        // A Telegram Story POST is not guaranteed idempotent on Bot API.
        // Retrying automatically after a lost response can publish it twice.
        retry: !action || action === 'check',
        timeoutMs: action === 'publish_story' ? 45000 : 15000,
      }));
    } catch (error) {
      if (signedOwner !== String(tg?.initData || ''))
        throw new Error('Telegram-аккаунт изменился. Ответ старой сессии не применён.');
      if (action === 'publish_story') {
        const uncertain = new Error('Связь прервалась: публикация могла пройти. Проверь свои Stories в Telegram перед новой попыткой.');
        uncertain.uncertain = true;
        throw uncertain;
      }
      throw error;
    }

    if (signedOwner !== String(tg?.initData || ''))
      throw new Error('Telegram-аккаунт изменился. Ответ старой сессии не применён.');
    if (!response.ok || !data.ok) {
      const message = data.error || 'Не удалось обновить Vetogram';
      if (action === 'publish_story' &&
          (response.status >= 500 ||
            (response.status === 409 && /обрабатывается|processing/i.test(message)))) {
        const uncertain = new Error(message + ' Результат публикации не подтверждён. Проверь свои Stories перед повторной отправкой.');
        uncertain.uncertain = true;
        throw uncertain;
      }
      throw new Error(message);
    }

    if (Array.isArray(data.activity)) {
      state.activity = data.activity;
    }

    if (data.state) {
      const incomingState = { ...data.state };
      if (action && Array.isArray(incomingState.history)) {
        incomingState.history = mergeClientHistory(incomingState.history, state.history || []);
        if (action === 'delete_story' && payload?.storyId) {
          incomingState.history = incomingState.history.map(item =>
            String(item.id) === String(payload.storyId)
              ? { ...item, deleted: true }
              : item
          );
        }
        // Action responses still carry the compact menu-state analytics.
        // Recompute from the merged durable history instead of shrinking back to 12 Stories.
        incomingState.analytics = null;
      }
      state = { ...state, ...incomingState };
      if (action === 'delete_story' && payload?.storyId) {
        if (String(selectedViewerStory || '') === String(payload.storyId)) {
          selectedViewerStory = (state.history || []).find(item => !item.deleted)?.id || null;
        }
        if (!state.lastStory || String(state.lastStory) === String(payload.storyId)) {
          state.lastStory = (state.history || []).find(item => !item.deleted)?.id || null;
        }
      }
      if (!selectedViewerStory) selectedViewerStory = state.lastStory || state.history?.find(item => !item.deleted)?.id || state.history?.[0]?.id || null;
      render();
    }
    if (data.user) setAvatar(data.user);
    return data;
  }

  async function viewerApi(action = null, payload = {}, storyId = selectedViewerStory) {
    const signedOwner = String(tg?.initData || '');
    if (!signedOwner) throw new Error('Открой Vetogram внутри Telegram');

    const query = storyId ? `?storyId=${encodeURIComponent(storyId)}` : '';
    const options = {
      method: action ? 'POST' : 'GET',
      headers: {
        'x-telegram-init-data': signedOwner,
        'content-type':'application/json',
      },
    };
    if (action) options.body = JSON.stringify({ action, ...payload });

    const { response, data } = await requestJson(`/api/viewer-sync${query}`, options, {
      retry: !action,
      timeoutMs: 18000,
    });

    if (signedOwner !== String(tg?.initData || ''))
      throw new Error('Telegram-аккаунт изменился. Старые данные просмотров не применены.');
    if (!response.ok || !data.ok) {
      const error = new Error(data.error || 'Аналитика аудитории временно недоступен');
      error.viewerData = data;
      throw error;
    }
    return data;
  }

  async function automationsApi(action = null, payload = {}) {
    const signedOwner = String(tg?.initData || '');
    if (!signedOwner) throw new Error('Открой Vetogram внутри Telegram');

    const options = {
      method: action ? 'POST' : 'GET',
      headers: {
        'x-telegram-init-data': signedOwner,
        'content-type':'application/json',
      },
    };
    if (action) options.body = JSON.stringify({ action, ...payload });

    const { response, data } = await requestJson('/api/automations', options, {
      retry: !action || action === 'refresh',
      timeoutMs: 12000,
    });
    if (signedOwner !== String(tg?.initData || ''))
      throw new Error('Telegram-аккаунт изменился. Старые Automation данные не применены.');
    if (!response.ok || !data.ok) throw new Error(data.error || 'Automation Center временно недоступен');
    return data;
  }

  function automationRuleEnabled(ruleKey, fallback = false) {
    const value = automationState.rules?.[ruleKey];
    if (value && typeof value === 'object') return value.enabled === true;
    if (typeof value === 'boolean') return value;
    return fallback;
  }

  function automationJobStatus(job) {
    const status = String(job?.status || '');
    if (status === 'sent') return 'Delivered';
    if (status === 'sending') return 'Sending';
    if (status === 'failed') return 'Retry scheduled';
    if (status === 'queued') return 'Queued';
    return status || 'Unknown';
  }

  function automationJobTitle(job) {
    const rule = String(job?.ruleKey || '');
    const event = job?.event || {};
    if (rule === 'security_changes') {
      if (event.type === 'session.created') return 'Аналитика подключена';
      if (event.type === 'session.revoked') return 'Аналитика отключена';
      return 'Security event';
    }
    if (rule === 'smart_action') {
      return event.actorDisplayName
        || (event.actorUsername ? '@' + event.actorUsername : 'Действие во входящих');
    }
    if (rule === 'watch_changes') {
      const actor = event.actorDisplayName
        || (event.actorUsername ? '@' + event.actorUsername : 'Vetogram Watch');
      return event.type === 'message.delete' ? `${actor} · deleted` : `${actor} · edited`;
    }
    if (rule === 'confirmed_viewer') {
      const actor = event.actorDisplayName
        || (event.actorUsername ? '@' + event.actorUsername : 'Confirmed viewer');
      return event.storyId ? `${actor} · Story #${event.storyId}` : actor;
    }
    return 'Automation';
  }

  function automationPresetKey() {
    const security = automationRuleEnabled('security_changes', true);
    const smart = automationRuleEnabled('smart_action', false);
    const watch = automationRuleEnabled('watch_changes', false);
    const viewer = automationRuleEnabled('confirmed_viewer', false);
    if (security && smart && watch && viewer) return 'full';
    if (security && smart && watch && !viewer) return 'smart';
    if (security && !smart && !watch && !viewer) return 'quiet';
    return 'custom';
  }

  function intelligenceBriefIcon(kind) {
    return ({
      retention:'↻',
      speed:'⚡',
      identity:'◎',
      momentum:'↗',
      person:'◉',
    })[String(kind || '')] || '◌';
  }

  async function refreshViewerAnalytics({ silent = true } = {}) {
    const signedOwner = String(tg?.initData || '');
    if (!signedOwner || !viewerState.session?.connected) {
      viewerState.analytics = null;
      renderAnalytics();
      return;
    }

    try {
      const { response, data } = await requestJson('/api/viewer-sync?analytics=1', {
        method: 'GET',
        headers: {
          'x-telegram-init-data': signedOwner,
          'content-type':'application/json',
        },
      }, { retry:true, timeoutMs:18000 });
      if (signedOwner !== String(tg?.initData || '')) return;
      if (!response.ok || !data.ok) throw new Error(data.error || 'Не удалось загрузить Viewer Analytics');
      viewerState.analytics = data.analytics || null;
    } catch (error) {
      if (signedOwner !== String(tg?.initData || '')) return;
      if (!silent) showToast(error.message);
    }
    if (signedOwner === String(tg?.initData || '')) renderAnalytics();
  }

  async function refreshViewerSync({ silent = false } = {}) {
    const signedOwner = String(tg?.initData || '');
    try {
      let data = await viewerApi();
      if (signedOwner !== String(tg?.initData || '')) return;

      const history = activeStoryHistory().filter(item => Number(item.ts || 0) > 0);
      const historyKey = history.map(item => `${item.id}:${item.ts}:${item.deleted ? 1 : 0}`).join('|');

      if (data.session?.connected && historyKey && historyKey !== viewerRegisteredKey) {
        await viewerApi('register_stories', { stories: history }, null);
        if (signedOwner !== String(tg?.initData || '')) return;
        viewerRegisteredKey = historyKey;
        data = await viewerApi();
        if (signedOwner !== String(tg?.initData || '')) return;
      }

      if (data.degraded) {
        viewerState = {
          ...viewerState,
          configured: Boolean(data.config?.configured),
          backgroundReady: Boolean(data.config?.backgroundReady),
          newConnectionsReady: Boolean(data.config?.newConnectionsReady),
          secureSessionCrypto: Boolean(data.config?.secureSessionCrypto),
          cipherVersion: data.config?.cipherVersion || null,
          storageStatus: data.config?.storageStatus || null,
          degraded: true,
          error: data.storageError || 'Аналитика аудитории временно восстанавливает соединение',
        };
      } else {
        viewerState = {
          configured: Boolean(data.config?.configured),
          backgroundReady: Boolean(data.config?.backgroundReady),
          newConnectionsReady: Boolean(data.config?.newConnectionsReady),
          secureSessionCrypto: Boolean(data.config?.secureSessionCrypto),
          cipherVersion: data.config?.cipherVersion || null,
          storageStatus: data.config?.storageStatus || null,
          session: data.session || null,
          loginPending: data.loginPending || null,
          story: data.story || null,
          viewers: data.viewers || [],
          analytics: viewerState.analytics,
          degraded: false,
          error: null,
        };
      }
    } catch (error) {
      if (signedOwner !== String(tg?.initData || '')) return;
      const data = error.viewerData || {};
      viewerState = {
        ...viewerState,
        configured: data.config?.configured === false ? false : viewerState.configured,
        backgroundReady: Boolean(data.config?.backgroundReady),
        newConnectionsReady: data.config?.newConnectionsReady === undefined
          ? viewerState.newConnectionsReady
          : Boolean(data.config?.newConnectionsReady),
        secureSessionCrypto: data.config?.secureSessionCrypto === undefined
          ? viewerState.secureSessionCrypto
          : Boolean(data.config?.secureSessionCrypto),
        cipherVersion: data.config?.cipherVersion || viewerState.cipherVersion,
        storageStatus: data.config?.storageStatus || viewerState.storageStatus,
        degraded: data.config?.configured === false ? false : true,
        error: error.message,
      };
      if (!silent && data.config?.configured !== false) showToast(error.message);
    }
    if (signedOwner !== String(tg?.initData || '')) return;
    renderViewers();
    renderHome();
  }

  function renderConnection() {
    const personalConnected = viewerState.session?.connected === true || state.accountConnection?.connected === true;
    const ready = state.connection === 'ready' || state.ready === true || personalConnected;
    const permission = !ready && state.connection === 'needs_permission';
    const businessStories = state.businessPermissions?.stories === true;

    $('profileDot').className = 'live-dot ' + (ready ? 'ready' : permission ? 'warn' : '');
    $('heroStatusPill').className = 'status-pill ' + (ready ? 'ready' : permission ? 'warn' : '');

    if (ready) {
      $('heroStatusPill').querySelector('span').textContent = 'Telegram подключён';
      $('connectionIcon').className = 'connection-icon ready';
      $('connectionIcon').textContent = '✓';
      $('connectionTitle').textContent = personalConnected ? 'Telegram Account подключён' : 'Готов к публикации';
      $('connectionText').textContent = personalConnected
        ? 'Защищённая Telegram-сессия активна · истории и аналитика доступны'
        : 'Telegram Business подключён · Stories доступны';
      $('checkButton').textContent = 'Проверить';
      $('metricAccount').textContent = 'Готово';
      $('heroTitle').innerHTML = 'Истории.<br><span>Твой момент.</span>';
      $('heroText').textContent = 'Фото, аудитория, защита, публикация и аналитика — всё прямо внутри Vetogram.';
    } else if (permission) {
      $('heroStatusPill').querySelector('span').textContent = 'Нужно разрешение';
      $('connectionIcon').className = 'connection-icon warn';
      $('connectionIcon').textContent = '!';
      $('connectionTitle').textContent = 'Business подключён частично';
      $('connectionText').textContent = 'Для историй можно дать право управления историями или подключить аккаунт по QR/номеру';
      $('checkButton').textContent = 'Проверить';
      $('metricAccount').textContent = 'Права';
    } else {
      $('heroStatusPill').querySelector('span').textContent = 'Подключение не подтверждено';
      $('connectionIcon').className = 'connection-icon';
      $('connectionIcon').textContent = '↗';
      $('connectionTitle').textContent = 'Подключи Telegram';
      $('connectionText').textContent = 'Telegram ещё не подключён к Vetogram';
      $('checkButton').textContent = 'Проверить';
      $('metricAccount').textContent = 'Ожидание';
    }

    $('composerCard').classList.toggle('disabled', !ready);
    $('audienceBlock').classList.toggle('disabled', !ready);
    $('privacyBlock').classList.toggle('disabled', !ready);
  }

  function renderPublish() {
    ensureComposerIdentity();
    const latest = activeStoryHistory()[0] || null;
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
    $('mainButton').setAttribute('aria-busy', state.processing || composerBusy ? 'true' : 'false');

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
    const item = preferredStory();

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
    quickViewer.textContent = connected
      ? 'Готово'
      : viewerState.newConnectionsReady === false
        ? 'Security setup'
        : 'Нужно подключить';
    quickStory.textContent = hasStory ? `#${item.id}` : 'Нужно опубликовать';

    $('quickTelegramStep').classList.toggle('done', Boolean(state.ready));
    $('quickViewerStep').classList.toggle('done', connected);
    $('quickStoryStep').classList.toggle('done', hasStory);

    const completed = [Boolean(state.ready), connected, hasStory].filter(Boolean).length;
    quickBadge.textContent = completed === 3 ? '3/3 · READY' : `${completed}/3`;
    quickBadge.classList.toggle('ready', completed === 3);

    if (!state.ready) {
      quickPrimary.textContent = 'Проверить Telegram';
    } else if (!connected && viewerState.newConnectionsReady === false) {
      quickPrimary.textContent = 'Проверить Security';
    } else if (!connected) {
      quickPrimary.textContent = 'Подключить аналитику';
    } else if (!hasStory) {
      quickPrimary.textContent = 'Опубликовать Story';
    } else {
      quickPrimary.textContent = 'Обновить данные';
    }

    testAlertButton.disabled = !connected;

    syncState.className = 'viewer-sync-state';
    if (viewerState.degraded) {
      $('viewerSyncTitle').textContent = viewerState.storageStatus === 'unavailable'
        ? 'Сервер хранения VETOGRAM недоступен.' : 'Аналитика аудитории восстанавливает соединение.';
      $('viewerSyncText').textContent = viewerState.error || 'Сохранённый Telegram-аккаунт не отключён. Требуется восстановить сервер.';
      syncState.textContent = 'Хранилище недоступно · сессию не удаляем';
      syncState.classList.add('warn');
      syncButton.textContent = connected ? 'Управление Аналитика аудитории' : 'Обновить';
    } else if (viewerState.configured === false) {
      $('viewerSyncTitle').textContent = 'Аналитика аудитории backend почти готов.';
      $('viewerSyncText').textContent = 'Watcher и авторизация уже установлены. Для фоновых уведомлений нужно отдельное защищённое серверное хранилище.';
      syncState.textContent = 'Нужно завершить серверную настройку Аналитика аудитории';
      syncState.classList.add('warn');
      syncButton.textContent = 'Что осталось подключить';
    } else if (connected) {
      const account = viewerState.session?.account || {};
      $('viewerSyncTitle').textContent = 'Аналитика аудитории активен.';
      $('viewerSyncText').textContent = 'Fast Alerts работают автоматически: новый просмотр замечается в фоне, затем Vetogram подтверждает доступную личность.';
      const alertsOn = viewerState.session?.preferences?.notifyEnabled !== false;
      syncState.textContent = `${account.username ? '@' + account.username : account.firstName || 'Telegram account'} · ${viewerState.backgroundReady ? 'фоновые проверки включены' : 'фоновый cron требует настройки'} · уведомления ${alertsOn ? 'вкл' : 'выкл'}`;
      syncState.classList.add(viewerState.backgroundReady ? 'ready' : 'warn');
      syncButton.textContent = 'Управление Аналитика аудитории';
    } else if (viewerState.session?.status === 'reauth_required') {
      $('viewerSyncTitle').textContent = 'Нужно переподключить Аналитика аудитории.';
      $('viewerSyncText').textContent = viewerState.session?.lastError || 'Telegram-сессия больше не авторизована.';
      syncState.textContent = viewerState.newConnectionsReady === false
        ? 'Повторное подключение временно закрыто Security'
        : 'Требуется повторная авторизация';
      syncState.classList.add('warn');
      syncButton.textContent = 'Переподключить';
    } else if (viewerState.newConnectionsReady === false) {
      $('viewerSyncTitle').textContent = viewerState.storageStatus === 'unavailable'
        ? 'Хранилище VETOGRAM временно недоступно.' : 'Аналитика аудитории защищён.';
      $('viewerSyncText').textContent = viewerState.storageStatus === 'unavailable'
        ? 'Это проблема сервера, а не подтверждение выхода из Telegram. Не удаляй сессию и не отправляй код повторно.'
        : 'Новая приватная Telegram-сессия не будет создана, пока серверное хранилище ключей не подтверждено.';
      syncState.textContent = viewerState.storageStatus === 'unavailable'
        ? 'Сервер хранения · недоступен' : 'Защищённая сессия storage · setup required';
      syncState.classList.add('warn');
      syncButton.textContent = 'Проверить Security';
    } else {
      $('viewerSyncTitle').textContent = 'Подключи аналитику зрителей.';
      $('viewerSyncText').textContent = 'Для Аналитика аудитории используется отдельное защищённое подключение Telegram только к данным твоих собственных Stories. Код входа и 2FA не сохраняются.';
      syncState.textContent = viewerState.configured === null ? 'Проверяю состояние…' : 'Не подключено';
      syncButton.textContent = 'Подключить аналитику';
    }

    const query = viewerSearchQuery.trim().toLowerCase();
    const viewers = (viewerState.viewers || []).filter(viewer => {
      if (!query) return true;
      return [viewer.username, viewer.display_name]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(query));
    });

    $('viewerListBadge').textContent = connected ? `${viewerState.viewers?.length || 0} подтверждено` : 'Аналитика аудитории';

    if (!connected) {
      $('viewerList').innerHTML = '<div class="viewer-empty">Подключи Аналитика аудитории, чтобы видеть подтверждённых зрителей и историю взаимодействий.</div>';
      return;
    }

    if (!selectedViewerStory) {
      $('viewerList').innerHTML = '<div class="viewer-empty">Сначала опубликуй Story через Vetogram.</div>';
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
    $('viewerAnalyticsBadge').textContent = connected ? 'Данные просмотров' : 'Аналитика аудитории';
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

    const brief = intel?.brief || null;
    const briefBadge = $('intelligenceBriefConfidence');
    const briefList = $('intelligenceBriefList');
    if (briefBadge) {
      briefBadge.textContent = brief?.confidence
        ? `${brief.confidence} · ${Number(brief.sampleSize || 0)} signals`
        : 'Evidence';
    }
    if (briefList) {
      const items = Array.isArray(brief?.items) ? brief.items : [];
      briefList.innerHTML = items.length
        ? items.map(item => `
            <article class="intelligence-brief-item">
              <span>${escapeHtml(intelligenceBriefIcon(item.kind))}</span>
              <div>
                <strong>${escapeHtml(item.title || 'Insight')}</strong>
                <p>${escapeHtml(item.detail || '')}</p>
                <small>${escapeHtml(item.evidence || '')}</small>
              </div>
            </article>
          `).join('')
        : '<div class="intel-empty">Пока недостаточно подтверждённых данных для выводов. Vetogram не будет заполнять этот блок догадками.</div>';
    }

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
          <span>${formatDate(item.ts)}${item.protect ? ' · защита' : ''}${item.lastSyncAt ? ` · ${Number(item.views || 0)} views` : ''}</span>
        </div>
        <div class="archive-side">
          <span class="archive-status ${item.deleted ? 'deleted' : ''}">${item.deleted ? 'удалена' : 'опубликована'}</span>
          <small>${relativeTime(item.ts)}</small>
        </div>
      </article>
    `).join('');
  }

  function setHomeActivity(dotId, active) {
    const dot = $(dotId);
    if (!dot) return;
    dot.classList.toggle('ready', Boolean(active));
    dot.classList.toggle('warn', active === false);
  }

  function activityTarget(eventType) {
    const type = String(eventType || '');
    if (type.startsWith('message.')) return 'chats';
    if (type.startsWith('story.view.')) return 'viewers';
    if (type.startsWith('story.')) return 'publish';
    if (type.startsWith('session.') || type.startsWith('security.') || type.startsWith('connection.')) return 'security';
    return 'home';
  }

  function activityIcon(eventType) {
    const type = String(eventType || '');
    if (type === 'message.delete') return '↶';
    if (type === 'message.edit') return '≋';
    if (type === 'message.new') return '✦';
    if (type === 'story.publish') return '＋';
    if (type === 'story.delete') return '−';
    if (type === 'story.view.confirmed') return '◉';
    if (type === 'story.view.provisional') return '◌';
    if (type === 'session.created') return '⌾';
    if (type === 'session.revoked') return '×';
    if (type === 'security.event') return '!';
    return '•';
  }

  function activityActor(event) {
    return event?.actorDisplayName
      || (event?.actorUsername ? '@' + event.actorUsername : '')
      || '';
  }

  function activityCopy(event) {
    const type = String(event?.eventType || '');
    const actor = activityActor(event);
    const storyId = event?.storyId ? `#${event.storyId}` : '';
    const chatTitle = event?.payload?.chatTitle || '';

    if (type === 'message.delete') {
      return {
        title: actor ? `${actor} удалил сообщение` : 'Сообщение удалено',
        detail: chatTitle ? `${chatTitle} · сохранено в Vetogram Vault` : 'Сохранено в Vetogram Vault',
      };
    }
    if (type === 'message.edit') {
      return {
        title: actor ? `${actor} изменил сообщение` : 'Сообщение изменено',
        detail: chatTitle ? `${chatTitle} · версия сохранена` : 'Предыдущая версия сохранена',
      };
    }
    if (type === 'message.new') {
      return {
        title: actor ? `Новое сообщение от ${actor}` : 'Новое сообщение',
        detail: chatTitle || (event?.payload?.hasMedia ? 'Медиа-событие' : 'Business message'),
      };
    }
    if (type === 'story.publish') {
      const audience = event?.payload?.audience ? audienceLabel(event.payload.audience) : 'аудитория сохранена';
      return {
        title: `Story ${storyId || ''} опубликована`.trim(),
        detail: `${audience}${event?.payload?.protected ? ' · защита включена' : ''}`,
      };
    }
    if (type === 'story.delete') {
      return {
        title: `Story ${storyId || ''} удалена`.trim(),
        detail: 'Удаление подтверждено',
      };
    }
    if (type === 'story.view.confirmed') {
      return {
        title: actor ? `${actor} посмотрел Story ${storyId}` : `Подтверждён просмотр Story ${storyId}`,
        detail: event?.payload?.isContact ? 'Контакт Telegram · confirmed' : 'Confirmed viewer',
      };
    }
    if (type === 'story.view.provisional') {
      return {
        title: `Новый просмотр Story ${storyId}`,
        detail: 'Новый сигнал · личность ещё подтверждается Telegram',
      };
    }
    if (type === 'session.created') {
      return {
        title: 'Аналитика аудитории подключён',
        detail: `${event?.payload?.method === 'qr' ? 'QR' : 'Telegram auth'} · encrypted ${event?.payload?.crypto || 'v3'}`,
      };
    }
    if (type === 'session.revoked') {
      return {
        title: 'Аналитика аудитории отключён',
        detail: 'Приватная Telegram session отозвана',
      };
    }
    if (type === 'security.event') {
      return {
        title: 'Security event',
        detail: event?.payload?.label || 'Проверь Security Center',
      };
    }
    return {
      title: 'Событие Vetogram',
      detail: type || 'Activity',
    };
  }

  function activityRelativeTime(value) {
    const ms = new Date(value || 0).getTime();
    if (!Number.isFinite(ms) || ms <= 0) return '';
    const seconds = Math.max(0, Math.floor((Date.now() - ms) / 1000));
    if (seconds < 60) return 'сейчас';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}м`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}ч`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}д`;
    return new Date(ms).toLocaleDateString('ru-RU', { day:'2-digit', month:'short' });
  }

  function renderHomeActivity() {
    const list = $('homeActivityList');
    if (!list) return;
    const events = Array.isArray(state.activity) ? state.activity.slice(0, 7) : [];

    if (!events.length) {
      list.innerHTML = `
        <div class="control-activity-row activity-empty">
          <span class="activity-event-icon">◌</span>
          <div>
            <strong>Пока тихо</strong>
            <small>События архива, историй и аналитики появятся здесь автоматически.</small>
          </div>
        </div>
      `;
      return;
    }

    list.innerHTML = events.map(event => {
      const copy = activityCopy(event);
      const target = activityTarget(event?.eventType);
      return `
        <button class="control-activity-row" type="button" data-activity-screen="${escapeHtml(target)}">
          <span class="activity-event-icon">${escapeHtml(activityIcon(event?.eventType))}</span>
          <div>
            <strong>${escapeHtml(copy.title)}</strong>
            <small>${escapeHtml(copy.detail)}</small>
          </div>
          <time>${escapeHtml(activityRelativeTime(event?.occurredAt))}</time>
        </button>
      `;
    }).join('');
  }

  function renderHome() {
    const intelConnected = viewerState.session?.connected === true || state.accountConnection?.connected === true;
    const telegramReady = state.connection === 'ready' || state.ready === true || intelConnected;
    const ghostPermission = state.readPermission === true;
    const businessStories = state.businessPermissions?.stories === true;

    const overall = $('homeOverallState');
    if (overall) {
      overall.classList.toggle('ready', telegramReady);
      overall.classList.toggle('warn', !telegramReady);
      const label = overall.querySelector('span');
      if (label) label.textContent = telegramReady ? 'Telegram подключён' : 'Нужно подключить';
    }

    if ($('homeTelegramTitle')) {
      $('homeTelegramTitle').textContent = telegramReady
        ? 'Telegram подключён и готов'
        : 'Подключи Telegram, чтобы начать';
      $('homeTelegramText').textContent = telegramReady
        ? 'Теперь можно публиковать Stories и пользоваться аналитикой. Дополнительные функции включаются отдельно.'
        : 'На этом телефоне выбери номер + код. QR используй, если рядом есть второй экран.';
    }

    if ($('homeGhostState')) $('homeGhostState').textContent = ghostPermission ? 'Включено' : 'Anti‑Delete и архив';
    if ($('homeChatsState')) $('homeChatsState').textContent = ghostPermission ? 'Архив доступен' : 'Опционально';
    if ($('homeIntelState')) $('homeIntelState').textContent = intelConnected ? 'Доступно' : 'Аналитика аудитории';
    if ($('homeSecurityState')) $('homeSecurityState').textContent = intelConnected ? 'Защищённая сессия' : 'Контроль доступа';

    const accountBadge = $('vetoAccountBadge');
    const privacyBadge = $('vetoPrivacyBadge');
    const storiesBadge = $('vetoStoriesBadge');
    const connectButton = $('connectTelegramButton');
    if (accountBadge) {
      accountBadge.textContent = telegramReady ? (intelConnected ? 'Аккаунт · Подключён' : 'Бизнес-чаты · Подключены') : 'Аккаунт · Не подключён';
      accountBadge.classList.toggle('ready', telegramReady);
    }
    if (privacyBadge) {
      privacyBadge.textContent = ghostPermission ? 'Архив · Доступ разрешён' : 'Архив · По желанию';
      privacyBadge.classList.toggle('ready', ghostPermission);
    }
    if (storiesBadge) {
      storiesBadge.textContent = telegramReady ? `Истории · ${businessStories ? 'Бизнес-чаты' : intelConnected ? 'Аккаунт' : 'Готово'}` : 'Истории · Ожидание';
      storiesBadge.classList.toggle('ready', telegramReady);
    }
    if (connectButton) {
      connectButton.classList.toggle('connected', telegramReady);
      connectButton.innerHTML = telegramReady
        ? '<span>✓</span><b>Telegram подключён · Управление</b>'
        : '<span>⌁</span><b>Подключить Telegram</b>';
    }

    const hasStory = activeStoryHistory().length > 0;
    const activation = [
      { id:'activationTelegram', done:telegramReady, text:telegramReady ? 'Готово ✓' : 'Нужно' },
      { id:'activationStory', done:hasStory, text:hasStory ? 'Готово ✓' : (telegramReady ? 'Следующий шаг' : 'После шага 1') },
      { id:'activationGhost', done:ghostPermission, text:ghostPermission ? 'Включено' : 'Необязательно', optional:true },
      { id:'activationIntel', done:intelConnected, text:intelConnected ? 'Доступно' : 'После подключения', optional:true },
    ];
    activation.forEach(step => {
      const el = $(step.id);
      if (!el) return;
      el.classList.toggle('done', step.done);
      el.classList.toggle('optional', Boolean(step.optional));
      const status = el.querySelector('em');
      if (status) status.textContent = step.text;
    });

    const completed = [telegramReady, hasStory].filter(Boolean).length;
    const coreReady = telegramReady && hasStory;
    const activationCard = $('activationCard');
    activationCard?.classList.toggle('ready', coreReady);
    if ($('activationScore')) $('activationScore').textContent = `${completed}/2`;
    if ($('activationTitle')) {
      $('activationTitle').textContent = coreReady
        ? 'Vetogram готов к работе'
        : !telegramReady ? 'Шаг 1 · Подключи Telegram' : 'Шаг 2 · Проверь первой Story';
    }
    if ($('activationText')) {
      $('activationText').textContent = !telegramReady
        ? 'На этом телефоне проще выбрать номер + код. Никакой доступ к сообщениям на этом шаге не включается.'
        : !hasStory
          ? 'Telegram уже подключён. Теперь выбери фото и опубликуй тестовую Story — после этого базовая активация завершена.'
          : 'Базовая активация завершена. Privacy, Studio и Automations включай только если они тебе нужны.';
    }

    const activationPrimary = $('activationPrimaryButton');
    if (activationPrimary) {
      if (!telegramReady) {
        activationPrimary.textContent = 'Подключить Telegram · QR / номер';
        activationPrimary.dataset.activationAction = 'telegram';
      } else if (!hasStory) {
        activationPrimary.textContent = 'Шаг 2 · Опубликовать тестовую Story';
        activationPrimary.dataset.activationAction = 'story';
      } else {
        activationPrimary.textContent = 'Готово ✓ · Посмотреть возможности';
        activationPrimary.dataset.activationAction = 'features';
      }
    }

    renderHomeActivity();
  }

  function render() {
    renderConnection();
    renderPublish();
    renderViewers();
    renderAnalytics();
    renderArchive();
    renderHome();
  }

  // Pages without a bottom-tab button still belong to an existing tab.
  const NAV_PARENT = {home:'telegram',chats:'privacy',telegram:'telegram',voice:'ai',archive:'publish',analytics:'ai',viewers:'publish',relay:'ai',ai:'ai',studio:'publish','story-engine':'publish'};
  function switchScreen(name) {
    ensureComposerIdentity();
    const target = SCREEN_ALIASES[String(name || '').toLowerCase()] || 'home';
    if (composerOwner && composerOwner !== String(tg?.initData || '')) resetComposer();
    const activeScreen = [...document.querySelectorAll('.screen')].find(screen => screen.dataset.screen === target);
    if (!activeScreen) {
      showToast('Раздел временно недоступен');
      return false;
    }
    currentScreen = target;
    document.querySelectorAll('.screen').forEach(screen => {
      const active = screen === activeScreen;
      screen.classList.toggle('active', active);
      screen.setAttribute('aria-hidden', String(!active));
    });
    const activeTab = NAV_PARENT[target] || target;
    document.querySelectorAll('.nav-item').forEach(button => {
      const active = button.dataset.nav === activeTab;
      button.classList.toggle('active', active);
      button.setAttribute('aria-current', active ? 'page' : 'false');
    });
    $('actionDock')?.classList.toggle('hidden', target !== 'publish');
    haptic();
    window.scrollTo({ top:0, behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches?'auto':'smooth' });
    if (target === 'viewers' && tg?.initData) refreshViewerSync({ silent: true });
    if (target === 'analytics' && tg?.initData) refreshViewerAnalytics({ silent: true });
    // The Privacy module is loaded separately and must refresh whether a
    // screen is opened through a bottom tab, a home shortcut or a feature sheet.
    window.dispatchEvent(new CustomEvent('veto:screen-changed', { detail: { screen: target } }));
    return true;
  }
  // Other modules can open secondary pages (Chats, Relay) without depending on
  // a non-existent bottom tab or duplicating navigation state.
  window.VetoTelegramNavigate = switchScreen;
  // Messenger and Privacy modules share the same owner-scoped account login.
  // The Business-bot permission is an independent optional archive feature.
  window.VetoTelegramOpenAccountConnection = async () => {
    if (!tg?.initData) {
      showToast('Открой Vetogram внутри своего Telegram');
      return;
    }
    await refreshViewerSync({ silent:true });
    if (viewerState.session?.connected === true && viewerState.session?.identityMismatch !== true) {
      // A signed personal account login is separate from optional Business
      // access. Never launch permission changes when a user taps "My account".
      profileSheet();
    } else {
      connectionHelpSheet();
    }
  };


  let sheetReturnFocus = null;
  function openSheet(html) {
    // Store focus once for a modal flow. Subsequent steps (phone -> code ->
    // 2FA) replace the sheet contents without losing the return target.
    if ($('sheet').hidden) sheetReturnFocus = document.activeElement;
    $('sheetContent').innerHTML = html;
    $('sheetBackdrop').hidden = false;
    $('sheet').hidden = false;
    document.documentElement.classList.add('veto-sheet-open');
    document.body.classList.add('veto-sheet-open');
    $('sheet').focus({preventScroll:true});
    try { tg?.BackButton?.show(); } catch {}
  }

  function closeSheet() {
    if (viewerQrAbortController) {
      viewerQrAbortController.abort();
      viewerQrAbortController = null;
    }
    $('sheetBackdrop').hidden = true;
    $('sheet').hidden = true;
    document.documentElement.classList.remove('veto-sheet-open');
    document.body.classList.remove('veto-sheet-open');
    const returnTo=sheetReturnFocus;
    sheetReturnFocus=null;
    if (returnTo?.isConnected && typeof returnTo.focus==='function')
      returnTo.focus({preventScroll:true});
    try { tg?.BackButton?.hide(); } catch {}
    window.dispatchEvent(new CustomEvent('vetogram:modal-closed'));
  }

  // One modal coordinator shared by account onboarding and the Privacy
  // module. Both control the same #sheet/#sheetBackdrop elements.
  window.VetoTelegramModal = Object.freeze({open:openSheet,close:closeSheet});

  let vetoWelcomeStep = 0;

  function vetoWelcomeSeen() {
    try { return localStorage.getItem(VETO_WELCOME_KEY) === '1'; } catch { return false; }
  }

  function markVetoWelcomeSeen() {
    try { localStorage.setItem(VETO_WELCOME_KEY, '1'); } catch {}
  }

  function renderVetoWelcomeStep(index = vetoWelcomeStep) {
    vetoWelcomeStep = Math.max(0, Math.min(3, Number(index) || 0));
    document.querySelectorAll('[data-veto-intro-step]').forEach((step, stepIndex) => {
      step.classList.toggle('active', stepIndex === vetoWelcomeStep);
    });
    document.querySelectorAll('.veto-intro-dots i').forEach((dot, dotIndex) => {
      dot.classList.toggle('active', dotIndex === vetoWelcomeStep);
    });
    const next = $('vetoWelcomeNext');
    if (next) {
      next.innerHTML = vetoWelcomeStep === 0
        ? 'Перейти к чатам <span>→</span>'
        : vetoWelcomeStep < 3
          ? 'Подробнее <span>→</span>'
          : 'Открыть чаты <span>→</span>';
    }
  }

  function openVetoWelcome({ restart = false } = {}) {
    const welcome = $('vetoWelcome');
    if (!welcome) return;
    if (restart) vetoWelcomeStep = 0;
    renderVetoWelcomeStep(vetoWelcomeStep);
    $('vetoWelcomeExplore')?.toggleAttribute('hidden',vetoWelcomeStep!==0);
    welcome.hidden = false;
    document.documentElement.classList.add('veto-welcome-open');
    try { tg?.HapticFeedback?.impactOccurred?.('light'); } catch {}
  }

  function closeVetoWelcome({ openConnection = false } = {}) {
    const welcome = $('vetoWelcome');
    if (!welcome) return;
    welcome.hidden = true;
    document.documentElement.classList.remove('veto-welcome-open');
    markVetoWelcomeSeen();
    if (openConnection) {
      setTimeout(() => telegramAccountReady() ? profileSheet() : connectionHelpSheet(), 120);
    }
  }

  function privacyPromiseSheet() {
    openSheet(`
      <span class="kicker">Vetogram PRIVACY PROMISE</span>
      <h2>Приватность без красивых обещаний</h2>
      <p>Vetogram показывает, какой доступ реально выдан, и использует его только для функций, которые ты включил.</p>

      <div class="veto-privacy-sheet-hero">
        <strong>Мы не превращаем твою переписку в рекламный профиль.</strong>
        <span>Содержимое сообщений не продаётся рекламодателям и не используется для персонализации рекламы Vetogram.</span>
      </div>

      <div class="veto-privacy-facts">
        <div><i>01</i><div><strong>Что обрабатывается</strong><span>Для Anti‑Delete, Edit History и Smart Inbox сервер получает только те события и сообщения, к которым ты сам выдал Telegram‑доступ.</span></div></div>
        <div><i>02</i><div><strong>Что может храниться</strong><span>Функции архива и восстановления требуют серверного хранения копий и версий. Если модуль выключен, Vetogram не должен притворяться, что он всё равно работает.</span></div></div>
        <div><i>03</i><div><strong>Код Telegram и 2FA</strong><span>Используются только во время подключения аккаунта и не сохраняются как пароль или одноразовый код.</span></div></div>
        <div><i>04</i><div><strong>Ты контролируешь доступ</strong><span>Основную сессию можно отключить в Vetogram Security Center. Business‑доступ для Privacy можно отдельно отозвать в Telegram Business / Chatbots.</span></div></div>
      </div>

      <div class="sheet-actions">
        <button class="accent" data-sheet-action="open-connections">Проверить мои разрешения</button>
        <button data-sheet-action="go-ghost">Открыть Privacy Center</button>
        <button data-sheet-action="close">Закрыть</button>
      </div>
    `);
  }

  const VETO_FEATURES = {
    stories: {
      kicker: 'STORIES',
      icon: '＋',
      title: 'Публикуй Stories из Vetogram',
      summary: 'Выбирай фото, подпись и аудиторию — Vetogram публикует Story от твоего Telegram‑аккаунта и проверяет приватность публикации.',
      benefit: 'Полезно, если хочешь быстро управлять Stories и точно понимать, кому они доступны.',
      access: 'Нужно основное подключение Telegram через номер + код или QR.',
      action: 'Открыть Stories',
      screen: 'publish',
    },
    intelligence: {
      kicker: 'ПРОСМОТРЫ И АНАЛИТИКА',
      icon: '◉',
      title: 'Понимай аудиторию своих Stories',
      summary: 'Vetogram собирает доступные Telegram данные по твоим собственным Stories и показывает просмотры, повторную аудиторию и изменения.',
      benefit: 'Полезно, чтобы видеть не просто цифру просмотров, а динамику аудитории.',
      access: 'Работает после основного подключения Telegram. Дополнительный Business‑доступ не нужен.',
      action: 'Открыть просмотры',
      screen: 'viewers',
    },
    privacy: {
      kicker: 'PRIVACY',
      icon: '◌',
      title: 'Anti‑Delete, Edit History и Smart Inbox',
      summary: 'Если ты сам разрешишь доступ к выбранным Business‑чатам, Vetogram сможет сохранять разрешённые события сообщений, версии изменений и медиа.',
      benefit: 'Полезно, если тебе нужен приватный архив изменений и удалений в выбранных чатах.',
      access: 'Необязательно. Требует отдельного Telegram Business message access для выбранных чатов.',
      action: 'Открыть Privacy',
      screen: 'privacy',
    },
    studio: {
      kicker: 'CREATOR STUDIO',
      icon: '✦',
      title: 'Создавай Telegram‑материалы',
      summary: 'Emoji, stickers и Brand Packs можно собирать и подготавливать прямо внутри Vetogram.',
      benefit: 'Полезно для личного бренда, каналов и визуального оформления.',
      access: 'Для создания материалов дополнительный доступ к сообщениям не нужен.',
      action: 'Открыть Studio',
      screen: 'studio',
    },
    security: {
      kicker: 'SECURITY',
      icon: '⌾',
      title: 'Всегда знай, что подключено',
      summary: 'Security Center показывает основную Telegram‑сессию, шифрование, Business‑доступ и Privacy‑разрешения отдельно.',
      benefit: 'Полезно, чтобы не гадать, какие права активны и что можно отключить.',
      access: 'Никаких дополнительных разрешений для просмотра статуса не требуется.',
      action: 'Открыть Security Center',
      screen: 'security',
    },
    automations: {
      kicker: 'AUTOMATIONS',
      icon: '⚡',
      title: 'Не проверяй всё вручную',
      summary: 'Vetogram может отправлять сигналы о важных событиях: новых просмотрах, изменениях, удалениях и других доступных событиях.',
      benefit: 'Полезно, если хочешь получать только нужные уведомления без постоянной проверки приложения.',
      access: 'Каждая автоматизация работает только с теми источниками, которые ты сам подключил.',
      action: 'Открыть Automations',
      screen: 'automations',
    },
  };

  function featureGuideSheet(featureKey) {
    const feature = VETO_FEATURES[featureKey];
    if (!feature) return;
    openSheet(`
      <span class="kicker">${feature.kicker}</span>
      <div class="feature-guide-title"><span>${feature.icon}</span><h2>${feature.title}</h2></div>
      <p>${feature.summary}</p>
      <div class="feature-guide-facts">
        <div><span>Зачем</span><strong>${feature.benefit}</strong></div>
        <div><span>Что нужно</span><strong>${feature.access}</strong></div>
      </div>
      <div class="sheet-actions">
        <button class="accent" data-sheet-action="feature-open" data-feature-screen="${feature.screen}">${feature.action}</button>
        <button data-sheet-action="all-features">Посмотреть все функции</button>
        <button data-sheet-action="close">Понятно</button>
      </div>
    `);
  }

  function allFeaturesSheet() {
    openSheet(`
      <span class="kicker">ВОЗМОЖНОСТИ Vetogram</span>
      <h2>Что делает каждая функция</h2>
      <p>Нажми на функцию — покажу простыми словами, зачем она нужна и какой доступ требуется.</p>
      <div class="all-features-list">
        ${Object.entries(VETO_FEATURES).map(([key, feature]) => `
          <button data-sheet-action="feature-help" data-feature-key="${key}">
            <span>${feature.icon}</span>
            <div><strong>${feature.title}</strong><small>${feature.summary}</small></div>
            <em>Подробнее</em>
          </button>
        `).join('')}
      </div>
      <div class="sheet-actions"><button data-sheet-action="close">Закрыть</button></div>
    `);
  }

  function formatSecurityTime(value) {
    if (!value) return 'нет данных';
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toLocaleString('ru-RU') : 'нет данных';
  }

  function securityCenterSheet() {
    const accountConnected = viewerState.session?.connected === true || state.accountConnection?.connected === true;
    const businessConnected = state.businessPermissions?.connected === true;
    const privacyPermission = state.readPermission === true || state.businessPermissions?.messages === true;
    const session = viewerState.session;
    const cryptoVersion = session?.cryptoVersion || viewerState.cipherVersion || null;
    const account = session?.account || state.accountConnection?.account || {};
    const lastError = String(session?.lastError || '').trim();

    openSheet(`
      <span class="kicker">Vetogram SECURITY CENTER</span>
      <h2>${accountConnected ? 'Secure Account активен' : 'Контроль доступа'}</h2>
      <p>Здесь только реальные состояния. Коды входа и 2FA не сохраняются; сервер хранит зашифрованную Telegram‑сессию только после успешного подключения.</p>
      <div class="security-status-grid">
        <article class="${accountConnected ? 'ready' : 'warn'}">
          <span>Основное подключение</span>
          <strong>${accountConnected ? 'Connected' : 'Not connected'}</strong>
          <small>QR / phone session</small>
        </article>
        <article class="${viewerState.secureSessionCrypto ? 'ready' : 'warn'}">
          <span>Encryption</span>
          <strong>${viewerState.secureSessionCrypto ? 'Защищено' : 'Check required'}</strong>
          <small>Ключ не передаётся в Mini App</small>
        </article>
        <article class="${businessConnected ? 'ready' : ''}">
          <span>Business</span>
          <strong>${businessConnected ? 'Connected' : 'Optional'}</strong>
          <small>Privacy event access</small>
        </article>
        <article class="${privacyPermission ? 'ready' : ''}">
          <span>Privacy archive</span>
          <strong>${privacyPermission ? 'Active' : 'Optional'}</strong>
          <small>Anti‑Delete · Edit History</small>
        </article>
      </div>

      <div class="sheet-list security-detail-list">
        <div class="sheet-item"><strong>Telegram account</strong><span>${accountConnected ? (account.username ? '@' + escapeHtml(account.username) : escapeHtml(account.firstName || 'Connected account')) : 'Не подключён'}</span></div>
        <div class="sheet-item"><strong>Session created</strong><span>${session?.createdAt ? formatSecurityTime(session.createdAt) : '—'}</span></div>
        <div class="sheet-item"><strong>Last secure check</strong><span>${session?.lastPollAt ? formatSecurityTime(session.lastPollAt) : '—'}</span></div>
        <div class="sheet-item"><strong>Security status</strong><span>${lastError ? '⚠ ' + escapeHtml(lastError.slice(0, 140)) : accountConnected ? '✓ Ошибок сессии нет' : '○ Нет активной Основное подключение session'}</span></div>
      </div>

      <div class="sheet-actions">
        <button class="accent" data-sheet-action="viewer-refresh-security">Проверить снова</button>
        ${accountConnected ? '<button class="danger" data-sheet-action="security-revoke-session">Отключить Telegram Account</button>' : '<button data-sheet-action="account-connect">Подключить Telegram Account</button>'}
        <button data-sheet-action="open-connections">Connection Center</button>
        <button data-sheet-action="close">Закрыть</button>
      </div>
    `);
  }

  function renderAutomationCenterSheet() {
    const securityEnabled = automationRuleEnabled('security_changes', true);
    const smartEnabled = automationRuleEnabled('smart_action', false);
    const watchEnabled = automationRuleEnabled('watch_changes', false);
    const viewerEnabled = automationRuleEnabled('confirmed_viewer', false);
    const jobs = Array.isArray(automationState.jobs) ? automationState.jobs.slice(0, 8) : [];

    const audit = jobs.length
      ? jobs.map(job => `
          <div class="automation-audit-row">
            <span class="automation-audit-dot ${escapeHtml(String(job.status || ''))}"></span>
            <div>
              <strong>${escapeHtml(automationJobTitle(job))}</strong>
              <small>${escapeHtml(automationJobStatus(job))} · ${escapeHtml(formatSecurityTime(job.createdAt))}</small>
            </div>
          </div>
        `).join('')
      : '<div class="automation-empty">Automation audit появится после первого подходящего события.</div>';

    openSheet(`
      <span class="kicker">AUTOMATION CENTER</span>
      <h2>Событие → правило → действие</h2>
      <p>Vetogram реагирует только на нормализованные события и отправляет owner-only alerts. Никаких сообщений другим людям от твоего имени.</p>

      <div class="automation-presets">
        <button type="button" class="${automationPresetKey() === 'quiet' ? 'active' : ''}" data-sheet-action="automation-preset" data-automation-preset="quiet">
          <strong>Quiet</strong><small>Только security</small>
        </button>
        <button type="button" class="${automationPresetKey() === 'smart' ? 'active' : ''}" data-sheet-action="automation-preset" data-automation-preset="smart">
          <strong>Smart</strong><small>Security + Inbox + changes</small>
        </button>
        <button type="button" class="${automationPresetKey() === 'full' ? 'active' : ''}" data-sheet-action="automation-preset" data-automation-preset="full">
          <strong>Full</strong><small>+ confirmed viewers</small>
        </button>
      </div>

      <div class="automation-rule-list">
        <button class="automation-rule-card ${securityEnabled ? 'enabled' : ''}" type="button"
          data-sheet-action="automation-toggle" data-automation-rule="security_changes" data-automation-enabled="${securityEnabled ? '1' : '0'}">
          <span class="automation-rule-icon">⌾</span>
          <span class="automation-rule-copy">
            <strong>Security changes</strong>
            <small>Подключение или отзыв Аналитика аудитории session.</small>
          </span>
          <b>${securityEnabled ? 'ON' : 'OFF'}</b>
        </button>

        <button class="automation-rule-card ${smartEnabled ? 'enabled' : ''}" type="button"
          data-sheet-action="automation-toggle" data-automation-rule="smart_action" data-automation-enabled="${smartEnabled ? '1' : '0'}">
          <span class="automation-rule-icon">⚡</span>
          <span class="automation-rule-copy">
            <strong>Smart Inbox action</strong>
            <small>Входящее сообщение похоже содержит вопрос или запрос.</small>
          </span>
          <b>${smartEnabled ? 'ON' : 'OFF'}</b>
        </button>

        <button class="automation-rule-card ${watchEnabled ? 'enabled' : ''}" type="button"
          data-sheet-action="automation-toggle" data-automation-rule="watch_changes" data-automation-enabled="${watchEnabled ? '1' : '0'}">
          <span class="automation-rule-icon">↶</span>
          <span class="automation-rule-copy">
            <strong>Watch changes</strong>
            <small>Owner alert при удалении или изменении доступного сообщения.</small>
          </span>
          <b>${watchEnabled ? 'ON' : 'OFF'}</b>
        </button>

        <button class="automation-rule-card ${viewerEnabled ? 'enabled' : ''}" type="button"
          data-sheet-action="automation-toggle" data-automation-rule="confirmed_viewer" data-automation-enabled="${viewerEnabled ? '1' : '0'}">
          <span class="automation-rule-icon">◉</span>
          <span class="automation-rule-copy">
            <strong>Confirmed viewer</strong>
            <small>Отдельный alert после подтверждения Viewer Intelligence.</small>
          </span>
          <b>${viewerEnabled ? 'ON' : 'OFF'}</b>
        </button>
      </div>

      <div class="automation-safety-note">
        <strong>Privacy boundary</strong>
        <span>Worker получает только нормализованное Event Vault событие. Raw message text не включается в automation notification payload.</span>
      </div>

      <div class="block-head compact automation-audit-head">
        <div><span class="kicker">AUDIT</span><h2>Последние выполнения</h2></div>
        <span class="tiny-note">queue + retry</span>
      </div>
      <div class="automation-audit-list">${audit}</div>

      <div class="sheet-actions">
        <button class="accent" data-sheet-action="automation-refresh">Обновить</button>
        <button data-sheet-action="open-security">Security Center</button>
        <button data-sheet-action="close">Закрыть</button>
      </div>
    `);
  }

  async function automationCenterSheet({ refresh = true } = {}) {
    if (!automationState.loaded) {
      openSheet(`
        <span class="kicker">AUTOMATION CENTER</span>
        <h2>Загружаю правила</h2>
        <p>Проверяю очередь, audit и текущие настройки.</p>
        <div class="intel-empty">◌ Automation Engine</div>
      `);
    }

    if (refresh) {
      try {
        automationState.busy = true;
        const data = await automationsApi();
        automationState.rules = data.settings?.rules || {};
        automationState.jobs = Array.isArray(data.jobs) ? data.jobs : [];
        automationState.loaded = true;
        automationState.error = null;
      } catch (error) {
        automationState.error = error.message;
        if (!automationState.loaded) {
          openSheet(`
            <span class="kicker">AUTOMATION CENTER</span>
            <h2>Временно недоступно</h2>
            <p>${escapeHtml(error.message)}</p>
            <div class="sheet-actions">
              <button class="accent" data-sheet-action="automation-refresh">Повторить</button>
              <button data-sheet-action="close">Закрыть</button>
            </div>
          `);
          return;
        }
      } finally {
        automationState.busy = false;
      }
    }

    renderAutomationCenterSheet();
  }

  function profileSheet() {
    const accountConnected = viewerState.session?.connected === true || state.accountConnection?.connected === true;
    const businessConnected = state.businessPermissions?.connected === true;
    const businessNeedsPermission = !businessConnected && state.connection === 'needs_permission';
    const businessStories = state.businessPermissions?.stories === true;
    const privacyPermission = state.readPermission === true || state.businessPermissions?.messages === true;
    const storiesReady = telegramAccountReady();
    const account = viewerState.session?.account || state.accountConnection?.account || {};
    openSheet(`
      <span class="kicker">МОЁ ПОДКЛЮЧЕНИЕ</span>
      <h2>${accountConnected ? 'Telegram подключён' : businessConnected ? 'Частичное подключение' : 'Telegram ещё не подключён'}</h2>
      <p>Здесь простыми словами показано, что сейчас работает. Дополнительный доступ к сообщениям не нужен для обычных Stories.</p>
      <div class="sheet-list connection-center-list">
        <div class="sheet-item"><strong>Vetogram открыт внутри Telegram</strong><span>${tg?.initData ? '✓ Да' : '○ Открой Mini App из Telegram'}</span></div>
        <div class="sheet-item"><strong>Основное подключение аккаунта</strong><span>${accountConnected ? '✓ ' + escapeHtml(account.username ? '@' + account.username : account.firstName || 'Telegram подключён') : '○ Не подключено · номер + код или QR'}</span></div>
        <div class="sheet-item"><strong>Публикация Stories</strong><span>${storiesReady ? '✓ Личная сессия подключена · право публикации проверяется при попытке' : '○ Сначала подключи Telegram. Возможность публикации зависит от разрешений и ограничений Telegram'}</span></div>
        <div class="sheet-item"><strong>Дополнительная Privacy</strong><span>${businessConnected && privacyPermission ? '○ Разрешение Business обнаружено · получение сообщений и удалений ещё нужно проверить' : businessNeedsPermission ? '○ Business требует отдельного согласия' : '○ Не включена · это нормально, функция необязательная'}</span></div>
        <div class="sheet-item"><strong>Защита сессии</strong><span>${viewerState.secureSessionCrypto ? '✓ Сессия хранится в зашифрованном виде' : accountConnected ? '⚠ Нужна повторная проверка защиты' : '○ Появится после подключения'}</span></div>
        ${businessConnected ? `<div class="sheet-item"><strong>Telegram Business</strong><span>✓ Подключение обнаружено${businessStories ? ' · право Stories присутствует' : ''}; доставка событий отдельно не проверена</span></div>` : ''}
      </div>
      <div class="sheet-actions">
        <button class="accent" data-sheet-action="account-connect">${accountConnected ? 'Управлять подключением' : 'Подключить Telegram'}</button>
        <button data-sheet-action="business-help">${businessConnected ? 'Проверить дополнительную Privacy' : 'Что такое Privacy‑доступ?'}</button>
        <button data-sheet-action="privacy-promise">Как хранятся данные</button>
        <button data-sheet-action="open-security">Расширенные настройки безопасности</button>
        <button data-sheet-action="close">Закрыть</button>
      </div>
    `);
  }
  function pendingLoginMarkup() {
    const pending = viewerState.loginPending;
    if (!pending || Date.parse(pending.expiresAt || '') <= Date.now()) return '';
    const password = ['password', 'qr_password'].includes(pending.stage);
    return `
      <div class="auth-resume-card">
        <strong>Ты уже начал подключение</strong>
        <p>${password ? 'Telegram ожидает пароль двухэтапной проверки.' : 'Код запрошен у Telegram. Ищи его в официальном чате «Telegram» с синей галочкой, не в чате Vetogram. Если приложение закрылось, новый код запрашивать не нужно.'}</p>
        <button class="accent" data-sheet-action="viewer-resume-login">${password ? 'Продолжить ввод пароля' : 'Ввести полученный код'} →</button>
      </div>
    `;
  }

  function connectionHelpSheet() {
    if (viewerState.session?.identityMismatch === true) {
      openSheet(`
        <span class="kicker">МОЙ TELEGRAM · ПРОВЕРКА АККАУНТА</span>
        <h2>Подключён другой Telegram-аккаунт</h2>
        <p>Открой Vetogram в своём Telegram и подключи именно этот аккаунт. Для просмотра переписок нужен личный вход. Telegram Business отдельно и для чтения живых чатов не требуется.</p>
        <div class="sheet-list">
          <div class="sheet-item"><strong>1 · Очистить неправильное подключение</strong><span>Это отключит только приватную Vetogram-сессию для данного аккаунта.</span></div>
          <div class="sheet-item"><strong>2 · Подключиться заново</strong><span>Номер + код на этом телефоне; QR — если есть второй экран. Коды вводи только сам в Vetogram.</span></div>
        </div>
        <div class="sheet-actions">
          <button class="accent" data-sheet-action="viewer-disconnect">Отключить чужой вход →</button>
          <button data-sheet-action="close">Закрыть</button>
        </div>
      `);
      return;
    }
    if (viewerState.configured === false || viewerState.newConnectionsReady === false) {
      viewerSetupSheet();
      return;
    }
    const accountConnected = viewerState.session?.connected === true || state.accountConnection?.connected === true;
    if (accountConnected) {
      profileSheet();
      return;
    }
    openSheet(`
      <span class="kicker">ШАГ 1 ИЗ 2 · ПОДКЛЮЧЕНИЕ</span>
      <h2>Как тебе удобнее подключить Telegram?</h2>
      <p>Mini App уже знает, кто ты, через Telegram. Номер и код нужны только для отдельного подключения личных чатов/Stories. Код присылает официальный Telegram, не наш бот. QR удобнее, когда есть второй экран.</p>
      ${pendingLoginMarkup()}
      <div class="connection-methods-simple">
        <button class="connection-method-card recommended" data-sheet-action="viewer-use-phone">
          <span class="method-icon">1</span>
          <div><strong>Я на этом телефоне</strong><small>Введи номер → получи код в Telegram → подтверди. Обычно это самый понятный путь.</small></div>
          <em>Рекомендуем</em>
        </button>
        <button class="connection-method-card" data-sheet-action="viewer-start-qr">
          <span class="method-icon">⌁</span>
          <div><strong>У меня есть второй экран</strong><small>Покажем QR. Отсканируй его через Telegram → Settings → Devices.</small></div>
          <em>QR</em>
        </button>
      </div>

      <div class="connection-what-next">
        <strong>Что будет после подключения?</strong>
        <div><span>○</span><p><b>Stories</b><small>редактор доступен, публикация зависит от возможностей и разрешений Telegram</small></p></div>
        <div><span>○</span><p><b>Просмотры</b><small>покажем только те данные о просмотрах, которые фактически вернёт Telegram</small></p></div>
        <div><span>✓</span><p><b>Privacy — отдельно</b><small>доступ к сообщениям не включается автоматически</small></p></div>
      </div>

      <p class="auth-security-note">Код Telegram и 2FA‑пароль не сохраняются. После входа сервер хранит только зашифрованную сессию, которую можно отключить в Security Center.</p>
      <div class="sheet-actions">
        <button data-sheet-action="privacy-promise">Почему это безопасно?</button>
        <button data-sheet-action="close">Не сейчас</button>
      </div>
    `);
  }

  function businessConnectionHelpSheet() {
    openSheet(`
      <span class="kicker">VETOGRAM · BUSINESS</span>
      <h2>Anti-Delete подключается в Vetogram</h2>
      <p>Сначала авторизуй свой Telegram через номер или QR. Для Anti-Delete разреши только нужные личные чаты и подтверди доступ отдельно от Stories.</p>
      <div class="sheet-list">
        <div class="sheet-item"><strong>Основной аккаунт</strong><span>Живые чаты, Story Studio и AI без Telegram Business-бота.</span></div>
        <div class="sheet-item"><strong>Дополнительная защита</strong><span>Бот может получать новые события из выбранных тобой личных чатов после разрешения. Старые удаления не восстановятся.</span></div>
        <div class="sheet-item"><strong>Без лишнего доступа</strong><span>Нет автоматического разрешения на все личные чаты или управления Stories. Отзыв Business-подключения доступен отдельно.</span></div>
      </div>
      <div class="sheet-actions">
        <button class="accent" data-sheet-action="go-ghost">Открыть настройку Anti-Delete</button>
        <button data-sheet-action="account-connect">Подключить основной аккаунт</button>
        <button data-sheet-action="close">Закрыть</button>
      </div>
    `);
  }

  function viewerSetupSheet() {
    if (viewerState.configured === false) {
      openSheet(`
        <span class="kicker">Vetogram SECURE ACCOUNT</span>
        <h2>Защищённое подключение временно недоступно</h2>
        <p>Vetogram не начнёт пользовательскую авторизацию, пока backend и защищённое хранилище не подтверждены.</p>
        <div class="sheet-list">
          <div class="sheet-item"><strong>Realtime watcher</strong><span>Фоновые проверки и последующее подтверждение просмотров уже встроены.</span></div>
          <div class="sheet-item"><strong>Приватное подключение</strong><span>Новое подключение создаётся только при подтверждённом защищённом хранении.</span></div>
        </div>
        <div class="sheet-actions">
          <button class="accent" data-sheet-action="viewer-refresh-security">Проверить подключение</button>
          <button data-sheet-action="close">Закрыть</button>
        </div>
      `);
      return;
    }

    if (viewerState.session?.connected) {
      const account = viewerState.session.account || {};
      openSheet(`
        <span class="kicker">Vetogram SECURE ACCOUNT</span>
        <h2>Telegram подключён</h2>
        <p>${account.username ? '@' + account.username : account.firstName || 'Telegram account'} подключён через зашифрованную пользовательскую сессию. Она используется для функций аккаунта, которые ты запускаешь в Vetogram.</p>
        <div class="sheet-list">
          <div class="sheet-item preference-item">
            <span class="preference-copy"><strong>Новые просмотры</strong><span>Присылать уведомление, когда Vetogram подтверждает новый просмотр.</span></span>
            <label class="switch">
              <input id="viewerNotifySwitch" type="checkbox" data-viewer-pref="notify" ${viewerState.session?.preferences?.notifyEnabled !== false ? 'checked' : ''} />
              <span></span>
            </label>
          </div>
          <div class="sheet-item preference-item">
            <span class="preference-copy"><strong>Рост просмотров без имени</strong><span>Сообщать, если общий счётчик вырос, но Telegram не дал доступной личности зрителя.</span></span>
            <label class="switch">
              <input id="viewerGapSwitch" type="checkbox" data-viewer-pref="gap" ${viewerState.session?.preferences?.notifyAnonymousGap !== false ? 'checked' : ''} />
              <span></span>
            </label>
          </div>
          <div class="sheet-item"><strong>Защита подключения</strong><span>${viewerState.secureSessionCrypto ? 'Защищённое шифрование сессии активно' : 'Требуется обновление защиты подключения'}</span></div>
          <div class="sheet-item"><strong>Последнее обновление данных</strong><span>${viewerState.session.lastPollAt ? new Date(viewerState.session.lastPollAt).toLocaleString('ru-RU') : 'ещё не запускалась'}</span></div>
        </div>
        <div class="sheet-actions">
          <button data-sheet-action="viewer-disconnect">Отключить Telegram Account</button>
          <button data-sheet-action="close">Закрыть</button>
        </div>
      `);
      return;
    }

    if (viewerState.newConnectionsReady === false) {
      const storageUnavailable = viewerState.storageStatus === 'unavailable';
      openSheet(`
        <span class="kicker">${storageUnavailable ? 'VETOGRAM · СЕРВЕР' : 'SECURITY'}</span>
        <h2>${storageUnavailable ? 'Хранилище временно недоступно' : 'Новое подключение приостановлено'}</h2>
        <p>${storageUnavailable
          ? 'Сервер архива и сессий не отвечает. Это не значит, что ты вышел из Telegram. Существующие подключения и архивы не удалены; дождись восстановления сервера, не запрашивай новый код.'
          : 'Vetogram не создаст приватное подключение, пока защищённое хранилище не подтверждено.'}</p>
        <div class="sheet-list">
          <div class="sheet-item"><strong>Stories & Privacy</strong><span>${storageUnavailable ? 'Доступность зависит от состояния серверного хранилища.' : 'Некоторые функции работают независимо.'}</span></div>
          <div class="sheet-item"><strong>Existing Intelligence</strong><span>Существующая сессия, если она есть, не отключается автоматически.</span></div>
          <div class="sheet-item"><strong>New private session</strong><span>Создание заблокировано, пока защита не готова.</span></div>
        </div>
        <div class="sheet-actions">
          <button class="accent" data-sheet-action="viewer-refresh-security">Проверить снова</button>
          <button data-sheet-action="close">Закрыть</button>
        </div>
      `);
      return;
    }

    openSheet(`
      <span class="kicker">ШАГ 1 ИЗ 2 · ПОДКЛЮЧЕНИЕ</span>
      <h2>Подключить Telegram</h2>
      <p>Выбери способ, который подходит твоему устройству. На одном телефоне проще номер + код; QR удобен со вторым экраном.</p>
      ${pendingLoginMarkup()}
      <div class="connection-methods-simple">
        <button class="connection-method-card recommended" data-sheet-action="viewer-use-phone">
          <span class="method-icon">1</span>
          <div><strong>Номер + код Telegram</strong><small>Самый простой способ на текущем телефоне.</small></div>
          <em>Рекомендуем</em>
        </button>
        <button class="connection-method-card" data-sheet-action="viewer-start-qr">
          <span class="method-icon">⌁</span>
          <div><strong>QR‑код</strong><small>Если рядом есть Telegram Desktop или второй телефон.</small></div>
          <em>Второй экран</em>
        </button>
      </div>
      <p class="auth-security-note">Код и 2FA‑пароль не сохраняются. После входа хранится только зашифрованная сессия.</p>
      <div class="sheet-actions"><button data-sheet-action="close">Отмена</button></div>
    `);
  }

  function showViewerAuthError(error) {
    const message = String(error?.message || error || 'Не удалось войти в Telegram');
    const slot = $('viewerAuthError');
    if (slot) {
      slot.textContent = message;
      slot.hidden = false;
      // 409 means an existing *server-side* Telegram challenge is still
      // active. Never turn it into an automatic second SendCode request.
      const pending = error?.viewerData?.loginPending;
      if (pending && ['code','password','qr_password'].includes(pending.stage)
          && Date.parse(pending.expiresAt||'') > Date.now()) {
        viewerState.loginPending={stage:pending.stage,expiresAt:pending.expiresAt};
        $('viewerAuthRecovery')?.remove();
        const controls=document.createElement('div');
        controls.id='viewerAuthRecovery';
        controls.className='sheet-actions viewer-auth-recovery';
        const resume=document.createElement('button');
        resume.type='button';
        resume.dataset.sheetAction='viewer-resume-login';
        resume.textContent='Продолжить начатый вход';
        const cancel=document.createElement('button');
        cancel.type='button';
        cancel.dataset.sheetAction='viewer-cancel-login';
        cancel.textContent='Отменить запрос и сменить номер';
        controls.append(resume,cancel);
        slot.insertAdjacentElement('afterend',controls);
      }
    } else {
      showToast(message);
    }
    notify('error');
  }

  async function runViewerAuthAction(button, task) {
    if (viewerAuthBusy) return;
    viewerAuthBusy = true;
    const previous = button?.textContent || '';
    if (button) {
      button.disabled = true;
      button.textContent = 'Подключаем…';
    }
    try {
      await task();
    } catch (error) {
      showViewerAuthError(error);
    } finally {
      viewerAuthBusy = false;
      if (button?.isConnected) {
        button.disabled = false;
        button.textContent = previous;
      }
    }
  }

  function viewerPhoneSheet() {
    openSheet(`
      <span class="kicker">ПОДКЛЮЧЕНИЕ TELEGRAM</span>
      <div class="veto-login-stage" aria-label="Этап подключения"><span class="active">1 · Номер</span><span>2 · Код</span><span>3 · 2FA, если нужно</span></div>
      <h2>Введи номер Telegram</h2>
      <p>Укажи тот номер, на который зарегистрирован твой Telegram. Мы попросим Telegram отправить код подтверждения.</p>
      <div class="auth-form">
        <div class="auth-field">
          <label for="viewerPhone">Номер Telegram</label>
          <button type="button" class="veto-country-trigger" id="viewerCountryTrigger"
            aria-expanded="false" aria-haspopup="dialog" aria-controls="viewerCountryPicker">🌐 Выбрать страну</button>
          <div class="veto-country-picker" id="viewerCountryPicker" role="dialog"
            aria-label="Выбрать страну для номера Telegram" hidden>
            <label for="viewerCountrySearch">Поиск по стране или коду</label>
            <input id="viewerCountrySearch" type="search" autocomplete="off"
              placeholder="Армения, Россия, +971…" aria-label="Поиск страны" />
            <div id="viewerCountryOptions" class="veto-country-options" role="listbox"
              aria-label="Страны и телефонные коды"></div>
            <p>Страны с общим кодом, например +7, можно выбрать вручную. Отправку кода выполняет Telegram.</p>
          </div>
          <input id="viewerPhone" type="tel" inputmode="tel" autocomplete="tel"
            aria-describedby="viewerPhoneHint" placeholder="+374 99 123 456"
            value="${escapeHtml(viewerPendingPhone)}" />
        </div>
        <div class="auth-help" id="viewerPhoneHint">Выбери страну или введи полный номер с +. Код отправляет Telegram, а не бот Vetogram. Его доставка в приложение или SMS зависит от Telegram.</div>
      </div>
      <p class="auth-error" id="viewerAuthError" role="alert" hidden></p>
      <div class="sheet-actions">
        <button class="accent" data-sheet-action="viewer-send-code">Получить код</button>
        <button data-sheet-action="viewer-start-qr">Войти через QR со второго устройства</button>
        <button data-sheet-action="viewer-back-setup">Назад</button>
      </div>
    `);
    window.VetogramCountryPicker?.mount();
  }

  function viewerEmailSheet() {
    openSheet(`<span class="kicker">ПОДКЛЮЧЕНИЕ TELEGRAM</span><h2>Telegram запрашивает email для входа</h2>
      <p>Адрес будет привязан к входу в Telegram. Укажи свой email только если согласен. Это запрос Telegram, а не подписка VETOGRAM.</p>
      <label class="auth-field">Email<input id="viewerLoginEmail" type="email" autocomplete="email" maxlength="254"></label>
      <p class="auth-error" id="viewerAuthError" role="alert" hidden></p>
      <div class="sheet-actions"><button class="accent" data-sheet-action="viewer-send-email">Согласен, получить email-код</button><button data-sheet-action="viewer-start-qr">Использовать QR</button><button data-sheet-action="close">Позже</button></div>`);
  }

  let viewerCodeDelivery='unknown';
  function viewerCodeSheet(delivery, reused = false) {
    if (delivery === 'email_setup') { viewerEmailSheet(); return; }
    // Missing delivery metadata is not evidence of Telegram-app delivery.
    viewerCodeDelivery=delivery || 'unknown';
    delivery=viewerCodeDelivery;
    const emailCode = delivery === 'email_code' || delivery === 'email_setup_code';
    openSheet(`
      <span class="kicker">ПОДКЛЮЧЕНИЕ TELEGRAM</span>
      <div class="veto-login-stage" aria-label="Этап подключения"><span class="done">✓ Номер</span><span class="active">2 · Код</span><span>3 · 2FA, если нужно</span></div>
      <h2>${emailCode?'Введи код из email':'Теперь введи код из Telegram'}</h2>
      <p>${emailCode ? 'Telegram указал email как способ подтверждения. Введи код, если он пришёл; Vetogram не сохраняет код.' : reused ? 'Предыдущий запрос ещё действует: новый код не отправлялся.' : delivery === 'telegram_app' ? 'Telegram принял запрос и указал доставку кода в приложение. Получение кода на устройстве не подтверждено.' : 'Запрос принят Telegram; способ доставки выбирает сам Telegram. Фактическое получение кода ещё не подтверждено.'}${emailCode?'':' Проверь официальный чат «Telegram» на своих авторизованных устройствах. Не запрашивай повторно без необходимости.'}</p>
      <div class="auth-form">
        <div class="auth-field">
          <label for="viewerCode">Код</label>
          <input id="viewerCode" type="text" inputmode="numeric" autocomplete="one-time-code" placeholder="12345" maxlength="8" />
        </div>
      </div>
      <p class="auth-error" id="viewerAuthError" role="alert" hidden></p>
      <div class="sheet-actions">
        <button class="accent" data-sheet-action="viewer-verify-code">Подтвердить</button>
        <button data-sheet-action="viewer-code-help">Код не пришёл?</button>
        <button data-sheet-action="viewer-start-qr">QR-вход со второго устройства</button>
        <button data-sheet-action="close">Закрыть (вход сохранится)</button>
      </div>
    `);
  }

  function viewerNoCodeSheet() {
    if (['email_code','email_setup_code'].includes(viewerCodeDelivery)) {
      openSheet(`<span class="kicker">EMAIL-КОД TELEGRAM</span><h2>Проверь почту для входа в Telegram</h2>
        <p>Проверь входящие и спам своего email. Код отправляет Telegram. Не пересылай его в чаты. Если почта недоступна, используй QR с уже авторизованного устройства.</p>
        <div class="sheet-actions"><button class="accent" data-sheet-action="viewer-back-code">У меня есть код</button><button data-sheet-action="viewer-start-qr">Использовать QR</button><button data-sheet-action="close">Позже</button></div>`);
      return;
    }
    openSheet(`
      <span class="kicker">ПОМОЩЬ · КОД TELEGRAM</span>
      <h2>Код не приходит?</h2>
      <div class="sheet-list">
        <div class="sheet-item"><strong>1 · Проверь официальный чат «Telegram»</strong><span>Открой поиск Telegram, введи Telegram и найди сервисный аккаунт с синей галочкой. Это не чат нашего бота и не раздел SMS.</span></div>
        <div class="sheet-item"><strong>2 · Проверь другие свои устройства</strong><span>Telegram нередко присылает код на уже авторизованный телефон или компьютер вместо SMS.</span></div>
        <div class="sheet-item"><strong>3 · Не запрашивай код много раз</strong><span>Повторные запросы могут аннулировать предыдущий код и вызвать ограничение Telegram. Если есть второй экран, попробуй QR-вход.</span></div>
      </div>
      <p class="auth-security-note">Никогда не пересылай код другим людям. Vetogram не умеет доставить код вручную: способ выбирает Telegram.</p>
      <div class="sheet-actions">
        <button class="accent" data-sheet-action="viewer-back-code">У меня есть код</button>
        <button data-sheet-action="viewer-start-qr">Подключить через QR</button>
        <button data-sheet-action="viewer-cancel-login">Отменить запрос и сменить номер</button>
      </div>
    `);
  }

  function viewerPasswordSheet(hint = '') {
    openSheet(`
      <span class="kicker">ДОПОЛНИТЕЛЬНАЯ ЗАЩИТА TELEGRAM</span>
      <div class="veto-login-stage" aria-label="Этап подключения"><span class="done">✓ Номер</span><span class="done">✓ Код</span><span class="active">3 · 2FA</span></div>
      <h2>У тебя включён 2FA‑пароль</h2>
      <p>Пароль передаётся Telegram только для завершения входа и не сохраняется Vetogram.${hint ? ` Подсказка: ${escapeHtml(hint)}` : ''}</p>
      <div class="auth-form">
        <div class="auth-field">
          <label for="viewerPassword">Telegram 2FA</label>
          <input id="viewerPassword" type="password" autocomplete="current-password" placeholder="Пароль" />
        </div>
      </div>
      <p class="auth-error" id="viewerAuthError" role="alert" hidden></p>
      <div class="sheet-actions">
        <button class="accent" data-sheet-action="viewer-verify-password">Подключить</button>
        <button data-sheet-action="close">Отмена</button>
      </div>
    `);
  }

  function viewerQrSheet() {
    openSheet(`
      <span class="kicker">ПОДКЛЮЧЕНИЕ ЧЕРЕЗ QR</span>
      <h2>Отсканируй QR со второго экрана</h2>
      <p>Открой Telegram на телефоне → Settings → Devices → Link Desktop Device и отсканируй QR. Если Vetogram открыт на этом же телефоне, проще вернуться и выбрать номер + код.</p>
      <div class="viewer-qr-card">
        <div class="viewer-qr-frame">
          <div class="viewer-qr-loader" id="viewerQrLoader">⌁</div>
          <img id="viewerQrImage" alt="Telegram login QR" hidden />
        </div>
        <strong id="viewerQrStatus">Создаю безопасный QR…</strong>
        <span id="viewerQrMeta">Не закрывай этот экран до подтверждения.</span>
      </div>
      <div class="sheet-actions">
        <button class="accent" id="viewerQrOpenButton" data-sheet-action="viewer-open-qr" disabled>Открыть в Telegram</button>
        <button data-sheet-action="viewer-use-phone">Номер и код</button>
        <button data-sheet-action="close">Отмена</button>
      </div>
      <p class="auth-security-note">После подтверждения сохраняется только зашифрованное подключение. QR-код и его временный токен не сохраняются.</p>
    `);
  }

  function updateViewerQr(event) {
    if (!event || $('sheet')?.hidden) return;
    const image = $('viewerQrImage');
    const loader = $('viewerQrLoader');
    const status = $('viewerQrStatus');
    const meta = $('viewerQrMeta');
    const openButton = $('viewerQrOpenButton');

    if (event.type === 'qr') {
      if (image && event.qrDataUrl) {
        image.src = event.qrDataUrl;
        image.hidden = false;
      }
      if (loader) loader.hidden = true;
      if (status) status.textContent = 'QR готов';
      if (meta) meta.textContent = 'Telegram → Settings → Devices → Link Desktop Device, либо открой подтверждение кнопкой.';
      if (openButton) {
        openButton.disabled = false;
        openButton.dataset.qrUri = event.uri || '';
      }
      haptic();
      return;
    }

    if (event.type === 'expired') {
      if (status) status.textContent = 'QR истёк';
      if (meta) meta.textContent = event.error || 'Создай новый QR.';
      if (openButton) {
        openButton.disabled = false;
        openButton.textContent = 'Создать новый QR';
        openButton.dataset.sheetAction = 'viewer-start-qr';
        delete openButton.dataset.qrUri;
      }
      return;
    }

    if (event.type === 'error') {
      if (status) status.textContent = 'Не удалось подключить';
      if (meta) meta.textContent = event.error || 'Повтори попытку.';
      if (openButton) {
        openButton.disabled = false;
        openButton.textContent = 'Повторить';
        openButton.dataset.sheetAction = 'viewer-start-qr';
        delete openButton.dataset.qrUri;
      }
    }
  }

  async function startViewerQrLogin() {
    if (!tg?.initData) {
      showToast('Открой Vetogram внутри Telegram');
      return;
    }
    if (viewerState.newConnectionsReady === false) {
      viewerSetupSheet();
      return;
    }

    if (viewerQrAbortController) viewerQrAbortController.abort();
    viewerQrAbortController = new AbortController();
    const controller = viewerQrAbortController;
    viewerQrSheet();

    try {
      const response = await fetch('/api/viewer-qr', {
        method: 'POST',
        headers: {
          'x-telegram-init-data': tg.initData,
          'content-type': 'application/json',
        },
        body: '{}',
        signal: controller.signal,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'QR-подключение временно недоступно');
      }
      if (!response.body) throw new Error('Streaming login недоступен в этом WebView');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let finished = false;

      while (!finished) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          let event;
          try { event = JSON.parse(line); } catch { continue; }

          if (event.type === 'connected') {
            finished = true;
            viewerQrAbortController = null;
            closeSheet();
            notify('success');
            showToast('Telegram подключён через QR');
            await refreshViewerSync({ silent: true });
            await refresh();
            await refreshViewerAnalytics({ silent: true });
            switchScreen('telegram');
            // Business access is a separate, explicit opt-in from Privacy.
            break;
          }

          if (event.type === 'password_required') {
            finished = true;
            viewerQrAbortController = null;
            viewerPasswordSheet(event.hint || '');
            break;
          }

          updateViewerQr(event);
        }
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      updateViewerQr({ type:'error', error:error.message });
    } finally {
      if (viewerQrAbortController === controller) viewerQrAbortController = null;
    }
  }

  function viewerStorySheet() {
    const history = (state.history || []).filter(item => !item.deleted).slice(0, 20);
    const items = history.length
      ? history.map(item => `<button data-viewer-story="${item.id}">Story #${item.id} · ${audienceLabel(item.audience)} · ${formatDate(item.ts)}</button>`).join('')
      : '<div class="sheet-item"><strong>Нет Stories</strong><span>Сначала опубликуй Story через Vetogram.</span></div>';

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
    if (!storyId || !telegramAccountReady()) return;
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
  $('vetoNavHome')?.addEventListener('click',()=>switchScreen('home'));

  document.querySelectorAll('[data-open-screen]').forEach(button => {
    button.addEventListener('click', () => switchScreen(button.dataset.openScreen));
  });
  $('vetoHomeConnectPrimary')?.addEventListener('click', () => {
    void window.VetoTelegramOpenAccountConnection?.();
  });
  $('homeActivityList')?.addEventListener('click', event => {
    const row = event.target.closest('[data-activity-screen]');
    if (!row) return;
    if (row.dataset.activityScreen === 'security') {
      securityCenterSheet();
      return;
    }
    switchScreen(row.dataset.activityScreen);
  });
  async function runActivationAction(action) {
    if (action === 'telegram') {
      connectionHelpSheet();
      return;
    }
    if (action === 'ghost') {
      featureGuideSheet('privacy');
      return;
    }
    if (action === 'story') {
      switchScreen('publish');
      setTimeout(() => $('storyFileInput')?.click(), 160);
      return;
    }
    if (action === 'intelligence') {
      featureGuideSheet('intelligence');
      return;
    }
    if (action === 'features') {
      allFeaturesSheet();
      return;
    }
    if (action === 'automations') {
      featureGuideSheet('automations');
    }
  }

  document.querySelectorAll('[data-feature-help]').forEach(button => {
    button.addEventListener('click', () => featureGuideSheet(button.dataset.featureHelp));
  });
  $('explainAllFeaturesButton')?.addEventListener('click', allFeaturesSheet);

  document.querySelectorAll('[data-activation-step]').forEach(button => {
    button.addEventListener('click', () => runActivationAction(button.dataset.activationStep));
  });
  $('activationPrimaryButton')?.addEventListener('click', () => {
    runActivationAction($('activationPrimaryButton')?.dataset?.activationAction || 'telegram');
  });
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
      <p>Вставь @username через пробел, запятую или с новой строки. До 100 человек — без выхода из Vetogram.</p>
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
      <p>Вставь @username. Если выбран другой режим, Vetogram сам переключит аудиторию на «Контакты». Всё остаётся внутри приложения.</p>
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
  $('connectTelegramButton')?.addEventListener('click', async () => {
    // A returning user may have closed Telegram's WebView to copy a login code.
    // Load the server-side pending challenge before showing the onboarding menu.
    if (!viewerState.session?.connected && !state.accountConnection?.connected) {
      await refreshViewerSync({ silent: true });
    }
    const connected = viewerState.session?.connected === true || state.accountConnection?.connected === true;
    connected ? profileSheet() : connectionHelpSheet();
  });
  $('privacyPromiseButton')?.addEventListener('click', privacyPromiseSheet);
  $('vetoWelcomeSkip')?.addEventListener('click', () => closeVetoWelcome());
  $('vetoWelcomeExplore')?.addEventListener('click', () => {
    renderVetoWelcomeStep(1);
    if($('vetoWelcomeExplore'))$('vetoWelcomeExplore').hidden=true;
  });
  // Let a new customer choose live Telegram vs independent Anti-Delete before
  // seeing the Stories-first activation wizard. No permissions are granted here.
  document.querySelectorAll('[data-veto-start-action]').forEach(button => {
    button.addEventListener('click', () => {
      const destination = button.dataset.vetoStartAction === 'archive' ? 'privacy' : 'telegram';
      if (!$('vetoWelcome')?.hidden) closeVetoWelcome();
      switchScreen(destination);
      if(destination==='telegram'&&!viewerState.session?.connected&&!state.accountConnection?.connected)
        setTimeout(()=>{if(currentScreen==='telegram')void window.VetoTelegramOpenAccountConnection?.();},140);
    });
  });
  $('vetoWelcomeNext')?.addEventListener('click', () => {
    haptic();
    if (vetoWelcomeStep > 0 && vetoWelcomeStep < 3) {
      renderVetoWelcomeStep(vetoWelcomeStep + 1);
      return;
    }
    closeVetoWelcome();
    switchScreen('telegram');
    if (viewerState.session?.connected !== true &&
        state.accountConnection?.connected !== true) {
      setTimeout(()=>{ if(currentScreen==='telegram')void window.VetoTelegramOpenAccountConnection?.(); },140);
    }
  });
  $('viewerSetupButton').addEventListener('click', viewerSetupSheet);
  $('viewerStoryPicker').addEventListener('click', viewerStorySheet);

  $('quickPrimaryButton').addEventListener('click', async () => {
    const connected = viewerState.session?.connected === true;
    const item = activeStoryHistory()[0] || null;

    if (!telegramAccountReady()) {
      try {
        await api('check');
        if (telegramAccountReady()) {
          showToast('Telegram подключён');
        } else {
          connectionHelpSheet();
        }
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
      showToast('Сначала подключи Аналитика аудитории');
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
      showToast('Сначала подключи Аналитика аудитории');
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
  document.addEventListener('keydown',event=>{
    if(event.key!=='Escape'||$('sheet').hidden)return;
    // The country list has its own Escape action. Close that list first,
    // never dismiss the entire authorization flow on the same key press.
    if ($('viewerCountryPicker')?.hidden===false)return;
    event.preventDefault();
    closeSheet();
  });

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
    const actionTarget = event.target?.closest?.('[data-sheet-action]') || event.target;
    const action = actionTarget?.dataset?.sheetAction;
    const storyId = actionTarget?.dataset?.viewerStory;
    if (action === 'close') closeSheet();
    if (action === 'check') {
      closeSheet();
      await refresh();
      if (!state.ready) setTimeout(connectionHelpSheet, 120);
    }
    if (action === 'go-ghost') {
      closeSheet();
      switchScreen('privacy');
    }
    if (action === 'privacy-promise') {
      privacyPromiseSheet();
      return;
    }
    if (action === 'feature-help') {
      featureGuideSheet(actionTarget?.dataset?.featureKey || '');
      return;
    }
    if (action === 'all-features') {
      allFeaturesSheet();
      return;
    }
    if (action === 'feature-open') {
      const featureScreen = actionTarget?.dataset?.featureScreen || '';
      closeSheet();
      if (featureScreen === 'security') {
        setTimeout(securityCenterSheet, 80);
        return;
      }
      if (featureScreen === 'automations') {
        setTimeout(() => automationCenterSheet(), 80);
        return;
      }
      switchScreen(featureScreen);
      return;
    }
    if (action === 'go-stories') {
      closeSheet();
      switchScreen('publish');
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
        await api('set_selected', { usernames });
        closeSheet();
        showToast(usernames.length ? `${usernames.length} пользователей сохранено` : 'Список очищен');
      } catch (error) {
        showToast(error.message);
      }
    }
    if (action === 'save-excluded') {
      const usernames = parseUsernameInput($('excludedUsernames')?.value || '');
      try {
        await api('set_excluded', { usernames });
        closeSheet();
        showToast(usernames.length ? `${usernames.length} исключений сохранено` : 'Исключения очищены');
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
    if (action === 'account-connect') {
      connectionHelpSheet();
      return;
    }
    if (action === 'business-help') {
      businessConnectionHelpSheet();
      return;
    }
    if (action === 'viewer-start-qr') {
      await startViewerQrLogin();
      return;
    }
    if (action === 'viewer-open-qr') {
      const uri = actionTarget?.dataset?.qrUri || '';
      if (uri) {
        try {
          window.location.href = uri;
        } catch {
          showToast('Открой QR через Telegram → Settings → Devices');
        }
      }
      return;
    }
    if (action === 'viewer-resume-login') {
      const pending = viewerState.loginPending;
      if (pending && Date.parse(pending.expiresAt || '') > Date.now()) {
        if (['password', 'qr_password'].includes(pending.stage)) viewerPasswordSheet();
        else viewerCodeSheet(pending.delivery || 'unknown');
      } else {
        await refreshViewerSync({ silent: true });
        connectionHelpSheet();
      }
      return;
    }
    if (action === 'viewer-code-help') {
      viewerNoCodeSheet();
      return;
    }
    if (action === 'viewer-back-code') {
      viewerCodeSheet(viewerCodeDelivery);
      return;
    }
    if (action === 'viewer-cancel-login') {
      await runViewerAuthAction(actionTarget, async () => {
        await viewerApi('cancel_login', {}, null);
        viewerState.loginPending = null;
        viewerPhoneSheet();
      });
      return;
    }
    if (action === 'viewer-use-phone') {
      if (viewerQrAbortController) {
        viewerQrAbortController.abort();
        viewerQrAbortController = null;
      }
      viewerPhoneSheet();
      return;
    }
    if (action === 'viewer-back-setup') {
      viewerSetupSheet();
      return;
    }
    if (action === 'open-automations') {
      await automationCenterSheet();
      return;
    }
    if (action === 'automation-refresh') {
      await automationCenterSheet({ refresh:true });
      return;
    }
    if (action === 'automation-preset') {
      const preset = String(actionTarget?.dataset?.automationPreset || '');
      if (!preset || automationState.busy) return;
      try {
        automationState.busy = true;
        const data = await automationsApi('apply_preset', { preset });
        automationState.rules = data.settings?.rules || automationState.rules;
        automationState.jobs = Array.isArray(data.jobs) ? data.jobs : automationState.jobs;
        automationState.loaded = true;
        haptic();
        showToast(preset === 'quiet' ? 'Quiet mode включён' : preset === 'smart' ? 'Smart mode включён' : 'Full automation включена');
      } catch (error) {
        showToast(error.message);
        notify('error');
      } finally {
        automationState.busy = false;
      }
      renderAutomationCenterSheet();
      return;
    }
    if (action === 'automation-toggle') {
      const ruleKey = String(actionTarget?.dataset?.automationRule || '');
      const current = actionTarget?.dataset?.automationEnabled === '1';
      if (!ruleKey || automationState.busy) return;
      try {
        automationState.busy = true;
        const data = await automationsApi('update_rule', {
          ruleKey,
          enabled: !current,
        });
        automationState.rules = data.settings?.rules || automationState.rules;
        automationState.jobs = Array.isArray(data.jobs) ? data.jobs : automationState.jobs;
        automationState.loaded = true;
        haptic();
        showToast(!current ? 'Automation включена' : 'Automation выключена');
      } catch (error) {
        showToast(error.message);
        notify('error');
      } finally {
        automationState.busy = false;
      }
      renderAutomationCenterSheet();
      return;
    }
    if (action === 'open-security') {
      securityCenterSheet();
      return;
    }
    if (action === 'open-connections') {
      profileSheet();
      return;
    }
    if (action === 'viewer-refresh-security') {
      await refreshViewerSync({ silent: false });
      securityCenterSheet();
      return;
    }
    if (action === 'viewer-send-code') {
      const phone = ($('viewerPhone')?.value || '').trim();
      await runViewerAuthAction(actionTarget, async () => {
        if (!/^\+[\d\s()-]{7,24}$/.test(phone)) {
          throw new Error('Введи номер с кодом страны, например +374…');
        }
        const data = await viewerApi('send_code', { phone }, null);
        viewerPendingPhone = phone;
        // The server persisted this challenge. Keep local state in sync so
        // returning from the sheet offers "Resume code", not another send.
        viewerState.loginPending = {
          stage:'code', delivery:data.delivery || 'unknown',
          expiresAt:data.expiresAt || null,
        };
        viewerCodeSheet(data.delivery, data.reused === true);
      });
      return;
    }
    if (action === 'viewer-send-email') {
      const email=$('viewerLoginEmail')?.value || '';
      await runViewerAuthAction(actionTarget,async()=>{
        const data=await viewerApi('send_login_email',{email},null);
        if($('viewerLoginEmail'))$('viewerLoginEmail').value='';
        viewerCodeSheet(data.delivery);
      });return;
    }
    if (action === 'viewer-verify-code') {
      const code = ($('viewerCode')?.value || '').trim();
      await runViewerAuthAction(actionTarget, async () => {
        if (!/^\d{3,8}$/.test(code)) throw new Error('Проверь код из Telegram');
        const data = await viewerApi('verify_code', { code }, null);
        if ($('viewerCode')) $('viewerCode').value='';
        if (data.nextCode) {
          viewerState.loginPending = { ...(viewerState.loginPending||{}),
            stage:'code', delivery:data.delivery||'unknown' };
          viewerCodeSheet(data.delivery);
        } else if (data.needsPassword) {
          viewerState.loginPending = { ...(viewerState.loginPending||{}), stage:'password' };
          viewerPasswordSheet();
        } else {
          closeSheet();
          viewerPendingPhone = '';
          viewerState.loginPending = null;
          notify('success');
          showToast('Telegram успешно подключён');
          await refreshViewerSync({ silent: true });
          // Refresh the account/Stories state too; a connected session does not
          // immediately appear otherwise for users without Telegram Business.
          await refresh();
          await refreshViewerAnalytics({ silent: true });
          switchScreen('telegram');
          // No unsolicited Business permission wizard after login.
        }
      });
      return;
    }
    if (action === 'viewer-verify-password') {
      const password = $('viewerPassword')?.value || '';
      await runViewerAuthAction(actionTarget, async () => {
        if (!password) throw new Error('Введи пароль двухэтапной проверки Telegram');
        await viewerApi('verify_password', { password }, null);
        if ($('viewerPassword')) $('viewerPassword').value='';
        closeSheet();
        viewerPendingPhone = '';
        viewerState.loginPending = null;
        notify('success');
        showToast('Telegram успешно подключён');
        await refreshViewerSync({ silent: true });
        await refresh();
        await refreshViewerAnalytics({ silent: true });
        switchScreen('telegram');
        // Optional Business access starts only from Privacy after explicit consent.
      });
      return;
    }
    if (action === 'security-revoke-session') {
      try {
        await viewerApi('disconnect', {}, null);
        viewerState = {
          configured: true,
          backgroundReady: viewerState.backgroundReady,
          newConnectionsReady: viewerState.newConnectionsReady,
          secureSessionCrypto: viewerState.secureSessionCrypto,
          session: null,
          story: null,
          viewers: [],
          analytics: null,
          degraded: false,
          error: null,
        };
        render();
        showToast('Приватная session отозвана');
        await api().catch(() => {});
        securityCenterSheet();
      } catch (error) {
        showToast(error.message);
      }
      return;
    }

    if (action === 'viewer-disconnect') {
      try {
        await viewerApi('disconnect', {}, null);
        closeSheet();
        viewerState = {
          configured: true,
          backgroundReady: viewerState.backgroundReady,
          newConnectionsReady: viewerState.newConnectionsReady,
          secureSessionCrypto: viewerState.secureSessionCrypto,
          session: null,
          story: null,
          viewers: [],
          analytics: null,
          degraded: false,
          error: null,
        };
        renderViewers();
        await refresh().catch(() => {});
        showToast('Telegram Account отключён');
        // After a mismatched account is removed, immediately offer the
        // owner a fresh, consent-based connection rather than a dead end.
        connectionHelpSheet();
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
        <div class="sheet-item"><strong>Исключено</strong><span>${story.countsKnown === false ? '— · старый архив' : `${story.excluded || 0} пользователей`}</span></div>
        <div class="sheet-item"><strong>Выбрано</strong><span>${story.countsKnown === false ? '— · старый архив' : `${story.selected || 0} пользователей`}</span></div>
        <div class="sheet-item"><strong>Статус</strong><span>${story.deleted ? 'Удалена' : 'Опубликована'}</span></div>
        ${story.lastSyncAt ? `<div class="sheet-item"><strong>Аналитика аудитории</strong><span>${Number(story.views || 0)} views · ${Number(story.identified || 0)} identified · ${Number(story.reactions || 0)} reactions</span></div>` : ''}
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
    if (!telegramAccountReady()) {
      showToast('Сначала подключи Telegram');
      connectionHelpSheet();
      return;
    }
    $('storyFileInput').click();
  });

  $('storyFileInput').addEventListener('change', event => {
    prepareComposerFile(event.target.files?.[0] || null);
  });
  // Story Engine emits this only after the real file input change. Bind the
  // opt-in link to that exact pending JPEG generation and signed user.
  window.addEventListener('veto:portal-handoff',()=>{
    const candidate=window.VetoTelegramPortalHandoff;
    window.VetoTelegramPortalHandoff=null;
    clearComposerPortal();
    const signed=String(tg?.initData||'');
    const user=String(tg?.initDataUnsafe?.user?.id||'');
    if(state.processing || !signed||!/^\d{1,20}$/.test(user)||
       !candidate||String(candidate.ownerId)!==user ||
       !composerPendingFileName||composerPendingFileName!=='vetogram-story.jpg')return;
    try{
      const url=new URL(String(candidate.url||''));
      if(String(candidate.url||'').length>1900 ||
         url.origin!==window.location.origin || url.pathname!=='/portal.html' ||
         url.search || url.username || url.password ||
         !/^#p=[A-Za-z0-9_-]{1,5000}$/.test(url.hash))return;
      composerPortalHandoff={
        url:url.toString(),signed,generation:composerGeneration,
        draftId:String(candidate.draftId||'')
      };
      syncComposerPortal();
    }catch{
      // Invalid/foreign links cannot be silently added to a Story.
    }
  });

  $('removeStoryMedia').addEventListener('click', () => resetComposer({ keepCaption: true }));

  $('storyCaption').addEventListener('input', event => {
    $('captionCounter').textContent = `${event.target.value.length} / 2048`;
    try {
      const key=captionDraftStorageKey();
      if(key)sessionStorage.setItem(key,event.target.value||'');
    } catch {}
  });

  $('mainButton').addEventListener('click', async () => {
    try {
      await publishComposerStory();
    } catch {}
  });
  window.addEventListener('focus',ensureComposerIdentity);
  window.addEventListener('pageshow',ensureComposerIdentity);

  try {
    tg?.ready();
    tg?.expand();
    tg?.setHeaderColor?.('#000000');
    tg?.setBackgroundColor?.('#000000');
    tg?.setBottomBarColor?.('#030303');
    tg?.disableVerticalSwipes?.();
    tg?.BackButton?.onClick(closeSheet);
  } catch {}

  try {
    sessionStorage.removeItem(DRAFT_CAPTION_KEY);
    const key=captionDraftStorageKey();
    const draftCaption=key?(sessionStorage.getItem(key)||''):'';
    if (draftCaption) {
      $('storyCaption').value = draftCaption.slice(0, 2048);
      $('captionCounter').textContent = `${$('storyCaption').value.length} / 2048`;
    }
  } catch {}

  function renderNetworkStatus() {
    const banner = $('networkBanner');
    if (!banner) return;
    const offline = navigator.onLine === false;
    banner.hidden = !offline;
    document.documentElement.classList.toggle('is-offline', offline);
  }

  window.addEventListener('online', () => {
    renderNetworkStatus();
    showToast('Соединение восстановлено');
    if (tg?.initData) {
      refresh();
      if (viewerState.session?.connected) refreshViewerSync({ silent:true });
    }
  });

  window.addEventListener('offline', () => {
    renderNetworkStatus();
    showToast('Нет интернета. Данные на экране сохранены.');
  });

  renderNetworkStatus();

  // Pointer spotlight is purely decorative. Do not recalculate two large
  // gradients on every mobile scroll/touch, or when reduced motion is requested.
  // Batch desktop movement into one visual update per animation frame.
  const finePointer = typeof window.matchMedia === 'function'
    && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const reducedSpotlightMotion = typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (finePointer && !reducedSpotlightMotion && typeof window.requestAnimationFrame === 'function') {
    let spotlightQueued = false;
    let spotlightX = 0;
    let spotlightY = 0;
    window.addEventListener('pointermove', event => {
      if (document.visibilityState === 'hidden') return;
      spotlightX = Math.max(0, Math.min(window.innerWidth, Number(event.clientX || 0)));
      spotlightY = Math.max(0, Math.min(window.innerHeight, Number(event.clientY || 0)));
      if (spotlightQueued) return;
      spotlightQueued = true;
      window.requestAnimationFrame(() => {
        spotlightQueued = false;
        if (document.visibilityState === 'hidden') return;
        document.body.style.setProperty('--veto-x', `${spotlightX}px`);
        document.body.style.setProperty('--veto-y', `${spotlightY}px`);
      });
    }, { passive:true });
  }

  window.addEventListener('unhandledrejection', event => {
    const message = event?.reason?.message || String(event?.reason || '');
    if (message) {
      console.warn('Vetogram unhandled rejection', message);
      showToast(message);
    }
  });

  window.addEventListener('error', event => {
    const message = event?.error?.message || event?.message || '';
    if (message) {
      console.warn('Vetogram UI error', message);
      showToast('Интерфейс восстановился после ошибки');
    }
  });

  setAvatar();
  render();
  // The Messenger is the primary destination. The owner-safe welcome overlay
  // remains visible until dismissed when this is a new installation.
  switchScreen(requestedScreen || 'telegram');

  if (!requestedScreen && !vetoWelcomeSeen()) {
    setTimeout(() => openVetoWelcome({ restart:true }), 90);
  }

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
    showToast('Открой Vetogram внутри Telegram для управления');
  }
})();
