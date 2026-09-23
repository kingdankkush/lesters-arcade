// Settle-slice fixtures: the verify double used by the settle unit tests, the
// achievements registry double (§6.2) and the local-chain helpers.
//
// Contract §10.4 rule 6: settle's verify and seed-ticket doubles are replaced
// by the real server/verify/** and session-seed.mjs. Seed tickets come from
// the real issueSeedTicket (server/verify/seed-ticket.mjs), and the verify
// double's bindRankedIdentity and computeEvidenceDigest ARE the real
// functions (counted, not reimplemented), as are the v2 envelope hash and the
// §5.3 error shapes. Only the replay stays a toy, inside verifyRankedRun and
// reverifyStoredRun: its score, stats, contract and plausibility are a simple
// function of the evidence, so a settle unit test can choose a run's score
// and length without playing it. The toy evidence below is shaped so the
// real functions accept it (a toy STACKED SIC1 has a valid header and
// checksum). tests/api-settle-handler.test.mjs settles through the real
// modules end to end and pins the double against the real verifier.
//
// Keys: Hardhat's public test mnemonic only (scripts/lib/local-chain.mjs).

import { Buffer } from 'node:buffer';
import { ethers } from 'ethers';
import { createCanonicalSessionIdentity } from '../../apps/portal/src/session-integrity.mjs';
import { RANKED_GAMES, RANKED_IDENTITY_KEYS, RANKED_SETTLE_VERSION, rankedEnvelopeHash } from '../../apps/portal/src/ranked-identity.mjs';
import { STACKED_EVIDENCE_CODEC_VERSION, STACKED_FIXED_STEP_HZ } from '../../apps/portal/src/stacked-contracts.mjs';
import { fnv1a32Bytes } from '../../apps/portal/src/stacked-sim.mjs';
import { LITVM_DEPLOYMENT } from '../../apps/portal/src/generated/litvm-addresses.mjs';
import * as realVerify from '../../server/verify/index.mjs';
import { issueSeedTicket } from '../../server/verify/seed-ticket.mjs';
import { invalid, isPlainObject, MAX_RANKED_SCORE as MAX_SCORE, rejected, scoreOutOfBounds } from '../../server/verify/verified-run.mjs';
import { activateLocalGames, deployLocalSuite, localContracts, localWalletKeys, startLocalChain } from '../../scripts/lib/local-chain.mjs';

export const SETTLE_SESSION_VALUE = `settle-fixture-${'a7'.repeat(16)}`;
export const SETTLE_CRON_VALUE = `cron-fixture-${'c3'.repeat(16)}`;
export const FIXTURE_NEON_URL = 'postgresql://fixture@db.invalid/settle';
export { RANKED_SETTLE_VERSION };
// LITVM_DEPLOYMENT.settlementGasReserveWei: 0.002 zkLTC since the 2026-09-23
// reserve amendment (deploy-config.testnet.json, the predicted address module).
export const REAL_SETTLEMENT_GAS_RESERVE_WEI = LITVM_DEPLOYMENT.settlementGasReserveWei;
// The fee cap is 5 x the deployment's settlement gas reserve (§3.4). The
// in-process chain quotes about 1.07 gwei (ethers' getFeeData adds a 1 gwei
// priority fee to twice the base fee). Under the old 0.0001 zkLTC reserve a
// plain settlement (a 530k-590k gas limit, 5.7e14-6.3e14 wei) exceeded its 5e14 cap,
// so the fixture deployment carried a 1e16 override. With the 0.002 zkLTC
// reserve the cap is 1e16 wei and the real reserve clears the local chain, so
// deploymentFromRecord now uses the record's own reserve (the deploy config's,
// which equals LITVM_DEPLOYMENT's; tests/server-relayer.test.mjs pins the
// fee levels at which it holds). LOCAL_FEE_CAP_RESERVE_WEI remains the name
// the settle tests pass for the cap, and it is the real reserve.
export const LOCAL_FEE_CAP_RESERVE_WEI = REAL_SETTLEMENT_GAS_RESERVE_WEI;

export const FIXTURE_BUILD_HASHES = Object.freeze({
  'lester-blaster': 'site-1.7.0:game-1.7.0',
  chikun: 'site-1.7.0:game-1.7.0:cabinet-0.9.0',
  stacked: 'site-1.7.0:game-1.7.0:cabinet-1.6.0',
});
const ENCODINGS = Object.freeze(Object.fromEntries(Object.entries(RANKED_GAMES).map(([gameId, game]) => [gameId, game.evidenceEncoding])));

export function fixtureEnv({ registry, extra = {} } = {}) {
  const keys = localWalletKeys();
  return {
    VERCEL_ENV: 'development',
    SESSION_SECRET: SETTLE_SESSION_VALUE,
    NEON_DATABASE_URL: FIXTURE_NEON_URL,
    RANKED_VERIFIER_PRIVATE_KEY: keys.verifier,
    RANKED_RELAYER_PRIVATE_KEY: keys.relayer,
    RANKED_SCORE_REGISTRY_ADDRESS: String(registry).toLowerCase(),
    CRON_SECRET: SETTLE_CRON_VALUE,
    ...extra,
  };
}

// A LITVM_DEPLOYMENT-shaped object for a local deployment record. The fee
// cap uses the record's own settlement gas reserve (what openSession charges
// and forwards to the relayer) unless a test overrides it.
export function deploymentFromRecord(record, { reserveWei = record.settlementGasReserveWei ?? REAL_SETTLEMENT_GAS_RESERVE_WEI } = {}) {
  const addresses = record.addresses;
  return Object.freeze({
    status: 'deployed',
    chainId: 4441,
    source: 'local-chain',
    startBlock: record.startBlock ?? 0,
    settlementGasReserveWei: String(reserveWei),
    addresses: Object.freeze({
      gameRegistry: addresses.gameRegistry.toLowerCase(),
      playerProfileRegistry: addresses.playerProfileRegistry.toLowerCase(),
      arcadeRankedEntry: addresses.arcadeRankedEntry.toLowerCase(),
      scoreSubmissionRegistry: addresses.scoreSubmissionRegistry.toLowerCase(),
      achievementRegistries: Object.freeze(Object.fromEntries(Object.entries(addresses.achievementRegistries).map(([slug, address]) => [slug, address.toLowerCase()]))),
    }),
  });
}

export async function bootLocalChain() {
  const chain = await startLocalChain();
  const record = await deployLocalSuite({ provider: chain.provider, wallets: chain.wallets });
  await activateLocalGames({ provider: chain.provider, record, developer: chain.wallets.developer, operator: chain.wallets.operator });
  return { chain, record, deployment: deploymentFromRecord(record), contracts: localContracts(record, chain.provider) };
}

// Opens a paid Ranked session from `player` for the exact quoted total (or
// `value`). Returns the transaction hash, the amount and openedAt.
export async function openPaidSession({ chain, record, player, sessionId32, gameId, value = null, wait = true }) {
  const entry = localContracts(record, player).rankedEntry;
  const gameId32 = ethers.id(gameId);
  const quote = await entry.quoteEntry(gameId32);
  const amount = value === null ? quote.totalWei : BigInt(value);
  const tx = await entry.openSession(sessionId32, gameId32, { value: amount });
  if (!wait) return { txHash: tx.hash.toLowerCase(), amountWei: amount };
  const receipt = await tx.wait();
  const block = await chain.provider.getBlock(receipt.blockNumber);
  return { txHash: tx.hash.toLowerCase(), amountWei: amount, openedAt: Number(block.timestamp), blockNumber: receipt.blockNumber };
}

// --- Evidence ----------------------------------------------------------------

// Chikun: survival = min(maxTicks, sum(flapDeltas) + 120) ticks; one fork per
// flap; score 100 per fork.
export function chikunEvidence({ seed, flaps = 12, gap = 90, maxTicks = 216_000 } = {}) {
  return { encoding: ENCODINGS.chikun, flap: { version: 'chikun-flap-evidence-v6', seed, fixedStepHz: 60, maxTicks, flapDeltas: Array.from({ length: flaps }, (_, index) => (index === 0 ? 30 : gap)) } };
}

// STACKED: a toy SIC1 whose header, counts and checksum pass the real
// decoder (verify's decodeStackedEvidence), so the real computeEvidenceDigest
// accepts it: 24 header bytes, then one payload byte per line (at least 2).
// The header seed is the ticket seed, as in a real run. The toy replay reads
// one line per payload byte, 60 ticks per line, score 100 per line.
export const TOY_SIC1_HEADER_BYTES = 24;
export function stackedEvidence({ lines = 20, seed = 1 } = {}) {
  if (!Number.isSafeInteger(lines) || lines < 2) throw new RangeError('a toy SIC1 needs at least 2 lines');
  const bytes = new Uint8Array(TOY_SIC1_HEADER_BYTES + lines).fill(0x5a, TOY_SIC1_HEADER_BYTES);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x53494331);
  bytes[4] = STACKED_EVIDENCE_CODEC_VERSION;
  bytes[5] = 1;
  view.setUint16(6, STACKED_FIXED_STEP_HZ);
  view.setUint32(8, seed >>> 0);
  view.setUint32(12, lines * 60);
  view.setUint32(16, 0);
  view.setUint32(20, fnv1a32Bytes(bytes.subarray(TOY_SIC1_HEADER_BYTES)));
  return { encoding: ENCODINGS.stacked, sic1: Buffer.from(bytes).toString('base64'), startLevel: 1 };
}

// HMH: the summary carries its own score and length (plausibility-checked).
export function hmhEvidence({ seed, buildHash = FIXTURE_BUILD_HASHES['lester-blaster'], heroId = 'lit-commando', score = 4200, kills = 30, boss = 0, elapsedMs = 240_000, maxCombo = 12, xp = 4500, sessionKey = null } = {}) {
  return {
    encoding: ENCODINGS['lester-blaster'],
    runSummary: {
      schemaVersion: 6,
      // terminalReason sits in identity, where run summary schema v6 keeps it.
      identity: { heroId, seed, buildHash, mode: 'ranked', terminalReason: 'defeated' },
      totals: { score, elapsedMs, maxCombo, level: 5, xp },
      kills: { total: kills, boss },
    },
    sessionEnvelope: { version: 'lesters-session-envelope-v1', sessionKey },
  };
}

// A complete §5.1 body with a real seed ticket (the verify slice's
// issueSeedTicket) and its seed, and toy evidence at that seed.
export async function buildSettleBody({
  gameId = 'chikun', wallet, registry, secret = SETTLE_SESSION_VALUE, nowMs, uuid = null, evidence = null,
  evidenceOptions = {}, entryTxHash = null, claim = undefined, ticketIssuedAtMs = null, buildHash = FIXTURE_BUILD_HASHES[gameId],
}) {
  const id = uuid ?? crypto.randomUUID();
  const sessionId = `game-session-${id}`;
  const seasonId = RANKED_GAMES[gameId].seasonId;
  const walletLower = String(wallet).toLowerCase();
  const issued = await issueSeedTicket({ secret, nowMs: ticketIssuedAtMs ?? nowMs, sessionId, wallet: walletLower, gameId, seasonId, buildHash });
  const { seed } = issued;
  const seedTicket = { ...issued.seedTicket };
  const identity = { sessionId, chainId: 4441, scoreRegistryAddress: String(registry).toLowerCase(), wallet: walletLower, gameId, seasonId, buildHash, seed, nonce: id };
  const canonical = await createCanonicalSessionIdentity(identity);
  let bodyEvidence = evidence;
  if (!bodyEvidence) {
    if (gameId === 'chikun') bodyEvidence = chikunEvidence({ seed, ...evidenceOptions });
    else if (gameId === 'stacked') bodyEvidence = stackedEvidence({ seed, ...evidenceOptions });
    else bodyEvidence = hmhEvidence({ seed, buildHash, sessionKey: canonical.sessionKey, ...evidenceOptions });
  }
  const body = { v: RANKED_SETTLE_VERSION, gameId, sessionId32: canonical.sessionKey, identity, seedTicket, entryTxHash, evidence: bodyEvidence };
  if (claim !== undefined) body.claim = claim;
  return body;
}

// --- Verify double (§5.2, §5.3) ----------------------------------------------

// Stored evidence text → the §5.1 evidence object (as the real per-game parsers).
function evidenceFromStored(gameId, { encoding, text }) {
  if (gameId === 'chikun') return { encoding, flap: JSON.parse(text) };
  if (gameId === 'stacked') return { encoding, sic1: text, startLevel: 1 };
  const parsed = JSON.parse(text);
  return { encoding, runSummary: parsed.runSummary, sessionEnvelope: parsed.sessionEnvelope };
}

// The toy replay: score, stats, contract and plausibility from the evidence.
// It only runs on evidence the real computeEvidenceDigest already accepted.
function toyReplay(gameId, evidence, identity) {
  if (gameId === 'chikun') {
    const { flap } = evidence;
    if (flap.version !== 'chikun-flap-evidence-v6') return invalid('evidence-version-unsupported');
    if (flap.seed !== identity.seed) return invalid('evidence-seed-mismatch');
    if (!Array.isArray(flap.flapDeltas)) return invalid('invalid-evidence');
    const forks = flap.flapDeltas.length;
    const ticks = Math.min(Number(flap.maxTicks), flap.flapDeltas.reduce((sum, delta) => sum + delta, 0) + 120);
    const bestCombo = Math.min(forks, 12);
    const stats = { score: forks * 100, survivalTicks: ticks, survivalSeconds: Number((ticks / 60).toFixed(3)), coinsCollected: forks, forksPassed: forks, nearMisses: 0, bestCombo, nearMissStreakBest: 0, flawlessRegions: 0, flapCount: forks, distanceMeters: forks * 10, regionIndexReached: 0, regionReached: 'coast', laps: 0, speedMultiplierReached: 1, terminalReason: 'crash', evidenceVersion: flap.version };
    return { score: stats.score, stats, contract: { kills: forks, maxCombo: Math.min(bestCombo, 10_000), survivalSeconds: Math.floor(ticks / 60), bossId: null } };
  }
  if (gameId === 'stacked') {
    const bytes = Buffer.from(evidence.sic1, 'base64');
    if (bytes.readUInt32BE(8) !== identity.seed) return invalid('evidence-seed-mismatch');
    const lines = bytes.length - TOY_SIC1_HEADER_BYTES;
    const ticks = lines * 60;
    const maxCombo = Math.min(lines, 5);
    const stats = { score: lines * 100, lines, level: 1 + Math.floor(lines / 10), quadClears: Math.floor(lines / 4), spins: 0, perfectClears: 0, maxCombo, maxBackToBack: 0, garbageRowsReceived: 0, garbageRowsCleared: 0, pieces: lines * 3, holdsUsed: 0, ticks, survivalSeconds: Number((ticks / 60).toFixed(3)), zone: 'zone-1', terminalReason: 'block-out', boardHash: '0x00' };
    return { score: stats.score, stats, contract: { kills: lines, maxCombo, survivalSeconds: Math.floor(ticks / 60), bossId: null } };
  }
  const summary = evidence.runSummary;
  if (typeof summary?.identity?.heroId !== 'string' || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(summary.identity.heroId)) return invalid('run-summary-invalid');
  if (summary?.identity?.seed !== identity.seed || summary?.identity?.buildHash !== identity.buildHash || summary?.identity?.mode !== 'ranked') return invalid('run-summary-identity-mismatch');
  if (summary.identity.terminalReason !== 'defeated') return invalid('run-summary-not-terminal');
  if (evidence.sessionEnvelope?.version !== 'lesters-session-envelope-v1' || evidence.sessionEnvelope?.sessionKey !== identity.sessionKey) return invalid('session-envelope-invalid');
  const totals = summary.totals;
  // Plausibility in the verifier's shape: { verdict, flags: [{ id, severity, value, limit }] }.
  // XP above 1,000,000 is an impossibility (rejected); above 100,000 is a soft flag.
  const flags = [];
  if (totals.xp > 1_000_000) flags.push(Object.freeze({ id: 'xp-above-ceiling', severity: 'reject', value: totals.xp, limit: 1_000_000 }));
  if (totals.xp > 100_000) flags.push(Object.freeze({ id: 'xp-near-ceiling', severity: 'flag', value: totals.xp, limit: 100_000 }));
  const verdict = flags.some((flag) => flag.severity === 'reject') ? 'rejected' : flags.length ? 'flagged' : 'ok';
  if (verdict === 'rejected') return rejected('implausible-run', { flags: Object.freeze(flags) });
  const stats = { score: totals.score, kills: summary.kills.total, bossKills: summary.kills.boss, eliteKills: 0, maxCombo: totals.maxCombo, level: totals.level, xp: totals.xp, survivalTicks: Math.floor(totals.elapsedMs * 0.06), elapsedMs: totals.elapsedMs, survivalSeconds: Number((totals.elapsedMs / 1000).toFixed(3)), noDamage: 0, heroId: summary.identity.heroId, terminalReason: summary.identity.terminalReason };
  return {
    score: totals.score,
    stats,
    contract: { kills: Math.min(summary.kills.total, 100_000), maxCombo: Math.min(totals.maxCombo, 10_000), survivalSeconds: Math.min(Math.floor(totals.elapsedMs / 1000), 86_400), bossId: summary.kills.boss > 0 ? 'boss-liquidator' : null },
    plausibility: { verdict, flags },
  };
}

// The VerifiedRun of §5.3 around a toy replay. The stored evidence record
// (text, bytes, digest, and every decode failure) is the real
// computeEvidenceDigest's, and the envelope hash is the real rankedEnvelopeHash.
async function verifiedRunFor({ gameId, identity, evidence, nowMs }) {
  const record = await realVerify.computeEvidenceDigest({ gameId, evidence });
  if (!record.ok) return record;
  let replay;
  try {
    replay = toyReplay(gameId, evidence, identity);
  } catch {
    return invalid('invalid-evidence');
  }
  if (replay.ok === false) return replay;
  if (replay.score > MAX_SCORE) return scoreOutOfBounds(replay.score);
  const envelopeHash = await rankedEnvelopeHash({ gameId, sessionId32: identity.sessionKey, encoding: record.encoding, evidenceDigest: record.digest });
  const run = {
    ok: true,
    gameId,
    sessionId32: identity.sessionKey,
    sessionHandle: identity.sessionId,
    wallet: identity.wallet,
    seasonId: identity.seasonId,
    runtimeId: RANKED_GAMES[gameId].runtimeId,
    buildHash: identity.buildHash,
    seed: identity.seed,
    score: replay.score,
    contract: Object.freeze({ ...replay.contract }),
    stats: Object.freeze({ ...replay.stats }),
    evidence: Object.freeze({ encoding: record.encoding, text: record.text, bytes: record.bytes, digest: record.digest }),
    envelopeHash,
    identity: { ...identity },
    // Like the real VerifiedRun: the HMH validator verdict, null for replayed games.
    plausibility: replay.plausibility ?? null,
    verifiedAt: new Date(nowMs).toISOString(),
  };
  return Object.freeze(run);
}

// { bindRankedIdentity, verifyRankedRun, computeEvidenceDigest, reverifyStoredRun, calls }
// bindRankedIdentity and computeEvidenceDigest are the real server/verify
// functions behind a call counter; verifyRankedRun and reverifyStoredRun run
// the real checks around the toy replay.
export function createVerifyDouble({ nowMs = () => Date.now() } = {}) {
  const calls = { bindRankedIdentity: 0, verifyRankedRun: 0, computeEvidenceDigest: 0, reverifyStoredRun: 0, reverifyNowMs: [] };
  const clock = () => (typeof nowMs === 'function' ? nowMs() : Number(nowMs));

  async function bindRankedIdentity(body, options) {
    calls.bindRankedIdentity += 1;
    return realVerify.bindRankedIdentity(body, options);
  }

  // The real verifyRankedRun's order: bind (unless `bound` is given), check
  // the binding belongs to this body, then replay.
  async function verifyRankedRun(body, options = {}) {
    calls.verifyRankedRun += 1;
    const bound = options.bound ?? await bindRankedIdentity(body, options);
    if (!bound?.ok) return bound ?? invalid('identity-invalid');
    if (!isPlainObject(body) || bound.gameId !== body.gameId || bound.identity?.sessionKey !== body.sessionId32) return invalid('session-key-mismatch');
    return verifiedRunFor({ gameId: bound.gameId, identity: bound.identity, evidence: body.evidence, nowMs: options.nowMs ?? clock() });
  }

  // { ok:true, encoding, text, bytes, digest } | { ok:false, status:400, error, detail? }; never throws.
  async function computeEvidenceDigest(body) {
    calls.computeEvidenceDigest += 1;
    return realVerify.computeEvidenceDigest(body);
  }

  // The real reverifyStoredRun's checks (game, canonical identity and session
  // key, encoding, parse, canonical stored text) around the toy replay.
  async function reverifyStoredRun({ gameId, identity, evidence } = {}, { nowMs: now } = {}) {
    calls.reverifyStoredRun += 1;
    calls.reverifyNowMs.push(now ?? null);
    if (!Object.hasOwn(RANKED_GAMES, gameId)) return invalid('identity-game-unknown');
    if (!isPlainObject(identity) || identity.gameId !== gameId) return invalid('identity-invalid');
    let canonical;
    try {
      canonical = await createCanonicalSessionIdentity(Object.fromEntries(RANKED_IDENTITY_KEYS.map((key) => [key, identity[key]])));
    } catch {
      return invalid('identity-invalid');
    }
    if (canonical.sessionKey !== identity.sessionKey) return invalid('session-key-mismatch');
    if (!isPlainObject(evidence) || evidence.encoding !== RANKED_GAMES[gameId].evidenceEncoding || typeof evidence.text !== 'string') return invalid('invalid-evidence');
    let parsed;
    try {
      parsed = evidenceFromStored(gameId, evidence);
    } catch {
      return invalid('invalid-evidence');
    }
    const run = await verifiedRunFor({ gameId, identity: canonical, evidence: parsed, nowMs: now ?? clock() });
    if (run.ok && run.evidence.text !== evidence.text) return invalid('invalid-evidence', 'stored evidence text is not canonical');
    return run;
  }

  return { bindRankedIdentity, verifyRankedRun, computeEvidenceDigest, reverifyStoredRun, calls };
}

// --- Achievements registry double (§6.2) --------------------------------------

function entry(gameId, id, tier, nft, criteria) {
  return Object.freeze({ id, gameId, title: `Title ${id}`, description: `About ${id}`, tier, category: 'fixture', nft, available: true, order: 0, image: `/assets/fixture/${id}.png`, lockedImage: `/assets/fixture/${id}-locked.png`, criteria, progress: null });
}

// Small catalogs with every criterion kind: always, per-run, run count,
// cumulative sum, and NFT candidates. `extraNft` adds that many NFT entries
// earned by every run (to exercise the 32-id cap).
export function createCatalogDouble({ extraNft = 0 } = {}) {
  const catalogs = {
    chikun: [
      entry('chikun', 'chikun-first-flight', 'bronze', false, () => true),
      entry('chikun', 'chikun-ten-forks', 'silver', false, (run) => run.stats.forksPassed >= 10),
      entry('chikun', 'chikun-three-runs', 'gold', false, (run, history) => history.runs + 1 >= 3),
      entry('chikun', 'chikun-forks-total-40', 'gold', false, (run, history) => (history.sums.forksPassed ?? 0) + run.stats.forksPassed >= 40),
      entry('chikun', 'chikun-coast-legend', 'platinum', true, (run) => run.score >= 2000),
      entry('chikun', 'chikun-unavailable', 'platinum', true, () => true),
    ],
    stacked: [
      entry('stacked', 'stacked-first-stack', 'bronze', false, () => true),
      entry('stacked', 'stacked-line-legend', 'platinum', true, (run) => run.stats.lines >= 30),
    ],
    'lester-blaster': [
      entry('lester-blaster', 'first-blood', 'bronze', false, (run) => run.stats.kills >= 1),
      entry('lester-blaster', 'two-hundred-ranked-runs', 'mythic', true, (run, history) => history.runs + 1 >= 200),
    ],
  };
  catalogs.chikun[5] = Object.freeze({ ...catalogs.chikun[5], available: false });
  for (let index = 1; index <= extraNft; index += 1) {
    catalogs.chikun.push(entry('chikun', `chikun-nft-${String(index).padStart(2, '0')}`, 'platinum', true, () => true));
  }
  const calls = { deriveEarnedAchievements: 0, historyFieldsFor: 0 };
  const catalogFor = (gameId) => {
    if (!Object.hasOwn(catalogs, gameId)) throw new TypeError(`unknown gameId ${gameId}`);
    return catalogs[gameId];
  };
  return {
    calls,
    ACHIEVEMENT_GAME_IDS: ['lester-blaster', 'chikun', 'stacked'],
    catalogFor,
    achievementById: (gameId, id) => catalogFor(gameId).find((item) => item.id === id) ?? null,
    nftAchievementIds: (gameId) => catalogFor(gameId).filter((item) => item.nft).map((item) => item.id),
    historyFieldsFor: (gameId) => {
      calls.historyFieldsFor += 1;
      catalogFor(gameId);
      return gameId === 'chikun' ? { sum: ['forksPassed'], max: ['score'] } : { sum: [], max: ['score'] };
    },
    deriveEarnedAchievements: (gameId, verifiedRun, history) => {
      calls.deriveEarnedAchievements += 1;
      if (verifiedRun.gameId !== gameId) throw new TypeError('verifiedRun.gameId must equal gameId');
      return catalogFor(gameId).filter((item) => item.available && !history.unlockedIds.includes(item.id) && item.criteria(verifiedRun, history));
    },
    achievementId32: (lib, id) => lib.id(id),
  };
}

// The hero policy as loadHeroGates builds it from server/verify/hmh.mjs:
// HMH_HERO_GATES (hero id → required Ranked runs) and HMH_FREE_HEROES, both
// from hmh-character-config.mjs.
export const HERO_GATES_DOUBLE = Object.freeze({
  gates: Object.freeze({ 'lester-original': 5, lilly: 10 }),
  free: Object.freeze(['lit-commando', 'lit-valkyrie']),
});
