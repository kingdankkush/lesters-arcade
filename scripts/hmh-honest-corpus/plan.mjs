// The run plan of the real-child corpus (pilot style x level entry x tick cap)
// and the Ranked identity each run plays under. A run's identity is a seed
// ticket issued with the public fixture secret for a fixed session id and
// wallet; the salt is searched until the ticket's seed lands on the wanted
// level entry, so the plan covers every entry with real seeds. The seed binds
// the build hash, so the same plan row plays a different seed on every child
// release.
import { createHash } from 'node:crypto';
import { selectLevelEntry } from '../../apps/hmh-reboot/src/level-entry.mjs';
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

export const LEVEL_ENTRIES = Object.freeze(['relay', 'ravine', 'hashwood', 'mining', 'yard']);
export const HEROES = Object.freeze(['lit-commando', 'lit-valkyrie']);
const E = LEVEL_ENTRIES;
const LOTTERY_STYLES = ['hunter', 'explorer', 'grenadier', 'greedy'];

// tickCap: the tick at which the pilot gives up and walks into the crowd
// (surrenderFrames bounds how long that may take); 0 means from the start.
export const PLAN = Object.freeze([
  ...E.map((entry) => ({ style: 'suicide', entry, tickCap: 0, surrenderFrames: 30_000 })),
  ...['relay', 'hashwood', 'yard'].map((entry) => ({ style: 'idle', entry, tickCap: 90_000, surrenderFrames: 0 })),
  { style: 'brawler', entry: 'relay', tickCap: 3_000 },
  { style: 'brawler', entry: 'ravine', tickCap: 6_000 },
  { style: 'brawler', entry: 'hashwood', tickCap: 10_000 },
  { style: 'brawler', entry: 'mining', tickCap: 15_000 },
  { style: 'brawler', entry: 'yard', tickCap: 20_000 },
  { style: 'grenadier', entry: 'relay', tickCap: 20_000 },
  { style: 'grenadier', entry: 'ravine', tickCap: 30_000 },
  { style: 'grenadier', entry: 'hashwood', tickCap: 45_000 },
  { style: 'grenadier', entry: 'mining', tickCap: 60_000 },
  { style: 'grenadier', entry: 'yard', tickCap: 80_000 },
  { style: 'grenadier', entry: 'relay', tickCap: 100_000 },
  { style: 'hunter', entry: 'relay', tickCap: 30_000 },
  { style: 'hunter', entry: 'ravine', tickCap: 45_000 },
  { style: 'hunter', entry: 'hashwood', tickCap: 60_000 },
  { style: 'hunter', entry: 'mining', tickCap: 80_000 },
  { style: 'hunter', entry: 'yard', tickCap: 100_000 },
  { style: 'hunter', entry: 'ravine', tickCap: 100_000 },
  ...E.map((entry) => ({ style: 'explorer', entry, tickCap: 100_000 })),
  { style: 'explorer', entry: 'relay', tickCap: 50_000 },
  { style: 'explorer', entry: 'hashwood', tickCap: 70_000 },
  { style: 'explorer', entry: 'yard', tickCap: 60_000 },
  ...E.map((entry) => ({ style: 'turtle', entry, tickCap: 110_000 })),
  { style: 'turtle', entry: 'mining', tickCap: 110_000 },
  { style: 'greedy', entry: 'relay', tickCap: 60_000 },
  { style: 'greedy', entry: 'ravine', tickCap: 80_000 },
  { style: 'greedy', entry: 'hashwood', tickCap: 100_000 },
  { style: 'greedy', entry: 'mining', tickCap: 100_000 },
  { style: 'greedy', entry: 'yard', tickCap: 100_000 },
  ...E.map((entry) => ({ style: 'kamikaze', entry, tickCap: 0, surrenderFrames: 30_000 })),
  { style: 'camper', entry: 'hashwood', tickCap: 110_000 },
  { style: 'camper', entry: 'ravine', tickCap: 110_000 },
  { style: 'camper', entry: 'mining', tickCap: 110_000 },
  // Long-run lottery: the styles that lived longest, on fresh seeds, uncapped.
  ...LOTTERY_STYLES.flatMap((style) => E.slice(0, 4).map((entry, k) => ({ style, entry: E[(k + LOTTERY_STYLES.indexOf(style)) % 5], tickCap: 110_000, lottery: true }))),
].map((run, index) => Object.freeze({ ...run, index, heroId: HEROES[index % 2], label: `r${String(index).padStart(2, '0')}-${run.style}-${run.entry}-${run.tickCap}` })));

// The twelve-run sample that proves the harness on a new child: one run per
// pilot style, every level entry, both heroes, two of them long-run lottery rows.
export const SAMPLE_LABELS = Object.freeze([0, 5, 9, 13, 20, 27, 37, 43, 46, 50, 55, 61].map((index) => PLAN[index].label));

const hexBytes = (hex) => Uint8Array.from(hex.match(/../g), (pair) => parseInt(pair, 16));
const plain = (value) => JSON.parse(JSON.stringify(value));

// → { salt, seed, seedTicket, identity, sessionId32 } for a plan row, under
// `buildHash` (this checkout's by default). Deterministic.
export async function identityFor(run, { buildHash = HARNESS_BUILD_HASH } = {}) {
  const uuid = `22222222-2222-4222-8222-${String(run.index).padStart(12, '0')}`;
  const sessionId = `game-session-${uuid}`;
  for (let attempt = 0; attempt < 500; attempt += 1) {
    const salt = createHash('sha256').update(`lesters-arcade realruns ${run.index} ${attempt}`).digest('hex').slice(0, 32);
    const { seedTicket, seed } = await issueSeedTicket({
      secret: FIXTURE_SEED_SECRET, nowMs: FIXTURE_ISSUED_AT * 1000, randomBytes: () => hexBytes(salt),
      sessionId, wallet: FIXTURE_WALLET, gameId: GAME_ID, seasonId: SEASON_ID, buildHash,
    });
    if (selectLevelEntry(seed).id !== run.entry) continue;
    const identity = { sessionId, chainId: FIXTURE_CHAIN_ID, scoreRegistryAddress: FIXTURE_REGISTRY, wallet: FIXTURE_WALLET, gameId: GAME_ID, seasonId: SEASON_ID, buildHash, seed, nonce: uuid };
    return { salt, seed, seedTicket: plain(seedTicket), identity, sessionId32: await rankedSessionKey(identity) };
  }
  throw new Error(`no salt reaches entry ${run.entry}`);
}
