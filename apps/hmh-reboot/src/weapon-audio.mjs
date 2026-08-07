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

export const HMH_WEAPON_SFX = Object.freeze({
  'hmh-fire-coin-blaster': Object.freeze({ src: '../assets/audio/sfx/hmh-fire-coin-blaster.wav', gain: 0.10 }),
  'hmh-fire-scatter-shotgun': Object.freeze({ src: '../assets/audio/sfx/hmh-fire-scatter-shotgun.wav', gain: 0.15 }),
  'hmh-fire-auto-miner': Object.freeze({ src: '../assets/audio/sfx/hmh-fire-auto-miner.wav', gain: 0.08 }),
  'hmh-fire-launcher-rig': Object.freeze({ src: '../assets/audio/sfx/hmh-fire-launcher-rig.wav', gain: 0.17 }),
  'hmh-fire-hash-rail': Object.freeze({ src: '../assets/audio/sfx/hmh-fire-hash-rail.wav', gain: 0.14 }),
  'hmh-fire-lightning-ledger': Object.freeze({ src: '../assets/audio/sfx/hmh-fire-lightning-ledger.wav', gain: 0.07 }),
  'hmh-fire-bear-market-burner': Object.freeze({ src: '../assets/audio/sfx/hmh-fire-bear-market-burner.wav', gain: 0.065 }),
  'hmh-lightning-interrupt': Object.freeze({ src: '../assets/audio/sfx/hmh-lightning-interrupt.wav', gain: 0.07 }),
  'hmh-lightning-overheat': Object.freeze({ src: '../assets/audio/sfx/hmh-lightning-overheat.wav', gain: 0.085 }),
  'hmh-lightning-empty': Object.freeze({ src: '../assets/audio/sfx/hmh-lightning-empty.wav', gain: 0.075 }),
  'hmh-hash-rail-charge': Object.freeze({ src: '../assets/audio/sfx/hmh-hash-rail-charge.wav', gain: 0.08 }),
  'hmh-weapon-reload': Object.freeze({ src: '../assets/audio/sfx/hmh-weapon-reload.wav', gain: 0.11 }),
  'hmh-weapon-empty': Object.freeze({ src: '../assets/audio/sfx/hmh-weapon-empty.wav', gain: 0.09 }),
});

const FIRE_CUE_BY_WEAPON = Object.freeze({
  'coin-blaster': 'hmh-fire-coin-blaster',
  'scatter-shotgun': 'hmh-fire-scatter-shotgun',
  'auto-miner': 'hmh-fire-auto-miner',
  'launcher-rig': 'hmh-fire-launcher-rig',
  'hash-rail': 'hmh-fire-hash-rail',
  'lightning-ledger': 'hmh-fire-lightning-ledger',
  'bear-market-burner': 'hmh-fire-bear-market-burner',
});

// Falls back rather than throwing: this is called from inside the frame loop,
// so an unrecognised weapon must degrade to a sound, not kill the run.
export function weaponFireCueId(weaponId) {
  return FIRE_CUE_BY_WEAPON[weaponId] ?? 'hmh-fire-coin-blaster';
}

export function weaponFireGain(weaponId) {
  return HMH_WEAPON_SFX[weaponFireCueId(weaponId)].gain;
}
