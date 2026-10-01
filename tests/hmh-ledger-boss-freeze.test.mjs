// A Lightning Ledger chain onto a boss must not freeze the boss. The chain
// links are shallow copies of their targets, and a deep freeze of the chain
// reached through them froze the live boss's own arrays (pendingEvents,
// pendingAttacks): the boss's next step threw "Cannot assign to read only
// property 'length'" every tick. Found by the ten-area real-child corpus (a
// 51% Foreman fight, docs/2.0/slices/HMH-RANKED-V8-TEN-AREA.md); the legacy
// Liquidator had the same latent fault.
import assert from 'node:assert/strict';
import test from 'node:test';
import { selectLightningLedgerChain, stepLightningLedger, createLightningLedgerState } from '../apps/hmh-reboot/src/lightning-ledger.mjs';
import { createLiquidatorBoss, stepLiquidatorBoss } from '../apps/hmh-reboot/src/liquidator-boss.mjs';
import { DISTRICT_BOSS_KITS } from '../apps/hmh-reboot/src/boss-slots.mjs';
import { createDistrictCourt } from '../apps/hmh-reboot/src/boss-courts-world-v1.mjs';

const player = { x: 0, y: 0, groundZ: 0 };

test('chaining onto the Liquidator leaves his state writable, and his next steps run', () => {
  const boss = createLiquidatorBoss({ x: 120, y: 0, startTick: 0, maxHealth: 1_000 });
  const chain = selectLightningLedgerChain({ origin: player, targets: [boss] });
  assert.deepEqual(chain.map((link) => [link.id, link.x, link.y]), [[boss.id, 120, 0]]);
  assert.ok(Object.isFrozen(chain) && Object.isFrozen(chain[0]), 'the chain itself stays frozen');
  for (const key of ['pendingEvents', 'pendingAttacks']) assert.equal(Object.isFrozen(boss[key]), false, key);
  assert.equal(Object.isFrozen(boss), false);
  for (let tick = 1; tick <= 600; tick += 1) stepLiquidatorBoss({ boss, tick, player });
});

test('chaining onto each district boss leaves its state writable, through the whole Ledger step', () => {
  for (const [bossId, kit] of Object.entries(DISTRICT_BOSS_KITS)) {
    const court = createDistrictCourt(bossId, { centre: { x: 0, y: 0 } });
    const boss = kit.create({ x: court.centre.x + 100, y: court.centre.y, startTick: 0, maxHealth: 2_000, arena: court, seed: 3 });
    const state = createLightningLedgerState();
    const near = { ...player, x: boss.x - 100, y: boss.y };
    for (let tick = 1; tick <= 3; tick += 1) {
      stepLightningLedger(state, { tick, fire: true, validPrimary: true, origin: near, targets: [boss] });
    }
    for (const key of ['pendingEvents', 'pendingAttacks']) assert.equal(Object.isFrozen(boss[key]), false, `${bossId} ${key}`);
    for (let tick = 1; tick <= 600; tick += 1) kit.step({ boss, tick, player: near });
  }
});
