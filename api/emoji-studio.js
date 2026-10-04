import crypto from 'node:crypto';
import sharp from 'sharp';
import { validateTelegramMiniApp } from '../lib/telegram-miniapp-auth.js';

const MAX_IMAGE_BYTES = 2.2 * 1024 * 1024;
const MAX_VIDEO_BYTES = 256 * 1024;
const OPENAI_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2.5-flare';

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
    const error = new Error('AI generation не настроена: добавь OPENAI_API_KEY в Vercel. Загрузка своего логотипа уже работает.');
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
