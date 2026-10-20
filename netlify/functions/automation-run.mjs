import legacyHandler from '../../api/automation-run.js';
import { toNetlify } from '../lib/legacy-adapter.mjs';

export default function handler(request) {
  return toNetlify(request, legacyHandler);
}

export const config = { path: '/api/automation-run' };
