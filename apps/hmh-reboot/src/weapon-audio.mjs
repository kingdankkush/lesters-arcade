// C1. Per-weapon audio identity.
//
// Every weapon played the same weapon-fire.ogg, with a volume tweak for the
// shotgun and a swap to the grenade cue for the launcher. A pistol, a shotgun,
// a minigun and a grenade launcher were therefore audibly the same gun, which
// removes the clearest non-visual signal the player has about what they are
// holding and what is shooting at them.
//
// These cues are synthesised in-repo by scripts/build-hmh-weapon-sfx.py rather
// than sourced, so they regenerate byte-for-byte like the Blender assets do.
// Each gun gets a distinct spectral identity, not a level change:
//   coin-blaster    bright, short, tight   -- a light sidearm crack
//   scatter-shotgun broadband, long tail   -- a heavy boom plus shell rattle
//   auto-miner      buzzy, mechanical      -- fast industrial chatter
//   launcher-rig    low, swept, hollow     -- a thump with a departing whoosh
//   lightning-ledger bright, stepped arc   -- a compact electrical chain snap

// Gains feed the existing category multiplier and 0.16 output ceiling. The
// older quiet input gains were being attenuated a second time by that mix.
export const HMH_WEAPON_SFX = Object.freeze(Object.fromEntries([
  ['fire-coin-blaster', .22], ['fire-scatter-shotgun', .22],
  ['fire-auto-miner', .21], ['fire-launcher-rig', .20],
  ['fire-hash-rail', .21], ['fire-lightning-ledger', .19],
  ['fire-bear-market-burner', .15], ['fire-forked-standard', .19],
  ['lightning-interrupt', .14], ['lightning-overheat', .15],
  ['lightning-empty', .15], ['hash-rail-charge', .11],
  ['weapon-reload', .24], ['weapon-empty', .20],
].map(([id, gain]) => [`hmh-${id}`, Object.freeze({ src: `../assets/audio/sfx/hmh-${id}.wav`, gain })])));

const FIRE_CUE_BY_WEAPON = Object.freeze({
  'coin-blaster': 'hmh-fire-coin-blaster',
  'scatter-shotgun': 'hmh-fire-scatter-shotgun',
  'auto-miner': 'hmh-fire-auto-miner',
  'launcher-rig': 'hmh-fire-launcher-rig',
  'hash-rail': 'hmh-fire-hash-rail',
  'lightning-ledger': 'hmh-fire-lightning-ledger',
  'bear-market-burner': 'hmh-fire-bear-market-burner',
  'forked-standard': 'hmh-fire-forked-standard',
});

// Falls back rather than throwing: this is called from inside the frame loop,
// so an unrecognised weapon must degrade to a sound, not kill the run.
export function weaponFireCueId(weaponId) {
  return FIRE_CUE_BY_WEAPON[weaponId] ?? 'hmh-fire-coin-blaster';
}

export function weaponFireGain(weaponId) {
  return HMH_WEAPON_SFX[weaponFireCueId(weaponId)].gain;
}
