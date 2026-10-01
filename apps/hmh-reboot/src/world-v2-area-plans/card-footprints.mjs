// Collision classes and painted ground footprints of the HD kit cards, for
// the ten-area collision-to-art rule (docs/2.0/slices/WORLD-COLLISION-ART.md).
// A card that reads as something you cannot walk through (building, structure,
// vehicle, barrier, wall, container, large prop, big rock, or a tree trunk or
// pole taller than about 1.2 m) must stand on a collision blocker; grass,
// flowers, shrubs, ferns, low debris, motorcycles, rails, floors and overhead
// gantries never block. Footprints are the manifest's `groundFootprintPixels`
// clipped to the painted alpha bounds (cardGroundPixels in the art schema),
// relative to the card anchor, as fractions of the painted (alpha) height:
// [left, right, back, front]; `front` is nearest the camera. The audit test
// proves this table equals the manifest. Pure frozen data, no rules.
import { freezeDeep } from '../value-guards.mjs';

export const CARD_BLOCKING_HEIGHT = 48; // ~1.2 m at 40 units per metre
// A barrier reads as a wall from knee height (a 0.8 m jersey barrier is 32);
// the same slab cut down to a headstone or rubble block stays walk-over debris.
export const CARD_BARRIER_MIN_HEIGHT = 30;
export const CARD_COLLISION_CLASSES = freezeDeep({
  // Buildings and structures (a rock arch is a big rock).
  'b1-11': 'building', 'b1-12': 'building', 'b1-13': 'building', 'b1-15': 'building', 'b1-46': 'building', 'b1-47': 'building',
  'b1-51': 'building', 'b1-52': 'building', 'b1-56': 'building', 'b2-45': 'building', 'b2-53': 'building', 'b2-62': 'building',
  'b2-63': 'building', 'b2-64': 'building', 'b2-65': 'building', 'b2-66': 'building', 'b2-67': 'building', 'b2-68': 'building',
  'b2-69': 'building', 'b2-76': 'rock', 'b2-77': 'building', 'b1-43': 'container',
  'b1-14': 'building', 'b1-48': 'building', 'b2-50': 'building',
  // Vehicles (a motorcycle is low clutter).
  'b1-16': 'vehicle', 'b1-45': 'vehicle', 'b2-54': 'vehicle', 'b2-55': 'vehicle', 'b2-56': 'vehicle', 'b2-57': 'vehicle',
  'b2-58': 'vehicle', 'b2-59': 'vehicle', 'b2-60': 'vehicle', 'b2-61': 'exempt',
  // Barriers and walls from knee height: jersey barriers, guardrails, barricades, sandbags, hedgerows.
  'b2-49': 'barrier', 'b1-18': 'barrier', 'b1-17': 'barrier', 'b2-75': 'barrier',
  // Large props and rocks (block only above the blocking height).
  'b1-19': 'large-prop', 'b1-20': 'large-prop', 'b1-41': 'large-prop', 'b1-44': 'large-prop', 'b2-79': 'large-prop',
  'b2-80': 'large-prop', 'b2-74': 'large-prop', 'b2-73': 'large-prop', 'b1-49': 'large-prop', 'b1-42': 'rock',
  // Trees and poles block at the trunk.
  'b1-03': 'tree', 'b1-50': 'tree', 'b1-53': 'tree', 'b1-54': 'tree', 'b1-55': 'tree', 'b2-70': 'tree', 'b2-71': 'tree', 'b2-72': 'tree', 'b2-52': 'pole',
  // Walk-through: shrubs, flowers, ferns, reeds, crack decals, rails, floors and bridge decks, overhead gantries.
  'b1-01': 'exempt', 'b1-02': 'exempt', 'b1-04': 'exempt', 'b1-05': 'exempt', 'b1-06': 'exempt', 'b1-07': 'exempt', 'b1-08': 'exempt',
  'b1-09': 'exempt', 'b1-10': 'exempt', 'b2-47': 'exempt', 'b2-78': 'exempt', 'b2-41': 'exempt', 'b2-46': 'exempt', 'b2-51': 'exempt',
  'b2-42': 'exempt', 'b2-43': 'exempt', 'b2-44': 'exempt',
  // A road guardrail stands only on a verge backed by the corridor's closed
  // land (world-roads.mjs), which holds a body; the rail itself never blocks.
  'b2-48': 'exempt',
});
const ALWAYS_BLOCK = new Set(['building', 'container', 'vehicle']);
const HEIGHT_GATED = new Set(['large-prop', 'rock', 'tree', 'pole']);

export const CARD_GROUND_EXTENTS = freezeDeep({
  'b1-01':[-0.5654,0.5586,-0.4008,0.2305], 'b1-02':[-0.4544,0.4477,-0.3827,0.2824], 'b1-03':[-0.2242,0.2171,-0.3199,0.0709], 'b1-04':[-0.5267,0.5208,-0.3919,0.3054],
  'b1-05':[-0.3423,0.3358,-0.3929,0.2557], 'b1-06':[-0.4163,0.4099,-0.3473,0.2516], 'b1-07':[-0.3513,0.345,-0.2977,0.2026], 'b1-08':[-0.3849,0.3786,-0.3122,0.2675],
  'b1-09':[-0.4019,0.395,-0.3062,0.1007], 'b1-10':[-0.636,0.629,-0.4729,0.2892], 'b1-11':[-0.243,0.2389,-0.2327,0.2278], 'b1-12':[-0.3838,0.3838,-0.1943,0.1714],
  'b1-13':[-1.0607,1.0607,-0.2092,0.1922], 'b1-14':[-0.2314,0.2276,-0.1481,0.1323], 'b1-15':[-0.313,0.3093,-0.1521,0.1397], 'b1-16':[-0.3281,0.3225,-0.3519,0.2493],
  'b1-17':[-0.4524,0.4466,-0.4258,0.3873], 'b1-18':[-1.1133,1.1134,-0.2015,0.188], 'b1-19':[-0.2406,0.2345,-0.3217,0.2766], 'b1-20':[-0.2513,0.2513,-0.1346,0.1181],
  'b1-41':[-0.3021,0.3021,-0.1468,0.1129], 'b1-42':[-0.4374,0.4303,-0.3919,0.3808], 'b1-43':[-0.4903,0.487,-0.1857,0.1836], 'b1-44':[-0.302,0.302,-0.1434,0.1385],
  'b1-45':[-1.089,1.089,-0.3433,0.3022], 'b1-46':[-0.3071,0.3034,-0.3178,0.3146], 'b1-47':[-0.2567,0.253,-0.1867,0.1608], 'b1-48':[-0.3189,0.3149,-0.302,0.261],
  'b1-49':[-0.4093,0.4027,-0.3296,0.3228], 'b1-50':[-0.2278,0.2213,-0.1987,0.1126], 'b1-51':[-0.5447,0.5411,-0.3179,0.3018], 'b1-52':[-0.4702,0.4702,-0.235,0.2079],
  'b1-53':[-0.2875,0.2807,-0.317,0.25], 'b1-54':[-0.2457,0.2397,-0.2885,0.2403], 'b1-55':[-0.3484,0.341,-0.378,0.1593], 'b1-56':[-0.4118,0.4118,-0.1916,0.1687],
  'b2-41':[-0.2171,0.2133,-0.4333,0.4239], 'b2-42':[-0.1634,0.1597,-0.3274,0.2586], 'b2-43':[-0.1223,0.1223,-0.4658,0.4608], 'b2-44':[-0.0919,0.0881,-0.4544,0.3427],
  'b2-45':[-0.4612,0.4576,-0.3547,0.3496], 'b2-46':[-1.191,1.1831,-0.2523,0.2311], 'b2-47':[-0.9146,0.9054,-0.4434,0.4312], 'b2-48':[-2.5226,2.5227,-0.1982,0.1029],
  'b2-49':[-1.3006,1.2876,-0.2585,0.2419], 'b2-50':[-0.1678,0.164,-0.2541,0.1372], 'b2-51':[-1.0434,1.0434,-0.1081,0.0957], 'b2-52':[-0.3437,0.3352,-0.1476,0.0001],
  'b2-53':[-0.3485,0.3417,-0.4062,0.0276], 'b2-54':[-0.8633,0.8547,-0.3109,0.2641], 'b2-55':[-1.1453,1.1454,-0.3132,0.2717], 'b2-56':[-0.8559,0.8474,-0.2983,0.2404],
  'b2-57':[-1.5771,1.5613,-0.3286,0.2779], 'b2-58':[-0.8671,0.8584,-0.3019,0.2984], 'b2-59':[-0.9059,0.9059,-0.2871,0.2852], 'b2-60':[-0.6399,0.6335,-0.2726,0.2596],
  'b2-61':[-0.7381,0.7381,-0.243,0.1487], 'b2-62':[-0.3932,0.3897,-0.2453,0.2315], 'b2-63':[-1.0494,1.0424,-0.3088,0.3053], 'b2-64':[-0.6553,0.6509,-0.4071,0.1204],
  'b2-65':[-0.4814,0.4774,-0.1841,0.1623], 'b2-66':[-0.6582,0.6538,-0.3675,0.3539], 'b2-67':[-0.2965,0.2922,-0.3419,0.2977], 'b2-68':[-0.7898,0.7846,-0.3165,0.3114],
  'b2-69':[-0.4917,0.4878,-0.2545,0.2231], 'b2-70':[-0.3212,0.3148,-0.3542,0.2143], 'b2-71':[-0.5068,0.5003,-0.3886,0.2783], 'b2-72':[-0.1885,0.1812,-0.2874,0.0909],
  'b2-73':[-0.5652,0.559,-0.3993,0.3951], 'b2-74':[-0.4771,0.4701,-0.3701,0.1493], 'b2-75':[-1.1323,1.1323,-0.2107,0.16], 'b2-76':[-0.5275,0.5233,-0.3822,0.3611],
  'b2-77':[-0.3818,0.378,-0.3276,0.2442], 'b2-78':[-1.0324,1.0221,-0.4822,0.4767], 'b2-79':[-0.6238,0.6174,-0.3766,0.361], 'b2-80':[-0.3208,0.3152,-0.2668,0.2648],
});

export const cardCollisionClass = source => CARD_COLLISION_CLASSES[source] ?? 'unclassified';
export function cardBlocks(source, height) {
  const kind = cardCollisionClass(source);
  return ALWAYS_BLOCK.has(kind) || (kind === 'barrier' && height >= CARD_BARRIER_MIN_HEIGHT) || (HEIGHT_GATED.has(kind) && height > CARD_BLOCKING_HEIGHT);
}
// Trunk or pole half-width in world units.
export const trunkHalfWidth = (kind, height) => kind === 'pole' ? 8 : Math.max(10, Math.min(16, height * 0.04));
// The painted ground footprint of a card standing at (x, y), `height` tall.
export function cardGroundFootprint(source, x, y, height, flip = false) {
  const extents = CARD_GROUND_EXTENTS[source];
  if (!extents) return null;
  const [left, right, back, front] = extents.map(v => v * height);
  return { minX: x + (flip ? -right : left), maxX: x + (flip ? -left : right), minY: y + back, maxY: y + front };
}
// The part of a card that must stand on a blocker: the painted footprint, or
// the trunk/pole square for trees and poles. Null when the card never blocks.
export function cardBlockingFootprint(source, x, y, height, flip = false) {
  if (!cardBlocks(source, height)) return null;
  const kind = cardCollisionClass(source);
  // The trunk square stops where the card stops painting ground.
  if (kind === 'tree' || kind === 'pole') { const t = trunkHalfWidth(kind, height); return { minX: x - t, minY: y - t, maxX: x + t, maxY: Math.min(y + t, y + CARD_GROUND_EXTENTS[source][3] * height) }; }
  return cardGroundFootprint(source, x, y, height, flip);
}
