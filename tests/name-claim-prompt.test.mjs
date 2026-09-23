// First-Ranked name prompt (brief acceptance 5): one small, non-blocking toast
// for a hosted wallet with no on-chain name that has not said "Not now".
import assert from 'node:assert/strict';
import test, { beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';

import {
  NAME_CLAIM_TITLE,
  maybePromptNameClaim,
  nameClaimVerdict,
  resetNameClaimPromptForTests,
} from '../apps/portal/src/name-claim-prompt.mjs';

const WALLET = `0x${'ab'.repeat(20)}`;

function element(tag) {
  return {
    tag,
    children: [],
    attributes: {},
    listeners: {},
    style: {},
    removed: false,
    append(...nodes) { this.children.push(...nodes); },
    setAttribute(name, value) { this.attributes[name] = String(value); },
    addEventListener(type, callback) { this.listeners[type] = callback; },
    remove() { this.removed = true; },
  };
}
const documentRef = { createElement: element };
const walk = (root, visit) => { visit(root); for (const child of root.children ?? []) walk(child, visit); };
const textOf = (root) => { const parts = []; walk(root, (node) => { if (node.textContent) parts.push(node.textContent); }); return parts.join(' '); };
const buttonNamed = (root, label) => { let hit = null; walk(root, (node) => { if (node.tag === 'button' && node.textContent === label) hit = node; }); return hit; };

function selfView({ displayName = null, hidden = false, dismissed = false } = {}) {
  return { ok: true, wallet: WALLET, profile: { displayName, avatarUri: null, hidden, nameBlocked: null }, preferences: dismissed ? { nameClaimDismissed: true } : {}, games: {}, recentSessions: [], achievements: [] };
}

function fakeIndexApi(answer = selfView()) {
  const calls = { profile: [], savePreferences: [] };
  return {
    calls,
    profile: async (wallet, options) => { calls.profile.push([wallet, options]); return answer; },
    savePreferences: async (preferences) => { calls.savePreferences.push(preferences); return { ok: true, wallet: WALLET, preferences }; },
  };
}

const runEvent = (wallet = WALLET, mode = 'ranked') => ({ handle: {}, context: { gameId: 'chikun', wallet, mode }, actions: {} });

beforeEach(() => resetNameClaimPromptForTests());

test('a hosted wallet with no name gets one toast, and Claim opens the name editor', async () => {
  const mount = element('body');
  const indexApi = fakeIndexApi();
  const claimed = [];
  const timers = [];
  const outcome = await maybePromptNameClaim({ detail: runEvent(), hosted: true, wallet: WALLET.toUpperCase().replace('0X', '0x'), indexApi, documentRef, mount, onClaim: (wallet) => claimed.push(wallet), setTimeoutImpl: (callback, ms) => timers.push({ callback, ms }) });
  assert.equal(outcome.shown, true);
  assert.deepEqual(indexApi.calls.profile, [[WALLET, { self: true }]], 'preferences come from the self view');
  const toast = mount.children[0];
  assert.equal(toast.attributes.role, 'status', 'non-blocking: a status toast, never a dialog');
  assert.equal(toast.style.position, 'fixed');
  assert.match(textOf(toast), new RegExp(NAME_CLAIM_TITLE));
  buttonNamed(toast, 'Claim').listeners.click();
  assert.deepEqual(claimed, [WALLET]);
  assert.equal(toast.removed, true);
  assert.equal(indexApi.calls.savePreferences.length, 0, 'claiming saves nothing: the name change itself is on chain');
  assert.equal(timers[0].ms, 30_000, 'an ignored toast hides itself without dismissing for good');

  const again = await maybePromptNameClaim({ detail: runEvent(), hosted: true, wallet: WALLET, indexApi, documentRef, mount });
  assert.deepEqual(again, { shown: false, reason: 'already-shown' }, 'one toast per page load');
});

test('Not now saves nameClaimDismissed', async () => {
  const mount = element('body');
  const indexApi = fakeIndexApi();
  const dismissed = [];
  await maybePromptNameClaim({ detail: runEvent(), hosted: true, wallet: WALLET, indexApi, documentRef, mount, onDismissed: (wallet) => dismissed.push(wallet), setTimeoutImpl: () => {} });
  const toast = mount.children[0];
  await buttonNamed(toast, 'Not now').listeners.click();
  assert.deepEqual(indexApi.calls.savePreferences, [{ nameClaimDismissed: true }]);
  assert.deepEqual(dismissed, [WALLET]);
  assert.equal(toast.removed, true);
});

test('the toast is skipped in preview and for named, dismissed, hidden, signed-out or other wallets', async () => {
  const mount = element('body');
  assert.deepEqual(await maybePromptNameClaim({ detail: runEvent(), hosted: false, wallet: WALLET, indexApi: fakeIndexApi(), documentRef, mount }), { shown: false, reason: 'preview' });
  for (const [answer, reason] of [
    [selfView({ displayName: 'Lit Pilot' }), 'has-name'],
    [selfView({ dismissed: true }), 'dismissed'],
    [selfView({ hidden: true }), 'hidden'],
    [{ ok: false, error: 'sign-in-required' }, 'no-self-view'],
  ]) {
    resetNameClaimPromptForTests();
    const outcome = await maybePromptNameClaim({ detail: runEvent(), hosted: true, wallet: WALLET, indexApi: fakeIndexApi(answer), documentRef, mount });
    assert.deepEqual(outcome, { shown: false, reason }, reason);
  }
  assert.equal((await maybePromptNameClaim({ detail: runEvent(`0x${'cd'.repeat(20)}`), hosted: true, wallet: WALLET, indexApi: fakeIndexApi(), documentRef, mount })).reason, 'other-wallet');
  assert.equal((await maybePromptNameClaim({ detail: runEvent(WALLET, 'free'), hosted: true, wallet: WALLET, indexApi: fakeIndexApi(), documentRef, mount })).reason, 'not-ranked');
  assert.equal((await maybePromptNameClaim({ detail: runEvent(), hosted: true, wallet: null, indexApi: fakeIndexApi(), documentRef, mount })).reason, 'other-wallet');
  assert.equal(mount.children.length, 0);
});

test('a cached self view is used without another request', async () => {
  const indexApi = fakeIndexApi();
  const outcome = await maybePromptNameClaim({ detail: runEvent(), hosted: true, wallet: WALLET, indexApi, getCachedSelfProfile: () => selfView({ displayName: 'Cached Name' }), documentRef, mount: element('body') });
  assert.deepEqual(outcome, { shown: false, reason: 'has-name' });
  assert.equal(indexApi.calls.profile.length, 0);
  assert.deepEqual(nameClaimVerdict(selfView()), { show: true, reason: null });
});

test('main.js registers the listener in the profile-boards range and loads the prompt lazily', () => {
  const main = readFileSync(new URL('../apps/portal/main.js', import.meta.url), 'utf8');
  const listener = main.indexOf("window.addEventListener('lesters:ranked-run'");
  assert.ok(listener > 0);
  const block = main.slice(listener, listener + 900);
  assert.match(block, /if \(!HOSTED_PROFILE_SYNC\) return;/, 'preview never loads the module');
  assert.match(block, /import\('\.\/src\/name-claim-prompt\.mjs'\)/);
  assert.doesNotMatch(main, /^import .*name-claim-prompt/m, 'never a static import');
  assert.ok(listener < main.indexOf('const HMH_REBOOT_HERO_IDS'), 'registered with the route wiring, before the HMH reboot mount');
});
