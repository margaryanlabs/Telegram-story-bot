(() => {
  const tg = window.Telegram?.WebApp || null;
  const $ = id => document.getElementById(id);

  const studio = {
    assetDataUrl: '',
    assetMime: '',
    packName: '',
    packLink: '',
    style: 'brand',
    kind: 'custom_emoji',
    capabilities: null,
  };

  function toast(message) {
    const el = $('toast');
    if (!el) return;
    el.textContent = String(message || '');
    el.classList.add('show');
    clearTimeout(window.__ghostStudioToast);
    window.__ghostStudioToast = setTimeout(() => el.classList.remove('show'), 2800);
  }

  function haptic(type = 'light') {
    try { tg?.HapticFeedback?.impactOccurred(type); } catch {}
  }

  function notify(type = 'success') {
    try { tg?.HapticFeedback?.notificationOccurred(type); } catch {}
  }

  async function api(body = null) {
    if (!tg?.initData) throw new Error('Открой Ghost Mode внутри Telegram');
    const response = await fetch('/api/emoji-studio', {
      method: body ? 'POST' : 'GET',
      headers: {
        'x-telegram-init-data': tg.initData,
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.error || 'Ghost Studio error');
    return data;
  }

  function setBusy(value, label = '') {
    const buttons = [$('studioGenerateButton'), $('studioCreateButton'), $('studioAddButton')].filter(Boolean);
    buttons.forEach(button => { button.disabled = Boolean(value); });
    const status = $('studioStatus');
    if (status) {
      status.classList.toggle('busy', Boolean(value));
      if (label) status.textContent = label;
    }
  }

  function dataUrlFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Не удалось прочитать файл'));
      reader.readAsDataURL(file);
    });
  }

  function renderAsset() {
    const empty = $('studioAssetEmpty');
    const img = $('studioAssetImage');
    const video = $('studioAssetVideo');
    const meta = $('studioAssetMeta');
    const create = $('studioCreateButton');
    const add = $('studioAddButton');

    if (!studio.assetDataUrl) {
      if (empty) empty.hidden = false;
      if (img) img.hidden = true;
      if (video) video.hidden = true;
      if (meta) meta.textContent = 'Загрузи логотип или создай его по prompt';
      if (create) create.disabled = true;
      if (add) add.hidden = true;
      return;
    }

    if (empty) empty.hidden = true;
    if (studio.assetMime === 'video/webm') {
      if (img) img.hidden = true;
      if (video) {
        video.src = studio.assetDataUrl;
        video.hidden = false;
        video.play().catch(() => {});
      }
      if (meta) meta.textContent = 'WEBM · готов к Telegram video emoji/sticker';
    } else {
      if (video) video.hidden = true;
      if (img) {
        img.src = studio.assetDataUrl;
        img.hidden = false;
      }
      if (meta) meta.textContent = 'Изображение · Ghost Studio оптимизирует размер автоматически';
    }
    if (create) create.disabled = false;
    if (add) add.hidden = !studio.packName;
  }

  function renderKind() {
    document.querySelectorAll('[data-studio-kind]').forEach(button => {
      button.classList.toggle('active', button.dataset.studioKind === studio.kind);
    });
    const label = $('studioCreateButtonLabel');
    if (label) label.textContent = studio.kind === 'sticker' ? 'Создать Sticker Pack' : 'Создать Emoji Pack';
    const helper = $('studioKindHelper');
    if (helper) {
      helper.textContent = studio.kind === 'sticker'
        ? 'Telegram подготовит обычный sticker pack. Изображение будет приведено к 512×512.'
        : 'Custom Emoji для статуса, имени и сообщений. Изображение будет приведено к 100×100.';
    }
  }

  function renderStyle() {
    document.querySelectorAll('[data-studio-style]').forEach(button => {
      button.classList.toggle('active', button.dataset.studioStyle === studio.style);
    });
  }

  function renderCapabilities() {
    const ai = $('studioAiState');
    const motion = $('studioMotionState');
    if (ai) {
      ai.textContent = studio.capabilities?.aiImage
        ? `AI ready · ${studio.capabilities.aiModel || 'image model'}`
        : 'AI key required';
      ai.classList.toggle('ready', Boolean(studio.capabilities?.aiImage));
    }
    if (motion) motion.textContent = 'WEBM import ready';
  }

  async function loadCapabilities() {
    try {
      const data = await api();
      studio.capabilities = data.capabilities || {};
      renderCapabilities();
    } catch (error) {
      console.warn('Ghost Studio capabilities', error);
    }
  }

  async function handleAssetFile(file) {
    if (!file) return;
    const supported = ['image/png', 'image/jpeg', 'image/webp', 'video/webm'];
    if (!supported.includes(file.type)) throw new Error('Нужен PNG, JPG, WEBP или WEBM');
    const limit = file.type === 'video/webm' ? 256 * 1024 : 2.2 * 1024 * 1024;
    if (file.size > limit) {
      throw new Error(file.type === 'video/webm'
        ? 'WEBM должен быть до 256 KB'
        : 'Изображение должно быть до 2.2 MB');
    }
    studio.assetDataUrl = await dataUrlFromFile(file);
    studio.assetMime = file.type;
    renderAsset();
    haptic('medium');
  }

  async function generateAsset() {
    const prompt = String($('studioPrompt')?.value || '').trim();
    if (!prompt) {
      toast('Напиши prompt для emoji или загрузи свой логотип');
      return;
    }

    setBusy(true, 'Ghost AI создаёт основу…');
    try {
      const data = await api({
        action: 'generate_image',
        prompt,
        style: studio.style,
      });
      studio.assetDataUrl = data.assetDataUrl;
      studio.assetMime = 'image/webp';
      renderAsset();
      $('studioStatus').textContent = 'Основа готова. Можно сразу создать Telegram pack.';
      notify('success');
    } catch (error) {
      $('studioStatus').textContent = error.message;
      toast(error.message);
      notify('error');
    } finally {
      setBusy(false);
    }
  }

  async function publishPack(add = false) {
    if (!studio.assetDataUrl) {
      toast('Сначала загрузи или создай asset');
      return;
    }

    const title = String($('studioPackTitle')?.value || '').trim() || 'Ghost Brand Pack';
    const shortBase = String($('studioShortName')?.value || '').trim() || title;
    const emoji = String($('studioEmoji')?.value || '').trim() || '✨';

    setBusy(true, add ? 'Добавляю в Telegram pack…' : 'Создаю Telegram pack…');
    try {
      const data = await api({
        action: add ? 'add_to_pack' : 'create_pack',
        kind: studio.kind,
        assetDataUrl: studio.assetDataUrl,
        title,
        shortBase,
        emoji,
        existingName: add ? studio.packName : '',
        keywords: ['brand', 'ghost', 'telegram'],
      });
      studio.packName = data.pack?.name || studio.packName;
      studio.packLink = data.pack?.link || studio.packLink;

      const result = $('studioResult');
      const resultTitle = $('studioResultTitle');
      const resultText = $('studioResultText');
      const open = $('studioOpenPackButton');
      if (result) result.hidden = false;
      if (resultTitle) resultTitle.textContent = data.pack?.added ? 'Добавлено в пакет' : 'Telegram pack создан';
      if (resultText) resultText.textContent = studio.packName;
      if (open) open.dataset.link = studio.packLink;
      if ($('studioAddButton')) $('studioAddButton').hidden = false;
      $('studioStatus').textContent = 'Готово. Добавляй новые элементы в тот же бренд-пак.';
      notify('success');
    } catch (error) {
      $('studioStatus').textContent = error.message;
      toast(error.message);
      notify('error');
    } finally {
      setBusy(false);
    }
  }

  function bind() {
    document.querySelectorAll('[data-studio-kind]').forEach(button => {
      button.addEventListener('click', () => {
        studio.kind = button.dataset.studioKind || 'custom_emoji';
        renderKind();
        haptic();
      });
    });

    document.querySelectorAll('[data-studio-style]').forEach(button => {
      button.addEventListener('click', () => {
        studio.style = button.dataset.studioStyle || 'brand';
        renderStyle();
        haptic();
      });
    });

    $('studioUploadButton')?.addEventListener('click', () => $('studioFileInput')?.click());
    $('studioAssetEmpty')?.addEventListener('click', () => $('studioFileInput')?.click());
    $('studioFileInput')?.addEventListener('change', async event => {
      try {
        await handleAssetFile(event.target.files?.[0] || null);
      } catch (error) {
        toast(error.message);
      } finally {
        event.target.value = '';
      }
    });

    $('studioGenerateButton')?.addEventListener('click', generateAsset);
    $('studioCreateButton')?.addEventListener('click', () => publishPack(false));
    $('studioAddButton')?.addEventListener('click', () => publishPack(true));
    $('studioOpenPackButton')?.addEventListener('click', event => {
      const link = event.currentTarget.dataset.link;
      if (!link) return;
      try { tg?.openTelegramLink?.(link); }
      catch { window.open(link, '_blank', 'noopener'); }
    });

    $('studioSharePackButton')?.addEventListener('click', () => {
      if (!studio.packLink) {
        toast('Сначала создай Telegram pack');
        return;
      }
      const text = 'Ghost Mode · Telegram Emoji Pack';
      const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(studio.packLink)}&text=${encodeURIComponent(text)}`;
      try { tg?.openTelegramLink?.(shareUrl); }
      catch { window.open(shareUrl, '_blank', 'noopener'); }
    });

    $('studioOpenDirectButton')?.addEventListener('click', () => {
      if (!studio.packName) {
        toast('Сначала создай Telegram pack');
        return;
      }
      const direct = `tg://addemoji?set=${encodeURIComponent(studio.packName)}`;
      try { window.location.href = direct; } catch {}
    });

    $('studioNewAssetButton')?.addEventListener('click', () => {
      studio.assetDataUrl = '';
      studio.assetMime = '';
      if ($('studioPrompt')) $('studioPrompt').value = '';
      renderAsset();
      haptic();
    });

    document.querySelectorAll('[data-studio-prompt]').forEach(button => {
      button.addEventListener('click', () => {
        const prompt = $('studioPrompt');
        if (!prompt) return;
        prompt.value = button.dataset.studioPrompt || '';
        prompt.focus();
        haptic();
      });
    });
  }

  bind();
  renderKind();
  renderStyle();
  renderAsset();
  loadCapabilities();
})();
