import { WORLD_DESIGN_SITES } from './world-design-encounters.mjs';

// Loaded only for an explicitly requested evidence tour.
export function createWorldTourSpawns(authoredPointOfInterestPlacements) {
  const worldTourSpawns = Object.freeze({
    ...Object.fromEntries(WORLD_DESIGN_SITES.map(s=>[`site-${s.id}`,{x:s.x,y:s.y+100}])),
    farmhouse: Object.freeze({x:650,y:1880}),
    reservoir: Object.freeze({x:5770,y:4150}),
    chapel: Object.freeze({x:11480,y:750}),
    duplex: Object.freeze({x:11320,y:4450}),
    warehouse: Object.freeze({x:10700,y:3990}),
    escarpment: Object.freeze({x:3680,y:4460}),
    footbridge: Object.freeze({x:4750,y:975}),
    // W-6 (Cycle 074): the ravine and mining set-pieces now stand on the
    // contract landmarks north of the route, so these two cameras step north
    // to keep the spire and the headframe in frame below the HUD while the
    // ledge fronts stay in the bottom of the view.
    // ravine stays at y 1500: the collectibles smoke walks north-east from here into the
    // overlook cache at (3200, 1400); the ravine set-piece at y 1250 is still inside the frame.
    ravine: Object.freeze({ x: 3_050, y: 1_500 }),
    bridge: Object.freeze({ x: 4_700, y: 2_400 }),
    hazard: Object.freeze({ x: 3_500, y: 3_100 }),
    // Keep the tour hero east of the beacon, not at its exact foot pivot.
    // Northward framing keeps the full beacon below the desktop cockpit.
    hashwood: Object.freeze({ x: 7_350, y: 800 }),
    // mining stays at y 1600: the collectibles smoke walks east from here through the
    // auto-miner cache, and the mining set-piece at y 1250 is still inside the frame.
    mining: Object.freeze({ x: 9_200, y: 1_600 }),
    yard: Object.freeze({ x: 11_000, y: 800 }),
    // P5: the A1-A7 waves added 29 props that no pinned scene could see, so
    // the regression gate was not watching them. These two tours put the camp
    // kit and the water dressing on camera.
    'camp-hashwood': Object.freeze({ x: 7_150, y: 2_500 }),
    'crossing-water': Object.freeze({ x: 4_900, y: 1_050 }),
    // W-8: the two spawn camps no existing window sees (relay-north and
    // yard-south are offscreen for all twelve pinned scenes).
    'camp-relay-north': Object.freeze({ x: 1_550, y: 620 }),
    'camp-yard-south': Object.freeze({ x: 11_500, y: 3_700 }),
    // W-10: the two fence yards no pinned window sees (the fuel yard is on
    // the collectible-crossing-fuel-depot tour).
    'yard-relay-depot': Object.freeze({ x: 1_550, y: 3_700 }),
    'yard-mining-shack': Object.freeze({ x: 8_900, y: 3_715 }),
    ...Object.fromEntries(authoredPointOfInterestPlacements.map((placement) => [
      `collectible-${placement.pointOfInterestId}`,
      Object.freeze({ x: placement.x, y: placement.y }),
    ])),
  });
  return worldTourSpawns;
}

export function createRosterPreviewOffsets({forkedStandardPilotEnabled,bearMarketBurnerPilotEnabled}) {
    const rosterPreviewOffsets = Object.freeze(forkedStandardPilotEnabled ? {
      // Evidence-only melee corridor: three nearby human/zombie targets prove
      // thrust/sweep contacts without changing canonical encounter placement.
      'bagholder-rusher': Object.freeze({ x: -54, y: -8 }),
      forkrunner: Object.freeze({ x: -68, y: 0 }),
      'liquidator-agent': Object.freeze({ x: -82, y: 10 }),
      'whale-enforcer': Object.freeze({ x: 120, y: -100 }),
      'gas-bomber': Object.freeze({ x: 140, y: 20 }),
      'validator-cultist': Object.freeze({ x: 100, y: 140 }),
    } : bearMarketBurnerPilotEnabled ? {
      // Evidence-only close corridor: three human/zombie targets sit inside
      // the Burner's base 25-degree cone while the remaining roster stays
      // visible behind the player. Canonical encounter placement is unchanged.
      'bagholder-rusher': Object.freeze({ x: -100, y: -20 }),
      forkrunner: Object.freeze({ x: -140, y: 0 }),
      'liquidator-agent': Object.freeze({ x: -180, y: 20 }),
      'whale-enforcer': Object.freeze({ x: 120, y: -100 }),
      'gas-bomber': Object.freeze({ x: 140, y: 20 }),
      'validator-cultist': Object.freeze({ x: 100, y: 140 }),
    } : {
      'bagholder-rusher': Object.freeze({ x: -120, y: -80 }),
      forkrunner: Object.freeze({ x: 0, y: -100 }),
      'liquidator-agent': Object.freeze({ x: 120, y: -80 }),
      'whale-enforcer': Object.freeze({ x: -120, y: 140 }),
      'gas-bomber': Object.freeze({ x: 0, y: 160 }),
      'validator-cultist': Object.freeze({ x: 120, y: 140 }),
    });
return rosterPreviewOffsets;
}
