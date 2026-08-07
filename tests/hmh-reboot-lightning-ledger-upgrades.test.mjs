import assert from 'node:assert/strict';
import test from 'node:test';

import * as ledger from '../apps/hmh-reboot/src/lightning-ledger.mjs';
import * as progression from '../apps/hmh-reboot/src/run-progression.mjs';
import * as weapons from '../apps/hmh-reboot/src/weapon-system.mjs';

test('W8B Conductivity has three non-vacuous tiers and never exceeds eight targets', () => {
  const policies = [0, 1, 2, 3].map((conductivity) => weapons.applyWeaponProgression('lightning-ledger', {
    branches: { conductivity },
  }).channelPolicy);
  assert.deepEqual(policies.map((policy) => policy.jumpRange), [420, 460, 500, 540]);
  assert.deepEqual(policies.map((policy) => policy.maxTargets), [6, 6, 7, 8]);
  assert.ok(policies[3].lateChainRetentionPermille > policies[2].lateChainRetentionPermille);
  assert.ok(policies.every((policy) => policy.maxTargets <= ledger.LIGHTNING_LEDGER_CONFIG.maxJumps));
});

test('W8B Voltage has three non-vacuous tiers for contact, ramp, and last-arc force', () => {
  const profiles = [0, 1, 2, 3].map((voltage) => weapons.applyWeaponProgression('lightning-ledger', {
    branches: { voltage },
  }));
  assert.ok(profiles[1].damage > profiles[0].damage);
  assert.ok(profiles[2].channelPolicy.rampDurationTicks < profiles[1].channelPolicy.rampDurationTicks);
  assert.ok(profiles[3].channelPolicy.lastArcKnockbackMultiplier > profiles[2].channelPolicy.lastArcKnockbackMultiplier);
});

test('W8B Reconciliation has three non-vacuous tiers for reserve, recovery, and bounded full-chain refund', () => {
  const profiles = [0, 1, 2, 3].map((reconciliation) => weapons.applyWeaponProgression('lightning-ledger', {
    branches: { reconciliation },
  }));
  assert.ok(profiles[1].reserveAmmoGrant > profiles[0].reserveAmmoGrant);
  assert.ok(profiles[2].reloadTicks < profiles[1].reloadTicks);
  assert.equal(profiles[3].channelPolicy.fullChainCellRefund, true);
  assert.equal(profiles[2].channelPolicy.fullChainCellRefund, false);
});

test('W8B Proof of Network is prerequisite-gated and boosts only a fixed ordinal pulse', () => {
  assert.equal(typeof progression.unlockRunProgressionWeapon, 'function');
  assert.equal(typeof progression.getEligibleRunUpgradeIds, 'function');
  const state = progression.createRunProgression({ seed: 19 });
  assert.ok(!progression.getEligibleRunUpgradeIds(state).some((id) => id.startsWith('ledger-')));
  progression.unlockRunProgressionWeapon(state, 'lightning-ledger');
  let eligible = progression.getEligibleRunUpgradeIds(state);
  assert.ok(['ledger-conductivity', 'ledger-voltage', 'ledger-reconciliation'].every((id) => eligible.includes(id)));
  assert.ok(!eligible.includes('proof-of-network'));
  state.ranks['ledger-conductivity'] = 3;
  state.ranks['ledger-voltage'] = 3;
  state.ranks['ledger-reconciliation'] = 3;
  eligible = progression.getEligibleRunUpgradeIds(state);
  assert.ok(eligible.includes('proof-of-network'));

  const profile = weapons.applyWeaponProgression('lightning-ledger', {
    branches: { conductivity: 3, voltage: 3, reconciliation: 3 },
    capstoneId: 'proof-of-network',
  });
  const stateMachine = ledger.createLightningLedgerState();
  const targets = Array.from({ length: 9 }, (_, index) => ({ id: `target-${index}`, x: 90 + index * 70, y: 0, active: true }));
  const pulses = [];
  for (let tick = 0; tick <= 30; tick += 6) {
    const frame = ledger.stepLightningLedger(stateMachine, {
      tick,
      fire: true,
      validPrimary: true,
      origin: { x: 0, y: 0 },
      targets,
      lineOfSight: () => true,
      policy: profile.channelPolicy,
    });
    pulses.push(...frame.events.filter((event) => event.type === 'ledger:pulse'));
  }
  assert.ok(pulses.every((pulse) => pulse.chainIds.length <= 8));
  assert.deepEqual(pulses.map((pulse) => pulse.proofDamagePermille), [1000, 1000, 1000, 1000, 1250]);
});
