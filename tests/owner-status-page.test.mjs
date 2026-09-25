// Owner page apps/portal/owner/status.{html,mjs} (ops-health AC4): it reads /api/health and shows
// the numbers with plain warnings. Pure warning rules and formatting, CSP and noindex rules, the fetch
// handling, and the full render through a minimal DOM.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';
import { readQueueHealth } from '../server/ops/health.mjs';
import { REQUEUE_CONFIRM, parseRequeueArgs, runRequeueDeadLetters } from '../scripts/requeue-dead-letters.mjs';
import { createPgliteClient, seedVerifiedSession } from './helpers/pglite-client.mjs';
import {
  EDGE_CACHE_SECONDS,
  EXPLORER_URL,
  HEALTH_URL,
  REFRESH_MS,
  REQUEUE_APPLY_COMMAND,
  REQUEUE_DRY_RUN_COMMAND,
  STATUS_THRESHOLDS,
  ageSeconds,
  createStatusController,
  explorerAddressUrl,
  formatDuration,
  formatWhen,
  formatZkltc,
  healthWarnings,
  loadHealth,
  mountStatusPage,
} from '../apps/portal/owner/status.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const html = readFileSync(join(root, 'apps', 'portal', 'owner', 'status.html'), 'utf8');
const pageModule = readFileSync(join(root, 'apps', 'portal', 'owner', 'status.mjs'), 'utf8');
const RELAYER = '0x494af36ea4958c417260faf3efb3b672b343eaf6';
const IDS = ['owner-status-page', 'status-summary', 'status-warnings', 'status-refresh', 'status-loaded', 'status-service', 'status-relayer', 'status-queue', 'status-index', 'status-cron-index-chain', 'status-cron-settle-retry'];

// A healthy /api/health report (the shape api/health.mjs answers).
function healthyReport(overrides = {}) {
  const base = {
    ok: true,
    healthy: true,
    version: '1.8.0',
    checkedAt: '2026-09-24T18:00:00.000Z',
    settlementReady: true,
    paused: false,
    degraded: false,
    degradedParts: [],
    relayer: { address: RELAYER, balanceWei: '1000000000000000000', allowed: true, estimatedSettlesLeft: 1403 },
    queue: { pending: 0, signed: 0, submitted: 1, failed: 0, dead: 0, deadRequeueable: 0, oldestUnconfirmedAgeSeconds: 40 },
    index: { cursorBlock: 54_229_000, headBlock: 54_230_000, lagBlocks: 1000 },
    crons: {
      indexChain: { lastOkAt: '2026-09-24T17:58:00.000Z', lastErrorAt: null, lastErrorCode: null, runs: 12, failures: 0 },
      settleRetry: { lastOkAt: '2026-09-24T17:59:30.000Z', lastErrorAt: '2026-09-24T17:40:00.000Z', lastErrorCode: 'rpc-timeout', runs: 60, failures: 1 },
    },
    baseFeeGwei: 1.5,
  };
  return {
    ...base,
    ...overrides,
    relayer: { ...base.relayer, ...(overrides.relayer ?? {}) },
    queue: { ...base.queue, ...(overrides.queue ?? {}) },
    index: { ...base.index, ...(overrides.index ?? {}) },
    crons: {
      indexChain: { ...base.crons.indexChain, ...(overrides.crons?.indexChain ?? {}) },
      settleRetry: { ...base.crons.settleRetry, ...(overrides.crons?.settleRetry ?? {}) },
    },
  };
}

const ids = (report) => healthWarnings(report).map((warning) => warning.id);

function moduleImports(source) {
  const specifiers = [];
  const visit = (node) => {
    if (!node || typeof node.type !== 'string') return;
    if ((node.type === 'ImportDeclaration' || node.type === 'ImportExpression' || node.type === 'ExportNamedDeclaration' || node.type === 'ExportAllDeclaration') && node.source) specifiers.push(node.source.value ?? '<dynamic>');
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') visit(value);
    }
  };
  visit(parse(source, { ecmaVersion: 'latest', sourceType: 'module' }));
  return specifiers;
}

test('the status page is noindex, CSP-safe, module-only and read-only', () => {
  assert.match(html, /<meta name="robots" content="noindex" \/>/);
  assert.match(html, /<meta name="referrer" content="no-referrer" \/>/);
  assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1" \/>/);
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  assert.equal(scripts.length, 1, 'exactly one script tag');
  assert.match(scripts[0][1], /\btype="module"/);
  assert.match(scripts[0][1], /\bsrc="\.\/status\.mjs"/);
  assert.equal(scripts[0][2].trim(), '', 'no inline script');
  assert.doesNotMatch(html, /\son[a-z]+\s*=/i, 'no inline event handlers');
  assert.doesNotMatch(html, /javascript:/i);
  assert.doesNotMatch(html, /(?:src|href)="(?:https?:)?\/\//i, 'no cross-origin resources');
  assert.doesNotMatch(html, /<link[^>]+rel="stylesheet"/i, 'styles are inline only');
  for (const id of IDS) assert.match(html, new RegExp(`id="${id}"`), id);
  assert.match(html, /id="status-summary" role="status" aria-live="polite"/);

  assert.doesNotMatch(pageModule, /\.innerHTML\s*=|\.outerHTML\s*=|insertAdjacentHTML|\beval\s*\(|new Function\s*\(|document\.write/);
  assert.deepEqual(moduleImports(pageModule), [], 'no imports: nothing but the page and /api/health');
  assert.doesNotMatch(pageModule, /privateKey|mnemonic|eth_sign\b|personal_sign|signTypedData|eth_sendTransaction|window\.ethereum|localStorage/, 'never touches keys, wallets or storage');
  assert.equal(HEALTH_URL, '/api/health');
  assert.equal(REFRESH_MS, 60_000);

  // The portal CSP Vercel applies to /owner/status.html allows the module, the same-origin fetch and the style block.
  const vercel = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8'));
  let csp = null;
  for (const rule of vercel.headers ?? []) {
    let matches = false;
    try {
      matches = new RegExp(`^${rule.source}$`).test('/owner/status.html');
    } catch {
      matches = false;
    }
    const header = matches ? (rule.headers ?? []).find((entry) => entry.key.toLowerCase() === 'content-security-policy') : null;
    if (header) csp = header.value;
  }
  assert.ok(csp, 'a CSP applies to the owner page');
  const directive = (name) => (csp.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name} `)) ?? '').split(/\s+/).slice(1);
  assert.ok(directive('script-src').includes("'self'"));
  assert.ok(directive('connect-src').includes("'self'"), '/api/health is same-origin');
  const styleBlock = html.match(/<style>([\s\S]*?)<\/style>/)[1];
  const styleHash = `'sha256-${createHash('sha256').update(styleBlock, 'utf8').digest('base64')}'`;
  const styleSrc = directive('style-src').length > 0 ? directive('style-src') : directive('default-src');
  assert.ok(styleSrc.includes("'unsafe-inline'") || styleSrc.includes(styleHash));
});

test('the layout is built for a 320 px phone', () => {
  const style = html.match(/<style>([\s\S]*?)<\/style>/)[1];
  assert.match(style, /@media \(max-width: 420px\)/, 'a narrow-screen layout');
  assert.match(style, /minmax\(min\(100%, 320px\), 1fr\)/, 'sections never force a column wider than the screen');
  assert.match(style, /overflow-wrap: anywhere/, 'addresses and codes wrap');
  for (const [, value] of style.matchAll(/(?<![a-z-])(?:width|min-width):\s*(\d+)px/g)) assert.ok(Number(value) <= 320, `no fixed width over 320 px (${value}px)`);
});

test('a healthy report has no warnings', () => {
  assert.deepEqual(healthWarnings(healthyReport()), []);
  assert.deepEqual(healthWarnings(null), []);
});

test('each threshold warns just past its limit', () => {
  const { minSettlesLeft, maxOldestUnconfirmedSeconds, maxIndexLagBlocks } = STATUS_THRESHOLDS;
  assert.deepEqual([minSettlesLeft, maxOldestUnconfirmedSeconds, maxIndexLagBlocks], [50, 600, 20_000]);
  assert.deepEqual(ids(healthyReport({ relayer: { estimatedSettlesLeft: 50 } })), []);
  assert.deepEqual(ids(healthyReport({ relayer: { estimatedSettlesLeft: 49 } })), ['relayer-low']);
  assert.match(healthWarnings(healthyReport({ relayer: { estimatedSettlesLeft: 49 } }))[0].text, new RegExp(`about 49 more settles .*Settles stop a little before this reaches 0.*Send testnet zkLTC to ${RELAYER}`));
  // No estimate (a zero base fee): only an empty balance warns, and a zero estimate is relayer-low, not both.
  assert.deepEqual(ids(healthyReport({ relayer: { estimatedSettlesLeft: null, balanceWei: '0' } })), ['relayer-empty']);
  assert.match(healthWarnings(healthyReport({ relayer: { estimatedSettlesLeft: null, balanceWei: '0' } }))[0].text, new RegExp(`no zkLTC.*Send testnet zkLTC to ${RELAYER}`));
  assert.deepEqual(ids(healthyReport({ relayer: { estimatedSettlesLeft: null, balanceWei: '1' } })), []);
  assert.deepEqual(ids(healthyReport({ relayer: { estimatedSettlesLeft: null, balanceWei: null } })), [], 'an unread balance is the degraded warning\'s job');
  assert.deepEqual(ids(healthyReport({ relayer: { estimatedSettlesLeft: 0, balanceWei: '0' } })), ['relayer-low']);
  assert.deepEqual(ids(healthyReport({ queue: { oldestUnconfirmedAgeSeconds: 600 } })), []);
  assert.deepEqual(ids(healthyReport({ queue: { oldestUnconfirmedAgeSeconds: 601 } })), ['queue-slow']);
  assert.deepEqual(ids(healthyReport({ index: { lagBlocks: 20_000 } })), []);
  assert.deepEqual(ids(healthyReport({ index: { lagBlocks: 20_001 } })), ['index-lag']);
  assert.deepEqual(ids(healthyReport({ queue: { failed: 2 } })), ['queue-failed']);
  assert.equal(healthWarnings(healthyReport({ queue: { failed: 2 } }))[0].text, '2 runs failed to publish and will retry on their own.');
  assert.equal(healthWarnings(healthyReport({ queue: { failed: 1 } }))[0].text, '1 run failed to publish and will retry on its own.');
  // Only dead letters that can still be requeued warn; older ones are permanent.
  assert.deepEqual(ids(healthyReport({ queue: { dead: 5, deadRequeueable: 0 } })), [], 'a dead letter older than 7 days never warns');
  assert.deepEqual(ids(healthyReport({ queue: { dead: 5, deadRequeueable: 1 } })), ['queue-dead']);
  const deadText = healthWarnings(healthyReport({ queue: { dead: 5, deadRequeueable: 1 } }))[0].text;
  assert.match(deadText, /^1 run from the last 7 days is a dead letter and will not retry on its own\./);
  assert.ok(deadText.includes(`with ${REQUEUE_DRY_RUN_COMMAND} (a dry run)`), deadText);
  assert.ok(deadText.includes(`requeue with ${REQUEUE_APPLY_COMMAND}.`), deadText);
  assert.match(healthWarnings(healthyReport({ queue: { dead: 3, deadRequeueable: 3 } }))[0].text, /^3 runs from the last 7 days are dead letters/);
  assert.deepEqual(ids(healthyReport({ settlementReady: false })), ['settlement-not-ready']);
  assert.deepEqual(ids(healthyReport({ paused: true })), ['paused']);
  assert.deepEqual(ids(healthyReport({ relayer: { allowed: false } })), ['relayer-not-allowed']);
  // Nulls from a degraded read never trigger a threshold, only the degraded warning.
  const degraded = healthyReport({
    healthy: false, degraded: true, degradedParts: ['queue', 'relayer-balance'],
    relayer: { balanceWei: null, estimatedSettlesLeft: null }, queue: { pending: null, signed: null, submitted: null, failed: null, dead: null, deadRequeueable: null, oldestUnconfirmedAgeSeconds: null },
  });
  assert.deepEqual(ids(degraded), ['degraded']);
  assert.match(healthWarnings(degraded)[0].text, /the settle queue, the relayer balance/);
});

test('cron warnings: an error newer than the last success, a stopped cron, no runs yet', () => {
  assert.deepEqual(ids(healthyReport({ crons: { indexChain: { lastErrorAt: '2026-09-24T17:59:00.000Z', lastErrorCode: 'chain-read-failed', failures: 1 } } })), ['cron-index-chain-failing']);
  const failing = healthWarnings(healthyReport({ crons: { settleRetry: { lastOkAt: null, lastErrorAt: '2026-09-24T17:55:00.000Z', lastErrorCode: 'NeonDbError:57P01' } } }))[0];
  assert.equal(failing.id, 'cron-settle-retry-failing');
  assert.match(failing.text, /settle-retry cron's last run failed \(NeonDbError:57P01, 2026-09-24 17:55 UTC \(5 min ago\)\) after its last success \(never\)/);
  assert.deepEqual(ids(healthyReport({ crons: { settleRetry: { lastOkAt: '2026-09-24T17:49:00.000Z' } } })), ['cron-settle-retry-stale'], 'no success for 11 minutes');
  assert.deepEqual(ids(healthyReport({ crons: { settleRetry: { lastOkAt: '2026-09-24T17:49:00.000Z' } }, paused: true })), ['paused'], 'a paused settle-retry is not stale');
  assert.deepEqual(ids(healthyReport({ crons: { indexChain: { lastOkAt: '2026-09-24T17:29:00.000Z' } } })), ['cron-index-chain-stale']);
  assert.deepEqual(ids(healthyReport({ crons: { indexChain: { lastOkAt: null, lastErrorAt: null, lastErrorCode: null, runs: 0, failures: 0 } } })), ['cron-index-chain-no-runs']);
  assert.deepEqual(ids(healthyReport({ crons: { indexChain: { lastOkAt: null, lastErrorAt: null, lastErrorCode: null, runs: null, failures: null } } })), [], 'unreadable cron rows are the degraded warning\'s job');
  // Only an error strictly newer than the last success is failing (the brief's rule).
  const tie = '2026-09-24T17:59:00.000Z';
  assert.deepEqual(ids(healthyReport({ crons: { indexChain: { lastOkAt: tie, lastErrorAt: tie, lastErrorCode: 'chain-read-failed' } } })), [], 'an error at the same instant as a success is not newer');
  assert.deepEqual(ids(healthyReport({ crons: { indexChain: { lastOkAt: tie, lastErrorAt: '2026-09-24T17:59:00.001Z', lastErrorCode: 'chain-read-failed' } } })), ['cron-index-chain-failing'], 'one millisecond newer is failing');
});

test('the dead-letter warning\'s commands run as shown and clear the warning', async () => {
  const toArgv = (command) => {
    const prefix = 'node scripts/requeue-dead-letters.mjs ';
    assert.ok(command.startsWith(prefix), command);
    return command.slice(prefix.length).split(' ');
  };
  const dryArgs = toArgv(REQUEUE_DRY_RUN_COMMAND);
  const applyArgs = toArgv(REQUEUE_APPLY_COMMAND);
  assert.deepEqual([parseRequeueArgs(dryArgs).ok, parseRequeueArgs(dryArgs).apply], [true, false], 'the first command is a dry run');
  assert.deepEqual([parseRequeueArgs(applyArgs).ok, parseRequeueArgs(applyArgs).apply, parseRequeueArgs(applyArgs).confirm], [true, true, REQUEUE_CONFIRM]);
  assert.equal(parseRequeueArgs([]).ok, false, 'the bare script is a usage error, so the page never shows it');

  const db = createPgliteClient();
  try {
    const now = Date.parse('2026-09-24T18:00:00.000Z');
    const wallet = `0x${'d5'.repeat(20)}`;
    await seedVerifiedSession(db, { wallet, status: 'failed', verifiedAt: new Date(now - 10 * 60_000).toISOString(), attempts: 3, lastError: 'session-not-paid', nextAttemptAt: null });
    await seedVerifiedSession(db, { wallet, status: 'failed', verifiedAt: new Date(now - 8 * 86_400_000).toISOString(), attempts: 0, lastError: 'stale', nextAttemptAt: null });
    const before = await readQueueHealth(db, { nowMs: now });
    assert.deepEqual([before.failed, before.dead, before.deadRequeueable], [0, 2, 1]);
    assert.deepEqual(ids(healthyReport({ queue: before })), ['queue-dead']);

    const lines = [];
    const run = (argv) => runRequeueDeadLetters({ argv, db, out: (line) => lines.push(String(line)), nowMs: () => now });
    const dry = await run(dryArgs);
    assert.deepEqual([dry.exitCode, dry.found.length, dry.stale.length, dry.requeued.length], [0, 1, 1, 0]);
    assert.deepEqual(await readQueueHealth(db, { nowMs: now }), before, 'the dry run writes nothing');
    const applied = await run(applyArgs);
    assert.deepEqual([applied.exitCode, applied.requeued.length], [0, 1]);
    const after = await readQueueHealth(db, { nowMs: now });
    assert.deepEqual([after.failed, after.dead, after.deadRequeueable], [1, 1, 0], 'the requeued run retries; the stale one stays, uncounted by the warning');
    assert.deepEqual(ids(healthyReport({ queue: after })), ['queue-failed']);
  } finally {
    await db.close();
  }
});

test('formatting helpers', () => {
  assert.equal(formatZkltc('1000000000000000000'), '1 zkLTC');
  assert.equal(formatZkltc('1234567890000000000'), '1.234568 zkLTC');
  assert.equal(formatZkltc('999999900000000000'), '1 zkLTC', 'rounds to six decimals with a carry');
  assert.equal(formatZkltc('2000000000000000'), '0.002 zkLTC');
  assert.equal(formatZkltc('12345678901234567890123'), '12,345.678901 zkLTC');
  assert.equal(formatZkltc(null), '—');
  assert.equal(formatZkltc('-1'), '—');
  assert.deepEqual([formatDuration(0), formatDuration(59.9), formatDuration(720), formatDuration(3 * 3600 + 5 * 60), formatDuration(50 * 3600)], ['0 s', '59 s', '12 min', '3 h 5 min', '2 d 2 h']);
  assert.equal(formatDuration(null), '—');
  assert.equal(ageSeconds('2026-09-24T17:58:00.000Z', '2026-09-24T18:00:00.000Z'), 120);
  assert.equal(formatWhen('2026-09-24T17:58:00.000Z', '2026-09-24T18:00:00.000Z'), '2026-09-24 17:58 UTC (2 min ago)');
  assert.equal(formatWhen(null, '2026-09-24T18:00:00.000Z'), 'never');
  assert.equal(formatWhen('2026-09-24T18:00:00.000Z', '2026-09-24T17:59:00.000Z'), '2026-09-24 18:00 UTC (0 s ago)', 'a clock behind the report never shows a negative age');
  assert.equal(explorerAddressUrl(RELAYER), `${EXPLORER_URL}/address/${RELAYER}`);
  assert.equal(explorerAddressUrl('javascript:alert(1)'), null);
});

test('loadHealth asks for a fresh copy and handles HTTP errors, bad bodies and network failures', async () => {
  const seen = [];
  const ok = await loadHealth({ fetchImpl: async (url, init) => { seen.push([url, init.cache]); return { ok: true, status: 200, json: async () => healthyReport() }; } });
  assert.deepEqual([ok.ok, ok.report.version], [true, '1.8.0']);
  assert.deepEqual(seen, [['/api/health', 'no-store']]);
  assert.deepEqual(await loadHealth({ fetchImpl: async () => ({ ok: false, status: 404, json: async () => ({}) }) }), { ok: false, message: '/api/health answered HTTP 404.' });
  assert.deepEqual(await loadHealth({ fetchImpl: async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('html'); } }) }), { ok: false, message: '/api/health did not answer a health report.' });
  assert.deepEqual(await loadHealth({ fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ ok: false, error: 'invalid-query' }) }) }), { ok: false, message: '/api/health did not answer a health report.' });
  assert.deepEqual(await loadHealth({ fetchImpl: async () => { throw new TypeError('Failed to fetch'); } }), { ok: false, message: 'Could not reach /api/health (network error).' });
});

test('the controller keeps the last report when a refresh fails and never overlaps loads', async () => {
  const answers = [healthyReport({ queue: { dead: 2, deadRequeueable: 2 } }), null];
  let calls = 0;
  const fetchImpl = async () => { calls += 1; const body = answers.shift(); return body ? { ok: true, status: 200, json: async () => body } : { ok: false, status: 503, json: async () => ({}) }; };
  const phases = [];
  const controller = createStatusController({ fetchImpl, onChange: (state) => phases.push(state.phase) });
  const [first, same] = [controller.refresh(), controller.refresh()];
  assert.equal(first, same, 'a second refresh while loading joins the first');
  await first;
  assert.equal(calls, 1);
  assert.deepEqual([controller.state.phase, controller.state.warnings.map((w) => w.id)], ['ready', ['queue-dead']]);
  await controller.refresh();
  assert.deepEqual([controller.state.phase, controller.state.stale, controller.state.message, controller.state.report.queue.dead], ['error', true, '/api/health answered HTTP 503.', 2]);
  assert.deepEqual(phases, ['loading', 'ready', 'loading', 'error']);
});

// A minimal DOM for mountStatusPage: getElementById for the page's ids, createElement, append,
// replaceChildren, setAttribute, dataset, disabled and click listeners.
function fakeDocument() {
  class FakeElement {
    constructor(tag) {
      this.tagName = tag.toUpperCase();
      this.children = [];
      this.textContent = '';
      this.className = '';
      this.dataset = {};
      this.attributes = {};
      this.disabled = false;
      this.listeners = {};
    }
    append(...nodes) { this.children.push(...nodes); }
    replaceChildren(...nodes) { this.children = [...nodes]; }
    setAttribute(name, value) { this.attributes[name] = String(value); }
    addEventListener(type, handler) { (this.listeners[type] ??= []).push(handler); }
    click() { return Promise.all((this.listeners.click ?? []).map((handler) => handler())); }
    get text() { return this.textContent + this.children.map((child) => child.text).join(''); }
  }
  const byId = new Map(IDS.map((id) => [id, new FakeElement(id === 'status-refresh' ? 'button' : 'div')]));
  const doc = { visibilityState: 'visible', getElementById: (id) => byId.get(id) ?? null, createElement: (tag) => new FakeElement(tag) };
  // dt/dd pairs of a <dl> as [label, text, className].
  const rows = (id) => {
    const out = [];
    const children = byId.get(id).children;
    for (let i = 0; i < children.length; i += 2) out.push([children[i].text, children[i + 1].text, children[i + 1].className]);
    return out;
  };
  return { doc, byId, rows };
}

test('the mounted page renders the numbers and warnings through the DOM', async () => {
  const page = fakeDocument();
  const intervals = [];
  const report = healthyReport({ relayer: { estimatedSettlesLeft: 12, balanceWei: '8550000000000000' }, queue: { failed: 1, dead: 3, deadRequeueable: 1, oldestUnconfirmedAgeSeconds: 900 }, crons: { indexChain: { lastErrorAt: '2026-09-24T17:59:00.000Z', lastErrorCode: 'chain-read-failed', failures: 1 } } });
  const responses = [report, healthyReport()];
  const fetchImpl = async () => ({ ok: true, status: 200, json: async () => responses.shift() });
  // The browser clock: 45 s after the report's checkedAt (an edge-cached copy).
  let browserMs = Date.parse('2026-09-24T18:00:45.000Z');
  const { controller, ready } = mountStatusPage(page.doc, { setInterval: (fn, ms) => intervals.push([fn, ms]) }, { fetchImpl, nowMs: () => browserMs });
  assert.equal(page.byId.get('status-summary').dataset.level, 'loading');
  assert.equal(page.byId.get('status-refresh').disabled, true, 'the button waits while loading');
  await ready;
  assert.equal(page.byId.get('status-summary').dataset.level, 'warn');
  assert.equal(page.byId.get('status-summary').textContent, '5 warnings need a look.');
  const warnings = page.byId.get('status-warnings').children;
  assert.deepEqual(warnings.map((node) => node.attributes['data-warning']), ['relayer-low', 'queue-dead', 'queue-failed', 'queue-slow', 'cron-index-chain-failing']);
  assert.ok(warnings.every((node) => node.tagName === 'LI' && node.textContent.length > 20));
  assert.deepEqual(page.rows('status-relayer'), [
    ['Address', RELAYER, ''],
    ['Balance', '0.00855 zkLTC', ''],
    ['Allowed on registry', 'yes', ''],
    ['Settles left (est.)', '12', 'bad'],
  ]);
  const link = page.byId.get('status-relayer').children[1].children[0];
  assert.deepEqual([link.tagName, link.attributes.href, link.attributes.rel], ['A', `${EXPLORER_URL}/address/${RELAYER}`, 'noopener noreferrer']);
  assert.deepEqual(page.rows('status-queue'), [
    ['Pending', '0', ''], ['Signed', '0', ''], ['Submitted', '1', ''],
    ['Failed (retrying)', '1', 'warn'], ['Dead letters', '3', ''], ['Requeueable (7 days)', '1', 'bad'], ['Oldest unpublished', '15 min', 'bad'],
  ]);
  assert.deepEqual(page.rows('status-index'), [['Indexed to block', '54,229,000', ''], ['Chain head', '54,230,000', ''], ['Lag', '1,000 blocks', '']]);
  assert.deepEqual(page.rows('status-service'), [['Site version', '1.8.0', ''], ['Settlement ready', 'yes', ''], ['Paused', 'no', ''], ['Base fee', '1.5 gwei', ''], ['All checks read', 'yes', '']]);
  assert.deepEqual(page.rows('status-cron-index-chain'), [
    ['Last success', '2026-09-24 17:58 UTC (2 min ago)', ''],
    ['Last error', 'chain-read-failed · 2026-09-24 17:59 UTC (1 min ago)', 'bad'],
    ['Runs / failures', '12 / 1', ''],
  ]);
  assert.equal(page.byId.get('status-cron-settle-retry').children[3].className, '', 'an older error is not flagged');
  assert.equal(EDGE_CACHE_SECONDS, 90, 's-maxage=30 plus stale-while-revalidate=60');
  assert.equal(page.byId.get('status-loaded').textContent, 'Checked 2026-09-24 18:00 UTC (45 s ago). The edge can serve a report up to about 90 s old.', 'the age is against the browser clock');

  // Refresh: now healthy, and the auto-refresh runs every minute while the tab is visible.
  await page.byId.get('status-refresh').click();
  assert.equal(page.byId.get('status-summary').textContent, 'Ranked looks healthy. No warnings.');
  assert.equal(page.byId.get('status-summary').dataset.level, 'ok');
  assert.deepEqual(page.byId.get('status-warnings').children, []);
  assert.deepEqual(intervals.map(([, ms]) => ms), [REFRESH_MS]);
  let fetched = 0;
  const hidden = fakeDocument();
  hidden.doc.visibilityState = 'hidden';
  const timers = [];
  const mounted = mountStatusPage(hidden.doc, { setInterval: (fn) => timers.push(fn) }, { fetchImpl: async () => { fetched += 1; return { ok: false, status: 500, json: async () => ({}) }; } });
  await mounted.ready;
  timers[0]();
  assert.equal(fetched, 1, 'a hidden tab does not poll');
  assert.equal(hidden.byId.get('status-summary').dataset.level, 'bad');
  assert.match(hidden.byId.get('status-summary').textContent, /\/api\/health answered HTTP 500\. Nothing to show yet; press Refresh to try again\./);
  assert.equal(controller.state.phase, 'ready');

  // A failed refresh ten minutes later keeps the old numbers and says how old they are.
  browserMs = Date.parse('2026-09-24T18:10:00.000Z');
  await controller.refresh();
  assert.deepEqual([controller.state.phase, controller.state.stale], ['error', true]);
  assert.equal(page.byId.get('status-loaded').textContent, 'Checked 2026-09-24 18:00 UTC (10 min ago), stale: the last refresh failed. The edge can serve a report up to about 90 s old.');
  assert.match(page.byId.get('status-summary').textContent, /The numbers below are from the last successful check\.$/);
});
