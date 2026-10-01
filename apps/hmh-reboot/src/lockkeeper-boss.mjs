// The Lockkeeper: the warden of the Scrypt Bayou lock (slice HMH-BOSSES-2-4,
// area brief 05). A gaunt zombie in a mossy cloak with the lock's great key,
// chest chains and the winch drum on his shoulder. Phases at the v7
// thresholds (65% and 30%):
//
//   0 'high-water'   key sweeps up close, chain lashes at range;
//   1 'lock-down'    adds the Lock Down (padlock seals stamped along the hero);
//   2 'drained'      steers at the hero; the winch cranks between supers.
//
// The super is the Winch: the drum hauls the gate chains across the court and
// only the dry decks by the control house stay safe. It emits `arena:winch`
// with the pull line and safe decks so the world can bind gates, winches and
// the hero's footing later; nothing here moves water or a gate. Pure data
// plus the shared district engine.
import { freezeDeep } from './value-guards.mjs';
import { bindDistrictBoss, clampInto, defineDistrictBoss } from './district-boss-kit.mjs';

export const LOCKKEEPER_BOSS_ID = 'lockkeeper';
export const LOCKKEEPER_TARGET_ID = 'boss-lockkeeper';
export const LOCKKEEPER_ARENA_HOOK = 'arena:winch';

export const LOCKKEEPER_BODY = freezeDeep({
  radius: 52, hurtRadius: 46, minZ: 4, maxZ: 110, armor: 0.8, knockbackResistance: 0.9,
  playerSeparationRadius: 80, maxPressureStep: 4, pinEscapeClearance: 46,
  walkUnitsPerTick: 1.5, steerUnitsPerTick: 1.9, dashUnitsPerTick: 0,
});

export const LOCKKEEPER_PHASES = freezeDeep([
  { id: 'high-water', index: 0, accent: 0x7fe08a },
  { id: 'lock-down', index: 1, accent: 0x4fd6c6 },
  { id: 'drained', index: 2, accent: 0xb8ff6a },
]);

export const LOCKKEEPER_ATTACKS = freezeDeep({
  'key-sweep': { id: 'key-sweep', tier: 'primitive', clip: 'attack', tellTicks: 50, recoveryTicks: 45, damage: 14, knockback: 26, innerRadius: 40, outerRadius: 150, cooldownTicks: 150 },
  'chain-lash': { id: 'chain-lash', tier: 'primitive', clip: 'attack-2', tellTicks: 44, recoveryTicks: 40, damage: 12, knockback: 30, width: 56, maxDistance: 560, cooldownTicks: 160 },
  'lock-down': { id: 'lock-down', tier: 'primitive', clip: 'attack-2', tellTicks: 56, recoveryTicks: 55, damage: 14, knockback: 20, radius: 104, stepTicks: 18, minPhase: 1, cooldownTicks: 240 },
  winch: { id: 'winch', tier: 'super', clip: 'super', tellTicks: 140, recoveryTicks: 60, damage: 24, knockback: 34, radius: 480, repeatTicks: 1_300 },
});

function strikes(attackId, { boss, player, arena, phaseIndex, origin, toPlayer, interior, attack, strike }) {
  switch (attackId) {
    case 'key-sweep':
      return [strike({ type: 'ring', center: origin, innerRadius: attack.innerRadius, outerRadius: attack.outerRadius }, attack.tellTicks)];
    case 'chain-lash': {
      const length = Math.min(attack.maxDistance, Math.hypot(player.x - boss.x, player.y - boss.y) + 60);
      return [strike({ type: 'chain-link', a: origin, b: { x: origin.x + toPlayer.x * length, y: origin.y + toPlayer.y * length }, width: attack.width }, attack.tellTicks)];
    }
    case 'lock-down': {
      // Two seals (three from Drained) stamped along the hero's movement line.
      const count = phaseIndex >= 2 ? 3 : 2;
      const vx = (player.vx ?? 0) / 60;
      const vy = (player.vy ?? 0) / 60;
      return Array.from({ length: count }, (_, k) => strike({
        type: 'circle',
        center: clampInto({ x: player.x + vx * attack.stepTicks * k, y: player.y + vy * attack.stepTicks * k }, interior),
        radius: attack.radius,
      }, attack.tellTicks + attack.stepTicks * k));
    }
    case 'winch': {
      // The gate chains sweep a 480 disk around the drum on his shoulder
      // (walk-escape: (480 + 24) / 4 + 12 = 138 <= 140); the decks are where
      // the world can anchor the winch line.
      const decks = arena.hookSites.map((site) => ({ x: site.x, y: site.y }));
      const drum = { x: boss.x, y: boss.y };
      return [strike({ type: 'circle', center: drum, radius: attack.radius }, attack.tellTicks, {
        sectorId: 'winch',
        hook: { type: LOCKKEEPER_ARENA_HOOK, payload: { drum, decks, pullUnitsPerTick: 1.5 + phaseIndex * 0.5, stage: phaseIndex + 1 } },
      })];
    }
    default:
      throw new TypeError(`unknown Lockkeeper attack ${attackId}`);
  }
}

export const LOCKKEEPER_DEFINITION = defineDistrictBoss({
  bossId: LOCKKEEPER_BOSS_ID,
  targetId: LOCKKEEPER_TARGET_ID,
  name: 'The Lockkeeper',
  actorId: LOCKKEEPER_TARGET_ID,
  triggerId: 'lock-threshold',
  arenaSize: 1_800,
  introTicks: 120,
  firstActionDelayTicks: 30,
  firstSuperDelayTicks: 960,
  markOffsets: [{ x: -500, y: -440 }, { x: 500, y: -440 }, { x: -500, y: 440 }, { x: 500, y: 440 }],
  hookOffsets: [{ x: -560, y: 0 }, { x: 560, y: 0 }],
  body: LOCKKEEPER_BODY,
  phases: LOCKKEEPER_PHASES,
  attacks: LOCKKEEPER_ATTACKS,
  superId: 'winch',
  fallbackAttacks: ['chain-lash', 'key-sweep'],
  candidateAttacks: ({ phaseIndex, distance }) => {
    if (distance < 190) return ['key-sweep', 'chain-lash'];
    return ['chain-lash', ...(phaseIndex >= 1 ? ['lock-down'] : []), 'key-sweep'];
  },
  stallTicks: 5_000,
  endlessCycleTicks: 1_300,
  endlessCycle: [
    { offset: 60, attackId: 'chain-lash' },
    { offset: 300, attackId: 'lock-down' },
    { offset: 600, attackId: 'key-sweep' },
    { offset: 900, attackId: 'winch' },
  ],
  strikes,
});

export const lockkeeper = bindDistrictBoss(LOCKKEEPER_DEFINITION);
export const createLockkeeperBoss = lockkeeper.create;
export const stepLockkeeperBoss = lockkeeper.step;
export const applyLockkeeperDamage = lockkeeper.applyDamage;
export const resolveLockkeeperAttack = lockkeeper.resolveAttack;
export const lockkeeperOpenArena = lockkeeper.openArena;
