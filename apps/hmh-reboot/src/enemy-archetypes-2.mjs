// The six 2.0 enemy types. This module is deliberately NOT imported by the
// shipped entry, the encounter director or any initial-bundle module: the
// legacy ENEMY_ARCHETYPES / ROLE_ARCHETYPES tables stay exactly as certified,
// so Ranked plausibility, replays and the honest corpus cannot reach these ids.
// Consumers load it lazily (like the actor-3d chunks). Every stat below is a
// verbatim copy of the named `balanceSource` legacy archetype and carries
// `balancePending: true`; nothing here is a balance claim.
import { freezeDeep } from './value-guards.mjs';
import { ENEMY_ARCHETYPES, REQUIRED_ENEMY_VISUAL_STATES } from './enemy-archetypes.mjs';

function copyBalance(balanceSource) {
  const source = ENEMY_ARCHETYPES[balanceSource];
  if (!source) throw new TypeError(`unknown balance source archetype: ${String(balanceSource)}`);
  const { role, radius, speed, maxHealth, armor, knockbackResistance, preferredDistance, costs, attack, movement } = source;
  return { role, radius, speed, maxHealth, armor, knockbackResistance, preferredDistance,
    costs: { ...costs }, attack: { ...attack }, movement: { ...movement } };
}

function defineNewArchetype(definition) {
  return freezeDeep({
    ...copyBalance(definition.balanceSource),
    ...definition,
    balancePending: true,
    visual: {
      prototypeStates: [...REQUIRED_ENEMY_VISUAL_STATES],
      prototypeComplete: false,
      productionComplete: false,
      eliteEnabled: false,
      ...definition.visual,
    },
    // Temporary sprite presentation until each enemy has its own roster atlas:
    // reuse the closest legacy roster sprite with a distinct tint. The 3D
    // pilot GLB is the authored art; both are projection-only.
    spriteFallback: { ...definition.spriteFallback, temporary: true },
    actor3d: { file: `${definition.id}.glb`, manifest: `${definition.id}-manifest.json`, ...definition.actor3d },
  });
}

export const NEW_ENEMY_ARCHETYPES = freezeDeep({
  'rug-puller': defineNewArchetype({
    id: 'rug-puller',
    name: 'Rug Puller',
    identityForm: 'human',
    faction: 'forked-frontier-raiders',
    balanceSource: 'forkrunner',
    telegraph: 'Shoulders the rolled rug and whips the hook line out before yanking the floor away.',
    counterplay: 'Step off the marked rug line, break the pull with a Dash, or punish the wind-up.',
    visual: { silhouette: 'diamond', color: 0xc05bff },
    spriteFallback: { sourceActorId: 'forkrunner', tint: 0xc05bff },
  }),
  'pump-and-dump-bloater': defineNewArchetype({
    id: 'pump-and-dump-bloater',
    name: 'Pump-and-Dump Bloater',
    identityForm: 'human',
    faction: 'liquidation-authority',
    balanceSource: 'whale-enforcer',
    telegraph: 'Works the hand pump until the belly glows before the charge and burst.',
    counterplay: 'Keep distance while it inflates, circle the charge, and hit the deflated recovery.',
    visual: { silhouette: 'hexagon', color: 0x9be15d },
    spriteFallback: { sourceActorId: 'whale-enforcer', tint: 0x9be15d },
  }),
  tollkeeper: defineNewArchetype({
    id: 'tollkeeper',
    name: 'Tollkeeper',
    identityForm: 'human',
    faction: 'liquidation-authority',
    balanceSource: 'whale-enforcer',
    telegraph: 'Raises the striped barrier overhead and lights the beacon before the slam.',
    counterplay: 'Flank around the barrier side, bait the slam, and strike while the barrier is down.',
    visual: { silhouette: 'square', color: 0xff8a1f },
    spriteFallback: { sourceActorId: 'whale-enforcer', tint: 0xff8a1f },
  }),
  'hodl-revenant': defineNewArchetype({
    id: 'hodl-revenant',
    name: 'HODL Revenant',
    identityForm: 'zombie',
    faction: 'bad-debt-undead',
    balanceSource: 'bagholder-rusher',
    telegraph: 'Drags its chains taut and rears under the hood before the straight lunge.',
    counterplay: 'Sidestep the lunge line, Dash through the tell, or stagger it on the recovery.',
    visual: { silhouette: 'wedge', color: 0x8fd3ff },
    spriteFallback: { sourceActorId: 'bagholder-rusher', tint: 0x8fd3ff },
  }),
  'money-printer': defineNewArchetype({
    id: 'money-printer',
    name: 'Money Printer',
    identityForm: 'human',
    faction: 'liquidation-authority',
    balanceSource: 'gas-bomber',
    telegraph: 'Cranks the brass press and paints the green landing circle before the note burst.',
    counterplay: 'Leave the landing circle, close while the press is cranking, or interrupt the crank.',
    visual: { silhouette: 'orb', color: 0x5cff8a },
    spriteFallback: { sourceActorId: 'gas-bomber', tint: 0x5cff8a },
  }),
  'oracle-marksman': defineNewArchetype({
    id: 'oracle-marksman',
    name: 'Oracle Marksman',
    identityForm: 'human',
    faction: 'liquidation-authority',
    balanceSource: 'liquidator-agent',
    telegraph: 'Settles the ghillie cloak and lights the violet oracle scope lane before the shot.',
    counterplay: 'Leave the marked lane, break line of sight with cover, or close during the rechamber.',
    visual: { silhouette: 'star', color: 0xb36bff },
    spriteFallback: { sourceActorId: 'liquidator-agent', tint: 0xb36bff },
  }),
});

export const NEW_ENEMY_ARCHETYPE_IDS = Object.freeze(Object.keys(NEW_ENEMY_ARCHETYPES));

export function getNewEnemyArchetype(id) {
  if (typeof id !== 'string' || !Object.hasOwn(NEW_ENEMY_ARCHETYPES, id)) {
    throw new TypeError(`Unknown 2.0 enemy archetype: ${String(id)}`);
  }
  return NEW_ENEMY_ARCHETYPES[id];
}
