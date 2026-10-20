import legacyHandler from '../../api/viewer-store-health.js';
import { toNetlify } from '../lib/legacy-adapter.mjs';

export default function handler(request) {
  return toNetlify(request, legacyHandler);
}

export const config = { path: '/api/viewer-store-health' };
