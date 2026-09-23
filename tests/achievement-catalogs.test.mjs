import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';
import { ACHIEVEMENT_LIST } from '../apps/portal/src/arcade-core.mjs';
import { CHIKUN_REGIONS } from '../apps/portal/src/chikun-course-regions.mjs';
import { HMH_RUN_SUMMARY_CATALOGS } from '../sdk/hmh-run-summary-schema.mjs';
import {
  ACHIEVEMENT_GAME_IDS, achievementById, catalogFor, nftAchievementIds,
} from '../apps/portal/src/achievements/index.mjs';
import { HMH_FAMILY_IDS, HMH_ROLE_FAMILIES } from '../apps/portal/src/achievements/hmh.mjs';
import { CHIKUN_REGION_IDS } from '../apps/portal/src/achievements/chikun.mjs';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const moduleDir = join(repoRoot, 'apps/portal/src/achievements');
const MODULES = ['index', 'hmh', 'chikun', 'stacked', 'stats', 'metadata', 'entry'].map((name) => join(moduleDir, `${name}.mjs`));
const ENTRY_KEYS = ['available', 'category', 'criteria', 'description', 'gameId', 'id', 'image', 'lockedImage', 'nft', 'order', 'progress', 'tier', 'title'];
const tiersOf = (entries) => entries.reduce((out, entry) => ({ ...out, [entry.tier]: (out[entry.tier] ?? 0) + 1 }), {});

test('catalog sizes, tiers and NFT picks match the owner decisions', () => {
  assert.deepEqual(ACHIEVEMENT_GAME_IDS, ['lester-blaster', 'chikun', 'stacked']);
  assert.ok(Object.isFrozen(ACHIEVEMENT_GAME_IDS));
  const hmh = catalogFor('lester-blaster');
  assert.equal(hmh.length, 57);
  for (const gameId of ['chikun', 'stacked']) {
    const entries = catalogFor(gameId);
    assert.equal(entries.length, 40, gameId);
    assert.deepEqual(tiersOf(entries), { bronze: 14, silver: 12, gold: 9, platinum: 5 }, gameId);
    assert.ok(entries.every((entry) => entry.available), `${gameId} entries are all earnable`);
    const nft = nftAchievementIds(gameId);
    assert.equal(nft.length, 5, gameId);
    assert.deepEqual(nft, entries.filter((entry) => entry.tier === 'platinum').map((entry) => entry.id), `${gameId} NFT picks are its platinum entries, in catalog order`);
  }
  assert.deepEqual(nftAchievementIds('lester-blaster'), ['two-hundred-ranked-runs', 'two-fifty-ranked-runs', 'arcade-legend-500']);
  assert.equal(achievementById('lester-blaster', 'marathon-wallet').nft, false);
  assert.equal(achievementById('lester-blaster', 'perfect-boss-gauntlet').nft, false);
  // Level 2 is not in the reboot: those seven stay unavailable, and at least 44 of the other 50 are earnable.
  const levelTwo = hmh.filter((entry) => entry.id.startsWith('l2-'));
  assert.equal(levelTwo.length, 7);
  assert.ok(levelTwo.every((entry) => !entry.available && /Coming with Level 2\.$/.test(entry.description)));
  const rest = hmh.filter((entry) => !entry.id.startsWith('l2-'));
  assert.ok(rest.filter((entry) => entry.available).length >= 44, 'at least 44 of the 50 non-Level-2 ids are available');
  assert.deepEqual(rest.filter((entry) => !entry.available).map((entry) => entry.id).sort(), [
    'all-bosses-scouted', 'lucky-survivor', 'no-damage-10-minutes', 'no-damage-boss', 'perfect-boss-gauntlet', 'speed-clear',
  ]);
  // nftAchievementIds hands out a copy; the catalog stays the only source (A20).
  const copy = nftAchievementIds('chikun');
  copy.pop();
  assert.equal(nftAchievementIds('chikun').length, 5);
  assert.throws(() => catalogFor('lesters-blaster'), /unknown achievement gameId/);
  assert.throws(() => nftAchievementIds('hard-money-heroes'), /unknown achievement gameId/);
  assert.equal(achievementById('chikun', 'not-an-id'), null);
});

test('HMH catalog mirrors ACHIEVEMENT_DEFINITIONS ids, titles and tiers', () => {
  const catalog = catalogFor('lester-blaster');
  assert.equal(ACHIEVEMENT_LIST.length, 57);
  assert.deepEqual(
    catalog.map(({ id, title, tier }) => ({ id, title, tier })),
    ACHIEVEMENT_LIST.map(({ id, title, tier }) => ({ id, title, tier })),
  );
  // getaway-clear stays: it is the Lester legacy-migration key in hmh-character-config.mjs.
  assert.match(readFileSync(join(repoRoot, 'apps/portal/src/hmh-character-config.mjs'), 'utf8'), /getaway-clear/);
  assert.ok(achievementById('lester-blaster', 'getaway-clear').available);
});

test('every entry is frozen, uniquely identified and image-backed', () => {
  const ids = new Set();
  for (const gameId of ACHIEVEMENT_GAME_IDS) {
    const entries = catalogFor(gameId);
    assert.ok(Object.isFrozen(entries), `${gameId} catalog array is frozen`);
    entries.forEach((entry, index) => {
      assert.deepEqual(Object.keys(entry).sort(), ENTRY_KEYS, entry.id);
      assert.ok(Object.isFrozen(entry), `${entry.id} is frozen`);
      assert.match(entry.id, /^[a-z0-9][a-z0-9-]{1,63}$/);
      assert.ok(!ids.has(entry.id), `${entry.id} is unique across all games`);
      ids.add(entry.id);
      assert.equal(entry.gameId, gameId);
      assert.ok(entry.title.length >= 1 && entry.title.length <= 40, entry.id);
      assert.ok(entry.description.length >= 1 && entry.description.length <= 140, entry.id);
      assert.ok(['bronze', 'silver', 'gold', 'platinum', 'diamond', 'mythic'].includes(entry.tier), entry.id);
      assert.match(entry.category, /^[a-z-]{2,24}$/);
      assert.equal(typeof entry.nft, 'boolean');
      assert.equal(typeof entry.available, 'boolean');
      assert.equal(entry.order, index + 1);
      assert.ok(Number.isInteger(entry.order));
      assert.equal(typeof entry.criteria, 'function');
      assert.ok(entry.progress === null || typeof entry.progress === 'function', entry.id);
      if (!entry.available) assert.equal(entry.progress, null, `${entry.id} unavailable entries report no progress`);
      if (entry.nft) assert.ok(entry.available, `${entry.id} NFT candidates are earnable`);
      for (const image of [entry.image, entry.lockedImage]) {
        assert.match(image, /^\/assets\/.+\.png$/, entry.id);
        assert.ok(existsSync(join(repoRoot, 'apps/portal', image)), `${entry.id} image ${image} exists under apps/portal`);
      }
      assert.notEqual(entry.image, entry.lockedImage);
      // A32: no NFT wording in phase 1.
      assert.doesNotMatch(`${entry.title} ${entry.description}`, /\bnft|soulbound|mint/i, entry.id);
    });
  }
  assert.equal(ids.size, 137);
});

test('catalog tables follow the game sources they name', () => {
  assert.deepEqual(CHIKUN_REGION_IDS, CHIKUN_REGIONS.map((region) => region.id));
  const roles = HMH_RUN_SUMMARY_CATALOGS.enemyRoles;
  assert.deepEqual(Object.keys(HMH_ROLE_FAMILIES).sort(), roles.filter((role) => role !== 'liquidator').sort(), 'every non-boss reboot role has a family');
  assert.deepEqual([...new Set(Object.values(HMH_ROLE_FAMILIES))].sort(), [...HMH_FAMILY_IDS].sort());
  // Weapon ids the HMH criteria name exist in the reboot catalog.
  for (const weaponId of ['hash-rail', 'scatter-shotgun', 'litecoin-knife', 'forked-standard']) assert.ok(HMH_RUN_SUMMARY_CATALOGS.weapons.includes(weaponId), weaponId);
});

// Static import graph from every achievements module (acorn), resolved on disk.
function importGraph(entries) {
  const seen = new Map();
  const visit = (file) => {
    if (seen.has(file)) return;
    const source = readFileSync(file, 'utf8');
    const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
    const specifiers = [];
    for (const node of ast.body) {
      if ((node.type === 'ImportDeclaration' || node.type === 'ExportNamedDeclaration' || node.type === 'ExportAllDeclaration') && node.source) specifiers.push(node.source.value);
    }
    seen.set(file, { ast, source, specifiers });
    for (const specifier of specifiers) {
      assert.ok(specifier.startsWith('.'), `${relative(repoRoot, file)} imports only repo-relative modules (${specifier})`);
      if (!/\.m?js$/.test(specifier)) continue; // JSON data imports are leaves
      visit(resolve(dirname(file), specifier));
    }
  };
  entries.forEach(visit);
  return seen;
}

function forbiddenGlobals(ast) {
  const found = [];
  const walk = (node, parent) => {
    if (!node || typeof node.type !== 'string') return;
    if (node.type === 'Identifier' && ['window', 'document', 'process', 'localStorage', 'sessionStorage', 'navigator', 'Date', 'fetch', 'eval'].includes(node.name)) {
      const property = parent?.type === 'MemberExpression' && parent.property === node && !parent.computed;
      const key = parent?.type === 'Property' && parent.key === node;
      if (!property && !key) found.push(node.name);
    }
    if (node.type === 'MemberExpression' && node.object?.name === 'Math' && node.property?.name === 'random') found.push('Math.random');
    if (node.type === 'NewExpression' && node.callee?.name === 'Function') found.push('new Function');
    for (const [name, value] of Object.entries(node)) {
      if (name === 'loc') continue;
      if (Array.isArray(value)) value.forEach((child) => walk(child, node));
      else if (value && typeof value.type === 'string') walk(value, node);
    }
  };
  walk(ast, null);
  return found;
}

test('catalog modules import without arcade-core or DOM', () => {
  const graph = importGraph(MODULES);
  const files = [...graph.keys()].map((file) => relative(repoRoot, file).split('\\').join('/'));
  for (const banned of ['apps/portal/src/arcade-core.mjs', 'apps/portal/src/hmh-run-integrity.mjs', 'apps/portal/src/chikun-cabinet.mjs']) {
    assert.ok(!files.includes(banned), `achievements modules never reach ${banned}`);
  }
  assert.ok(!files.some((file) => file.startsWith('apps/hmh-reboot/')), 'no child runtime modules');
  // The catalog registry itself stays small: index + catalogs + builder only.
  const registry = importGraph([join(moduleDir, 'index.mjs')]);
  assert.deepEqual([...registry.keys()].map((file) => relative(moduleDir, file).split('\\').join('/')).sort(), ['chikun.mjs', 'entry.mjs', 'hmh.mjs', 'index.mjs', 'stacked.mjs']);
  // The achievements modules themselves: no DOM, clock, randomness, environment or eval.
  for (const file of MODULES) assert.deepEqual(forbiddenGlobals(graph.get(file).ast), [], relative(repoRoot, file));
  // Nothing in the shared child code imports the achievements modules.
  for (const file of files) {
    if (file.startsWith('sdk/')) assert.doesNotMatch(graph.get(join(repoRoot, file)).source, /achievements\//, file);
  }
});

test('catalog modules load in plain Node with no flags', () => {
  const script = [
    "const index = await import('./apps/portal/src/achievements/index.mjs');",
    "const stats = await import('./apps/portal/src/achievements/stats.mjs');",
    "const metadata = await import('./apps/portal/src/achievements/metadata.mjs');",
    "console.log(JSON.stringify({ games: index.ACHIEVEMENT_GAME_IDS, sizes: index.ACHIEVEMENT_GAME_IDS.map((g) => index.catalogFor(g).length), stats: typeof stats.statsFromChikunResult, metadata: typeof metadata.buildAchievementMetadata }));",
  ].join('\n');
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], { cwd: repoRoot, encoding: 'utf8', env: { PATH: process.env.PATH ?? '', SystemRoot: process.env.SystemRoot ?? '' } });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { games: ['lester-blaster', 'chikun', 'stacked'], sizes: [57, 40, 40], stats: 'function', metadata: 'function' });
});
