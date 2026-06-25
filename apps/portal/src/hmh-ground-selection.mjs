import { HMH_LEVEL_ONE_ID, selectLevelOneGroundTile } from './hmh-level-one-ground.mjs';
import { HMH_LEVEL_THREE_ID, selectLevelThreeGroundTile } from './hmh-level-three-ground.mjs';

export function selectHmhGroundTile(options = {}) {
  const levelId = options.levelId ?? HMH_LEVEL_ONE_ID;
  if (levelId === HMH_LEVEL_THREE_ID) return selectLevelThreeGroundTile(options);
  return selectLevelOneGroundTile(options);
}

export { HMH_LEVEL_ONE_ID, HMH_LEVEL_THREE_ID };
