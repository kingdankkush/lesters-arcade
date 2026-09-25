// Owner page apps/portal/owner/jackpot.{html,mjs} and its model jackpot-review-model.mjs (Chikun Weekly
// Jackpot design §D.5): the fragments against the contract artifacts, the page rules (noindex, CSP-safe,
// module-only, no Chikun runtime), and the flows with a fake window.ethereum backed by the in-process chain
// (deployLocalJackpot), as tests/owner-confirm-page.test.mjs does for the dev-wallet page.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';
import { ethers } from 'ethers';

import { activateLocalGames, deployLocalSuite, loadArtifact, localWalletKeys, startLocalChain } from '../scripts/lib/local-chain.mjs';
import {
  deployLocalJackpot, deployMockToken, derivedFixtureWallet, fastLocalProvider, launchRules, reconnectWallets, setChainTime, settleLocalRun, weekIndexOf, weekStartOf,
} from '../scripts/lib/local-jackpot.mjs';
import { jackpotModuleValue } from '../scripts/generate-litvm-jackpot.mjs';
import {
  ERC20_FRAGMENTS, JACKPOT_ACTIONS, JACKPOT_FRAGMENTS, REASON_CODES, actionAllowed, encodeJackpotCall, extensionRemaining, fundPlan,
  isoWeekKeyOf, normalizeReview, timelineGeometry,
} from '../apps/portal/owner/jackpot-review-model.mjs';
import { createJackpotOwnerController, mountJackpotOwnerPage, renderTimeline } from '../apps/portal/owner/jackpot.mjs';
import { fakeDocument, flush, mountById, visibleText } from './helpers/jackpot-fake-dom.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const portalRoot = join(root, 'apps', 'portal');
const html = readFileSync(join(portalRoot, 'owner', 'jackpot.html'), 'utf8');
const pageModule = readFileSync(join(portalRoot, 'owner', 'jackpot.mjs'), 'utf8');
const modelModule = readFileSync(join(portalRoot, 'owner', 'jackpot-review-model.mjs'), 'utf8');
const reviewFixture = JSON.parse(readFileSync(new URL('./fixtures/jackpot/review-api-with-timeline.json', import.meta.url), 'utf8'));
const JACKPOT_IFACE = new ethers.Interface(loadArtifact('WeeklyJackpot').abi);
const TOKEN_IFACE = new ethers.Interface(loadArtifact('TestChikunToken').abi);
const TOKEN = 10n ** 18n;
const HOUR = 3600;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const keys = localWalletKeys();

function moduleImports(source) {
  const specifiers = [];
  const visit = (node) => {
    if (!node || typeof node.type !== 'string') return;
    if ((node.type === 'ImportDeclaration' || node.type === 'ImportExpression' || node.type === 'ExportNamedDeclaration' || node.type === 'ExportAllDeclaration') && node.source?.type === 'Literal') specifiers.push(node.source.value);
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') visit(value);
    }
  };
  visit(parse(source, { ecmaVersion: 'latest', sourceType: 'module' }));
  return specifiers;
}

// The page's whole unbundled import graph (static and dynamic specifiers), from owner/jackpot.mjs.
function ownerImportGraph() {
  const seen = new Set();
  const walk = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    for (const specifier of moduleImports(readFileSync(file, 'utf8'))) walk(join(file, '..', specifier));
  };
  walk(join(portalRoot, 'owner', 'jackpot.mjs'));
  return [...seen];
}

// A fake document with every container of owner/jackpot.html (by id, with its tag), so render() is
// checked against the real page's element ids.
function ownerDocument() {
  const doc = fakeDocument();
  const main = mountById(doc, 'main', 'jackpot-owner');
  for (const [, tag, id] of html.matchAll(/<(\w+)\b[^>]*\bid="((?:jo|jackpot)-[\w-]+)"/g)) {
    if (id === 'jackpot-owner') continue;
    const node = doc.createElement(tag);
    node.id = id;
    main.append(node);
  }
  return doc;
}

let chain;
let provider;
let wallets;
let suite;
let deployed;
let deployment;
let W;

// A browser wallet (EIP-1193) backed by the local chain, answering as `address` (impersonated, so the
// chain signs), with personal_sign from the fixture key when one is given. `sent` holds every
// eth_sendTransaction params object.
function fakeEthereum({ address, key = null, chainIdHex = '0x1159' }) {
  const calls = [];
  const sent = [];
  let current = chainIdHex;
  return {
    calls,
    sent,
    on() {},
    async request({ method, params = [] }) {
      calls.push(method);
      switch (method) {
        case 'eth_requestAccounts':
        case 'eth_accounts':
          return [ethers.getAddress(address)];
        case 'eth_chainId':
          return current;
        case 'wallet_switchEthereumChain':
          current = params[0].chainId;
          return null;
        case 'personal_sign':
          return new ethers.Wallet(key).signMessage(params[0]);
        case 'eth_sendTransaction':
          sent.push(params[0]);
          assert.equal(current, '0x1159', 'never sends off LiteForge');
          return chain.eip1193.request({ method, params });
        default:
          throw new Error(`fake wallet does not support ${method}`);
      }
    },
  };
}

async function controllerFor(address, { key = null, forDeployment = deployment, fetchImpl, now } = {}) {
  await chain.impersonate(address, { fund: false }); // impersonation is node state, not part of a snapshot
  const ethereum = fakeEthereum({ address, key });
  const controller = createJackpotOwnerController({
    ethereum,
    deployment: forDeployment,
    loadEthers: () => ethers,
    createReadProvider: () => provider,
    fetchImpl: fetchImpl ?? (async () => { throw new Error('no network expected'); }),
    now: now ?? (() => Date.now()),
    sleep: async () => {},
    receiptPollMs: 1,
  });
  return { controller, ethereum };
}

const at = (seconds) => setChainTime(provider, seconds);
const sentMethods = (ethereum) => ethereum.sent.map((tx) => {
  try { return JACKPOT_IFACE.parseTransaction({ data: tx.data }).name; } catch { return TOKEN_IFACE.parseTransaction({ data: tx.data }).name; }
});

before(async () => {
  chain = await startLocalChain();
  provider = fastLocalProvider(chain);
  wallets = reconnectWallets(chain.wallets, provider);
  // A Tuesday, so setup never straddles a Monday; the jackpot starts the next week.
  await at(weekStartOf(weekIndexOf(await chain.latestTimestamp()) + 1) + DAY);
  suite = await deployLocalSuite({ provider, wallets });
  await activateLocalGames({ provider, record: suite, developer: wallets.developer, operator: wallets.operator });
  deployed = await deployLocalJackpot({ provider, wallets, record: suite, rules: { ...launchRules(suite), adminClearOnly: false } });
  deployment = jackpotModuleValue(deployed.record);
  W = deployed.record.instances.chikun.firstWeek;
});

after(async () => {
  await chain?.close();
});

test('review model fragments exist in the WeeklyJackpot artifact', () => {
  for (const [fragments, iface, name] of [[JACKPOT_FRAGMENTS, JACKPOT_IFACE, 'WeeklyJackpot'], [ERC20_FRAGMENTS, TOKEN_IFACE, 'TestChikunToken']]) {
    for (const line of fragments) {
      const fragment = ethers.FunctionFragment.from(line);
      const onChain = iface.getFunction(fragment.format('sighash'));
      assert.ok(onChain, `${name} has ${fragment.format('sighash')}`);
      assert.equal(onChain.selector, fragment.selector, fragment.name);
      assert.deepEqual(onChain.outputs.map((output) => output.format('sighash')), fragment.outputs.map((output) => output.format('sighash')), `${fragment.name} returns the same types`);
      assert.equal(onChain.constant, fragment.constant, `${fragment.name} view-ness`);
    }
  }
  // Every page action encodes to its contract function.
  const jackpot = `0x${'1a'.repeat(20)}`;
  const tokenAddress = `0x${'7c'.repeat(20)}`;
  const session = `0x${'ab'.repeat(32)}`;
  const samples = {
    clear: { sessionId: session }, flag: { sessionId: session, reason: 'screen-hold' }, disqualify: { sessionId: session, wholeWalletForWeek: true, reason: 'multi-wallet' },
    reinstate: { sessionId: session }, adminSubmit: { sessionId: session }, block: { wallet: jackpot, reason: 'cheating' }, unblock: { wallet: jackpot },
    hold: { week: W }, release: { week: W }, extend: { week: W, extraSeconds: 3600 }, pause: {}, unpause: {}, finalize: { week: W },
    approve: { amountWei: 5n }, fund: { week: W, amountWei: 5n }, refund: { week: W }, claim: { week: W, to: jackpot },
  };
  for (const [action, params] of Object.entries(samples)) {
    const call = encodeJackpotCall(ethers, action, params, { jackpot, token: tokenAddress });
    const parsed = (action === 'approve' ? TOKEN_IFACE : JACKPOT_IFACE).parseTransaction({ data: call.data });
    assert.equal(parsed.name, JACKPOT_ACTIONS[action].method, action);
    assert.equal(call.to, action === 'approve' ? tokenAddress : jackpot);
  }
  assert.equal(ethers.decodeBytes32String(JACKPOT_IFACE.decodeFunctionData('disqualify', encodeJackpotCall(ethers, 'disqualify', samples.disqualify, { jackpot }).data)[2]), 'multi-wallet');
  assert.ok(REASON_CODES.disqualify.includes('multi-wallet'));
  assert.throws(() => encodeJackpotCall(ethers, 'flag', { sessionId: session, reason: 'gut-feeling' }, { jackpot }), /Unknown flag reason/);
  assert.throws(() => encodeJackpotCall(ethers, 'extend', { week: W, extraSeconds: 73 * HOUR }, { jackpot }), /72 hours/);
  assert.equal(extensionRemaining(3600), 71 * HOUR);
  // Roles, and the fund plan: exact approve, at most 8 weeks ahead, the 2-week advice, the minimum.
  assert.equal(actionAllowed('clear', { account: jackpot, admin: jackpot }), true);
  assert.equal(actionAllowed('clear', { account: tokenAddress, admin: jackpot }), false);
  assert.equal(actionAllowed('fund', { account: tokenAddress, admin: jackpot }), true);
  assert.equal(actionAllowed('finalize', { account: tokenAddress, admin: jackpot }), true);
  assert.equal(actionAllowed('claim', { account: tokenAddress, admin: jackpot, winner: tokenAddress }), true);
  const plan = fundPlan({ week: 10, currentWeek: 10, amountWei: 150n * TOKEN, minFundWei: 100n * TOKEN, balanceWei: 1000n * TOKEN, allowanceWei: 0n });
  assert.deepEqual([plan.ok, plan.needsApprove, plan.approveWei, plan.advice], [true, true, 150n * TOKEN, null]);
  assert.match(fundPlan({ week: 13, currentWeek: 10, amountWei: 150n * TOKEN, minFundWei: 100n * TOKEN, balanceWei: 1000n * TOKEN, allowanceWei: 999n * TOKEN }).advice, /at most 2 weeks ahead/);
  assert.deepEqual(fundPlan({ week: 19, currentWeek: 10, amountWei: 50n * TOKEN, minFundWei: 100n * TOKEN, balanceWei: 10n * TOKEN, allowanceWei: 0n }).problems, ['The contract accepts at most 8 weeks ahead.', "The amount is below the week's minimum fund.", 'The wallet holds less than that.']);
  assert.equal(isoWeekKeyOf(2961), '2026-W40');
});

test('owner jackpot page is noindex, CSP-safe and module-only', async () => {
  assert.match(html, /<meta name="robots" content="noindex" \/>/);
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  assert.equal(scripts.length, 1);
  assert.match(scripts[0][1], /\btype="module"/);
  assert.match(scripts[0][1], /\bsrc="\.\/jackpot\.mjs"/);
  assert.equal(scripts[0][2].trim(), '');
  assert.doesNotMatch(html, /\son[a-z]+\s*=|javascript:/i);
  assert.doesNotMatch(html, /(?:src|href)="(?:https?:)?\/\//i, 'no cross-origin resources');
  assert.match(html, /@media \(max-width: 400px\)/, 'works at 320 px');
  for (const source of [pageModule, modelModule]) {
    assert.doesNotMatch(source, /\.innerHTML\s*=|\beval\s*\(|new Function\s*\(|document\.write/);
    assert.doesNotMatch(source, /privateKey|mnemonic|signTypedData|eth_sign\b/);
  }
  assert.doesNotMatch(pageModule, /approve[^\n]*MaxUint256|2n \*\* 256n/, 'never an unlimited approve');
  // The vendored ethers the page uses in the browser encodes the same calls.
  const vendored = await import('../apps/portal/vendor/ethers.min.js');
  const session = `0x${'ab'.repeat(32)}`;
  assert.equal(encodeJackpotCall(vendored, 'clear', { sessionId: session }, { jackpot: `0x${'1a'.repeat(20)}` }).data, encodeJackpotCall(ethers, 'clear', { sessionId: session }, { jackpot: `0x${'1a'.repeat(20)}` }).data);
});

test('owner jackpot page gates admin actions on the on-chain admin and lets anyone fund', async () => {
  const snapshot = await chain.snapshot();
  try {
    // No wallet: the install-a-wallet state; an undeployed module: nothing to read on chain.
    const bare = createJackpotOwnerController({ ethereum: null, deployment });
    assert.equal(bare.state.phase, 'no-wallet');
    assert.match(bare.state.message, /Install MetaMask or Rabby/);
    const undeployed = await controllerFor(wallets.player1.address, { forDeployment: jackpotModuleValue(null) });
    assert.equal(undeployed.controller.state.phase, 'undeployed');
    await undeployed.controller.connect();
    assert.equal(undeployed.controller.state.phase, 'undeployed');

    const admin = wallets.developer.address.toLowerCase();
    const stranger = await controllerFor(wallets.player1.address);
    await stranger.controller.connect();
    assert.equal(stranger.controller.state.phase, 'ready', stranger.controller.state.message);
    assert.equal(stranger.controller.state.roles.admin, admin, 'the gate is the on-chain admin()');
    assert.equal(stranger.controller.state.isAdmin, false);
    assert.match(stranger.controller.state.message, /Read-only/);
    // The page as a non-admin sees it: admin buttons disabled, Fund enabled, both pause flags, local + UTC times.
    const doc = ownerDocument();
    const page = mountJackpotOwnerPage(doc, { ethereum: stranger.ethereum }, { deployment, loadEthers: () => ethers, createReadProvider: () => provider, sleep: async () => {}, receiptPollMs: 1 });
    await page.connect();
    const buttonsNamed = (text) => doc.querySelectorAll('button').filter((node) => node.textContent === text);
    for (const name of ['Hold week', 'Extend week', 'Pause payouts', 'Block', 'Unblock']) assert.equal(buttonsNamed(name)[0]?.disabled, true, name);
    assert.equal(buttonsNamed('Approve and fund')[0]?.disabled, false);
    assert.match(visibleText(doc.getElementById('jo-roles')), /admin pause off, operator pause off/);
    assert.match(visibleText(doc.getElementById('jo-week')), /Closes.+ · \d{4}-\d{2}-\d{2} 00:00 UTC \(in 12 d 23 h\)Settle cutoff/, 'the first week closes in 12 d 23 h of chain time');
    assert.match(visibleText(doc.getElementById('jo-fund')), /minimum fund 100 tCHIKUN/);
    assert.equal(doc.getElementById('jackpot-rubric-list').querySelectorAll('li').length, 6);
    for (const [action, params] of [['clear', { sessionId: `0x${'ab'.repeat(32)}` }], ['pause', {}], ['hold', { week: W }], ['block', { wallet: wallets.attacker.address, reason: 'cheating' }], ['adminSubmit', { sessionId: `0x${'ab'.repeat(32)}` }]]) {
      await stranger.controller.act(action, params);
      assert.match(stranger.controller.state.message, /Only the jackpot admin/, action);
    }
    assert.deepEqual(stranger.ethereum.sent, [], 'no admin transaction ever reaches the wallet');

    // Anyone funds: an exact approve, then fund; below the minimum or too far ahead is refused.
    const funder = await derivedFixtureWallet(provider, 21);
    await (await deployed.token.connect(wallets.operator).mint(funder.address, 1_000n * TOKEN)).wait();
    const funding = await controllerFor(funder.address);
    await funding.controller.connect();
    const current = funding.controller.state.currentWeek;
    assert.equal(current, W - 1, 'set up the week before the first jackpot week');
    await funding.controller.act('fund', { week: current, amount: '150' });
    assert.match(funding.controller.state.message, /Fund the current week or a later one/, 'nothing before firstWeek');
    await funding.controller.act('fund', { week: W, amount: '50' });
    assert.match(funding.controller.state.message, /below the week's minimum fund\. Nothing was sent\./);
    await funding.controller.act('fund', { week: current + 9, amount: '150' });
    assert.match(funding.controller.state.message, /at most 8 weeks ahead/);
    await funding.controller.act('fund', { week: W, amount: '5000' });
    assert.match(funding.controller.state.message, /The wallet holds less than that/);
    assert.deepEqual(funding.ethereum.sent, []);
    await funding.controller.act('fund', { week: W, amount: '150' });
    assert.equal(funding.controller.state.phase, 'ready', funding.controller.state.message);
    assert.deepEqual(sentMethods(funding.ethereum), ['approve', 'fund']);
    assert.deepEqual(TOKEN_IFACE.decodeFunctionData('approve', funding.ethereum.sent[0].data).map(String), [ethers.getAddress(deployment.instances.chikun.address), String(150n * TOKEN)], 'approve exactly the amount');
    assert.equal((await deployed.jackpot.potOf(W)).funded, 150n * TOKEN);
    assert.match(funding.controller.state.message, /Fund confirmed: 0x[0-9a-f]{64}\. Week \d{4}-W\d{2} pot is now 150 tCHIKUN; its prize would be 150 tCHIKUN\./, 'the resulting pot and prize');
    assert.equal(await deployed.token.allowance(funder.address, deployment.instances.chikun.address), 0n, 'nothing left approved');
    assert.match(funding.controller.state.lastTx.url, /^https:\/\/liteforge\.explorer\.caldera\.xyz\/tx\/0x[0-9a-f]{64}$/);
    // Every write is priced like a player transaction: 10 x the base fee (5 gwei floor), no tip.
    for (const tx of funding.ethereum.sent) {
      assert.equal(tx.maxPriorityFeePerGas, '0x0');
      assert.ok(BigInt(tx.maxFeePerGas) >= 5_000_000_000n);
      assert.equal(tx.chainId, '0x1159');
    }

    // The admin sees the same page with its actions enabled.
    const owner = await controllerFor(admin);
    await owner.controller.connect();
    assert.equal(owner.controller.state.isAdmin, true);
    assert.match(owner.controller.state.message, /You are the jackpot admin/);
    await owner.controller.act('pause');
    assert.equal(await deployed.jackpot.adminPaused(), true);
    await owner.controller.act('pause');
    assert.match(owner.controller.state.message, /already on/, 'the state read comes first');
    await owner.controller.act('unpause');
    assert.equal(await deployed.jackpot.adminPaused(), false);
  } finally {
    await chain.revert(snapshot);
  }
});

test('owner jackpot page actions change the local chain as named', async () => {
  const snapshot = await chain.snapshot();
  try {
    const jackpot = deployed.jackpot;
    const keeper = deployed.wallets.keeper;
    const p3 = deployed.wallets.player3;
    const start = weekStartOf(W);
    const close = start + WEEK;
    const play = async (player, score, openAt) => (await settleLocalRun({ provider, record: suite, player, relayer: wallets.relayer, verifierKey: keys.verifier, score: BigInt(score), openAt })).sessionId;
    await at(start + HOUR);
    const s1 = await play(wallets.player1, 900, start + 2 * HOUR);
    const s2 = await play(wallets.player2, 800, start + 3 * HOUR);
    const s3 = await play(p3, 700, start + 4 * HOUR);
    const funder = await derivedFixtureWallet(provider, 22);
    await (await deployed.token.connect(wallets.operator).mint(funder.address, 10_000n * TOKEN)).wait();
    await (await deployed.token.connect(funder).approve(await jackpot.getAddress(), 1_000n * TOKEN)).wait();
    await (await jackpot.connect(funder).fund(W, 1_000n * TOKEN)).wait();
    await at(close + 2 * HOUR);
    for (const id of [s1, s2]) await (await jackpot.connect(keeper).submitCandidate(id)).wait();
    await (await jackpot.connect(keeper).clear(s1)).wait();

    const owner = await controllerFor(wallets.developer.address);
    await owner.controller.connect();
    assert.equal(owner.controller.state.week.index, W, 'the page opens on the latest closed week');
    assert.deepEqual(owner.controller.state.week.candidates.map((row) => [row.sessionId, row.review]), [[s1.toLowerCase(), 'cleared'], [s2.toLowerCase(), 'none']]);
    const act = async (action, params) => {
      await owner.controller.act(action, params);
      assert.equal(owner.controller.state.phase, 'ready', `${action}: ${owner.controller.state.message}`);
    };
    await act('flag', { sessionId: s2, reason: 'screen-hold' });
    assert.equal(Number(await jackpot.reviewOf(s2)), 2);
    assert.equal(await jackpot.adminReviewed(s2), true, 'an admin decision locks the keeper out');
    await act('clear', { sessionId: s2 });
    assert.equal(Number(await jackpot.reviewOf(s2)), 1);
    await act('disqualify', { sessionId: s1, wholeWalletForWeek: false, reason: 'automation' });
    assert.equal(Number(await jackpot.reviewOf(s1)), 3);
    assert.deepEqual((await jackpot.candidatesOf(W)).map((row) => row.sessionId), [s2]);
    await owner.controller.act('clear', { sessionId: s1 });
    assert.match(owner.controller.state.message, /Reinstate it before clearing/);
    // After the candidate window: adminSubmit skips WINDOW_CLOSED (checkEligibility shown first).
    await at(close + 13 * HOUR);
    assert.equal((await jackpot.checkEligibility(s3)).reason, 'WINDOW_CLOSED');
    await act('adminSubmit', { sessionId: s3 });
    assert.deepEqual((await jackpot.candidatesOf(W)).map((row) => row.sessionId), [s2, s3]);
    await act('reinstate', { sessionId: s1 });
    assert.equal(Number(await jackpot.reviewOf(s1)), 0);
    assert.deepEqual((await jackpot.candidatesOf(W)).map((row) => row.sessionId), [s1, s2, s3], 'a listed session returns to its place');
    await act('clear', { sessionId: s1 });
    await act('block', { wallet: p3.address, reason: 'cheating' });
    assert.equal(await jackpot.blocked(p3.address), true);
    await act('unblock', { wallet: p3.address, reason: 'other' });
    assert.equal(await jackpot.blocked(p3.address), false);
    await act('hold', { week: W, reason: 'investigation' });
    assert.equal((await jackpot.weekState(W)).held, true);
    await act('release', { week: W });
    assert.equal((await jackpot.weekState(W)).held, false);
    await act('extend', { week: W, extraSeconds: HOUR });
    assert.equal(Number((await jackpot.weekState(W)).extension), HOUR);
    // Finalize: refused before the payout time, then any wallet finalizes; the cleared leader is paid.
    const anyone = await controllerFor(wallets.attacker.address);
    await anyone.controller.connect();
    await anyone.controller.selectWeek(W);
    await anyone.controller.act('finalize', { week: W });
    assert.match(anyone.controller.state.message, /Payout is due/);
    await at(close + 24 * HOUR + HOUR);
    const before = await deployed.token.balanceOf(wallets.player1.address);
    await anyone.controller.act('finalize', { week: W });
    assert.equal(anyone.controller.state.phase, 'ready', anyone.controller.state.message);
    const state = await jackpot.weekState(W);
    assert.deepEqual([Number(state.status), state.winner], [1, wallets.player1.address]);
    assert.equal(await deployed.token.balanceOf(wallets.player1.address), before + 1_000n * TOKEN);
    assert.equal(anyone.controller.state.week.state.status, 'paid', 'the page refreshed');

    // Refund after a scheduled end: a funder takes back a week after the end.
    const current = Number(await jackpot.currentWeek());
    await (await deployed.token.connect(funder).approve(await jackpot.getAddress(), 200n * TOKEN)).wait();
    await (await jackpot.connect(funder).fund(current + 2, 200n * TOKEN)).wait();
    await (await jackpot.connect(wallets.operator).scheduleEnd(current + 1)).wait();
    await at(weekStartOf(current + 2) + HOUR);
    const refunding = await controllerFor(funder.address);
    await refunding.controller.connect();
    await refunding.controller.selectWeek(current + 2);
    const held = await deployed.token.balanceOf(funder.address);
    await refunding.controller.act('refund', { week: current + 2 });
    assert.equal(refunding.controller.state.phase, 'ready', refunding.controller.state.message);
    assert.equal(await deployed.token.balanceOf(funder.address), held + 200n * TOKEN);
    assert.deepEqual(sentMethods(refunding.ethereum), ['refundAfterEnd']);
  } finally {
    await chain.revert(snapshot);
  }
});

test('owner jackpot page lets the connected winner claim a claim-pending prize', async () => {
  const snapshot = await chain.snapshot();
  try {
    const mock = await deployMockToken('BlacklistToken', [], wallets.operator);
    const current = weekIndexOf(await chain.latestTimestamp());
    const other = await deployLocalJackpot({ provider, wallets, record: suite, token: await mock.getAddress(), firstWeek: current + 1, rules: { ...launchRules(suite), adminClearOnly: false } });
    const week = other.record.instances.chikun.firstWeek;
    const start = weekStartOf(week);
    const funder = await derivedFixtureWallet(provider, 23);
    await (await mock.mint(funder.address, 10_000n * TOKEN)).wait();
    await (await mock.connect(funder).approve(await other.jackpot.getAddress(), 500n * TOKEN)).wait();
    await (await other.jackpot.connect(funder).fund(week, 500n * TOKEN)).wait();
    const { sessionId } = await settleLocalRun({ provider, record: suite, player: wallets.player2, relayer: wallets.relayer, verifierKey: keys.verifier, score: 1_000n, openAt: start + HOUR });
    await at(start + WEEK + 2 * HOUR);
    await (await other.jackpot.connect(other.wallets.keeper).submitCandidate(sessionId)).wait();
    await (await other.jackpot.connect(other.wallets.keeper).clear(sessionId)).wait();
    await (await mock.setBlacklisted(wallets.player2.address, true)).wait();
    await at(start + WEEK + 24 * HOUR);
    await (await other.jackpot.connect(wallets.attacker).finalize(week)).wait();
    assert.equal((await other.jackpot.weekState(week)).unclaimed, 500n * TOKEN, 'claim-pending');

    const otherDeployment = jackpotModuleValue(other.record);
    const stranger = await controllerFor(wallets.player1.address, { forDeployment: otherDeployment });
    await stranger.controller.connect();
    await stranger.controller.selectWeek(week);
    await stranger.controller.act('claim', { week, to: wallets.player1.address });
    assert.match(stranger.controller.state.message, /Only the winner/);
    assert.deepEqual(stranger.ethereum.sent, []);
    const winner = await controllerFor(wallets.player2.address, { forDeployment: otherDeployment });
    await winner.controller.connect();
    await winner.controller.selectWeek(week);
    const to = deployed.wallets.player3.address;
    await winner.controller.act('claim', { week, to });
    assert.equal(winner.controller.state.phase, 'ready', winner.controller.state.message);
    assert.equal(await mock.balanceOf(to), 500n * TOKEN);
    assert.equal((await other.jackpot.weekState(week)).unclaimed, 0n);
    assert.deepEqual(JACKPOT_IFACE.decodeFunctionData('claim', winner.ethereum.sent[0].data).map(String), [String(week), to]);
  } finally {
    await chain.revert(snapshot);
  }
});

test('owner jackpot page draws the server timeline without the runtime', async () => {
  // The model reads the jackpot-server review payload (server/jackpot/review-model.mjs field names):
  // sessionId32, chainRank, listing, soft { code: { value, on } }, provenance.status, features, recentRuns.
  const review = normalizeReview(reviewFixture);
  const [cleared, flagged, disqualified] = review.candidates;
  assert.equal(review.candidates.length, 3);
  assert.deepEqual(review.nextEligible.map((row) => [row.sessionId, row.screen]), [[`0x${'d4'.repeat(32)}`, 'unscreened'], [`0x${'e5'.repeat(32)}`, 'pass']]);
  assert.deepEqual([cleared.sessionId, cleared.rank, cleared.survivalSeconds, cleared.evidenceDelaySeconds, cleared.seedProvenance], [`0x${'a1'.repeat(32)}`, 1, 690, 42, 'ok']);
  assert.deepEqual(cleared.softSignals.map((item) => [item.code, item.value]), [['S1', 3]], 'only the soft signals that are on');
  assert.equal(cleared.replay, `/api/jackpot/replay?session=0x${'a1'.repeat(32)}`, 'the replay path of the session');
  assert.equal(cleared.history.length, 2);
  assert.deepEqual(flagged.holdCodes.map((item) => item.code), ['H2', 'H9']);
  assert.match(flagged.holdCodes[1].text, /Late evidence/);
  assert.deepEqual(flagged.softSignals.map((item) => item.code), ['S8']);
  assert.match(flagged.softSignals[0].text, /before the obstacle was visible/);
  assert.deepEqual([disqualified.listing, disqualified.seedProvenance, disqualified.timeline, disqualified.review, disqualified.adminReviewed], ['disqualified', 'missing', null, 'disqualified', true]);
  // The design-document spellings still read (sessionId, rank, softSignals, seedProvenance, flapTicks).
  const legacy = normalizeReview({ ok: true, candidates: [{ sessionId: `0x${'f6'.repeat(32)}`, wallet: `0x${'f6'.repeat(20)}`, rank: 3, review: 2, softSignals: [{ code: 'S9', value: 700 }], evidenceDelaySeconds: 700, seedProvenance: 'ok', timeline: { survivalTicks: 600, altitude: [300], flapTicks: [10, 70], obstacles: [{ visibleTick: 200, commitTick: 150 }] } }] });
  const [old] = legacy.candidates;
  assert.deepEqual([old.rank, old.review, old.softSignals[0].code, old.timeline.flapTicks.length, timelineGeometry(old.timeline).lookAheadCount], [3, 'flagged', 'S9', 2, 1]);
  // The timeline of reviewTimeline(): flaps rebuilt from firstFlapTick + intervals; the look-ahead
  // overlay is the server's unexplained verdict.
  const raw = reviewFixture.candidates[1].timeline;
  assert.equal(flagged.timeline.flapTicks.length, raw.intervals.length + 1);
  assert.equal(flagged.timeline.flapTicks.at(-1), raw.firstFlapTick + raw.intervals.reduce((sum, value) => sum + value, 0));
  const geometry = timelineGeometry(flagged.timeline);
  assert.equal(geometry.lookAheadCount, 3);
  assert.equal(geometry.flaps.length, flagged.timeline.flapTicks.length);
  assert.equal(geometry.viewBox, '0 0 720 180');
  assert.ok(geometry.altitude.startsWith('M0 '));
  assert.equal(timelineGeometry(null), null);
  assert.equal(normalizeReview({ ok: false }), null);

  // The page never imports the Chikun runtime, chikun-cabinet.mjs or anything that imports
  // obstacle-shapes.json (they cannot load unbundled), and every module it loads is served from the
  // portal web root.
  const graph = ownerImportGraph();
  assert.ok(graph.some((file) => file.endsWith('jackpot-review-model.mjs')) && graph.some((file) => file.endsWith('ethers.min.js')));
  for (const file of graph) {
    assert.ok(file.startsWith(portalRoot + sep), `${file} is inside apps/portal`);
    // A module importing obstacle-shapes.json would put it in the graph, so the resolved paths suffice.
    assert.doesNotMatch(file, /[\\/]chikun[\\/]|chikun-cabinet|obstacle-shapes/, file);
  }

  // The page: sign in through the existing session flow (nonce, personal_sign, POST /api/session), then
  // read the review with the Bearer token and draw each candidate's timeline as SVG.
  const admin = wallets.developer;
  const requests = [];
  const fetchImpl = async (url, init = {}) => {
    requests.push({ url, init });
    const reply = (status, body) => ({ ok: status < 300, status, json: async () => body });
    if (url === '/api/session/nonce') return reply(200, { ok: true, nonce: 'ab'.repeat(36), issuedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 600_000).toISOString() });
    if (url === '/api/session') {
      const { challenge, signature } = JSON.parse(init.body);
      assert.equal(ethers.verifyMessage(challenge.message, signature).toLowerCase(), admin.address.toLowerCase(), 'the wallet signed the SIWE message');
      assert.equal(challenge.chainId, 4441);
      assert.equal(challenge.domain, 'lestersarcade.io');
      return reply(200, { ok: true, wallet: admin.address.toLowerCase(), token: 'fixture-session-token', expiresAt: null });
    }
    if (url.startsWith('/api/jackpot/review?week=')) {
      if (init.headers?.authorization !== 'Bearer fixture-session-token') return reply(401, { ok: false, error: 'invalid-session' });
      return reply(200, reviewFixture);
    }
    throw new Error(`unexpected request ${url}`);
  };
  const doc = ownerDocument();
  const ethereum = fakeEthereum({ address: admin.address, key: keys.developer });
  const controller = mountJackpotOwnerPage(doc, { ethereum }, { deployment: jackpotModuleValue(null), fetchImpl, domain: 'lestersarcade.io', now: () => Date.parse('2026-10-06T12:00:00.000Z'), loadEthers: () => ethers, createReadProvider: () => provider });
  assert.match(visibleText(doc.getElementById('jo-status')), /not deployed yet/);
  await controller.connect();
  await controller.signIn();
  await flush(5);
  assert.equal(controller.state.review.candidates.length, 3, controller.state.message);
  const reviewCall = requests.find((call) => call.url.startsWith('/api/jackpot/review'));
  assert.equal(reviewCall.url, '/api/jackpot/review?week=2026-W40', 'the latest closed week');
  assert.equal(reviewCall.init.cache, 'no-store');
  const cards = doc.getElementById('jo-candidates').querySelectorAll('article');
  assert.equal(cards.length, 3);
  const svgs = doc.getElementById('jo-candidates').querySelectorAll('svg');
  assert.equal(svgs.length, 2, 'two candidates carry a timeline; the third says so');
  assert.equal(svgs[1].getAttribute('aria-label'), `Flap timeline of ${reviewFixture.candidates[1].sessionId32.slice(0, 10)}: 3 look-ahead commitments`);
  assert.equal(svgs[1].querySelectorAll('circle.jo-lookahead').length, 3);
  assert.equal(svgs[1].querySelectorAll('rect.jo-fast-changed').length, 1);
  const text = visibleText(doc.getElementById('jo-candidates'));
  assert.match(text, /Late evidence/);
  assert.match(text, /Evidence delay1500 s/);
  assert.match(text, /Seed provenancemissing/);
  assert.match(text, /disqualified · admin-reviewed/);
  assert.match(text, /Ranknot listed \(disqualified\)/);
  assert.match(text, /Soft signalsS1 The wallet's first Ranked run is less than 7 days old\. \(3\)/);
  assert.match(text, /Keeper actionssubmit confirmed tx · clear confirmed tx/);
  assert.match(text, /Recent runs51022 pts, 690 s, 2026-W40 · 41010 pts, 540 s, 2026-W39/);
  const links = doc.getElementById('jo-candidates').querySelectorAll('a').map((anchor) => anchor.getAttribute('href'));
  const replayPath = `/api/jackpot/replay?session=${reviewFixture.candidates[0].sessionId32}`;
  assert.ok(links.includes(`/chikun/index.html?replay=${encodeURIComponent(replayPath)}`), 'Watch in cabinet');
  assert.ok(links.includes(replayPath), 'Download replay');
  assert.ok(links.includes(`https://liteforge.explorer.caldera.xyz/tx/0x${'c2'.repeat(32)}`), 'keeper action explorer link');
  assert.ok(links.filter((href) => href === '#jackpot-rubric').length >= 6, 'a rubric link next to every Clear and Disqualify');
  assert.equal(doc.getElementById('jackpot-rubric-list').querySelectorAll('li').length, 6);
  assert.match(visibleText(doc.getElementById('jo-next')), /Add to list/);
  // Without a contract nothing is sendable, and the page imported no runtime (checked above).
  assert.deepEqual(ethereum.sent, []);
  const standalone = renderTimeline(doc, reviewFixture.candidates[0].timeline);
  assert.equal(standalone.tagName.toLowerCase(), 'svg');
  assert.equal(standalone.querySelectorAll('circle.jo-lookahead').length, 0);
  // A refused session (403 not-admin) shows why and keeps no review data.
  const refused = createJackpotOwnerController({ ethereum: fakeEthereum({ address: wallets.player1.address, key: keys.player1 }), deployment: jackpotModuleValue(null), loadEthers: () => ethers, domain: 'lestersarcade.io', fetchImpl: async (url, init) => {
    if (url === '/api/session') return { ok: true, status: 200, json: async () => ({ ok: true, wallet: wallets.player1.address.toLowerCase(), token: 't' }) };
    if (url.startsWith('/api/jackpot/review')) return { ok: false, status: 403, json: async () => ({ ok: false, error: 'not-admin' }) };
    return fetchImpl(url, init);
  } });
  await refused.connect();
  await refused.signIn();
  assert.equal(refused.state.review, null);
  assert.match(refused.state.message, /not the on-chain jackpot admin/);
});
