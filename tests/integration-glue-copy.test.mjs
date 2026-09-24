// integration-glue, items D14-D19: no public text may turn false when
// SETTLEMENT_LIVE and HOSTED_PROFILE_SYNC flip (guide §7 step 7). Preview
// wording is allowed only where it is rendered from the flags (a preview
// branch) or where the portal builder regenerates it from the flags; every
// other string reads true in both states.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';

import { CABINET_MODE_SELECT_PRESENTATIONS, LESTERS_ARCADE_V2_APP_SHELL, buildGameModeSelectModel } from '../apps/portal/src/arcade-core.mjs';
import { LEADERBOARD_DEVICE_LOCAL_NOTICE, STACKED_LOCAL_NOTICE } from '../apps/portal/src/leaderboard-view.mjs';
import { BANNER_TEXT } from '../apps/portal/src/ranked-results-model.mjs';
import { STACKED_RANKED_RESULT_COPY } from '../apps/portal/src/stacked-host.mjs';
import { portalCopyFor } from '../apps/portal/src/portal-content.mjs';
import { buildPortalPages, PORTAL_GENERATED_FILES } from '../scripts/build-portal-pages.mjs';

// The brief's sweep (D19) as a regular expression, widened to the variants
// the reviews found ("Device Local", "local Ranked boards", "this device's
// profile", "stays on this device", "settlement is off").
const PREVIEW_ONLY = /local ranked preview|stays? on this device|remains safely gated|local ledger|not an online leaderboard|device[ -]local|publishing remains disabled|local ranked boards?|this device['’]s profile|settlement is (?:off|disabled)/i;
const root = fileURLToPath(new URL('..', import.meta.url));
const repoPath = (path) => relative(root, path).split(sep).join('/');

function* sourceFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', 'generated', 'assets', 'vendor'].includes(entry.name)) continue;
      yield* sourceFiles(path);
    } else if (/\.(?:mjs|js|html|css|txt|json|webmanifest|xml)$/.test(entry.name) && statSync(path).size < 2_000_000) {
      yield path;
    }
  }
}

// The builder regenerates these from the flags (checked in the next test).
const GENERATED = new Set(PORTAL_GENERATED_FILES.map((file) => `apps/portal/${file}`));
// The identifiers that hold the flags in each module (default: the portal's).
const FLAG_NAMES = new Map([['apps/portal/src/portal-content.mjs', ['live', 'hosted']]]);
const DEFAULT_FLAG_NAMES = ['SETTLEMENT_LIVE', 'HOSTED_PROFILE_SYNC'];
// Exact strings allowed outside a flag branch, one entry per string, each
// with the reason it never reads false once the flags are on.
const ALLOWED = [
  { file: 'apps/portal/src/arcade-core.mjs', text: 'local Ranked preview score tracking', why: 'the brand icon legend (buildUiQualityGuideModel), which no view renders' },
  { file: 'apps/portal/src/arcade-core.mjs', text: 'Local progress, preview scores, achievements, and uploads are assigned to the connected wallet. No score transaction is sent while verified settlement is disabled.', why: 'walletLockCopy, which never reaches a page (tests/portal-copy.test.mjs); portalCopyFor owns the rendered note' },
  { file: 'apps/portal/src/leaderboard-view.mjs', text: LEADERBOARD_DEVICE_LOCAL_NOTICE, why: 'renders only on the preview board (tests/hosted-leaderboard.test.mjs)' },
  { file: 'apps/portal/src/leaderboard-view.mjs', text: STACKED_LOCAL_NOTICE, why: 'renders only on the preview board (tests/hosted-leaderboard.test.mjs)' },
  { file: 'apps/portal/src/routes/official-profile-route.mjs', text: 'These are device-local gameplay facts, not verified on-chain stats. Ticks use 60 Hz; elapsed ms are milliseconds; distance milli is 1/1000 world unit; permille is parts per thousand. Litecoin is an in-game collectible count, not a wallet balance. Upgrade counts describe the final build, not a chronological selection history. Missing older-version fields are not reconstructed.', why: 'the device-local profile renders only when hosted is false (tests/hosted-profile.test.mjs)' },
  { file: 'apps/portal/src/routes/official-profile-route.mjs', text: 'Device-local', why: 'the device-local profile renders only when hosted is false' },
  { file: 'apps/portal/src/routes/official-profile-route.mjs', text: 'Device-local preview', why: 'the device-local profile renders only when hosted is false' },
  { file: 'apps/portal/src/ranked-settlement.mjs', text: 'Canonical Ranked preview saved locally. No transaction was sent; verified on-chain publishing remains disabled.', why: "the 'preview' state's line; a handle is 'preview' only when not live" },
  { file: 'apps/portal/src/ranked-results-model.mjs', text: BANNER_TEXT.preview, why: "the 'preview' banner; a handle is 'preview' only when not live" },
  { file: 'apps/portal/src/ranked-results-model.mjs', text: 'Your run stays on this device. Free Mode is always open.', why: "the 'preview' banner's detail" },
  { file: 'apps/portal/src/stacked-host.mjs', text: STACKED_RANKED_RESULT_COPY.preview, why: 'stackedRankedResultCopy picks it only when settlementLive is false' },
  { file: 'apps/stacked/src/main.mjs', text: 'Free Mode is active. Practice medals stay on this device.', why: 'Free medals are local in both states' },
  { file: 'apps/stacked/src/main.mjs', text: 'Take your time. This Free run stays on this device.', why: 'the Free pause overlay; Free runs are local in both states' },
];

// Every string literal and template (its static text) with the path of
// (parent node, property) pairs that leads to it. Comments are not nodes.
function* stringsWithPath(node, path = []) {
  if (node.type === 'Literal' && typeof node.value === 'string') yield { value: node.value, node, path };
  if (node.type === 'TemplateLiteral') yield { value: node.quasis.map((quasi) => quasi.value.cooked ?? quasi.value.raw).join('…'), node, path };
  for (const [key, child] of Object.entries(node)) {
    if (key === 'loc' || !child || typeof child !== 'object') continue;
    for (const item of Array.isArray(child) ? child : [child]) {
      if (item && typeof item.type === 'string') yield* stringsWithPath(item, [...path, { node, key }]);
    }
  }
}

// A preview branch: the alternate of `FLAG ? … : …` / `if (FLAG) … else …`,
// or the consequent of `!FLAG ? … : …` / `if (!FLAG) …`.
function inPreviewBranch(path, flags) {
  const flagTest = (testNode) => {
    if (testNode?.type === 'Identifier' && flags.includes(testNode.name)) return 'on';
    if (testNode?.type === 'UnaryExpression' && testNode.operator === '!' && testNode.argument?.type === 'Identifier' && flags.includes(testNode.argument.name)) return 'off';
    return null;
  };
  return path.some(({ node, key }) => {
    if (node.type !== 'ConditionalExpression' && node.type !== 'IfStatement') return false;
    const kind = flagTest(node.test);
    return (kind === 'on' && key === 'alternate') || (kind === 'off' && key === 'consequent');
  });
}

function parseSource(text) {
  try { return parse(text, { ecmaVersion: 'latest', sourceType: 'module' }); } catch { return parse(text, { ecmaVersion: 'latest', sourceType: 'script' }); }
}

// Every preview-only string in apps/, with how it is accounted for.
function previewOnlyStrings() {
  const found = [];
  for (const path of sourceFiles(join(root, 'apps'))) {
    const file = repoPath(path);
    const text = readFileSync(path, 'utf8');
    if (!PREVIEW_ONLY.test(text) || GENERATED.has(file)) continue;
    if (/\.(?:mjs|js)$/.test(file)) {
      const flags = FLAG_NAMES.get(file) ?? DEFAULT_FLAG_NAMES;
      for (const { value, path: nodePath } of stringsWithPath(parseSource(text))) {
        if (!PREVIEW_ONLY.test(value)) continue;
        found.push({ file, value, flagged: inPreviewBranch(nodePath, flags) });
      }
    } else {
      for (const line of text.split(/\r?\n/)) if (PREVIEW_ONLY.test(line)) found.push({ file, value: line.trim(), flagged: false });
    }
  }
  return found;
}

test('D19: preview-only wording appears only in a flag branch or as an allowed string', () => {
  const found = previewOnlyStrings();
  const allowed = (hit) => ALLOWED.some((entry) => entry.file === hit.file && entry.text === hit.value);
  const offenders = found.filter((hit) => !hit.flagged && !allowed(hit)).map((hit) => `${hit.file}: ${hit.value}`);
  assert.deepEqual(offenders, [], 'make these flag-aware or true in both states');
  // Every allowed entry still names a string that exists (no stale entries).
  const stale = ALLOWED.filter((entry) => !found.some((hit) => hit.file === entry.file && hit.value === entry.text));
  assert.deepEqual(stale.map((entry) => `${entry.file}: ${entry.text}`), []);
  for (const entry of ALLOWED) assert.match(entry.text, PREVIEW_ONLY, 'an allowed entry is itself a preview-only string');
  // main.js: every preview-only string sits in a SETTLEMENT_LIVE or
  // HOSTED_PROFILE_SYNC preview branch, including the ship-readiness phrase.
  const mainHits = found.filter((hit) => hit.file === 'apps/portal/main.js');
  assert.ok(mainHits.length >= 4, 'the main.js preview lines are found');
  assert.deepEqual(mainHits.filter((hit) => !hit.flagged).map((hit) => hit.value), []);
  assert.ok(mainHits.some((hit) => /verified on-chain publishing remains disabled/i.test(hit.value)));
  // The icon legend that keeps its preview label is never rendered.
  const main = readFileSync(join(root, 'apps/portal/main.js'), 'utf8');
  assert.doesNotMatch(main, /\brenderUiQualityGuide\(\);/);
});

test('D19: the sweep sees a preview string in a live branch, and a new string in an allowed file', () => {
  const hitsOf = (source, flags = DEFAULT_FLAG_NAMES) => [...stringsWithPath(parseSource(source))]
    .filter(({ value }) => PREVIEW_ONLY.test(value)).map(({ value, path }) => [value, inPreviewBranch(path, flags)]);
  // The review's mutations: the live branch showing preview text, and an if/else.
  assert.deepEqual(hitsOf("const a = `Play Again starts a fresh ${SETTLEMENT_LIVE ? 'local Ranked preview' : 'verified Ranked session'}.`;"), [['local Ranked preview', false]]);
  assert.deepEqual(hitsOf("const a = `Play Again starts a fresh ${SETTLEMENT_LIVE ? 'verified Ranked session' : 'local Ranked preview'}.`;"), [['local Ranked preview', true]]);
  assert.deepEqual(hitsOf("if (!SETTLEMENT_LIVE) x = 'Kept in the local ledger.'; else y = 'Kept in the local ledger.';"), [['Kept in the local ledger.', true], ['Kept in the local ledger.', false]]);
  assert.deepEqual(hitsOf("// a local ledger comment\nconst b = 1;"), [], 'comments are not strings');
  // A new live-state string in an allowed file is not covered by its entries.
  const queued = { file: 'apps/portal/src/ranked-settlement.mjs', value: 'Run verified and kept in the local ledger; it will stay on this device.' };
  assert.equal(ALLOWED.some((entry) => entry.file === queued.file && entry.text === queued.value), false);
  // The Chikun variants the first sweep missed.
  for (const text of ['Ranked Preview · Device Local', 'for this device’s profile and local Ranked boards', 'Nothing is charged while verified settlement is off.']) assert.match(text, PREVIEW_ONLY, text);
});

// The Chikun child is never told the settlement flags (its bridge settings
// carry none), so its Ranked start screen shows one text in both states and
// that text must be true in both: replayed inputs, the player's profile and
// the Ranked boards are true of the device-local preview and of LitVM.
test('D19: the Chikun child’s Ranked start screen reads true with the flags off and on', () => {
  const source = readFileSync(join(root, 'apps/chikun/src/main.mjs'), 'utf8');
  const ast = parseSource(source);
  const fn = ast.body.find((node) => node.type === 'FunctionDeclaration' && node.id?.name === 'setModePresentation');
  assert.ok(fn, 'setModePresentation');
  const ranked = [];
  (function walk(node) {
    if (node.type === 'ConditionalExpression' && node.test.type === 'Identifier' && node.test.name === 'ranked' && node.consequent.type === 'Literal' && typeof node.consequent.value === 'string') ranked.push(node.consequent.value);
    for (const child of Object.values(node)) for (const item of Array.isArray(child) ? child : [child]) if (item && typeof item.type === 'string') walk(item);
  })(fn);
  assert.deepEqual(ranked, [
    'Ranked Mode · Verified Flight',
    'Collect Litecoin and skim the edges for bonuses. Lester’s Arcade replays your inputs before the run counts toward your profile and the Ranked boards.',
  ]);
  for (const text of ranked) {
    assert.doesNotMatch(text, PREVIEW_ONLY, text);
    assert.doesNotMatch(text, /preview|device|local|LitVM|on-chain|global|published/i, 'names neither state');
  }
  assert.doesNotMatch(source, /settlementLive|SETTLEMENT_LIVE|hostedProfileSync|HOSTED_PROFILE_SYNC/, 'the child cannot branch on the flags');
});

test('D19: the launch copy and the pages the builder writes at the flip say nothing preview-only', () => {
  const launch = portalCopyFor({ settlementLive: true, hostedProfileSync: true });
  assert.doesNotMatch(JSON.stringify(launch), PREVIEW_ONLY);
  const dir = mkdtempSync(join(tmpdir(), 'integration-glue-pages-'));
  try {
    buildPortalPages({ flags: 'live', outDir: dir });
    for (const file of PORTAL_GENERATED_FILES) {
      const text = readFileSync(join(dir, file), 'utf8');
      assert.doesNotMatch(text, PREVIEW_ONLY, file);
      assert.doesNotMatch(text, /Local Ranked Preview|No fees, prizes or online ranking/i, file);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('D19: the prerendered Ranked entry modal follows the flags, and main.js shows the same live text', () => {
  const preview = portalCopyFor({ settlementLive: false, hostedProfileSync: false });
  const launch = portalCopyFor({ settlementLive: true, hostedProfileSync: true });
  const index = readFileSync(join(root, 'apps/portal/index.html'), 'utf8');
  const block = (html, key) => new RegExp(`<!-- copy:${key}:start -->([\\s\\S]*?)<!-- copy:${key}:end -->`).exec(html)?.[1];
  // Committed pages are the preview state (the ship-readiness phrase included).
  assert.equal(block(index, 'entry-copy'), preview.rankedEntryCopy.replace(/'/g, '&#39;'));
  assert.equal(block(index, 'entry-footnote'), preview.rankedEntryFootnote.replace(/'/g, '&#39;'));
  assert.match(preview.rankedEntryCopy, /Verified on-chain publishing remains disabled/);
  // The live strings main.js writes into the modal when it opens are the launch copy.
  const main = readFileSync(join(root, 'apps/portal/main.js'), 'utf8');
  assert.ok(main.includes(`copyNode.textContent = '${launch.rankedEntryCopy}'`), 'main.js live lead');
  assert.ok(main.includes(`footnote.textContent = '${launch.rankedEntryFootnote}'`), 'main.js live footnote');
  assert.match(launch.rankedEntryCopy, /publishes your score on LitVM/);
});

test('D16: the game descriptors read true in both states, and every game needs zkLTC for Ranked', () => {
  for (const [gameId, presentation] of Object.entries(CABINET_MODE_SELECT_PRESENTATIONS)) {
    for (const text of [presentation.copy, presentation.free.copy, presentation.ranked.copy]) {
      assert.doesNotMatch(text, PREVIEW_ONLY, gameId);
      assert.doesNotMatch(text, /no fees|online ranking/i, gameId);
    }
    assert.equal(presentation.ranked.requiresZkLtc, true, `${gameId}: the faucet link shows once settlement is live`);
  }
  for (const cabinet of LESTERS_ARCADE_V2_APP_SHELL.cabinets) {
    assert.doesNotMatch(cabinet.description, PREVIEW_ONLY, cabinet.id);
    assert.doesNotMatch(cabinet.description, /no fees|online ranking/i, cabinet.id);
  }
  assert.equal(buildGameModeSelectModel('chikun').ranked.requiresZkLtc, true);
});

test('D17: the STACKED Scores shelf note is true in both states', () => {
  const page = readFileSync(join(root, 'apps/portal/stacked/index.html'), 'utf8');
  const note = /<p id="scoreNote" class="fine-print">([^<]*)<\/p>/.exec(page)?.[1];
  assert.equal(note, 'Practice scores and medals are kept on this device. Ranked results are on your arcade profile.');
  assert.doesNotMatch(page, /local ledger|Nothing here leaves this device/);
  // The shelf lists practice best, Free runs and medals, all local in both states.
  assert.match(page, /<dt>Practice best<\/dt>[\s\S]*<dt>Free runs<\/dt>[\s\S]*<dt>Medals<\/dt>/);
});
