import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { findModuleReferences } from '../scripts/stacked-contract-audit.mjs';
import {
  STACKED_ATTACK_TABLE,
  STACKED_VERSUS_TABLE_VERSION,
  computeAttack,
  resolveGarbageExchange,
} from '../apps/portal/src/stacked-versus-table.mjs';

// Other test files running in parallel create and remove short-lived probe directories under apps/
// (tests/stacked-contracts.test.mjs plants .stacked-contract-probe-* to prove its own guard). An
// entry that disappears while this walk runs no longer exists, so it has nothing to audit; every
// other file-system error still fails the audit.
const vanished = (error) => error?.code === 'ENOENT';
const walk = (root, { readdir = readdirSync, stat = statSync } = {}) => {
  let names;
  try { names = readdir(root); } catch (error) { if (vanished(error)) return []; throw error; }
  return names.flatMap((name) => {
    const path = join(root, name);
    let entry;
    try { entry = stat(path); } catch (error) { if (vanished(error)) return []; throw error; }
    return entry.isDirectory() ? walk(path, { readdir, stat }) : [path];
  });
};

const attackTableImporters = () => {
  const importers = [];
  for (const path of walk('apps')) {
    if (!/\.(?:mjs|js)$/.test(path)) continue;
    let text;
    try { text = readFileSync(path, 'utf8'); } catch (error) { if (vanished(error)) continue; throw error; }
    let references;
    try { references = findModuleReferences(text); }
    catch (cause) { throw new Error(`Cannot audit ${relative('.', path)}: ${cause.message}`, { cause }); }
    const unresolved = references.find((reference) => typeof reference.source !== 'string');
    if (unresolved) {
      throw new Error(`Cannot audit ${relative('.', path)}: unresolved ${unresolved.kind} module specifier`);
    }
    let specifiers;
    try { specifiers = references.map((reference) => decodeURIComponent(reference.source.split(/[?#]/, 1)[0])); }
    catch (cause) { throw new Error(`Cannot audit ${relative('.', path)}: malformed module URL encoding`, { cause }); }
    if (specifiers.some((specifier) => specifier.includes('stacked-versus-table.mjs'))) {
      importers.push(relative('.', path).replaceAll('\\', '/'));
    }
  }
  return importers;
};

test('attack table is recursively frozen, complete, and versioned', () => {
  assert.equal(STACKED_VERSUS_TABLE_VERSION, 'stacked-versus-table-v1');
  assert.equal(STACKED_ATTACK_TABLE.version, STACKED_VERSUS_TABLE_VERSION);
  assert.deepEqual(STACKED_ATTACK_TABLE.base, [0, 0, 1, 2, 4]);
  assert.deepEqual(STACKED_ATTACK_TABLE.spin.full, [0, 2, 4, 6, 6]);
  assert.deepEqual(STACKED_ATTACK_TABLE.spin.mini, [0, 0, 1, 1, 1]);
  assert.equal(STACKED_ATTACK_TABLE.backToBackMinLines, 2);
  assert.ok(Object.isFrozen(STACKED_ATTACK_TABLE));
  assert.ok(Object.isFrozen(STACKED_ATTACK_TABLE.spin.full));
  assert.ok(Object.isFrozen(STACKED_ATTACK_TABLE.backToBackQualifiers));
});

test('computeAttack pins precedence, floors, CHAIN gate, combo, and zero rows', () => {
  const base = { comboCountBefore: -1, backToBackActive: false, perfectClear: false };
  assert.deepEqual(computeAttack({ ...base, lines: 0, clearType: 'none' }), { rows: 0, nextBackToBack: false, nextComboCount: -1 });
  assert.equal(computeAttack({ ...base, lines: 2, clearType: 'double' }).rows, 1);
  assert.equal(computeAttack({ ...base, lines: 3, clearType: 'spin-mini' }).rows, 2, 'spin value is floored by plain value');
  assert.equal(computeAttack({ ...base, lines: 1, clearType: 'spin-full', backToBackActive: true }).rows, 2, 'CHAIN does not pay on singles');
  assert.equal(computeAttack({ ...base, lines: 2, clearType: 'spin-full', backToBackActive: true }).rows, 5);
  assert.equal(computeAttack({ ...base, lines: 4, clearType: 'spin-full', backToBackActive: true }).rows, 7);
  assert.equal(computeAttack({ ...base, lines: 4, clearType: 'quad', backToBackActive: true, perfectClear: true }).rows, 11);
  assert.equal(computeAttack({ ...base, lines: 1, clearType: 'single', comboCountBefore: 9 }).rows, 4);
  assert.equal(computeAttack({ ...base, lines: 0, clearType: 'none', backToBackActive: true }).nextBackToBack, true);
  assert.equal(computeAttack({ ...base, lines: 1, clearType: 'single', backToBackActive: true }).nextBackToBack, false);
});

test('rows-per-piece design assertions retain the intended ordering', () => {
  const attack = (lines, clearType, extras = {}) => computeAttack({ lines, clearType, comboCountBefore: -1, backToBackActive: true, perfectClear: false, ...extras }).rows;
  assert.equal(attack(2, 'double') / 5, 0.2);
  assert.ok(attack(3, 'triple') / 7.5 > attack(2, 'double') / 5);
  assert.equal(attack(4, 'quad') / 10, 0.5);
  assert.equal(attack(1, 'spin-full') / 2.5, 0.8);
  assert.equal(attack(2, 'spin-full') / 5, 1);
  assert.equal(attack(4, 'quad', { perfectClear: true }) / 10, 1.1);
  assert.equal(attack(2, 'spin-mini') / 5, 0.4);
  assert.equal(attack(3, 'spin-full') / 7.5, 7 / 7.5);
  let comboCountBefore = -1;
  let comboRows = 0;
  for (let clear = 0; clear < 10; clear += 1) {
    const result = computeAttack({ lines: 1, clearType: 'single', comboCountBefore, backToBackActive: false, perfectClear: false });
    comboRows += result.rows;
    comboCountBefore = result.nextComboCount;
  }
  assert.equal(comboRows, 17);
});

test('garbage exchange cancels oldest rows and never emits a zero-row entry', () => {
  const first = Object.freeze({ rows: 3, chargeReadyTick: 20, holeColumns: Object.freeze([1, 2, 3]) });
  const second = Object.freeze({ rows: 2, chargeReadyTick: 30, holeColumns: Object.freeze([4, 5]) });
  const exact = resolveGarbageExchange({ outgoingRows: 5, queue: Object.freeze([first, second]), tick: 40, chargeTicks: 60 });
  assert.equal(exact.cancelledRows, 5);
  assert.deepEqual(exact.queue, []);
  assert.equal(exact.sent, null);
  assert.ok(Object.isFrozen(exact.queue));

  const partial = resolveGarbageExchange({ outgoingRows: 4, queue: Object.freeze([first, second]), tick: 40, chargeTicks: 60 });
  assert.equal(partial.cancelledRows, 4);
  assert.deepEqual(partial.queue, [{ rows: 1, chargeReadyTick: 30, holeColumns: [5] }]);
  assert.equal(partial.sent, null);

  const send = resolveGarbageExchange({ outgoingRows: 7, queue: Object.freeze([first]), tick: 40, chargeTicks: 60 });
  assert.equal(send.cancelledRows, 3);
  assert.deepEqual(send.sent, { rows: 4, chargeReadyTick: 101 });
  assert.ok(Object.isFrozen(send.sent));
});

test('no application runtime imports the Phase-1 attack table', () => {
  assert.deepEqual(attackTableImporters(), []);
});

test('the import-audit walk skips entries that vanish mid-walk and fails on any other error', () => {
  const enoent = () => Object.assign(new Error('ENOENT: no such file or directory'), { code: 'ENOENT' });
  const tree = { apps: ['live.mjs', '.probe-gone', 'dir-gone'], 'apps/dir-gone': null };
  const readdir = (path) => {
    const key = path.replaceAll('\\', '/');
    if (tree[key] === null) throw enoent();
    return tree[key] ?? [];
  };
  const stat = (path) => {
    const key = path.replaceAll('\\', '/');
    if (key === 'apps/.probe-gone') throw enoent();
    return { isDirectory: () => key === 'apps/dir-gone' };
  };
  assert.deepEqual(walk('apps', { readdir, stat }).map((path) => path.replaceAll('\\', '/')), ['apps/live.mjs']);
  const denied = () => { throw Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' }); };
  assert.throws(() => walk('apps', { readdir: denied, stat }), /EACCES/);
  assert.throws(() => walk('apps', { readdir, stat: denied }), /EACCES/);
});

test('import audit recognizes module edges but ignores strings and comments and rejects parse failure', () => {
  const reference = './stacked-versus-table.mjs';
  for (const source of [
    `import '${reference}'`, `import('${reference}')`, `export * from '${reference}'`,
    `export { value } from '${reference}'`, `require('${reference}')`,
    'import(`./stacked-versus-table.mjs`)',
    'import("./" + "stacked-versus-table.mjs")',
    'require(`./stacked-versus-table.mjs`)',
  ]) assert.equal(findModuleReferences(source)[0].source, reference);
  assert.deepEqual(findModuleReferences(`// import '${reference}'\nconst asset = '${reference}'`), []);
  assert.throws(() => findModuleReferences('import {'), /Unexpected token/);
});

test('import audit fails closed for an unresolved computed app import', () => {
  const fixture = join('apps', 'portal', 'src', '__stacked-versus-dynamic-guard-fixture__.mjs');
  writeFileSync(fixture, 'const target = globalThis.cabinetModule; import(target);\n', 'utf8');
  try {
    assert.throws(() => attackTableImporters(), /Cannot audit|unresolved/i);
  } finally {
    rmSync(fixture, { force: true });
  }
});

test('import audit inspects nested same-named modules without exemptions', () => {
  const directory = mkdtempSync(join('apps', '__stacked-audit-'));
  const nested = join(directory, 'nested');
  mkdirSync(nested);
  const fixture = join(nested, 'stacked-versus-table.mjs');
  try {
    for (const source of [
      "import '../../portal/src/stacked-versus-table.mjs';\n",
      "import('../../portal/src/stacked%2Dversus%2Dtable.mjs');\n",
    ]) {
      writeFileSync(fixture, source, 'utf8');
      assert.ok(attackTableImporters().includes(fixture.replaceAll('\\', '/')), source);
    }
    writeFileSync(fixture, 'import(globalThis.cabinetModule);\n', 'utf8');
    assert.throws(() => attackTableImporters(), /unresolved/i);
    writeFileSync(fixture, 'import {', 'utf8');
    assert.throws(() => attackTableImporters(), /Cannot audit/i);
    writeFileSync(fixture, "const label = 'stacked-versus-table.mjs';\n", 'utf8');
    assert.deepEqual(attackTableImporters(), []);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('import audit catches a real app importer and always cleans its fixture', () => {
  const fixture = join('apps', 'portal', 'src', '__stacked-versus-import-guard-fixture__.mjs');
  for (const source of [
    "import './stacked-versus-table.mjs';\n",
    'import(`./stacked-versus-table.mjs`);\n',
    "import './stacked%2Dversus%2Dtable.mjs';\n",
  ]) {
    writeFileSync(fixture, source, 'utf8');
    try {
      assert.ok(attackTableImporters().includes(fixture.replaceAll('\\', '/')), source);
    } finally {
      rmSync(fixture, { force: true });
    }
  }
});
