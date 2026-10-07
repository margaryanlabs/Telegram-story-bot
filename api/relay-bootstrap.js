import { loadRelayNodes, telegramProxyLinks } from '../lib/relay-mesh.js';
import { inspectRelayPool } from '../lib/relay-probe.js';

const MAX_EXCLUDED = 8;

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(body));
}

function parseExcluded(req) {
  const raw = String(req.query?.exclude || '').trim();
  if (!raw) return [];
  return [...new Set(raw.split(',').map(value => value.trim()).filter(Boolean))].slice(0, MAX_EXCLUDED);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return json(res, 405, { ok:false, error:'method_not_allowed' });
  }

  const nodes = loadRelayNodes();
  if (!nodes.length) {
    return json(res, 503, {
      ok:false,
      configured:false,
      error:'relay_not_configured',
      message:'VETO Relay пока не получил ни одного relay-узла.',
    });
  }

  const excluded = parseExcluded(req);
  const inspected = await inspectRelayPool(nodes, { excluded });
  const selected = inspected.selected;

  if (!selected) {
    return json(res, 503, {
      ok:false,
      configured:true,
      error:'relay_unavailable',
      message:'Не удалось выбрать Relay-маршрут.',
    });
  }

  const links = telegramProxyLinks(selected);
  const routeHealth = selected.reachable ? 'verified' : 'degraded';

  return json(res, 200, {
    ok:true,
    configured:true,
    publicBootstrap:true,
    generatedAt:new Date().toISOString(),
    relay:{
      id:selected.id,
      label:selected.label,
      region:selected.region,
      latencyMs:selected.latencyMs,
      reachable:selected.reachable,
    },
    routeHealth,
    checked:inspected.probes.length,
    reachableCount:inspected.reachableCount,
    alternatives:nodes.length > 1,
    connectUrl:links?.https,
    tgUrl:links?.tg,
    manual:{
      server:selected.host,
      port:selected.port,
      secret:selected.secret,
    },
    telegramOnly:true,
    mode:'telegram-mtproxy',
    callsGuaranteed:false,
    voiceNote:'Текущий MTProxy предназначен прежде всего для Telegram data traffic. Качество и доступность voice/video calls не гарантируются.',
    note:selected.reachable
      ? 'Маршрут доступен с VETO edge. Финальное подключение подтверждает Telegram.'
      : 'VETO edge не подтвердил TCP-доступность. Маршрут сохранён как аварийный fallback; при проблеме попробуй альтернативный.',
  });
}
