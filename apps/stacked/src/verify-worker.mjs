import { replayStackedRun } from '../../portal/src/stacked-sim.mjs';
import { STACKED_MAX_TICKS } from '../../portal/src/stacked-contracts.mjs';

const REQUEST_KEYS = Object.freeze(['requestId', 'evidence', 'expectedSeed', 'maxTicks', 'config']);
const CONFIG_KEYS = Object.freeze(['startLevel', 'buildHash', 'seasonId']);
const REQUEST_ID_PATTERN = /^[a-z0-9][a-z0-9:_-]{0,63}$/;
const BUILD_HASH_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const SEASON_ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,63}$/;

const dataValue = (object, key) => {
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) throw new Error('invalid request');
  return descriptor.value;
};

const validateConfig = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new Error('invalid config');
  }

  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key !== 'string' || !CONFIG_KEYS.includes(key))) throw new Error('invalid config');

  const config = {};
  for (const key of keys) {
    const entry = dataValue(value, key);
    if (key === 'startLevel' && (!Number.isInteger(entry) || entry < 1 || entry > 15)) throw new Error('invalid config');
    if (key === 'buildHash' && (typeof entry !== 'string' || !BUILD_HASH_PATTERN.test(entry))) throw new Error('invalid config');
    if (key === 'seasonId' && (typeof entry !== 'string' || !SEASON_ID_PATTERN.test(entry))) throw new Error('invalid config');
    config[key] = entry;
  }
  return Object.freeze(config);
};

export function handleStackedVerificationRequest(request) {
  let requestId = null;
  try {
    if (!request || typeof request !== 'object' || Array.isArray(request) || Object.getPrototypeOf(request) !== Object.prototype) {
      throw new Error('invalid request');
    }

    const ownKeys = Reflect.ownKeys(request);
    const requestIdValue = dataValue(request, 'requestId');
    if (typeof requestIdValue !== 'string' || !REQUEST_ID_PATTERN.test(requestIdValue)) throw new Error('invalid request');
    requestId = requestIdValue;

    if (
      ownKeys.length !== REQUEST_KEYS.length
      || ownKeys.some((key) => typeof key !== 'string' || !REQUEST_KEYS.includes(key))
    ) throw new Error('invalid request');

    const evidence = dataValue(request, 'evidence');
    const expectedSeed = dataValue(request, 'expectedSeed');
    const maxTicks = dataValue(request, 'maxTicks');
    const configValue = dataValue(request, 'config');

    if (!(evidence instanceof Uint8Array)) throw new Error('invalid evidence');
    if (!Number.isInteger(expectedSeed) || expectedSeed < 0 || expectedSeed > 0xffffffff) throw new Error('invalid seed');
    if (!Number.isInteger(maxTicks) || maxTicks < 1 || maxTicks > STACKED_MAX_TICKS) throw new Error('invalid maxTicks');

    const config = validateConfig(configValue);
    const tuple = replayStackedRun(evidence, { expectedSeed, maxTicks, config });
    return { requestId, ok: true, tuple };
  } catch {
    return { requestId, ok: false, error: 'invalid-evidence' };
  }
}

// The worker computes canonical values only. Parent lifecycle owns claim hashes,
// trusted stamps and every persistence/achievement/leaderboard decision.
if (typeof self !== 'undefined' && typeof self.postMessage === 'function' && typeof self.document === 'undefined') {
  self.onmessage = event => self.postMessage(handleStackedVerificationRequest(event.data));
}
