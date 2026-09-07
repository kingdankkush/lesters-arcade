const freeze = (value) => {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
};

export const STACKED_FIXED_STEP_HZ = 60;
export const STACKED_MAX_CATCH_UP_STEPS = 4;
export const BOARD_WIDTH = 10;
export const BOARD_VISIBLE_ROWS = 20;
export const BOARD_BUFFER_ROWS = 4;
export const BOARD_ROWS = 24;
export const SPAWN_DELAY_TICKS = 0;
export const LINE_CLEAR_DELAY_TICKS = 0;
export const STACKED_MIN_PLACEMENT_TICKS = 2;
export const SOFT_DROP_FACTOR = 20;
export const STACKED_LEVEL_CAP = 30;
export const STACKED_COMBO_BONUS_CAP = 20;
export const GRAVITY_LEVEL_CAP = 15;
export const LOCK_LEVEL_CAP = 20;
export const STACKED_ZONE_COUNT = 6;
export const STACKED_GRAVITY_Q16 = freeze([1092, 1092, 1365, 1771, 2341, 3121, 4096, 5461, 7282, 9362, 13107, 16384, 21845, 32768, 65536, 131072]);
export const STACKED_LOCK_RULES = freeze([
  { minLevel: 1, maxLevel: 10, lockDelayTicks: 30, lockResetCap: 15 },
  { minLevel: 11, maxLevel: 13, lockDelayTicks: 26, lockResetCap: 15 },
  { minLevel: 14, maxLevel: 16, lockDelayTicks: 22, lockResetCap: 12 },
  { minLevel: 17, maxLevel: 18, lockDelayTicks: 18, lockResetCap: 10 },
  { minLevel: 19, maxLevel: 19, lockDelayTicks: 15, lockResetCap: 8 },
  { minLevel: 20, maxLevel: 30, lockDelayTicks: 12, lockResetCap: 6 }
]);
export const LOCK_DELAY_TICKS = freeze([30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 26, 26, 26, 22, 22, 22, 18, 18, 15, 12]);
export const LOCK_RESET_CAP = freeze([15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 12, 12, 12, 10, 10, 8, 6]);
export const STACKED_MAX_TICKS = 432000;
export const STACKED_MAX_PIECES = 216000;
export const STACKED_MAX_LINES = 86400;
export const STACKED_MAX_QUAD_CLEARS = 21600;
export const STACKED_MAX_SCORE = 1000000000000;
export const STACKED_MAX_ELAPSED_MS = 7200000;
export const STACKED_ACTION_COUNT = 8;
export const STACKED_ACTIONS = freeze(['moveLeft', 'moveRight', 'softDrop', 'hardDrop', 'rotateCW', 'rotateCCW', 'rotate180', 'hold']);
export const STACKED_MAX_MOVE_STEPS_PER_TICK = 1;
export const STACKED_MOVE_QUEUE_MAX = 9;
export const STACKED_INPUT_BUFFER_TICKS = 4;
export const DAS_TICKS = 8;
export const ARR_TICKS = 2;
export const DCD_TICKS = 0;
export const STACKED_DAS_RANGE_TICKS = freeze({ min: 4, max: 18 });
export const STACKED_ARR_RANGE_TICKS = freeze({ min: 1, max: 6 });
export const STACKED_DCD_RANGE_TICKS = freeze({ min: 0, max: 8 });
export const STACKED_EVIDENCE_CODEC_VERSION = 1;
export const STACKED_MAX_INPUT_TRANSITIONS = 432000;
export const STACKED_MAX_EVIDENCE_BYTES = 1302000;
export const STACKED_MAX_EVIDENCE_CHUNKS = 33;
export const STACKED_EVIDENCE_CHUNK_RAW_BYTES = 42000;
export const STACKED_EVIDENCE_CHUNK_B64_CHARS = 56000;
export const STACKED_MAX_STORED_REPLAY_CHARS = 240000;
export const STACKED_CLEAR_SCORES = freeze({ 0: 0, 1: 100, 2: 300, 3: 500, 4: 800 });
export const STACKED_MINI_SPIN_SCORES = freeze({ 0: 100, 1: 200, 2: 400 });
export const STACKED_FULL_SPIN_SCORES = freeze({ 0: 400, 1: 800, 2: 1200, 3: 1600 });
export const PERFECT_CLEAR_BONUS = freeze({ 1: 800, 2: 1200, 3: 1800, 4: 2000, chainedQuad: 3200 });
export const GARBAGE_START_TICK = 3600;
export const GARBAGE_INTERVAL_START_TICKS = 720;
export const GARBAGE_INTERVAL_STEP_TICKS = 30;
export const GARBAGE_INTERVAL_STEP_PERIOD_TICKS = 2700;
export const GARBAGE_INTERVAL_FLOOR_TICKS = 120;
export const GARBAGE_ROWS_PER_INJECTION = 1;
export const GARBAGE_PENDING_MAX = 8;
export const GARBAGE_HOLE_REPEAT_NUM = 3;
export const GARBAGE_HOLE_REPEAT_DEN = 5;
export const HASHPOWER_PER_CLEAR = freeze({ 0: 0, 1: 0, 2: 1, 3: 2, 4: 4 });
export const HASHPOWER_MAX = 8;
export const REORG_COST_PERIOD_TICKS = 10800;
export const REORG_COST_MAX = 12;
export const STACKED_QUALITY_TIERS = freeze({
  desktopHigh: { particleCapacity: 6000, resolutionCap: 2, maxPixelArea: 4000000, bloomCap: 0.35, antialias: true },
  desktopLow: { particleCapacity: 2600, resolutionCap: 1.5, maxPixelArea: 1600000, bloomCap: 0.22, antialias: false },
  mobile: { particleCapacity: 1200, resolutionCap: 1.25, maxPixelArea: 1600000, bloomCap: 0, antialias: false }
});
export const STACKED_ENTRY_JS_CAP = null;
export const STACKED_INITIAL_JS_CAP = null;
export const CELL_PX = 32;
export const STACKED_FRAME_SIZES = freeze({ wide: { width: 512, height: 640 }, tall: { width: 320, height: 800 } });
export const STACKED_ZONE_TRANSITION_TICKS = 150;
export const STACKED_ZONE_IDS = freeze(['genesis-vault', 'mempool-drift', 'hashrate-forge', 'scrypt-lattice', 'halving-eclipse', 'mainnet-aurora']);
export const STACKED_TERMINAL_REASONS = freeze(['block-out', 'lock-out', 'garbage-out', 'tick-ceiling', 'evidence-ceiling']);

export const STACKED_GAME_ID = 'stacked';
export const STACKED_CAPABILITIES = freeze(['leaderboard', 'achievements', 'ranked', 'audio', 'haptics']);
export const STACKED_URL_SLUG = 'stacked';
export const STACKED_URL_SLUG_ALIAS = 'stack';
export const STACKED_SEASON_ID = 'stacked-season-preview-1';
export const STACKED_BRIDGE_PROTOCOL = 'stacked-bridge/v1';
export const STACKED_RESULT_TUPLE_TAG = 'stacked-result-v1';
export const STACKED_RUN_SUMMARY_VERSION = 1;
export const STACKED_PLAYER_SETTINGS_KEY = 'stacked-player-settings-v1';
export const STACKED_REPLAY_KEY_PREFIX = 'stacked-replay-v1:';
export const STACKED_REPLAY_INDEX_KEY = 'stacked-replay-v1:index';
export const STACKED_FREE_MEDALS_KEY = 'stacked-free-medals-v1';
export const STACKED_TELEMETRY_MOUNT_ID = 'stackedStage';
export const STACKED_TELEMETRY_KEYS = freeze(['qualityProfile', 'reducedMotion', 'renderResolution', 'renderedParticles', 'particlePoolSize', 'simulationTick', 'runScore', 'garbageRowsInserted', 'runRestarts', 'longestRunTicks', 'assetsReady']);
