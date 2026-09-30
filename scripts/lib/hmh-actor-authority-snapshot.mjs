// Browser-compatible test witness. Never imported by a shipped entry.
// Tagged values preserve Map/Set, object aliasing and exact numeric bits.
export function requireAuthorityFields(state, required) {
  for (const name of required) if (!Object.hasOwn(state, name)) throw new TypeError(`missing authority field ${name}`);
  return state;
}

export function serializeAuthority(state, { callbacks = [], accessors = [] } = {}) {
  const knownCallbacks = new Set(callbacks), knownAccessors = new Set(accessors), seen = new Map();
  const hex = bytes => [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
  const number = value => { const data = new DataView(new ArrayBuffer(8)); data.setFloat64(0, value, false); return ['f64', hex(new Uint8Array(data.buffer))]; };
  const encode = (value, path) => {
    if (value === null) return ['null'];
    if (value === undefined) return ['undefined'];
    if (typeof value === 'number') return number(value);
    if (typeof value === 'string' || typeof value === 'boolean') return [typeof value, value];
    if (typeof value === 'bigint') return ['bigint', String(value)];
    if (typeof value === 'function') {
      if (!knownCallbacks.has(path)) throw new TypeError(`unclassified callback ${path}`);
      return ['omitted-callback', path];
    }
    if (typeof value !== 'object') throw new TypeError(`unsupported authority ${path}`);
    if (seen.has(value)) return ['ref', seen.get(value)];
    const id = seen.size; seen.set(value, id);
    if (value instanceof Map) return ['map', id, [...value].map(([key, child], index) => [encode(key, `${path}.key${index}`), encode(child, `${path}.value${index}`)])];
    if (value instanceof Set) return ['set', id, [...value].map((child, index) => encode(child, `${path}.member${index}`))];
    if (value instanceof ArrayBuffer) return ['buffer', id, hex(new Uint8Array(value))];
    if (ArrayBuffer.isView(value)) return ['typed', id, value.constructor.name, hex(new Uint8Array(value.buffer, value.byteOffset, value.byteLength))];
    const entries = [];
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== 'string') throw new TypeError(`symbol authority key ${path}`);
      const descriptor = Object.getOwnPropertyDescriptor(value, key), childPath = `${path}.${key}`;
      if (!Object.hasOwn(descriptor, 'value') && !knownAccessors.has(childPath)) throw new TypeError(`unclassified accessor ${childPath}`);
      entries.push([key, encode(Object.hasOwn(descriptor, 'value') ? descriptor.value : value[key], childPath)]);
    }
    return [Array.isArray(value) ? 'array' : 'object', id, entries];
  };
  return JSON.stringify(encode(state, 'authority'));
}

export function captureAuthority(state, required) {
  requireAuthorityFields(state, required);
  // Simulation callback registries are code observers; never clone/call them.
  // All own numeric state, loss counters and both RNG stream Map entries stay.
  const normalized = { ...state };
  if (normalized.simulation) {
    normalized.simulation = { ...normalized.simulation };
    for (const name of ['stepCallbacks', 'replayCallbacks', 'projectionCallbacks']) delete normalized.simulation[name];
  }
  if (normalized.navGridAuthority) normalized.navGridAuthority = { ready: state.navGridAuthority.ready, grid: state.navGridAuthority.grid };
  if (normalized.playerDefeatController) normalized.playerDefeatController = { announced: state.playerDefeatController.announced };
  if (normalized.userZoom) normalized.userZoom = { factor: state.userZoom.factor };
  if (normalized.BOSS_LOCK_WORLD) normalized.BOSS_LOCK_WORLD = { collisionBlockers: state.BOSS_LOCK_WORLD.collisionBlockers };
  return serializeAuthority(normalized, { callbacks: [
    ...['cellAt', 'centreX', 'centreY', 'isWalkableCell', 'isWalkableAt'].flatMap(name => [`authority.ENEMY_NAV_GRID.${name}`, `authority.navGridAuthority.grid.${name}`]),
    'authority.enemyFlowField.directionAtCell',
    ...['lineBlocked','coverDirectionAt','chokepointDirectionAt','flankLaneDirectionAt','hazardDirectionAt','requestReplan','flowDirectionAt'].map(name => `authority.enemyNavigation.${name}`),
  ] });
}
