import crypto from 'node:crypto';
import {
  clearPrivacyArchive,
  getPrivacyMessageVersions,
  getPrivacySettings,
  listPrivacyMessages,
  listPrivacyThreads,
  updatePrivacySettings,
} from '../lib/viewer-sync-store.js';

function validateInitData(initData, token) {
  if (!initData || !token) return null;

  const params = new URLSearchParams(initData);
  const hash = String(params.get('hash') || '');
  if (!/^[a-f0-9]{64}$/i.test(hash)) return null;

  params.delete('hash');
  const checkString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secret = crypto.createHmac('sha256', 'WebAppData').update(token).digest();
  const expected = crypto.createHmac('sha256', secret).update(checkString).digest('hex');
  const actualBuffer = Buffer.from(hash, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');

  if (actualBuffer.length !== expectedBuffer.length
      || !crypto.timingSafeEqual(actualBuffer, expectedBuffer)) {
    return null;
  }

  const authDate = Number(params.get('auth_date') || 0);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(authDate) || authDate <= 0 || Math.abs(now - authDate) > 86400) {
    return null;
  }

  try {
    const user = JSON.parse(params.get('user') || '{}');
    return user?.id ? user : null;
  } catch {
    return null;
  }
}

function noStore(res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
}

function privacyPatch(body = {}) {
  const input = body.settings || body.patch || {};
  const patch = {};
  if ('antiDelete' in input) patch.antiDelete = Boolean(input.antiDelete);
  if ('editHistory' in input) patch.editHistory = Boolean(input.editHistory);
  if ('ghostInbox' in input) patch.ghostInbox = Boolean(input.ghostInbox);
  if ('retentionDays' in input) {
    patch.retentionDays = Math.max(1, Math.min(3650, Number(input.retentionDays || 30)));
  }
  return patch;
}

export default async function handler(req, res) {
  noStore(res);

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    res.status(500).json({ ok: false, error: 'Story Pilot is not configured' });
    return;
  }

  const initData = String(req.headers['x-telegram-init-data'] || '');
  const user = validateInitData(initData, token);
  if (!user) {
    res.status(401).json({ ok: false, error: 'Open Story Pilot inside Telegram' });
    return;
  }

  const userId = String(user.id);

  try {
    if (req.method === 'GET') {
      const overview = await listPrivacyThreads(userId);
      res.status(200).json({
        ok: true,
        settings: overview?.settings || await getPrivacySettings(userId),
        threads: overview?.threads || [],
      });
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ ok: false, error: 'Method not allowed' });
      return;
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const action = String(body.action || '');

    if (action === 'update_settings') {
      const settings = await updatePrivacySettings(userId, privacyPatch(body));
      const overview = await listPrivacyThreads(userId);
      res.status(200).json({ ok: true, settings, threads: overview?.threads || [] });
      return;
    }

    if (action === 'list_messages') {
      const chatId = String(body.chatId || '');
      if (!chatId) {
        res.status(400).json({ ok: false, error: 'chatId is required' });
        return;
      }
      const data = await listPrivacyMessages(userId, chatId, body.limit || 80);
      res.status(200).json({ ok: true, ...data });
      return;
    }

    if (action === 'versions') {
      const chatId = String(body.chatId || '');
      const messageId = Number(body.messageId || 0);
      if (!chatId || !Number.isInteger(messageId) || messageId <= 0) {
        res.status(400).json({ ok: false, error: 'chatId and messageId are required' });
        return;
      }
      const data = await getPrivacyMessageVersions(userId, chatId, messageId);
      res.status(200).json({ ok: true, ...data });
      return;
    }

    if (action === 'clear_archive') {
      const result = await clearPrivacyArchive(userId);
      res.status(200).json({ ok: true, result });
      return;
    }

    res.status(400).json({ ok: false, error: 'Unsupported privacy action' });
  } catch (error) {
    console.error('Privacy API error', error?.message || error);
    res.status(500).json({ ok: false, error: 'Privacy archive is temporarily unavailable' });
  }
}
