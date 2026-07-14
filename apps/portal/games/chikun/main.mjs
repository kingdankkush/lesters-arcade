// Chikun's Escape — Cabinet SDK v1 deterministic core entry.
// The parent portal owns wallet/profile/ranked writes. This entry exposes only
// fixed-step deterministic helpers, bounded flap evidence, replay, and SDK
// event emission through the adapter.

export {
  CHIKUN_CABINET_VERSION,
  CHIKUN_FIXED_STEP_HZ,
  CHIKUN_MAX_FLAP_TRANSITIONS,
  CHIKUN_RUNTIME_VERSION,
  buildChikunReplayClaim,
  buildChikunVerticalSliceConfig,
  createChikunCabinet,
  loadChikunGame,
  replayChikunRun,
  simulateChikunRun,
  verifyChikunReplayClaim,
} from '../../src/chikun-cabinet.mjs';

export { createChikunCabinet as default } from '../../src/chikun-cabinet.mjs';
