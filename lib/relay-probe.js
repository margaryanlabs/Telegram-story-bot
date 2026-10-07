import net from 'node:net';
import { selectRelay } from './relay-mesh.js';

export const DEFAULT_RELAY_PROBE_TIMEOUT_MS = 1600;

export function probeRelayNode(node, timeoutMs = DEFAULT_RELAY_PROBE_TIMEOUT_MS) {
  return new Promise(resolve => {
    const started = Date.now();
    let done = false;
    let socket;

    const finish = (reachable, error = null) => {
      if (done) return;
      done = true;
      try { socket?.destroy(); } catch {}
      resolve({
        id: node?.id,
        reachable,
        latencyMs: reachable ? Math.max(1, Date.now() - started) : null,
        error: error ? String(error).slice(0, 120) : null,
      });
    };

    try {
      socket = net.createConnection({ host: node.host, port: node.port });
      socket.setTimeout(timeoutMs);
      socket.once('connect', () => finish(true));
      socket.once('timeout', () => finish(false, 'timeout'));
      socket.once('error', error => finish(false, error?.code || error?.message || 'connect_error'));
    } catch (error) {
      finish(false, error?.code || error?.message || 'connect_error');
    }
  });
}

export async function inspectRelayPool(nodes, {
  excluded = [],
  timeoutMs = DEFAULT_RELAY_PROBE_TIMEOUT_MS,
} = {}) {
  const excludedIds = new Set((excluded || []).map(String));
  const pool = (nodes || []).filter(node => !excludedIds.has(String(node.id)));
  const candidates = pool.length ? pool : (nodes || []);

  const probes = await Promise.all(candidates.map(node =>
    probeRelayNode(node, timeoutMs).catch(error => ({
      id: node.id,
      reachable: false,
      latencyMs: null,
      error: error?.message || 'probe_error',
    }))
  ));

  return {
    candidates,
    probes,
    selected: selectRelay(candidates, probes, []),
    reachableCount: probes.filter(item => item.reachable).length,
  };
}
