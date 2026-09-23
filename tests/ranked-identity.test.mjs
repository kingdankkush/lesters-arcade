import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { ethers } from 'ethers';
import {
  RANKED_CHAIN_ID,
  RANKED_ENVELOPE_VERSION,
  RANKED_GAMES,
  RANKED_GAME_IDS,
  RANKED_IDENTITY_KEYS,
  RANKED_SETTLE_VERSION,
  applySeedTicket,
  evidenceDigestFor,
  rankedEnvelopeHash,
  rankedIdentityFor,
  rankedSessionKey,
  sessionId32ForShareId,
  sha256BytesHex,
  shareIdFor,
  validateRankedIdentity,
} from '../apps/portal/src/ranked-identity.mjs';
import { CURRENT_RANKED_SEASON_ID, canonicalSessionJson, createCanonicalSessionIdentity, sha256Hex } from '../apps/portal/src/session-integrity.mjs';
import { getPlaySessionIdentity, startPlaySession } from '../apps/portal/src/arcade-core.mjs';
import { CHIKUN_RUNTIME_VERSION } from '../apps/portal/src/chikun-cabinet.mjs';
import { INDEX_GAMES } from '../server/neon/rows.mjs';

const REGISTRY = '0xc5c5949a02fAC9a4115df182672C0f8cEB0Eaf55';
const WALLET = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
const UUID = '11111111-1111-4111-8111-111111111111';
const TICKET = Object.freeze({ v: 'lesters-ranked-seed-v1', salt: '00112233445566778899aabbccddeeff', issuedAt: 1_790_000_000, mac: 'ab'.repeat(32) });

// The §2.1 and §2.2 tables, verbatim.
const ON_CHAIN_IDS = Object.freeze({
  'lester-blaster': ['0x545dd61662e9dc794369142dd2768078f04eb05c60daec6fe35ec6b9f854205e', '0x0d51bf17a0c812235cd14152862053cdf66fb19a7fc64fd41dae9fa18cf72947', '0x7a49b1ef4a70d8a4f787edc9cf0777f9eeae2c08d8c4d0b63c0a123600b4a2e0'],
  chikun: ['0xe293f354d567ca05ed272162a4f9056216cf9f40e9fe59bbf8b6227c0ce4f385', '0xdec4900d7408bc67cb59219f09a8afed684ab088cf7633784e5f97d6cda50e51', '0x22ee05d74f52b967d5644200912b19d1834d60274eeedc9c692f2e83fcfbd411'],
  stacked: ['0xf59739dcdad762dcc1b5c107223be71d49deb6bb5c775307196190123630d7f5', '0xc0ea09f7acabf8c293b44bb21d4ddd53036bc6886649dbe65b2afb6b17277db5', '0x34b1f2f810dadc00f74f2fc706011f6f5e06c3a70850ee288227a914f995f60e'],
});

function paidSession(gameId) {
  return startPlaySession({ wallet: WALLET, gameId, mode: 'paid', sessionNonce: UUID });
}

test('ranked games table matches session identities and on-chain ids', () => {
  assert.deepEqual(RANKED_GAME_IDS, ['lester-blaster', 'chikun', 'stacked']);
  assert.equal(RANKED_SETTLE_VERSION, 'lesters-ranked-settle-v1');
  assert.equal(RANKED_ENVELOPE_VERSION, 'lesters-ranked-envelope-v2');
  assert.equal(RANKED_CHAIN_ID, 4441);
  for (const gameId of RANKED_GAME_IDS) {
    const game = RANKED_GAMES[gameId];
    assert.equal(game.gameId, gameId);
    assert.equal(Object.isFrozen(game), true);
    assert.equal(game.seasonId, getPlaySessionIdentity(gameId).seasonId, `${gameId} season is the play-session season`);
    assert.equal(game.buildHashPattern.test(getPlaySessionIdentity(gameId).buildHash), true, `${gameId} accepts the live buildHash format`);
    const [gameId32, seasonId32, runtimeId32] = ON_CHAIN_IDS[gameId];
    assert.equal(ethers.id(gameId), gameId32);
    assert.equal(ethers.id(game.seasonId), seasonId32);
    assert.equal(ethers.id(game.runtimeId), runtimeId32);
    // The index slice's mirror table must agree field by field.
    for (const key of ['slug', 'title', 'seasonId', 'runtimeId']) assert.equal(INDEX_GAMES[gameId][key], game[key], `${gameId}.${key} matches server/neon/rows.mjs`);
    assert.deepEqual([INDEX_GAMES[gameId].gameId32, INDEX_GAMES[gameId].seasonId32, INDEX_GAMES[gameId].runtimeId32], ON_CHAIN_IDS[gameId]);
  }
  assert.equal(RANKED_GAMES.chikun.runtimeId, `chikun:${CHIKUN_RUNTIME_VERSION}`);
  assert.equal(RANKED_GAMES.chikun.runtimeId, 'chikun:canvas-runtime-v7');
  assert.equal(ethers.id('boss-liquidator'), '0x81b9332af0bfe9f6c1d9221d44a8ee1c46ba5c60c4e4f7cc4e7e4b61d7991cb8');
  assert.deepEqual(Object.fromEntries(RANKED_GAME_IDS.map((g) => [g, RANKED_GAMES[g].evidenceEncoding])), {
    'lester-blaster': 'hmh-run-summary-v6+json', chikun: 'chikun-flap-evidence-v6+json', stacked: 'stacked-sic1+base64',
  });
  // A11: HMH has no cabinet part; the cabinet games require one.
  assert.equal(RANKED_GAMES['lester-blaster'].buildHashPattern.test('site-1.7.0:game-1.7.0:cabinet-0.9.0'), false);
  assert.equal(RANKED_GAMES.chikun.buildHashPattern.test('site-1.7.0:game-1.7.0'), false);
  assert.equal(RANKED_GAMES.stacked.buildHashPattern.test('site-1.7:game-1.7.0:cabinet-0.2.0'), false);
});

test('rankedIdentityFor uses the per-game season and the session nonce', () => {
  for (const gameId of RANKED_GAME_IDS) {
    const session = paidSession(gameId);
    const identity = rankedIdentityFor(session, { scoreRegistryAddress: REGISTRY });
    assert.deepEqual(Object.keys(identity), RANKED_IDENTITY_KEYS);
    assert.equal(identity.seasonId, session.seasonId);
    assert.equal(identity.seasonId, RANKED_GAMES[gameId].seasonId);
    if (gameId !== 'lester-blaster') assert.notEqual(identity.seasonId, CURRENT_RANKED_SEASON_ID, 'never the HMH season for another game');
    assert.equal(identity.nonce, session.sessionNonce);
    assert.equal(identity.nonce, UUID);
    assert.equal(identity.sessionId, `game-session-${UUID}`);
    assert.equal(identity.seed, session.seed);
    assert.equal(identity.chainId, 4441);
    assert.equal(identity.scoreRegistryAddress, REGISTRY.toLowerCase());
    assert.equal(identity.wallet, WALLET.toLowerCase());
    assert.equal(identity.buildHash, session.buildHash);
    assert.equal(Object.isFrozen(identity), true);
    assert.deepEqual(validateRankedIdentity(identity, { scoreRegistryAddress: REGISTRY, wallet: WALLET, gameId }), { ok: true, identity });
  }
  assert.equal(rankedIdentityFor(paidSession('chikun'), { chainId: 31337, scoreRegistryAddress: REGISTRY }).chainId, 31337);
  assert.throws(() => rankedIdentityFor(paidSession('chikun'), {}), /scoreRegistryAddress/);
  assert.throws(() => rankedIdentityFor({ ...paidSession('chikun'), seed: -1 }, { scoreRegistryAddress: REGISTRY }), /seed/);
  assert.throws(() => rankedIdentityFor({ ...paidSession('chikun'), sessionNonce: null }, { scoreRegistryAddress: REGISTRY }), /sessionNonce/);
});

test('applySeedTicket replaces the seed everywhere the key reads it', async () => {
  const session = paidSession('stacked');
  const fnvKey = await rankedSessionKey(rankedIdentityFor(session, { scoreRegistryAddress: REGISTRY }));
  const previousContext = session.canonicalContext;
  const ticketSeed = (session.seed + 12345) >>> 0;
  assert.equal(applySeedTicket(session, { seed: ticketSeed, seedTicket: { ...TICKET } }), session);
  assert.equal(session.seed, ticketSeed);
  assert.equal(session.canonicalContext.seed, ticketSeed);
  assert.notEqual(session.canonicalContext, previousContext, 'a new context object');
  assert.equal(Object.isFrozen(session.canonicalContext), true);
  assert.equal(previousContext.seed !== ticketSeed, true, 'the old frozen context is untouched');
  assert.deepEqual(session.seedTicket, TICKET);
  assert.equal(Object.isFrozen(session.seedTicket), true);
  const identity = rankedIdentityFor(session, { scoreRegistryAddress: REGISTRY });
  assert.equal(identity.seed, ticketSeed);
  const ticketKey = await rankedSessionKey(identity);
  assert.notEqual(ticketKey, fnvKey);
  assert.equal(ticketKey, (await createCanonicalSessionIdentity({ ...identity, seed: ticketSeed })).sessionKey);
  for (const bad of [
    { seed: -1, seedTicket: TICKET }, { seed: 1.5, seedTicket: TICKET }, { seed: 2 ** 32, seedTicket: TICKET },
    { seed: 1, seedTicket: { ...TICKET, v: 'v0' } }, { seed: 1, seedTicket: { ...TICKET, salt: 'xyz' } },
    { seed: 1, seedTicket: { ...TICKET, mac: 'AB'.repeat(32) } }, { seed: 1, seedTicket: { ...TICKET, issuedAt: '1' } }, { seed: 1 },
  ]) {
    assert.throws(() => applySeedTicket(paidSession('stacked'), bad), TypeError);
  }
});

test('session key is the canonical sha256 preimage', async () => {
  const identity = rankedIdentityFor(paidSession('chikun'), { scoreRegistryAddress: REGISTRY });
  const expected = `0x${createHash('sha256').update(canonicalSessionJson({ version: 'lesters-canonical-session-v1', ...identity })).digest('hex')}`;
  assert.equal(await rankedSessionKey(identity), expected);
  assert.equal(await rankedSessionKey(identity), (await createCanonicalSessionIdentity(identity)).sessionKey);
  // The canonical identity (with version and sessionKey) keys to itself.
  const canonical = await createCanonicalSessionIdentity(identity);
  assert.equal(await rankedSessionKey(canonical), canonical.sessionKey);
  // Every field is bound.
  for (const [field, value] of [['seed', identity.seed ^ 1], ['chainId', 1], ['seasonId', 'x'], ['buildHash', 'y'], ['wallet', `0x${'3'.repeat(40)}`], ['scoreRegistryAddress', `0x${'4'.repeat(40)}`]]) {
    assert.notEqual(await rankedSessionKey({ ...identity, [field]: value }), expected, field);
  }
});

test('share ids round-trip and reject 0x-less garbage', () => {
  const sessionId32 = `0x${'a1'.repeat(32)}`;
  const shareId = shareIdFor(sessionId32);
  assert.equal(shareId, 'a1'.repeat(32));
  assert.equal(sessionId32ForShareId(shareId), sessionId32);
  assert.equal(sessionId32ForShareId(`0x${shareId}`), sessionId32, 'either form is accepted');
  assert.equal(sessionId32ForShareId(shareId.toUpperCase()), sessionId32, 'normalized to lowercase');
  assert.equal(shareIdFor(sessionId32.toUpperCase().replace('0X', '0x')), shareId);
  assert.doesNotMatch(shareId, /0x|session-/i);
  for (const garbage of ['a1'.repeat(32), `0x${'a1'.repeat(31)}`, `0x${'g1'.repeat(32)}`, `session-${'a'.repeat(56)}`, null, 12]) {
    assert.throws(() => shareIdFor(garbage), TypeError);
  }
  for (const garbage of ['a1'.repeat(31), `${'a1'.repeat(32)}0`, 'zz'.repeat(32), `0x0x${'a'.repeat(62)}`, '', null, undefined, 7]) {
    assert.equal(sessionId32ForShareId(garbage), null);
  }
});

test('v2 envelope hash commits to game, session, encoding and digest', async () => {
  const input = { gameId: 'chikun', sessionId32: `0x${'1'.repeat(64)}`, encoding: 'chikun-flap-evidence-v6+json', evidenceDigest: `0x${'2'.repeat(64)}` };
  const hash = await rankedEnvelopeHash(input);
  const preimage = JSON.stringify({ encoding: input.encoding, evidenceDigest: input.evidenceDigest, gameId: 'chikun', sessionKey: input.sessionId32, version: 'lesters-ranked-envelope-v2' });
  assert.equal(hash, `0x${createHash('sha256').update(preimage).digest('hex')}`);
  assert.notEqual(await rankedEnvelopeHash({ ...input, sessionId32: `0x${'3'.repeat(64)}` }), hash);
  assert.notEqual(await rankedEnvelopeHash({ ...input, evidenceDigest: `0x${'4'.repeat(64)}` }), hash);
  assert.notEqual(await rankedEnvelopeHash({ gameId: 'stacked', sessionId32: input.sessionId32, encoding: 'stacked-sic1+base64', evidenceDigest: input.evidenceDigest }), hash);
  await assert.rejects(rankedEnvelopeHash({ ...input, encoding: 'stacked-sic1+base64' }), /encoding/);
  await assert.rejects(rankedEnvelopeHash({ ...input, gameId: 'pong' }), /gameId/);
  await assert.rejects(rankedEnvelopeHash({ ...input, sessionId32: `0x${'A'.repeat(64)}` }), /sessionId32/);
  await assert.rejects(rankedEnvelopeHash({ ...input, evidenceDigest: '0x12' }), /evidenceDigest/);
});

test('sha256BytesHex matches node:crypto', async () => {
  for (const bytes of [new Uint8Array(0), Uint8Array.from([0, 1, 2, 255]), new TextEncoder().encode('SIC1 fixture'), new Uint8Array(70_000).fill(7)]) {
    assert.equal(await sha256BytesHex(bytes), `0x${createHash('sha256').update(bytes).digest('hex')}`);
  }
  await assert.rejects(sha256BytesHex('text'), TypeError);
  await assert.rejects(sha256BytesHex([1, 2]), TypeError);
});

test('evidence digests follow §2.6 for every game, bare or wrapped', async () => {
  const flap = { version: 'chikun-flap-evidence-v6', seed: 5, fixedStepHz: 60, maxTicks: 216000, flapDeltas: [3, 11, 6] };
  const flapDigest = await evidenceDigestFor('chikun', flap);
  assert.equal(flapDigest, await sha256Hex(canonicalSessionJson(flap)));
  assert.equal(await evidenceDigestFor('chikun', { encoding: 'chikun-flap-evidence-v6+json', flap }), flapDigest);
  const bytes = Uint8Array.from([0x53, 0x49, 0x43, 0x31, 1, 1, 0, 60]);
  const sic1 = Buffer.from(bytes).toString('base64');
  assert.equal(await evidenceDigestFor('stacked', bytes), `0x${createHash('sha256').update(bytes).digest('hex')}`);
  assert.equal(await evidenceDigestFor('stacked', { encoding: 'stacked-sic1+base64', sic1, startLevel: 1 }), await evidenceDigestFor('stacked', bytes));
  await assert.rejects(evidenceDigestFor('stacked', { encoding: 'stacked-sic1+base64', sic1: sic1.replace(/=+$/, ''), startLevel: 1 }), /base64/);
  const hmh = { runSummary: { schemaVersion: 6 }, sessionEnvelope: { version: 'lesters-session-envelope-v1' } };
  const hmhDigest = await evidenceDigestFor('lester-blaster', hmh);
  assert.equal(hmhDigest, await sha256Hex(canonicalSessionJson(hmh)));
  assert.equal(await evidenceDigestFor('lester-blaster', { encoding: 'hmh-run-summary-v6+json', ...hmh }), hmhDigest);
  await assert.rejects(evidenceDigestFor('lester-blaster', { runSummary: {} }), /sessionEnvelope/);
  await assert.rejects(evidenceDigestFor('pong', flap), /gameId/);
});

test('ranked-identity is pure and imports only session-integrity and session-seed', () => {
  const source = readFileSync(new URL('../apps/portal/src/ranked-identity.mjs', import.meta.url), 'utf8');
  const imports = [...source.matchAll(/^import .* from '([^']+)';$/gm)].map((match) => match[1]);
  assert.deepEqual(imports, ['./session-integrity.mjs', './session-seed.mjs']);
  assert.doesNotMatch(source, /\b(?:document|window|process|localStorage|Date\.now|Math\.random)\b/);
});
