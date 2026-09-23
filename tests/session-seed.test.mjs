import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { deriveRankedSeed, deriveSessionSeed, RANKED_SEED_VERSION } from '../apps/portal/src/session-seed.mjs';
import * as arcadeCore from '../apps/portal/src/arcade-core.mjs';

const FIXTURE = Object.freeze({
  sessionId: 'game-session-11111111-1111-4111-8111-111111111111',
  wallet: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
  gameId: 'chikun',
  seasonId: 'chikun-season-preview-1',
  buildHash: 'site-1.7.0:game-1.7.0:cabinet-0.9.0',
  salt: '00112233445566778899aabbccddeeff',
});

test('the FNV session seed keeps its pinned value after the move', () => {
  assert.equal(deriveSessionSeed({ sessionId: 'la-000001', gameId: 'chikun', seasonId: 'chikun-season-preview-1', buildHash: 'site-1.7.0:game-1.7.0:cabinet-0.8.0' }), 561861267);
  assert.equal(arcadeCore.deriveSessionSeed, deriveSessionSeed, 'arcade-core re-exports the session-seed function itself');
  assert.throws(() => deriveSessionSeed({ sessionId: 'x', gameId: 'chikun', seasonId: '' , buildHash: 'b' }), /required/);
});

test('arcade-core imports and re-exports the seed so startPlaySession keeps a local binding', () => {
  const source = readFileSync(new URL('../apps/portal/src/arcade-core.mjs', import.meta.url), 'utf8');
  assert.match(source, /^import \{ deriveSessionSeed \} from '\.\/session-seed\.mjs';\nexport \{ deriveSessionSeed \};$/m);
  assert.doesNotMatch(source, /export function deriveSessionSeed/);
  assert.doesNotMatch(source, /export \{ deriveSessionSeed \} from/);
});

test('startPlaySession still returns an integer FNV seed bound into the canonical context', () => {
  const session = arcadeCore.startPlaySession({ wallet: `0x${'7'.repeat(40)}`, gameId: 'chikun', mode: 'paid', sessionNonce: '123e4567-e89b-42d3-a456-426614174000' });
  assert.equal(Number.isInteger(session.seed), true);
  assert.equal(session.seed >= 0 && session.seed <= 0xffffffff, true);
  assert.equal(session.seed, deriveSessionSeed(session.canonicalContext));
  const free = arcadeCore.startPlaySession({ wallet: `0x${'7'.repeat(40)}`, gameId: 'stacked', mode: 'free', sessionNonce: 'abc' });
  assert.equal(free.seed, deriveSessionSeed(free.canonicalContext));
});

test('deriveRankedSeed pins its fixture value and matches a node:crypto recomputation', async () => {
  assert.equal(await deriveRankedSeed(FIXTURE), 2609191911);
  const preimage = JSON.stringify({ buildHash: FIXTURE.buildHash, gameId: FIXTURE.gameId, salt: FIXTURE.salt, seasonId: FIXTURE.seasonId, sessionId: FIXTURE.sessionId, v: RANKED_SEED_VERSION, wallet: FIXTURE.wallet });
  const expected = parseInt(createHash('sha256').update(preimage).digest('hex').slice(0, 8), 16) >>> 0;
  assert.equal(await deriveRankedSeed(FIXTURE), expected);
});

test('deriveRankedSeed lowercases the wallet and binds every field', async () => {
  const base = await deriveRankedSeed(FIXTURE);
  assert.equal(await deriveRankedSeed({ ...FIXTURE, wallet: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' }), base);
  for (const [field, value] of [['sessionId', 'game-session-11111111-1111-4111-8111-111111111112'], ['gameId', 'stacked'], ['seasonId', 'stacked-season-preview-1'], ['buildHash', 'site-1.7.0:game-1.7.0:cabinet-0.9.1'], ['salt', 'ffeeddccbbaa99887766554433221100'], ['wallet', `0x${'1'.repeat(40)}`]]) {
    assert.notEqual(await deriveRankedSeed({ ...FIXTURE, [field]: value }), base, `${field} changes the seed`);
  }
});

test('deriveRankedSeed refuses malformed salts and missing fields', async () => {
  await assert.rejects(deriveRankedSeed({ ...FIXTURE, salt: 'ABCDEF00112233445566778899AABBCC' }), /salt/);
  await assert.rejects(deriveRankedSeed({ ...FIXTURE, salt: '0011' }), /salt/);
  await assert.rejects(deriveRankedSeed({ ...FIXTURE, wallet: undefined }), /wallet/);
  await assert.rejects(deriveRankedSeed({ ...FIXTURE, sessionId: '' }), /sessionId/);
});

test('session-seed imports only session-integrity', () => {
  const source = readFileSync(new URL('../apps/portal/src/session-seed.mjs', import.meta.url), 'utf8');
  const imports = [...source.matchAll(/^import .* from '([^']+)';$/gm)].map((match) => match[1]);
  assert.deepEqual(imports, ['./session-integrity.mjs']);
  assert.doesNotMatch(source, /\b(?:document|window|process|Date\.now|Math\.random)\b/);
});
