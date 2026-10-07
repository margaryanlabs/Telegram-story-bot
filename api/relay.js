import net from 'node:net';
import { validateTelegramMiniApp } from '../lib/telegram-miniapp-auth.js';
import { loadRelayNodes, selectRelay, telegramProxyLinks } from '../lib/relay-mesh.js';

const PROBE_TIMEOUT_MS = 1600;
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

function probeTcp(node, timeoutMs = PROBE_TIMEOUT_MS) {
  return new Promise(resolve => {
    const started = Date.now();
    let done = false;
    const finish = (reachable, error = null) => {
      if (done) return;
      done = true;
      try { socket.destroy(); } catch {}
      resolve({
        id: node.id,
        reachable,
        latencyMs: reachable ? Math.max(1, Date.now() - started) : null,
        error: error ? String(error).slice(0, 120) : null,
      });
    };

    const socket = net.createConnection({ host: node.host, port: node.port });
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false, 'timeout'));
    socket.once('error', error => finish(false, error?.code || error?.message || 'connect_error'));
  });
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

  const candidates = nodes.filter(node => !excluded.includes(String(node.id)));
  const pool = candidates.length ? candidates : nodes;
  const probes = await Promise.all(pool.map(node => probeTcp(node).catch(error => ({
    id:node.id,
    reachable:false,
    latencyMs:null,
    error:error?.message || 'probe_error',
  }))));

  const selected = selectRelay(pool, probes, []);
  if (!selected) {
    return json(res, 503, { ok:false, configured:true, error:'relay_unavailable' });
  }

  const links = telegramProxyLinks(selected);
  const reachableCount = probes.filter(item => item.reachable).length;

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
    checked:probes.length,
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
