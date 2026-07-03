// Template Cabinet — Cabinet SDK v1 reference implementation.
// Copy this folder for new Lester's Arcade games. The parent owns identity,
// ranked submission, wallet actions, and profile writes; the cabinet emits SDK
// messages only.

import { createTemplateCabinetAdapter } from '../../src/game-adapter.mjs';

export function createTemplateCabinet({ sessionId = null } = {}) {
  const adapter = createTemplateCabinetAdapter({ sessionId });
  return Object.freeze({
    id: 'template-cabinet',
    adapter,
    init(context = {}) {
      return adapter.init({ mode: 'free', ...context });
    },
    start(config = {}) {
      return adapter.start({ mode: 'free', ...config });
    },
    tick({ score = 0 } = {}) {
      return adapter.emitStatUpdate({ score, kills: 0 });
    },
    end({ score = 0, survivalTime = 0 } = {}) {
      return adapter.end({ score, survivalTime });
    },
    teardown() {
      return adapter.teardown();
    },
  });
}

export default createTemplateCabinet;
