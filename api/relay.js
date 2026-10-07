import { validateTelegramMiniApp } from '../lib/telegram-miniapp-auth.js';
import { loadRelayNodes, telegramProxyLinks } from '../lib/relay-mesh.js';
import { inspectRelayPool } from '../lib/relay-probe.js';
const MAX_EXCLUDED = 8;

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.end(JSON.stringify(body));
}

function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch { return {}; }
}

function authUser(req) {
  const token = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
  const initData = String(req.headers['x-telegram-init-data'] || '').trim();
  if (!token || !initData) return null;
  return validateTelegramMiniApp(initData, token, 86400);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { ok:false, error:'method_not_allowed' });
  }

  const user = authUser(req);
  if (!user) return json(res, 401, { ok:false, error:'telegram_auth_required' });

  const nodes = loadRelayNodes();
  const body = parseBody(req);
  const action = String(body.action || 'status').toLowerCase();

  if (action === 'status') {
    return json(res, 200, {
      ok:true,
      configured:nodes.length > 0,
      nodeCount:nodes.length,
      mode:'telegram-mtproxy',
      telegramOnly:true,
      canRotate:nodes.length > 1,
    });
  }

  if (!['connect', 'rotate'].includes(action)) {
    return json(res, 400, { ok:false, error:'unsupported_action' });
  }

  if (!nodes.length) {
    return json(res, 503, {
      ok:false,
      configured:false,
      error:'relay_not_configured',
      message:'VETO Relay пока не получил ни одного relay-узла.',
    });
  }

  const excluded = Array.isArray(body.exclude)
    ? [...new Set(body.exclude.map(String).filter(Boolean))].slice(0, MAX_EXCLUDED)
    : [];

  const inspected = await inspectRelayPool(nodes, { excluded });
  const selected = inspected.selected;
  if (!selected) {
    return json(res, 503, { ok:false, configured:true, error:'relay_unavailable' });
  }

  const links = telegramProxyLinks(selected);
  const reachableCount = inspected.reachableCount;

  return json(res, 200, {
    ok:true,
    configured:true,
    relay:{
      id:selected.id,
      label:selected.label,
      region:selected.region,
      latencyMs:selected.latencyMs,
      reachable:selected.reachable,
    },
    routeHealth:selected.reachable ? 'verified' : 'degraded',
    checked:inspected.probes.length,
    reachableCount,
    alternatives:nodes.length > 1,
    connectUrl:links?.https,
    tgUrl:links?.tg,
    telegramOnly:true,
    mode:'telegram-mtproxy',
    note:selected.reachable
      ? 'Маршрут доступен с VETO edge. Финальное подключение подтверждает Telegram.'
      : 'VETO edge не подтвердил TCP-доступность. Telegram всё равно может попробовать маршрут; при проблеме смени его.',
  });
}
