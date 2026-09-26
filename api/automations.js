import { validateTelegramMiniApp } from '../lib/telegram-miniapp-auth.js';
import {
  getAutomationSettings,
  updateAutomationSettings,
  listAutomationJobs,
} from '../lib/viewer-sync-store.js';

const ALLOWED_RULES = new Set(['security_changes','smart_action','confirmed_viewer']);

function noStore(res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
}

function userFromRequest(req) {
  const token = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
  const initData = String(req.headers['x-telegram-init-data'] || '');
  if (!token) throw new Error('Telegram Control is not configured');
  return validateTelegramMiniApp(initData, token);
}

export default async function handler(req, res) {
  noStore(res);

  const user = userFromRequest(req);
  if (!user?.id) {
    res.status(401).json({ ok: false, error: 'Open Telegram Control inside Telegram' });
    return;
  }

  const userId = String(user.id);

  try {
    if (req.method === 'GET') {
      const [settings, jobs] = await Promise.all([
        getAutomationSettings(userId),
        listAutomationJobs(userId, 20),
      ]);
      res.status(200).json({ ok: true, settings, jobs });
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ ok: false, error: 'Method not allowed' });
      return;
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const action = String(body.action || '');

    if (action === 'update_rule') {
      const ruleKey = String(body.ruleKey || '');
      if (!ALLOWED_RULES.has(ruleKey)) {
        res.status(400).json({ ok: false, error: 'Unknown automation rule' });
        return;
      }
      const settings = await updateAutomationSettings(userId, {
        [ruleKey]: Boolean(body.enabled),
      });
      const jobs = await listAutomationJobs(userId, 20);
      res.status(200).json({ ok: true, settings, jobs });
      return;
    }

    if (action === 'refresh') {
      const [settings, jobs] = await Promise.all([
        getAutomationSettings(userId),
        listAutomationJobs(userId, 20),
      ]);
      res.status(200).json({ ok: true, settings, jobs });
      return;
    }

    res.status(400).json({ ok: false, error: 'Unknown action' });
  } catch (error) {
    console.error('Telegram Control automations API', error?.message || String(error));
    res.status(500).json({ ok: false, error: 'Automation Center временно недоступен' });
  }
}
