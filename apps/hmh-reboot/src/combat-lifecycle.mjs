const MAX_HEALTH_LIMIT = 1_000_000;
const MAX_KILLS = 10_000_000;
const MAX_ELAPSED_MS = 1_000_000_000;

function finiteInRange(value, minimum, maximum, name) {
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new TypeError(`${name} must be a finite number from ${minimum} to ${maximum}`);
  }
  return value;
}

function integerInRange(value, minimum, maximum, name) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new TypeError(`${name} must be an integer from ${minimum} to ${maximum}`);
  }
  return value;
}

function freezeTransition({ health, maxHealth, kills, elapsedMs }) {
  return Object.freeze({
    statePayload: Object.freeze({
      status: 'game-over',
      score: 0,
      kills,
      elapsedMs,
      health,
      maxHealth,
      xp: 0,
      level: 1,
      paused: false,
    }),
    gameOverPayload: Object.freeze({
      score: 0,
      kills,
      elapsedMs,
      reason: 'defeated',
    }),
  });
}

export function createPlayerDefeatController({ maxHealth = 100 } = {}) {
  finiteInRange(maxHealth, 1, MAX_HEALTH_LIMIT, 'maxHealth');
  let announced = false;

  return Object.freeze({
    resolve({ health, kills, elapsedMs } = {}) {
      finiteInRange(health, 0, maxHealth, 'health');
      integerInRange(kills, 0, MAX_KILLS, 'kills');
      finiteInRange(elapsedMs, 0, MAX_ELAPSED_MS, 'elapsedMs');
      if (health > 0 || announced) return null;
      announced = true;
      return freezeTransition({ health, maxHealth, kills, elapsedMs });
    },
    get announced() {
      return announced;
    },
  });
}
