// The run plan of the ten-area real-child corpus (the 2.1.0 child's Level 1,
// run summary schema 8): pilot style x tick cap x hero, and the Ranked
// identity each run plays under. The ten-area world has one entry (the
// Meadows), so a row's seed ticket takes the first salt; the seed still binds
// the build hash, so every release plays fresh seeds from the same plan.
import { createHash } from 'node:crypto';
import { issueSeedTicket } from '../../server/verify/seed-ticket.mjs';
import { rankedSessionKey } from '../../apps/portal/src/ranked-identity.mjs';
import {
  FIXTURE_CHAIN_ID,
  FIXTURE_ISSUED_AT,
  FIXTURE_REGISTRY,
  FIXTURE_SEED_SECRET,
  FIXTURE_WALLET,
  GAME_ID,
  HARNESS_BUILD_HASH,
  SEASON_ID,
} from './identity.mjs';

export const TEN_AREA_HEROES = Object.freeze(['lit-commando', 'lit-valkyrie', 'lester-original', 'lilly']);

const rows = [
  ...[0, 1].map(() => ({ style: 'suicide', tickCap: 0, surrenderFrames: 30_000 })),
  ...[0, 1].map(() => ({ style: 'idle', tickCap: 90_000, surrenderFrames: 0 })),
  { style: 'brawler', tickCap: 3_000 },
  { style: 'brawler', tickCap: 8_000 },
  { style: 'brawler', tickCap: 15_000 },
  { style: 'hunter', tickCap: 30_000 },
  { style: 'hunter', tickCap: 60_000 },
  { style: 'hunter', tickCap: 90_000 },
  { style: 'hunter', tickCap: 110_000 },
  ...[40_000, 60_000, 80_000, 110_000, 110_000, 110_000].map((tickCap) => ({ style: 'explorer', tickCap })),
  ...[0, 1, 2].map(() => ({ style: 'turtle', tickCap: 110_000 })),
  ...[0, 1].map(() => ({ style: 'camper', tickCap: 110_000 })),
  ...[0, 1, 2, 3].map(() => ({ style: 'cover', tickCap: 110_000 })),
  ...[0, 1].map(() => ({ style: 'ledge', tickCap: 110_000 })),
  ...[0, 1].map(() => ({ style: 'grenadier', tickCap: 110_000 })),
  ...[0, 1, 2].map(() => ({ style: 'baron', tickCap: 110_000 })),
  ...[0, 1, 2, 3].map(() => ({ style: 'lockkeeper', tickCap: 110_000 })),
  ...[0, 1, 2].map(() => ({ style: 'foreman', tickCap: 110_000 })),
  ...[0, 1, 2].map(() => ({ style: 'bell', tickCap: 110_000 })),
];

export const TEN_AREA_PLAN = Object.freeze(rows.map((run, index) => Object.freeze({
  ...run,
  world: 'ten-area',
  entry: 'meadows',
  index,
  heroId: TEN_AREA_HEROES[index % TEN_AREA_HEROES.length],
  label: `t${String(index).padStart(2, '0')}-${run.style}-${run.tickCap}`,
})));
export const TEN_AREA_LABELS = Object.freeze(TEN_AREA_PLAN.map((run) => run.label));

const hexBytes = (hex) => Uint8Array.from(hex.match(/../g), (pair) => parseInt(pair, 16));
const plain = (value) => JSON.parse(JSON.stringify(value));

// → { salt, seed, seedTicket, identity, sessionId32 } for a ten-area plan row.
export async function tenAreaIdentityFor(run, { buildHash = HARNESS_BUILD_HASH } = {}) {
  const uuid = `33333333-3333-4333-8333-${String(run.index).padStart(12, '0')}`;
  const sessionId = `game-session-${uuid}`;
  const salt = createHash('sha256').update(`lesters-arcade ten-area realruns ${run.index}`).digest('hex').slice(0, 32);
  const { seedTicket, seed } = await issueSeedTicket({
    secret: FIXTURE_SEED_SECRET, nowMs: FIXTURE_ISSUED_AT * 1000, randomBytes: () => hexBytes(salt),
    sessionId, wallet: FIXTURE_WALLET, gameId: GAME_ID, seasonId: SEASON_ID, buildHash,
  });
  const identity = { sessionId, chainId: FIXTURE_CHAIN_ID, scoreRegistryAddress: FIXTURE_REGISTRY, wallet: FIXTURE_WALLET, gameId: GAME_ID, seasonId: SEASON_ID, buildHash, seed, nonce: uuid };
  return { salt, seed, seedTicket: plain(seedTicket), identity, sessionId32: await rankedSessionKey(identity) };
}
