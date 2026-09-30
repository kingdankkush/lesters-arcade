// Power-up world cards (2.0 weapons lane): the HD kit cards bind to the eight
// authored pickups, every transform is a pure function of the tick, and the
// module never reads simulation RNG or the initial bundle.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  PICKUP_CARD_BINDINGS, PICKUP_CARD_PALETTE, PICKUP_SPIN_MIN_WIDTH, PICKUP_BURST_TICKS,
  createPickupCardFrames, createPickupWorldCards, fitPickupCardFrame, pickupCardBob, pickupCardGlow, pickupCardSpin, pickupCollectBurst, spinFrame, pickupCardColor,
} from '../apps/hmh-reboot/src/pickup-world-cards.mjs';
import { pickupIndicators, drawPickupIndicators } from '../apps/hmh-reboot/src/pickup-indicators.mjs';
import { AUTHORED_PROP_ASSETS } from '../apps/hmh-reboot/src/authored-prop-layout.mjs';

const root = new URL('../', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('apps/portal/assets/generated/hmh-reboot-tripo-props-hd/hmh-tripo-props-hd.json', root), 'utf8'));
const legacyFrame = { frame: { x: 0, y: 0, w: 128, h: 160 }, alphaBounds: { x: 4, y: 4, w: 100, h: 150 }, anchor: { x: 0.5, y: 0.9 }, runtimeScale: 0.5, category: 'pickup' };

test('every authored pickup binds to a kit card on the pickups page and keeps its painted width', () => {
  assert.deepEqual(Object.keys(PICKUP_CARD_BINDINGS).sort(), [...AUTHORED_PROP_ASSETS.pickups].sort());
  const cards = createPickupCardFrames(manifest);
  assert.equal(cards.size, 8);
  for (const [assetId, sourceId] of Object.entries(PICKUP_CARD_BINDINGS)) {
    const frame = fitPickupCardFrame(cards.get(assetId), legacyFrame);
    assert.equal(frame.sourceAssetId, sourceId);
    assert.equal(frame.pageImage, 'tripo-props-hd-pickups-00.webp');
    assert.ok(Math.abs(frame.alphaBounds.w * frame.runtimeScale - 100 * 0.5) < 1e-9, `${assetId} painted width preserved`);
    assert.ok(Object.isFrozen(frame) && frame.category === 'pickup');
  }
  assert.throws(() => createPickupCardFrames({ ...manifest, runtimeAuthority: 'simulation' }), /projection-only/);
  assert.throws(() => fitPickupCardFrame(cards.get('bonus-life'), null), /no current world frame/);
});

test('spin, bob, glow and burst are deterministic in the tick and free of RNG; reduced motion holds the card still', () => {
  const random = Math.random; Math.random = () => { throw new Error('presentation must not draw RNG'); };
  try {
    for (const tick of [0, 17, 149, 150, 4321]) {
      assert.equal(pickupCardSpin({ tick, id: 'p1' }), pickupCardSpin({ tick, id: 'p1' }));
      assert.equal(pickupCardBob({ tick, id: 'p1' }), pickupCardBob({ tick, id: 'p1' }));
      assert.deepEqual(pickupCardGlow({ tick, id: 'p1', kind: 'timed', zoom: 1.5, x: 1, y: 2 }), pickupCardGlow({ tick, id: 'p1', kind: 'timed', zoom: 1.5, x: 1, y: 2 }));
      const width = pickupCardSpin({ tick, id: 'p1' });
      assert.ok(width >= PICKUP_SPIN_MIN_WIDTH && width <= 1);
    }
    assert.equal(pickupCardSpin({ tick: 3, id: 'p1' }), pickupCardSpin({ tick: 153, id: 'p1' }), 'the spin period is 150 ticks');
    assert.notEqual(pickupCardSpin({ tick: 3, id: 'p1' }), pickupCardSpin({ tick: 40, id: 'p1' }));
    assert.notEqual(pickupCardSpin({ tick: 3, id: 'p1' }), pickupCardSpin({ tick: 3, id: 'p2' }), 'placements are phase-offset by id');
    assert.equal(pickupCardSpin({ tick: 40, id: 'p1', reduceMotion: true }), 1);
    assert.throws(() => pickupCardSpin({ tick: -1, id: 'p1' }));
    const spun = spinFrame(legacyFrame, 0.5);
    assert.equal(spun.runtimeScale, 0.25); assert.equal(spun.projectionY, 2);
    assert.equal(spinFrame(legacyFrame, 1), legacyFrame);
    assert.equal(pickupCollectBurst({ age: PICKUP_BURST_TICKS, zoom: 1, kind: 'timed', x: 0, y: 0, id: 'b' }), null);
    const burst = pickupCollectBurst({ age: 5, zoom: 2, kind: 'weapon-cache', x: 10, y: 20, id: 'b' });
    assert.equal(burst.type, 'burst'); assert.equal(burst.color, PICKUP_CARD_PALETTE.cyan); assert.equal(burst.sparks.length, 8);
    assert.deepEqual(burst, pickupCollectBurst({ age: 5, zoom: 2, kind: 'weapon-cache', x: 10, y: 20, id: 'b' }));
    assert.equal(pickupCardColor('timed'), PICKUP_CARD_PALETTE.gold); assert.equal(pickupCardColor('heal'), PICKUP_CARD_PALETTE.gold);
  } finally { Math.random = random; }
});

function fakeDisplay(assetIds) {
  const entries = assetIds.map((assetId, i) => ({ placement: { id: `pk-${i}`, assetId, category: 'pickup', x: 100 + i, y: 100 }, frame: legacyFrame,
    sprite: { visible: true, texture: null, anchor: { x: 0, y: 0, set(x, y) { this.x = x; this.y = y; } } } }));
  return { get entries() { return Object.freeze([...entries]); }, raw: entries };
}
const pixi = () => ({ Assets: { load: async () => ({ source: { width: 2048, height: 2048 } }) }, Texture: class { constructor(o) { this.frame = o.frame; this.source = o.source; } }, Rectangle: class { constructor(x, y, w, h) { Object.assign(this, { x, y, w, h }); } } });
const fetchOk = async () => ({ ok: true, json: async () => manifest });

test('bound to a display, the cards swap textures once, spin the frame per tick and emit glow and collect markers under the cards', async () => {
  const display = fakeDisplay(['time-dilation', 'hash-rail-core']);
  const cards = createPickupWorldCards({ display, ...pixi(), fetchImpl: fetchOk });
  assert.equal(cards.status, 'loading');
  assert.deepEqual(cards.update({ tick: 1, camera: { zoom: 1 }, view: { width: 800, height: 600 }, worldToScreen: p => p, queryGround: () => ({ groundZ: 0 }) }), []);
  await cards.ready; assert.equal(cards.status, 'ready');
  const args = { state: { entries: display.raw.map(e => ({ placement: e.placement })) }, tick: 40, camera: { zoom: 1 }, view: { width: 800, height: 600 }, worldToScreen: p => ({ x: p.x, y: p.y - p.z }), queryGround: () => ({ groundZ: 0 }) };
  const first = cards.update(args), second = cards.update(args);
  assert.deepEqual(first, second, 'same tick, same markers');
  assert.equal(first.length, 2);
  assert.deepEqual(first.map(m => [m.type, m.color]), [['glow', PICKUP_CARD_PALETTE.gold], ['glow', PICKUP_CARD_PALETTE.cyan]]);
  assert.ok(first.every(m => m.y < 100), 'the glow sits above the ground pivot, on the card');
  for (const entry of display.raw) {
    assert.equal(entry.sprite.pickupCardId, PICKUP_CARD_BINDINGS[entry.placement.assetId]);
    assert.ok(Math.abs(entry.frame.runtimeScale * entry.frame.projectionY - entry.sprite.pickupCardFrame.runtimeScale) < 1e-9, 'spin keeps the height');
    assert.ok(entry.frame.runtimeScale <= entry.sprite.pickupCardFrame.runtimeScale + 1e-9, 'spin only thins the card');
    assert.ok(Math.abs(entry.sprite.pickupCardFrame.alphaBounds.w * entry.sprite.pickupCardFrame.runtimeScale - 50) < 1e-9, 'painted width preserved');
  }
  const texture = display.raw[0].sprite.texture;
  cards.update({ ...args, tick: 41 });
  assert.equal(display.raw[0].sprite.texture, texture, 'textures are created once per card');
  assert.notEqual(cards.update({ ...args, tick: 41 })[0].radius, first[0].radius, 'the glow pulses with the tick');
  // Collect: one burst per event id, drawn for PICKUP_BURST_TICKS then dropped.
  const event = { id: 'collectible-event:000001', type: 'collectible:collected', tick: 41, placementId: 'pk-0', kind: 'timed' };
  const withBurst = cards.update({ ...args, tick: 43, collectedEvent: event, hidden: new Set(['pk-0']) });
  assert.deepEqual(withBurst.map(m => m.type), ['glow', 'burst']);
  assert.equal(cards.burstCount, 1);
  cards.update({ ...args, tick: 44, collectedEvent: event, hidden: new Set(['pk-0']) });
  assert.equal(cards.burstCount, 1, 'the same event never bursts twice');
  assert.equal(cards.update({ ...args, tick: 41 + PICKUP_BURST_TICKS + 1, collectedEvent: event, hidden: new Set(['pk-0']) }).filter(m => m.type === 'burst').length, 0);
  assert.equal(cards.burstCount, 0);
  assert.equal(cards.update({ ...args, reduceMotion: true }).length, 2);
});

test('a failed kit load leaves the existing icons and markers in charge', async () => {
  const display = fakeDisplay(['bonus-life']);
  const cards = createPickupWorldCards({ display, ...pixi(), fetchImpl: async () => ({ ok: false, status: 404 }) });
  await cards.ready; assert.equal(cards.status, 'unavailable');
  assert.match(display.pickupCardError, /404/);
  assert.equal(display.raw[0].sprite.texture, null);
  assert.deepEqual(cards.update({ tick: 5, camera: { zoom: 1 }, view: { width: 8, height: 8 }, worldToScreen: p => p, queryGround: () => ({ groundZ: 0 }) }), []);
});

test('the indicator layer draws glow and burst markers and stays unchanged without a display', () => {
  const calls = [];
  const graphics = new Proxy({}, { get: (_, name) => (...args) => { calls.push([name, ...args]); return graphics; } });
  drawPickupIndicators(graphics, [
    { type: 'glow', x: 1, y: 2, radius: 10, color: 0xf2c56e, alpha: 0.3 },
    { type: 'burst', x: 1, y: 2, ringRadius: 12, ringAlpha: 0.5, color: 0x72ddeb, sparks: [{ x: 0, y: 0, alpha: 1 }] },
  ], 1);
  assert.deepEqual(calls.filter(c => c[0] === 'circle').length, 4);
  const entry = (id, kind) => ({ placement: { id, x: 100, y: 100, availableTick: 0 }, effect: { kind } });
  const markers = pickupIndicators({ state: { entries: [entry('a', 'timed')], collectedIds: new Set() }, tick: 30, camera: { zoom: 1 }, view: { width: 800, height: 600 }, worldToScreen: p => p, queryGround: () => ({ groundZ: 0 }) });
  assert.deepEqual(markers.map(m => m.id), ['a']);
  assert.ok(markers.every(m => m.type === undefined));
});
