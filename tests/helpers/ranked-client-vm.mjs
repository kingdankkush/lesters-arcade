// Runs the real ranked-client glue of apps/portal/main.js inside a VM context
// with injected collaborators (the pattern of tests/hmh-chain-hydration-
// provenance.test.mjs): the functions are sliced out of the portal source, so
// the tests exercise the shipped code, not a rewritten model.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { parse } from 'acorn';

import * as achievementStats from '../../apps/portal/src/achievements/stats.mjs';
import * as rankedIdentityModule from '../../apps/portal/src/ranked-identity.mjs';
import * as rankedSettlementModule from '../../apps/portal/src/ranked-settlement.mjs';
import { applySettlement, createInitialArcadeState, recordScore, resolveDisplayName } from '../../apps/portal/src/arcade-core.mjs';
import { appendRunRecord } from '../../apps/portal/src/persistence.mjs';
import { finalizeSessionEvidence, recordSessionEvent } from '../../apps/portal/src/session-integrity.mjs';
import { LITVM_CONTRACT_ADDRESSES } from '../../apps/portal/src/settlement.mjs';

export const PORTAL_MAIN = readFileSync(new URL('../../apps/portal/main.js', import.meta.url), 'utf8');
export const PORTAL_AST = parse(PORTAL_MAIN, { ecmaVersion: 'latest', sourceType: 'module' });

export const RANKED_GLUE_FUNCTIONS = Object.freeze([
  'recordCurrentSessionEvent', 'currentCanonicalSessionIdentity', 'currentCanonicalFinalState', 'finalizeCurrentSessionEvidence',
  'legacyHmhRecordInputs', 'rankedLocalStats', 'submitCombatGameOver', 'retryPublishGameOver', 'rankedPublishRetryAvailable',
  'settleRankedRun', 'settleChikunRankedRun', 'settleStackedRankedRun', 'importWithRetry', 'startRankedSettlement',
  'trackRankedSettlement', 'captureRankedResultContext', 'rankedRunContext', 'rankedRunActions', 'applyRankedPublication',
  'resetRankedRunState',
]);

export function findNode(root, predicate) {
  if (!root || typeof root !== 'object') return null;
  if (predicate(root)) return root;
  for (const value of Object.values(root)) {
    if (!value || typeof value !== 'object') continue;
    const found = findNode(value, predicate);
    if (found) return found;
  }
  return null;
}

export function portalFunctionSource(name) {
  const node = PORTAL_AST.body.find((item) => item.type === 'FunctionDeclaration' && item.id.name === name);
  if (!node) throw new Error(`main.js has no top-level function ${name}`);
  return PORTAL_MAIN.slice(node.start, node.end);
}

// Declares the named top-level functions together (so they call each other)
// and exposes them on the context as well.
export function loadPortalFunctions(names, context) {
  const code = `(() => {\n${names.map(portalFunctionSource).join('\n')}\nreturn { ${names.join(', ')} };\n})()`;
  const fns = vm.runInNewContext(code, context);
  Object.assign(context, fns);
  return fns;
}

// A callback property of the first object argument of `factory({...})`.
export function portalCallback(factory, property, context) {
  const call = findNode(PORTAL_AST, (node) => node.type === 'CallExpression' && node.callee?.name === factory);
  const prop = call?.arguments?.[0]?.properties?.find((node) => node.key?.name === property);
  if (!prop) throw new Error(`${factory}({ ${property} }) is missing from main.js`);
  const source = prop.method ? `({ ${PORTAL_MAIN.slice(prop.start, prop.end)} }).${property}` : `(${PORTAL_MAIN.slice(prop.value.start, prop.value.end)})`;
  return vm.runInContext(source, context);
}

export function memoryStorage() {
  const data = new Map();
  return { data, getItem: (key) => (data.has(key) ? data.get(key) : null), setItem: (key, value) => { data.set(key, String(value)); }, removeItem: (key) => { data.delete(key); } };
}

// The portal globals the ranked glue reads, with the real arcade modules and
// a spy on every network path. `fetch` is the global the result-context
// capture uses; the settlement client gets its own fetchImpl.
export function rankedGlueContext({ live = false, hosted = false, session = null, fetchImpl = null, clientFetch = null, storage = memoryStorage(), token = 'fixture-token' } = {}) {
  const events = [];
  const errors = [];
  const calls = { startOfficialMode: [], setOfficialView: [], exitToArcade: 0, clearCheckpoint: [], globalFetch: [], clientFetch: [] };
  const record = (bucket, impl) => async (url, init = {}) => {
    bucket.push({ url: String(url), method: init.method ?? 'GET', headers: { ...(init.headers ?? {}) }, cache: init.cache, body: init.body ? JSON.parse(init.body) : null });
    if (!impl) throw new Error(`unexpected network request ${init.method ?? 'GET'} ${url}`);
    return impl(url, init);
  };
  const client = rankedSettlementModule.createRankedSettlementClient({
    live,
    fetchImpl: record(calls.clientFetch, clientFetch),
    getToken: () => token,
    storage,
    setTimeoutImpl: () => 0,
    clearTimeoutImpl: () => {},
    onPublished: (snapshot) => context.applyRankedPublication(snapshot),
  });
  const context = {
    console: { log() {}, info() {}, debug() {}, warn() {}, error: (...args) => errors.push(args) },
    setTimeout, clearTimeout,
    state: createInitialArcadeState(),
    combat: { gameOver: true, gameOverSubmitted: false, score: 0, kills: 0, elapsedGameSeconds: 0, frame: 0, killsByType: {}, collectedPowerUpTypes: [] },
    currentSession: session,
    connectedWallet: session?.wallet ?? null,
    lastHmhRunSummary: null, lastCompletedSession: null, lastRunResult: null, lastRunScore: 0, lastRunElapsedSeconds: 0, lastBossId: null,
    lastRunPreviousBestScore: 0, sessionRunStreak: 0, lastSettlementQueued: false, lastSettlementInput: null, lastRunStatsForSettlement: null,
    lastSettlementError: null, lastSettlementSucceeded: false, lastSettlementHandle: null, lastSettlementUnsubscribe: null,
    rankedResultContexts: new Map(), rankedRunsHandedOff: new WeakSet(),
    SETTLEMENT_LIVE: live, HOSTED_PROFILE_SYNC: hosted, LITVM_CONTRACT_ADDRESSES,
    achievementStats, rankedIdentityModule,
    recordScore, applySettlement, resolveDisplayName, appendRunRecord, finalizeSessionEvidence, recordSessionEvent,
    clearActiveSessionCheckpoint: (_state, sessionId, options) => calls.clearCheckpoint.push({ sessionId, ...options }),
    saveActiveSessionCheckpoint: () => {},
    persistArcadeStateSoon: () => {}, submitGameRun: () => {},
    renderOfficialRunStatus: () => {}, renderGameOverSummary: () => {}, renderCombatMenuActionGrid: () => {},
    renderOfficialLeaderboards: () => {}, renderOfficialProfile: () => {},
    currentPlayerBestScoreForMode: () => 0,
    officialAppStep: 'gameplay',
    dom: { combatStatus: { textContent: '' }, officialGameStateCopy: { textContent: '' } },
    rankedSettlementClient: () => Promise.resolve({ client, module: rankedSettlementModule }),
    // main.js's loadRankedRequests() is a dynamic import(); the VM has no module loader.
    loadRankedRequests: () => { calls.loadRankedRequests = (calls.loadRankedRequests ?? 0) + 1; return import('../../apps/portal/src/ranked-requests.mjs'); },
    fetch: record(calls.globalFetch, fetchImpl),
    window: { dispatchEvent: (event) => { events.push(event); return true; } },
    CustomEvent: class CustomEvent { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } },
    startOfficialMode: (mode) => { calls.startOfficialMode.push(mode); return Promise.resolve(); },
    setOfficialView: (view) => { calls.setOfficialView.push(view); },
    exitToArcade: () => { calls.exitToArcade += 1; },
  };
  loadPortalFunctions(RANKED_GLUE_FUNCTIONS, context);
  return { context, client, events, errors, calls, storage };
}

export async function until(predicate, { timeoutMs = 2000 } = {}) {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > timeoutMs) throw new Error('condition not reached');
    await new Promise((resolve) => setImmediate(resolve));
  }
}
