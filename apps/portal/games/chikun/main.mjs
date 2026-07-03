// Chikun's Escape — Cabinet SDK v1 vertical slice entry.
// The parent portal owns wallet/profile/ranked writes. This entry exposes only
// deterministic game-loop helpers and SDK event emission through the adapter.

export {
  buildChikunVerticalSliceConfig,
  createChikunCabinet,
  loadChikunGame,
  simulateChikunRun,
} from '../../src/chikun-cabinet.mjs';

export { createChikunCabinet as default } from '../../src/chikun-cabinet.mjs';
