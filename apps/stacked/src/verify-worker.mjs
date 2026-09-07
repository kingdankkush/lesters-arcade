import { replayStackedRun } from '../../portal/src/stacked-sim.mjs';

export function handleStackedVerificationRequest(request) {
  const requestId = request && typeof request.requestId === 'string' && /^[a-z0-9][a-z0-9:_-]{0,63}$/.test(request.requestId) ? request.requestId : null;
  try {
    const keys = ['requestId', 'evidence', 'expectedSeed', 'maxTicks', 'config'];
    if (!request || Object.getPrototypeOf(request) !== Object.prototype || Reflect.ownKeys(request).length !== keys.length || !keys.every(key => Object.hasOwn(request, key)) || requestId === null) throw new Error('invalid request');
    if (!Number.isInteger(request.expectedSeed) || request.expectedSeed < 0 || request.expectedSeed > 0xffffffff) throw new Error('invalid seed');
    if (!request.config || Object.getPrototypeOf(request.config) !== Object.prototype) throw new Error('invalid config');
    const tuple = replayStackedRun(request.evidence, { expectedSeed: request.expectedSeed, maxTicks: request.maxTicks, config: request.config });
    return { requestId, ok: true, tuple };
  } catch { return { requestId, ok: false, error: 'invalid-evidence' }; }
}

// The worker computes canonical values only. Parent lifecycle owns claim hashes,
// trusted stamps and every persistence/achievement/leaderboard decision.
if (typeof self !== 'undefined' && typeof self.postMessage === 'function' && typeof self.document === 'undefined') {
  self.onmessage = event => self.postMessage(handleStackedVerificationRequest(event.data));
}
