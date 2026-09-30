// Power-up world cards (2.0 weapons lane). The eight authored pickups swap
// their flat 256 px world icon for the HD Tripo kit's 512 px pickup card, then
// idle-bob (the authored display already owns the bob), spin slowly as a
// thinning card, wear a glow ring in the reserved gold/cyan palette and burst
// on collect. HUD icons, the upgrade panel icons and the four base weapon
// caches (no kit card exists for them) are untouched.
//
// Loaded only through the lazy pickup-indicators chunk. Every transform here
// is a pure function of the simulation tick and a placement id hashed through
// the presentation `seededUnit`; nothing reads simulation RNG, nothing writes
// simulation state, and a failed page load leaves the existing icons in charge.
import { seededUnit } from './deterministic-hash.mjs';

export const PICKUP_CARD_PIPELINE_ID = 'hmh-tripo-static-props-hd/v1';
export const PICKUP_CARD_PACKAGE_URL = '/assets/generated/hmh-reboot-tripo-props-hd/';
export const PICKUP_CARD_MANIFEST = 'hmh-tripo-props-hd.json';
export const PICKUP_CARD_BINDINGS = Object.freeze({
  'bonus-life': 'b1-33', 'berserk-candle': 'b1-34', 'time-dilation': 'b1-35', 'nuke-liquidation': 'b1-36',
  'hash-rail-core': 'b1-37', 'lightning-ledger-cache': 'b1-38', 'bear-market-burner-cache': 'b1-39', 'forked-standard-cache': 'b1-40',
});
export const PICKUP_CARD_PALETTE = Object.freeze({ gold: 0xf2c56e, cyan: 0x72ddeb });
export const PICKUP_SPIN_PERIOD_TICKS = 150;
export const PICKUP_SPIN_MIN_WIDTH = 0.14;
export const PICKUP_BURST_TICKS = 36;
export const PICKUP_MAX_BURSTS = 6;
const HASH = /^[a-f0-9]{64}$/u;
const fail = message => { throw new TypeError(`Pickup world cards: ${message}`); };
const rect = value => value && [value.x, value.y, value.w, value.h].every(Number.isInteger) && value.x >= 0 && value.y >= 0 && value.w > 0 && value.h > 0;

export const pickupCardColor = kind => kind === 'weapon-cache' ? PICKUP_CARD_PALETTE.cyan : PICKUP_CARD_PALETTE.gold;

/** Kit pickup cards keyed by runtime pickup asset id, unscaled until `fitPickupCardFrame` sees the frame the world draws today. */
export function createPickupCardFrames(manifest) {
  if (manifest?.pipelineId !== PICKUP_CARD_PIPELINE_ID || manifest.runtimeAuthority !== 'projection-only' || manifest.settlementLive !== false) fail('projection-only HD kit manifest required');
  const pages = manifest.classes?.pickups?.pages;
  if (!Array.isArray(pages) || pages.length !== 1 || !/^[a-z0-9-]+\.webp$/u.test(pages[0])) fail('one pickups page required');
  const page = manifest.pages?.find(entry => entry.image === pages[0]) ?? manifest.pages?.[pages[0]];
  const width = page?.width ?? 2048, height = page?.height ?? 2048;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width > 2048 || height > 2048) fail('page size invalid');
  const items = new Map((manifest.items ?? []).map(item => [item.assetId, item]));
  const frames = new Map();
  for (const [assetId, sourceId] of Object.entries(PICKUP_CARD_BINDINGS)) {
    const item = items.get(sourceId);
    if (!item || item.class !== 'pickups' || item.pageImage !== pages[0] || !rect(item.frame) || !rect(item.alphaBounds)
      || item.frame.x + item.frame.w > width || item.frame.y + item.frame.h > height
      || item.alphaBounds.x + item.alphaBounds.w > item.frame.w || item.alphaBounds.y + item.alphaBounds.h > item.frame.h
      || !Number.isFinite(item.anchor?.x) || !Number.isFinite(item.anchor?.y) || item.anchor.x < 0 || item.anchor.x > 1 || item.anchor.y < 0 || item.anchor.y > 1
      || !HASH.test(item.sourceModelSha256) || !HASH.test(item.sourcePixelSha256)) fail(`kit card ${sourceId} invalid for ${assetId}`);
    frames.set(assetId, Object.freeze({
      assetId, sourceAssetId: sourceId, category: 'pickup', page: 0, pageImage: pages[0],
      frame: Object.freeze({ ...item.frame }), anchor: Object.freeze({ ...item.anchor }), alphaBounds: Object.freeze({ ...item.alphaBounds }),
    }));
  }
  return frames;
}

/** The card at the painted width the world draws its current frame at (sharper, never larger). */
export function fitPickupCardFrame(card, current) {
  if (!current || !Number.isFinite(current.runtimeScale) || current.runtimeScale <= 0) fail(`no current world frame for ${card?.assetId}`);
  const paintedWidth = (current.alphaBounds?.w ?? current.frame.w) * current.runtimeScale;
  return Object.freeze({ ...card, runtimeScale: paintedWidth / card.alphaBounds.w, projectionY: 1 });
}

/** Width factor of the spinning card at a tick: a thinning turn, never a mirror, never zero. */
export function pickupCardSpin({ tick, id, reduceMotion = false }) {
  if (!Number.isInteger(tick) || tick < 0) throw new TypeError('spin needs a non-negative tick');
  if (reduceMotion) return 1;
  const phase = (tick % PICKUP_SPIN_PERIOD_TICKS) / PICKUP_SPIN_PERIOD_TICKS * Math.PI * 2 + seededUnit(0, id) * Math.PI * 2;
  return Math.max(PICKUP_SPIN_MIN_WIDTH, Math.abs(Math.cos(phase)));
}

/** The authored display's own idle bob (screen pixels above the ground pivot), repeated so the glow follows the card. */
export function pickupCardBob({ tick, id }) {
  return 8 + Math.sin((tick + seededUnit(0, id) * 60) / 16) * 5;
}

/** Frame variant that thins the card horizontally while the display keeps its own height. */
export function spinFrame(frame, width) {
  if (!(width > 0) || !(width <= 1)) throw new TypeError('spin width must be within (0, 1]');
  return width === 1 ? frame : Object.freeze({ ...frame, runtimeScale: frame.runtimeScale * width, projectionY: (frame.projectionY ?? 1) / width });
}

export function pickupCardGlow({ tick, id, kind, zoom = 1, reduceMotion = false, x, y }) {
  const pulse = reduceMotion ? 0.5 : 0.5 + Math.sin(tick / 22 + seededUnit(0, id) * 6.283) * 0.5;
  return Object.freeze({ type: 'glow', id, x, y, color: pickupCardColor(kind), radius: (16 + pulse * 4) * zoom, alpha: 0.16 + pulse * 0.14 });
}

export function pickupCollectBurst({ age, zoom = 1, kind, x, y, id }) {
  if (!Number.isInteger(age) || age < 0 || age >= PICKUP_BURST_TICKS) return null;
  const fade = 1 - age / PICKUP_BURST_TICKS;
  const sparks = [];
  for (let i = 0; i < 8; i++) {
    const angle = i / 8 * Math.PI * 2 + seededUnit(0, `${id}:${i}`) * 0.6, reach = (6 + age * 1.9) * zoom;
    sparks.push(Object.freeze({ x: x + Math.cos(angle) * reach, y: y - 10 * zoom + Math.sin(angle) * reach * 0.55 - age * 0.6 * zoom, alpha: fade * 0.9 }));
  }
  return Object.freeze({ type: 'burst', id, x, y, color: pickupCardColor(kind), ringRadius: (8 + age * 2.4) * zoom, ringAlpha: fade * 0.8, sparks: Object.freeze(sparks) });
}

/**
 * Bind the kit page to one authored prop display. `update` runs before the
 * display renders: it seats the card frames, sets this tick's spin frame and
 * returns the glow/burst markers the indicator layer draws under the cards.
 */
export function createPickupWorldCards({ display, Assets, Texture, Rectangle, fetchImpl = globalThis.fetch } = {}) {
  if (!display?.entries || typeof Assets?.load !== 'function' || typeof Texture !== 'function' || typeof Rectangle !== 'function') throw new TypeError('pickup world cards need a display, Assets, Texture and Rectangle');
  let status = 'loading', frames = null, page = null, lastEventId = null;
  const textures = new Map(), bursts = [];
  const ready = fetchImpl(`${PICKUP_CARD_PACKAGE_URL}${PICKUP_CARD_MANIFEST}`, { credentials: 'same-origin' })
    .then(async response => {
      if (!response.ok) throw new Error(`HD kit manifest failed: ${response.status}`);
      const built = createPickupCardFrames(await response.json());
      const texture = await Assets.load(`${PICKUP_CARD_PACKAGE_URL}${built.values().next().value.pageImage}`);
      if (!texture?.source) throw new Error('HD kit pickups page unavailable');
      frames = built; page = texture; status = 'ready';
    })
    .catch(error => { status = 'unavailable'; display.pickupCardError = String(error?.message ?? error); });
  const seat = entry => {
    const card = frames.get(entry.placement.assetId);
    if (!card) return null;
    if (entry.sprite.pickupCardId !== card.sourceAssetId) entry.sprite.pickupCardFrame = fitPickupCardFrame(card, entry.frame);
    const frame = entry.sprite.pickupCardFrame;
    if (entry.sprite.pickupCardId !== card.sourceAssetId) {
      let texture = textures.get(frame.sourceAssetId);
      if (!texture) { texture = new Texture({ source: page.source, frame: new Rectangle(frame.frame.x, frame.frame.y, frame.frame.w, frame.frame.h) }); textures.set(frame.sourceAssetId, texture); }
      entry.sprite.texture = texture; entry.sprite.anchor.set(frame.anchor.x, frame.anchor.y);
      entry.sprite.pickupCardId = frame.sourceAssetId; entry.sprite.sourceModelAssetId = frame.sourceAssetId;
    }
    return frame;
  };
  const update = ({ state, tick, camera, view, worldToScreen, queryGround, reduceMotion = false, collectedEvent = null, hidden = null } = {}) => {
    const markers = [];
    if (status !== 'ready') return markers;
    if (collectedEvent?.type === 'collectible:collected' && collectedEvent.id !== lastEventId) {
      lastEventId = collectedEvent.id;
      const placement = state?.entries?.find(entry => entry.placement.id === collectedEvent.placementId)?.placement;
      if (placement && Object.hasOwn(PICKUP_CARD_BINDINGS, placement.assetId)) {
        bursts.push({ id: placement.id, x: placement.x, y: placement.y, tick: collectedEvent.tick, kind: collectedEvent.kind });
        if (bursts.length > PICKUP_MAX_BURSTS) bursts.shift();
      }
    }
    for (const entry of display.entries) {
      if (entry.placement.category !== 'pickup') continue;
      const frame = seat(entry); if (!frame) continue;
      entry.frame = spinFrame(frame, pickupCardSpin({ tick, id: entry.placement.id, reduceMotion }));
      if (hidden?.has(entry.placement.id) || !entry.sprite.visible) continue;
      const q = worldToScreen({ x: entry.placement.x, y: entry.placement.y, z: queryGround(entry.placement.x, entry.placement.y).groundZ }, camera, view);
      if (q.x < -80 || q.x > view.width + 80 || q.y < -120 || q.y > view.height + 120) continue;
      const lift = pickupCardBob({ tick, id: entry.placement.id }) + (frame.anchor.y - 0.5) * frame.alphaBounds.h * frame.runtimeScale * camera.zoom;
      markers.push(pickupCardGlow({ tick, id: entry.placement.id, kind: entry.placement.assetId.endsWith('-cache') || entry.placement.assetId === 'hash-rail-core' ? 'weapon-cache' : 'timed', zoom: camera.zoom, reduceMotion, x: q.x, y: q.y - lift }));
    }
    for (let i = bursts.length - 1; i >= 0; i--) {
      const burst = bursts[i], age = tick - burst.tick;
      if (age >= PICKUP_BURST_TICKS || age < 0) { bursts.splice(i, 1); continue; }
      const q = worldToScreen({ x: burst.x, y: burst.y, z: queryGround(burst.x, burst.y).groundZ }, camera, view);
      const marker = pickupCollectBurst({ age, zoom: camera.zoom, kind: burst.kind, x: q.x, y: q.y, id: burst.id });
      if (marker) markers.push(marker);
    }
    return markers;
  };
  return Object.freeze({ get status() { return status; }, ready, update, display, get burstCount() { return bursts.length; } });
}
