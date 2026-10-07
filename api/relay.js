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
function publicRelay(node) {
  if (!node) return null;
  return {
    id:node.id,label:node.label,region:node.region,
    latencyMs:node.latencyMs,reachable:node.reachable === true,
  };
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
      ok:true,configured:nodes.length>0,nodeCount:nodes.length,
      mode:'telegram-mtproxy',telegramOnly:true,canRotate:nodes.length>1,
    });
  }

  if (!nodes.length) {
    return json(res, 503, { ok:false,configured:false,error:'relay_not_configured',message:'VETO Connect временно недоступен.' });
  }

  if (action === 'health') {
    const currentId = String(body.currentId || '').trim();
    const inspected = await inspectRelayPool(nodes);
    const active = inspected.probes.find(item => String(item.id) === currentId) || null;
    const recommended = inspected.selected || null;
    return json(res, 200, {
      ok:true,configured:true,
      active:active ? { id:active.id,reachable:active.reachable===true,latencyMs:active.latencyMs } : null,
      recommended:publicRelay(recommended),
      shouldFailover:Boolean(
        currentId && active && active.reachable === false &&
        recommended?.reachable === true && String(recommended.id) !== currentId
      ),
      alternatives:nodes.length>1,
    });
  }

  if (!['connect','rotate'].includes(action)) {
    return json(res, 400, { ok:false,error:'unsupported_action' });
  }

  const excluded = Array.isArray(body.exclude)
    ? [...new Set(body.exclude.map(String).filter(Boolean))].slice(0,MAX_EXCLUDED)
    : [];
  const inspected = await inspectRelayPool(nodes,{excluded});
  const selected = inspected.selected;
  if (!selected) return json(res,503,{ok:false,configured:true,error:'relay_unavailable'});

  const links = telegramProxyLinks(selected);
  return json(res,200,{
    ok:true,configured:true,relay:publicRelay(selected),
    routeHealth:selected.reachable?'verified':'degraded',
    checked:inspected.probes.length,reachableCount:inspected.reachableCount,
    alternatives:nodes.length>1,connectUrl:links?.https,tgUrl:links?.tg,
    telegramOnly:true,mode:'telegram-mtproxy',
    note:selected.reachable
      ? 'Путь доступен. Финальный статус показывает Telegram.'
      : 'Путь не подтверждён VETO edge. При проблеме будет предложен запасной.',
  });
}