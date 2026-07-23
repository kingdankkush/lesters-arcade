import { HMH_GAME_ID } from '../../../sdk/hmh-bridge-protocol.mjs';

const STANDALONE_SEED = 0x484d4804;

function freezeRecord(value) {
  for (const child of Object.values(value)) {
    if (child && typeof child === 'object') freezeRecord(child);
  }
  return Object.freeze(value);
}

export function createStandaloneInitPayload() {
  return freezeRecord({
    gameId: HMH_GAME_ID,
    mode: 'free',
    heroId: 'male-commando',
    profile: {
      displayName: 'Standalone Developer',
      locale: 'en',
    },
    session: {
      seed: STANDALONE_SEED,
      buildHash: 'standalone-dev:hmh-reboot-04',
      seasonId: 'standalone',
      rankedEligible: false,
    },
    settings: {
      musicEnabled: true,
      screenShake: false,
      gore: false,
      reduceMotion: false,
      reduceFlash: false,
      colorblindTags: false,
    },
  });
}
