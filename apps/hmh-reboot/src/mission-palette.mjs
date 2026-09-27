// Objective visual language (design package §3.3, slice S1.4). Projection
// only: rings, lamps, beams and the tracker read these colours; nothing in the
// simulation does. Glyph and shape always carry the meaning with the colour.
import { freezeDeep } from './value-guards.mjs';

// The combat telegraph colours an objective must never reuse (§3.3): enemy
// tells, pickups and the heal flash.
export const MISSION_TELEGRAPH_COLORS = Object.freeze([0xff496c, 0xfff06a, 0x83f28f, 0xffc857, 0xe26dff]);

export const MISSION_PALETTE = freezeDeep({
  // Machines, gates and items: ivory with a dark outline, a dashed ring with
  // hazard chevrons.
  mechanism: { ring: 0xfff4d6, outline: 0x05070f },
  // A locked node: grey ring, padlock and the missing item's icon.
  locked: { ring: 0x8b8f98, outline: 0x05070f },
  // Prisoners wear their reward's HUD colour (prisoner slice).
  prisoner: { 'field-medic': 0x45ff8a, quartermaster: 0x19f7ff, pawnbroker: 0x6f9bff, 'og-miner': 0xffe84d },
  strongbox: 0x6f9bff,
  // Boss triggers: a dark band with bone-white spikes, never red or pink.
  boss: { band: 0x241a33, spikes: 0xf2ead8 },
  // Status lamps pair a shape with a colour: red X missing, amber ! ready,
  // green check done.
  lamp: { missing: 0xd8433a, ready: 0xffa53a, done: 0x3fc46f },
  panel: 0x0b1116,
});

export const MISSION_LAMP_SHAPES = Object.freeze({ missing: 'x', ready: 'bang', done: 'check' });
