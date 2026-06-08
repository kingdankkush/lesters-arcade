// Single import point for all canonical Hard Money Heroes actor manifests.
// The renderer imports CANONICAL_ACTOR_MANIFESTS and builds SpriteActors via
// buildActorRegistry(). Adding a character = ingest art + add one import here.
//
// Source: Justin's hand-made art, ingested by scripts/ingest-hmh-canonical-art.py.
// Generation tools only ADD frames/tilesets/VFX; they never redesign characters.

import { HMH_CANON_LESTER } from '../assets/generated/hmh-canonical-art/lester/lester.mjs';
import { HMH_CANON_LILLY } from '../assets/generated/hmh-canonical-art/lilly/lilly.mjs';
import { HMH_CANON_TRENCH_DEGEN } from '../assets/generated/hmh-canonical-art/trench-degen/trench-degen.mjs';
import { HMH_CANON_EVIL_BANKER } from '../assets/generated/hmh-canonical-art/evil-banker/evil-banker.mjs';
import { HMH_CANON_CRYPTO_BRO } from '../assets/generated/hmh-canonical-art/crypto-bro/crypto-bro.mjs';
import { HMH_CANON_GAS_BEAST } from '../assets/generated/hmh-canonical-art/gas-beast/gas-beast.mjs';
import { HMH_CANON_EVIL_BOSS } from '../assets/generated/hmh-canonical-art/evil-boss/evil-boss.mjs';
import { HMH_CANON_WARREN_BOSS } from '../assets/generated/hmh-canonical-art/warren-boss/warren-boss.mjs';

export const CANONICAL_ACTOR_MANIFESTS = Object.freeze({
  lester: HMH_CANON_LESTER,
  lilly: HMH_CANON_LILLY,
  'trench-degen': HMH_CANON_TRENCH_DEGEN,
  'evil-banker': HMH_CANON_EVIL_BANKER,
  'crypto-bro': HMH_CANON_CRYPTO_BRO,
  'gas-beast': HMH_CANON_GAS_BEAST,
  'evil-boss': HMH_CANON_EVIL_BOSS,
  'warren-boss': HMH_CANON_WARREN_BOSS,
});

// Roster classification so gameplay/balancing can iterate roles generically.
export const CANONICAL_ACTOR_ROLES = Object.freeze({
  heroes: Object.freeze(['lester', 'lilly']),
  enemies: Object.freeze(['trench-degen', 'evil-banker', 'crypto-bro', 'gas-beast']),
  bosses: Object.freeze(['evil-boss', 'warren-boss']),
});
