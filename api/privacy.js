import crypto from 'node:crypto';
import {
  clearPrivacyArchive,
  getBusinessConnectionState,
  getPrivacyMessageVersions,
  getPrivacySettings,
  listDeletedFeed,
  listPrivacyMessages,
  listPrivacyThreads,
  updatePrivacySettings,
  viewerStoreHealth,
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

function telegramUrl(token, method) {
  return `https://api.telegram.org/bot${token}/${method}`;
}

async function tg(token, method, body = {}, timeoutMs = 5000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(telegramUrl(token, method), {
      method: 'POST',
      headers: { 'content-type':'application/json' },
      body: JSON.stringify(body || {}),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) {
      throw new Error(`${method}: ${data?.description || response.statusText || response.status}`);
    }
    return data.result;
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error(`${method}: timeout`);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function connectionIdFromMenu(menu) {
  try {
    const raw = String(menu?.web_app?.url || '');
    if (!raw) return null;
    return new URL(raw).searchParams.get('bc') || null;
  } catch {
    return null;
  }
}

function productionControlUrl() {
  const configured = String(process.env.STORY_PILOT_BASE_URL || '').trim();
  const host = String(process.env.VERCEL_PROJECT_PRODUCTION_URL || '').trim();
  const base = configured
    ? configured.replace(/\/$/, '')
    : host
      ? `https://${host.replace(/^https?:\/\//, '').replace(/\/$/, '')}`
      : 'https://telegram-story-bot-murex.vercel.app';
  const url = new URL('/studio.html', base);
  url.searchParams.set('screen', 'privacy');
  return url.toString();
}

async function ghostDiagnostics(token, userId) {
  const [settings, storeHealth, deletedData, webhookInfo, durable, menu] = await Promise.all([
    getPrivacySettings(userId),
    viewerStoreHealth().catch(() => null),
    listDeletedFeed(userId, 1).catch(() => ({ items: [] })),
    tg(token, 'getWebhookInfo').catch(() => null),
    getBusinessConnectionState(userId).catch(() => null),
    tg(token, 'getChatMenuButton', { chat_id: userId }).catch(() => null),
  ]);

  const connectionId = durable?.businessConnectionId || connectionIdFromMenu(menu);
  let liveConnection = null;
  let verificationError = null;
  if (connectionId) {
    try {
      liveConnection = await tg(token, 'getBusinessConnection', {
        business_connection_id: connectionId,
      });
    } catch (error) {
      verificationError = error?.message || String(error);
    }
  }

  const businessLive = liveConnection
    ? Boolean(liveConnection?.is_enabled)
    : Boolean(durable?.isEnabled);
  const canReadMessages = liveConnection
    ? Boolean(liveConnection?.rights?.can_read_messages)
    : Boolean(durable?.canReadMessages);
  const canManageStories = liveConnection
    ? Boolean(liveConnection?.rights?.can_manage_stories)
    : Boolean(durable?.canManageStories);

  const webhookUrl = String(webhookInfo?.url || '');
  const webhookReady = Boolean(webhookUrl && /\/api\/webhook-v8(?:$|\?)/.test(webhookUrl));
  const pendingUpdates = Number(webhookInfo?.pending_update_count || 0);
  const storageReady = Boolean(storeHealth?.storage === 'ok' && storeHealth?.directGhostWrites);
  const mediaVaultReady = Boolean(storeHealth?.mediaVault);
  const deleteItems = Array.isArray(deletedData?.items) ? deletedData.items : [];
  const lastDelete = deleteItems[0] || null;

  const checks = {
    webhook: {
      ok: webhookReady,
      label: 'Telegram webhook',
      detail: webhookReady
        ? pendingUpdates ? `Active · pending ${pendingUpdates}` : 'Active · no pending updates'
        : 'Webhook is not active',
    },
    business: {
      ok: businessLive,
      label: 'Business connection',
      detail: businessLive
        ? verificationError ? 'Stored connection · live verification deferred' : 'Verified with Telegram'
        : 'Needs Telegram Business connection',
    },
    messagePermission: {
      ok: canReadMessages,
      label: 'Message access',
      detail: canReadMessages ? 'can_read_messages allowed' : 'Message access is not allowed',
    },
    storage: {
      ok: storageReady,
      label: 'Protected Ghost store',
      detail: storageReady ? 'Direct durable writes ready' : 'Storage write path unavailable',
    },
    mediaVault: {
      ok: mediaVaultReady,
      label: 'Media Vault',
      detail: mediaVaultReady ? 'Independent media copies supported' : 'Media Vault unavailable',
    },
    antiDelete: {
      ok: settings?.antiDelete === true,
      label: 'Anti-Delete',
      detail: settings?.antiDelete ? 'Enabled for new events' : 'Turn Anti-Delete on',
    },
    focus: {
      ok: settings?.ghostFocus !== false,
      label: 'Ghost Focus',
      detail: settings?.ghostFocus !== false ? 'Exact-message deep links enabled' : 'Ghost Focus is off',
    },
    alerts: {
      ok: settings?.notifyDeletes !== false,
      label: 'Delete alerts',
      detail: settings?.notifyDeletes !== false ? 'Bot alerts enabled' : 'Delete alerts are off',
    },
  };

  const coreReady = [
    checks.webhook.ok,
    checks.business.ok,
    checks.messagePermission.ok,
    checks.storage.ok,
    checks.antiDelete.ok,
  ].every(Boolean);

  return {
    status: coreReady ? 'ready' : 'attention',
    checkedAt: new Date().toISOString(),
    checks,
    business: {
      connectionPresent: Boolean(connectionId),
      verifiedNow: Boolean(liveConnection),
      canManageStories,
      canReadMessages,
      verificationError,
    },
    liveDeleteProof: lastDelete ? {
      captured: true,
      deletedAt: lastDelete.deletedAt || null,
      chatTitle: lastDelete.chatTitle || null,
      mediaArchived: lastDelete.mediaArchiveStatus === 'archived',
    } : {
      captured: false,
      deletedAt: null,
      chatTitle: null,
      mediaArchived: null,
    },
    note: lastDelete
      ? 'At least one real Telegram delete event has been captured by Ghost.'
      : 'Core pipeline can be ready even before the first real delete event. No synthetic deletion is created.',
  };
}

function transientStoreError(error) {
  const message = error?.message || String(error || '');
  return /Viewer Sync store|schema cache|timeout|timed out|connection|temporar|fetch failed|network|502|503|504/i.test(message);
}

function privacyPatch(body = {}) {
  const input = body.settings || body.patch || {};
  const patch = {};
  if ('antiDelete' in input) patch.antiDelete = Boolean(input.antiDelete);
  if ('editHistory' in input) patch.editHistory = Boolean(input.editHistory);
  if ('ghostInbox' in input) patch.ghostInbox = Boolean(input.ghostInbox);
  if ('ghostFocus' in input) patch.ghostFocus = Boolean(input.ghostFocus);
  if ('notifyDeletes' in input) patch.notifyDeletes = Boolean(input.notifyDeletes);
  if ('notifyEdits' in input) patch.notifyEdits = Boolean(input.notifyEdits);
  if ('retentionDays' in input) {
    patch.retentionDays = Math.max(1, Math.min(3650, Number(input.retentionDays || 30)));
  }
  return patch;
}

export default async function handler(req, res) {
  noStore(res);

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    res.status(500).json({ ok: false, error: 'Telegram Control is not configured' });
    return;
  }

  const initData = String(req.headers['x-telegram-init-data'] || '');
  const user = validateInitData(initData, token);
  if (!user) {
    res.status(401).json({ ok: false, error: 'Open Telegram Control inside Telegram' });
    return;
  }

  const userId = String(user.id);

  try {
    if (req.method === 'GET') {
      try {
        const overview = await listPrivacyThreads(userId);
        res.status(200).json({
          ok: true,
          degraded: false,
          settings: overview?.settings || await getPrivacySettings(userId),
          threads: overview?.threads || [],
          smartSummary: overview?.smartSummary || null,
        });
      } catch (error) {
        if (!transientStoreError(error)) throw error;
        console.warn('Privacy API transient store recovery', error?.message || error);
        res.status(200).json({
          ok: true,
          degraded: true,
          settings: null,
          threads: null,
          storageError: 'Ghost временно восстанавливает соединение. Данные на экране сохранены.',
        });
      }
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
      res.status(200).json({
        ok: true,
        settings,
        threads: overview?.threads || [],
        smartSummary: overview?.smartSummary || null,
      });
      return;
    }

    if (action === 'list_deleted') {
      const data = await listDeletedFeed(userId, body.limit || 120);
      res.status(200).json({ ok: true, ...data });
      return;
    }

    if (action === 'diagnostics') {
      const diagnostics = await ghostDiagnostics(token, userId);
      res.status(200).json({ ok: true, diagnostics });
      return;
    }

    if (action === 'test_alert') {
      await tg(token, 'sendMessage', {
        chat_id: userId,
        text: '👻 Ghost Self-Test\n\nAlert route works. Это диагностическое сообщение, а не симуляция удаления.',
        disable_notification: false,
        reply_markup: {
          inline_keyboard: [[{
            text: '👻 Открыть Ghost',
            web_app: { url: productionControlUrl() },
          }]],
        },
      });
      res.status(200).json({ ok: true, delivered: true });
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
    if (transientStoreError(error)) {
      res.setHeader('Retry-After', '2');
      res.status(503).json({ ok: false, error: 'Ghost восстанавливает соединение. Попробуй ещё раз.' });
      return;
    }
    res.status(500).json({ ok: false, error: 'Privacy archive is temporarily unavailable' });
  }
}
