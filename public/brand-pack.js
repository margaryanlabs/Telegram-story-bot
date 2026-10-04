(() => {
  const tg = window.Telegram?.WebApp || null;
  const $ = id => document.getElementById(id);

  const state = {
    assets: [],
    staticAssets: [],
    count: 8,
    accent: '',
    autoAccent: '',
    motionPreset: 'assemble',
    animated: false,
    kind: 'custom_emoji',
    busy: false,
  };

  function toast(message) {
    const el = $('toast');
    if (!el) return;
    el.textContent = String(message || '');
    el.classList.add('show');
    clearTimeout(window.__ghostBrandToast);
    window.__ghostBrandToast = setTimeout(() => el.classList.remove('show'), 3000);
  }

  function haptic(type = 'light') {
    try { tg?.HapticFeedback?.impactOccurred(type); } catch {}
  }

  function notify(type = 'success') {
    try { tg?.HapticFeedback?.notificationOccurred(type); } catch {}
  }

  async function api(body) {
    if (!tg?.initData) throw new Error('Открой Ghost Mode внутри Telegram');
    const response = await fetch('/api/emoji-studio', {
      method: 'POST',
      headers: {
        'x-telegram-init-data': tg.initData,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.error || 'Ghost Brand Engine error');
    return data;
  }

  function currentKind() {
    return document.querySelector('[data-studio-kind].active')?.dataset?.studioKind === 'sticker'
      ? 'sticker'
      : 'custom_emoji';
  }

  function currentBaseAsset() {
    const img = $('studioAssetImage');
    if (img && !img.hidden && /^data:image\//i.test(img.src || '')) return img.src;
    throw new Error('Для Brand Pack сначала загрузи PNG/JPG/WEBP или создай base asset через AI');
  }

  function motionSupported() {
    try {
      return Boolean(
        window.MediaRecorder
        && HTMLCanvasElement.prototype.captureStream
        && MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      );
    } catch {
      return false;
    }
  }

  function setBusy(value, label = '') {
    state.busy = Boolean(value);
    ['brandPackBuildButton', 'brandPackAnimateButton', 'brandPackPublishButton', 'brandPackRestoreButton']
      .map($)
      .filter(Boolean)
      .forEach(button => {
        button.disabled = state.busy || (button.id === 'brandPackPublishButton' && !selectedAssets().length);
      });

    const status = $('brandPackStatus');
    if (status) {
      status.classList.toggle('busy', state.busy);
      if (label) status.textContent = label;
    }
  }

  function selectedAssets() {
    return state.assets.filter(asset => asset.selected !== false);
  }

  function renderControls() {
    document.querySelectorAll('[data-brand-count]').forEach(button => {
      button.classList.toggle('active', Number(button.dataset.brandCount) === state.count);
    });

    document.querySelectorAll('[data-motion-preset]').forEach(button => {
      button.classList.toggle('active', button.dataset.motionPreset === state.motionPreset);
    });

    const accent = $('brandPackAccent');
    if (accent && state.accent) accent.value = state.accent;

    const motion = $('brandPackMotionCapability');
    if (motion) {
      motion.textContent = motionSupported()
        ? 'VP9 motion ready'
        : 'Motion unavailable in this WebView';
      motion.classList.toggle('ready', motionSupported());
    }

    const animate = $('brandPackAnimateButton');
    if (animate) {
      animate.disabled = state.busy || !state.assets.length || !motionSupported() || state.animated;
      animate.textContent = state.animated ? '✓ Pack animated' : '◌ Animate pack';
    }

    const restore = $('brandPackRestoreButton');
    if (restore) restore.hidden = !state.animated;

    const publish = $('brandPackPublishButton');
    if (publish) publish.disabled = state.busy || !selectedAssets().length;

    const selected = $('brandPackSelectedCount');
    if (selected) selected.textContent = String(selectedAssets().length);

    const mode = $('brandPackMode');
    if (mode) mode.textContent = state.animated ? 'VIDEO · VP9' : 'STATIC · WEBP';
  }

  function renderGrid() {
    const grid = $('brandPackGrid');
    const empty = $('brandPackEmpty');
    if (!grid || !empty) return;

    grid.innerHTML = '';
    empty.hidden = Boolean(state.assets.length);

    state.assets.forEach((asset, index) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'brand-asset-card';
      card.classList.toggle('off', asset.selected === false);
      card.dataset.brandIndex = String(index);

      const media = state.animated
        ? `<video src="${asset.assetDataUrl}" muted loop playsinline autoplay></video>`
        : `<img src="${asset.assetDataUrl}" alt="${asset.label || 'Brand asset'}" />`;

      card.innerHTML = `
        <span class="brand-asset-check">${asset.selected === false ? '＋' : '✓'}</span>
        <span class="brand-asset-media">${media}</span>
        <span class="brand-asset-copy">
          <strong>${asset.emoji || '✨'} ${asset.label || asset.id || 'Asset'}</strong>
          <small>${state.animated ? 'animated' : 'static'}</small>
        </span>
      `;

      card.addEventListener('click', () => {
        asset.selected = asset.selected === false;
        renderGrid();
        renderControls();
        haptic();
      });
      grid.appendChild(card);
    });

    renderControls();
  }

  async function buildPack() {
    let assetDataUrl;
    try {
      assetDataUrl = currentBaseAsset();
    } catch (error) {
      toast(error.message);
      return;
    }

    setBusy(true, `Собираю ${state.count} брендовых ассетов…`);
    try {
      state.kind = currentKind();
      const data = await api({
        action: 'generate_brand_pack',
        kind: state.kind,
        assetDataUrl,
        count: state.count,
        accent: state.accent || undefined,
      });

      state.assets = (data.brandPack?.assets || []).map(asset => ({ ...asset, selected: true }));
      state.staticAssets = state.assets.map(asset => ({ ...asset }));
      state.accent = data.brandPack?.accent || state.accent;
      state.autoAccent = data.brandPack?.autoAccent || '';
      state.animated = false;

      const accent = $('brandPackAccent');
      if (accent && state.accent) accent.value = state.accent;
      const accentLabel = $('brandPackAccentLabel');
      if (accentLabel) {
        accentLabel.textContent = state.autoAccent
          ? `Auto detected ${state.autoAccent}`
          : 'Brand accent';
      }

      renderGrid();
      $('brandPackStatus').textContent = `${state.assets.length} ассетов готовы. Можно публиковать статично или анимировать весь pack.`;
      notify('success');
    } catch (error) {
      $('brandPackStatus').textContent = error.message;
      toast(error.message);
      notify('error');
    } finally {
      setBusy(false);
      renderControls();
    }
  }

  function loadImage(dataUrl) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = 'async';
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Не удалось подготовить asset для motion'));
      image.src = dataUrl;
    });
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Не удалось прочитать WEBM'));
      reader.readAsDataURL(blob);
    });
  }

  function drawAssemble(ctx, image, p, size) {
    const amp = Math.sin(Math.PI * 2 * p) * 2.2;
    const q = size / 2;
    const parts = [
      { sx: 0, sy: 0, dx: -amp, dy: -amp },
      { sx: q, sy: 0, dx: amp, dy: -amp },
      { sx: 0, sy: q, dx: -amp, dy: amp },
      { sx: q, sy: q, dx: amp, dy: amp },
    ];
    parts.forEach(part => {
      ctx.drawImage(
        image,
        part.sx, part.sy, q, q,
        part.sx + part.dx, part.sy + part.dy, q, q,
      );
    });
  }

  function drawMotionFrame(ctx, image, preset, p, size) {
    ctx.clearRect(0, 0, size, size);
    ctx.save();

    if (preset === 'assemble') {
      drawAssemble(ctx, image, p, size);
    } else if (preset === 'pulse') {
      const scale = 1 + 0.055 * (1 - Math.cos(Math.PI * 2 * p)) / 2;
      const draw = size * scale;
      ctx.drawImage(image, (size - draw) / 2, (size - draw) / 2, draw, draw);
    } else if (preset === 'float') {
      const y = -2.5 * Math.sin(Math.PI * 2 * p);
      ctx.drawImage(image, 0, y, size, size);
    } else {
      ctx.drawImage(image, 0, 0, size, size);
      const x = -size * .45 + p * size * 1.9;
      ctx.globalCompositeOperation = 'source-atop';
      const gradient = ctx.createLinearGradient(x - 18, 0, x + 18, size);
      gradient.addColorStop(0, 'rgba(255,255,255,0)');
      gradient.addColorStop(.5, 'rgba(255,255,255,.46)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(x - 28, -10, 56, size + 20);
      ctx.globalCompositeOperation = 'source-over';
    }

    ctx.restore();
  }

  async function recordMotion(dataUrl, preset, bitrate = 80000) {
    const image = await loadImage(dataUrl);
    const size = state.kind === 'sticker' ? 512 : 100;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) throw new Error('Canvas недоступен');

    const stream = canvas.captureStream(30);
    const recorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp9',
      videoBitsPerSecond: bitrate,
    });
    const chunks = [];
    recorder.ondataavailable = event => {
      if (event.data?.size) chunks.push(event.data);
    };

    const stopped = new Promise((resolve, reject) => {
      recorder.onerror = () => reject(new Error('Motion encoder error'));
      recorder.onstop = () => resolve();
    });

    recorder.start(120);
    const started = performance.now();
    const duration = 2350;

    await new Promise(resolve => {
      const frame = now => {
        const elapsed = now - started;
        const p = Math.min(1, elapsed / duration);
        drawMotionFrame(ctx, image, preset, p, size);
        if (elapsed < duration) requestAnimationFrame(frame);
        else resolve();
      };
      requestAnimationFrame(frame);
    });

    recorder.stop();
    await stopped;
    stream.getTracks().forEach(track => track.stop());

    const blob = new Blob(chunks, { type: 'video/webm' });
    return blob;
  }

  async function animatePack() {
    if (!state.assets.length || state.animated) return;
    if (!motionSupported()) {
      toast('Этот Telegram WebView не поддерживает VP9 motion encoding');
      return;
    }

    const targets = state.assets;
    if (!targets.length) return;

    setBusy(true, `Анимирую 1/${targets.length}…`);
    try {
      const animatedById = new Map();

      for (let i = 0; i < targets.length; i += 1) {
        $('brandPackStatus').textContent = `Анимирую ${i + 1}/${targets.length} · ${targets[i].label}…`;
        let blob = await recordMotion(targets[i].assetDataUrl, state.motionPreset, 76000);
        if (blob.size > 250 * 1024) {
          blob = await recordMotion(targets[i].assetDataUrl, state.motionPreset, 42000);
        }
        if (blob.size > 256 * 1024) {
          throw new Error(`${targets[i].label}: WEBM получился больше 256 KB. Выбери другой motion preset.`);
        }
        animatedById.set(targets[i].id, await blobToDataUrl(blob));
      }

      state.assets = state.assets.map(asset => {
        const motion = animatedById.get(asset.id);
        return motion ? { ...asset, assetDataUrl: motion } : asset;
      });
      state.animated = true;
      renderGrid();
      $('brandPackStatus').textContent = `Motion Pack готов · ${targets.length} VP9 WEBM · loop ~2.35 сек.`;
      notify('success');
    } catch (error) {
      state.assets = state.staticAssets.map(asset => ({ ...asset }));
      state.animated = false;
      renderGrid();
      $('brandPackStatus').textContent = error.message;
      toast(error.message);
      notify('error');
    } finally {
      setBusy(false);
      renderControls();
    }
  }

  function restoreStatic() {
    if (!state.staticAssets.length) return;
    const selectedMap = new Map(state.assets.map(asset => [asset.id, asset.selected]));
    state.assets = state.staticAssets.map(asset => ({
      ...asset,
      selected: selectedMap.get(asset.id) !== false,
    }));
    state.animated = false;
    renderGrid();
    $('brandPackStatus').textContent = 'Вернул static Brand Pack.';
    haptic();
  }

  async function publishPack() {
    const assets = selectedAssets();
    if (assets.length < 2) {
      toast('Выбери минимум 2 ассета для Brand Pack');
      return;
    }

    const title = String($('studioPackTitle')?.value || '').trim() || 'Ghost Brand Pack';
    const shortBase = String($('studioShortName')?.value || '').trim() || title;

    setBusy(true, `Публикую ${assets.length} ассетов в Telegram…`);
    try {
      const data = await api({
        action: 'publish_brand_pack',
        kind: state.kind,
        title,
        shortBase,
        assets: assets.map(asset => ({
          assetDataUrl: asset.assetDataUrl,
          emoji: asset.emoji,
          keywords: asset.keywords,
        })),
      });

      const result = $('brandPackResult');
      if (result) result.hidden = false;
      if ($('brandPackResultTitle')) {
        $('brandPackResultTitle').textContent = `${data.pack?.count || assets.length} assets · ${data.pack?.format || (state.animated ? 'video' : 'static')}`;
      }
      if ($('brandPackResultName')) $('brandPackResultName').textContent = data.pack?.name || '';
      if ($('brandPackOpenButton')) $('brandPackOpenButton').dataset.link = data.pack?.link || '';
      $('brandPackStatus').textContent = 'Brand Pack опубликован. Открывай его прямо в Telegram.';
      notify('success');
    } catch (error) {
      $('brandPackStatus').textContent = error.message;
      toast(error.message);
      notify('error');
    } finally {
      setBusy(false);
      renderControls();
    }
  }

  function bind() {
    document.querySelectorAll('[data-brand-count]').forEach(button => {
      button.addEventListener('click', () => {
        state.count = Number(button.dataset.brandCount || 8);
        renderControls();
        haptic();
      });
    });

    document.querySelectorAll('[data-motion-preset]').forEach(button => {
      button.addEventListener('click', () => {
        state.motionPreset = button.dataset.motionPreset || 'assemble';
        renderControls();
        haptic();
      });
    });

    $('brandPackAccent')?.addEventListener('input', event => {
      state.accent = String(event.target.value || '').toUpperCase();
      $('brandPackAccentLabel').textContent = `Custom ${state.accent}`;
    });

    $('brandPackAutoAccentButton')?.addEventListener('click', () => {
      state.accent = '';
      $('brandPackAccentLabel').textContent = 'Auto from logo';
      haptic();
    });

    $('brandPackBuildButton')?.addEventListener('click', buildPack);
    $('brandPackAnimateButton')?.addEventListener('click', animatePack);
    $('brandPackRestoreButton')?.addEventListener('click', restoreStatic);
    $('brandPackPublishButton')?.addEventListener('click', publishPack);

    $('brandPackOpenButton')?.addEventListener('click', event => {
      const link = event.currentTarget.dataset.link;
      if (!link) return;
      try { tg?.openTelegramLink?.(link); } catch { window.open(link, '_blank', 'noopener'); }
    });
  }

  bind();
  renderControls();
  renderGrid();
})();
