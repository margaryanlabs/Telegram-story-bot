import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRelayNodes, rankRelayNodes, selectRelay, telegramProxyLinks } from '../lib/relay-mesh.js';

const secretA = 'a'.repeat(32);
const secretB = 'b'.repeat(32);

test('parseRelayNodes validates, deduplicates and limits relay config', () => {
  const nodes = parseRelayNodes(JSON.stringify([
    { id:'eu-1', host:'relay.example.com', port:443, secret:secretA, priority:80, region:'de' },
    { id:'eu-1', host:'duplicate.example.com', port:443, secret:secretB },
    { id:'bad', host:'bad host', port:443, secret:secretA },
  ]));
  assert.equal(nodes.length, 1);
  assert.equal(nodes[0].id, 'eu-1');
  assert.equal(nodes[0].region, 'DE');
});

test('telegramProxyLinks builds native and https MTProxy links', () => {
  const [node] = parseRelayNodes(JSON.stringify([
    { id:'r1', host:'1.2.3.4', port:8443, secret:secretA },
  ]));
  const links = telegramProxyLinks(node);
  assert.match(links.tg, /^tg:\/\/proxy\?/);
  assert.match(links.https, /^https:\/\/t\.me\/proxy\?/);
  assert.match(links.https, /server=1\.2\.3\.4/);
  assert.match(links.https, /port=8443/);
});

test('selectRelay prefers reachable low-latency node while respecting priority', () => {
  const nodes = parseRelayNodes(JSON.stringify([
    { id:'a', host:'a.example.com', port:443, secret:secretA, priority:50 },
    { id:'b', host:'b.example.com', port:443, secret:secretB, priority:50 },
  ]));
  const selected = selectRelay(nodes, [
    { id:'a', reachable:true, latencyMs:120 },
    { id:'b', reachable:true, latencyMs:45 },
  ]);
  assert.equal(selected.id, 'b');
});

test('rankRelayNodes pushes unreachable nodes behind reachable nodes', () => {
  const nodes = parseRelayNodes(JSON.stringify([
    { id:'a', host:'a.example.com', port:443, secret:secretA, priority:100 },
    { id:'b', host:'b.example.com', port:443, secret:secretB, priority:0 },
  ]));
  const ranked = rankRelayNodes(nodes, [
    { id:'a', reachable:false },
    { id:'b', reachable:true, latencyMs:900 },
  ]);
  assert.equal(ranked[0].id, 'b');
});
