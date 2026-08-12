function positiveFinite(value, name) {
  if (!Number.isFinite(value) || value <= 0) throw new TypeError(`${name} must be positive and finite`);
  return value;
}

function nonNegativeFinite(value, name) {
  if (!Number.isFinite(value) || value < 0) throw new TypeError(`${name} must be non-negative and finite`);
  return value;
}

export const RUNTIME_PERFORMANCE_PROFILES = Object.freeze({
  desktop: Object.freeze({
    id: 'desktop',
    resolutionCap: 2,
    antialias: true,
    particlesPerHazard: 10,
    worldCullMargin: 192,
    enemyCullMargin: 224,
    maxAnimatedEnemies: 96,
  }),
  mobile: Object.freeze({
    id: 'mobile',
    resolutionCap: 1.25,
    antialias: false,
    particlesPerHazard: 6,
    worldCullMargin: 128,
    enemyCullMargin: 160,
    maxAnimatedEnemies: 64,
  }),
  reducedMotion: Object.freeze({
    id: 'reduced-motion',
    resolutionCap: 1,
    antialias: false,
    particlesPerHazard: 0,
    worldCullMargin: 96,
    enemyCullMargin: 128,
    maxAnimatedEnemies: 48,
  }),
});

export function selectRuntimePerformanceProfile({ width, devicePixelRatio, coarsePointer, reduceMotion } = {}) {
  positiveFinite(width, 'width');
  positiveFinite(devicePixelRatio, 'devicePixelRatio');
  if (typeof coarsePointer !== 'boolean' || typeof reduceMotion !== 'boolean') throw new TypeError('coarsePointer and reduceMotion must be booleans');
  const base = reduceMotion
    ? RUNTIME_PERFORMANCE_PROFILES.reducedMotion
    : width <= 700 || coarsePointer
      ? RUNTIME_PERFORMANCE_PROFILES.mobile
      : RUNTIME_PERFORMANCE_PROFILES.desktop;
  return Object.freeze({
    ...base,
    resolution: Math.min(base.resolutionCap, devicePixelRatio),
  });
}

export function isScreenPointVisible(point, view, margin = 0) {
  const x = Number(point?.x);
  const y = Number(point?.y);
  const width = Number(view?.width);
  const height = Number(view?.height);
  if (![x, y, width, height].every(Number.isFinite)) throw new TypeError('screen point and view must be finite');
  positiveFinite(width, 'view.width');
  positiveFinite(height, 'view.height');
  nonNegativeFinite(margin, 'margin');
  return x >= -margin && x <= width + margin && y >= -margin && y <= height + margin;
}

export function selectAnimatedEnemyIds(entries, cap) {
  if (!Array.isArray(entries)) throw new TypeError('entries must be an array');
  if (!Number.isInteger(cap) || cap < 0) throw new TypeError('animation cap must be a non-negative integer');
  const priority = (entry) => {
    if (entry.state === 'tell' || entry.state === 'attack') return 0;
    if (entry.state === 'hit' || entry.state === 'death') return 1;
    if (entry.spawnCue === true) return 2;
    if (entry.elite === true) return 3;
    return 4;
  };
  return new Set(entries
    .filter((entry) => entry?.visible === true && typeof entry.id === 'string' && entry.id.length > 0)
    .map((entry, sourceIndex) => ({
      entry,
      sourceIndex,
      distance: nonNegativeFinite(entry.distance, `${entry.id}.distance`),
    }))
    .sort((left, right) => priority(left.entry) - priority(right.entry)
      || left.distance - right.distance
      || (left.entry.id < right.entry.id ? -1 : left.entry.id > right.entry.id ? 1 : left.sourceIndex - right.sourceIndex))
    .slice(0, cap)
    .map(({ entry }) => entry.id));
}

export function compactExpiredEventsInPlace(events, currentTick, maxAgeTicks) {
  if (!Array.isArray(events)) throw new TypeError('events must be an array');
  if (!Number.isInteger(currentTick) || currentTick < 0) throw new TypeError('currentTick must be a non-negative integer');
  if (!Number.isInteger(maxAgeTicks) || maxAgeTicks < 0) throw new TypeError('maxAgeTicks must be a non-negative integer');
  let writeIndex = 0;
  for (let readIndex = 0; readIndex < events.length; readIndex += 1) {
    const event = events[readIndex];
    if (!Number.isInteger(event?.tick) || event.tick < 0) throw new TypeError('event tick must be a non-negative integer');
    if (currentTick - event.tick > maxAgeTicks) continue;
    events[writeIndex] = event;
    writeIndex += 1;
  }
  events.length = writeIndex;
  return events;
}
