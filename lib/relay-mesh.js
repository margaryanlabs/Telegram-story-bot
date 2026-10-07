const HOST_RE = /^(?=.{1,253}$)(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$|^(?:\\d{1,3}\\.){3}\\d{1,3}$/;
const SECRET_RE = /^[0-9a-f]{32,512}$/i;

function cleanText(value, fallback, max = 64) {
  const text = String(value ?? '').trim().replace(/[\\r\\n\\t]/g, ' ');
  return (text || fallback).slice(0, max);
}

function normalizeNode(input, index = 0) {
  if (!input || typeof input !== 'object') return null;

  const host = String(input.host || input.server || '').trim().toLowerCase();
  const port = Number(input.port || 443);
  const secret = String(input.secret || '').trim().replace(/^0x/i, '');
  if (!HOST_RE.test(host)) return null;
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
  if (!SECRET_RE.test(secret) || secret.length % 2 !== 0) return null;

  const priority = Math.max(0, Math.min(100, Number(input.priority ?? 50) || 50));
  return {
    id: cleanText(input.id, `relay-${index + 1}`, 48).replace(/[^a-zA-Z0-9_-]/g, '-'),
    label: cleanText(input.label, `Relay ${index + 1}`),
    region: cleanText(input.region, 'AUTO', 32).toUpperCase(),
    host,
    port,
    secret,
    priority,
    enabled: input.enabled !== false,
  };
}

export function parseRelayNodes(raw, fallback = {}) {
  let source = [];
  if (String(raw || '').trim()) {
    try {
      const parsed = JSON.parse(String(raw));
      source = Array.isArray(parsed) ? parsed : parsed?.nodes || [];
    } catch {
      source = [];
    }
  }

  if (!source.length && fallback.host && fallback.secret) {
    source = [{
      id: fallback.id || 'primary',
      label: fallback.label || 'Primary Relay',
      region: fallback.region || 'AUTO',
      host: fallback.host,
      port: fallback.port || 443,
      secret: fallback.secret,
      priority: fallback.priority ?? 50,
      enabled: true,
    }];
  }

  const seen = new Set();
  return source
    .map(normalizeNode)
    .filter(Boolean)
    .filter(node => {
      if (!node.enabled || seen.has(node.id)) return false;
      seen.add(node.id);
      return true;
    })
    .slice(0, 12);
}

export function loadRelayNodes(env = process.env) {
  return parseRelayNodes(env.VETO_RELAY_NODES, {
    id: env.VETO_RELAY_ID,
    label: env.VETO_RELAY_LABEL,
    region: env.VETO_RELAY_REGION,
    host: env.VETO_RELAY_HOST,
    port: env.VETO_RELAY_PORT,
    secret: env.VETO_RELAY_SECRET,
    priority: env.VETO_RELAY_PRIORITY,
  });
}

export function telegramProxyLinks(node) {
  if (!node) return null;
  const params = new URLSearchParams({
    server: node.host,
    port: String(node.port),
    secret: node.secret,
  });
  const query = params.toString();
  return {
    tg: `tg://proxy?${query}`,
    https: `https://t.me/proxy?${query}`,
  };
}

export function rankRelayNodes(nodes, probes = [], excluded = []) {
  const excludedIds = new Set((excluded || []).map(String));
  const probeMap = new Map((probes || []).map(item => [String(item.id), item]));

  return (nodes || [])
    .filter(node => !excludedIds.has(String(node.id)))
    .map(node => {
      const probe = probeMap.get(String(node.id));
      const reachable = probe?.reachable === true;
      const latencyMs = Number.isFinite(Number(probe?.latencyMs)) ? Number(probe.latencyMs) : null;
      const healthPenalty = reachable ? 0 : 100000;
      const latencyScore = latencyMs ?? 5000;
      const priorityBonus = Number(node.priority || 0) * 20;
      return {
        ...node,
        reachable,
        latencyMs,
        score: healthPenalty + latencyScore - priorityBonus,
      };
    })
    .sort((a, b) => a.score - b.score);
}

export function selectRelay(nodes, probes = [], excluded = []) {
  const ranked = rankRelayNodes(nodes, probes, excluded);
  if (!ranked.length) return null;
  const reachable = ranked.find(node => node.reachable);
  return reachable || ranked[0];
}
