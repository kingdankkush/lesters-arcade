// Insertion briefing for the Level 1 loading panel.
//
// Projection only: this copy is read while native art decodes and never
// reaches the simulation, RNG, collision, replay or results. Every line names
// authored Level 1 features by id and compass bearing so a test can prove the
// copy against the world data instead of trusting prose. Later levels supply
// their own table under their own levelId; the resolver is data-driven.
import { freezeDeep } from './value-guards.mjs';

export const LEVEL_ONE_BRIEFING = freezeDeep({
  levelId: 'forked-frontier',
  entries: {
    relay: {
      objective: 'Follow the road east through the relay gate into Rugpull Ravine.',
      watch: 'The training yard south of the road is the first fight; the horde gathers there.',
      supply: 'Find a medkit south-east. Start the farmstead generator to the south, then enter its court for a Shotgun.',
      features: [
        { kind: 'arena', id: 'relay-training-yard', bearing: 'south' },
        { kind: 'poi', id: 'relay-cache', bearing: 'south-east', asset: 'bonus-life' },
        { kind: 'site', id: 'relay-power', bearing: 'south' },
      ],
    },
    ravine: {
      objective: 'Salvage the ravine, then follow it east to the Proof-of-Work bridge.',
      watch: 'The ambush bowl south-east funnels the horde. Find the Winch Handle, then crank the quarry winch beyond it for a Railgun court.',
      supply: 'The Shotgun waits to the south, below the road.',
      features: [
        { kind: 'arena', id: 'ravine-ambush-bowl', bearing: 'south-east' },
        { kind: 'site', id: 'ravine-winch', bearing: 'south-east' },
        { kind: 'poi', id: 'ravine-salvage', bearing: 'south', asset: 'scatter-shotgun', weapon: 'Shotgun' },
      ],
    },
    hashwood: {
      objective: 'Cross the beacon clearing and head east into the Mining Camp.',
      watch: 'You start inside the clearing arena; enemies close from the tree line on every side.',
      supply: 'Head south for Double Damage. Activate the woodland sanctuary to open the Litecoin Sanctuary haven: a medkit and grenade that restock.',
      features: [
        { kind: 'arena', id: 'hashwood-clearing-arena', inside: true },
        { kind: 'poi', id: 'hashwood-shrine', bearing: 'south', asset: 'berserk-candle' },
        { kind: 'site', id: 'hashwood-shrine', bearing: 'south' },
      ],
    },
    mining: {
      objective: 'Work east through the camp toward the Liquidation Yard.',
      watch: 'The mining yard south-east is an arena. Its relief valve opens the Liquidation Trap court, but vents steam across the mouth first.',
      supply: 'The Machine Gun is in the control room to the north-east.',
      features: [
        { kind: 'arena', id: 'mining-yard-arena', bearing: 'south-east' },
        { kind: 'site', id: 'mining-valve', bearing: 'south-east' },
        { kind: 'poi', id: 'mining-control-room', bearing: 'north-east', asset: 'auto-miner', weapon: 'Machine Gun' },
      ],
    },
    yard: {
      objective: 'Arm up, then ring the Closing Bell on the Margin Floor east when you are ready.',
      watch: 'The Margin Floor east is the Liquidator’s; its bell calls him from 10:00. The warehouse lever to the south opens a Flamethrower court.',
      supply: 'The Grenade Launcher sits at the extraction console to the south-east. Beat the Liquidator to open the Arc Rifle vault.',
      features: [
        { kind: 'arena', id: 'liquidator-arena', bearing: 'east' },
        { kind: 'site', id: 'yard-warehouse', bearing: 'south' },
        { kind: 'poi', id: 'yard-extraction-console', bearing: 'south-east', asset: 'launcher-rig', weapon: 'Grenade Launcher' },
      ],
    },
  },
  tips: [
    'Your weapon fires on its own. Spend your attention on footwork and on where the crowd is thickest.',
    'Throw grenades into the thickest pack, not at the nearest enemy.',
    'Close combat triggers on its own. Left Shift dodges on a keyboard; touch and gamepads dodge for you.',
    'Stand still in a machine’s ring to crank it; buttons and levers start as you pass. Progress is never lost.',
    'Level-ups offer a choice of upgrades. Pick the one that changes how you fight.',
    'The pause menu holds the field map: routes, machinery and every cache you have found.',
  ],
});

export const BRIEFING_SLOTS = Object.freeze(['objective', 'watch', 'supply', 'tip']);

// Same FNV-1a form as selectLevelEntry, on its own label, so the tip varies
// per run without consuming the combat RNG or coupling to the entry choice.
export function selectBriefingTip(seed, tips = LEVEL_ONE_BRIEFING.tips) {
  if (!Array.isArray(tips) || tips.length === 0) return null;
  let hash = 2166136261;
  for (const character of `level-1-tip:${seed}`) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;
  return tips[hash % tips.length];
}

export function resolveLevelBriefing({ entryId, seed, briefing = LEVEL_ONE_BRIEFING } = {}) {
  const entry = typeof entryId === 'string' ? briefing?.entries?.[entryId] : null;
  if (!entry) return null;
  return Object.freeze({
    levelId: briefing.levelId,
    entryId,
    objective: entry.objective,
    watch: entry.watch,
    supply: entry.supply,
    tip: selectBriefingTip(seed, briefing.tips),
  });
}

// Fills the loading panel's briefing slots. A missing panel or slot is fine:
// the static HTML copy stays as the truthful default.
export function applyLevelBriefing(panel, briefing) {
  if (!panel?.querySelector || !briefing) return 0;
  let applied = 0;
  for (const slot of BRIEFING_SLOTS) {
    const text = briefing[slot];
    const node = panel.querySelector(`[data-briefing-${slot}]`);
    if (!node || typeof text !== 'string' || text.length === 0) continue;
    node.textContent = text;
    applied += 1;
  }
  return applied;
}
