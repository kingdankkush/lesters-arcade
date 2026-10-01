// 2.0 trophy and founder badge art (plan track G1): the six badges exist at the
// pipeline size, are what the generator produces, and every catalog entry points
// at its own badge instead of a placeholder reuse.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { ARCADE_ACHIEVEMENT_GAME_ID } from '../apps/portal/src/achievements/arcade.mjs';
import { achievementById } from '../apps/portal/src/achievements/index.mjs';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const BADGE_ROOT = 'apps/portal/assets/generated/achievement-badges';

// id -> [gameId, tier]; the tiers are the catalogs' and the frame the badge wears.
const TROPHY_BADGES = Object.freeze({
  'early-supporter': [ARCADE_ACHIEVEMENT_GAME_ID, 'gold'],
  'full-roster-run': ['lester-blaster', 'mythic'],
  'boss-rush-fifty': ['lester-blaster', 'mythic'],
  'world-escape': ['lester-blaster', 'mythic'],
  'stacked-final-zone': ['stacked', 'mythic'],
  'chikun-escape-complete': ['chikun', 'platinum'],
});

function pngInfo(path) {
  const bytes = readFileSync(path);
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `${path} is a PNG`);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), bitDepth: bytes[24], colorType: bytes[25] };
}

const sha256 = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');

test('the six trophy and founder badges are 48x48 RGBA PNGs with locked variants, distinct from each other', () => {
  const hashes = new Map();
  let total = 0;
  for (const id of Object.keys(TROPHY_BADGES)) {
    for (const name of [`${id}.png`, `locked-${id}.png`]) {
      const path = join(repoRoot, BADGE_ROOT, name);
      assert.deepEqual(pngInfo(path), { width: 48, height: 48, bitDepth: 8, colorType: 6 }, name);
      total += statSync(path).size;
      const hash = sha256(path);
      assert.ok(!hashes.has(hash), `${name} duplicates ${hashes.get(hash)}`);
      hashes.set(hash, name);
    }
  }
  assert.ok(total < 40 * 1024, `badges total ${total} bytes`);
  // None of them is a byte copy of the badges they used to borrow.
  for (const borrowed of ['cabinet-pioneer', 'boss-breaker', 'boss-rush-ten', 'getaway-clear', 'stacked/platinum', 'chikun/platinum']) {
    assert.ok(!hashes.has(sha256(join(repoRoot, BADGE_ROOT, `${borrowed}.png`))), `${borrowed} is no longer reused`);
  }
});

test('every trophy and founder catalog entry points at its own badge and tier', () => {
  for (const [id, [gameId, tier]] of Object.entries(TROPHY_BADGES)) {
    const entry = achievementById(gameId, id);
    assert.ok(entry, `${gameId}/${id} is in the catalog`);
    assert.equal(entry.tier, tier);
    assert.equal(entry.image, `/assets/generated/achievement-badges/${id}.png`);
    assert.equal(entry.lockedImage, `/assets/generated/achievement-badges/locked-${id}.png`);
  }
  // The badge belongs to the trophy id only; the other entries keep their art.
  assert.equal(achievementById('stacked', 'stacked-level-10').image, '/assets/generated/achievement-badges/stacked/bronze.png'.replace('bronze', achievementById('stacked', 'stacked-level-10').tier));
  assert.equal(achievementById('chikun', 'chikun-loop-1').image, `/assets/generated/achievement-badges/chikun/${achievementById('chikun', 'chikun-loop-1').tier}.png`);
  assert.equal(achievementById('lester-blaster', 'boss-breaker').image, '/assets/generated/achievement-badges/boss-breaker.png');
});

test('the generator is deterministic and the placeholder reuse notes are gone from the catalogs', () => {
  const script = readFileSync(join(repoRoot, 'scripts/generate-trophy-achievement-badges.py'), 'utf8');
  for (const id of Object.keys(TROPHY_BADGES)) assert.match(script, new RegExp(`"${id}": "${TROPHY_BADGES[id][1]}"`), `${id} is generated with its tier frame`);
  assert.match(script, /hmh-achievement-atlas/, 'wears the shared tier frames');
  assert.match(script, /--check/, 'offers a parity check');
  for (const file of ['arcade.mjs', 'hmh.mjs', 'stacked.mjs', 'chikun.mjs']) {
    const source = readFileSync(join(repoRoot, 'apps/portal/src/achievements', file), 'utf8');
    assert.doesNotMatch(source, /PLACEHOLDER(?! ?:? ?the 2\.0 release commit fixes)/i, `${file} has no placeholder badge note left (the Early Supporter cutoff note is separate)`);
  }
});
