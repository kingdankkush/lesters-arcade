import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ACHIEVEMENT_GAME_IDS, catalogFor, achievementById } from '../apps/portal/src/achievements/index.mjs';
import {
  ACHIEVEMENT_GAMES, achievementMetadataFile, baseTokenUriFor, buildAchievementMetadata, serializeAchievementMetadata, tokenUriPathFor,
} from '../apps/portal/src/achievements/metadata.mjs';
import { achievementMetadataFiles, committedAchievementMetadataFiles } from '../scripts/generate-achievement-metadata.mjs';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const sortedDeep = (value) => {
  if (Array.isArray(value)) return value.every(sortedDeep);
  if (value && typeof value === 'object') {
    const keys = Object.keys(value);
    return keys.join('\0') === [...keys].sort().join('\0') && keys.every((key) => sortedDeep(value[key]));
  }
  return true;
};

test('generator output is deterministic and matches committed files', () => {
  const first = achievementMetadataFiles();
  const second = achievementMetadataFiles();
  assert.deepEqual([...first.entries()], [...second.entries()]);
  const available = ACHIEVEMENT_GAME_IDS.flatMap((gameId) => catalogFor(gameId).filter((entry) => entry.available));
  assert.equal(first.size, available.length);
  assert.equal(first.size, 44 + 40 + 40);
  assert.deepEqual([...first.keys()].sort(), available.map((entry) => `apps/portal/achievements/${entry.gameId}/${entry.id}.json`).sort());
  // Committed files equal the generator output, with nothing extra.
  assert.deepEqual(committedAchievementMetadataFiles(), [...first.keys()].sort());
  for (const [path, content] of first) {
    assert.equal(readFileSync(join(repoRoot, path), 'utf8'), content, `${path} is stale: run npm run achievements:metadata`);
    assert.ok(content.endsWith('}\n') && !content.endsWith('\n\n'), `${path} ends with one newline`);
    assert.ok(!content.includes('\r'), `${path} uses LF`);
    assert.ok(sortedDeep(JSON.parse(content)), `${path} keys are sorted`);
  }
  // Unavailable achievements get no metadata.
  assert.ok(!first.has('apps/portal/achievements/lester-blaster/l2-ngmi.json'));
  assert.ok(!first.has('apps/portal/achievements/lester-blaster/speed-clear.json'));
  const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts['achievements:metadata'], 'node scripts/generate-achievement-metadata.mjs');
});

test('metadata carries soulbound attributes and reserves animation_url', () => {
  const entry = achievementById('stacked', 'stacked-lines-1000');
  const metadata = buildAchievementMetadata(entry);
  assert.deepEqual(metadata, {
    name: 'Thousand-Row Run',
    description: entry.description,
    image: 'https://lestersarcade.io/assets/generated/achievement-badges/stacked/platinum.png',
    external_url: 'https://lestersarcade.io/games/stacked',
    attributes: [
      { trait_type: 'Game', value: 'STACKED' },
      { trait_type: 'Tier', value: 'Platinum' },
      { trait_type: 'Category', value: 'Lines' },
      { trait_type: 'Soulbound', value: 'Yes' },
      { trait_type: 'Season', value: 'LiteForge testnet' },
    ],
  });
  assert.ok(!Object.hasOwn(metadata, 'animation_url'), 'animation_url is emitted only for entries that carry an animation');
  const upgraded = buildAchievementMetadata({ ...entry, animation: '/assets/achievements/stacked/stacked-lines-1000.glb' });
  assert.equal(upgraded.animation_url, 'https://lestersarcade.io/assets/achievements/stacked/stacked-lines-1000.glb');
  assert.equal(buildAchievementMetadata({ ...entry, animation: '/assets/achievements/viewer.html' }).animation_url, 'https://lestersarcade.io/assets/achievements/viewer.html');
  assert.throws(() => buildAchievementMetadata({ ...entry, animation: 'https://elsewhere.example/x.glb' }), /animation/);
  assert.throws(() => buildAchievementMetadata({ ...entry, animation: '/assets/x.png' }), /animation/);
  assert.throws(() => buildAchievementMetadata({ ...entry, gameId: 'pinball' }), /unknown achievement gameId/);
  assert.equal(serializeAchievementMetadata(upgraded).indexOf('"animation_url"') < serializeAchievementMetadata(upgraded).indexOf('"attributes"'), true);

  const hmh = buildAchievementMetadata(achievementById('lester-blaster', 'arcade-legend-500'));
  assert.equal(hmh.external_url, 'https://lestersarcade.io/games/hard-money-heroes');
  assert.equal(hmh.attributes[0].value, 'Hard Money Heroes');
  assert.equal(hmh.attributes[1].value, 'Mythic');
  assert.equal(hmh.attributes[2].value, 'Volume');
  assert.equal(buildAchievementMetadata(achievementById('chikun', 'chikun-coins-40')).attributes[0].value, "Chikun's Escape");

  // Token URIs: baseTokenUri per on-chain gameId, tokenUriPath = <id>.json.
  for (const gameId of ACHIEVEMENT_GAME_IDS) {
    assert.equal(baseTokenUriFor(gameId), `https://lestersarcade.io/achievements/${gameId}/`);
    assert.ok(Object.hasOwn(ACHIEVEMENT_GAMES, gameId));
    for (const item of catalogFor(gameId)) {
      assert.equal(tokenUriPathFor(item), `${item.id}.json`);
      assert.equal(achievementMetadataFile(item), `apps/portal/achievements/${gameId}/${item.id}.json`);
      if (!item.available) continue;
      const json = JSON.parse(readFileSync(join(repoRoot, achievementMetadataFile(item)), 'utf8'));
      assert.deepEqual(json.attributes.filter((a) => ['Soulbound', 'Season'].includes(a.trait_type)), [{ trait_type: 'Soulbound', value: 'Yes' }, { trait_type: 'Season', value: 'LiteForge testnet' }]);
      // Every image resolves to a file under apps/portal.
      assert.ok(json.image.startsWith('https://lestersarcade.io/assets/'), item.id);
      assert.ok(existsSync(join(repoRoot, 'apps/portal', json.image.slice('https://lestersarcade.io'.length))), `${item.id} image exists`);
    }
  }
  assert.throws(() => baseTokenUriFor('hard-money-heroes'), /unknown achievement gameId/);
});

function pngInfo(path) {
  const bytes = readFileSync(path);
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `${path} is a PNG`);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), bitDepth: bytes[24], colorType: bytes[25] };
}

test('placeholder badges for Chikun and STACKED are 48x48 RGBA and under 60 KB', () => {
  const root = join(repoRoot, 'apps/portal/assets/generated/achievement-badges');
  let total = 0;
  for (const game of ['chikun', 'stacked']) {
    const expected = ['bronze', 'silver', 'gold', 'platinum'].flatMap((tier) => [`${tier}.png`, `locked-${tier}.png`]).sort();
    assert.deepEqual(readdirSync(join(root, game)).sort(), expected, `${game} ships exactly the eight tier badges`);
    for (const name of expected) {
      const path = join(root, game, name);
      assert.deepEqual(pngInfo(path), { width: 48, height: 48, bitDepth: 8, colorType: 6 }, `${game}/${name}`);
      total += statSync(path).size;
    }
  }
  assert.ok(total < 60 * 1024, `badges total ${total} bytes`);
  const script = readFileSync(join(repoRoot, 'scripts/generate-game-achievement-badges.py'), 'utf8');
  assert.match(script, /hmh-achievement-atlas/);
  assert.match(script, /BUDGET_BYTES = 60 \* 1024/);
});
