import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';
import { ACHIEVEMENT_LIST } from '../apps/portal/src/arcade-core.mjs';
import { CHIKUN_VERTICAL_SLICE_CONFIG } from '../apps/portal/src/chikun-cabinet.mjs';
import { CHIKUN_REGIONS } from '../apps/portal/src/chikun-course-regions.mjs';
import { FREE_MEDALS } from '../apps/stacked/src/free-medals.mjs';
import { HMH_RUN_SUMMARY_CATALOGS } from '../sdk/hmh-run-summary-schema.mjs';
import { HMH_RUN_SUMMARY_CATALOGS_V7 } from '../sdk/hmh-run-summary-schema-v7.mjs';
import { zoneForTick } from '../apps/portal/src/stacked-sim.mjs';
import {
  ACHIEVEMENT_GAME_IDS, ACHIEVEMENT_PARENT_ID, achievementById, catalogFor, nftAchievementIds, parentCatalog,
} from '../apps/portal/src/achievements/index.mjs';
import { HMH_2_0_TROPHY_IDS, HMH_BOSS_ROLE_IDS, HMH_FAMILY_IDS, HMH_ROLE_FAMILIES } from '../apps/portal/src/achievements/hmh.mjs';
import { CHIKUN_2_0_TROPHY_IDS, CHIKUN_REGION_IDS } from '../apps/portal/src/achievements/chikun.mjs';
import { STACKED_2_0_TROPHY_IDS, STACKED_FINAL_ZONE } from '../apps/portal/src/achievements/stacked.mjs';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const moduleDir = join(repoRoot, 'apps/portal/src/achievements');
const MODULES = ['index', 'hmh', 'chikun', 'stacked', 'arcade', 'stats', 'metadata', 'entry'].map((name) => join(moduleDir, `${name}.mjs`));
const ENTRY_KEYS = ['available', 'category', 'criteria', 'description', 'gameId', 'id', 'image', 'lockedImage', 'nft', 'order', 'progress', 'tier', 'title'];
const tiersOf = (entries) => entries.reduce((out, entry) => ({ ...out, [entry.tier]: (out[entry.tier] ?? 0) + 1 }), {});

test('catalog sizes, tiers and NFT picks match the owner decisions', () => {
  assert.deepEqual(ACHIEVEMENT_GAME_IDS, ['lester-blaster', 'chikun', 'stacked']);
  assert.ok(Object.isFrozen(ACHIEVEMENT_GAME_IDS));
  const hmh = catalogFor('lester-blaster');
  assert.equal(hmh.length, 60, '57 legacy ids plus the three 2.0 trophy entries');
  for (const gameId of ['chikun', 'stacked']) {
    const entries = catalogFor(gameId);
    assert.equal(entries.length, 41, gameId);
    // Owner checkpoint O1 (2026-09-23) re-tiered two Chikun survival entries to match the harness.
    // The 2.0 completion trophies add one platinum (Chikun, unavailable) and one mythic (STACKED).
    const spread = gameId === 'chikun' ? { bronze: 14, silver: 11, gold: 9, platinum: 7 } : { bronze: 14, silver: 12, gold: 9, platinum: 5, mythic: 1 };
    assert.deepEqual(tiersOf(entries), spread, gameId);
    assert.deepEqual(entries.filter((entry) => !entry.available).map((entry) => entry.id), gameId === 'chikun' ? ['chikun-escape-complete'] : [], `${gameId}: only the Chikun completion trophy waits for a stat`);
    const nft = nftAchievementIds(gameId);
    assert.equal(nft.length, gameId === 'chikun' ? 5 : 6, gameId);
    const platinum = entries.filter((entry) => entry.tier === 'platinum').map((entry) => entry.id);
    assert.deepEqual(nft.filter((id) => platinum.includes(id)), platinum.filter((id) => nft.includes(id)), `${gameId} platinum NFT picks come in catalog order`);
    assert.deepEqual(nft.filter((id) => !platinum.includes(id)), gameId === 'stacked' ? ['stacked-final-zone'] : [], `${gameId}: the only non-platinum trophy is the STACKED completion trophy (mythic)`);
    assert.deepEqual(platinum.filter((id) => !nft.includes(id)), gameId === 'chikun' ? ['chikun-survive-12m', 'chikun-escape-complete'] : [], `${gameId} platinum entries outside the NFT picks`);
  }
  assert.deepEqual(CHIKUN_2_0_TROPHY_IDS, ['chikun-escape-complete']);
  assert.deepEqual(STACKED_2_0_TROPHY_IDS, ['stacked-final-zone']);
  assert.deepEqual(HMH_2_0_TROPHY_IDS, ['full-roster-run', 'boss-rush-fifty', 'world-escape']);
  assert.deepEqual(nftAchievementIds('lester-blaster'), ['two-hundred-ranked-runs', 'two-fifty-ranked-runs', 'arcade-legend-500', 'full-roster-run', 'boss-rush-fifty']);
  assert.equal(achievementById('lester-blaster', 'marathon-wallet').nft, false);
  assert.equal(achievementById('lester-blaster', 'perfect-boss-gauntlet').nft, false);
  // Level 2 is not in the reboot: those seven stay unavailable, and at least 44 of the other 50 are earnable.
  const levelTwo = hmh.filter((entry) => entry.id.startsWith('l2-'));
  assert.equal(levelTwo.length, 7);
  assert.ok(levelTwo.every((entry) => !entry.available && /Coming with Level 2\.$/.test(entry.description)));
  const rest = hmh.filter((entry) => !entry.id.startsWith('l2-'));
  assert.ok(rest.filter((entry) => entry.available).length >= 44, 'at least 44 of the 50 non-Level-2 ids are available');
  assert.deepEqual(rest.filter((entry) => !entry.available).map((entry) => entry.id).sort(), [
    'all-bosses-scouted', 'lucky-survivor', 'no-damage-10-minutes', 'no-damage-boss', 'perfect-boss-gauntlet', 'speed-clear', 'world-escape',
  ]);
  // nftAchievementIds hands out a copy; the catalog stays the only source (A20).
  const copy = nftAchievementIds('chikun');
  copy.pop();
  assert.equal(nftAchievementIds('chikun').length, 5);
  assert.throws(() => catalogFor('lesters-blaster'), /unknown achievement gameId/);
  assert.throws(() => nftAchievementIds('hard-money-heroes'), /unknown achievement gameId/);
  assert.equal(achievementById('chikun', 'not-an-id'), null);
});

test('HMH catalog mirrors ACHIEVEMENT_DEFINITIONS ids, titles and tiers, then adds the 2.0 trophies', () => {
  const catalog = catalogFor('lester-blaster');
  assert.equal(ACHIEVEMENT_LIST.length, 57);
  assert.deepEqual(
    catalog.slice(0, ACHIEVEMENT_LIST.length).map(({ id, title, tier }) => ({ id, title, tier })),
    ACHIEVEMENT_LIST.map(({ id, title, tier }) => ({ id, title, tier })),
  );
  // The 2.0 trophies are catalog-only and server-derived: no device-local definition.
  assert.deepEqual(catalog.slice(ACHIEVEMENT_LIST.length).map((entry) => entry.id), [...HMH_2_0_TROPHY_IDS]);
  for (const id of HMH_2_0_TROPHY_IDS) assert.ok(!ACHIEVEMENT_LIST.some((definition) => definition.id === id), `${id} has no legacy definition`);
  assert.deepEqual(catalog.slice(ACHIEVEMENT_LIST.length).map((entry) => [entry.tier, entry.nft, entry.available]), [['mythic', true, true], ['mythic', true, true], ['mythic', false, false]]);
  // getaway-clear stays: it is the Lester legacy-migration key in hmh-character-config.mjs.
  assert.match(readFileSync(join(repoRoot, 'apps/portal/src/hmh-character-config.mjs'), 'utf8'), /getaway-clear/);
  assert.ok(achievementById('lester-blaster', 'getaway-clear').available);
});

test('every entry is frozen, uniquely identified and image-backed', () => {
  const ids = new Set();
  // The parent-owned catalog shares the id space: its ids are reserved in every game.
  assert.equal(ACHIEVEMENT_PARENT_ID, 'arcade');
  assert.ok(!ACHIEVEMENT_GAME_IDS.includes(ACHIEVEMENT_PARENT_ID), 'the parent catalog is not a cabinet');
  assert.equal(catalogFor(ACHIEVEMENT_PARENT_ID), parentCatalog());
  for (const gameId of [...ACHIEVEMENT_GAME_IDS, ACHIEVEMENT_PARENT_ID]) {
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
  assert.equal(ids.size, 143);

  // Other achievement-like ids players see: STACKED Free medals never share an
  // id with a Ranked entry (a merged profile view would show one as the other).
  const stackedIds = new Set(catalogFor('stacked').map((entry) => entry.id));
  assert.equal(FREE_MEDALS.length, 16);
  for (const medal of FREE_MEDALS) assert.ok(!ids.has(medal.id), `${medal.id} is a Free medal id, not a Ranked achievement id`);
  assert.ok([...stackedIds].every((id) => id.startsWith('stacked-')));
  // Chikun's in-runtime result ids are reused on purpose, with the same titles
  // (and thresholds, pinned in achievement-derivation.test.mjs); thread-needle is not reused.
  const runtime = CHIKUN_VERTICAL_SLICE_CONFIG.achievements;
  assert.deepEqual(runtime.map((a) => a.id).filter((id) => ids.has(id)), ['chikun-first-flight', 'chikun-stack-three', 'chikun-fork-runner']);
  for (const a of runtime.filter((row) => ids.has(row.id))) assert.equal(achievementById('chikun', a.id).title, a.title, a.id);
});

test('catalog tables follow the game sources they name', () => {
  assert.deepEqual(CHIKUN_REGION_IDS, CHIKUN_REGIONS.map((region) => region.id));
  const roles = HMH_RUN_SUMMARY_CATALOGS.enemyRoles;
  assert.deepEqual(Object.keys(HMH_ROLE_FAMILIES).sort(), roles.filter((role) => role !== 'liquidator').sort(), 'every non-boss reboot role has a family');
  assert.deepEqual([...new Set(Object.values(HMH_ROLE_FAMILIES))].sort(), [...HMH_FAMILY_IDS].sort());
  // Weapon ids the HMH criteria name exist in the reboot catalog.
  for (const weaponId of ['hash-rail', 'scatter-shotgun', 'litecoin-knife', 'forked-standard']) assert.ok(HMH_RUN_SUMMARY_CATALOGS.weapons.includes(weaponId), weaponId);
  // The full-roster trophy names exactly the schema-7 bosses, each an enemy role of that schema.
  assert.deepEqual([...HMH_BOSS_ROLE_IDS], [...HMH_RUN_SUMMARY_CATALOGS_V7.bosses]);
  for (const role of HMH_BOSS_ROLE_IDS) assert.ok(HMH_RUN_SUMMARY_CATALOGS_V7.enemyRoles.includes(role), role);
  // The STACKED completion trophy is the last zone the simulation defines.
  assert.equal(zoneForTick(90_000), STACKED_FINAL_ZONE);
  assert.equal(zoneForTick(89_999), STACKED_FINAL_ZONE - 1);
  assert.equal(zoneForTick(10_000_000), STACKED_FINAL_ZONE, 'no later zone exists');
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
  assert.deepEqual([...registry.keys()].map((file) => relative(moduleDir, file).split('\\').join('/')).sort(), ['arcade.mjs', 'chikun.mjs', 'entry.mjs', 'hmh.mjs', 'index.mjs', 'stacked.mjs']);
  // The achievements modules themselves: no DOM, clock, randomness, environment or eval.
  for (const file of MODULES) assert.deepEqual(forbiddenGlobals(graph.get(file).ast), [], relative(repoRoot, file));
});

// Every module specifier in a source file: static imports and re-exports,
// side-effect imports and dynamic import() with a literal.
const SPECIFIER_PATTERN = /\b(?:from\s*|import\s*\(\s*|import\s+)(['"`])([^'"`\n]+)\1/g;
function sourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((item) => {
    const path = join(dir, item.name);
    if (item.isDirectory()) return item.name === 'node_modules' ? [] : sourceFiles(path);
    return /\.(m?js|cjs)$/.test(item.name) ? [path] : [];
  });
}

test('the HMH child and the shared sdk never import the achievements modules', () => {
  // Contract §6.1: the catalogs stay out of apps/hmh-reboot/** and sdk/**, so they
  // never reach the child's initial JS.
  const files = ['apps/hmh-reboot', 'sdk'].flatMap((dir) => sourceFiles(join(repoRoot, dir)));
  assert.ok(files.length > 50, 'the scan sees the child and sdk sources');
  const offenders = [];
  for (const file of files) {
    for (const [, , specifier] of readFileSync(file, 'utf8').matchAll(SPECIFIER_PATTERN)) {
      const target = specifier.startsWith('.') ? resolve(dirname(file), specifier) : specifier;
      if (target.split('\\').join('/').includes('portal/src/achievements/') || /(^|\/)achievements\/(index|hmh|chikun|stacked|stats|metadata|entry)\.mjs$/.test(specifier)) {
        offenders.push(`${relative(repoRoot, file)} -> ${specifier}`);
      }
    }
  }
  assert.deepEqual(offenders, []);
  // The scan recognizes each import form it looks for.
  const probe = "import a from '../x.mjs'; export * from \"./y.mjs\"; import './z.mjs'; await import(`../w.mjs`);";
  assert.deepEqual([...probe.matchAll(SPECIFIER_PATTERN)].map((m) => m[2]), ['../x.mjs', './y.mjs', './z.mjs', '../w.mjs']);
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
  assert.deepEqual(JSON.parse(result.stdout), { games: ['lester-blaster', 'chikun', 'stacked'], sizes: [60, 41, 41], stats: 'function', metadata: 'function' });
});
