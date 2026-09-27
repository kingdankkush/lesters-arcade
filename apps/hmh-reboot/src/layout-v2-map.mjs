import { LAYOUT_V2_BOUNDS } from './layout-v2-kit.mjs';

// Level 1 layout v2 (Forked Frontier), greybox description. Pure data, read by
// layout-v2-kit.mjs (surfaces, collision, render pieces) and
// layout-v2-checker.mjs (the section 2.9 gates on the real navgrid).
//
// Source: docs/hmh-reboot/design/LEVEL-1-DESIGN-PACKAGE-20260925.md, sections
// 2.1-2.9 with the 2.2 change table applied. Same 12,000 x 4,800 extents,
// player spawn (800, 2,400), district ids and x-bands, and the surface ids
// `proof-of-work-bridge` and `crossing-shallows`.
//
// District status:
//   greybox -- slices S2.1 (Relay, Crossing) and S2.3 (Ravine): every mass,
//              crossing, arena footprint, chain site, lair and road is placed
//              and all section 2.9 gates the checker runs are enforced.
//   rough   -- S2.2, S2.4 and S2.5 are later slices. Masses, water, terraces,
//              gates, lairs and roads are roughed in from the 2.6 tables so the
//              navgrid, the seams and cross-district lair coverage are real,
//              but only the whole-map gates are enforced there.

const d = (id, name, minX, maxX, status) => Object.freeze({ id, name, minX, maxX, status });

export const LAYOUT_V2_DISTRICTS = Object.freeze([
  d('frontier-relay', 'Frontier Relay', 0, 1_800, 'greybox'),
  d('rugpull-ravine', 'Rugpull Ravine', 1_800, 3_800, 'greybox'),
  d('liquidity-crossing', 'Liquidity Crossing', 3_800, 6_000, 'greybox'),
  d('hashwood', 'Hashwood', 6_000, 8_000, 'rough'),
  d('mining-camp', 'Mining Camp', 8_000, 10_000, 'rough'),
  d('liquidation-yard', 'Liquidation Yard', 10_000, 12_000, 'rough'),
]);

const m = (id, district, material, rect, extra = {}) => ({ id, district, material, rect, ...extra });

const MASSES = [
  // Perimeter. The north strip is y 0-250 everywhere; the south strip starts
  // where each district's sketch row turns solid.
  m('edge-west', 'frontier-relay', 'forest', [0, 0, 100, 4_800]),
  m('edge-north-relay', 'frontier-relay', 'forest', [100, 0, 1_800, 250]),
  m('edge-north-ravine', 'rugpull-ravine', 'rock', [1_800, 0, 3_800, 250]),
  m('edge-north-crossing', 'liquidity-crossing', 'rock', [3_800, 0, 6_000, 250]),
  m('edge-north-hashwood', 'hashwood', 'forest', [6_000, 0, 8_000, 250]),
  m('edge-north-mining', 'mining-camp', 'rock', [8_000, 0, 10_000, 250]),
  m('edge-north-yard', 'liquidation-yard', 'container', [10_000, 0, 11_850, 250]),
  m('edge-east', 'liquidation-yard', 'building', [11_900, 0, 12_000, 4_800]),
  m('edge-south-relay', 'frontier-relay', 'forest', [100, 4_650, 1_800, 4_800]),
  m('edge-south-ravine', 'rugpull-ravine', 'rock', [1_800, 4_600, 3_800, 4_800]),
  m('edge-south-crossing', 'liquidity-crossing', 'rock', [3_800, 4_650, 6_000, 4_800]),
  m('edge-south-hashwood', 'hashwood', 'forest', [6_000, 4_500, 8_000, 4_800]),
  m('edge-south-mining', 'mining-camp', 'rock', [8_000, 4_500, 10_000, 4_800]),
  m('edge-south-yard', 'liquidation-yard', 'building', [10_000, 4_650, 11_900, 4_800]),

  // D1 Frontier Relay.
  m('relay-north-woods', 'frontier-relay', 'forest', [100, 250, 1_500, 700]),
  m('relay-nw-woods', 'frontier-relay', 'forest', [100, 700, 950, 950]),
  m('relay-ne-woods', 'frontier-relay', 'forest', [1_500, 250, 1_800, 700]),
  m('relay-seam-woods-north', 'frontier-relay', 'forest', [1_650, 700, 1_800, 1_250]),
  m('relay-seam-woods-mid', 'frontier-relay', 'forest', [1_650, 1_600, 1_800, 2_250]),
  m('relay-seam-woods-south', 'frontier-relay', 'forest', [1_650, 2_600, 1_800, 4_100]),
  m('relay-seam-woods-corner', 'frontier-relay', 'forest', [1_650, 4_400, 1_800, 4_650]),
  m('relay-farmhouse', 'frontier-relay', 'building', [250, 1_550, 450, 1_850]),
  m('relay-north-barn', 'frontier-relay', 'building', [600, 1_450, 850, 1_650]),
  m('relay-hedge-north-west', 'frontier-relay', 'hedge', [250, 3_100, 650, 3_150]),
  m('relay-hedge-north-east', 'frontier-relay', 'hedge', [850, 3_100, 950, 3_150]),
  m('relay-hedge-west', 'frontier-relay', 'hedge', [250, 3_150, 300, 3_750]),
  m('relay-hedge-east', 'frontier-relay', 'hedge', [900, 3_150, 950, 3_750]),
  m('relay-hedge-south', 'frontier-relay', 'hedge', [250, 3_700, 950, 3_750]),
  m('relay-south-barn', 'frontier-relay', 'building', [600, 3_450, 900, 3_700]),
  m('relay-meadow-wreck', 'frontier-relay', 'cover', [1_100, 2_120, 1_310, 2_210]),
  m('relay-farmyard-silo', 'frontier-relay', 'building', [520, 2_760, 640, 2_880]),
  m('relay-orchard-row-a', 'frontier-relay', 'hedge', [300, 2_250, 480, 2_300]),
  m('relay-orchard-row-b', 'frontier-relay', 'hedge', [300, 2_520, 480, 2_570]),
  m('relay-woodpile-west', 'frontier-relay', 'cover', [250, 1_400, 410, 1_470]),
  m('relay-hay-bales', 'frontier-relay', 'cover', [1_100, 2_620, 1_260, 2_700]),
  m('relay-cornfield-fence', 'frontier-relay', 'hedge', [250, 3_950, 650, 4_000]),
  m('relay-track-shed', 'frontier-relay', 'building', [1_300, 3_250, 1_480, 3_420]),
  m('relay-pond-reeds', 'frontier-relay', 'hedge', [1_500, 3_690, 1_620, 3_730]),
  m('relay-south-rocks', 'frontier-relay', 'cover', [700, 4_150, 860, 4_230]),
  m('relay-trail-boulders', 'frontier-relay', 'cover', [1_300, 1_760, 1_440, 1_840]),
  m('relay-county-wreck', 'frontier-relay', 'cover', [1_250, 2_950, 1_330, 3_100]),
  m('relay-meadow-stones', 'frontier-relay', 'cover', [600, 2_040, 680, 2_110]),
  m('relay-spawn-fence', 'frontier-relay', 'hedge', [600, 2_200, 700, 2_260]),

  // D2 Rugpull Ravine.
  m('ravine-west-mesa', 'rugpull-ravine', 'rock', [1_800, 250, 2_300, 700]),
  m('ravine-sw-mesa-north', 'rugpull-ravine', 'rock', [1_800, 2_750, 2_200, 3_150]),
  m('ravine-sw-mesa-back', 'rugpull-ravine', 'rock', [1_800, 3_150, 1_950, 3_350]),
  m('ravine-sw-mesa-south', 'rugpull-ravine', 'rock', [1_800, 3_350, 2_200, 3_450]),
  m('ravine-spire-west', 'rugpull-ravine', 'rock', [2_820, 1_370, 3_280, 2_050]),
  m('ravine-spire-east', 'rugpull-ravine', 'rock', [3_520, 1_370, 3_800, 2_050]),
  m('ravine-quarry-wall-north', 'rugpull-ravine', 'rock', [3_700, 250, 3_800, 850]),
  m('ravine-quarry-wall-south', 'rugpull-ravine', 'rock', [3_700, 1_100, 3_800, 1_370]),
  m('ravine-se-mesa', 'rugpull-ravine', 'rock', [2_860, 2_800, 3_800, 3_200]),
  m('ravine-canyon-pillar', 'rugpull-ravine', 'rock', [2_000, 1_600, 2_220, 1_780]),
  m('ravine-canyon-spur', 'rugpull-ravine', 'rock', [1_950, 1_150, 2_120, 1_260]),
  m('ravine-canyon-boulders', 'rugpull-ravine', 'cover', [1_900, 2_150, 2_020, 2_230]),
  m('ravine-baron-tent', 'rugpull-ravine', 'building', [3_050, 250, 3_250, 400]),
  m('ravine-quarry-pile-west', 'rugpull-ravine', 'rock', [3_050, 780, 3_180, 870]),
  m('ravine-quarry-pile-east', 'rugpull-ravine', 'rock', [3_120, 1_150, 3_230, 1_250]),
  m('ravine-flats-wreck', 'rugpull-ravine', 'cover', [3_600, 2_190, 3_740, 2_260]),
  m('ravine-flats-boulders', 'rugpull-ravine', 'rock', [3_100, 2_140, 3_280, 2_230]),
  m('ravine-wash-rocks-west', 'rugpull-ravine', 'rock', [2_150, 4_000, 2_270, 4_100]),
  m('ravine-wash-rocks-mid', 'rugpull-ravine', 'rock', [2_700, 4_150, 2_830, 4_250]),
  m('ravine-wash-rocks-east', 'rugpull-ravine', 'rock', [3_300, 3_850, 3_420, 3_950]),
  m('ravine-surveyor-tent', 'rugpull-ravine', 'building', [2_880, 3_820, 2_980, 3_900]),
  m('ravine-diggings-south', 'rugpull-ravine', 'rock', [3_800, 1_105, 4_050, 1_250]),
  m('ravine-lane-rocks', 'rugpull-ravine', 'cover', [2_150, 3_500, 2_230, 3_600]),

  // D3 Liquidity Crossing.
  m('crossing-west-pines', 'liquidity-crossing', 'forest', [4_050, 250, 4_500, 850]),
  m('crossing-west-bluff', 'liquidity-crossing', 'rock', [3_800, 1_800, 4_000, 2_150]),
  m('crossing-mill', 'liquidity-crossing', 'building', [5_200, 450, 5_400, 600]),
  m('crossing-falls-spur', 'liquidity-crossing', 'rock', [5_000, 440, 5_100, 540]),
  m('crossing-bank', 'liquidity-crossing', 'building', [5_600, 850, 5_800, 1_050]),
  m('crossing-store', 'liquidity-crossing', 'building', [5_600, 1_250, 5_800, 1_400]),
  m('crossing-boathouse', 'liquidity-crossing', 'building', [5_050, 1_400, 5_250, 1_550]),
  m('crossing-depot-tanks', 'liquidity-crossing', 'container', [5_600, 1_700, 5_800, 1_900]),
  m('crossing-toll-house', 'liquidity-crossing', 'building', [4_750, 2_950, 5_000, 3_100]),
  m('crossing-east-woods-north', 'liquidity-crossing', 'forest', [5_900, 1_700, 6_000, 2_100]),
  m('crossing-east-woods-mid', 'liquidity-crossing', 'forest', [5_850, 2_750, 6_000, 3_050]),
  m('crossing-east-woods-south', 'liquidity-crossing', 'forest', [5_850, 3_550, 6_000, 4_650]),
  m('crossing-bridgehead-wreck', 'liquidity-crossing', 'cover', [4_150, 2_560, 4_300, 2_640]),
  m('crossing-east-bank-wreck', 'liquidity-crossing', 'cover', [5_150, 2_150, 5_290, 2_230]),
  m('crossing-east-bank-barrier', 'liquidity-crossing', 'cover', [5_480, 2_620, 5_600, 2_690]),
  m('crossing-west-bank-stack', 'liquidity-crossing', 'container', [4_050, 1_350, 4_180, 1_480]),
  m('crossing-marsh-hut', 'liquidity-crossing', 'building', [3_810, 3_000, 3_890, 3_120]),
  m('crossing-island-crates-west', 'liquidity-crossing', 'cover', [4_600, 3_450, 4_700, 3_530]),
  m('crossing-island-crates-east', 'liquidity-crossing', 'cover', [5_000, 3_600, 5_100, 3_680]),
  m('crossing-landing-well', 'liquidity-crossing', 'cover', [5_700, 520, 5_800, 600]),
  m('crossing-west-bank-shed', 'liquidity-crossing', 'building', [4_410, 1_650, 4_490, 1_780]),
  m('crossing-east-bank-cart', 'liquidity-crossing', 'cover', [5_800, 2_600, 5_900, 2_680]),

  // D4 Hashwood (rough). Forest masses are impassable; trails are cuts.
  m('hashwood-nw', 'hashwood', 'forest', [6_000, 250, 6_700, 1_100]),
  m('hashwood-ne', 'hashwood', 'forest', [7_550, 250, 8_000, 1_150]),
  m('hashwood-lookout-back', 'hashwood', 'forest', [7_900, 1_150, 8_000, 1_450]),
  m('hashwood-middle-west', 'hashwood', 'forest', [6_700, 1_350, 6_950, 1_950]),
  m('hashwood-middle-east', 'hashwood', 'forest', [7_110, 1_250, 7_600, 1_950]),
  m('hashwood-cut-north-west', 'hashwood', 'forest', [6_000, 1_950, 6_380, 2_150]),
  m('hashwood-cut-north-mid', 'hashwood', 'forest', [6_620, 1_950, 7_650, 2_150]),
  m('hashwood-cut-north-east', 'hashwood', 'forest', [7_850, 1_950, 8_000, 2_150]),
  m('hashwood-cut-south-west', 'hashwood', 'forest', [6_000, 2_750, 7_200, 2_950]),
  m('hashwood-cut-south-east', 'hashwood', 'forest', [7_400, 2_750, 8_000, 2_950]),
  m('hashwood-south-west', 'hashwood', 'forest', [6_000, 3_550, 6_150, 4_400]),
  m('hashwood-grove-north', 'hashwood', 'forest', [6_150, 3_700, 6_700, 3_780]),
  m('hashwood-grove-west', 'hashwood', 'forest', [6_150, 3_780, 6_250, 4_400]),
  m('hashwood-grove-east-north', 'hashwood', 'forest', [6_600, 3_780, 6_700, 3_800]),
  m('hashwood-grove-east-south', 'hashwood', 'forest', [6_600, 4_000, 6_700, 4_400]),
  m('hashwood-grove-south', 'hashwood', 'forest', [6_250, 4_250, 6_600, 4_400]),
  m('hashwood-east-seam', 'hashwood', 'forest', [7_850, 3_050, 8_000, 3_700]),
  m('hashwood-logging-cabin', 'hashwood', 'building', [6_150, 1_600, 6_300, 1_720]),
  m('hashwood-sanctuary-stones', 'hashwood', 'rock', [7_300, 3_600, 7_420, 3_700]),

  // D5 Mining Camp (rough).
  m('mining-west-cliff-north', 'mining-camp', 'rock', [8_000, 250, 8_350, 1_450]),
  m('mining-west-cliff-south', 'mining-camp', 'rock', [8_000, 1_750, 8_350, 2_150]),
  m('mining-spoil-heap', 'mining-camp', 'rock', [8_350, 250, 8_800, 1_000]),
  m('mining-spoil-heap-west', 'mining-camp', 'rock', [8_350, 1_000, 8_425, 1_250]),
  m('mining-spoil-heap-east', 'mining-camp', 'rock', [8_675, 1_000, 8_800, 1_250]),
  m('mining-headframe-base', 'mining-camp', 'building', [9_050, 250, 9_350, 420]),
  m('mining-vault-north', 'mining-camp', 'building', [9_600, 250, 10_000, 500]),
  m('mining-vault-south', 'mining-camp', 'building', [9_600, 1_000, 10_000, 1_250]),
  m('mining-vault-east', 'mining-camp', 'building', [9_950, 500, 10_000, 1_000]),
  m('mining-vault-west-north', 'mining-camp', 'building', [9_600, 500, 9_650, 650]),
  m('mining-vault-west-south', 'mining-camp', 'building', [9_600, 850, 9_650, 1_000]),
  m('mining-office', 'mining-camp', 'building', [9_700, 1_650, 9_950, 1_850]),
  m('mining-plant', 'mining-camp', 'building', [9_350, 2_150, 9_850, 2_350]),
  m('mining-sheds', 'mining-camp', 'building', [9_400, 4_200, 9_700, 4_380]),
  m('mining-ore-bins', 'mining-camp', 'container', [8_450, 2_200, 8_600, 2_300]),

  // D6 Liquidation Yard (rough).
  m('yard-wall-north', 'liquidation-yard', 'container', [10_000, 250, 10_100, 2_280]),
  m('yard-wall-mid', 'liquidation-yard', 'container', [10_000, 2_520, 10_100, 3_300]),
  m('yard-wall-south', 'liquidation-yard', 'container', [10_000, 3_500, 10_100, 3_850]),
  m('yard-wall-corner', 'liquidation-yard', 'container', [10_000, 4_300, 10_100, 4_550]),
  m('yard-port-row-a', 'liquidation-yard', 'container', [10_300, 400, 10_500, 550]),
  m('yard-port-row-b', 'liquidation-yard', 'container', [10_300, 750, 10_500, 900]),
  m('yard-dark-pool-north', 'liquidation-yard', 'container', [11_000, 350, 11_800, 420]),
  m('yard-dark-pool-south', 'liquidation-yard', 'container', [11_000, 1_080, 11_800, 1_150]),
  m('yard-dark-pool-east', 'liquidation-yard', 'container', [11_730, 420, 11_800, 1_080]),
  m('yard-dark-pool-west-north', 'liquidation-yard', 'container', [11_000, 420, 11_070, 650]),
  m('yard-dark-pool-west-south', 'liquidation-yard', 'container', [11_000, 850, 11_070, 1_080]),
  m('yard-nw-block', 'liquidation-yard', 'building', [10_330, 1_650, 10_580, 2_280]),
  m('yard-sw-block', 'liquidation-yard', 'building', [10_330, 2_520, 10_580, 3_100]),
  m('yard-north-block-west', 'liquidation-yard', 'building', [10_580, 1_650, 10_980, 1_880]),
  m('yard-north-block-east', 'liquidation-yard', 'building', [11_220, 1_650, 11_620, 1_880]),
  m('yard-east-block-north', 'liquidation-yard', 'building', [11_620, 1_650, 11_850, 2_320]),
  m('yard-east-block-bell', 'liquidation-yard', 'building', [11_780, 2_320, 11_850, 2_480]),
  m('yard-east-block-south', 'liquidation-yard', 'building', [11_620, 2_480, 11_850, 3_100]),
  m('yard-south-block-west', 'liquidation-yard', 'building', [10_580, 2_920, 10_980, 3_200]),
  m('yard-south-block-east', 'liquidation-yard', 'building', [11_220, 2_920, 11_620, 3_200]),
  m('yard-kiosks-north-west', 'liquidation-yard', 'cover', [10_580, 1_880, 10_980, 2_130]),
  m('yard-kiosks-north-east', 'liquidation-yard', 'cover', [11_220, 1_880, 11_620, 2_130]),
  m('yard-kiosks-south-west', 'liquidation-yard', 'cover', [10_580, 2_670, 10_980, 2_920]),
  m('yard-kiosks-south-east', 'liquidation-yard', 'cover', [11_220, 2_670, 11_620, 2_920]),
  m('yard-warehouse-north-west', 'liquidation-yard', 'building', [10_500, 3_600, 10_700, 3_660]),
  m('yard-warehouse-north-east', 'liquidation-yard', 'building', [10_900, 3_600, 11_100, 3_660]),
  m('yard-warehouse-west', 'liquidation-yard', 'building', [10_500, 3_660, 10_560, 4_300]),
  m('yard-warehouse-east', 'liquidation-yard', 'building', [11_040, 3_660, 11_100, 4_300]),
  m('yard-warehouse-south', 'liquidation-yard', 'building', [10_500, 4_240, 11_100, 4_300]),
  m('yard-east-tenement', 'liquidation-yard', 'building', [11_300, 3_700, 11_600, 3_950]),
];

const WATER = [
  { id: 'relay-farm-pond', district: 'frontier-relay', depth: 'shallow', rect: [1_300, 3_750, 1_600, 4_050] },
  { id: 'crossing-river-trunk', district: 'liquidity-crossing', depth: 'deep', rect: [4_500, 250, 5_000, 2_750], surfaceId: 'liquidity-river' },
  { id: 'crossing-split-pool', district: 'liquidity-crossing', depth: 'deep', rect: [4_150, 2_750, 5_550, 2_900] },
  { id: 'crossing-west-branch', district: 'liquidity-crossing', depth: 'deep', rect: [4_200, 2_900, 4_450, 3_900] },
  { id: 'crossing-east-branch', district: 'liquidity-crossing', depth: 'deep', rect: [5_250, 2_900, 5_500, 3_900] },
  { id: 'crossing-reservoir', district: 'liquidity-crossing', depth: 'deep', rect: [3_950, 3_900, 5_850, 4_250] },
  { id: 'crossing-west-marsh', district: 'liquidity-crossing', depth: 'shallow', rect: [3_800, 2_900, 4_200, 3_900] },
  { id: 'hashwood-run', district: 'hashwood', depth: 'shallow', rect: [6_950, 250, 7_110, 4_350] },
  { id: 'mining-tailings', district: 'mining-camp', depth: 'shallow', rect: [8_200, 3_000, 8_600, 3_400] },
  { id: 'yard-settlement-canal', district: 'liquidation-yard', depth: 'deep', rect: [10_100, 1_300, 11_850, 1_480] },
];

const CHASMS = [
  { id: 'ravine-gorge-north', district: 'rugpull-ravine', rect: [2_480, 250, 2_820, 2_600] },
  { id: 'ravine-gorge-south', district: 'rugpull-ravine', rect: [2_540, 2_600, 2_860, 3_700] },
];

// Walkable ground laid over water: the Behind-the-Falls ledge (S3).
const GROUNDS = [
  { id: 'crossing-falls-ledge', district: 'liquidity-crossing', rect: [4_550, 250, 5_000, 430] },
];

const TERRACES = [
  { id: 'relay-hill', district: 'frontier-relay', rect: [950, 700, 1_500, 1_200], ramps: [{ id: 'relay-hill-ramp', rect: [1_100, 1_200, 1_350, 1_450], top: 'north' }] },
  { id: 'ravine-quarry-bench', district: 'rugpull-ravine', rect: [2_850, 250, 3_700, 520], ramps: [{ id: 'ravine-bench-ramp', rect: [3_350, 520, 3_600, 720], top: 'north' }] },
  { id: 'ravine-cliff-dwellings', district: 'rugpull-ravine', rect: [2_860, 3_200, 3_600, 3_700], ramps: [{ id: 'ravine-dwelling-stairs', rect: [3_600, 3_200, 3_800, 3_700], top: 'west', stairs: true }] },
  { id: 'hashwood-ranger-lookout', district: 'hashwood', rect: [7_600, 1_150, 7_900, 1_450], ramps: [{ id: 'hashwood-lookout-ramp', rect: [7_625, 1_450, 7_875, 1_650], top: 'north' }] },
  { id: 'mining-bench', district: 'mining-camp', rect: [8_350, 1_250, 10_000, 2_050], ramps: [
    { id: 'mining-ramp-a', rect: [8_950, 2_050, 9_200, 2_300], top: 'north' },
    { id: 'mining-ramp-w', rect: [8_100, 1_450, 8_350, 1_750], top: 'east' },
    { id: 'mining-hoist-road', rect: [9_060, 1_200, 9_340, 1_450], top: 'south' },
  ] },
  { id: 'mining-adit-pocket', district: 'mining-camp', rect: [8_425, 1_000, 8_675, 1_250] },
];

// Section 2.4 crossings. `clear` is the table's clear width.
const DECKS = [
  { id: 'settler-viaduct', district: 'rugpull-ravine', rect: [2_430, 2_240, 2_870, 2_480], span: 'x', z: 0, clear: 240, style: 'stone-arch-viaduct' },
  { id: 'rugpull-rope-bridge', district: 'rugpull-ravine', rect: [2_430, 1_020, 2_870, 1_180], span: 'x', z: 0, clear: 160, style: 'plank-suspension' },
  { id: 'old-mill-bridge', district: 'liquidity-crossing', rect: [4_500, 845, 5_000, 1_105], span: 'x', z: 16, clear: 260, style: 'stone-arch', surfaceId: 'crossing-shallows' },
  { id: 'proof-of-work-bridge', district: 'liquidity-crossing', rect: [4_500, 2_290, 5_000, 2_510], span: 'x', z: 16, clear: 220, style: 'steel-through-truss', surfaceId: 'proof-of-work-bridge' },
  { id: 'fork-trestle', district: 'liquidity-crossing', rect: [4_180, 3_150, 4_470, 3_350], span: 'x', z: 0, clear: 200, style: 'timber-trestle' },
  { id: 'lock-gate-walkway', district: 'liquidity-crossing', rect: [5_230, 3_450, 5_520, 3_700], span: 'x', z: 0, clear: 220, style: 'steel-lock-gate' },
  { id: 'hashwood-run-bridge', district: 'hashwood', rect: [6_930, 2_250, 7_130, 2_600], span: 'x', z: 0, clear: 350, style: 'log-and-plank', rails: false },
  { id: 'canal-bascule', district: 'liquidation-yard', rect: [10_700, 1_280, 10_920, 1_500], span: 'y', z: 0, clear: 220, style: 'steel-bascule' },
];

// Gates: `reward` opens through a chain or a boss defeat, `arena-lock` seals
// an arena while its fight runs, `secret` and `vault` guard pockets.
const g = (id, district, role, a, b, extra = {}) => ({ id, district, role, a, b, ...extra });
const GATES = [
  g('relay-barn-doors', 'frontier-relay', 'reward', [650, 3_125], [850, 3_125], { radius: 26, opensBy: 'relay-generator' }),
  g('ravine-surveyor-rockfall', 'rugpull-ravine', 'secret', [2_190, 3_160], [2_190, 3_340], { radius: 22, opensBy: 'breakable' }),
  g('ravine-rope-bridge-raised', 'rugpull-ravine', 'reward', [2_440, 1_030], [2_440, 1_170], { radius: 20, opensBy: 'ravine-winch' }),
  g('ravine-quarry-lock-bridge', 'rugpull-ravine', 'arena-lock', [2_860, 1_030], [2_860, 1_170], { radius: 20 }),
  g('ravine-quarry-lock-road', 'rugpull-ravine', 'arena-lock', [3_280, 1_395], [3_520, 1_395], { radius: 24 }),
  g('ravine-diggings-claim-gate', 'rugpull-ravine', 'reward', [3_750, 860], [3_750, 1_095], { radius: 30, opensBy: 'boss:rug-pull-baron' }),
  g('ravine-haul-pass-gate', 'rugpull-ravine', 'reward', [4_040, 860], [4_040, 1_095], { radius: 26, opensBy: 'boss:rug-pull-baron' }),
  g('crossing-falls-curtain', 'liquidity-crossing', 'secret', [4_990, 262], [4_990, 418], { radius: 22, opensBy: 'breakable' }),
  g('crossing-trestle-lock', 'liquidity-crossing', 'arena-lock', [4_462, 3_160], [4_462, 3_340], { radius: 22 }),
  g('crossing-lock-gate-chain', 'liquidity-crossing', 'reward', [5_512, 3_460], [5_512, 3_690], { radius: 24, opensBy: 'boss:lockkeeper' }),
  g('hashwood-log-chute', 'hashwood', 'reward', [6_720, 1_110], [6_720, 1_340], { radius: 24, opensBy: 'hashwood-log-lever' }),
  g('hashwood-deadfall', 'hashwood', 'secret', [6_650, 3_812], [6_650, 3_988], { radius: 24, opensBy: 'breakable' }),
  g('mining-adit-boards', 'mining-camp', 'secret', [8_435, 1_240], [8_665, 1_240], { radius: 16, opensBy: 'breakable' }),
  g('mining-hoist-lock', 'mining-camp', 'arena-lock', [9_070, 1_210], [9_330, 1_210], { radius: 20 }),
  g('mining-vault-door', 'mining-camp', 'vault', [9_625, 660], [9_625, 840], { radius: 26, opensBy: 'boss:51-foreman' }),
  g('yard-bascule-leaf', 'liquidation-yard', 'reward', [10_710, 1_490], [10_910, 1_490], { radius: 18, opensBy: 'yard-bascule-lever' }),
  g('yard-dark-pool-door', 'liquidation-yard', 'secret', [11_035, 660], [11_035, 840], { radius: 30, opensBy: 'breakable' }),
  g('yard-warehouse-gate', 'liquidation-yard', 'reward', [10_700, 3_630], [10_900, 3_630], { radius: 30, opensBy: 'yard-warehouse-lever' }),
  g('yard-margin-lock-west', 'liquidation-yard', 'arena-lock', [10_590, 2_290], [10_590, 2_510], { radius: 20 }),
  g('yard-margin-lock-north', 'liquidation-yard', 'arena-lock', [10_990, 2_120], [11_210, 2_120], { radius: 20 }),
  g('yard-margin-lock-south', 'liquidation-yard', 'arena-lock', [10_990, 2_680], [11_210, 2_680], { radius: 20 }),
];

// Pockets are walkable ground a closed gate keeps out of reach at the start.
const POCKETS = [
  { id: 'relay-barn-yard', district: 'frontier-relay', kind: 'reward', rect: [300, 3_150, 900, 3_700], gate: 'relay-barn-doors' },
  { id: 'ravine-diggings', district: 'rugpull-ravine', kind: 'vault', rect: [3_800, 250, 4_020, 1_105], gate: 'ravine-diggings-claim-gate' },
  { id: 'ravine-surveyors-ledge', district: 'rugpull-ravine', kind: 'secret', rect: [1_950, 3_150, 2_200, 3_350], gate: 'ravine-surveyor-rockfall' },
  { id: 'crossing-behind-the-falls', district: 'liquidity-crossing', kind: 'secret', rect: [4_550, 250, 5_000, 430], gate: 'crossing-falls-curtain' },
  { id: 'hashwood-beacon-clearing', district: 'hashwood', kind: 'reward', rect: [6_700, 250, 7_550, 1_150], gate: 'hashwood-log-chute' },
  { id: 'hashwood-hollow-grove', district: 'hashwood', kind: 'secret', rect: [6_250, 3_780, 6_600, 4_250], gate: 'hashwood-deadfall' },
  { id: 'mining-collapsed-adit', district: 'mining-camp', kind: 'secret', rect: [8_425, 1_000, 8_675, 1_250], gate: 'mining-adit-boards' },
  { id: 'mining-hoist-vault', district: 'mining-camp', kind: 'vault', rect: [9_650, 500, 9_950, 1_000], gate: 'mining-vault-door' },
  { id: 'yard-container-port', district: 'liquidation-yard', kind: 'reward', rect: [10_100, 250, 11_850, 1_300], gate: 'yard-bascule-leaf' },
  { id: 'yard-dark-pool', district: 'liquidation-yard', kind: 'secret', rect: [11_070, 420, 11_730, 1_080], gate: 'yard-dark-pool-door' },
  { id: 'yard-warehouse', district: 'liquidation-yard', kind: 'reward', rect: [10_560, 3_660, 11_040, 4_240], gate: 'yard-warehouse-gate' },
];

// Arenas: footprint circle (r330-520), the gates that seal it, and the region
// a sealed flood from the centre must stay inside. Every arena runs as a
// champion arena until its boss is promoted (S2.6).
const ARENAS = [
  { id: 'quarry-bowl', district: 'rugpull-ravine', boss: 'rug-pull-baron', center: [3_275, 880], radius: 420, trigger: [3_100, 640], gates: ['ravine-quarry-lock-bridge', 'ravine-quarry-lock-road', 'ravine-diggings-claim-gate'], sealRegion: [2_850, 250, 3_700, 1_400] },
  { id: 'toll-lock', district: 'liquidity-crossing', boss: 'lockkeeper', center: [4_850, 3_500], radius: 380, trigger: [5_180, 3_560], gates: ['crossing-trestle-lock', 'crossing-lock-gate-chain'], sealRegion: [4_450, 2_900, 5_520, 3_900] },
  { id: 'headframe-pit', district: 'mining-camp', boss: '51-foreman', center: [9_200, 750], radius: 420, trigger: [9_600, 1_750], gates: ['mining-hoist-lock', 'mining-vault-door'], sealRegion: [8_800, 250, 9_600, 1_250] },
  { id: 'margin-floor', district: 'liquidation-yard', boss: 'liquidator', center: [11_100, 2_400], radius: 460, trigger: [11_700, 2_400], gates: ['yard-margin-lock-west', 'yard-margin-lock-north', 'yard-margin-lock-south'], sealRegion: [10_580, 2_130, 11_780, 2_670] },
];

// Section 2.7: four lairs per district.
const lair = (id, district, x, y) => ({ id, district, x, y });
const LAIRS = [
  lair('relay-woods-mouth', 'frontier-relay', 400, 1_200),
  lair('relay-canyon-seam', 'frontier-relay', 1_750, 1_450),
  lair('relay-cornfield', 'frontier-relay', 1_400, 3_600),
  lair('relay-farm-track', 'frontier-relay', 1_700, 4_250),
  lair('ravine-canyon-west', 'rugpull-ravine', 1_900, 1_950),
  lair('ravine-quarry-road-adit', 'rugpull-ravine', 3_400, 1_950),
  lair('ravine-wash-west', 'rugpull-ravine', 2_350, 4_250),
  lair('ravine-wash-east', 'rugpull-ravine', 3_750, 4_300),
  lair('crossing-west-pines', 'liquidity-crossing', 4_370, 1_110),
  lair('crossing-landing-north', 'liquidity-crossing', 5_950, 450),
  lair('crossing-marsh', 'liquidity-crossing', 4_000, 3_750),
  lair('crossing-east-shore', 'liquidity-crossing', 5_690, 2_730),
  lair('hashwood-creek-hollow', 'hashwood', 7_030, 1_750),
  lair('hashwood-cut-west', 'hashwood', 6_210, 2_250),
  lair('hashwood-cut-east', 'hashwood', 7_900, 2_450),
  lair('hashwood-rail-south', 'hashwood', 7_900, 4_150),
  lair('mining-bench-west', 'mining-camp', 8_450, 1_950),
  lair('mining-floor-west', 'mining-camp', 8_150, 2_900),
  lair('mining-floor-east', 'mining-camp', 9_900, 3_250),
  lair('mining-rail-yard', 'mining-camp', 9_200, 4_250),
  lair('yard-quay-east', 'liquidation-yard', 11_750, 1_560),
  lair('yard-west-street', 'liquidation-yard', 10_215, 3_000),
  lair('yard-rail-west', 'liquidation-yard', 10_150, 4_150),
  lair('yard-south-east', 'liquidation-yard', 11_700, 4_350),
];

const ENTRIES = [
  { id: 'spawn-meadow', district: 'frontier-relay', x: 800, y: 2_400 },
  { id: 'ravine-approach', district: 'rugpull-ravine', x: 2_150, y: 2_000 },
  { id: 'west-bank', district: 'liquidity-crossing', x: 4_200, y: 2_350 },
  { id: 'hashwood-cut', district: 'hashwood', x: 6_500, y: 2_450 },
  { id: 'mining-floor', district: 'mining-camp', x: 8_600, y: 2_750 },
];

// Interaction sites (machines, prisoners, keys, secrets, POIs). `gated` names
// the gate that must be open to reach the site.
const i = (id, district, kind, x, y, extra = {}) => ({ id, district, kind, x, y, ...extra });
const INTERACTIONS = [
  i('relay-generator', 'frontier-relay', 'machine', 700, 2_980, { catalogueId: 'relay-power' }),
  i('relay-barn-doors-site', 'frontier-relay', 'gate', 750, 3_060),
  i('relay-silver-reserve', 'frontier-relay', 'reward', 450, 3_550, { gated: 'relay-barn-doors' }),
  i('relay-prisoner-p1', 'frontier-relay', 'prisoner', 550, 3_300, { gated: 'relay-barn-doors' }),
  i('relay-uplink', 'frontier-relay', 'machine', 1_150, 800),
  i('relay-root-cellar', 'frontier-relay', 'secret', 350, 1_920, { catalogueId: 'farmstead-hidden-supplies' }),
  i('relay-cache', 'frontier-relay', 'poi', 500, 2_000),
  i('relay-armory', 'frontier-relay', 'poi', 1_300, 900),
  i('ravine-winch-handle', 'rugpull-ravine', 'key', 2_350, 2_900),
  i('ravine-winch', 'rugpull-ravine', 'machine', 2_380, 1_100, { catalogueId: 'ravine-winch' }),
  i('ravine-welcome-mat', 'rugpull-ravine', 'boss-trigger', 3_100, 640),
  i('ravine-diggings-cache', 'rugpull-ravine', 'reward', 3_960, 330, { gated: 'ravine-diggings-claim-gate' }),
  i('ravine-prisoner-h1', 'rugpull-ravine', 'prisoner', 3_850, 420, { gated: 'ravine-diggings-claim-gate' }),
  i('ravine-prisoner-p2', 'rugpull-ravine', 'prisoner', 3_000, 3_980),
  i('ravine-strongbox', 'rugpull-ravine', 'poi', 3_300, 3_580),
  i('ravine-surveyors-ledge-cache', 'rugpull-ravine', 'secret', 2_060, 3_250, { catalogueId: 'ravine-surveyor-cache', gated: 'ravine-surveyor-rockfall' }),
  i('crossing-sluice-valve', 'liquidity-crossing', 'machine', 5_250, 650, { catalogueId: 'crossing-pump' }),
  i('crossing-liquidity-haven', 'liquidity-crossing', 'reward', 5_120, 620),
  i('crossing-lock-windlass', 'liquidity-crossing', 'boss-trigger', 5_180, 3_560),
  i('crossing-prisoner-p3', 'liquidity-crossing', 'prisoner', 5_150, 1_650),
  i('crossing-behind-the-falls', 'liquidity-crossing', 'secret', 4_780, 340, { gated: 'crossing-falls-curtain' }),
  i('crossing-bank-cache', 'liquidity-crossing', 'poi', 5_700, 1_150),
  i('crossing-fuel-depot', 'liquidity-crossing', 'poi', 5_500, 1_980),
  i('hashwood-lamp-oil', 'hashwood', 'key', 6_450, 1_350),
  i('hashwood-log-lever', 'hashwood', 'machine', 6_550, 1_200),
  i('hashwood-beacon-brazier', 'hashwood', 'machine', 7_250, 820, { gated: 'hashwood-log-chute' }),
  i('hashwood-ranger-lookout', 'hashwood', 'machine', 7_750, 1_300),
  i('hashwood-sanctuary-crank', 'hashwood', 'machine', 7_050, 3_650, { catalogueId: 'hashwood-shrine' }),
  i('hashwood-prisoner-p4', 'hashwood', 'prisoner', 6_300, 1_500),
  i('hashwood-stump', 'hashwood', 'poi', 7_200, 3_350),
  i('mining-steam-valve', 'mining-camp', 'machine', 9_600, 2_420, { catalogueId: 'mining-valve' }),
  i('mining-hoist-lever', 'mining-camp', 'boss-trigger', 9_600, 1_750),
  i('mining-prisoner-p5', 'mining-camp', 'prisoner', 9_000, 1_450),
  i('mining-prisoner-h2', 'mining-camp', 'prisoner', 9_800, 750, { gated: 'mining-vault-door' }),
  i('mining-control-room', 'mining-camp', 'poi', 9_500, 1_700),
  i('yard-warehouse-lever', 'liquidation-yard', 'machine', 10_800, 3_520, { catalogueId: 'yard-warehouse' }),
  i('yard-prisoner-p6', 'liquidation-yard', 'prisoner', 10_800, 3_800, { gated: 'yard-warehouse-gate' }),
  i('yard-bascule-lever', 'liquidation-yard', 'machine', 10_810, 1_560),
  i('yard-closing-bell', 'liquidation-yard', 'boss-trigger', 11_700, 2_400),
  i('yard-dark-pool-door-site', 'liquidation-yard', 'secret', 10_975, 750, { catalogueId: 'warehouse-logbook', gated: 'yard-bascule-leaf' }),
  i('yard-repo-office', 'liquidation-yard', 'poi', 10_250, 3_450),
  i('yard-medbay-cache', 'liquidation-yard', 'poi', 11_700, 3_450),
];

const HAZARDS = [
  { id: 'ravine-rockfall', district: 'rugpull-ravine', x: 3_450, y: 4_150, radius: 110 },
  { id: 'crossing-fuel-drums', district: 'liquidity-crossing', x: 5_700, y: 2_000, radius: 150 },
  { id: 'hashwood-spore-bed', district: 'hashwood', x: 7_500, y: 3_750, radius: 120 },
  { id: 'mining-steam-trap', district: 'mining-camp', x: 9_600, y: 2_480, radius: 110 },
  { id: 'yard-liquidation-grid', district: 'liquidation-yard', x: 11_400, y: 3_420, radius: 150 },
];

// Areas section 2.9 gate 7 does not count as empty space.
const OPEN_EXEMPTIONS = [
  { id: 'spawn-meadow', circle: [800, 2_400, 560] },
  { id: 'dry-wash', rect: [1_800, 3_700, 3_800, 4_400] },
  { id: 'liquidation-plaza', rect: [10_580, 1_880, 11_620, 2_920] },
];

const LANDMARKS = [
  { id: 'relay-tower', x: 1_200, y: 850 },
  { id: 'forked-spire', x: 3_050, y: 1_750 },
  { id: 'proof-of-work-bridge', x: 4_750, y: 2_400 },
  { id: 'hashwood-beacon', x: 7_100, y: 750 },
  { id: 'mining-headframe', x: 9_200, y: 330 },
  { id: 'liquidation-tower', x: 11_420, y: 1_765 },
];

// Section 2.3 road hierarchy. The highway is never gated: it ends at Main
// Street's plaza mouth, and a road carries on to the plaza centre, because the
// Margin Floor locks while its fight runs.
const r = (id, tier, points, extra = {}) => ({ id, tier, points, ...extra });
const ROADS = [
  r('frontier-highway', 'highway', [
    [800, 2_400], [1_700, 2_420], [2_300, 2_360], [2_870, 2_360], [3_700, 2_400], [4_400, 2_400], [5_100, 2_400],
    [5_700, 2_450], [6_500, 2_450], [6_900, 2_425], [7_150, 2_425], [8_000, 2_500], [8_600, 2_550], [9_500, 2_480],
    [9_850, 2_490], [9_970, 2_400], [10_450, 2_400],
  ]),
  r('relay-county-road', 'road', [[1_225, 1_450], [1_150, 1_800], [900, 2_250], [800, 2_400], [760, 2_800], [750, 3_060]]),
  r('relay-farm-track', 'lane', [[800, 2_400], [950, 2_850], [1_180, 3_200], [1_150, 3_800], [1_450, 4_250], [1_900, 4_250]]),
  r('relay-canyon-trail', 'trail', [[1_225, 1_450], [1_800, 1_450], [2_250, 1_400], [2_300, 1_100], [2_430, 1_100]]),
  r('ravine-rope-bridge-trail', 'trail', [[2_430, 1_100], [2_870, 1_100], [3_050, 1_000]], { clear: 160 }),
  r('ravine-quarry-road', 'road', [[3_400, 2_380], [3_400, 1_370], [3_300, 800]]),
  r('ravine-canyon-lane', 'lane', [[2_150, 2_000], [2_340, 2_450], [2_340, 3_450], [2_400, 3_900]]),
  r('crossing-mill-road', 'road', [[3_750, 975], [4_050, 975], [4_400, 975], [5_100, 975], [5_400, 1_000], [5_500, 1_150], [5_480, 1_600], [5_450, 2_100], [5_400, 2_400]]),
  r('crossing-west-bank-road', 'road', [[4_200, 2_380], [4_300, 1_700], [4_300, 1_150], [4_350, 975]]),
  r('crossing-ford-road', 'lane', [[5_700, 2_450], [5_700, 3_575], [5_230, 3_575]]),
  r('crossing-trestle-lane', 'lane', [[3_980, 2_700], [3_980, 3_250], [4_470, 3_250], [4_700, 3_300]]),
  r('crossing-shore-path', 'trail', [[5_700, 3_575], [5_800, 3_300], [6_300, 3_300], [7_300, 3_300]]),
  r('hashwood-logging-road', 'road', [[5_480, 1_600], [5_850, 1_520], [6_100, 1_450], [6_500, 1_450], [6_500, 2_450]]),
  r('hashwood-lookout-trail', 'trail', [[7_750, 2_450], [7_750, 1_650]]),
  r('mining-hoist-haul-road', 'road', [[9_075, 2_300], [9_075, 1_700], [9_200, 1_200]]),
  r('mining-rail-line', 'lane', [[7_300, 3_900], [8_000, 3_900], [10_050, 4_050]]),
  r('yard-main-street', 'road', [[10_450, 2_400], [11_100, 2_400]]),
  r('yard-south-street', 'road', [[9_700, 3_400], [10_700, 3_400], [11_700, 3_400]]),
];

// Section 2.9 gate "connectivity through the intended crossings". `seams`
// lists every opening a district boundary may have (y ranges); `cuts` removes
// crossings and names two points that must then fall apart.
const SEAMS = [
  { x: 1_800, openings: [[1_250, 1_600, 'canyon-trail'], [2_250, 2_600, 'highway'], [4_100, 4_400, 'farm-track']] },
  { x: 3_800, openings: [[850, 1_105, 'haul-pass'], [2_150, 2_750, 'highway'], [3_200, 3_700, 'dwelling-stairs'], [3_700, 4_650, 'dry-wash']] },
  { x: 6_000, openings: [[1_150, 1_650, 'logging-road'], [2_150, 2_750, 'highway-cut'], [3_050, 3_550, 'shore-path']] },
  { x: 8_000, openings: [[1_450, 1_850, 'lookout-trail'], [2_150, 2_750, 'highway-cut'], [3_050, 4_500, 'rail']] },
  { x: 10_000, openings: [[2_280, 2_520, 'main-street'], [3_300, 3_500, 'south-street'], [3_850, 4_300, 'rail']] },
];

const CUTS = [
  { id: 'liquidity-river', remove: ['old-mill-bridge', 'proof-of-work-bridge', 'lock-gate-walkway', 'fork-trestle'], from: [4_200, 2_350], to: [5_700, 2_700] },
  { id: 'toll-lock-island', remove: ['fork-trestle', 'lock-gate-walkway'], from: [4_850, 3_500], to: [4_200, 2_350] },
  { id: 'rugpull-gorge-north', remove: ['settler-viaduct', 'rugpull-rope-bridge'], from: [2_150, 2_000], to: [3_400, 2_400], viaAllowed: 'dry-wash' },
];

export const LAYOUT_V2_MAP = Object.freeze({
  id: 'forked-frontier-v2',
  bounds: LAYOUT_V2_BOUNDS,
  player: Object.freeze({ spawn: Object.freeze({ x: 800, y: 2_400 }) }),
  districts: LAYOUT_V2_DISTRICTS,
  masses: MASSES,
  water: WATER,
  chasms: CHASMS,
  grounds: GROUNDS,
  terraces: TERRACES,
  decks: DECKS,
  gates: GATES,
  pockets: POCKETS,
  arenas: ARENAS,
  lairs: LAIRS,
  entries: ENTRIES,
  interactions: INTERACTIONS,
  hazards: HAZARDS,
  openExemptions: OPEN_EXEMPTIONS,
  landmarks: LANDMARKS,
  roads: ROADS,
  seams: SEAMS,
  cuts: CUTS,
});
