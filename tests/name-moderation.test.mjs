import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { IMPERSONATION_TERMS, moderateName } from '../apps/portal/src/name-moderation.mjs';

/**
 * Contract §7.8 and A29: one moderation function for the browser and the
 * server. Anyone can call PlayerProfileRegistry.setProfile directly, so the
 * server re-runs this on every mirrored name.
 */

test('blocks profanity and impersonation after look-alike folding', () => {
  for (const name of ['shit head', 'Sh1t Head', 'f.u.c.k', 'n1gg3r', 'Big Dick']) {
    assert.deepEqual(moderateName(name), { ok: false, reason: 'profanity' }, name);
  }
  for (const name of ['Lester', 'L3ST3R', 'Lesters Arcade', 'lestersarcade', 'Admin', '4dm1n', 'Off1cial', '0ff1c1al', 'The Moderator', 'Support_Desk', '5upp0rt', 'LitVM Team', 'l1tvm', 'Dappit', 'd@pp1t', '$upport', 'a.d.m.i.n', 'L-E-S-T-E-R']) {
    assert.deepEqual(moderateName(name), { ok: false, reason: 'impersonation' }, name);
  }
  assert.deepEqual([...IMPERSONATION_TERMS], ['lester', 'lesters', 'lestersarcade', 'admin', 'official', 'moderator', 'support', 'litvm', 'dappit']);
});

test('allows normal names', () => {
  for (const name of ['Lit Pilot', 'Chikun King', 'Satoshi_99', 'Ace.Pilot', 'hodl-hero', 'Pixel Queen', 'LTC Whale', 'Block 7']) {
    assert.deepEqual(moderateName(name), { ok: true, reason: null }, name);
  }
  assert.deepEqual(moderateName(''), { ok: true, reason: null }, 'an empty name has nothing to block; charset rules live elsewhere');
});

test('name moderation stays pure and imports only the username registry', () => {
  const source = readFileSync(new URL('../apps/portal/src/name-moderation.mjs', import.meta.url), 'utf8');
  const imports = [...source.matchAll(/^import .* from '([^']+)';$/gm)].map((match) => match[1]);
  assert.deepEqual(imports, ['./username-registry.mjs']);
  assert.doesNotMatch(source, /\b(window|document|process|Date\.now|Math\.random|fetch)\b/);
});
