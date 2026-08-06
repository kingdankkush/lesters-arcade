function integer(value, minimum, maximum, name) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) throw new TypeError(`${name} must be an integer from ${minimum} to ${maximum}`);
  return value;
}

function elapsed(value) {
  if (!Number.isFinite(value) || value < 0 || value > 1_000_000_000) throw new TypeError('elapsedMs must be a finite bounded number');
  return value;
}

function resultInput({ seed, score, kills, elapsedMs }) {
  return {
    seed: integer(seed, 0, 0xffff_ffff, 'seed'),
    score: integer(score, 0, 1_000_000_000_000, 'score'),
    kills: integer(kills, 0, 10_000_000, 'kills'),
    elapsedMs: elapsed(elapsedMs),
  };
}

export function createRunScoreChecksum(input) {
  const value = resultInput(input);
  const text = `${value.seed}:${value.score}:${value.kills}:${value.elapsedMs.toFixed(3)}`;
  let hash = 0xcbf29ce484222325n;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= BigInt(text.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return `hmh-score:${hash.toString(16).padStart(16, '0')}`;
}

export function buildRunResultMessages(input) {
  const value = resultInput(input);
  if (!input.runSummary || typeof input.runSummary !== 'object' || Array.isArray(input.runSummary)) throw new TypeError('runSummary is required');
  return Object.freeze({
    runSummary: input.runSummary,
    scoreResult: Object.freeze({
      score: value.score,
      kills: value.kills,
      elapsedMs: value.elapsedMs,
      checksum: createRunScoreChecksum(value),
    }),
    gameOver: Object.freeze({
      score: value.score,
      kills: value.kills,
      elapsedMs: value.elapsedMs,
      reason: 'defeated',
    }),
  });
}

export function getWeb3AdapterStatus({ embedded, rankedEligible } = {}) {
  if (typeof embedded !== 'boolean' || typeof rankedEligible !== 'boolean') throw new TypeError('embedded and rankedEligible must be booleans');
  if (!embedded) return Object.freeze({ mode: 'offline', authority: 'none', label: 'Offline run · no wallet requested' });
  return Object.freeze({
    mode: rankedEligible ? 'ranked' : 'portal-free',
    authority: 'portal',
    label: rankedEligible ? 'Portal ranked settlement · wallet remains parent-owned' : 'Portal run tracking · wallet remains parent-owned',
  });
}
