import crypto from 'node:crypto';
import { getPrivacyMediaRef } from '../lib/viewer-sync-store.js';

function validateInitData(initData, token) {
  if (!initData || !token) return null;
  const params = new URLSearchParams(initData);
  const hash = String(params.get('hash') || '');
  if (!/^[a-f0-9]{64}$/i.test(hash)) return null;
  params.delete('hash');
  const checkString = [...params.entries()]
    .sort(([a],[b]) => a.localeCompare(b))
    .map(([key,value]) => `${key}=${value}`)
    .join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(token).digest();
  const expected = crypto.createHmac('sha256', secret).update(checkString).digest('hex');
  const actual = Buffer.from(hash, 'hex');
  const wanted = Buffer.from(expected, 'hex');
  if (actual.length !== wanted.length || !crypto.timingSafeEqual(actual, wanted)) return null;

  const authDate = Number(params.get('auth_date') || 0);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(authDate) || authDate <= 0 || Math.abs(now - authDate) > 86400) return null;

  try {
    const user = JSON.parse(params.get('user') || '{}');
    return user?.id ? user : null;
  } catch {
    return null;
  }
}

function safeFilename(value, fallback = 'telegram-file') {
  const name = String(value || fallback)
    .replace(/[\r\n"]/g, '')
    .replace(/[^a-zA-Z0-9._()\-\u0400-\u04FF ]+/g, '_')
    .slice(0, 120);
  return name || fallback;
}

function inlineType(mediaType) {
  return ['photo','video','voice','audio','animation','video_note','sticker'].includes(String(mediaType || ''));
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'GET') {
    res.status(405).json({ ok:false, error:'Method not allowed' });
    return;
  }

  const token = String(process.env.TELEGRAM_BOT_TOKEN || '');
  if (!token) {
    res.status(500).json({ ok:false, error:'Story Pilot is not configured' });
    return;
  }

  const user = validateInitData(String(req.headers['x-telegram-init-data'] || ''), token);
  if (!user) {
    res.status(401).json({ ok:false, error:'Open Story Pilot inside Telegram' });
    return;
  }

  const chatId = String(req.query?.chatId || '');
  const messageId = Number(req.query?.messageId || 0);
  if (!chatId || !Number.isInteger(messageId) || messageId <= 0) {
    res.status(400).json({ ok:false, error:'chatId and messageId are required' });
    return;
  }

  try {
    const ref = await getPrivacyMediaRef(String(user.id), chatId, messageId);
    if (!ref?.fileId) {
      res.status(404).json({ ok:false, error:'Media is not available' });
      return;
    }

    if (Number(ref.fileSize || 0) > 20 * 1024 * 1024) {
      res.status(413).json({ ok:false, error:'This file is too large for Telegram Bot download' });
      return;
    }

    const infoResponse = await fetch(`https://api.telegram.org/bot${token}/getFile`, {
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({ file_id:ref.fileId }),
    });
    const info = await infoResponse.json().catch(() => ({}));
    if (!infoResponse.ok || !info?.ok || !info?.result?.file_path) {
      throw new Error(info?.description || 'Telegram file is unavailable');
    }

    const fileResponse = await fetch(`https://api.telegram.org/file/bot${token}/${info.result.file_path}`);
    if (!fileResponse.ok) throw new Error(`Telegram file HTTP ${fileResponse.status}`);

    const buffer = Buffer.from(await fileResponse.arrayBuffer());
    const contentType = ref.mimeType || fileResponse.headers.get('content-type') || 'application/octet-stream';
    const extension = String(info.result.file_path).split('.').pop();
    const fallbackName = extension ? `telegram-${messageId}.${extension}` : `telegram-${messageId}`;
    const filename = safeFilename(ref.fileName, fallbackName);

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', String(buffer.length));
    res.setHeader(
      'Content-Disposition',
      `${inlineType(ref.mediaType) ? 'inline' : 'attachment'}; filename="${filename}"`,
    );
    res.status(200).send(buffer);
  } catch (error) {
    console.error('Ghost media proxy error', {
      chatId,
      messageId,
      error:error?.message || String(error),
    });
    res.status(502).json({ ok:false, error:'Media is temporarily unavailable' });
  }
}
