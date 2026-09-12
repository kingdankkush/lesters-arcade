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
      supply: 'A medkit cache sits south-east. The farmstead power station to the south opens a supply gate while you stand near it.',
      features: [
        { kind: 'arena', id: 'relay-training-yard', bearing: 'south' },
        { kind: 'poi', id: 'relay-cache', bearing: 'south-east', asset: 'bonus-life' },
        { kind: 'site', id: 'relay-power', bearing: 'south' },
      ],
    },
    ravine: {
      objective: 'Salvage the ravine, then follow it east to the Proof-of-Work bridge.',
      watch: 'The ambush bowl south-east funnels the horde. The quarry winch beyond it opens the salvage gate when held.',
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
      supply: 'The Berserk candle rests at the shrine to the south. The woodland sanctuary, also south, heals you while you hold it.',
      features: [
        { kind: 'arena', id: 'hashwood-clearing-arena', inside: true },
        { kind: 'poi', id: 'hashwood-shrine', bearing: 'south', asset: 'berserk-candle' },
        { kind: 'site', id: 'hashwood-shrine', bearing: 'south' },
      ],
    },
    mining: {
      objective: 'Work east through the camp toward the Liquidation Yard.',
      watch: 'The mining yard south-east is an arena, and its relief valve vents a steam hazard when run.',
      supply: 'The Machine Gun is in the control room to the north-east.',
      features: [
        { kind: 'arena', id: 'mining-yard-arena', bearing: 'south-east' },
        { kind: 'site', id: 'mining-valve', bearing: 'south-east' },
        { kind: 'poi', id: 'mining-control-room', bearing: 'north-east', asset: 'auto-miner', weapon: 'Machine Gun' },
      ],
    },
    yard: {
      objective: 'The Liquidator’s arena lies just east. Arm up, then hold your ground.',
      watch: 'The arena east is the Liquidator’s. The warehouse to the south opens a supply gate while you hold it.',
      supply: 'The Grenade Launcher sits at the extraction console to the south; a medkit cache lies south-east.',
      features: [
        { kind: 'arena', id: 'liquidator-arena', bearing: 'east' },
        { kind: 'site', id: 'yard-warehouse', bearing: 'south' },
        { kind: 'poi', id: 'yard-extraction-console', bearing: 'south', asset: 'launcher-rig', weapon: 'Grenade Launcher' },
        { kind: 'poi', id: 'yard-medbay-cache', bearing: 'south-east', asset: 'bonus-life' },
      ],
    },
  },
  tips: [
    'Your weapon fires on its own. Spend your attention on footwork and on where the crowd is thickest.',
    'Throw grenades into the thickest pack, not at the nearest enemy.',
    'Dodges and close combat trigger on their own. Keep moving so they have room to work.',
    'Stand near machinery to run it. Gates open and supplies unlock while you hold position.',
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
