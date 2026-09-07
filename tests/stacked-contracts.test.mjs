import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '..');
const contractPath = join(root, 'apps/portal/src/stacked-contracts.mjs');
const audit = () => import('../scripts/stacked-contract-audit.mjs');
const loadContracts = () => import(pathToFileURL(contractPath).href);

const EXPECTED = {
  STACKED_FIXED_STEP_HZ: 60, STACKED_MAX_CATCH_UP_STEPS: 4,
  BOARD_WIDTH: 10, BOARD_VISIBLE_ROWS: 20, BOARD_BUFFER_ROWS: 4, BOARD_ROWS: 24,
  SPAWN_DELAY_TICKS: 0, LINE_CLEAR_DELAY_TICKS: 0, STACKED_MIN_PLACEMENT_TICKS: 2,
  SOFT_DROP_FACTOR: 20, STACKED_LEVEL_CAP: 30, STACKED_COMBO_BONUS_CAP: 20,
  GRAVITY_LEVEL_CAP: 15, LOCK_LEVEL_CAP: 20, STACKED_ZONE_COUNT: 6,
  STACKED_MAX_TICKS: 432000, STACKED_MAX_PIECES: 216000, STACKED_MAX_LINES: 86400,
  STACKED_MAX_QUAD_CLEARS: 21600, STACKED_MAX_SCORE: 1000000000000,
  STACKED_MAX_ELAPSED_MS: 7200000, STACKED_ACTION_COUNT: 8,
  STACKED_MAX_MOVE_STEPS_PER_TICK: 1, STACKED_MOVE_QUEUE_MAX: 9,
  STACKED_INPUT_BUFFER_TICKS: 4, DAS_TICKS: 8, ARR_TICKS: 2, DCD_TICKS: 0,
  STACKED_EVIDENCE_CODEC_VERSION: 1, STACKED_MAX_INPUT_TRANSITIONS: 432000,
  STACKED_MAX_EVIDENCE_BYTES: 1302000, STACKED_MAX_EVIDENCE_CHUNKS: 33,
  STACKED_EVIDENCE_CHUNK_RAW_BYTES: 42000, STACKED_EVIDENCE_CHUNK_B64_CHARS: 56000,
  STACKED_MAX_STORED_REPLAY_CHARS: 240000, GARBAGE_START_TICK: 3600,
  GARBAGE_INTERVAL_START_TICKS: 720, GARBAGE_INTERVAL_STEP_TICKS: 30,
  GARBAGE_INTERVAL_STEP_PERIOD_TICKS: 2700, GARBAGE_INTERVAL_FLOOR_TICKS: 120,
  GARBAGE_ROWS_PER_INJECTION: 1, GARBAGE_PENDING_MAX: 8,
  GARBAGE_HOLE_REPEAT_NUM: 3, GARBAGE_HOLE_REPEAT_DEN: 5, HASHPOWER_MAX: 8,
  REORG_COST_PERIOD_TICKS: 10800, REORG_COST_MAX: 12,
  STACKED_ENTRY_JS_CAP: null, STACKED_INITIAL_JS_CAP: null,
  CELL_PX: 32, STACKED_ZONE_TRANSITION_TICKS: 150,
  STACKED_GAME_ID: 'stacked', STACKED_URL_SLUG: 'stacked', STACKED_URL_SLUG_ALIAS: 'stack',
  STACKED_SEASON_ID: 'stacked-season-preview-1', STACKED_BRIDGE_PROTOCOL: 'stacked-bridge/v1',
  STACKED_RESULT_TUPLE_TAG: 'stacked-result-v1', STACKED_RUN_SUMMARY_VERSION: 1,
  STACKED_PLAYER_SETTINGS_KEY: 'stacked-player-settings-v1',
  STACKED_REPLAY_KEY_PREFIX: 'stacked-replay-v1:', STACKED_REPLAY_INDEX_KEY: 'stacked-replay-v1:index',
  STACKED_FREE_MEDALS_KEY: 'stacked-free-medals-v1', STACKED_TELEMETRY_MOUNT_ID: 'stackedStage',
  STACKED_GRAVITY_Q16: [1092,1092,1365,1771,2341,3121,4096,5461,7282,9362,13107,16384,21845,32768,65536,131072],
  STACKED_LOCK_RULES: [
    { minLevel: 1, maxLevel: 10, lockDelayTicks: 30, lockResetCap: 15 },
    { minLevel: 11, maxLevel: 13, lockDelayTicks: 26, lockResetCap: 15 },
    { minLevel: 14, maxLevel: 16, lockDelayTicks: 22, lockResetCap: 12 },
    { minLevel: 17, maxLevel: 18, lockDelayTicks: 18, lockResetCap: 10 },
    { minLevel: 19, maxLevel: 19, lockDelayTicks: 15, lockResetCap: 8 },
    { minLevel: 20, maxLevel: 30, lockDelayTicks: 12, lockResetCap: 6 }
  ],
  LOCK_DELAY_TICKS: [30,30,30,30,30,30,30,30,30,30,26,26,26,22,22,22,18,18,15,12],
  LOCK_RESET_CAP: [15,15,15,15,15,15,15,15,15,15,15,15,15,12,12,12,10,10,8,6],
  STACKED_ACTIONS: ['moveLeft','moveRight','softDrop','hardDrop','rotateCW','rotateCCW','rotate180','hold'],
  STACKED_TERMINAL_REASONS: ['block-out','lock-out','garbage-out','tick-ceiling','evidence-ceiling'],
  STACKED_DAS_RANGE_TICKS: { min: 4, max: 18 },
  STACKED_ARR_RANGE_TICKS: { min: 1, max: 6 },
  STACKED_DCD_RANGE_TICKS: { min: 0, max: 8 },
  STACKED_CLEAR_SCORES: { 0: 0, 1: 100, 2: 300, 3: 500, 4: 800 },
  STACKED_MINI_SPIN_SCORES: { 0: 100, 1: 200, 2: 400 },
  STACKED_FULL_SPIN_SCORES: { 0: 400, 1: 800, 2: 1200, 3: 1600 },
  PERFECT_CLEAR_BONUS: { 1: 800, 2: 1200, 3: 1800, 4: 2000, chainedQuad: 3200 },
  HASHPOWER_PER_CLEAR: { 0: 0, 1: 0, 2: 1, 3: 2, 4: 4 },
  STACKED_QUALITY_TIERS: {
    desktopHigh: { particleCapacity: 6000, resolutionCap: 2, maxPixelArea: 4000000, bloomCap: 0.35, antialias: true },
    desktopLow: { particleCapacity: 2600, resolutionCap: 1.5, maxPixelArea: 1600000, bloomCap: 0.22, antialias: false },
    mobile: { particleCapacity: 1200, resolutionCap: 1.25, maxPixelArea: 1600000, bloomCap: 0, antialias: false }
  },
  STACKED_FRAME_SIZES: { wide: { width: 512, height: 640 }, tall: { width: 320, height: 800 } },
  STACKED_ZONE_IDS: ['genesis-vault','mempool-drift','hashrate-forge','scrypt-lattice','halving-eclipse','mainnet-aurora'],
  STACKED_CAPABILITIES: ['leaderboard','achievements','ranked','audio','haptics'],
  STACKED_TELEMETRY_KEYS: ['qualityProfile','reducedMotion','renderResolution','renderedParticles','particlePoolSize','simulationTick','runScore','garbageRowsInserted','runRestarts','longestRunTicks','assetsReady']
};

function assertDeepFrozen(value) {
  if (value === null || typeof value !== 'object') return;
  assert.equal(Object.isFrozen(value), true);
  for (const child of Object.values(value)) assertDeepFrozen(child);
}

const nonDeclarations = [
  'const width = BOARD_WIDTH;', 'const label = "BOARD_WIDTH";',
  '// const BOARD_WIDTH = 1;\nconst x = 0;', '/* const BOARD_WIDTH = 1 */',
  'const label = `BOARD_WIDTH ${BOARD_WIDTH}`;',
  'import { BOARD_WIDTH } from "./stacked-contracts.mjs";',
  'export { BOARD_WIDTH } from "./stacked-contracts.mjs";',
  'const { BOARD_WIDTH: localWidth } = source;',
  'const { BOARD_WIDTH: localWidth = 10 } = source;',
  'const object = { BOARD_WIDTH: 10 };',
  'class Board { BOARD_WIDTH = 10; method() { return BOARD_WIDTH; } }',
  'const result = source.BOARD_WIDTH;'
];
for (const [index, source] of nonDeclarations.entries()) {
  test(`declaration guard allows normal use ${index}`, async () => {
    assert.deepEqual((await audit()).findDuplicateDeclarations(source, ['BOARD_WIDTH']), []);
  });
}
const declarations = [
  'const BOARD_WIDTH = 10', 'let BOARD_WIDTH;', 'var BOARD_WIDTH = 10;',
  'const\n BOARD_WIDTH = 10;', 'const a = 1, BOARD_WIDTH = 10;',
  'const { BOARD_WIDTH } = source;', 'const { a: BOARD_WIDTH } = source;',
  'const { a: { b: BOARD_WIDTH = 10 } } = source;',
  'const { ...BOARD_WIDTH } = source;',
  'const [BOARD_WIDTH] = source;', 'const [, BOARD_WIDTH = 10] = source;',
  'const [ ...BOARD_WIDTH ] = source;', 'const [{ a: BOARD_WIDTH }] = source;',
  'function BOARD_WIDTH() {}', 'const f = function BOARD_WIDTH() {};',
  'function f(BOARD_WIDTH) {}', 'const f = (BOARD_WIDTH = 10) => BOARD_WIDTH;',
  'const f = (...BOARD_WIDTH) => BOARD_WIDTH;',
  'function f({a: [BOARD_WIDTH = 10]}) {}',
  'class BOARD_WIDTH {}', 'const C = class BOARD_WIDTH {};',
  'try {} catch (BOARD_WIDTH) {}', 'for (let BOARD_WIDTH of []) {}'
];
for (const [index, source] of declarations.entries()) {
  test(`declaration guard catches real binding ${index}`, async () => {
    assert.deepEqual((await audit()).findDuplicateDeclarations(source, ['BOARD_WIDTH']), ['BOARD_WIDTH']);
  });
}

test('declaration guard rejects invalid source instead of silently passing', async () => {
  const { findDuplicateDeclarations } = await audit();
  assert.throws(() => findDuplicateDeclarations('const BOARD_WIDTH = ;', ['BOARD_WIDTH']), SyntaxError);
});

test('module-reference guard catches static, dynamic, re-export and require dependencies', async () => {
  const { findModuleReferences } = await audit();
  for (const source of ['import x from "x";', 'export { x } from "x";', 'export * from "x";', 'const x = import("x");', 'const x = require("x");']) {
    assert.equal(findModuleReferences(source).length, 1, source);
  }
  assert.equal(findModuleReferences('const label = "import x from x";').length, 0);
});

test('every frozen export and nested table equals the contract', async () => {
  const actual = await loadContracts();
  assert.deepEqual({ ...actual }, EXPECTED);
  for (const value of Object.values(actual)) assertDeepFrozen(value);
  assert.equal(ArrayBuffer.isView(actual.STACKED_GRAVITY_Q16), false);
  assert.throws(() => { actual.STACKED_QUALITY_TIERS.mobile.particleCapacity = 1; }, TypeError);
});

test('derived board, lock, run and evidence capacities agree', async () => {
  const c = await loadContracts();
  assert.equal(c.BOARD_ROWS, c.BOARD_VISIBLE_ROWS + c.BOARD_BUFFER_ROWS);
  for (let level = 1; level <= c.LOCK_LEVEL_CAP; level++) {
    const rule = c.STACKED_LOCK_RULES.find(r => level >= r.minLevel && level <= r.maxLevel);
    assert.equal(c.LOCK_DELAY_TICKS[level - 1], rule.lockDelayTicks);
    assert.equal(c.LOCK_RESET_CAP[level - 1], rule.lockResetCap);
  }
  assert.equal(c.STACKED_MAX_PIECES, Math.floor(c.STACKED_MAX_TICKS / c.STACKED_MIN_PLACEMENT_TICKS));
  assert.equal(c.STACKED_MAX_LINES, Math.floor(c.STACKED_MAX_PIECES * 4 / c.BOARD_WIDTH));
  assert(c.STACKED_MAX_EVIDENCE_CHUNKS * c.STACKED_EVIDENCE_CHUNK_RAW_BYTES > c.STACKED_MAX_EVIDENCE_BYTES);
  assert(c.STACKED_MAX_EVIDENCE_BYTES / c.STACKED_MAX_TICKS > 3);
  assert.equal(c.STACKED_MAX_INPUT_TRANSITIONS, c.STACKED_MAX_TICKS);
  assert.equal(c.STACKED_EVIDENCE_CHUNK_RAW_BYTES % 3, 0);
  assert.equal(c.STACKED_EVIDENCE_CHUNK_B64_CHARS, c.STACKED_EVIDENCE_CHUNK_RAW_BYTES * 4 / 3);
});

test('artifact writer regenerates identical committed bytes twice', async () => {
  const writer = await import('../scripts/write-stacked-contracts.mjs');
  const committed = await readFile(join(root, 'docs/stacked/contracts.json'));
  const dir = await mkdtemp(join(tmpdir(), 'stacked-contract-artifact-'));
  try {
    for (const filename of ['first.json', 'second.json']) {
      await writer.writeStackedContracts(join(dir, filename));
      assert.deepEqual(await readFile(join(dir, filename)), committed);
    }
    assert.equal(writer.deriveStackedContractsJson(), committed.toString('utf8'));
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('unmeasured bundle caps fail with the required error', async () => {
  const writer = await import('../scripts/write-stacked-contracts.mjs');
  assert.throws(() => writer.assertStackedJsBudget({ entryBytes: 0, initialBytes: 0 }),
    new Error('STACKED_ENTRY_JS_CAP has no measured baseline yet'));
});

test('contract modules have no dependencies and the cabinet version is isolated', async () => {
  const { findModuleReferences } = await audit();
  const cabinetPath = join(root, 'apps/portal/src/stacked-cabinet.mjs');
  for (const file of [contractPath, cabinetPath]) {
    assert.deepEqual(findModuleReferences(await readFile(file, 'utf8')), []);
  }
  assert.equal((await readFile(cabinetPath, 'utf8')).trim(), "export const STACKED_CABINET_VERSION = '0.2.0';");
  assert.deepEqual({ ...await import(pathToFileURL(cabinetPath).href) }, { STACKED_CABINET_VERSION: '0.2.0' });
});

test('actual source-tree guard catches planted duplicates and cleans up', async () => {
  const { scanContractDeclarations } = await audit();
  const names = Object.keys(EXPECTED);
  assert.deepEqual(await scanContractDeclarations(root, names, contractPath), []);
  const dirs = [];
  try {
    for (const tree of ['apps', 'scripts']) {
      const dir = await mkdtemp(join(root, tree, '.stacked-contract-probe-'));
      dirs.push(dir);
      await writeFile(join(dir, 'duplicate.mjs'), 'const BOARD_WIDTH = 1\n');
      await writeFile(join(dir, 'reference.mjs'), 'const width = BOARD_WIDTH;\n');
    }
    const hits = await scanContractDeclarations(root, names, contractPath);
    assert.equal(hits.length, dirs.length);
    assert(hits.every(hit => hit.name === 'BOARD_WIDTH' && hit.path.endsWith('/duplicate.mjs')));
  } finally { for (const dir of dirs) await rm(dir, { recursive: true, force: true }); }
  assert.deepEqual(await scanContractDeclarations(root, names, contractPath), []);
});

test('all nineteen owner gates retain decisions and publication approval stays bounded', async () => {
  const decisions = await readFile(join(root, 'docs/stacked/DECISIONS.md'), 'utf8');
  const records = [...decisions.matchAll(/^\| G-(\d+) \| (OPEN|ADOPTED|CONDITIONAL|DEFERRED|AUTHORIZED, GATED) \|/gm)];
  assert.deepEqual(records.map(match => Number(match[1])), Array.from({ length: 19 }, (_, index) => index + 1));
  assert.equal(records.find(match => match[1] === '15')[2], 'AUTHORIZED, GATED');
  assert.equal(records.find(match => match[1] === '2')[2], 'CONDITIONAL');
  assert.equal(records.find(match => match[1] === '3')[2], 'CONDITIONAL');
  assert.match(decisions, /Push all completed work live\./);
  assert.match(decisions, /Unfinished STACKED public play stays blocked by G-2\/S-22/);
  assert.match(decisions, /Real funds, paid entry, settlement activation, authority changes and contract deployment remain separately prohibited/);
});
