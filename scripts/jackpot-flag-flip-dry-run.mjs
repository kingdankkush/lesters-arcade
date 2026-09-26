#!/usr/bin/env node
// The Weekly Jackpot flag-flip dry run (jackpot-rehearsal slice; design §E E10, §D.4, §D.6; brief AC6).
//
//   node scripts/jackpot-flag-flip-dry-run.mjs --confirm-throwaway [--tests <file,...>] [--out <path>]
//   (--tests is for development only: it runs just those test files and writes a partial checklist that
//    must not be committed)
//
// Rehearses the runbook E10 commit WITHOUT touching this repository, the way scripts/rehearse-step7-dry-run.mjs
// rehearses step 7: everything happens in a THROWAWAY git worktree under the OS temp directory (detached at
// HEAD, node_modules junctioned like the slice worktrees, never `npm install`, never committed, merged or
// pushed, and removed at the end, the junctions first). In it the script:
//   1. brings the tree to the state E10 starts from, runbook E4: a WeeklyJackpot deployed on an in-process
//      Hardhat chain from the real operator and admin addresses (impersonated: no key exists here) over a
//      Ranked suite deployed like production, contracts/deployment-record.jackpot.json written and the
//      module regenerated with `node scripts/generate-litvm-jackpot.mjs` (status 'deployed'), the curated
//      inventory regenerated; then runs the whole test suite, as the release gate does, and records what
//      E4 itself changes (that is the E4 commit's business, listed for the E4 session);
//   2. THE FLIP on top: JACKPOT_LIVE = true in apps/portal/src/jackpot-config.mjs, the legal block confirmed
//      (the §F.1 draft stands in as the fixture legal text; the LEGAL-REVIEW-PENDING comment is removed as
//      the flip commit removes it), `node scripts/build-portal-pages.mjs` (which refuses a live rules page
//      with the pending comment or a missing section marker), the curated inventory regenerated; then the
//      whole suite again. The failures the flip causes (failing now, passing at E4) are the pinned tests the
//      E10 commit updates; the generated pages' changed lines are the literals it changes;
//   3. EVERY pinned assertion of each such test (confirmed by running its file alone; one that then passes
//      was a load flake and is set aside under `flakes`): a test stops at its first failing assertion, so each one is
//      re-run with the failing assertion neutralised (in the throwaway copy only) until it passes, and every
//      assertion line it stopped at is listed. The suites run with a preload (CHEAP_ASSERT_SOURCE) that gives
//      a failing equality assertion on an object with no message of its own a short message instead of
//      Node's full diff: after the flip, an assert.equal(fakeDomNode, null) otherwise inspects the whole
//      fake DOM for about 90 s and some 14 GB before it throws "Array buffer allocation failed" with no test
//      frame left in its stack. The reporter keeps the test file's own stack frame (searched in the whole
//      stack, --stack-trace-limit=1000), so every failure names its line.
// The checklist records `head` and `dirty`: the throwaway is made from HEAD, so a checklist to commit is
// made from a clean committed tree (tests/jackpot-rehearsal.test.mjs refuses a dirty one).
// Only one file changes in THIS worktree: docs/qa/jackpot-flag-flip-checklist.json (local paths written as
// <throwaway>, <repo> and ~). The script refuses to run without --confirm-throwaway and inside the
// repository's main worktree. JACKPOT_LIVE is never flipped in a committed file (contract §11 rule 9).

import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { applyTextEdit, checkGuards, gitDirs, lineChanges, pathScrubber, sha256Text, testLineFromStack } from './rehearse-step7-dry-run.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));

export const FLIP_SCRIPT_RELATIVE_PATH = 'scripts/jackpot-flag-flip-dry-run.mjs';
export const FLIP_CHECKLIST_RELATIVE_PATH = 'docs/qa/jackpot-flag-flip-checklist.json';
export const FLIP_CHECKLIST_SCHEMA = 'lesters-jackpot-flag-flip-checklist-v1';
export const JACKPOT_CONFIG_RELATIVE_PATH = 'apps/portal/src/jackpot-config.mjs';
export const RULES_PAGE_RELATIVE_PATH = 'apps/portal/jackpot/chikun.html';
export const JACKPOT_RECORD_RELATIVE_PATH = 'contracts/deployment-record.jackpot.json';
export const JACKPOT_MODULE_RELATIVE_PATH = 'apps/portal/src/generated/litvm-jackpot.mjs';
export const GENERATE_MODULE_COMMAND = 'node scripts/generate-litvm-jackpot.mjs';
export const BUILD_COMMAND = 'node scripts/build-portal-pages.mjs';
export const INVENTORY_COMMAND = 'npm run assets:hmh:curated-level-kit-runtime';
export const LEGAL_PENDING_LINE = '      <!-- LEGAL-REVIEW-PENDING: owner confirms at E10 -->\n';
export const DRY_RUN_ENV = 'LESTERS_JACKPOT_FLIP_DRY_RUN';

// The flip itself (design J14, §D.4 guard, §E E10).
export const FLIP_EDITS = Object.freeze([
  Object.freeze({
    file: JACKPOT_CONFIG_RELATIVE_PATH,
    find: 'export const JACKPOT_LIVE = false;',
    replace: 'export const JACKPOT_LIVE = true;',
    reason: 'design J14 / §E E10: the client flag, the only literal the flip changes by hand',
  }),
  Object.freeze({
    file: RULES_PAGE_RELATIVE_PATH,
    find: LEGAL_PENDING_LINE,
    replace: '',
    reason: 'design §D.4 guard: the owner confirms the legal block at E10 (the §F.1 draft or reviewed text in portal-content.mjs jackpotRulesCopy) and the flip commit removes the pending comment; a live build refuses the page while it is there',
  }),
]);

// Preconditions of the flip (design §E E10, brief AC6), each with the command that proves it.
export const FLIP_PRECONDITIONS = Object.freeze([
  Object.freeze({ id: 'funded-current-week', text: 'potOf(currentWeek).total >= rulesFor(currentWeek).minFundWei on chain (J13: never claim an unfunded prize)', proof: 'node scripts/jackpot-live-dry-run.mjs --site https://lestersarcade.io --require-funded (pot-funded fails unless potOf(currentWeek).total >= rulesFor(currentWeek).minFundWei on chain; pot-current and rules-in-force pass) and node scripts/jackpot-actions.mjs status' }),
  Object.freeze({ id: 'legal-text', text: 'no LEGAL-REVIEW-PENDING: the owner confirmed the §F.1 draft or supplied reviewed text for the legal block (OJ3)', proof: `${BUILD_COMMAND} refuses a live rules page that still carries the comment` }),
  Object.freeze({ id: 'rules-sections', text: 'every rules-page section marker is present: <!-- copy:jackpot-rules-<id>:start --> for what, eligible, winner, timeline, verification, disqualification, challenges, rollover, funding, claims, end, published, no-guarantee, testnet, legal, history', proof: `${BUILD_COMMAND} refuses a live rules page with a missing marker; tests/jackpot-ui-rules-page.test.mjs` }),
  Object.freeze({ id: 'oj2-calibration', text: 'the OJ2 calibration receipt (docs/qa/chikun-plausibility-calibration-<date>.json) is present with the gate met: a human set of >= 40 runs from >= 5 people (>= 15 of 8 minutes or more), 0 human holds on H4-H6, 100% of set (a) held, set (b) miss rates recorded', proof: 'node scripts/chikun-plausibility-calibrate.mjs --probe --bots 4 --seed-variance --human-dir tests/fixtures/chikun-human-calibration' }),
  Object.freeze({ id: 'j17-coupling', text: 'the J17 coupling checks pass: quoteEntry(chikun).totalWei >= minPaidWei and >= the server settle floor (RANKED_MIN_PAID_WEI), ScoreSubmissionRegistry.rankedEntry() == jackpot.rankedEntry(), the server season in rulesFor(currentWeek), Chikun registered and playable', proof: 'node scripts/jackpot-live-dry-run.mjs --site https://lestersarcade.io (j17-quote, j17-settle-floor, j17-ranked-entry, j17-season, j17-game-id, j17-game-registered)' }),
  Object.freeze({ id: 'open-epoch', text: 'an epoch with adminClearOnly = false is scheduled for the flip week (runbook E4 note), or the owner documents the decision to keep every payout manual', proof: 'node scripts/jackpot-actions.mjs schedule-rules --from-week <flip week> --admin-clear-only false (operator; SCHEDULE_JACKPOT_RULES_4441), then jackpot-actions status' }),
  Object.freeze({ id: 'e4-committed', text: 'runbook E4 is committed: contracts/deployment-record.jackpot.json and the regenerated apps/portal/src/generated/litvm-jackpot.mjs (status deployed); tests/jackpot-ui-client.test.mjs pins JACKPOT_LIVE => SETTLEMENT_LIVE && LITVM_JACKPOT deployed', proof: `${GENERATE_MODULE_COMMAND} --check` }),
]);

// The post-release smokes of the D.3 surfaces (design §E E10).
export const POST_RELEASE_SMOKES = Object.freeze([
  'node scripts/jackpot-live-dry-run.mjs --site https://lestersarcade.io --expect-live true --require-funded (every check, JACKPOT_LIVE served true, the rules page indexable, the current week funded on chain, no pause)',
  'https://lestersarcade.io/jackpot/chikun: no robots noindex, no soft-launch banner, all 16 sections, the legal block, the history list from /api/jackpot',
  'sitemap.xml and llms.txt list /jackpot/chikun',
  'Chikun mode select (/games/chikun): the WEEKLY JACKPOT marquee with the funded prize and "(testnet token, no value)", the countdown and the provisional top score',
  'Chikun cabinet start screen, Ranked: "Weekly Jackpot: {prize} tCHIKUN (testnet token, no value) · closes in …" and "Top verified Ranked score of the week wins. See the rules."',
  'Ranked entry modal for Chikun: the #rankedEntryJackpot row ("Entries don\'t fund the prize", Rules opens in a new tab); hidden for other games',
  'A Chikun Ranked result: the jackpot line ("You\'d lead…" or "{n} points behind…") and the "Jackpot lead (pending)" share label only for an eligible run',
  'Scores → Chikun · Weekly: the jackpot header (prize, countdown, provisional top score, Past winners, the board-vs-jackpot note)',
  'A winner\'s profile: the Jackpot Champion section; a claim-pending win shows the Claim button to its connected owner only',
  'The home page promo card in the scores section while the week is funded',
  'The share page of a paid winning session: "Weekly Jackpot Champion · <date range>"',
  '/owner/status.html: the weekly-jackpot cron fresh, no jackpot warning',
]);

const NEWLINE = String.fromCharCode(10);
const HEX_OR_KEY = /0x[0-9a-fA-F]{64}/g;

function git(args, cwd, { allowFail = false } = {}) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  if (!allowFail && result.status !== 0) throw new Error(`git ${args[0]} failed (${result.status}): ${String(result.stderr).trim().split('\n').slice(-3).join(' | ')}`);
  return String(result.stdout ?? '').trimEnd();
}

// A deep stack, so a failure thrown far inside a library still carries the test file's own frame.
export const STACK_TRACE_LIMIT_OPTION = '--stack-trace-limit=1000';
const childEnv = ({ preload = null } = {}) => ({
  ...process.env, FORCE_COLOR: '0', NO_COLOR: '1', [DRY_RUN_ENV]: '1',
  NODE_OPTIONS: [process.env.NODE_OPTIONS ?? '', STACK_TRACE_LIMIT_OPTION, preload ? `--import="${pathToFileURL(preload).href}"` : ''].filter(Boolean).join(' '),
});

// The suites' preload (written next to the reporter in the throwaway's base directory). A strict
// equality assertion (strictEqual, deepStrictEqual and their negations, which the strict namespace's
// equal/deepEqual are) on an object is decided here, with the same algorithm (Object.is,
// util.isDeepStrictEqual), and a failure throws a short AssertionError (inspect depth 1, a few hundred
// characters, after the test's own message) whose stack starts at the test's call. Node 24 builds a full
// diff even for a custom message, which is what runs out of memory on a large fake DOM node. Primitive
// comparisons go to Node untouched. Both suites (E4 and the flip) run with it, so it never changes which
// tests fail, only how briefly they say so.
export const CHEAP_ASSERT_SOURCE = `import { createRequire, syncBuiltinESMExports } from 'node:module';
import { inspect, isDeepStrictEqual } from 'node:util';
const require = createRequire(import.meta.url);
const assert = require('node:assert');
const short = (value) => inspect(value, { depth: 1, maxArrayLength: 5, maxStringLength: 120, breakLength: Infinity }).slice(0, 300);
const heavy = (value) => value !== null && (typeof value === 'object' || typeof value === 'function');
const CHECKS = {
  strictEqual: (a, b) => Object.is(a, b),
  notStrictEqual: (a, b) => !Object.is(a, b),
  deepStrictEqual: (a, b) => isDeepStrictEqual(a, b),
  notDeepStrictEqual: (a, b) => !isDeepStrictEqual(a, b),
};
function wrap(target, name, kind) {
  const original = target[name];
  if (typeof original !== 'function' || original.flipDryRun) return;
  const wrapped = function (actual, expected, message, ...rest) {
    if (!heavy(actual) && !heavy(expected)) return original.call(this, actual, expected, message, ...rest);
    if (CHECKS[kind](actual, expected)) return undefined;
    if (message instanceof Error) throw message;
    const own = message === undefined ? '' : String(message) + ' | ';
    throw new assert.AssertionError({ message: own + kind + ': ' + short(actual) + ' vs ' + short(expected), operator: kind, stackStartFn: wrapped });
  };
  wrapped.flipDryRun = true;
  target[name] = wrapped;
}
const STRICT = { equal: 'strictEqual', strictEqual: 'strictEqual', notEqual: 'notStrictEqual', notStrictEqual: 'notStrictEqual', deepEqual: 'deepStrictEqual', deepStrictEqual: 'deepStrictEqual', notDeepEqual: 'notDeepStrictEqual', notDeepStrictEqual: 'notDeepStrictEqual' };
for (const [name, kind] of Object.entries(STRICT)) wrap(assert.strict, name, kind);
for (const name of ['strictEqual', 'notStrictEqual', 'deepStrictEqual', 'notDeepStrictEqual']) wrap(assert, name, name);
syncBuiltinESMExports();
`;

function run(command, cwd, { timeoutMs = 45 * 60_000 } = {}) {
  const started = Date.now();
  const result = spawnSync(command, { cwd, shell: true, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, timeout: timeoutMs, env: childEnv() });
  return { command, exitCode: result.status, ms: Date.now() - started, output: `${result.stdout ?? ''}\n${result.stderr ?? ''}` };
}

let scrub = (text) => String(text ?? '');
const redact = (text) => scrub(text).replace(HEX_OR_KEY, (hex) => `${hex.slice(0, 10)}…`);
const tail = (text, count = 12) => redact(String(text ?? '').replace(/\u001b\[[0-9;]*m/g, '')).split(/\r?\n/).filter((line) => line.trim()).slice(-count);

function junction(target, path) {
  if (!existsSync(target)) return null;
  mkdirSync(dirname(path), { recursive: true });
  symlinkSync(realpathSync(target), path, 'junction');
  return path;
}

// A node_modules junction is removed on its own, before any directory around it (cmd /c rmdir on Windows).
function removeJunction(path) {
  if (!path) return;
  try {
    if (!lstatSync(path).isSymbolicLink()) return;
  } catch {
    return;
  }
  if (process.platform === 'win32') spawnSync('cmd', ['/c', 'rmdir', path.replaceAll('/', '\\')], { encoding: 'utf8' });
  else unlinkSync(path);
}

// A reporter that prints every failing test as one JSON line (file, name, message, expected, actual, and
// the test file's own stack frame, found in the WHOLE stack before it is cut to 4,000 characters).
const REPORTER_SOURCE = `export default async function* flagFlipReporter(source) {
  const plain = (value) => { try { return JSON.parse(JSON.stringify(value)); } catch { return String(value); } };
  for await (const event of source) {
    if (event.type === 'test:summary' && !event.data?.file) { yield JSON.stringify({ summary: event.data?.counts ?? null }) + '\\n'; continue; }
    if (event.type !== 'test:fail') continue;
    const data = event.data ?? {};
    const error = data.details?.error;
    const cause = error?.cause ?? error;
    const stack = String(cause?.stack ?? error?.stack ?? '');
    const base = String(data.file ?? '').split(/[\\\\/]/).pop();
    const frame = base ? (stack.split('\\n').find((line) => line.includes(base + ':')) ?? null) : null;
    yield JSON.stringify({ name: data.name, file: data.file, nesting: data.nesting, message: String(cause?.message ?? error?.message ?? '').slice(0, 1500), expected: plain(cause?.expected), actual: plain(cause?.actual), frame, stack: stack.slice(0, 4000) }) + '\\n';
  }
}
`;

// The whole suite as the release gate runs it (every tests/*.test.mjs, serially), or only `files`, with the
// cheap-assert preload that sits next to the reporter.
function runSuite(wt, reporterPath, files = null) {
  const preload = join(dirname(reporterPath), 'flip-cheap-assert.mjs');
  const testFiles = files ?? readdirSync(join(wt, 'tests')).filter((name) => name.endsWith('.test.mjs')).sort().map((name) => `tests/${name}`);
  rmSync(join(wt, 'apps', 'portal', 'dist'), { recursive: true, force: true });
  const started = Date.now();
  const result = spawnSync(process.execPath, ['--test', '--test-concurrency=1', `--test-reporter=${pathToFileURL(reporterPath).href}`, ...testFiles], { cwd: wt, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, timeout: 60 * 60_000, env: childEnv({ preload: existsSync(preload) ? preload : null }) });
  const failures = [];
  let summary = null;
  for (const line of String(result.stdout ?? '').split(/\r?\n/)) {
    if (!line.trim()) continue;
    let event;
    try { event = JSON.parse(line); } catch { continue; }
    if (event.summary !== undefined) {
      summary = event.summary;
      continue;
    }
    const file = relative(wt, event.file ?? '').split(sep).join('/');
    const lineNumber = testLineFromStack(event.frame, file) ?? testLineFromStack(event.stack, file);
    let source = null;
    if (lineNumber) {
      try { source = readFileSync(join(wt, file), 'utf8').split(/\r?\n/)[lineNumber - 1]?.trim() ?? null; } catch { source = null; }
    }
    failures.push({ file, name: event.name, nesting: event.nesting ?? 0, message: redact(event.message).slice(0, 600), expected: event.expected ?? null, actual: event.actual ?? null, line: lineNumber, source });
  }
  return { failures, summary, files: testFiles.length, exitCode: result.status, ms: Date.now() - started };
}

const keyOf = (failure) => `${failure.file} :: ${failure.name}`;

// The test that checks the committed checklist fails in both suites while this run regenerates it (the
// committed copy is stale by definition): it is neither an E4 update nor a flip update.
export const SELF_CHECK = Object.freeze({ file: 'tests/jackpot-rehearsal.test.mjs', name: 'the flag-flip dry run: the committed checklist is complete and made by this script' });
const isSelfCheck = (failure) => failure.file === SELF_CHECK.file && failure.name === SELF_CHECK.name;

// The no-op that stands in for a neutralised assertion (appended to the throwaway copy of a test file; a
// function declaration, so it is hoisted above every use).
export const FLIP_NOOP_SOURCE = 'function __flipNoop() { return new Proxy(function flipNoop() {}, { get: () => () => undefined, apply: () => undefined }); }';
export const MAX_PINNED_ASSERTIONS = 12;

// `assert.x(` or `assert(` at `line` (1-based) of `text` → the same call on the no-op. → the new text, or
// null when the line holds no assertion call (a failure from a helper: not neutralisable here).
export function neutraliseAssertion(text, line) {
  const lines = String(text).split('\n');
  const at = lines[line - 1];
  if (at === undefined) return null;
  const match = /\bassert(\.[A-Za-z]+)?\s*\(/.exec(at);
  if (!match) return null;
  lines[line - 1] = `${at.slice(0, match.index)}__flipNoop()${match[1] ?? ''}(${at.slice(match.index + match[0].length)}`;
  if (!lines.includes(FLIP_NOOP_SOURCE)) lines.push(FLIP_NOOP_SOURCE);
  return lines.join('\n');
}

// Every assertion `failure` (a top-level test the flip broke) stops at: re-run its file with each failing
// assertion neutralised in turn until the test passes. The file is restored afterwards.
function pinnedAssertions(wt, reporterPath, failure) {
  const path = join(wt, failure.file);
  const original = readFileSync(path, 'utf8');
  const assertions = [];
  let current = failure;
  let complete = false;
  let stoppedBecause = null;
  try {
    for (let round = 0; round < MAX_PINNED_ASSERTIONS; round += 1) {
      assertions.push({ line: current.line, source: current.source, message: current.message, expected: current.expected, actual: current.actual });
      if (!current.line) {
        stoppedBecause = 'the failure names no line of the test file';
        break;
      }
      const next = neutraliseAssertion(readFileSync(path, 'utf8'), current.line);
      if (next === null) {
        stoppedBecause = `line ${current.line} holds no assert call (a helper failed): update it by hand`;
        break;
      }
      writeFileSync(path, next, 'utf8');
      const rerun = runSuite(wt, reporterPath, [failure.file]);
      const again = rerun.failures.find((entry) => entry.name === failure.name && (entry.nesting ?? 0) === (failure.nesting ?? 0));
      if (!again) {
        complete = true;
        break;
      }
      if (again.line === current.line) {
        stoppedBecause = `line ${current.line} still fails once neutralised`;
        break;
      }
      current = again;
    }
    if (!complete && !stoppedBecause) stoppedBecause = `more than ${MAX_PINNED_ASSERTIONS} failing assertions`;
  } finally {
    writeFileSync(path, original, 'utf8');
  }
  return { assertions, complete, ...(stoppedBecause ? { stoppedBecause } : {}) };
}

// Failures of `after` that are not failures of `before` (the ones the step causes), top-level tests first.
export function causedFailures(before, after) {
  const known = new Set(before.map(keyOf));
  return after.filter((failure) => !known.has(keyOf(failure))).sort((a, b) => (a.nesting ?? 0) - (b.nesting ?? 0) || a.file.localeCompare(b.file) || String(a.name).localeCompare(String(b.name)));
}

function porcelain(cwd) {
  return git(['status', '--porcelain', '--untracked-files=all'], cwd).split(/\r?\n/).filter(Boolean).map((line) => ({ status: line.slice(0, 2).trim(), path: line.slice(3).replaceAll('"', '') }));
}

function readText(wt, path) {
  try { return readFileSync(join(wt, path), 'utf8'); } catch { return null; }
}

function dirtyTexts(wt) {
  return new Map(porcelain(wt).map((entry) => [entry.path, readText(wt, entry.path)]));
}

// The changed part of each changed line, with a little context: removed and added lines are paired in
// order and their common prefix and suffix trimmed, so a sentence changed inside a long generated line
// shows as that sentence (the literal a pinned test holds), not as the whole line.
export function changedSegments(beforeText, afterText, { context = 40, width = 320, limit = 12 } = {}) {
  const count = (text) => {
    const map = new Map();
    for (const line of String(text ?? '').split(/\r?\n/)) map.set(line, (map.get(line) ?? 0) + 1);
    return map;
  };
  const a = count(beforeText);
  const b = count(afterText);
  const minus = (x, y) => [...x.entries()].flatMap(([line, n]) => Array(Math.max(0, n - (y.get(line) ?? 0))).fill(line));
  const removed = minus(a, b).filter((line) => line.trim());
  const added = minus(b, a).filter((line) => line.trim());
  const clip = (text) => (text.length > width ? `${text.slice(0, width)}…` : text);
  const out = [];
  for (let index = 0; index < Math.max(removed.length, added.length) && out.length < limit; index += 1) {
    const before = removed[index] ?? null;
    const after = added[index] ?? null;
    if (before === null || after === null) {
      out.push({ before: before === null ? null : clip(redact(before.trim())), after: after === null ? null : clip(redact(after.trim())) });
      continue;
    }
    let start = 0;
    while (start < before.length && start < after.length && before[start] === after[start]) start += 1;
    let end = 0;
    while (end < before.length - start && end < after.length - start && before[before.length - 1 - end] === after[after.length - 1 - end]) end += 1;
    const from = Math.max(0, start - context);
    const cut = (text) => `${from > 0 ? '…' : ''}${text.slice(from, Math.min(text.length, text.length - end + context))}${end > context ? '…' : ''}`;
    out.push({ before: clip(redact(cut(before))), after: clip(redact(cut(after))) });
  }
  return out;
}

// A file's text at HEAD (null when it is not tracked).
function headText(wt, path) {
  const result = spawnSync('git', ['show', `HEAD:${path}`], { cwd: wt, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  return result.status === 0 ? result.stdout : null;
}

// The files a step changed relative to the previous state (a map of the dirty files then; any other file
// is as at HEAD), with their changed lines: the literals.
function changedFiles(wt, before, after) {
  const out = [];
  for (const [path, text] of after) {
    const previous = before.has(path) ? before.get(path) : headText(wt, path);
    if (previous === text) continue;
    out.push({ file: path, ...(previous === null ? { newFile: true } : {}), lines: lineChanges(previous ?? '', text ?? '', { limit: 12, width: 260 }), segments: changedSegments(previous ?? '', text ?? '') });
  }
  return out.sort((a, b) => a.file.localeCompare(b.file));
}

function applyEdits(wt, edits) {
  return edits.map((item) => {
    const path = join(wt, item.file);
    const text = readFileSync(path, 'utf8');
    const applied = applyTextEdit(text, item);
    if (applied.ok) writeFileSync(path, applied.text, 'utf8');
    const at = text.indexOf(item.find);
    return { file: item.file, line: at < 0 ? null : text.slice(0, at).split(NEWLINE).length, find: item.find.trimEnd(), replace: item.replace.trimEnd(), reason: item.reason, applied: applied.ok, error: applied.error };
  });
}

// Runbook E4, rehearsed: the Ranked suite deployed like production from the real deployer (impersonated) on
// an in-process chain, then the WeeklyJackpot from the real operator with the real admin, the launch rules
// and a fixture keeper (the E2 keeper does not exist yet). → the deployment-record.jackpot.json object.
async function deployLocalJackpotRecord(repoRoot) {
  const { activateLocalGames, deployLocalSuite, startLocalChain } = await import('./lib/local-chain.mjs');
  const { deployLocalJackpot, launchRules } = await import('./lib/local-jackpot.mjs');
  const config = JSON.parse(readFileSync(join(repoRoot, 'contracts', 'deploy-config.testnet.json'), 'utf8'));
  const chain = await startLocalChain();
  try {
    const deployer = await chain.impersonate(config.deployer);
    const developer = await chain.impersonate(config.developerWallet);
    const suite = await deployLocalSuite({ provider: chain.provider, wallets: { operator: deployer }, config });
    await activateLocalGames({ provider: chain.provider, record: suite, developer, operator: deployer });
    const deployed = await deployLocalJackpot({ provider: chain.provider, wallets: { operator: deployer, developer }, record: suite, admin: config.developerWallet, residualRecipient: config.developerWallet, rules: launchRules(suite) });
    return deployed.record;
  } finally {
    await chain.close();
  }
}

export async function runFlagFlipDryRun({ argv = process.argv.slice(2), log = console.log, repoRoot = root } = {}) {
  const guard = checkGuards({ argv, ...gitDirs(repoRoot) });
  if (!guard.ok) {
    log(guard.error.replaceAll('step-7', 'flag-flip'));
    return 2;
  }
  const testsIndex = argv.indexOf('--tests');
  const testsFlag = testsIndex >= 0 ? argv[testsIndex + 1] : null;
  const outIndex = argv.indexOf('--out');
  const out = outIndex >= 0 ? argv[outIndex + 1] : FLIP_CHECKLIST_RELATIVE_PATH;
  const head = git(['rev-parse', '--short=8', 'HEAD'], repoRoot);
  // Tracked changes (the checklist being written aside) are NOT in the throwaway, which is made from HEAD.
  const dirty = git(['status', '--porcelain', '--untracked-files=no'], repoRoot).split(/\r?\n/).filter(Boolean).some((line) => line.slice(3).trim() !== out);
  const base = mkdtempSync(join(tmpdir(), 'lesters-jackpot-flip-'));
  const wt = join(base, 'wt');
  scrub = pathScrubber([[wt, '<throwaway>'], [base, '<throwaway-base>'], [repoRoot, '<repo>'], [homedir(), '~']]);
  const reporter = join(base, 'flip-reporter.mjs');
  writeFileSync(reporter, REPORTER_SOURCE, 'utf8');
  writeFileSync(join(base, 'flip-cheap-assert.mjs'), CHEAP_ASSERT_SOURCE, 'utf8');
  const junctions = [];
  const report = {
    schema: FLIP_CHECKLIST_SCHEMA,
    generatedAt: new Date().toISOString(),
    head,
    dirty,
    scriptSha256: sha256Text(readFileSync(join(repoRoot, FLIP_SCRIPT_RELATIVE_PATH), 'utf8')),
    command: `node ${FLIP_SCRIPT_RELATIVE_PATH} --confirm-throwaway${testsFlag ? ` --tests ${testsFlag}` : ''}`,
    partial: Boolean(testsFlag),
    note: 'Throwaway worktree under the OS temp directory, removed at the end. Nothing was committed, pushed or deployed; the jackpot deployment record is a local Hardhat deploy from the real operator and admin addresses. JACKPOT_LIVE was flipped only in the throwaway copy. Local paths are written as <throwaway>, <repo> and ~.',
  };
  log(`flag-flip dry run: throwaway worktree under the OS temp directory (HEAD ${head})`);
  git(['worktree', 'add', '--detach', wt, 'HEAD'], repoRoot);
  try {
    junctions.push(junction(join(repoRoot, 'node_modules'), join(wt, 'node_modules')));
    junctions.push(junction(join(repoRoot, 'benchmarks', 'hmh-engine-bakeoff', 'node_modules'), join(wt, 'benchmarks', 'hmh-engine-bakeoff', 'node_modules')));
    const files = testsFlag ? testsFlag.split(',') : null;

    // 1. Runbook E4: the record, the module, the inventory; then the suite.
    log('1. E4 state: local jackpot deploy, record, module, curated inventory');
    const record = await deployLocalJackpotRecord(repoRoot);
    writeFileSync(join(wt, JACKPOT_RECORD_RELATIVE_PATH), `${JSON.stringify(record, null, 2)}\n`, 'utf8');
    const e4Commands = [run(GENERATE_MODULE_COMMAND, wt), run(INVENTORY_COMMAND, wt)];
    for (const command of e4Commands) if (command.exitCode !== 0) throw new Error(`${command.command} failed: ${tail(command.output, 5).join(' | ')}`);
    const e4Texts = dirtyTexts(wt);
    log(`   the suite at E4 (${files ? files.length : 'every'} test file(s))`);
    const e4Suite = runSuite(wt, reporter, files);
    const ledger = JSON.parse(readFileSync(join(wt, 'docs', 'hmh-reboot', 'LEGACY-TEST-RETIREMENT.json'), 'utf8')).failures.map((entry) => ({ file: entry.file, name: String(entry.assertion).replace(/ \([\d.]+ms\)$/, '') }));
    const ledgerKeys = new Set(ledger.map(keyOf));
    report.e4 = {
      what: 'runbook E4: contracts/deployment-record.jackpot.json (a local deploy) and the regenerated module and curated inventory, flag still false',
      commands: e4Commands.map((command) => ({ command: command.command, exitCode: command.exitCode, output: tail(command.output, 3) })),
      files: changedFiles(wt, new Map(), e4Texts).map((entry) => ({ file: entry.file, ...(entry.newFile ? { newFile: true } : {}), removed: entry.lines.removedCount, added: entry.lines.addedCount })),
      suite: { files: e4Suite.files, counts: e4Suite.summary, ms: e4Suite.ms },
      failuresOutsideLedger: e4Suite.failures.filter((failure) => (failure.nesting ?? 0) === 0 && !ledgerKeys.has(keyOf(failure)) && !isSelfCheck(failure)).map((failure) => ({ file: failure.file, name: failure.name, line: failure.line, message: failure.message })),
      selfCheckFailed: e4Suite.failures.some(isSelfCheck),
      note: 'These are the E4 commit\'s own test updates (the E4 session makes them with the record and the module); the flip below is measured against this state.',
    };

    // 2. The flip.
    log('2. the flip: JACKPOT_LIVE = true, the legal block confirmed, the pages rebuilt, the inventory');
    const edits = applyEdits(wt, FLIP_EDITS);
    for (const edit of edits) if (!edit.applied) throw new Error(`flip edit ${edit.file} not applied: ${edit.error}`);
    const build = run(BUILD_COMMAND, wt);
    const inventory = run(INVENTORY_COMMAND, wt);
    if (build.exitCode !== 0) throw new Error(`${BUILD_COMMAND} failed after the flip: ${tail(build.output, 5).join(' | ')}`);
    const flipTexts = dirtyTexts(wt);
    const flipFiles = changedFiles(wt, e4Texts, flipTexts);
    log(`   the suite after the flip (${files ? files.length : 'every'} test file(s))`);
    const flipSuite = runSuite(wt, reporter, files);
    const caused = causedFailures(e4Suite.failures, flipSuite.failures);
    const fixedByFlip = causedFailures(flipSuite.failures, e4Suite.failures);
    // A failure the flip caused must fail again when its file runs alone after the flip: one that passes
    // was a load flake of the whole-suite run (the machine may run other gates), never a test to update.
    const rerunByFile = new Map();
    const failsAlone = (failure) => {
      if (!rerunByFile.has(failure.file)) rerunByFile.set(failure.file, runSuite(wt, reporter, [failure.file]));
      return rerunByFile.get(failure.file).failures.some((entry) => keyOf(entry) === keyOf(failure));
    };
    const causedTop = caused.filter((failure) => (failure.nesting ?? 0) === 0);
    const topLevel = causedTop.filter(failsAlone);
    const flakes = causedTop.filter((failure) => !topLevel.includes(failure));
    log(`3. every pinned assertion of the ${topLevel.length} test(s) the flip breaks (each re-run with the failing assertion neutralised)${flakes.length ? `; ${flakes.length} flake(s) set aside` : ''}`);
    const pinned = topLevel.map((failure) => pinnedAssertions(wt, reporter, failure));
    report.flip = {
      edits,
      buildCommand: BUILD_COMMAND,
      build: { exitCode: build.exitCode, output: tail(build.output, 4) },
      inventoryCommand: INVENTORY_COMMAND,
      inventory: { exitCode: inventory.exitCode, output: tail(inventory.output, 2) },
      filesChanged: flipFiles.map((entry) => ({ file: entry.file, removed: entry.lines.removedCount, added: entry.lines.addedCount })),
      literalsChanged: flipFiles.filter((entry) => !entry.file.endsWith('hmh-curated-level-kit-runtime.mjs')).map((entry) => ({ file: entry.file, changes: entry.segments })),
      suite: { files: flipSuite.files, counts: flipSuite.summary, ms: flipSuite.ms },
      testsToUpdate: topLevel.map((failure, index) => ({
        file: failure.file, name: failure.name, line: failure.line, source: failure.source, message: failure.message, expected: failure.expected, actual: failure.actual,
        assertions: pinned[index].assertions, complete: pinned[index].complete, ...(pinned[index].stoppedBecause ? { stoppedBecause: pinned[index].stoppedBecause } : {}),
      })),
      subtestFailures: caused.length - causedTop.length,
      flakes: flakes.map((failure) => ({ file: failure.file, name: failure.name, message: failure.message, note: 'failed in the whole-suite run after the flip, passed when its file ran alone: not a test to update' })),
      passingOnlyAfterFlip: fixedByFlip.filter((failure) => (failure.nesting ?? 0) === 0).map((failure) => ({ file: failure.file, name: failure.name })),
    };
    report.checklist = {
      filesToEdit: [
        ...FLIP_EDITS.map((edit) => ({ file: edit.file, change: edit.replace ? `${edit.find} → ${edit.replace}` : `remove ${edit.find.trim()}`, why: edit.reason })),
        { file: 'every test listed in flip.testsToUpdate', change: 'update every assertion in its `assertions` (line, source, expected and actual, found by re-running the test with each failing assertion neutralised) to the live copy; a test whose `complete` is false needs a look past its `stoppedBecause`, so treat the list as at least these', why: 'contract §11 rule 10: pinned literals change in the same commit' },
      ],
      regenerate: [BUILD_COMMAND, INVENTORY_COMMAND],
      generatedFiles: report.flip.filesChanged.map((entry) => entry.file).filter((file) => !FLIP_EDITS.some((edit) => edit.file === file)),
      testsToUpdate: [...new Set(topLevel.map((failure) => failure.file))],
      preconditions: FLIP_PRECONDITIONS,
      commit: 'one commit: the two edits, the regenerated pages and inventory, and the listed test updates; then npm run test:release shows exactly the 51 ledgered failures (restore docs/testing/hmh-reboot-test-retirement-gate.json unless the orchestrator commits it)',
      release: 'the next version with a cache-marker bump, npm run vercel:build, deploy, promote (owner-approved, runbook E10 ⚠)',
      postReleaseSmokes: POST_RELEASE_SMOKES,
      rollback: 'set JACKPOT_UI_HIDDEN=true and redeploy the current release (surfaces disappear within about 150 s), then a release with JACKPOT_LIVE=false if the hide is long-term (emergency stop 6)',
    };
  } finally {
    for (const path of junctions) removeJunction(path);
    git(['worktree', 'remove', '--force', wt], repoRoot, { allowFail: true });
    git(['worktree', 'prune'], repoRoot, { allowFail: true });
    rmSync(base, { recursive: true, force: true });
  }
  const target = resolve(repoRoot, out);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  log(`checklist: ${relative(repoRoot, target).split(sep).join('/')} (${report.flip.testsToUpdate.length} test(s) to update, ${report.flip.filesChanged.length} file(s) changed by the flip)`);
  return 0;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) {
  runFlagFlipDryRun().then((code) => { process.exitCode = code; }, (error) => {
    console.error(`jackpot-flag-flip-dry-run: ${redact(error?.stack ?? error)}`);
    process.exitCode = 1;
  });
}
