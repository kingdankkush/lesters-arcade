// The 1.8.x child's collectible placements, built as its main.mjs builds them,
// for the v6 plausibility tests (1.8.4 consistency rules).
import { LEVEL_ONE_WORLD, createLevelOneGroundQuery } from '../../../apps/hmh-reboot/src/level-one-world.mjs';
import { createCollectibleState } from '../../../apps/hmh-reboot/src/collectible-system.mjs';
import { objectiveRewardPlacements } from '../../../apps/hmh-reboot/src/objective-rewards.mjs';
import { buildAuthoredPointOfInterestPlacements } from '../../../apps/hmh-reboot/src/authored-prop-layout.mjs';
import { createLightningLedgerRareEvent } from '../../../apps/hmh-reboot/src/lightning-ledger-event.mjs';
import { createBearMarketBurnerEvent } from '../../../apps/hmh-reboot/src/bear-market-burner-event.mjs';
import { createForkedStandardEvent } from '../../../apps/hmh-reboot/src/forked-standard-event.mjs';

const WORLD = LEVEL_ONE_WORLD.bounds;
const queryGround = createLevelOneGroundQuery();


// The authored point-of-interest assets main.mjs re-arms, and after how long
// (the plausibility test pins both against main.mjs).
export const HMH_CHILD_REARMED_ASSETS = Object.freeze(['coin-blaster', 'scatter-shotgun', 'auto-miner', 'launcher-rig', 'time-dilation', 'berserk-candle']);
export const HMH_CHILD_REARM_TICKS = 10_800;

// The child's collectible state for `seed`, with its 21 placements built as
// main.mjs builds them (the events' blocked-point check is not modelled, so an
// event may sit a few units from where the child puts it).
export function hmhChildCollectibleState(seed) {
  const authored = buildAuthoredPointOfInterestPlacements(LEVEL_ONE_WORLD.pointsOfInterest);
  const reachable = (point, ground) => ground.kind !== 'deep-water' && point.x >= WORLD.minX && point.x <= WORLD.maxX && point.y >= WORLD.minY && point.y <= WORLD.maxY;
  const inDistricts = (ids) => authored.filter((placement) => ids.includes(placement.districtId));
  const lightning = createLightningLedgerRareEvent({ seed, candidates: inDistricts(['liquidity-crossing', 'hashwood', 'mining-camp']), protectedPoints: authored, queryGround, isBlocked: () => false, isRouteReachable: reachable });
  const burner = createBearMarketBurnerEvent({ seed, candidates: inDistricts(['rugpull-ravine', 'mining-camp', 'liquidation-yard']), protectedPoints: [...authored, lightning], queryGround, isBlocked: () => false, isRouteReachable: reachable });
  const standard = createForkedStandardEvent({ seed, candidates: inDistricts(['hashwood', 'mining-camp', 'liquidation-yard']), protectedPoints: [...authored, lightning, burner], queryGround, isBlocked: () => false, isRouteReachable: reachable });
  const placements = [...authored.map((placement) => (HMH_CHILD_REARMED_ASSETS.includes(placement.assetId) ? Object.freeze({ ...placement, respawnTicks: HMH_CHILD_REARM_TICKS }) : placement)), lightning, burner, standard];
  return createCollectibleState({ placements, objectivePlacements: objectiveRewardPlacements() });
}
