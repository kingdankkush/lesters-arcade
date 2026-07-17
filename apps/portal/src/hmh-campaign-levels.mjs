import {
  HMH_AUTHORED_LEVEL_GRAMMAR,
  authoredLevelSetpieceManifestFor,
} from './hmh-authored-setpieces.mjs';
import {
  HMH_LEVEL_ONE_SKETCH_LAYOUT,
  HMH_LEVEL_ONE_SKETCH_NEW_ASSET_REQUESTS,
} from './hmh-level-one-sketch-layout.mjs';
import { HMH_LEVEL_ONE_CURATED_WORLD_CONTRACT } from './hmh-level-one-curated-world-contract.mjs';

const LEVEL_1_ID = 'level-1-crypto-wasteland';
const LEVEL_2_ID = 'level-2-litecoin-city';
const LEVEL_3_ID = 'level-3-the-getaway';

export const HMH_LEVEL_ONE_WASTELAND_POIS = Object.freeze([
  Object.freeze({
    id: 'rugpull-gulch',
    title: 'Rugpull Gulch',
    districtId: 'ghost-town',
    lane: 'south-spur',
    telegraph: 'water tower + ruined vault facade + blown project signage visible from the road spine',
    miniBoss: Object.freeze({ id: 'claim-jumper-sheriff', title: 'Claim-Jumper Sheriff', phases: 2, telegraphFrames: 28, adds: ['scam-cult bandits'], counterplay: 'bait the rifle wind-up behind false-front cover, then punish the reload lane.' }),
    reward: Object.freeze({ type: 'weapon-or-shield', examples: Object.freeze(['Block Breaker', 'Cold Wallet Armor', 'blue shield pickup']) }),
    riskRewardRead: 'high pressure ghost-town arena off the spine with score burst + guaranteed power-up.',
  }),
  Object.freeze({
    id: 'dry-forest-cave',
    title: 'Dry Forest Cave',
    districtId: 'country-road',
    lane: 'north-spur',
    telegraph: 'dark cave mouth, pine silhouette wall, and goblin chatter tucked behind the roadside tree line',
    miniBoss: Object.freeze({ id: 'cave-warren-alpha', title: 'Cave Warren Alpha', phases: 2, telegraphFrames: 24, adds: ['FUD Mine Zombies'], counterplay: 'kite the rush into the cave mouth bottleneck and punish after the leap tell.' }),
    reward: Object.freeze({ type: 'xp-luck-or-summon', examples: Object.freeze(['Green Candle Luck', 'Satellite Wallets', 'XP burst cache']) }),
    riskRewardRead: 'mid-risk forest detour that swaps long sightlines for ambush pressure and fast XP.',
  }),
  Object.freeze({
    id: 'old-hashrate-camp',
    title: 'Old Hashrate Camp',
    districtId: 'desert-approach',
    lane: 'north-spur',
    telegraph: 'half-buried rigs, silver-blue dust plumes, and a salvage flare visible above the berms',
    miniBoss: Object.freeze({ id: 'salvage-mercenary', title: 'Salvage Mercenary', phases: 2, telegraphFrames: 26, adds: ['junk drones'], counterplay: 'dash across the exposed lane during the laser mark, then break line of sight on the salvage stacks.' }),
    reward: Object.freeze({ type: 'drone-or-orbital', examples: Object.freeze(['Satellite Wallets', 'Hash Rail overclock', 'orbital support module']) }),
    riskRewardRead: 'open-sightline salvage camp with ranged punishment and premium utility drops.',
  }),
  Object.freeze({
    id: 'oasis-lakeside',
    title: 'Oasis Lakeside',
    districtId: 'residential-edge',
    lane: 'south-spur',
    telegraph: 'water glint, reeds, and a cool color wash breaking the desert palette before the shoreline opens up',
    miniBoss: Object.freeze({ id: 'sandbar-apex', title: 'Sandbar Apex', phases: 2, telegraphFrames: 24, adds: ['vultures'], counterplay: 'fight from the dry bank, then punish when the apex predator commits through shallow water slow.' }),
    reward: Object.freeze({ type: 'regen-health', examples: Object.freeze(['Cold Wallet Armor', 'regen flask', 'heal burst']) }),
    riskRewardRead: 'restful read from afar that flips into a mobility tax once the lake arena activates.',
  }),
  Object.freeze({
    id: 'mesa-overlook',
    title: 'Mesa Overlook',
    districtId: 'residential-edge',
    lane: 'north-spur',
    telegraph: 'cliff silhouette and sniper glint on the ridge line before the player climbs the switchback',
    miniBoss: Object.freeze({ id: 'ridge-raider', title: 'Ridge Raider', phases: 2, telegraphFrames: 30, adds: ['claim-jumpers'], counterplay: 'hug the cliff shadow during the scoped tell, then dash the lane between volleys.' }),
    reward: Object.freeze({ type: 'range-pierce', examples: Object.freeze(['Tracer Velocity', 'Spread LTC', 'pierce module']) }),
    riskRewardRead: 'elevated optional arena with long-range punishment and premium projectile upgrades.',
  }),
  Object.freeze({
    id: 'crossroads-trading-post',
    title: 'Crossroads Trading Post',
    districtId: 'country-road',
    lane: 'south-spur',
    telegraph: 'signpost hub, wagon circle, and lantern line clearly splitting the route before commitment',
    miniBoss: Object.freeze({ id: 'bandit-captain', title: 'Bandit Captain', phases: 2, telegraphFrames: 26, adds: ['road bandits'], counterplay: 'clear the wagon flankers first, then punish the captain when the banner plant locks him in place.' }),
    reward: Object.freeze({ type: 'reroll-economy', examples: Object.freeze(['reroll charge', 'coin burst', 'Hard Money Score']) }),
    riskRewardRead: 'branch-choice tutorial POI that teaches skip versus commit with visible reward staging.',
  }),
]);

export const HMH_LEVEL_ONE_WASTELAND_ENEMIES = Object.freeze([
  Object.freeze({ id: 'coyote-pack', role: 'melee-pack-animal', biomes: Object.freeze(['desert-approach', 'country-road', 'oasis-lakeside']), telegraphFrames: 24, aiPattern: 'fan out, feint, then collapse from two angles', spriteNotes: 'lean low profile, dust kick start frame, lunging bite follow-through', counterplay: 'dash through the first feint and keep a rock or fence between you and the second coyote.' }),
  Object.freeze({ id: 'claim-jumper', role: 'ranged-human', biomes: Object.freeze(['ghost-town', 'mesa-overlook', 'crossroads-trading-post']), telegraphFrames: 28, aiPattern: 'anchor on cover, rifle aim flash, relocate after two shots', spriteNotes: 'readable rifle raise, shoulder flash, recoil settle, cloak flap', counterplay: 'watch for the muzzle flash wind-up and punish the relocation step.' }),
  Object.freeze({ id: 'wild-boar', role: 'charger-animal', biomes: Object.freeze(['country-road', 'dry-forest-cave']), telegraphFrames: 26, aiPattern: 'root scrape, straight-line charge, skid turn, repeat', spriteNotes: 'hoof scrape anticipation, heavy head-down silhouette, dirt spray impact', counterplay: 'sidestep perpendicular at the hoof-scrape tell, then punish the recovery skid.' }),
  Object.freeze({ id: 'buzzard', role: 'flyer-animal', biomes: Object.freeze(['desert-approach', 'old-hashrate-camp', 'oasis-lakeside']), telegraphFrames: 24, aiPattern: 'circle, shadow-mark, dive, then peel upward', spriteNotes: 'wide banking frames, readable shadow decal, peck contact frame', counterplay: 'move once the shadow tightens instead of chasing the bird sprite itself.' }),
  Object.freeze({ id: 'rattlesnake', role: 'ambusher-animal', biomes: Object.freeze(['desert-approach', 'mesa-overlook', 'oasis-lakeside']), telegraphFrames: 24, aiPattern: 'buried idle, tail rattle, short strike, recoil into cover', spriteNotes: 'coiled idle, readable rattle frame, fast strike smear, sand burst', counterplay: 'bait the strike from max range and punish the exposed recoil frame.' }),
  Object.freeze({ id: 'bandit-captain', role: 'elite-human', biomes: Object.freeze(['crossroads-trading-post', 'rugpull-gulch']), telegraphFrames: 30, aiPattern: 'banner plant buff, sidearm burst, command dash', spriteNotes: 'tall silhouette, cape/banner secondary motion, command point pose', counterplay: 'burst the adds, then collapse during the banner plant lockout.' }),
  Object.freeze({ id: 'scam-cult-zealot', role: 'elite-human', biomes: Object.freeze(['ghost-town', 'rugpull-gulch']), telegraphFrames: 26, aiPattern: 'chant aura, shotgun fan, retreat behind converts', spriteNotes: 'lantern/flare accent, readable robe flare, recoil-heavy blast', counterplay: 'stay diagonal to the fan and punish before the chant aura restacks.' }),
  Object.freeze({ id: 'fud-goblin-cave', role: 'contextual-grunt', biomes: Object.freeze(['dry-forest-cave']), telegraphFrames: 24, aiPattern: 'scatter, lob, regroup at cave edge', spriteNotes: 'same goblin base sheet with cave-mud variant, torch-lit hit frames, clearer throw tell', counterplay: 'push them out of the cave mouth before the lob arc overlaps.' }),
]);

export const HMH_LEVEL_ONE_WASTELAND_MACRO_LAYOUT = Object.freeze({
  model: Object.freeze({
    macro: 'authored district graph with fixed main spine, hubs, rivers, and optional POI spurs',
    micro: 'procedural spawn, pickup, and prop scatter inside authored district envelopes',
    confirmedBy: 'Justin brief on 2026-06-19',
  }),
  mainSpine: Object.freeze(['desert-approach', 'ghost-town', 'country-road', 'residential-edge', 'inner-city-threshold']),
  shoulderLoops: Object.freeze(['north-shoulder', 'south-shoulder']),
  hubs: Object.freeze([
    Object.freeze({ id: 'country-crossroads', districtId: 'country-road', role: 'main route branch selector', sightlineCue: 'signpost + wagon circle + lantern string' }),
  ]),
  waterways: Object.freeze([
    Object.freeze({ id: 'dry-creek-seam', districts: Object.freeze(['desert-approach', 'ghost-town']), role: 'soft barrier + salvage sightline' }),
    Object.freeze({ id: 'oasis-lakeside', districts: Object.freeze(['country-road', 'residential-edge']), role: 'lake, reeds, sandbar, shallow ford choice' }),
  ]),
  poiSpurs: Object.freeze(HMH_LEVEL_ONE_WASTELAND_POIS.map((poi) => Object.freeze({ id: poi.id, districtId: poi.districtId, lane: poi.lane, telegraph: poi.telegraph }))),
  citySeam: Object.freeze({ destinationLevelId: LEVEL_2_ID, cue: 'neon skyline of Litecoin City on the horizon, growing larger as the run advances' }),
});

const LEVEL_1_ENVIRONMENT_ASSET_LIBRARY = Object.freeze({
  groundTerrain: Object.freeze(['sand', 'cracked earth', 'scrub', 'dirt road', 'cobble main street', 'dry grass', 'rocky ground', 'riverbank mud', 'beach sand', 'shallow water', 'deep water', 'sandbar', 'stepping stones']),
  floraDesert: Object.freeze(['saguaro cactus', 'barrel cactus', 'prickly pear', 'agave', 'joshua tree', 'dead bush', 'dry shrub', 'tumbleweed']),
  floraForest: Object.freeze(['pine', 'oak', 'fern', 'bush', 'fallen log', 'stump', 'mushroom cluster']),
  transitionalFlora: Object.freeze(['grass tufts', 'wildflowers', 'reeds']),
  waterFeatures: Object.freeze(['river straight', 'river bend', 'river fork', 'creek', 'lake edge', 'waterfall lip', 'ford', 'ripples']),
  terrainForms: Object.freeze(['boulder S/M/L', 'rock cluster', 'cliff wall', 'mesa butte', 'cave mouth', 'canyon wall', 'gravel scatter']),
  structures: Object.freeze(['saloon', 'bank vault ruin', 'shack', 'church', 'windmill', 'water tower', 'fences/posts', 'abandoned mining rigs', 'wagon caravan', 'signposts', 'bridge', 'well', 'trading post']),
  setDressing: Object.freeze(['bones', 'debris', 'broken project billboards', 'campfire', 'crates', 'explosive barrels', 'lanterns']),
  acceptanceChecklist: Object.freeze(['iso-ready', 'locked anchor across variants', 'collision footprint separate from sprite box', 'zHeight authored', 'biome tagged', '2-3 organic variants', 'interactive/destructible/hazard flag', 'assets:verify pass']),
});

const LEVEL_1_VFX_AND_INTERACTIVITY = Object.freeze([
  'Animated river flow, ripples, splash entry, and shallow-water movement slow at fords.',
  'Wind ambience: tumbleweed rolls, foliage sway, dust devils, and dust kicks under player movement.',
  'Reactive biome cues: forest darkens the grade slightly and raises ambient tension audio near cave/POI bounds.',
  'Destructibles: explosive barrels, breakable crates, breakable pots, and shootable cacti.',
  'Hazards: quicksand slow, campfire burn, cave darkness vignette, and cliff-edge knockback clamp-to-nav rules.',
]);

const LEVEL_1_PLACEMENT_RULES = Object.freeze([
  'Main road spine is always reachable and readable from the player camera.',
  'Optional POI spurs must telegraph risk/reward before commitment and reconnect cleanly to the spine.',
  'No enemy, pickup, or forced displacement destination may overlap collision, hazard, or wall footprints.',
  'Spawn-safe radius, camera-safe radius, and nav-clamp rules remain active in authored districts and POI arenas.',
  'Tall props must occlusion-fade and preserve silhouette readability during combat.',
]);

// ---------------------------------------------------------------------------
// Level 2 — Litecoin City: POIs, environment asset library, VFX, placement
// (Level Design Bible §3 — Litecoin City districts as content packs on the
// shared L1 engine. Hub-and-spoke: Litecoin Square branches via streets to
// optional risk/reward district POIs.)
// ---------------------------------------------------------------------------

export const HMH_LEVEL_TWO_LITECOIN_CITY_POIS = Object.freeze([
  Object.freeze({
    id: 'litecoin-square-hub',
    title: 'Litecoin Square',
    districtId: 'litecoin-plaza',
    lane: 'hub',
    telegraph: 'central silver LTC monument, fountain plaza, and branching streets with ticker billboards',
    miniBoss: Object.freeze({ id: 'plaza-warden', title: 'Plaza Warden', phases: 2, telegraphFrames: 26, adds: ['Bitcoin Maximalist Riot Cops'], counterplay: 'use the fountain for cover during the baton charge, then punish the shield-bash recovery.' }),
    reward: Object.freeze({ type: 'hub-routing', examples: Object.freeze(['access to all district spokes']) }),
    riskRewardRead: 'central hub — safe-ish rest beat that branches to all districts.',
  }),
  Object.freeze({
    id: 'defi-harbor',
    title: 'DeFi Harbor',
    districtId: 'waterfront',
    lane: 'east-spur',
    telegraph: 'crane silhouettes, shipping container stacks, and the cross-chain Bridge landmark visible from the pier boardwalk',
    miniBoss: Object.freeze({ id: 'bridge-exploiter', title: 'The Bridge Exploiter', phases: 3, telegraphFrames: 30, adds: ['liquidator pirates', 'bridge-exploit raiders'], counterplay: 'bait the anchor slam near the container maze, then punish during the chain re-org animation.' }),
    reward: Object.freeze({ type: 'drone-or-orbital', examples: Object.freeze(['Liquidity Drone', 'Orbital Liquidation Strike', 'Chain Bridge Shield']) }),
    riskRewardRead: 'high-risk waterfront arena with water knockback edges and a 3-phase boss guarding premium utility drops.',
  }),
  Object.freeze({
    id: 'financial-downtown',
    title: 'Financial Downtown',
    districtId: 'financial-core',
    lane: 'north-spur',
    telegraph: 'chrome-glass towers, trading-floor atriums, and server-rack corridors with neon ticker light',
    miniBoss: Object.freeze({ id: 'the-whale', title: 'The Whale', phases: 3, telegraphFrames: 32, adds: ['Evil Bankers', 'MEV Reapers', 'Bot Swarms'], counterplay: 'use the elevator shaft for vertical escape during the market-crash AoE, then punish the margin-call recovery.' }),
    reward: Object.freeze({ type: 'score-economy', examples: Object.freeze(['Score Multiplier Surge', 'Flash Loan Burst', 'Yield Farm Shield']) }),
    riskRewardRead: 'vertical downtown arena with knockback edges and a heavy boss guarding score/economy power-ups.',
  }),
  Object.freeze({
    id: 'mimblewimble-grove',
    title: 'MimbleWimble Grove',
    districtId: 'luxury-neighborhoods',
    lane: 'west-spur',
    telegraph: 'fog-draped hedge maze, glowing privacy-glyph lanterns, and confidential vault greenhouses',
    miniBoss: Object.freeze({ id: 'the-obfuscator', title: 'The Obfuscator', phases: 2, telegraphFrames: 28, adds: ['Privacy Phantoms', 'veiled stalkers'], counterplay: 'track the phase-cloak shimmer through the fog, then punish the decloak tell.' }),
    reward: Object.freeze({ type: 'stealth-evasion', examples: Object.freeze(['Privacy Cloak', 'MimbleWimble Dash', 'Confidential Cache']) }),
    riskRewardRead: 'fog-reduced-sight stealth arena with a cloaking boss guarding evasion power-ups.',
  }),
  Object.freeze({
    id: 'hashrate-district',
    title: 'Hashrate District',
    districtId: 'financial-core',
    lane: 'south-spur',
    telegraph: 'humming PoW mining rigs, cooling vent steam, and blinking rig LED arrays behind server-stack corridors',
    miniBoss: Object.freeze({ id: 'fifty-one-percent', title: 'The 51% Boss', phases: 3, telegraphFrames: 30, adds: ['overclock drones', 'rogue-rig bots'], counterplay: 'break the rig array during the hash-power buildup, then punish the chain-reorg cooldown.' }),
    reward: Object.freeze({ type: 'fire-rate-heat', examples: Object.freeze(['Hash Rail Overclock', 'Thermal Vent Blast', 'ASIC Armor']) }),
    riskRewardRead: 'heat-vent hazard arena with a rig-array boss guarding fire-rate/heat power-ups.',
  }),
  // Additional L2 districts (Bible §3.2 — remaining content packs)
  Object.freeze({
    id: 'artisan-district',
    title: 'Artisan District',
    districtId: 'luxury-neighborhoods',
    lane: 'west-spur',
    telegraph: 'mural-covered alleyways, gallery atriums with neon art, kiln smoke, and maker workshops with open forge doors',
    miniBoss: Object.freeze({ id: 'the-counterfeiter', title: 'The Counterfeiter', phases: 2, telegraphFrames: 28, adds: ['counterfeit-NFT golems', 'knockoff-bots'], counterplay: 'destroy the forgery presses during the casting animation, then punish the quality-control sweep.' }),
    reward: Object.freeze({ type: 'weapon-upgrade', examples: Object.freeze(['Block Breaker Mk II', 'Canvas Shield', 'Forgery Scanner']) }),
    riskRewardRead: 'maker-quarter arena with breakable pottery and kiln fire hazards, guarding weapon upgrade power-ups.',
  }),
  Object.freeze({
    id: 'parks-green-belt',
    title: 'Parks & Green Belt',
    districtId: 'luxury-neighborhoods',
    lane: 'hub-connector',
    telegraph: 'manicured lawns, fountain courts, amphitheater ruins, and a botanical dome visible from the park trails',
    miniBoss: Object.freeze({ id: 'park-warden', title: 'Park Warden', phases: 2, telegraphFrames: 24, adds: ['stablecoin socialites'], counterplay: 'use the fountain for cover during the baton charge, then punish the whistle-stun recovery.' }),
    reward: Object.freeze({ type: 'heal-shield', examples: Object.freeze(['Cold Storage Medkit', 'Silver Shield Cache', 'XP Burst Cache']) }),
    riskRewardRead: 'breather district with lower spawn density — a rest beat between dense zones with a small cache reward.',
  }),
  Object.freeze({
    id: 'penthouse-rim',
    title: 'Penthouse Rain (Level 3 Seam)',
    districtId: 'penthouse-rim',
    lane: 'final-approach',
    telegraph: 'rooftop tar fields, glass parapets, helipad lights, and sponsored-post billboards against a storm-swept skyline',
    miniBoss: Object.freeze({ id: 'mr-ngmi', title: 'Mr. NGMI', phases: 3, telegraphFrames: 32, adds: ['sybil swarm drones', 'shill-beam turrets'], counterplay: 'dodge the sybil swarm shield during the sponsored-post bombardment, then punish the influencer meltdown phase.' }),
    reward: Object.freeze({ type: 'final-extraction', examples: Object.freeze(['Level 2 Clear', 'Mr. NGMI Defeated', 'Extraction Unlocked']) }),
    riskRewardRead: 'final boss arena on the penthouse rooftop — storm, wind, and knockback edges make this the hardest fight in Level 2.',
  }),
]);

const LEVEL_2_ENVIRONMENT_ASSET_LIBRARY = Object.freeze({
  groundTerrain: Object.freeze(['asphalt', 'cracked asphalt', 'sidewalk concrete', 'cobble plaza', 'rooftop tar', 'dock planks', 'park grass', 'tile transition strips']),
  urbanProps: Object.freeze(['streetlight', 'traffic signal', 'parking meter', 'fire hydrant', 'trash can', 'newspaper box', 'bench', 'barricade', 'chain-link fence', 'concrete median']),
  structures: Object.freeze(['skyscraper facade', 'shopfront', 'market stall', 'greenhouse', 'fountain', 'silver LTC monument', 'neon billboard', 'elevator shaft', 'skybridge', 'crane', 'shipping container', 'pier boardwalk', 'hedge maze wall', 'server rack']),
  waterFeatures: Object.freeze(['harbor water', 'fountain pool', 'reflecting pool', 'tidal edge', 'drainage channel']),
  flora: Object.freeze(['park tree', 'hedge', 'planter box', 'rooftop garden plant', 'bonsai']),
  setDressing: Object.freeze(['neon signs', 'holographic ads', 'graffiti', 'construction cones', 'spilled coffee cups', 'broken glass', 'tangled cables', 'blinking LED strips']),
  acceptanceChecklist: Object.freeze(['iso-ready', 'locked anchor across variants', 'collision footprint separate from sprite box', 'zHeight authored', 'biome tagged', '2-3 organic variants', 'interactive/destructible/hazard flag', 'assets:verify pass']),
});

const LEVEL_2_VFX_AND_INTERACTIVITY = Object.freeze([
  'Neon billboard flicker + holographic ad shimmer on building facades.',
  'Rain-slick street reflections with neon color bleed (cosmetic, render-side).',
  'Water FX: harbor ripples, fountain spray, tidal edge slow zone, splash entry.',
  'Destructibles: market stalls, shipping containers, glass storefronts, server racks.',
  'Hazards: elevator shaft knockback edge, cooling vent burn, electrified cables, water slow zone.',
  'Verticality cues: elevator off-mesh links, skybridge crossings, rooftop edge clamps.',
]);

const LEVEL_2_PLACEMENT_RULES = Object.freeze([
  'Street grid creates strong N-S/E-W blocks; alley cut-throughs are authored shortcuts, not random.',
  'Litecoin Square hub is always reachable and orients the player to all district spokes.',
  'Water/harbor edges use knockback clamps (no fall-through to void); elevator edges clamp to nav.',
  'POI district spurs telegraph risk/reward before commitment and reconnect to the hub.',
  'No enemy, pickup, or displacement destination may overlap collision, hazard, or void footprints.',
  'Tall skyscraper props must occlusion-fade and preserve silhouette readability during combat.',
]);

export const HMH_CAMPAIGN_LEVELS = Object.freeze([
  Object.freeze({
    id: LEVEL_1_ID,
    number: 1,
    shortTitle: 'Crypto Wasteland',
    title: 'Level 1 - Crypto Wasteland',
    bannerTitle: 'Level 1 — Crypto Wasteland',
    gameplayTitle: 'Level 1: Crypto Wasteland',
    loadingStatus: 'PREPARING LEVEL 1...',
    bossId: 'rug-pull-baron',
    bossTitle: 'Rug Pull Baron',
    nextLevelId: LEVEL_2_ID,
    canonReconciliation: Object.freeze({
      oldLevelOneTitle: 'The Slums / Underchain District',
      newLevelOneTitle: 'Crypto Wasteland',
      cityShift: 'Financial-core and neon-city biomes move to Level 2: Litecoin City.',
      note: 'Persisted IDs stay unchanged; only level identity, world graph, and display canon shift.',
      codeWatchlist: Object.freeze(['district-generator.mjs level1 belts', 'arcade-core Level 1 display copy', 'achievement copy using legacy slums/foundry names', 'scene templates carrying slums/foundry comments or IDs']),
    }),
    timings: Object.freeze({
      firstMiniBossBeatSeconds: 210,
      firstMajorBossBeatSeconds: 510,
      repeatBeatIntervalSeconds: 180,
    }),
    scoring: Object.freeze({
      headlineMetric: 'survivalSeconds',
      scoreGoal: 'open-ended survival score chase',
    }),
    hybridModel: HMH_LEVEL_ONE_WASTELAND_MACRO_LAYOUT.model,
    macroLayout: HMH_LEVEL_ONE_WASTELAND_MACRO_LAYOUT,
    sketchMapPlan: HMH_LEVEL_ONE_SKETCH_LAYOUT,
    sketchAssetRequests: HMH_LEVEL_ONE_SKETCH_NEW_ASSET_REQUESTS,
    curatedWorldContract: HMH_LEVEL_ONE_CURATED_WORLD_CONTRACT,
    districtPlan: Object.freeze([
      Object.freeze({ id: 'desert-approach', label: 'Desert Approach', role: 'start lane / heat tutorial', assetMood: 'sand flats, berms, dry creek beds, rusted salvage, early sightlines toward the skyline' }),
      Object.freeze({ id: 'ghost-town', label: 'Rugpull Gulch / Ghost Town', role: 'main-street combat knot + first high-value detour', assetMood: 'abandoned false fronts, vault ruin, lanterns, fences, water tower, broken project billboards' }),
      Object.freeze({ id: 'country-road', label: 'Crossroads Country', role: 'branching hub and pacing breather', assetMood: 'dirt roads, utility poles, culverts, caravan pull-offs, dry forest line, signposts' }),
      Object.freeze({ id: 'residential-edge', label: 'Oasis / Mesa Fringe', role: 'water contrast, overlook pressure, city seam setup', assetMood: 'yards, reeds, culverts, cliff shadows, lake sandbars, patchy lawns, tree clusters' }),
      Object.freeze({ id: 'inner-city-threshold', label: 'Litecoin City Threshold', role: 'Level 2 hand-off seam', assetMood: 'cracked asphalt, medians, barricades, extraction safehouse, distant neon towers now filling the sky' }),
    ]),
    navigationGrammar: Object.freeze([
      'Primary road spine and skyline cues always orient the run toward Litecoin City.',
      'North/south shoulder loops provide breathable side movement without replacing the main path.',
      'Optional POI spurs are signposted before commitment and reward mini-boss clears with strong drops.',
      'Rivers, culverts, and cliff lines shape movement through readable crossings instead of hard maze walls.',
      'Organic scatter belongs around authored landmarks; avoid full-screen even-noise prop placement.',
    ]),
    environmentAssetLibrary: LEVEL_1_ENVIRONMENT_ASSET_LIBRARY,
    authoredTemplateModel: Object.freeze({
      authoredMacro: Object.freeze(['district graph', 'roads', 'rivers', 'hub signage', 'POI arenas', 'city seam exit']),
      proceduralMicro: Object.freeze(['spawn director', 'minor prop scatter', 'pickup routing', 'elite composition', 'filler between landmarks']),
    }),
    authoredLevelGrammar: HMH_AUTHORED_LEVEL_GRAMMAR,
    authoredSetpieceSystem: authoredLevelSetpieceManifestFor(LEVEL_1_ID),
    pois: HMH_LEVEL_ONE_WASTELAND_POIS,
    enemyRoster: HMH_LEVEL_ONE_WASTELAND_ENEMIES,
    vfxAndInteractivity: LEVEL_1_VFX_AND_INTERACTIVITY,
    placementRules: LEVEL_1_PLACEMENT_RULES,
    missingAssetFocus: Object.freeze([
      'road edge caps and authored crossroads kits',
      'culvert / ford / sandbar transitions',
      'ghost-town vault + sheriff signage variants',
      'forest cave mouth silhouettes and mesa overlook kits',
      'oasis shoreline reeds / dock / ripple variants',
      'enemy sprite sheets for coyotes, claim-jumpers, boars, buzzards, rattlesnakes, and captains',
    ]),
    enemyFactions: Object.freeze(HMH_LEVEL_ONE_WASTELAND_ENEMIES.map((enemy) => enemy.id)),
  }),
  Object.freeze({
    id: LEVEL_2_ID,
    number: 2,
    shortTitle: 'Litecoin City',
    title: 'Level 2 - Litecoin City',
    bannerTitle: 'Level 2 — Litecoin City',
    gameplayTitle: 'Level 2: Litecoin City',
    loadingStatus: 'PREPARING LEVEL 2...',
    bossId: 'mr-ngmi',
    bossTitle: 'Mr. NGMI',
    nextLevelId: LEVEL_3_ID,
    timings: Object.freeze({
      bossSpawnSeconds: 360,
      extractionSpawnSeconds: 600,
    }),
    scoring: Object.freeze({
      targetSeconds: 600,
      masterySeconds: 540,
    }),
    districtPlan: Object.freeze([
      Object.freeze({ id: 'outer-boulevard', label: 'Outer Boulevard', assetMood: 'tram lanes, alleys, parked cars, corner stores, chain-link service yards' }),
      Object.freeze({ id: 'financial-core', label: 'Financial Core', assetMood: 'glass towers, plazas, fountains, ticker billboards, hedge mazes' }),
      Object.freeze({ id: 'luxury-neighborhoods', label: 'Luxury Neighborhoods', assetMood: 'gated drives, manicured lawns, pools, sculpture gardens, private security booths' }),
      Object.freeze({ id: 'penthouse-rim', label: 'Penthouse Rim', assetMood: 'roof gardens, helipads, skybridges, rooftop bars, VIP extraction lanes' }),
    ]),
    navigationGrammar: Object.freeze([
      'Boulevards and alley cut-throughs should create strong north-south / east-west blocks.',
      'Luxury neighborhoods contrast with the financial core through cleaner tilesets, water features, and richer vegetation pockets.',
      'Interactive signage, gates, service elevators, and plaza chokepoints become the authored movement puzzle pieces.',
    ]),
    authoredLevelGrammar: HMH_AUTHORED_LEVEL_GRAMMAR,
    authoredSetpieceSystem: authoredLevelSetpieceManifestFor(LEVEL_2_ID),
    missingAssetFocus: Object.freeze([
      'urban sidewalk corners and medians',
      'streetlight / traffic signal kits',
      'luxury hedge, pool, and fountain tiles',
      'alley clutter + service entrance blockers',
      'skybridge / rooftop extraction setpieces',
    ]),
    enemyFactions: Object.freeze([
      'Bitcoin Maximalist Riot Cops',
      'NFT Valets',
      'Stablecoin Socialites',
      'DAO Lobbyists',
      'Influencer Camera Drones',
      'Chainlink Security Clerks',
    ]),
  }),
  Object.freeze({
    id: LEVEL_3_ID,
    number: 3,
    shortTitle: 'The Getaway',
    title: 'Level 3 - The Getaway',
    bannerTitle: 'Level 3 — The Getaway',
    gameplayTitle: 'Level 3: Mainnet Express',
    loadingStatus: 'PREPARING LEVEL 3...',
    bossId: 'mainnet-express-overseer',
    bossTitle: 'Mainnet Express Overseer',
    nextLevelId: null,
    timings: Object.freeze({
      bossSpawnSeconds: 300,
      extractionSpawnSeconds: 480,
    }),
    scoring: Object.freeze({
      targetSeconds: 480,
      masterySeconds: 420,
    }),
    districtPlan: Object.freeze([
      Object.freeze({ id: 'penthouse-launch-pad', label: 'Penthouse Launch Pad', assetMood: 'roof gardens, helipad clutter, wind-tossed signage, panicked VIP evac lanes' }),
      Object.freeze({ id: 'skybridge-breakpoint', label: 'Skybridge Breakpoint', assetMood: 'glass catwalks, blinking warning rails, broken ad panels, vertical city drop-offs' }),
      Object.freeze({ id: 'mainnet-express', label: 'Mainnet Express', assetMood: 'armored train cars, rooftop seams, power conduits, speed-line light bands, finale storm sky' }),
    ]),
    navigationGrammar: Object.freeze([
      'The route is discrete and authored: penthouse exit to skybridge collapse to train-roof finale.',
      'High-speed traversal pressure should come from lane commitment, wind, and narrow roof safety windows, not procedural maze shape.',
      'Visual reads must always preserve escape direction toward the active train and final extraction point.',
    ]),
    missingAssetFocus: Object.freeze([
      'penthouse evacuation clutter and roof-edge cover',
      'skybridge fracture variants and warning-light rails',
      'mainnet express roof modules, door seams, and conductor-car setpieces',
    ]),
    enemyFactions: Object.freeze([
      'VIP Extraction Guards',
      'Skybridge Interceptors',
      'Mainnet Express Security',
      'Pursuit Drones',
    ]),
  }),
]);

const LEVELS_BY_ID = Object.freeze(Object.fromEntries(HMH_CAMPAIGN_LEVELS.map((level) => [level.id, level])));
const INITIAL_LEVEL_ID = HMH_CAMPAIGN_LEVELS[0].id;

export function getInitialHmhCampaignLevelId() {
  return INITIAL_LEVEL_ID;
}

export function getHmhCampaignLevel(levelId = INITIAL_LEVEL_ID) {
  return LEVELS_BY_ID[levelId] ?? HMH_CAMPAIGN_LEVELS[0];
}

export function getNextHmhCampaignLevel(levelId = INITIAL_LEVEL_ID) {
  const level = getHmhCampaignLevel(levelId);
  return level.nextLevelId ? getHmhCampaignLevel(level.nextLevelId) : null;
}

export function formatHmhCampaignLevelBanner(levelOrId = INITIAL_LEVEL_ID) {
  return getHmhCampaignLevel(typeof levelOrId === 'string' ? levelOrId : levelOrId?.id).bannerTitle;
}

export function buildHmhCampaignObjectiveState({
  levelId = INITIAL_LEVEL_ID,
  elapsedSeconds = 0,
  bossTriggered = false,
  extractionSpawned = false,
  cleared = false,
  nextLevelId = null,
  activePoi = null,
} = {}) {
  const level = getHmhCampaignLevel(levelId);
  const nextLevel = nextLevelId ? getHmhCampaignLevel(nextLevelId) : getNextHmhCampaignLevel(level.id);
  const safeElapsed = Math.max(0, Number(elapsedSeconds) || 0);

  if (cleared) {
    return Object.freeze({
      phase: 'cleared',
      label: 'LEVEL CLEAR',
      shortLabel: 'LEVEL CLEAR',
      detail: nextLevel ? `Continue to ${nextLevel.title}.` : 'Campaign segment complete.',
    });
  }

  if (level.id === LEVEL_1_ID) {
    if (activePoi?.title) {
      return Object.freeze({
        phase: 'detour',
        label: `Optional POI — ${activePoi.title}`,
        shortLabel: 'DETOUR',
        detail: `Risk/reward route live: ${activePoi.telegraph ?? activePoi.title}. Reward focus: ${activePoi.rewardType ?? 'power-up cache'}.`,
      });
    }
    if (bossTriggered) {
      return Object.freeze({
        phase: 'boss',
        label: `${level.bossTitle} Active`,
        shortLabel: 'BOSS BEAT',
        detail: 'A boss beat is live. Clear it, grab the reward, and keep surviving.',
      });
    }
    return Object.freeze({
      phase: 'survive',
      label: 'Open-ended survival',
      shortLabel: 'SURVIVE',
      detail: 'Score, survival time, and build choices are the run. There is no extraction timer.',
    });
  }

  if (level.id === LEVEL_2_ID) {
    if (extractionSpawned || safeElapsed >= level.timings.extractionSpawnSeconds) {
      return Object.freeze({
        phase: 'extract',
        label: 'Secure the City Exit',
        shortLabel: 'CITY EXTRACT',
        detail: 'Break through the urban core and reach the city extraction lane.',
      });
    }
    if (bossTriggered || safeElapsed >= level.timings.bossSpawnSeconds) {
      return Object.freeze({
        phase: 'boss',
        label: `${level.bossTitle} Active`,
        shortLabel: 'PENTHOUSE BOSS',
        detail: 'Push from the financial core into the luxury rooftops while the city boss pressures you.',
      });
    }
    return Object.freeze({
      phase: 'advance',
      label: 'Push into the Inner City',
      shortLabel: 'ADVANCE',
      detail: 'Move boulevard to boulevard, then transition into the financial core and luxury neighborhoods.',
    });
  }

  if (level.id === LEVEL_3_ID) {
    if (extractionSpawned || safeElapsed >= level.timings.extractionSpawnSeconds) {
      return Object.freeze({
        phase: 'extract',
        label: 'Final Escape Window Open',
        shortLabel: 'ESCAPE',
        detail: 'Stay on the Mainnet Express route and reach the final extraction car alive.',
      });
    }
    if (bossTriggered || safeElapsed >= level.timings.bossSpawnSeconds) {
      return Object.freeze({
        phase: 'boss',
        label: `${level.bossTitle} Active`,
        shortLabel: 'FINALE BOSS',
        detail: 'The getaway is collapsing into a train-roof finale. Survive the boss pressure and keep the route.',
      });
    }
    return Object.freeze({
      phase: 'advance',
      label: 'Break for the Mainnet Express',
      shortLabel: 'GETAWAY',
      detail: 'Push across the rooftop escape chain, then board the Mainnet Express for the final runout.',
    });
  }

  return Object.freeze({
    phase: 'survive',
    label: 'Stay Alive',
    shortLabel: 'SURVIVE',
    detail: 'Keep moving through the district loop.',
  });
}

export function buildHmhExtractionGuidance({ playerX = 0, playerY = 0, targetX = 0, targetY = 0 } = {}) {
  const dx = Number(targetX) - Number(playerX);
  const dy = Number(targetY) - Number(playerY);
  const distanceTiles = Math.round((Math.hypot(dx, dy) || 0) * 10) / 10;
  const angle = Math.atan2(dy, dx);
  const sectors = [
    ['E', -22.5, 22.5],
    ['SE', 22.5, 67.5],
    ['S', 67.5, 112.5],
    ['SW', 112.5, 157.5],
    ['W', 157.5, 180],
    ['W', -180, -157.5],
    ['NW', -157.5, -112.5],
    ['N', -112.5, -67.5],
    ['NE', -67.5, -22.5],
  ];
  const degrees = (angle * 180) / Math.PI;
  const heading = sectors.find(([, start, end]) => degrees >= start && degrees < end)?.[0] ?? 'E';
  return Object.freeze({
    dx,
    dy,
    heading,
    distanceTiles,
    label: `${heading} · ${distanceTiles.toFixed(1)}t`,
  });
}

function formatSeconds(seconds) {
  const safeSeconds = Math.max(0, Math.round(Number(seconds) || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = String(safeSeconds % 60).padStart(2, '0');
  return `${minutes}:${remainder}`;
}
