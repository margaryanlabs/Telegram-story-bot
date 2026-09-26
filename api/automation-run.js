import { verifyEdgeSignature } from '../lib/viewer-sync-signing.js';
import {
  claimAutomationJobs,
  completeAutomationJob,
} from '../lib/viewer-sync-store.js';

const EDGE_TRIGGER_PUBLIC_KEYS = [
  'idl_pp6aznx3_qyvmQV6CI5Um0cRt2VLI9-o-raIsVc',
];
const BOT_API_TIMEOUT_MS = 5000;
const JOB_LIMIT = 12;
const CONTROL_BUILD = '20260926-1340';

function telegramUrl(token, method) {
  return `https://api.telegram.org/bot${token}/${method}`;
}

async function tg(token, method, body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), BOT_API_TIMEOUT_MS);
  try {
    const response = await fetch(telegramUrl(token, method), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body || {}),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) {
      throw new Error(`${method}: ${data?.description || response.statusText || response.status}`);
    }
    return data.result;
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error(`${method}: Bot API timeout`);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function authorized(req) {
  const timestamp = String(req.headers['x-story-trigger-timestamp'] || '');
  const signature = String(req.headers['x-story-trigger-signature'] || '');
  const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});

  return EDGE_TRIGGER_PUBLIC_KEYS.some(publicKey => verifyEdgeSignature({
    publicKey,
    timestamp,
    body,
    signature,
    maxAgeMs: 120000,
  }));
}

function controlUrl(screen) {
  const base = 'https://telegram-story-bot-murex.vercel.app/studio.html';
  const url = new URL(base);
  url.searchParams.set('screen', screen);
  url.searchParams.set('v', CONTROL_BUILD);
  return url.toString();
}

function actorLabel(event = {}) {
  return event.actorDisplayName
    || (event.actorUsername ? `@${event.actorUsername}` : '')
    || 'Telegram user';
}

export function automationMessage(job) {
  const event = job?.event || {};
  const type = String(event.type || '');

  if (job?.ruleKey === 'security_changes') {
    if (type === 'session.created') {
      return {
        text: '🔐 Security\n\nDeep Intelligence подключён. Приватная Telegram session сохранена в encrypted v3.',
        screen: 'security',
        button: 'Открыть Security Center',
      };
    }
    if (type === 'session.revoked') {
      return {
        text: '🔐 Security\n\nDeep Intelligence session отозвана. Приватное подключение больше не активно.',
        screen: 'security',
        button: 'Открыть Security Center',
      };
    }
    return {
      text: '🔐 Security\n\nTelegram Control зафиксировал новое security-событие. Проверь Security Center.',
      screen: 'security',
      button: 'Открыть Security Center',
    };
  }

  if (job?.ruleKey === 'smart_action') {
    const actor = actorLabel(event);
    const chat = event?.payload?.chatTitle ? `\nЧат: ${event.payload.chatTitle}` : '';
    return {
      text: `⚡ Smart Inbox\n\n${actor}: новое входящее сообщение похоже требует внимания.${chat}\n\nЭто приоритетный сигнал, а не Telegram read-status.`,
      screen: 'chats',
      button: 'Открыть Smart Inbox',
    };
  }

  if (job?.ruleKey === 'confirmed_viewer') {
    const actor = actorLabel(event);
    const story = event?.storyId ? ` #${event.storyId}` : '';
    return {
      text: `👁 Intelligence\n\n${actor} подтверждён как viewer Story${story}.`,
      screen: 'viewers',
      button: 'Открыть Intelligence',
    };
  }

  return null;
}

async function deliver(token, job) {
  const message = automationMessage(job);
  if (!message) throw new Error('unsupported_automation_job');

  return tg(token, 'sendMessage', {
    chat_id: job.userId,
    text: message.text,
    disable_notification: false,
    reply_markup: {
      inline_keyboard: [[{
        text: message.button,
        web_app: { url: controlUrl(message.screen) },
      }]],
    },
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }
  if (!authorized(req)) {
    res.status(401).json({ ok: false, error: 'Unauthorized signed trigger' });
    return;
  }

  const token = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
  if (!token) {
    res.status(503).json({ ok: false, error: 'Telegram bot is not configured' });
    return;
  }

  let jobs = [];
  try {
    jobs = await claimAutomationJobs(JOB_LIMIT);
  } catch (error) {
    console.warn('Automation worker queue unavailable', error?.message || String(error));
    res.status(200).json({ ok: true, degraded: true, claimed: 0, sent: 0, failed: 0 });
    return;
  }

  let sent = 0;
  let failed = 0;

  for (const job of jobs) {
    try {
      await deliver(token, job);
      await completeAutomationJob(job.id, true);
      sent += 1;
    } catch (error) {
      failed += 1;
      const description = error?.message || String(error);
      await completeAutomationJob(job.id, false, description).catch(() => {});
      console.warn('Automation delivery failed', {
        job_id: job.id,
        rule: job.ruleKey,
        error: description,
      });
    }
  }

  res.status(200).json({
    ok: true,
    claimed: jobs.length,
    sent,
    failed,
  });
}
