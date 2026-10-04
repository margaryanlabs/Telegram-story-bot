import crypto from 'node:crypto';
import sharp from 'sharp';
import { validateTelegramMiniApp } from '../lib/telegram-miniapp-auth.js';

const MAX_IMAGE_BYTES = 2.2 * 1024 * 1024;
const MAX_VIDEO_BYTES = 256 * 1024;
const MAX_PACK_ASSETS = 12;
const OPENAI_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2.5-flare';

const BRAND_VARIANTS = [
  { id: 'core', label: 'Core', emoji: '✨', keywords: ['brand', 'core'], icon: 'core' },
  { id: 'done', label: 'Done', emoji: '✅', keywords: ['done', 'ready'], icon: 'check' },
  { id: 'private', label: 'Private', emoji: '🔒', keywords: ['private', 'secure'], icon: 'lock' },
  { id: 'watch', label: 'Watch', emoji: '👁', keywords: ['watch', 'view'], icon: 'eye' },
  { id: 'priority', label: 'Priority', emoji: '⚡', keywords: ['priority', 'fast'], icon: 'bolt' },
  { id: 'focus', label: 'Focus', emoji: '🎯', keywords: ['focus', 'target'], icon: 'target' },
  { id: 'growth', label: 'Growth', emoji: '📈', keywords: ['growth', 'up'], icon: 'growth' },
  { id: 'spark', label: 'Spark', emoji: '✦', keywords: ['spark', 'new'], icon: 'spark' },
  { id: 'shield', label: 'Shield', emoji: '🛡', keywords: ['shield', 'protected'], icon: 'shield' },
  { id: 'message', label: 'Message', emoji: '💬', keywords: ['message', 'chat'], icon: 'message' },
  { id: 'celebrate', label: 'Celebrate', emoji: '🎉', keywords: ['celebrate', 'win'], icon: 'celebrate' },
  { id: 'premium', label: 'Premium', emoji: '💎', keywords: ['premium', 'vip'], icon: 'diamond' },
];

function telegramUrl(token, method) {
  return `https://api.telegram.org/bot${token}/${method}`;
}

function readInitData(req) {
  const raw = req.headers['x-telegram-init-data'];
  return Array.isArray(raw) ? raw[0] : String(raw || '');
}

function safeString(value, max = 120) {
  return String(value || '').trim().slice(0, max);
}

function parseDataUrl(value) {
  const match = String(value || '').match(/^data:(image\/(?:png|jpeg|jpg|webp)|video\/webm);base64,([A-Za-z0-9+/=]+)$/i);
  if (!match) throw new Error('Поддерживаются PNG, JPG, WEBP или WEBM');
  const mime = match[1].toLowerCase().replace('image/jpg', 'image/jpeg');
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length) throw new Error('Файл пустой');
  return { mime, buffer };
}

function toDataUrl(buffer, mime = 'image/webp') {
  return `data:${mime};base64,${buffer.toString('base64')}`;
}

function sanitizeShortName(value) {
  return safeString(value, 40)
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/^[^a-z]+/, '') || 'ghost_pack';
}

function packSuffix(botUsername) {
  return `_by_${String(botUsername || 'bot').replace(/^@/, '').toLowerCase()}`;
}

function makePackName(base, botUsername) {
  const suffix = packSuffix(botUsername);
  const random = crypto.randomBytes(3).toString('hex');
  const stemMax = Math.max(1, 64 - suffix.length - random.length - 1);
  const stem = sanitizeShortName(base).slice(0, stemMax).replace(/_+$/g, '') || 'ghost';
  return `${stem}_${random}${suffix}`;
}

function sanitizeHex(value, fallback = '#7B66FF') {
  const raw = String(value || '').trim();
  return /^#[0-9a-f]{6}$/i.test(raw) ? raw.toUpperCase() : fallback;
}

function hexToRgb(hex) {
  const clean = sanitizeHex(hex).slice(1);
  return {
    r: Number.parseInt(clean.slice(0, 2), 16),
    g: Number.parseInt(clean.slice(2, 4), 16),
    b: Number.parseInt(clean.slice(4, 6), 16),
  };
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

async function tgJson(token, method, body = {}) {
  const response = await fetch(telegramUrl(token, method), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) {
    const error = new Error(data.description || `${method} failed`);
    error.code = data.error_code || response.status;
    throw error;
  }
  return data.result;
}

async function tgUploadSticker(token, { userId, buffer, filename, mime, format }) {
  const form = new FormData();
  form.set('user_id', String(userId));
  form.set('sticker_format', format);
  form.set('sticker', new Blob([buffer], { type: mime }), filename);
  const response = await fetch(telegramUrl(token, 'uploadStickerFile'), {
    method: 'POST',
    body: form,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) {
    throw new Error(data.description || 'Не удалось загрузить sticker-файл в Telegram');
  }
  return data.result;
}

async function knockoutNearWhite(buffer) {
  const source = sharp(buffer, { failOn: 'none' })
    .rotate()
    .resize(900, 900, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .ensureAlpha();

  const { data, info } = await source.raw().toBuffer({ resolveWithObject: true });
  const pixels = Buffer.from(data);
  const width = info.width;
  const height = info.height;
  const total = width * height;
  const visited = new Uint8Array(total);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;

  const isBackgroundCandidate = pixelIndex => {
    const i = pixelIndex * 4;
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    return min >= 226 && (max - min) <= 20;
  };

  const seed = pixelIndex => {
    if (pixelIndex < 0 || pixelIndex >= total || visited[pixelIndex] || !isBackgroundCandidate(pixelIndex)) return;
    visited[pixelIndex] = 1;
    queue[tail++] = pixelIndex;
  };

  for (let x = 0; x < width; x += 1) {
    seed(x);
    seed((height - 1) * width + x);
  }
  for (let y = 0; y < height; y += 1) {
    seed(y * width);
    seed(y * width + width - 1);
  }

  while (head < tail) {
    const pixelIndex = queue[head++];
    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);
    if (x > 0) seed(pixelIndex - 1);
    if (x < width - 1) seed(pixelIndex + 1);
    if (y > 0) seed(pixelIndex - width);
    if (y < height - 1) seed(pixelIndex + width);
  }

  // Only edge-connected neutral white is removed. White/light brand pieces inside
  // the logo stay intact instead of being mistaken for background.
  for (let pixelIndex = 0; pixelIndex < total; pixelIndex += 1) {
    if (!visited[pixelIndex]) continue;
    pixels[pixelIndex * 4 + 3] = 0;
  }

  return sharp(pixels, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4,
    },
  })
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 4 })
    .png()
    .toBuffer();
}

async function inferAccent(buffer) {
  const { data, info } = await sharp(buffer, { failOn: 'none' })
    .ensureAlpha()
    .resize(64, 64, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .raw()
    .toBuffer({ resolveWithObject: true });

  let best = null;
  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = info.channels === 4 ? data[i + 3] : 255;
    if (a < 90) continue;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const chroma = max - min;
    const light = (max + min) / 2;
    if (chroma < 34 || light < 28 || light > 232) continue;

    const score = chroma * (1 - Math.abs(light - 135) / 180) * (a / 255);
    if (!best || score > best.score) best = { r, g, b, score };
  }

  return best ? rgbToHex(best.r, best.g, best.b) : '#7B66FF';
}

function badgeIconSvg(icon, x, y, size, stroke, fill = 'none') {
  const s = size;
  const cx = x + s / 2;
  const cy = y + s / 2;
  const sw = Math.max(2, s * 0.09);

  if (icon === 'check') {
    return `<path d="M ${x+s*.24} ${y+s*.53} L ${x+s*.43} ${y+s*.70} L ${x+s*.76} ${y+s*.32}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  if (icon === 'lock') {
    return `<rect x="${x+s*.27}" y="${y+s*.43}" width="${s*.46}" height="${s*.34}" rx="${s*.08}" fill="none" stroke="${stroke}" stroke-width="${sw}"/>
      <path d="M ${x+s*.36} ${y+s*.44} V ${y+s*.35} C ${x+s*.36} ${y+s*.18}, ${x+s*.64} ${y+s*.18}, ${x+s*.64} ${y+s*.35} V ${y+s*.44}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>`;
  }
  if (icon === 'eye') {
    return `<path d="M ${x+s*.14} ${cy} C ${x+s*.31} ${y+s*.28}, ${x+s*.69} ${y+s*.28}, ${x+s*.86} ${cy} C ${x+s*.69} ${y+s*.72}, ${x+s*.31} ${y+s*.72}, ${x+s*.14} ${cy} Z" fill="none" stroke="${stroke}" stroke-width="${sw*.82}"/>
      <circle cx="${cx}" cy="${cy}" r="${s*.11}" fill="${stroke}"/>`;
  }
  if (icon === 'bolt') {
    return `<path d="M ${x+s*.56} ${y+s*.12} L ${x+s*.28} ${y+s*.53} H ${x+s*.48} L ${x+s*.39} ${y+s*.88} L ${x+s*.74} ${y+s*.43} H ${x+s*.53} Z" fill="${stroke}"/>`;
  }
  if (icon === 'target') {
    return `<circle cx="${cx}" cy="${cy}" r="${s*.29}" fill="none" stroke="${stroke}" stroke-width="${sw*.75}"/>
      <circle cx="${cx}" cy="${cy}" r="${s*.11}" fill="${stroke}"/>
      <path d="M ${cx} ${y+s*.08} V ${y+s*.27} M ${cx} ${y+s*.73} V ${y+s*.92} M ${x+s*.08} ${cy} H ${x+s*.27} M ${x+s*.73} ${cy} H ${x+s*.92}" stroke="${stroke}" stroke-width="${sw*.7}" stroke-linecap="round"/>`;
  }
  if (icon === 'growth') {
    return `<path d="M ${x+s*.20} ${y+s*.72} L ${x+s*.42} ${y+s*.50} L ${x+s*.57} ${y+s*.62} L ${x+s*.82} ${y+s*.30}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M ${x+s*.63} ${y+s*.30} H ${x+s*.82} V ${y+s*.49}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>`;
  }
  if (icon === 'spark') {
    return `<path d="M ${cx} ${y+s*.12} C ${cx+s*.03} ${cy-s*.10}, ${cx+s*.10} ${cy-s*.03}, ${x+s*.88} ${cy} C ${cx+s*.10} ${cy+s*.03}, ${cx+s*.03} ${cy+s*.10}, ${cx} ${y+s*.88} C ${cx-s*.03} ${cy+s*.10}, ${cx-s*.10} ${cy+s*.03}, ${x+s*.12} ${cy} C ${cx-s*.10} ${cy-s*.03}, ${cx-s*.03} ${cy-s*.10}, ${cx} ${y+s*.12} Z" fill="${stroke}"/>`;
  }
  if (icon === 'shield') {
    return `<path d="M ${cx} ${y+s*.12} L ${x+s*.76} ${y+s*.24} V ${y+s*.50} C ${x+s*.76} ${y+s*.69}, ${x+s*.64} ${y+s*.81}, ${cx} ${y+s*.89} C ${x+s*.36} ${y+s*.81}, ${x+s*.24} ${y+s*.69}, ${x+s*.24} ${y+s*.50} V ${y+s*.24} Z" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/>`;
  }
  if (icon === 'message') {
    return `<path d="M ${x+s*.20} ${y+s*.24} H ${x+s*.80} V ${y+s*.66} H ${x+s*.52} L ${x+s*.34} ${y+s*.83} V ${y+s*.66} H ${x+s*.20} Z" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/>`;
  }
  if (icon === 'celebrate') {
    return `<path d="M ${x+s*.30} ${y+s*.70} L ${x+s*.43} ${y+s*.37} L ${x+s*.62} ${y+s*.76} Z" fill="${stroke}"/>
      <path d="M ${x+s*.58} ${y+s*.20} L ${x+s*.66} ${y+s*.10} M ${x+s*.72} ${y+s*.34} L ${x+s*.88} ${y+s*.31} M ${x+s*.43} ${y+s*.22} L ${x+s*.37} ${y+s*.08}" stroke="${stroke}" stroke-width="${sw*.75}" stroke-linecap="round"/>`;
  }
  if (icon === 'diamond') {
    return `<path d="M ${cx} ${y+s*.13} L ${x+s*.82} ${cy} L ${cx} ${y+s*.87} L ${x+s*.18} ${cy} Z" fill="none" stroke="${stroke}" stroke-width="${sw}"/>
      <path d="M ${x+s*.18} ${cy} H ${x+s*.82} M ${cx} ${y+s*.13} L ${x+s*.39} ${cy} L ${cx} ${y+s*.87} M ${cx} ${y+s*.13} L ${x+s*.61} ${cy} L ${cx} ${y+s*.87}" fill="none" stroke="${stroke}" stroke-width="${sw*.5}"/>`;
  }

  return `<circle cx="${cx}" cy="${cy}" r="${s*.24}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
}

function variantOverlaySvg(spec, size, accent) {
  const { r, g, b } = hexToRgb(accent);
  const badgeSize = Math.round(size * 0.31);
  const bx = Math.round(size - badgeSize - size * 0.055);
  const by = Math.round(size - badgeSize - size * 0.055);
  const ring = Math.max(1.5, size * 0.018);
  const white = '#FFFFFF';

  if (spec.icon === 'core') {
    return Buffer.from(
      `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
        <circle cx="${size/2}" cy="${size/2}" r="${size*.455}" fill="none" stroke="rgba(${r},${g},${b},.78)" stroke-width="${ring}"/>
        <circle cx="${size/2}" cy="${size/2}" r="${size*.415}" fill="none" stroke="rgba(255,255,255,.10)" stroke-width="${ring*.6}"/>
      </svg>`,
    );
  }

  const icon = badgeIconSvg(spec.icon, bx, by, badgeSize, white);
  return Buffer.from(
    `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="shadow" x="-60%" y="-60%" width="220%" height="220%">
          <feDropShadow dx="0" dy="${size*.012}" stdDeviation="${size*.018}" flood-color="#000" flood-opacity=".35"/>
        </filter>
      </defs>
      <circle cx="${bx+badgeSize/2}" cy="${by+badgeSize/2}" r="${badgeSize*.47}" fill="rgba(10,14,22,.94)" stroke="rgba(${r},${g},${b},.95)" stroke-width="${Math.max(1.5,size*.018)}" filter="url(#shadow)"/>
      ${icon}
    </svg>`,
  );
}

async function renderBrandVariant(baseLogo, spec, kind, accent) {
  const size = kind === 'custom_emoji' ? 100 : 512;
  const logoBox = Math.round(size * (spec.id === 'core' ? 0.72 : 0.68));
  const logo = await sharp(baseLogo, { failOn: 'none' })
    .resize(logoBox, logoBox, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      withoutEnlargement: false,
    })
    .png()
    .toBuffer();

  const left = Math.round((size - logoBox) / 2);
  const top = Math.round((size - logoBox) / 2);
  const overlay = variantOverlaySvg(spec, size, accent);

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      { input: logo, left, top },
      { input: overlay, left: 0, top: 0 },
    ])
    .webp({
      quality: kind === 'custom_emoji' ? 94 : 92,
      alphaQuality: 100,
      effort: 5,
    })
    .toBuffer();
}

async function normalizeImage(buffer, kind) {
  const size = kind === 'custom_emoji' ? 100 : 512;
  return sharp(buffer, { failOn: 'none' })
    .rotate()
    .resize(size, size, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      withoutEnlargement: false,
    })
    .webp({ quality: 92, alphaQuality: 100, effort: 5 })
    .toBuffer();
}

async function prepareStickerAsset(assetDataUrl, kind) {
  const { mime, buffer } = parseDataUrl(assetDataUrl);
  if (mime === 'video/webm') {
    if (buffer.length > MAX_VIDEO_BYTES) {
      throw new Error('WEBM должен быть не больше 256 KB для надёжной загрузки emoji');
    }
    return {
      buffer,
      mime,
      format: 'video',
      filename: kind === 'custom_emoji' ? 'emoji.webm' : 'sticker.webm',
    };
  }

  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new Error('Изображение слишком большое. Максимум 2.2 MB до оптимизации.');
  }
  const normalized = await normalizeImage(buffer, kind);
  return {
    buffer: normalized,
    mime: 'image/webp',
    format: 'static',
    filename: kind === 'custom_emoji' ? 'emoji.webp' : 'sticker.webp',
  };
}

function inputSticker(fileId, format, emoji, keywords) {
  return {
    sticker: fileId,
    format,
    emoji_list: [emoji || '✨'],
    keywords: (keywords || []).slice(0, 8),
  };
}

async function generateImage(prompt, style, userId) {
  const apiKey = String(process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey) {
    const error = new Error('AI generation не настроена: добавь OPENAI_API_KEY в Vercel. Brand Pack из своего логотипа уже работает без AI.');
    error.statusCode = 409;
    throw error;
  }

  const styleHint = {
    brand: 'premium brand icon, exact geometric language, clean silhouette, high recognizability',
    minimal: 'minimal icon, simple bold geometry, clean edges, no tiny details',
    '3d': 'premium 3D material icon, soft studio light, tactile depth, crisp silhouette',
    chrome: 'dark chrome and glass accent, restrained premium reflections, crisp icon',
    soft: 'soft dimensional icon, subtle shadows, calm premium finish',
  }[style] || 'premium clean brand icon';

  const finalPrompt = [
    safeString(prompt, 1800),
    styleHint,
    'Centered isolated Telegram custom emoji asset.',
    'Transparent background. No text, no watermark, no frame.',
    'Readable at 100x100. Keep the subject inside safe margins.',
  ].filter(Boolean).join('\n');

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_IMAGE_MODEL,
      prompt: finalPrompt,
      size: '1024x1024',
      quality: 'low',
      output_format: 'webp',
      background: 'transparent',
      n: 1,
      user: String(userId),
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || 'AI generation failed');
  }
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) throw new Error('AI не вернул изображение');
  return `data:image/webp;base64,${b64}`;
}

async function generateBrandPack({ assetDataUrl, kind, count, accent }) {
  const { mime, buffer } = parseDataUrl(assetDataUrl);
  if (mime === 'video/webm') {
    throw new Error('Для автоматического Brand Pack загрузи PNG, JPG или WEBP. WEBM можно публиковать как отдельный animated emoji.');
  }
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new Error('Логотип слишком большой. Максимум 2.2 MB.');
  }

  const baseLogo = await knockoutNearWhite(buffer);
  const autoAccent = await inferAccent(baseLogo);
  const chosenAccent = sanitizeHex(accent, autoAccent);
  const amount = [6, 8, 12].includes(Number(count)) ? Number(count) : 8;
  const specs = BRAND_VARIANTS.slice(0, amount);

  const assets = [];
  for (const spec of specs) {
    const rendered = await renderBrandVariant(baseLogo, spec, kind, chosenAccent);
    assets.push({
      id: spec.id,
      label: spec.label,
      emoji: spec.emoji,
      keywords: spec.keywords,
      assetDataUrl: toDataUrl(rendered),
    });
  }

  return {
    accent: chosenAccent,
    autoAccent,
    assets,
  };
}

async function createOrAddPack({ token, user, assetDataUrl, kind, title, shortBase, emoji, keywords, existingName }) {
  const bot = await tgJson(token, 'getMe');
  const asset = await prepareStickerAsset(assetDataUrl, kind);
  const uploaded = await tgUploadSticker(token, {
    userId: user.id,
    ...asset,
  });

  const sticker = inputSticker(uploaded.file_id, asset.format, emoji, keywords);
  if (existingName) {
    await tgJson(token, 'addStickerToSet', {
      user_id: user.id,
      name: existingName,
      sticker,
    });
    return {
      name: existingName,
      link: kind === 'custom_emoji'
        ? `https://t.me/addemoji/${existingName}`
        : `https://t.me/addstickers/${existingName}`,
      added: true,
      format: asset.format,
    };
  }

  const name = makePackName(shortBase || title, bot.username);
  await tgJson(token, 'createNewStickerSet', {
    user_id: user.id,
    name,
    title: safeString(title, 64) || (kind === 'custom_emoji' ? 'Ghost Brand Emoji' : 'Ghost Brand Stickers'),
    sticker_type: kind,
    stickers: [sticker],
  });

  return {
    name,
    link: kind === 'custom_emoji'
      ? `https://t.me/addemoji/${name}`
      : `https://t.me/addstickers/${name}`,
    added: false,
    format: asset.format,
  };
}

async function createBrandPack({ token, user, assets, kind, title, shortBase }) {
  const items = Array.isArray(assets) ? assets.slice(0, MAX_PACK_ASSETS) : [];
  if (items.length < 2) throw new Error('Brand Pack должен содержать минимум 2 ассета');

  const bot = await tgJson(token, 'getMe');
  const uploadedStickers = [];
  let expectedFormat = '';

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index] || {};
    const prepared = await prepareStickerAsset(String(item.assetDataUrl || ''), kind);
    if (expectedFormat && prepared.format !== expectedFormat) {
      throw new Error('В одном Brand Pack нельзя смешивать static и video assets. Примени анимацию ко всему пакету или оставь весь пакет статичным.');
    }
    expectedFormat = prepared.format;

    const uploaded = await tgUploadSticker(token, {
      userId: user.id,
      buffer: prepared.buffer,
      filename: `brand-${index + 1}.${prepared.format === 'video' ? 'webm' : 'webp'}`,
      mime: prepared.mime,
      format: prepared.format,
    });

    uploadedStickers.push(
      inputSticker(
        uploaded.file_id,
        prepared.format,
        safeString(item.emoji, 8) || '✨',
        Array.isArray(item.keywords)
          ? item.keywords.map(keyword => safeString(keyword, 24)).filter(Boolean)
          : ['brand', 'ghost'],
      ),
    );
  }

  const name = makePackName(shortBase || title, bot.username);
  await tgJson(token, 'createNewStickerSet', {
    user_id: user.id,
    name,
    title: safeString(title, 64) || (kind === 'custom_emoji' ? 'Ghost Brand Emoji' : 'Ghost Brand Stickers'),
    sticker_type: kind,
    stickers: uploadedStickers,
  });

  return {
    name,
    link: kind === 'custom_emoji'
      ? `https://t.me/addemoji/${name}`
      : `https://t.me/addstickers/${name}`,
    count: uploadedStickers.length,
    format: expectedFormat,
  };
}

export { generateBrandPack, knockoutNearWhite, inferAccent };

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  const token = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
  if (!token) {
    res.status(500).json({ ok: false, error: 'TELEGRAM_BOT_TOKEN is missing' });
    return;
  }

  const user = validateTelegramMiniApp(readInitData(req), token);
  if (!user) {
    res.status(401).json({ ok: false, error: 'Открой Ghost Mode внутри Telegram' });
    return;
  }

  if (req.method === 'GET') {
    res.status(200).json({
      ok: true,
      capabilities: {
        aiImage: Boolean(process.env.OPENAI_API_KEY),
        aiModel: Boolean(process.env.OPENAI_API_KEY) ? OPENAI_IMAGE_MODEL : null,
        customEmoji: true,
        stickers: true,
        animatedWebmUpload: true,
        clientMotion: true,
        brandPack: true,
        brandPackSizes: [6, 8, 12],
        autoAccent: true,
      },
    });
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const action = safeString(body.action, 40);

    if (action === 'generate_image') {
      const prompt = safeString(body.prompt, 1800);
      if (!prompt) {
        res.status(400).json({ ok: false, error: 'Напиши, какой emoji или sticker создать' });
        return;
      }
      const assetDataUrl = await generateImage(prompt, safeString(body.style, 20), user.id);
      res.status(200).json({ ok: true, assetDataUrl });
      return;
    }

    if (action === 'generate_brand_pack') {
      const kind = body.kind === 'sticker' ? 'regular' : 'custom_emoji';
      const assetDataUrl = String(body.assetDataUrl || '');
      if (!assetDataUrl) {
        res.status(400).json({ ok: false, error: 'Сначала загрузи логотип или создай base asset' });
        return;
      }

      const brandPack = await generateBrandPack({
        assetDataUrl,
        kind,
        count: Number(body.count || 8),
        accent: body.accent ? safeString(body.accent, 12) : '',
      });

      res.status(200).json({ ok: true, brandPack });
      return;
    }

    if (action === 'publish_brand_pack') {
      const kind = body.kind === 'sticker' ? 'regular' : 'custom_emoji';
      const result = await createBrandPack({
        token,
        user,
        assets: body.assets,
        kind,
        title: safeString(body.title, 64),
        shortBase: safeString(body.shortBase, 40),
      });
      res.status(200).json({ ok: true, pack: result });
      return;
    }

    if (action === 'create_pack' || action === 'add_to_pack') {
      const kind = body.kind === 'sticker' ? 'regular' : 'custom_emoji';
      const assetDataUrl = String(body.assetDataUrl || '');
      if (!assetDataUrl) {
        res.status(400).json({ ok: false, error: 'Сначала создай или загрузи изображение' });
        return;
      }

      const result = await createOrAddPack({
        token,
        user,
        assetDataUrl,
        kind,
        title: safeString(body.title, 64),
        shortBase: safeString(body.shortBase, 40),
        emoji: safeString(body.emoji, 8) || '✨',
        keywords: Array.isArray(body.keywords)
          ? body.keywords.map(item => safeString(item, 24)).filter(Boolean)
          : ['brand', 'ghost'],
        existingName: action === 'add_to_pack' ? safeString(body.existingName, 64) : '',
      });

      res.status(200).json({ ok: true, pack: result });
      return;
    }

    res.status(400).json({ ok: false, error: 'Unknown action' });
  } catch (error) {
    console.error('Ghost Studio error', error);
    res.status(Number(error.statusCode || 500)).json({
      ok: false,
      error: error.message || 'Ghost Studio error',
    });
  }
}
