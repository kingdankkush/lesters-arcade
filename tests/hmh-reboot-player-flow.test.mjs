import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { parse } from 'acorn';
import test from 'node:test';

const source = readFileSync(new URL('../apps/portal/main.js', import.meta.url), 'utf8');
const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
function portalFunction(name, context) {
  const node = ast.body.find(item => item.type === 'FunctionDeclaration' && item.id.name === name);
  assert.ok(node, name);
  return vm.runInNewContext(`(${source.slice(node.start, node.end)})`, context);
}

test('reboot starts music in the click turn before waiting for a missing session', async () => {
  const events = [];
  let resolveSession;
  const context = {
    selectedGameId: 'lester-blaster', combat: {}, currentSession: null,
    officialSelectedMode: 'free', DEFAULT_CAMPAIGN_LEVEL_ID: 'level-one',
    startArcadeMusicForGame: id => { events.push(['music', id]); return Promise.resolve(false); },
    startOfficialMode: () => new Promise(resolve => { resolveSession = () => { context.currentSession = { sessionId: 'run', isPaid: false }; resolve(); }; }),
    setOfficialView: () => {}, mountHmhRebootSession: () => events.push(['mount']),
    createInProcessGameAdapter: () => ({ start: () => {} }), hmhRebootHeroId: () => 'lit-commando', gameAdapter: null,
  };
  const pending = portalFunction('beginOfficialLevel', context)();
  assert.deepEqual(events, [['music', 'hard-money-heroes']]);
  resolveSession();
  await pending;
  assert.deepEqual(events, [['music', 'hard-money-heroes'], ['mount']]);
});

test('replay starts a new randomized music selection without blocking a fresh run', async () => {
  const events = [];
  const context = {
    hmhRebootActive: true, currentSession: { isPaid: false }, officialSelectedMode: 'free', combat: {}, gameAdapter: null,
    playSfxCue: () => {}, beginTrackedSession: () => ({ sessionId: 'replay', isPaid: false }),
    createInProcessGameAdapter: () => ({ start: () => {} }), hmhRebootHeroId: () => 'lit-commando',
    startArcadeMusicForGame: id => { events.push(['music', id]); return new Promise(() => {}); },
    mountHmhRebootSession: () => events.push(['mount']), renderOfficialRunStatus: () => {}, syncCombatOverlay: () => {},
  };
  await portalFunction('restartCombatRun', context)();
  assert.deepEqual(events, [['music', 'hard-money-heroes'], ['mount']]);
});

test('the pause summary uses the current child level after an upgrade', () => {
  const copies = [];
  const element = () => ({ dataset: {}, append() {}, replaceChildren() {} });
  const context = {
    dom: { combatMenuActionGrid: element() }, combat: { runLevel: 7, roguelikeRun: { level: 1 }, health: 100, maxHealth: 100, score: 0 },
    hmhRebootActive: true, currentSession: { mode: 'free' }, officialSelectedMode: 'free', lastSettlementSucceeded: false, SETTLEMENT_LIVE: false,
    renderLevelUpActionGrid: () => false,
    buildCombatOptionsMenuModel: () => ({ version: 'v1', state: 'paused', actions: [], groups: [] }),
    weaponById: () => null, el: element, appendText: (parent, tag, text) => copies.push(String(text)),
  };
  portalFunction('renderCombatMenuActionGrid', context)();
  assert.equal(copies[copies.indexOf('LEVEL') + 1], '7');
});
