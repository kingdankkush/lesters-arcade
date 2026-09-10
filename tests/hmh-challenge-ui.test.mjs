import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import * as core from '../apps/portal/src/arcade-core.mjs';
import { createOfficialPlayRoutes } from '../apps/portal/src/routes/official-play-routes.mjs';
import { buildHmhChallenge, buildHmhChallengeUrl } from '../apps/portal/src/hmh-challenges.mjs';

const moduleUrl = new URL('../apps/portal/src/hmh-challenge-ui.mjs', import.meta.url);
const identity = { buildHash: 'site-1:game-1', seasonId: 'testnet-1' };
const location = 'https://arcade.example/games/hard-money-heroes';
function element() {
  return { value: '', hidden: false, disabled: false, textContent: '', listeners: {}, attrs: {}, dataset: {}, style: {}, children: [],
    addEventListener(type, callback) { this.listeners[type] = callback; },
    setAttribute(key, value) { this.attrs[key] = String(value); },
    getAttribute(key) { return this.attrs[key] ?? null; },
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = children; },
    select() { this.selected = true; },
  };
}
async function setup({ search = '', now = () => Date.parse('2026-09-10T23:59:00Z'), copyText } = {}) {
  assert.ok(existsSync(moduleUrl), 'parent challenge UI controller is required');
  const { mountHmhChallengeUi } = await import(moduleUrl.href);
  const dom = Object.fromEntries(['panel', 'choice', 'sharedOption', 'status', 'link', 'copy', 'freeButton'].map((key) => [key, element()]));
  return { dom, ui: mountHmhChallengeUi({ dom, search, identity, location, now, copyText }) };
}

test('mode UI selects daily/weekly courses without starting a run or writing persistence', async () => {
  const { dom, ui } = await setup();
  ui.render('lester-blaster');
  assert.equal(dom.panel.hidden, false);
  assert.equal(ui.requestFor('lester-blaster', 'free'), null);
  dom.choice.value = 'daily'; dom.choice.listeners.change();
  const daily = ui.requestFor('lester-blaster', 'free');
  assert.equal(daily.cadence, 'daily');
  assert.equal(daily.periodStart, '2026-09-10');
  assert.match(dom.status.textContent, /Free practice.*No official/i);
  assert.equal(new URL(dom.link.value).pathname, '/games/hard-money-heroes');
  dom.choice.value = 'weekly'; dom.choice.listeners.change();
  assert.equal(ui.requestFor('lester-blaster', 'free').periodStart, '2026-09-07');
  assert.equal(ui.requestFor('lester-blaster', 'paid'), null);
  assert.equal(ui.requestFor('chikun', 'free'), null);
  ui.render('chikun'); assert.equal(dom.panel.hidden, true);
});

test('selection pins its UTC course across midnight and restarts until the player chooses again', async () => {
  let clock = Date.parse('2026-09-10T23:59:59Z');
  const { dom, ui } = await setup({ now: () => clock });
  dom.choice.value = 'daily'; dom.choice.listeners.change();
  const selected = ui.requestFor('lester-blaster', 'free');
  clock = Date.parse('2026-09-11T00:00:01Z');
  ui.render('lester-blaster');
  assert.deepEqual(ui.requestFor('lester-blaster', 'free'), selected);
  dom.choice.listeners.change();
  assert.equal(ui.requestFor('lester-blaster', 'free').periodStart, '2026-09-11');
});

test('shared query survives parent SPA canonicalization and shares only its original course', async () => {
  const shared = buildHmhChallenge({ ...identity, cadence: 'weekly', periodStart: '2026-09-07' });
  const search = new URL(buildHmhChallengeUrl(shared, location)).search;
  let copied;
  const { dom, ui } = await setup({ search, copyText: async (text) => { copied = text; } });
  ui.render('lester-blaster');
  assert.equal(dom.choice.value, 'shared');
  assert.equal(dom.sharedOption.hidden, false);
  assert.equal(ui.requestFor('lester-blaster', 'free').seed, shared.seed);
  await dom.copy.listeners.click();
  assert.equal(copied, dom.link.value);
  assert.match(dom.status.textContent, /copied/i);
});

test('malformed or incompatible share blocks only HMH Free until an explicit new selection', async () => {
  const old = buildHmhChallengeUrl(buildHmhChallenge({ ...identity, buildHash: 'old-build', cadence: 'daily', periodStart: '2026-09-10' }), location);
  for (const search of ['?hmhChallenge=daily', new URL(old).search]) {
    const { dom, ui } = await setup({ search });
    ui.render('lester-blaster');
    assert.equal(dom.freeButton.disabled, true);
    assert.equal(dom.copy.disabled, true);
    assert.equal(dom.link.value, '');
    assert.throws(() => ui.requestFor('lester-blaster', 'free'), /challenge|build/i);
    assert.equal(ui.requestFor('lester-blaster', 'paid'), null);
    dom.choice.value = 'random'; dom.choice.listeners.change();
    assert.equal(dom.freeButton.disabled, false);
    assert.equal(ui.requestFor('lester-blaster', 'free'), null);
  }
});

test('selecting Shared again restores the original shared course rather than relabeling a new course', async () => {
  const shared = buildHmhChallenge({ ...identity, cadence: 'daily', periodStart: '2026-09-01' });
  const { dom, ui } = await setup({ search: new URL(buildHmhChallengeUrl(shared, location)).search });
  dom.choice.value = 'weekly'; dom.choice.listeners.change();
  assert.notEqual(ui.requestFor('lester-blaster', 'free').seed, shared.seed);
  dom.choice.value = 'shared'; dom.choice.listeners.change();
  assert.equal(ui.requestFor('lester-blaster', 'free').seed, shared.seed);
  assert.match(dom.status.textContent, /2026-09-01/);
});

test('real mode-route ordering clears an HMH error for Chikun but preserves unconfigured cabinet gating', async () => {
  const { dom, ui } = await setup({ search: '?hmhChallenge=daily' });
  const keys = ['officialModeSelect', 'officialModeEyebrow', 'officialModeTitle', 'officialModeCopy', 'officialModeArtNote', 'officialRankedModeButton', 'officialFreeModeBanner', 'officialRankedModeBanner', 'officialFreeModeTitle', 'officialRankedModeTitle', 'officialFreeModeCopy', 'officialRankedModeCopy', 'officialRankedTooltip'];
  const routeDom = { ...Object.fromEntries(keys.map((key) => [key, element()])), officialFreeModeButton: dom.freeButton };
  let game;
  const routes = createOfficialPlayRoutes({ dom: routeDom, getContext: () => ({ connectedWallet: null }), selectedGame: () => game,
    buildGameModeSelectModel: core.buildGameModeSelectModel, applyGameModeSelectBackground: () => {},
    appendText: (parent, tag, text) => parent.append({ tag, text }), SETTLEMENT_LIVE: false,
  });
  const render = (id) => {
    game = { id, title: id };
    routes.renderModeSelect();
    ui.render(id);
  };
  render('lester-blaster');
  assert.equal(dom.freeButton.disabled, true);
  render('chikun');
  assert.equal(dom.panel.hidden, true);
  assert.equal(dom.freeButton.disabled, false);
  render('unconfigured-test-cabinet');
  assert.equal(dom.freeButton.disabled, true);
  render('lester-blaster');
  assert.equal(dom.freeButton.disabled, true);
  const main = readFileSync(new URL('../apps/portal/main.js', import.meta.url), 'utf8');
  assert.ok(/const renderOfficialModeSelect = [\s\S]*?officialPlayRoutes.renderModeSelect\(\);\s*hmhChallengeUi.render\(selectedGameId\)/.test(main), 'the integration test must use the actual parent render order');
});

test('clipboard rejection exposes a selectable link without a false copied claim', async () => {
  const { dom } = await setup({ copyText: async () => { throw new Error('denied'); } });
  dom.choice.value = 'daily'; dom.choice.listeners.change();
  await dom.copy.listeners.click();
  assert.equal(dom.link.selected, true);
  assert.match(dom.status.textContent, /copy.*link/i);
  assert.doesNotMatch(dom.status.textContent, /copied/i);
});

test('UI build identity comes from the same authority as actual sessions', () => {
  assert.equal(typeof core.getPlaySessionIdentity, 'function', 'canonical identity must not be duplicated in UI');
  const run = core.startPlaySession({ wallet: '0x1234567890abcdef1234567890abcdef12345678', gameId: 'lester-blaster' });
  assert.deepEqual(core.getPlaySessionIdentity('lester-blaster'), { buildHash: run.buildHash, seasonId: run.seasonId });
});

test('parent start/restart, mode render and accessible markup consume the challenge controller', () => {
  const main = readFileSync(new URL('../apps/portal/main.js', import.meta.url), 'utf8');
  const html = readFileSync(new URL('../apps/portal/index.html', import.meta.url), 'utf8');
  const syntax = readFileSync(new URL('../scripts/syntax-check.mjs', import.meta.url), 'utf8');
  assert.match(main, /mountHmhChallengeUi/);
  assert.match(main, /search: bootRuntimeSearch/);
  assert.match(main, /hmhChallenge: hmhChallengeUi.requestFor\(selectedGameId, normalizedMode\)/);
  assert.match(main, /hmhChallengeUi.render\(selectedGameId\)/);
  for (const id of ['hmhChallengePanel', 'hmhChallengeChoice', 'hmhChallengeStatus', 'hmhChallengeLink', 'hmhChallengeCopy']) assert.ok(html.includes(`id="${id}"`), id);
  assert.match(html, /for="hmhChallengeChoice"/);
  assert.match(html, /id="hmhChallengeStatus"[^>]+aria-live="polite"/);
  for (const path of ['apps/portal/src/hmh-challenge-ui.mjs', 'tests/hmh-challenge-ui.test.mjs']) assert.ok(syntax.includes(`"${path}"`), path);
});
