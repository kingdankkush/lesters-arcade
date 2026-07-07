const freeze = (items) => Object.freeze(items.map((item) => Object.freeze(item)));

export const HMH_POST_ANCHOR_STATUS = Object.freeze({
  wave: 'WO-91-to-WO-89-post-anchor-production',
  anchorSet: 'WO-76 APPROVED_10_OF_10',
  runtimeIntegrationPolicy: 'No generated art or audio is runtime-swapped without cleanup, manifest wiring, tests, and visual/audio QA.',
});

export const HMH_WO91_NOIR_DISTRICT_RATIONALIZATION = freeze([
  { oldDistrict: 'litecoin-plaza', noirZone: 'civic-neon-square', action: 'keep as hub', ruling: 'approved', rationale: 'Central orientation space remains the readable hub, now dressed with wet plaza stone, blank neon civic signage, and the WO-76 streetlamp/tree language.' },
  { oldDistrict: 'financial-core', noirZone: 'bank-and-exchange-canyon', action: 'merge and intensify', ruling: 'approved', rationale: 'Financial Downtown and Hashrate District share vertical bank, server, and trading-floor language. Merge them into one dense Deco canyon family using the WO-76 bank anchor.' },
  { oldDistrict: 'waterfront', noirZone: 'rain-harbor-and-bridge-yards', action: 'keep as risk spoke', ruling: 'approved', rationale: 'DeFi Harbor needs its own wet container, crane, bridge, and knockback-edge read.' },
  { oldDistrict: 'luxury-neighborhoods', noirZone: 'privacy-grove-and-gallery-hills', action: 'split by mood pockets', ruling: 'approved', rationale: 'MimbleWimble Grove, Artisan District, and Parks remain separate authored pockets under one green/fog/gallery surface family.' },
  { oldDistrict: 'outer-boulevard', noirZone: 'service-boulevard', action: 'use as connector', ruling: 'approved', rationale: 'Wide road segments become readable connectors between dense POIs and carry streetlamp/tree/ground anchors.' },
  { oldDistrict: 'penthouse-rim', noirZone: 'rooftop-rain-final-approach', action: 'defer to boss seam', ruling: 'approved', rationale: 'Rooftop rain is a final approach seam rather than general district coverage.' },
]);

export const HMH_WO90_PLACEHOLDER_REDO_CENSUS = freeze([
  { pack: 'pickup-icons', script: 'generate-hmh-pickup-icons.py', currentRisk: 'script-drawn symbols', replacementAnchor: 'ui-chrome-sample', action: 'redo pickup icons as textless blank-symbol-free silhouettes with UI chrome trim before runtime replacement' },
  { pack: 'vfx-ui-chrome', script: 'generate-hmh-vfx-ui-chrome.py', currentRisk: 'procedural chrome and VFX packs drift from high-bit anchor style', replacementAnchor: 'ui-chrome-sample', action: 'redo card frames, HP bars, hit flashes, and rarity frames against the approved UI anchor' },
  { pack: 'level-one-authored-stamp-art', script: 'generate-hmh-level-one-authored-stamp-art.py', currentRisk: 'stamp-pack placeholders read flatter than approved anchors', replacementAnchor: 'micro-scene-composition', action: 'redo stamps as authored micro-scenes and painterly ground/prop composites' },
  { pack: 'achievement-atlas', script: 'generate-hmh-achievement-atlas.py', currentRisk: 'badge atlas is script-drawn and text/symbol heavy', replacementAnchor: 'ui-chrome-sample', action: 'redo achievement badge frames as textless high-bit medal/chrome shapes' },
]);

export const HMH_WO81_ANIMATION_PRINCIPLES_GATES = freeze([
  { gate: 'anticipation', requiredOn: ['hero attacks', 'enemy attacks', 'boss slams'], failExample: 'instant hit frame with no wind-up', acceptance: '2 to 5 readable frames before contact, with silhouette or VFX pullback' },
  { gate: 'smear', requiredOn: ['fast melee', 'dash', 'projectile launch'], failExample: 'teleporting limb or weapon', acceptance: 'one directional smear or stretched accent frame during the fastest motion' },
  { gate: 'impact', requiredOn: ['enemy hit', 'boss impact', 'player hurt'], failExample: 'damage number without body or VFX response', acceptance: 'hit flash plus body offset plus particles or ground spark in the contact frame' },
  { gate: 'follow-through', requiredOn: ['weapon swings', 'cape/coat/steam props'], failExample: 'pose snaps straight back to idle', acceptance: 'secondary motion resolves after contact before returning to idle' },
  { gate: 'loop-bob', requiredOn: ['idle loops', 'hover enemies', 'ambient props'], failExample: 'static standing sprite', acceptance: 'subtle two-axis bob or breath cycle that does not affect hitbox scale' },
]);

export const HMH_WO83_TOP5_ENEMY_REDESIGN_BRIEFS = freeze([
  { enemy: 'fud-goblin', anchor: 'highest-spawn-enemy-redesign', priority: 1, brief: 'Short hunched scam-bot goblin with blue visor, oversized tell hand, readable idle and raised-arm attack silhouette.' },
  { enemy: 'claim-jumper', anchor: 'bank-deco-corner', priority: 2, brief: 'Ranged outlaw banker hybrid with rifle raise anticipation and brass/silver shoulder read.' },
  { enemy: 'wild-boar', anchor: 'wet-asphalt-ground-family', priority: 3, brief: 'Low charger with hoof-scrape anticipation, dust/wet skid smear, and heavy head-down silhouette.' },
  { enemy: 'scam-cult-zealot', anchor: 'streetlamp-light-cone', priority: 4, brief: 'Lantern-lit cult elite with robe flare, chant anticipation, and fan-shot impact particles.' },
  { enemy: 'mev-reaper', anchor: 'major-boss-key-pose', priority: 5, brief: 'Tall mini-boss silhouette with scythe/cane wind-up, blue core, and delayed follow-through.' },
]);

export const HMH_WO77_MICRO_SCENE_LIBRARY = freeze(Array.from({ length: 20 }, (_, index) => {
  const scenes = [
    ['tipped-noodle-cart', 'tipped delivery cart, spilled crates, rat trail, wet asphalt reflection'],
    ['bank-run-line', 'abandoned queue ropes, torn deposit slips as blank paper shapes, coin scatter'],
    ['bridge-fee-booth', 'empty toll booth, broken barrier, puddled tire tracks'],
    ['server-vent-alley', 'steam vent, cables, fallen crate, blue neon puddle'],
    ['privacy-grove-cache', 'hedge gap, blank lanterns, concealed cache footprint'],
    ['gallery-shutter', 'closed gallery shutter, paint tins, tarp corner'],
    ['harbor-crate-spill', 'container corner, rope coil, wet plank edge'],
    ['fountain-shortout', 'sparking fountain pump, water ripple, bench shadow'],
    ['rig-cooling-leak', 'coolant puddle, fan grate, warning cone with no text'],
    ['rooftop-tar-splash', 'tar patch, dropped cable, rain-slick roof tile'],
    ['atm-spark', 'blank ATM shell, sparks, scattered generic chips'],
    ['backdoor-delivery', 'half-open service door, stacked boxes, steam pipe'],
    ['neon-tree-planter', 'street tree planter, fallen leaves, small light cone'],
    ['pawn-window-glow', 'blank display window, broken glass sparkle, coin-like props'],
    ['alley-barricade', 'folding barricade, trash bags, blue rim shadow'],
    ['rain-gutter-overflow', 'downspout, puddle ripple, cracked curb'],
    ['courier-bike-down', 'fallen delivery bike, spilled bag, tire skid'],
    ['vault-service-cart', 'vault cart, empty tray, brass wheel marks'],
    ['park-bench-cache', 'wet bench, hidden crate, leaf clusters'],
    ['helipad-cable-snag', 'cable coil, roof light, rain puddle'],
  ];
  const [id, recipe] = scenes[index];
  return { id, anchor: 'micro-scene-composition', recipe, placement: index % 2 === 0 ? 'street-edge cluster' : 'POI pocket', collision: 'soft unless explicitly marked cover' };
}));

export const HMH_WO78_DRAW_OVER_LAYER_PLAN = Object.freeze({
  layerId: 'noir-overhang-draw-over-v1',
  anchors: Object.freeze(['storefront-facade', 'bank-deco-corner', 'streetlamp-light-cone']),
  elements: freeze([
    { element: 'awnings', quota: '1 to 2 per dense storefront block', rule: 'cast soft top-edge shadow without hiding player lane' },
    { element: 'canopies', quota: 'hub and bank entries only', rule: 'use z-height and fade when player crosses below' },
    { element: 'bridges', quota: 'harbor/service-boulevard seams', rule: 'draw above ground but below tall skyline silhouettes' },
    { element: 'skyline parallax', quota: 'one skyline band per district family', rule: 'no WebGL; canvas 2D or static parallax only' },
  ]),
});

export const HMH_WO79_AMBIENT_MOTION_PLAN = Object.freeze({
  reducedMotion: 'disable non-critical loops, keep gameplay tells and hit feedback',
  quotas: freeze([
    { class: 'hero landmark', quota: 'one animated landmark per district screen', examples: ['bank neon hum', 'harbor crane light', 'privacy fog lantern'] },
    { class: 'critters', quota: '0 to 2 per calm pocket, never in boss lock', examples: ['rat', 'pigeon silhouette', 'moth in light cone'] },
    { class: 'weather', quota: 'rain streaks and puddle ripples capped by perf budget', examples: ['rain line pass', 'steam vent loop', 'puddle ripple'] },
    { class: 'signage', quota: 'blank light panels only', examples: ['cyan glow pulse', 'broken flicker'] },
  ]),
});

export const HMH_WO85_PAINTERLY_GROUND_PLAN = Object.freeze({
  anchor: 'wet-asphalt-ground-family',
  replaceFirst: freeze(['flat asphalt fills', 'procedural gray road tiles', 'unlit plaza stone', 'generic wet puddles']),
  rules: freeze(['preserve collision grid', 'separate visual tile from footprint', 'keep readability under enemy swarm', 'author at least base, cracked, puddled, and curb variants']),
});

export const HMH_WO80_WEAR_VARIANCE_PLAN = Object.freeze({
  target: 'placement imperfection and wear states',
  variants: freeze([
    { family: 'storefronts', variants: ['clean', 'rain-streaked', 'shutter-dented', 'neon-flicker'] },
    { family: 'bank facades', variants: ['clean marble', 'chipped corner', 'puddle-reflective', 'steam-stained'] },
    { family: 'street props', variants: ['upright', 'slightly tilted', 'wet base', 'damaged cap'] },
    { family: 'ground', variants: ['base', 'cracked', 'oil-puddled', 'stripe-worn'] },
  ]),
});

export const HMH_WO82_HERO_POLISH_PLAN = freeze([
  { hero: 'Lit Commando', anchor: 'lit-commando-idle-key-pose', work: 'idle, run, shoot, hurt, KO and victory repaint with coat follow-through and blaster anticipation' },
  { hero: 'Lit Valkyrie', anchor: 'lit-commando-idle-key-pose', work: 'matching high-bit silhouette pass, readable wing/cape secondary motion, non-overlapping hitbox source scale' },
]);

export const HMH_WO84_BOSS_SPECTACLE_PLAN = freeze([
  { boss: 'Rugpull Boss proxy', anchor: 'major-boss-key-pose', beats: ['spawn warning', 'vault armor glow', 'slam anticipation', 'impact ring', 'death burst'] },
  { boss: 'The Whale', anchor: 'major-boss-key-pose', beats: ['margin-call wind-up', 'market crash AoE', 'adds callout', 'puddle shockwave', 'loot-rain death tail'] },
  { boss: 'Bridge Exploiter', anchor: 'major-boss-key-pose', beats: ['chain hook tell', 'bridge rupture', 'container shake', 'waterline shock ring', 'reward reveal'] },
]);

export const HMH_WO86_AUDIO_BAKEOFF = Object.freeze({
  verdict: 'use existing repo WebAudio plus CC0 sample manifest first; use AI audio only for replacement candidates that beat the synth/sample fallback in A/B review',
  reviewPipeline: freeze(['inventory cue', 'generate or source 3 candidates', 'normalize loudness', 'A/B in combat moment', 'commit only final ogg plus provenance']),
});

export const HMH_WO87_FULL_SFX_INVENTORY = freeze([
  { cue: 'pickup', batch: 'economy', status: 'existing-sample-plus-synth' },
  { cue: 'enemy-hit', batch: 'combat', status: 'existing-sample-plus-synth' },
  { cue: 'player-hit', batch: 'combat', status: 'existing-sample-plus-synth' },
  { cue: 'boss-warning', batch: 'boss', status: 'existing-sample-plus-synth' },
  { cue: 'game-over', batch: 'state', status: 'existing-sample-plus-synth' },
  { cue: 'dash', batch: 'movement', status: 'needs-candidate' },
  { cue: 'weapon-fire', batch: 'combat', status: 'needs-candidate' },
  { cue: 'level-clear', batch: 'state', status: 'needs-candidate' },
]);

export const HMH_WO88_SCORE_PLAN = Object.freeze({
  mode: 'pressure-layered score with fallback mix',
  stems: freeze(['base rain pulse', 'combat arpeggio', 'boss brass hit layer', 'low-health filtered layer', 'victory release sting']),
  fallback: 'continue current music bed and duck against SFX until generated stems pass A/B review',
});

export const HMH_WO89_AV_SYNC_POLISH = Object.freeze({
  reel: '60 second showcase path from hub to bank corner to boss beat',
  syncMoments: freeze(['pickup sparkle on beat', 'enemy hit freeze plus transient', 'boss warning swell', 'death burst tail', 'victory UI settle']),
  acceptance: 'video capture has no missing sprites, no text/logo artifacts, balanced SFX/music, and clear touch/keyboard interaction read',
});

export const HMH_DEVICE_QA_STATUS = Object.freeze({
  status: 'blocked-on-this-host',
  blockers: freeze(['no adb/scrcpy toolchain detected', 'no iOS device bridge/xcrun on this Windows host', 'no connected enumerable mobile devices']),
  desktopFallback: 'smoke:portal:interactions and visual:regression remain the verified local gates until real devices are attached',
});

export function buildPostAnchorWorkOrderReport() {
  return Object.freeze({
    status: HMH_POST_ANCHOR_STATUS,
    wo91: HMH_WO91_NOIR_DISTRICT_RATIONALIZATION,
    wo90: HMH_WO90_PLACEHOLDER_REDO_CENSUS,
    wo81: HMH_WO81_ANIMATION_PRINCIPLES_GATES,
    wo83: HMH_WO83_TOP5_ENEMY_REDESIGN_BRIEFS,
    wo77: HMH_WO77_MICRO_SCENE_LIBRARY,
    wo78: HMH_WO78_DRAW_OVER_LAYER_PLAN,
    wo79: HMH_WO79_AMBIENT_MOTION_PLAN,
    wo85: HMH_WO85_PAINTERLY_GROUND_PLAN,
    wo80: HMH_WO80_WEAR_VARIANCE_PLAN,
    wo82: HMH_WO82_HERO_POLISH_PLAN,
    wo84: HMH_WO84_BOSS_SPECTACLE_PLAN,
    wo86: HMH_WO86_AUDIO_BAKEOFF,
    wo87: HMH_WO87_FULL_SFX_INVENTORY,
    wo88: HMH_WO88_SCORE_PLAN,
    wo89: HMH_WO89_AV_SYNC_POLISH,
    deviceQa: HMH_DEVICE_QA_STATUS,
  });
}
