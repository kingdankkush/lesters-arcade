import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as nodeCrypto from 'node:crypto';
import { checkSeedTicket, isSeedTicketShape, issueSeedTicket, seedTicketMacInput, SEED_TICKET_VERSION } from '../server/verify/seed-ticket.mjs';
import { deriveRankedSeed } from '../apps/portal/src/session-seed.mjs';

// Fixture key material (tests only, never a deployed value).
const KEY = ['fixture', 'seed-ticket', 'key', 'for', 'tests', 'only', '0001'].join('-');
const NOW = 1_790_000_000_000;
const BINDING = Object.freeze({
  sessionId: 'game-session-11111111-1111-4111-8111-111111111111',
  wallet: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
  gameId: 'chikun',
  seasonId: 'chikun-season-preview-1',
  buildHash: 'site-1.7.0:game-1.7.0:cabinet-0.9.0',
});
const fixedBytes = () => Uint8Array.from({ length: 16 }, (_, index) => index * 17);

async function issue(overrides = {}) {
  return issueSeedTicket({ crypto: nodeCrypto, secret: KEY, nowMs: NOW, randomBytes: fixedBytes, ...BINDING, ...overrides });
}
function check(seedTicket, overrides = {}) {
  return checkSeedTicket(seedTicket, { crypto: nodeCrypto, secret: KEY, nowMs: NOW, ...BINDING, ...overrides });
}

test('a ticket verifies for its own session and wallet only', async () => {
  const { seedTicket } = await issue();
  assert.deepEqual(check(seedTicket), { ok: true, error: null });
  // The wallet is compared lowercase.
  assert.equal(check(seedTicket, { wallet: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' }).ok, true);
  for (const [field, value] of [
    ['wallet', `0x${'2'.repeat(40)}`],
    ['sessionId', 'game-session-11111111-1111-4111-8111-111111111112'],
    ['gameId', 'stacked'],
    ['seasonId', 'stacked-season-preview-1'],
    ['buildHash', 'site-1.7.0:game-1.7.0:cabinet-0.9.1'],
  ]) {
    assert.deepEqual(check(seedTicket, { [field]: value }), { ok: false, error: 'seed-ticket-invalid', detail: 'mac' }, field);
  }
  assert.equal(check(seedTicket, { secret: `${KEY}-rotated` }).ok, false, 'another environment secret never verifies');
});

test('tampered salt, time or MAC is rejected', async () => {
  const { seedTicket } = await issue();
  const flipLast = (hex) => `${hex.slice(0, -1)}${hex.at(-1) === '0' ? '1' : '0'}`;
  assert.equal(check({ ...seedTicket, salt: flipLast(seedTicket.salt) }).detail, 'mac');
  assert.equal(check({ ...seedTicket, issuedAt: seedTicket.issuedAt - 1 }).detail, 'mac');
  assert.equal(check({ ...seedTicket, mac: flipLast(seedTicket.mac) }).detail, 'mac');
  for (const shape of [
    null, 'ticket', [], { ...seedTicket, extra: 1 }, { ...seedTicket, v: 'lesters-ranked-seed-v2' },
    { ...seedTicket, salt: seedTicket.salt.toUpperCase() }, { ...seedTicket, salt: seedTicket.salt.slice(2) },
    { ...seedTicket, mac: seedTicket.mac.toUpperCase() }, { ...seedTicket, mac: seedTicket.mac.slice(2) },
    { ...seedTicket, issuedAt: String(seedTicket.issuedAt) }, { ...seedTicket, issuedAt: 1.5 }, { ...seedTicket, issuedAt: -1 },
    { v: seedTicket.v, salt: seedTicket.salt, mac: seedTicket.mac },
  ]) {
    assert.deepEqual(check(shape), { ok: false, error: 'seed-ticket-invalid', detail: 'shape' });
    assert.equal(isSeedTicketShape(shape), false);
  }
});

test('future-dated tickets are rejected', async () => {
  const { seedTicket } = await issue({ nowMs: NOW + 61_000 });
  assert.equal(check(seedTicket).detail, 'future', 'issued more than 60 s after now');
  const edge = await issue({ nowMs: NOW + 60_000 });
  assert.equal(check(edge.seedTicket).ok, true, 'exactly 60 s of skew is tolerated');
  const old = await issue({ nowMs: NOW - 7 * 24 * 3600 * 1000 });
  assert.equal(check(old.seedTicket).ok, true, 'staleness is the chain-time check of A26, not the MAC check');
});

test('the ticket seed matches deriveRankedSeed', async () => {
  const { seedTicket, seed } = await issue();
  assert.equal(seed, await deriveRankedSeed({ ...BINDING, salt: seedTicket.salt }));
  assert.equal(Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff, true);
  assert.equal(seedTicket.salt, '00112233445566778899aabbccddeeff');
  assert.equal(seedTicket.issuedAt, NOW / 1000);
  assert.equal(seedTicket.v, SEED_TICKET_VERSION);
  assert.equal(Object.isFrozen(seedTicket), true);
});

test('the MAC is HMAC-SHA256 over the exact pipe-joined string', async () => {
  const { seedTicket } = await issue({ wallet: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' });
  const input = `lesters-ranked-seed-v1|${BINDING.sessionId}|${BINDING.wallet}|chikun|chikun-season-preview-1|${BINDING.buildHash}|${seedTicket.salt}|${seedTicket.issuedAt}`;
  assert.equal(seedTicketMacInput({ ...BINDING, salt: seedTicket.salt, issuedAt: seedTicket.issuedAt }), input);
  assert.equal(seedTicket.mac, nodeCrypto.createHmac('sha256', KEY).update(input).digest('hex'));
});

test('secrets are injected, compared in constant time and never short', async () => {
  const calls = [];
  const spyCrypto = { ...nodeCrypto, createHmac: nodeCrypto.createHmac, timingSafeEqual: (a, b) => { calls.push([a.length, b.length]); return nodeCrypto.timingSafeEqual(a, b); } };
  const { seedTicket } = await issue({ secret: () => KEY });
  assert.equal(checkSeedTicket(seedTicket, { crypto: spyCrypto, secret: () => KEY, nowMs: NOW, ...BINDING }).ok, true);
  assert.deepEqual(calls, [[32, 32]]);
  await assert.rejects(issue({ secret: 'short' }), /at least 32/);
  await assert.rejects(issue({ secret: undefined }), /at least 32/);
  assert.throws(() => check(seedTicket, { secret: '' }), /at least 32/);
  // Default randomness: two tickets for one session get different salts and seeds (almost surely).
  const a = await issueSeedTicket({ secret: KEY, nowMs: NOW, ...BINDING });
  const b = await issueSeedTicket({ secret: KEY, nowMs: NOW, ...BINDING });
  assert.notEqual(a.seedTicket.salt, b.seedTicket.salt);
  await assert.rejects(issue({ randomBytes: () => new Uint8Array(8) }), /16 bytes/);
  await assert.rejects(issue({ sessionId: 'game-session|x' }), /without '\|'/);
});
