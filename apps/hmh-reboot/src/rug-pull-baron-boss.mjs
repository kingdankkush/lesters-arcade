// The Rug Pull Baron: the showman of the Hashwood River marquee clearing
// (slice HMH-BOSSES-2-4, area brief 06). A tall human ringmaster fought under
// a travelling marquee. Phases at the v7 thresholds (60% and 25%):
//
//   0 'grand-opening'   cane thrusts and whip cracks from the ring's edge;
//   1 'the-rug-pull'    adds the Rug Pull (a carpet yanked along a charge lane);
//   2 'curtain-call'    steers at the hero; the marquee sags between supers.
//
// The super is the Marquee Collapse: the canvas drops on the clearing except
// around the posts. It emits `arena:marquee-collapse` with its geometry so the
// world can drop the marquee later; nothing here moves a prop. Pure data plus
// the shared district engine.
import { freezeDeep } from './value-guards.mjs';
import { bindDistrictBoss, clampInto, defineDistrictBoss, rayExit, rotateDirection } from './district-boss-kit.mjs';

export const RUG_PULL_BARON_BOSS_ID = 'rug-pull-baron';
export const RUG_PULL_BARON_TARGET_ID = 'boss-rug-pull-baron';
export const RUG_PULL_BARON_ARENA_HOOK = 'arena:marquee-collapse';

export const RUG_PULL_BARON_BODY = freezeDeep({
  radius: 48, hurtRadius: 42, minZ: 4, maxZ: 108, armor: 0.6, knockbackResistance: 0.85,
  playerSeparationRadius: 76, maxPressureStep: 4, pinEscapeClearance: 44,
  walkUnitsPerTick: 1.8, steerUnitsPerTick: 2.2, dashUnitsPerTick: 12,
});

export const RUG_PULL_BARON_PHASES = freezeDeep([
  { id: 'grand-opening', index: 0, accent: 0xffb347 },
  { id: 'the-rug-pull', index: 1, accent: 0xff5c3a },
  { id: 'curtain-call', index: 2, accent: 0xd8a63a },
]);

export const RUG_PULL_BARON_ATTACKS = freezeDeep({
  'cane-thrust': { id: 'cane-thrust', tier: 'primitive', clip: 'attack', tellTicks: 40, recoveryTicks: 40, damage: 12, knockback: 18, width: 60, cooldownTicks: 120 },
  'whip-crack': { id: 'whip-crack', tier: 'primitive', clip: 'attack-2', tellTicks: 54, recoveryTicks: 50, damage: 14, knockback: 22, radius: 120, cooldownTicks: 200 },
  'rug-pull': { id: 'rug-pull', tier: 'primitive', clip: 'attack-2', tellTicks: 60, recoveryTicks: 60, damage: 16, knockback: 40, width: 90, maxDistance: 520, minPhase: 1, cooldownTicks: 300 },
  'marquee-collapse': { id: 'marquee-collapse', tier: 'super', clip: 'super', tellTicks: 150, recoveryTicks: 60, damage: 26, knockback: 32, radius: 420, repeatTicks: 1_200 },
});

function strikes(attackId, { boss, player, arena, phaseIndex, origin, toPlayer, interior, attack, strike }) {
  switch (attackId) {
    case 'cane-thrust': {
      const lane = (side) => {
        const direction = rotateDirection(toPlayer, side * (10 * Math.PI) / 180);
        const length = rayExit(origin, direction, arena.bounds);
        return { type: 'lane', origin, target: { x: origin.x + direction.x * length, y: origin.y + direction.y * length }, width: attack.width };
      };
      // Curtain Call thrusts twice: the centre lane, then a fan 16 ticks later.
      if (phaseIndex < 2) return [strike(lane(0), attack.tellTicks)];
      return [strike(lane(0), attack.tellTicks), strike({ type: 'union', shapes: [lane(-1), lane(1)] }, attack.tellTicks + 16)];
    }
    case 'whip-crack':
      return [strike({ type: 'circle', center: clampInto(player, interior), radius: attack.radius }, attack.tellTicks)];
    case 'rug-pull': {
      const length = Math.min(attack.maxDistance, rayExit(origin, toPlayer, arena.bounds));
      return [strike({ type: 'charge-lane', origin, target: { x: origin.x + toPlayer.x * length, y: origin.y + toPlayer.y * length }, width: attack.width }, attack.tellTicks, {
        dash: { direction: toPlayer, distance: length },
      })];
    }
    case 'marquee-collapse': {
      // The canvas section above the hero drops: a 420 disk locked where the
      // hero stood at the tell (walk-escape: (420 + 24) / 4 + 12 = 123 <= 150).
      const centre = clampInto(player, interior);
      const posts = arena.hookSites.map((site) => ({ x: site.x, y: site.y }));
      return [strike({ type: 'circle', center: centre, radius: attack.radius }, attack.tellTicks, {
        sectorId: 'marquee',
        hook: { type: RUG_PULL_BARON_ARENA_HOOK, payload: { section: centre, posts, stage: phaseIndex + 1, bossX: boss.x, bossY: boss.y } },
      })];
    }
    default:
      throw new TypeError(`unknown Rug Pull Baron attack ${attackId}`);
  }
}

export const RUG_PULL_BARON_DEFINITION = defineDistrictBoss({
  bossId: RUG_PULL_BARON_BOSS_ID,
  targetId: RUG_PULL_BARON_TARGET_ID,
  name: 'Rug Pull Baron',
  actorId: RUG_PULL_BARON_TARGET_ID,
  triggerId: 'marquee-threshold',
  arenaSize: 1_800,
  introTicks: 120,
  firstActionDelayTicks: 30,
  firstSuperDelayTicks: 900,
  markOffsets: [{ x: -520, y: -420 }, { x: 520, y: -420 }, { x: -520, y: 420 }, { x: 520, y: 420 }],
  hookOffsets: [{ x: -330, y: -560 }, { x: 330, y: -560 }, { x: 0, y: 560 }],
  body: RUG_PULL_BARON_BODY,
  phases: RUG_PULL_BARON_PHASES,
  attacks: RUG_PULL_BARON_ATTACKS,
  superId: 'marquee-collapse',
  fallbackAttacks: ['cane-thrust', 'whip-crack'],
  candidateAttacks: ({ phaseIndex, distance }) => {
    if (distance <= 240) return ['cane-thrust', 'whip-crack'];
    return ['whip-crack', 'cane-thrust', ...(phaseIndex >= 1 ? ['rug-pull'] : [])];
  },
  stallTicks: 4_800,
  endlessCycleTicks: 1_200,
  endlessCycle: [
    { offset: 60, attackId: 'cane-thrust' },
    { offset: 300, attackId: 'rug-pull' },
    { offset: 600, attackId: 'whip-crack' },
    { offset: 840, attackId: 'marquee-collapse' },
  ],
  strikes,
});

export const rugPullBaron = bindDistrictBoss(RUG_PULL_BARON_DEFINITION);
export const createRugPullBaronBoss = rugPullBaron.create;
export const stepRugPullBaronBoss = rugPullBaron.step;
export const applyRugPullBaronDamage = rugPullBaron.applyDamage;
export const resolveRugPullBaronAttack = rugPullBaron.resolveAttack;
export const rugPullBaronOpenArena = rugPullBaron.openArena;
