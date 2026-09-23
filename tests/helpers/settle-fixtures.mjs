// Settle-slice fixtures: contract-shaped doubles for the verify slice
// (§5.2, §5.3, §2.7) and the achievements registry (§6.2), plus local-chain
// helpers. The doubles stand in until the settle-wiring step replaces them
// with server/verify/** and apps/portal/src/achievements/** (contract §10.4
// rule 6). They honour the contract shapes exactly: the §5.2 check order and
// error codes, the §2.7 seed ticket MAC and seed, the §2.6 evidence digests
// and v2 envelope hash, and a frozen §5.3 VerifiedRun. The "replay" is a toy
// function of the evidence so tests can choose scores and run lengths.
//
// They also follow the verify slice's hand-off (fable/pd-verify 437aa1f3):
// computeEvidenceDigest resolves { ok:true, … } or { ok:false, status:400,
// error:'invalid-evidence' } and never throws; reverifyStoredRun takes an
// optional { nowMs }; HMH plausibility flags are { id, severity, value, limit }
// objects; server/verify/hmh.mjs exports HMH_HERO_GATES and HMH_FREE_HEROES.
//
// Keys: Hardhat's public test mnemonic only (scripts/lib/local-chain.mjs).

import { createHash, createHmac, randomBytes as nodeRandomBytes, timingSafeEqual } from 'node:crypto';
import { ethers } from 'ethers';
import { canonicalSessionJson, createCanonicalSessionIdentity, sha256Hex } from '../../apps/portal/src/session-integrity.mjs';
import { LITVM_DEPLOYMENT } from '../../apps/portal/src/generated/litvm-addresses.mjs';
import { INDEX_GAMES } from '../../server/neon/rows.mjs';
import { activateLocalGames, deployLocalSuite, localContracts, localWalletKeys, startLocalChain } from '../../scripts/lib/local-chain.mjs';

export const SETTLE_SESSION_VALUE = `settle-fixture-${'a7'.repeat(16)}`;
export const SETTLE_CRON_VALUE = `cron-fixture-${'c3'.repeat(16)}`;
export const FIXTURE_NEON_URL = 'postgresql://fixture@db.invalid/settle';
export const RANKED_SETTLE_VERSION = 'lesters-ranked-settle-v1';
export const SEED_TICKET_VERSION = 'lesters-ranked-seed-v1';
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
const BUILD_HASH_PATTERNS = Object.freeze({
  'lester-blaster': /^site-\d+\.\d+\.\d+:game-\d+\.\d+\.\d+$/,
  chikun: /^site-\d+\.\d+\.\d+:game-\d+\.\d+\.\d+:cabinet-\d+\.\d+\.\d+$/,
  stacked: /^site-\d+\.\d+\.\d+:game-\d+\.\d+\.\d+:cabinet-\d+\.\d+\.\d+$/,
});
const ENCODINGS = Object.freeze({ 'lester-blaster': 'hmh-run-summary-v6+json', chikun: 'chikun-flap-evidence-v6+json', stacked: 'stacked-sic1+base64' });
const HANDLE = /^game-session-[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const IDENTITY_KEYS = ['buildHash', 'chainId', 'gameId', 'nonce', 'scoreRegistryAddress', 'seasonId', 'seed', 'sessionId', 'wallet'];
const MAX_SCORE = 10_000_000_000;

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

// --- Seed tickets (§2.7) -----------------------------------------------------

export async function deriveRankedSeedDouble({ sessionId, wallet, gameId, seasonId, buildHash, salt }) {
  const digest = await sha256Hex(canonicalSessionJson({ v: SEED_TICKET_VERSION, sessionId, wallet: String(wallet).toLowerCase(), gameId, seasonId, buildHash, salt }));
  return parseInt(digest.slice(2, 10), 16) >>> 0;
}

function ticketMac(secret, { sessionId, wallet, gameId, seasonId, buildHash, salt, issuedAt }) {
  return createHmac('sha256', secret).update(`${SEED_TICKET_VERSION}|${[sessionId, String(wallet).toLowerCase(), gameId, seasonId, buildHash, salt, issuedAt].join('|')}`).digest('hex');
}

// Same signature and result as server/verify/seed-ticket.mjs issueSeedTicket.
export async function issueSeedTicketDouble({ crypto, secret, nowMs, randomBytes, sessionId, wallet, gameId, seasonId, buildHash }) {
  const salt = Buffer.from((randomBytes ?? crypto?.randomBytes ?? nodeRandomBytes)(16)).toString('hex');
  const issuedAt = Math.floor(Number(nowMs) / 1000);
  const seedTicket = { v: SEED_TICKET_VERSION, salt, issuedAt, mac: ticketMac(secret, { sessionId, wallet, gameId, seasonId, buildHash, salt, issuedAt }) };
  return { seedTicket, seed: await deriveRankedSeedDouble({ sessionId, wallet, gameId, seasonId, buildHash, salt }) };
}

function checkTicket(ticket, secret, nowMs, fields) {
  if (!ticket || typeof ticket !== 'object' || ticket.v !== SEED_TICKET_VERSION || !/^[0-9a-f]{32}$/.test(String(ticket.salt)) || !Number.isSafeInteger(ticket.issuedAt) || !/^[0-9a-f]{64}$/.test(String(ticket.mac))) return false;
  if (ticket.issuedAt > Math.floor(nowMs / 1000) + 60) return false;
  const expected = Buffer.from(ticketMac(secret, { ...fields, salt: ticket.salt, issuedAt: ticket.issuedAt }));
  const given = Buffer.from(ticket.mac);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

// --- Evidence ----------------------------------------------------------------

// Chikun: survival = min(maxTicks, sum(flapDeltas) + 120) ticks; one fork per
// flap; score 100 per fork.
export function chikunEvidence({ seed, flaps = 12, gap = 90, maxTicks = 216_000 } = {}) {
  return { encoding: ENCODINGS.chikun, flap: { version: 'chikun-flap-evidence-v6', seed, fixedStepHz: 60, maxTicks, flapDeltas: Array.from({ length: flaps }, (_, index) => (index === 0 ? 30 : gap)) } };
}

// STACKED: one line per SIC1 byte, 60 ticks per line, score 100 per line.
export function stackedEvidence({ lines = 20 } = {}) {
  return { encoding: ENCODINGS.stacked, sic1: Buffer.alloc(lines, 0x5a).toString('base64'), startLevel: 1 };
}

// HMH: the summary carries its own score and length (plausibility-checked).
export function hmhEvidence({ seed, buildHash = FIXTURE_BUILD_HASHES['lester-blaster'], heroId = 'lit-commando', score = 4200, kills = 30, boss = 0, elapsedMs = 240_000, maxCombo = 12, xp = 4500, sessionKey = null } = {}) {
  return {
    encoding: ENCODINGS['lester-blaster'],
    runSummary: {
      schemaVersion: 6,
      identity: { heroId, seed, buildHash, mode: 'ranked' },
      totals: { score, elapsedMs, maxCombo, level: 5, xp },
      kills: { total: kills, boss },
      terminalReason: 'defeated',
    },
    sessionEnvelope: { version: 'lesters-session-envelope-v1', sessionKey },
  };
}

// A complete §5.1 body with a real seed ticket MAC and the ticket seed.
export async function buildSettleBody({
  gameId = 'chikun', wallet, registry, secret = SETTLE_SESSION_VALUE, nowMs, uuid = null, evidence = null,
  evidenceOptions = {}, entryTxHash = null, claim = undefined, ticketIssuedAtMs = null, buildHash = FIXTURE_BUILD_HASHES[gameId],
}) {
  const id = uuid ?? crypto.randomUUID();
  const sessionId = `game-session-${id}`;
  const seasonId = INDEX_GAMES[gameId].seasonId;
  const walletLower = String(wallet).toLowerCase();
  const { seedTicket, seed } = await issueSeedTicketDouble({ secret, nowMs: ticketIssuedAtMs ?? nowMs, sessionId, wallet: walletLower, gameId, seasonId, buildHash });
  const identity = { sessionId, chainId: 4441, scoreRegistryAddress: String(registry).toLowerCase(), wallet: walletLower, gameId, seasonId, buildHash, seed, nonce: id };
  const canonical = await createCanonicalSessionIdentity(identity);
  let bodyEvidence = evidence;
  if (!bodyEvidence) {
    if (gameId === 'chikun') bodyEvidence = chikunEvidence({ seed, ...evidenceOptions });
    else if (gameId === 'stacked') bodyEvidence = stackedEvidence(evidenceOptions);
    else bodyEvidence = hmhEvidence({ seed, buildHash, sessionKey: canonical.sessionKey, ...evidenceOptions });
  }
  const body = { v: RANKED_SETTLE_VERSION, gameId, sessionId32: canonical.sessionKey, identity, seedTicket, entryTxHash, evidence: bodyEvidence };
  if (claim !== undefined) body.claim = claim;
  return body;
}

// --- Verify double (§5.2, §5.3) ----------------------------------------------

const fail = (status, error, extra = {}) => ({ ok: false, status, error, ...extra });

async function evidenceRecord(gameId, evidence) {
  if (!evidence || typeof evidence !== 'object' || evidence.encoding !== ENCODINGS[gameId]) throw new TypeError('evidence encoding');
  if (gameId === 'chikun') {
    const flap = evidence.flap;
    if (!flap || !Array.isArray(flap.flapDeltas)) throw new TypeError('chikun evidence');
    const text = canonicalSessionJson(flap);
    return { encoding: evidence.encoding, text, bytes: Buffer.byteLength(text), digest: await sha256Hex(flap) };
  }
  if (gameId === 'stacked') {
    if (typeof evidence.sic1 !== 'string' || !evidence.sic1) throw new TypeError('stacked evidence');
    const bytes = Buffer.from(evidence.sic1, 'base64');
    if (bytes.toString('base64') !== evidence.sic1) throw new TypeError('stacked evidence is not canonical base64');
    return { encoding: evidence.encoding, text: evidence.sic1, bytes: Buffer.byteLength(evidence.sic1), digest: `0x${createHash('sha256').update(bytes).digest('hex')}` };
  }
  if (!evidence.runSummary || !evidence.sessionEnvelope) throw new TypeError('hmh evidence');
  const payload = { runSummary: evidence.runSummary, sessionEnvelope: evidence.sessionEnvelope };
  const text = canonicalSessionJson(payload);
  return { encoding: evidence.encoding, text, bytes: Buffer.byteLength(text), digest: await sha256Hex(payload) };
}

function evidenceFromStored(gameId, { encoding, text }) {
  if (gameId === 'chikun') return { encoding, flap: JSON.parse(text) };
  if (gameId === 'stacked') return { encoding, sic1: text, startLevel: 1 };
  const parsed = JSON.parse(text);
  return { encoding, runSummary: parsed.runSummary, sessionEnvelope: parsed.sessionEnvelope };
}

function toyReplay(gameId, evidence, identity) {
  if (gameId === 'chikun') {
    const { flap } = evidence;
    if (flap.version !== 'chikun-flap-evidence-v6') return fail(400, 'evidence-version-unsupported');
    if (flap.seed !== identity.seed) return fail(400, 'evidence-seed-mismatch');
    const forks = flap.flapDeltas.length;
    const ticks = Math.min(Number(flap.maxTicks), flap.flapDeltas.reduce((sum, delta) => sum + delta, 0) + 120);
    const bestCombo = Math.min(forks, 12);
    const stats = { score: forks * 100, survivalTicks: ticks, survivalSeconds: Number((ticks / 60).toFixed(3)), coinsCollected: forks, forksPassed: forks, nearMisses: 0, bestCombo, nearMissStreakBest: 0, flawlessRegions: 0, flapCount: forks, distanceMeters: forks * 10, regionIndexReached: 0, regionReached: 'coast', laps: 0, speedMultiplierReached: 1, terminalReason: 'crash', evidenceVersion: flap.version };
    return { score: stats.score, stats, contract: { kills: forks, maxCombo: Math.min(bestCombo, 10_000), survivalSeconds: Math.floor(ticks / 60), bossId: null } };
  }
  if (gameId === 'stacked') {
    if (evidence.startLevel !== 1) return fail(400, 'evidence-invalid');
    const lines = Buffer.from(evidence.sic1, 'base64').length;
    const ticks = lines * 60;
    const maxCombo = Math.min(lines, 5);
    const stats = { score: lines * 100, lines, level: 1 + Math.floor(lines / 10), quadClears: Math.floor(lines / 4), spins: 0, perfectClears: 0, maxCombo, maxBackToBack: 0, garbageRowsReceived: 0, garbageRowsCleared: 0, pieces: lines * 3, holdsUsed: 0, ticks, survivalSeconds: Number((ticks / 60).toFixed(3)), zone: 'zone-1', terminalReason: 'block-out', boardHash: '0x00' };
    return { score: stats.score, stats, contract: { kills: lines, maxCombo, survivalSeconds: Math.floor(ticks / 60), bossId: null } };
  }
  const summary = evidence.runSummary;
  if (typeof summary?.identity?.heroId !== 'string' || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(summary.identity.heroId)) return fail(400, 'run-summary-invalid');
  if (summary?.identity?.seed !== identity.seed || summary?.identity?.buildHash !== identity.buildHash || summary?.identity?.mode !== 'ranked') return fail(400, 'run-summary-identity-mismatch');
  if (summary.terminalReason !== 'defeated') return fail(400, 'run-summary-not-terminal');
  if (evidence.sessionEnvelope?.version !== 'lesters-session-envelope-v1' || evidence.sessionEnvelope?.sessionKey !== identity.sessionKey) return fail(400, 'session-envelope-invalid');
  const totals = summary.totals;
  // Plausibility in the verifier's shape: { verdict, flags: [{ id, severity, value, limit }] }.
  // XP above 1,000,000 is an impossibility (rejected); above 100,000 is a soft flag.
  const flags = [];
  if (totals.xp > 1_000_000) flags.push(Object.freeze({ id: 'xp-above-ceiling', severity: 'reject', value: totals.xp, limit: 1_000_000 }));
  if (totals.xp > 100_000) flags.push(Object.freeze({ id: 'xp-near-ceiling', severity: 'flag', value: totals.xp, limit: 100_000 }));
  const verdict = flags.some((flag) => flag.severity === 'reject') ? 'rejected' : flags.length ? 'flagged' : 'ok';
  if (verdict === 'rejected') return fail(422, 'implausible-run', { flags: Object.freeze(flags) });
  const stats = { score: totals.score, kills: summary.kills.total, bossKills: summary.kills.boss, eliteKills: 0, maxCombo: totals.maxCombo, level: totals.level, xp: totals.xp, survivalTicks: Math.floor(totals.elapsedMs * 0.06), elapsedMs: totals.elapsedMs, survivalSeconds: Number((totals.elapsedMs / 1000).toFixed(3)), heroId: summary.identity.heroId, noDamage: 0, terminalReason: summary.terminalReason };
  return {
    score: totals.score,
    stats,
    contract: { kills: Math.min(summary.kills.total, 100_000), maxCombo: Math.min(totals.maxCombo, 10_000), survivalSeconds: Math.min(Math.floor(totals.elapsedMs / 1000), 86_400), bossId: summary.kills.boss > 0 ? 'boss-liquidator' : null },
    plausibility: { verdict, flags },
  };
}

async function verifiedRunFor({ gameId, identity, evidence, nowMs }) {
  const replay = toyReplay(gameId, evidence, identity);
  if (replay.ok === false) return replay;
  if (replay.score > MAX_SCORE) return fail(422, 'score-out-of-bounds');
  const record = await evidenceRecord(gameId, evidence);
  const envelopeHash = await sha256Hex({ version: 'lesters-ranked-envelope-v2', gameId, sessionKey: identity.sessionKey, encoding: record.encoding, evidenceDigest: record.digest });
  const run = {
    ok: true,
    gameId,
    sessionId32: identity.sessionKey,
    sessionHandle: identity.sessionId,
    wallet: identity.wallet,
    seasonId: identity.seasonId,
    runtimeId: INDEX_GAMES[gameId].runtimeId,
    buildHash: identity.buildHash,
    seed: identity.seed,
    score: replay.score,
    contract: Object.freeze({ ...replay.contract }),
    stats: Object.freeze({ ...replay.stats }),
    evidence: Object.freeze(record),
    envelopeHash,
    identity,
    verifiedAt: new Date(nowMs).toISOString(),
  };
  if (replay.plausibility) run.plausibility = replay.plausibility;
  return Object.freeze(run);
}

// { bindRankedIdentity, verifyRankedRun, computeEvidenceDigest, reverifyStoredRun, calls }
export function createVerifyDouble({ nowMs = () => Date.now() } = {}) {
  const calls = { bindRankedIdentity: 0, verifyRankedRun: 0, computeEvidenceDigest: 0, reverifyStoredRun: 0, reverifyNowMs: [] };
  const clock = () => (typeof nowMs === 'function' ? nowMs() : Number(nowMs));

  async function bindRankedIdentity(body, { chainId, scoreRegistryAddress, wallet, nowMs: now, seedSecret }) {
    calls.bindRankedIdentity += 1;
    const identity = body?.identity;
    if (!identity || typeof identity !== 'object' || Array.isArray(identity) || Object.keys(identity).sort().join(',') !== IDENTITY_KEYS.join(',')) return fail(400, 'identity-invalid');
    if (!Object.hasOwn(INDEX_GAMES, identity.gameId)) return fail(400, 'identity-game-unknown');
    if (identity.gameId !== body.gameId) return fail(400, 'identity-invalid');
    if (identity.chainId !== chainId) return fail(400, 'identity-chain-mismatch');
    if (String(identity.scoreRegistryAddress).toLowerCase() !== String(scoreRegistryAddress).toLowerCase()) return fail(400, 'identity-registry-mismatch');
    if (String(identity.wallet).toLowerCase() !== String(wallet).toLowerCase()) return fail(400, 'identity-wallet-mismatch');
    if (identity.seasonId !== INDEX_GAMES[identity.gameId].seasonId) return fail(400, 'identity-season-mismatch');
    if (!BUILD_HASH_PATTERNS[identity.gameId].test(String(identity.buildHash))) return fail(400, 'identity-buildhash-invalid');
    if (!HANDLE.test(String(identity.sessionId))) return fail(400, 'identity-session-invalid');
    if (identity.nonce !== identity.sessionId.slice('game-session-'.length)) return fail(400, 'identity-nonce-mismatch');
    const fields = { sessionId: identity.sessionId, wallet: String(identity.wallet).toLowerCase(), gameId: identity.gameId, seasonId: identity.seasonId, buildHash: identity.buildHash };
    if (!checkTicket(body.seedTicket, seedSecret, now, fields)) return fail(400, 'seed-ticket-invalid');
    if (identity.seed !== await deriveRankedSeedDouble({ ...fields, salt: body.seedTicket.salt })) return fail(400, 'identity-seed-mismatch');
    const canonical = await createCanonicalSessionIdentity(identity);
    if (canonical.sessionKey !== body.sessionId32) return fail(400, 'session-key-mismatch');
    return { ok: true, gameId: identity.gameId, identity: canonical };
  }

  async function verifyRankedRun(body, options) {
    calls.verifyRankedRun += 1;
    const bound = options.bound ?? await bindRankedIdentity(body, options);
    if (!bound.ok) return bound;
    return verifiedRunFor({ gameId: bound.gameId, identity: bound.identity, evidence: body.evidence, nowMs: options.nowMs ?? clock() });
  }

  // { ok:true, encoding, text, bytes, digest } | { ok:false, status:400, error:'invalid-evidence' }; never throws.
  async function computeEvidenceDigest(body) {
    calls.computeEvidenceDigest += 1;
    try {
      return Object.freeze({ ok: true, ...(await evidenceRecord(body?.gameId, body?.evidence)) });
    } catch {
      return fail(400, 'invalid-evidence');
    }
  }

  async function reverifyStoredRun({ gameId, identity, evidence }, { nowMs: now } = {}) {
    calls.reverifyStoredRun += 1;
    calls.reverifyNowMs.push(now ?? null);
    return verifiedRunFor({ gameId, identity, evidence: evidenceFromStored(gameId, evidence), nowMs: now ?? clock() });
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
