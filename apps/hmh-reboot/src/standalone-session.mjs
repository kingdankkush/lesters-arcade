import { HMH_GAME_ID } from '../../../sdk/hmh-bridge-protocol.mjs';

const STANDALONE_SEED = 0x484d4804;
const STANDALONE_HERO_IDS = Object.freeze(['lit-commando', 'lit-valkyrie', 'lester-original', 'lilly']);

function freezeRecord(value) {
  for (const child of Object.values(value)) {
    if (child && typeof child === 'object') freezeRecord(child);
  }
  return Object.freeze(value);
}

export function createStandaloneInitPayload({ heroId = 'lit-commando' } = {}) {
  if (!STANDALONE_HERO_IDS.includes(heroId)) throw new TypeError(`unsupported standalone hero ${heroId}`);
  return freezeRecord({
    gameId: HMH_GAME_ID,
    mode: 'free',
    heroId,
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
