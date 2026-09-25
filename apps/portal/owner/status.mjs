// Owner page: is Ranked healthy? (ops-health, post-launch monitoring).
//
// Reads GET /api/health, a public report of aggregate, non-secret facts, and
// shows its numbers with plain warnings:
//   - the relayer can pay for fewer than 50 more settles at the current base fee,
//     or has no zkLTC at all when there is no estimate;
//   - the settle queue has failed (retrying) rows, or dead letters that can
//     still be requeued (verified in the last 7 days);
//   - the oldest unpublished run has waited more than 10 minutes;
//   - the chain index is more than 20,000 blocks behind the chain head;
//   - a cron's last error is newer than its last success (or it has stopped);
//   - settlement is unconfigured or paused, the relayer is not allowed, or a
//     health read failed (degraded);
//   - the Chikun Weekly Jackpot (jackpot-server, design §C.4): the keeper has
//     under 0.05 zkLTC, the jackpot is paused (env or on chain; a skipped cron
//     run is recorded as a success, so this is the only signal), a week waits
//     for the admin (a link to /owner/jackpot.html; an error after 7 days, when
//     the documented default applies), a prize is claim-pending, or a week
//     failed.
//
// It never asks for a key, never signs and never writes. CSP-safe: one module
// script, same-origin fetch only, no imports, DOM built with createElement and
// textContent. Served at /owner/status.html (noindex, no-store per vercel.json).

export const HEALTH_URL = '/api/health';
export const EXPLORER_URL = 'https://liteforge.explorer.caldera.xyz';
export const STATUS_THRESHOLDS = Object.freeze({
  minSettlesLeft: 50,
  maxOldestUnconfirmedSeconds: 10 * 60,
  maxIndexLagBlocks: 20_000,
  // A cron with no success for this long has stopped (it runs every minute / every 5 minutes).
  staleCronSeconds: Object.freeze({ settleRetry: 10 * 60, indexChain: 30 * 60, weeklyJackpot: 20 * 60 }),
  // The keeper pays for every jackpot send (design §E E11: keep it above 0.05 zkLTC).
  minKeeperBalanceWei: '50000000000000000',
  // An awaiting-admin week escalates to an error after 7 days (the review SLA default).
  awaitingAdminErrorHours: 7 * 24,
});
export const JACKPOT_REVIEW_URL = '/owner/jackpot.html';
export const REFRESH_MS = 60_000;
// The edge keeps a report for s-maxage=30 plus stale-while-revalidate=60 (server/ops/health.mjs).
export const EDGE_CACHE_SECONDS = 90;
// scripts/requeue-dead-letters.mjs: a dry run that lists the dead letters and their last errors,
// then the requeue itself. Both read NEON_DATABASE_URL.
export const REQUEUE_DRY_RUN_COMMAND = 'node scripts/requeue-dead-letters.mjs --all-dead';
export const REQUEUE_APPLY_COMMAND = 'node scripts/requeue-dead-letters.mjs --all-dead --apply --confirm REQUEUE_DEAD_LETTERS';

const ADDRESS_RE = /^0x[0-9a-f]{40}$/;
const CRON_LABELS = Object.freeze({ indexChain: 'index-chain', settleRetry: 'settle-retry', weeklyJackpot: 'weekly-jackpot' });
const PART_LABELS = Object.freeze({
  database: 'the database (not configured)',
  queue: 'the settle queue',
  'index-cursor': 'the index cursor',
  crons: 'the cron records',
  'chain-head': 'the chain head and base fee',
  'relayer-address': 'the relayer address (no deployment)',
  'relayer-balance': 'the relayer balance',
  'relayer-allowed': 'the relayer allowance',
  jackpot: 'the weekly jackpot (keeper, pause or weeks)',
});

const isCount = (value) => Number.isSafeInteger(value) && value >= 0;
const plural = (count, one, many = `${one}s`) => `${count.toLocaleString('en-US')} ${count === 1 ? one : many}`;

export function formatCount(value) {
  return isCount(value) ? value.toLocaleString('en-US') : '—';
}

// 1234567890000000000 → '1.234568 zkLTC' (six decimals at most, trailing zeros trimmed).
export function formatZkltc(wei) {
  if (typeof wei !== 'string' || !/^[0-9]{1,78}$/.test(wei)) return '—';
  const value = BigInt(wei);
  const unit = 10n ** 18n;
  const whole = value / unit;
  const micro = ((value % unit) + 500_000_000_000n) / 1_000_000_000_000n;
  const carry = micro >= 1_000_000n ? 1n : 0n;
  const fraction = String(carry ? micro - 1_000_000n : micro).padStart(6, '0').replace(/0+$/, '');
  return `${(whole + carry).toLocaleString('en-US')}${fraction ? `.${fraction}` : ''} zkLTC`;
}

export function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  const s = Math.floor(seconds);
  if (s < 60) return `${s} s`;
  const minutes = Math.floor(s / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} h${minutes % 60 ? ` ${minutes % 60} min` : ''}`;
  const days = Math.floor(hours / 24);
  return `${days} d${hours % 24 ? ` ${hours % 24} h` : ''}`;
}

function parseTime(iso) {
  const ms = typeof iso === 'string' ? Date.parse(iso) : Number.NaN;
  return Number.isFinite(ms) ? ms : null;
}

// Seconds from `iso` to `nowIso`, never negative. Warnings measure against the report's own
// checkedAt, so the browser clock never matters there; only the "Checked …" line uses the
// browser clock, to show how old a cached or stale report is.
export function ageSeconds(iso, nowIso) {
  const at = parseTime(iso);
  const now = parseTime(nowIso);
  return at === null || now === null ? null : Math.max(0, (now - at) / 1000);
}

export function formatWhen(iso, nowIso) {
  const at = parseTime(iso);
  if (at === null) return 'never';
  const text = new Date(at).toISOString().replace('T', ' ').slice(0, 16);
  const age = ageSeconds(iso, nowIso);
  return age === null ? `${text} UTC` : `${text} UTC (${formatDuration(age)} ago)`;
}

export function explorerAddressUrl(address) {
  return typeof address === 'string' && ADDRESS_RE.test(address) ? `${EXPLORER_URL}/address/${address}` : null;
}

function cronWarnings(key, cron, report) {
  if (!cron || cron.runs === null) return [];
  const label = CRON_LABELS[key];
  const okAt = parseTime(cron.lastOkAt);
  const errorAt = parseTime(cron.lastErrorAt);
  const out = [];
  if (errorAt !== null && (okAt === null || errorAt > okAt)) {
    out.push({
      id: `cron-${label}-failing`,
      text: `The ${label} cron's last run failed (${cron.lastErrorCode ?? 'unknown-error'}, ${formatWhen(cron.lastErrorAt, report.checkedAt)}) after its last success (${formatWhen(cron.lastOkAt, report.checkedAt)}).`,
    });
    return out;
  }
  // A paused settle-retry run is not recorded, so its success clock only matters while not paused.
  if (key === 'settleRetry' && report.paused) return out;
  const stale = STATUS_THRESHOLDS.staleCronSeconds[key];
  if (okAt === null && errorAt === null) {
    out.push({ id: `cron-${label}-no-runs`, text: `The ${label} cron has no recorded run yet. If this stays for more than a few minutes, check the Vercel cron jobs.` });
  } else if (okAt !== null && ageSeconds(cron.lastOkAt, report.checkedAt) > stale) {
    out.push({ id: `cron-${label}-stale`, text: `The ${label} cron has not succeeded for ${formatDuration(ageSeconds(cron.lastOkAt, report.checkedAt))} (last success ${formatWhen(cron.lastOkAt, report.checkedAt)}). Check the Vercel cron jobs and function logs.` });
  }
  return out;
}

const isWeiText = (value) => typeof value === 'string' && /^[0-9]{1,78}$/.test(value);

// The Chikun Weekly Jackpot warnings (design §C.4, §E E11). A warning may carry
// level 'bad' (an error) and a same-origin link.
export function jackpotWarnings(jackpot) {
  if (!jackpot || typeof jackpot !== 'object') return [];
  const out = [];
  if (jackpot.paused?.env === true || jackpot.paused?.onChain === true) {
    const which = [jackpot.paused?.env === true ? 'JACKPOT_PAUSED in the server environment' : null, jackpot.paused?.onChain === true ? 'the WeeklyJackpot contract (admin or operator pause)' : null].filter(Boolean).join(' and ');
    out.push({ id: 'jackpot-paused', text: `The weekly jackpot is paused (${which}). The keeper sends nothing, so candidates, clears and payouts wait until the pause is lifted.` });
  }
  if (jackpot.configured === true && isWeiText(jackpot.keeperBalanceWei) && BigInt(jackpot.keeperBalanceWei) < BigInt(STATUS_THRESHOLDS.minKeeperBalanceWei)) {
    out.push({ id: 'jackpot-keeper-low', text: `The jackpot keeper has ${formatZkltc(jackpot.keeperBalanceWei)} (under ${formatZkltc(STATUS_THRESHOLDS.minKeeperBalanceWei)}). Its sends stop (keeper-underfunded) when it cannot pay the fee cap. Send testnet zkLTC to ${jackpot.keeperAddress ?? 'the keeper'}.` });
  }
  if (isCount(jackpot.awaitingAdmin) && jackpot.awaitingAdmin > 0) {
    const hours = isCount(jackpot.awaitingAdminOldestHours) ? jackpot.awaitingAdminOldestHours : null;
    const overdue = hours !== null && hours >= STATUS_THRESHOLDS.awaitingAdminErrorHours;
    const weeks = jackpot.awaitingAdmin === 1 ? '1 jackpot week waits' : `${formatCount(jackpot.awaitingAdmin)} jackpot weeks wait`;
    const waited = hours === null ? '' : ` The oldest has waited ${formatDuration(hours * 3600)}.`;
    const next = overdue
      ? ' It is past the 7-day limit: apply the documented default (disqualify the uncleared leader with reason other and a published note, so the pot rolls over).'
      : ' Review it within 24 hours with the admin wallet.';
    out.push({ id: 'jackpot-awaiting-admin', level: overdue ? 'bad' : 'warn', text: `${weeks} for the admin's review.${waited}${next}`, link: { href: JACKPOT_REVIEW_URL, text: 'Open the jackpot review page' } });
  }
  if (isCount(jackpot.claimPending) && jackpot.claimPending > 0) {
    out.push({ id: 'jackpot-claim-pending', text: `${jackpot.claimPending === 1 ? '1 jackpot prize' : `${formatCount(jackpot.claimPending)} jackpot prizes`} could not be transferred and wait${jackpot.claimPending === 1 ? 's' : ''} for the winner to claim. Contact the winner well before the 180-day recycle.` });
  }
  if (isCount(jackpot.failed) && jackpot.failed > 0) {
    out.push({ id: 'jackpot-failed', text: `${jackpot.failed === 1 ? '1 jackpot week has' : `${formatCount(jackpot.failed)} jackpot weeks have`} failed and will not move on their own. Check them with node scripts/jackpot-ops.mjs status, then requeue.` });
  }
  return out;
}

// Plain-language warnings for a /api/health report: [{ id, text, level?, link? }], most urgent first.
export function healthWarnings(report) {
  if (!report || typeof report !== 'object') return [];
  const warnings = [];
  const relayer = report.relayer ?? {};
  const queue = report.queue ?? {};
  const index = report.index ?? {};
  if (report.settlementReady === false) {
    warnings.push({ id: 'settlement-not-ready', text: 'Settlement is not configured on the server, so Ranked is closed: players stop at the Ranked modal before paying. Check the production environment variables, then redeploy.' });
  }
  if (report.paused === true) {
    warnings.push({ id: 'paused', text: 'Settlement is paused (SETTLEMENT_PAUSED). New Ranked entries stop before payment and queued runs wait until the pause is lifted.' });
  }
  if (relayer.allowed === false) {
    warnings.push({ id: 'relayer-not-allowed', text: 'The relayer is not allowed on the score registry. Every settle waits (relayer-not-allowed) until the operator allows it again.' });
  }
  if (isCount(relayer.estimatedSettlesLeft) && relayer.estimatedSettlesLeft < STATUS_THRESHOLDS.minSettlesLeft) {
    warnings.push({ id: 'relayer-low', text: `The relayer can pay for about ${plural(relayer.estimatedSettlesLeft, 'more settle')} at the current base fee (under ${STATUS_THRESHOLDS.minSettlesLeft}). Settles stop a little before this reaches 0, because each send needs the full fee cap (about twice the base fee) in hand. Send testnet zkLTC to ${relayer.address ?? 'the relayer'}.` });
  } else if (!isCount(relayer.estimatedSettlesLeft) && relayer.balanceWei === '0') {
    // No estimate (a zero base fee): an empty balance still stops every priced send.
    warnings.push({ id: 'relayer-empty', text: `The relayer has no zkLTC, so settles wait (relayer-underfunded) as soon as gas costs anything. Send testnet zkLTC to ${relayer.address ?? 'the relayer'}.` });
  }
  if (isCount(queue.deadRequeueable) && queue.deadRequeueable > 0) {
    const dead = queue.deadRequeueable === 1 ? '1 run from the last 7 days is a dead letter and will not retry on its own' : `${formatCount(queue.deadRequeueable)} runs from the last 7 days are dead letters and will not retry on their own`;
    warnings.push({ id: 'queue-dead', text: `${dead}. List them and their last errors with ${REQUEUE_DRY_RUN_COMMAND} (a dry run), fix the cause, then requeue with ${REQUEUE_APPLY_COMMAND}. Both read NEON_DATABASE_URL. Older dead letters cannot be requeued and are not warned about.` });
  }
  if (isCount(queue.failed) && queue.failed > 0) {
    warnings.push({ id: 'queue-failed', text: queue.failed === 1 ? '1 run failed to publish and will retry on its own.' : `${formatCount(queue.failed)} runs failed to publish and will retry on their own.` });
  }
  if (Number.isFinite(queue.oldestUnconfirmedAgeSeconds) && queue.oldestUnconfirmedAgeSeconds > STATUS_THRESHOLDS.maxOldestUnconfirmedSeconds) {
    warnings.push({ id: 'queue-slow', text: `The oldest unpublished run has waited ${formatDuration(queue.oldestUnconfirmedAgeSeconds)} (over ${formatDuration(STATUS_THRESHOLDS.maxOldestUnconfirmedSeconds)}).` });
  }
  if (isCount(index.lagBlocks) && index.lagBlocks > STATUS_THRESHOLDS.maxIndexLagBlocks) {
    warnings.push({ id: 'index-lag', text: `The chain index is ${plural(index.lagBlocks, 'block')} behind the chain head (over ${STATUS_THRESHOLDS.maxIndexLagBlocks.toLocaleString('en-US')}), so boards and profiles can miss recent runs.` });
  }
  warnings.push(...jackpotWarnings(report.jackpot));
  for (const key of Object.keys(CRON_LABELS)) warnings.push(...cronWarnings(key, report.crons?.[key], report));
  if (report.degraded === true) {
    const parts = (Array.isArray(report.degradedParts) ? report.degradedParts : []).map((part) => PART_LABELS[part]).filter(Boolean);
    warnings.push({ id: 'degraded', text: `Some checks could not be read just now${parts.length ? `: ${parts.join(', ')}` : ''}. Their values show as —. If this stays, check Neon and the LiteForge RPC.` });
  }
  return warnings;
}

function isReport(body) {
  return Boolean(body) && typeof body === 'object' && body.ok === true && typeof body.checkedAt === 'string';
}

// → { ok:true, report } | { ok:false, message }
export async function loadHealth({ fetchImpl = globalThis.fetch, url = HEALTH_URL } = {}) {
  let response;
  try {
    response = await fetchImpl(url, { cache: 'no-store', headers: { accept: 'application/json' } });
  } catch {
    return { ok: false, message: `Could not reach ${url} (network error).` };
  }
  if (!response?.ok) return { ok: false, message: `${url} answered HTTP ${response?.status ?? '?'}.` };
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!isReport(body)) return { ok: false, message: `${url} did not answer a health report.` };
  return { ok: true, report: body };
}

// DOM-free controller. onChange(state) runs after every state change.
export function createStatusController({ fetchImpl = globalThis.fetch, onChange = () => {} } = {}) {
  const state = { phase: 'loading', report: null, warnings: [], message: null, stale: false };
  let inFlight = null;
  const emit = () => onChange(state);
  async function load() {
    state.phase = 'loading';
    emit();
    const result = await loadHealth({ fetchImpl });
    if (result.ok) {
      Object.assign(state, { phase: 'ready', report: result.report, warnings: healthWarnings(result.report), message: null, stale: false });
    } else {
      Object.assign(state, { phase: 'error', message: result.message, stale: state.report !== null, warnings: healthWarnings(state.report) });
    }
    emit();
    return state;
  }
  function refresh() {
    inFlight ??= load().finally(() => { inFlight = null; });
    return inFlight;
  }
  return { state, refresh };
}

// ---------------------------------------------------------------------------------------------
// DOM (browser only).

function el(doc, tag, attrs = {}, children = []) {
  const node = doc.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (name === 'text') node.textContent = value;
    else if (name === 'className') node.className = value;
    else node.setAttribute(name, value);
  }
  for (const child of children) if (child) node.append(child);
  return node;
}

function fillList(doc, id, rows) {
  const list = doc.getElementById(id);
  if (!list) return;
  const nodes = [];
  for (const [label, value, level] of rows) {
    nodes.push(el(doc, 'dt', { text: label }));
    const dd = typeof value === 'string' ? el(doc, 'dd', { text: value }) : el(doc, 'dd', {}, [value]);
    if (level) dd.className = level;
    nodes.push(dd);
  }
  list.replaceChildren(...nodes);
}

const yesNo = (value, yes = 'yes', no = 'no') => (value === true ? yes : value === false ? no : '—');

function relayerAddressNode(doc, address) {
  const url = explorerAddressUrl(address);
  return url ? el(doc, 'a', { href: url, target: '_blank', rel: 'noopener noreferrer', text: address }) : el(doc, 'span', { text: '—' });
}

function cronRows(cron, report) {
  if (!cron) return [['Last success', '—'], ['Last error', '—'], ['Runs', '—']];
  const failing = parseTime(cron.lastErrorAt) !== null && (parseTime(cron.lastOkAt) === null || parseTime(cron.lastErrorAt) > parseTime(cron.lastOkAt));
  return [
    ['Last success', cron.runs === null ? '—' : formatWhen(cron.lastOkAt, report.checkedAt)],
    ['Last error', cron.runs === null ? '—' : (cron.lastErrorAt ? `${cron.lastErrorCode ?? 'unknown-error'} · ${formatWhen(cron.lastErrorAt, report.checkedAt)}` : 'none'), failing ? 'bad' : null],
    ['Runs / failures', cron.runs === null ? '—' : `${formatCount(cron.runs)} / ${formatCount(cron.failures)}`],
  ];
}

function render(doc, state, nowMs = Date.now) {
  const summary = doc.getElementById('status-summary');
  if (!summary) return;
  const report = state.report;
  const count = state.warnings.length;
  if (state.phase === 'loading' && !report) {
    summary.textContent = 'Loading /api/health…';
    summary.dataset.level = 'loading';
  } else if (state.phase === 'error') {
    summary.textContent = `${state.message} ${report ? 'The numbers below are from the last successful check.' : 'Nothing to show yet; press Refresh to try again.'}`;
    summary.dataset.level = 'bad';
  } else if (count === 0) {
    summary.textContent = 'Ranked looks healthy. No warnings.';
    summary.dataset.level = 'ok';
  } else {
    summary.textContent = `${plural(count, 'warning')} need${count === 1 ? 's' : ''} a look.`;
    summary.dataset.level = state.warnings.some((warning) => warning.level === 'bad') ? 'bad' : 'warn';
  }

  const warnings = doc.getElementById('status-warnings');
  warnings?.replaceChildren(...state.warnings.map((warning) => {
    const attrs = { 'data-warning': warning.id, text: warning.text };
    if (warning.level) attrs['data-level'] = warning.level;
    const link = warning.link && typeof warning.link.href === 'string' && warning.link.href.startsWith('/') ? el(doc, 'a', { href: warning.link.href, text: warning.link.text }) : null;
    return el(doc, 'li', attrs, link ? [doc.createTextNode ? doc.createTextNode(' ') : null, link] : []);
  }));

  const refresh = doc.getElementById('status-refresh');
  if (refresh) {
    refresh.disabled = state.phase === 'loading';
    refresh.textContent = state.phase === 'loading' ? 'Checking…' : 'Refresh';
  }
  const loaded = doc.getElementById('status-loaded');
  // The age is against the browser clock, so a cached or stale report shows how old it is.
  const browserNow = new Date(nowMs()).toISOString();
  if (loaded) loaded.textContent = report ? `Checked ${formatWhen(report.checkedAt, browserNow)}${state.stale ? ', stale: the last refresh failed' : ''}. The edge can serve a report up to about ${EDGE_CACHE_SECONDS} s old.` : '';
  if (!report) return;

  const relayer = report.relayer ?? {};
  const queue = report.queue ?? {};
  const index = report.index ?? {};
  const has = (id) => state.warnings.some((warning) => warning.id === id);
  fillList(doc, 'status-service', [
    ['Site version', String(report.version ?? '—')],
    ['Settlement ready', yesNo(report.settlementReady), report.settlementReady === false ? 'bad' : null],
    ['Paused', yesNo(report.paused), report.paused ? 'bad' : null],
    ['Base fee', Number.isFinite(report.baseFeeGwei) ? `${report.baseFeeGwei} gwei` : '—'],
    ['All checks read', yesNo(report.degraded === false), report.degraded ? 'bad' : null],
  ]);
  fillList(doc, 'status-relayer', [
    ['Address', relayerAddressNode(doc, relayer.address)],
    ['Balance', formatZkltc(relayer.balanceWei), has('relayer-empty') ? 'bad' : null],
    ['Allowed on registry', yesNo(relayer.allowed), relayer.allowed === false ? 'bad' : null],
    ['Settles left (est.)', formatCount(relayer.estimatedSettlesLeft), has('relayer-low') ? 'bad' : null],
  ]);
  fillList(doc, 'status-queue', [
    ['Pending', formatCount(queue.pending)],
    ['Signed', formatCount(queue.signed)],
    ['Submitted', formatCount(queue.submitted)],
    ['Failed (retrying)', formatCount(queue.failed), has('queue-failed') ? 'warn' : null],
    ['Dead letters', formatCount(queue.dead)],
    ['Requeueable (7 days)', formatCount(queue.deadRequeueable), has('queue-dead') ? 'bad' : null],
    ['Oldest unpublished', Number.isFinite(queue.oldestUnconfirmedAgeSeconds) ? formatDuration(queue.oldestUnconfirmedAgeSeconds) : (queue.pending === null ? '—' : 'none'), has('queue-slow') ? 'bad' : null],
  ]);
  fillList(doc, 'status-index', [
    ['Indexed to block', formatCount(index.cursorBlock)],
    ['Chain head', formatCount(index.headBlock)],
    ['Lag', isCount(index.lagBlocks) ? plural(index.lagBlocks, 'block') : '—', has('index-lag') ? 'bad' : null],
  ]);
  fillList(doc, 'status-cron-index-chain', cronRows(report.crons?.indexChain, report));
  fillList(doc, 'status-cron-settle-retry', cronRows(report.crons?.settleRetry, report));
  // The jackpot rows fill only where the page has their lists.
  fillList(doc, 'status-cron-weekly-jackpot', cronRows(report.crons?.weeklyJackpot, report));
  const jackpot = report.jackpot ?? null;
  fillList(doc, 'status-jackpot', [
    ['Configured', yesNo(jackpot?.configured)],
    ['Keeper', relayerAddressNode(doc, jackpot?.keeperAddress ?? null)],
    ['Keeper balance', formatZkltc(jackpot?.keeperBalanceWei ?? null), has('jackpot-keeper-low') ? 'bad' : null],
    ['Paused (env / chain)', `${yesNo(jackpot?.paused?.env)} / ${yesNo(jackpot?.paused?.onChain)}`, has('jackpot-paused') ? 'warn' : null],
    ['Awaiting admin', formatCount(jackpot?.awaitingAdmin), has('jackpot-awaiting-admin') ? 'warn' : null],
    ['Claim pending', formatCount(jackpot?.claimPending), has('jackpot-claim-pending') ? 'warn' : null],
    ['Failed weeks', formatCount(jackpot?.failed), has('jackpot-failed') ? 'bad' : null],
  ]);
}

export function mountStatusPage(doc, win, { fetchImpl = win?.fetch?.bind(win) ?? globalThis.fetch, nowMs = () => Date.now() } = {}) {
  const controller = createStatusController({ fetchImpl, onChange: (state) => render(doc, state, nowMs) });
  doc.getElementById('status-refresh')?.addEventListener('click', () => controller.refresh());
  render(doc, controller.state, nowMs);
  const done = controller.refresh();
  if (typeof win?.setInterval === 'function') {
    win.setInterval(() => {
      if (doc.visibilityState === undefined || doc.visibilityState === 'visible') controller.refresh();
    }, REFRESH_MS);
  }
  return { controller, ready: done };
}

if (typeof document !== 'undefined' && typeof window !== 'undefined' && document.getElementById('owner-status-page')) {
  mountStatusPage(document, window);
}
