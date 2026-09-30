// Optional actor backend ownership contract. This module is not a 3D renderer.
// The lazy backend must return one Pixi
// display per actor so the existing world RenderLayer can interleave props.
import { worldToScreen } from './world-space.mjs';
import { worldDepthKey } from './world-depth.mjs';

const projections = new WeakSet();
const finite = (value, name) => {
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be finite`);
  return value;
};
const tint = value => Number.isInteger(value) && value >= 0 && value <= 0xffffff ? value : 0xffffff;
const identity = (value, name) => {
  if (typeof value !== 'string' || !value) throw new TypeError(`${name} must be a non-empty string`);
  return value;
};

export function isActor3dPilotEnabled(params) {
  return params?.get?.('actor3dPilot') === '1';
}

export function createActor3dProjection(actor, camera, viewport) {
  const position = Object.freeze({ x: finite(actor?.x, 'x'), y: finite(actor?.y, 'y'), z: finite(actor?.z ?? 0, 'z') });
  const clipTimeSeconds = finite(actor?.clipTimeSeconds ?? 0, 'clipTimeSeconds');
  if (clipTimeSeconds < 0) throw new TypeError('clipTimeSeconds must be non-negative');
  const screen = worldToScreen(position, camera, viewport);
  finite(screen.x, 'screen x'); finite(screen.y, 'screen y');
  const projection = Object.freeze({
    id: identity(actor?.id, 'id'), actorId: identity(actor?.actorId, 'actorId'), position,
    screen: Object.freeze(screen), bodyTint: tint(actor?.bodyTint), weaponTint: tint(actor?.weaponTint),
    depth: worldDepthKey(position.y), heading: finite(actor?.heading ?? 0, 'heading'),
    clip: identity(actor?.clip ?? 'idle', 'clip'), clipTimeSeconds,
    pixelsPerMetre: finite(actor?.pixelsPerMetre ?? 40, 'pixelsPerMetre'),
    zoom: finite(camera?.zoom ?? 1, 'zoom'),
    // Presentation identity of the held weapon (2.0 weapons lane); the
    // lazy backend may seat a weapon model on the hero's socket for it.
    weaponId: typeof actor?.weaponId === 'string' && actor.weaponId ? actor.weaponId : null,
  });
  if (projection.pixelsPerMetre <= 0 || projection.zoom <= 0) throw new TypeError('positive presentation scale required');
  projections.add(projection);
  return projection;
}

export function createActor3dPilotSession({ enabled = false, supported = false, createBackend,
  attachDisplay = () => {}, onFallback = () => {} } = {}) {
  let status = enabled ? 'idle' : 'disabled';
  let backend = null, pending = null;
  const displays = new Map();
  const release = () => {
    const owned = backend; backend = null;
    if (!owned) return;
    for (const display of displays.values()) {
      try { owned.removeDisplay(display); } catch {}
    }
    displays.clear();
    try { owned.dispose(); } catch {}
  };
  const fallback = reason => {
    if (status === 'disposed' || status === 'fallback') return;
    status = 'fallback'; release();
    try { onFallback(reason); } catch {}
  };
  const session = {
    get status() { return status; },
    start() {
      if (status !== 'idle') return pending ?? Promise.resolve(status);
      if (!supported || typeof createBackend !== 'function') {
        fallback('unsupported'); return Promise.resolve(status);
      }
      status = 'loading';
      pending = Promise.resolve().then(createBackend).then(loaded => {
        if (status !== 'loading') { try { loaded?.dispose?.(); } catch {} return status; }
        backend = loaded;
        for (const method of ['createDisplay', 'renderActor', 'removeDisplay', 'dispose']) {
          if (typeof backend?.[method] !== 'function') throw new TypeError(`actor backend missing ${method}`);
        }
        status = 'ready'; return status;
      }).catch(() => { fallback('renderer-failed'); return status; });
      return pending;
    },
    render(frame) {
      if (status !== 'ready') return false;
      const ids = new Set();
      for (const projection of frame) {
        if (!projections.has(projection) || ids.has(projection.id)) throw new TypeError('detached unique actor projection required');
        ids.add(projection.id);
      }
      try {
        for (const [id, display] of displays) {
          if (!ids.has(id)) { displays.delete(id); backend.removeDisplay(display); }
        }
        for (const projection of frame) {
          let display = displays.get(projection.id);
          if (!display) {
            display = backend.createDisplay(projection.id);
            displays.set(projection.id, display);
            attachDisplay(display);
          }
          display.zIndex = projection.depth;
        }
        backend.beginFrame?.(Object.freeze([...frame]));
        for (const projection of frame) {
          const display = displays.get(projection.id);
          backend.renderActor(display, projection);
        }
        return true;
      } catch { fallback('renderer-failed'); return false; }
    },
    handleContextLoss() { fallback('context-lost'); },
    handleFailure() { fallback('renderer-failed'); },
    dispose() { if (status !== 'disposed') { status = 'disposed'; release(); } },
  };
  return Object.freeze(session);
}

export function createLiquidator3dEntries(input) {
  if(!input?.active||!input.visible||input.alpha!==1
    ||!['idle','run','tell','attack','hit','death'].includes(input.pose?.state))return Object.freeze([]);
  const {x,y,z,bodyHeight,pose,original}=input;
  if(![x,y,z,bodyHeight].every(Number.isFinite)||bodyHeight<=0)throw new TypeError('private boss finite position and positive body scale required');
  if(!original||typeof original!=='object'||typeof original.renderable!=='boolean')throw new TypeError('private boss original display required');
  if(!Number.isInteger(pose.direction)||pose.direction<0||pose.direction>7)throw new TypeError('private boss pose direction required');
  const tick=pose.phaseTick??pose.tick;
  if(!Number.isFinite(tick))throw new TypeError('private boss finite pose clock required');
  const seconds=Math.max(0,tick)/60;
  const descriptor=Object.freeze({id:'boss:liquidator',actorId:'the-liquidator',x,y,z,
    heading:pose.direction*Math.PI/4,clip:pose.state,
    clipTimeSeconds:['idle','run'].includes(pose.state)?seconds%1:Math.min(1,seconds),pixelsPerMetre:bodyHeight/2.1});
  return Object.freeze([Object.freeze({descriptor,originals:Object.freeze([original])})]);
}
