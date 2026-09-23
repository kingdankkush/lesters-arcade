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

import { CABINET_MODE_SELECT_PRESENTATIONS, LESTERS_ARCADE_V2_APP_SHELL, buildGameModeSelectModel } from '../apps/portal/src/arcade-core.mjs';
import { portalCopyFor } from '../apps/portal/src/portal-content.mjs';
import { buildPortalPages, PORTAL_GENERATED_FILES } from '../scripts/build-portal-pages.mjs';

// The brief's sweep (D19), as a regular expression.
const PREVIEW_ONLY = /local ranked preview|stay on this device|remains safely gated|local ledger|not an online leaderboard|device-local|publishing remains disabled/i;
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

// Every file allowed to carry preview-only wording, and why it stays true.
const GENERATED = new Set(PORTAL_GENERATED_FILES.map((file) => `apps/portal/${file}`));
const ALLOWED = new Map([
  ['apps/portal/main.js', 'preview branches guarded by SETTLEMENT_LIVE (checked line by line below) and comments'],
  ['apps/portal/src/portal-content.mjs', 'the preview branch of each flag ternary (contract A33)'],
  ['apps/portal/src/leaderboard-view.mjs', 'LEADERBOARD_DEVICE_LOCAL_NOTICE and STACKED_LOCAL_NOTICE render only on the preview board (tests/hosted-leaderboard.test.mjs)'],
  ['apps/portal/src/routes/official-leaderboard-route.mjs', 'imports the preview notices for renderPreviewLeaderboard'],
  ['apps/portal/src/routes/official-profile-route.mjs', 'the device-local profile renders only when hosted is false (tests/hosted-profile.test.mjs)'],
  ['apps/portal/src/routes/official-play-routes.mjs', "the STACKED title's SETTLEMENT_LIVE-false branch (tests/official-play-routes.test.mjs)"],
  ['apps/portal/src/ranked-settlement.mjs', "the 'preview' state's line (a handle is 'preview' only when not live) and comments"],
  ['apps/portal/src/arcade-core.mjs', 'the brand icon legend (buildUiQualityGuideModel), which no view renders'],
  ['apps/portal/src/hmh-character-config.mjs', 'comments'],
  ['apps/portal/src/leaderboard-seed.mjs', 'comments'],
  ['apps/portal/src/name-claim-prompt.mjs', 'comments'],
  ['apps/portal/src/achievements/stats.mjs', 'comments'],
  ['apps/stacked/src/main.mjs', 'a comment, and "Practice medals stay on this device" (Free medals are local in both states)'],
]);

test('D19: preview-only wording appears only where the flags render it', () => {
  const offenders = [];
  for (const path of sourceFiles(join(root, 'apps'))) {
    const file = repoPath(path);
    const text = readFileSync(path, 'utf8');
    if (!PREVIEW_ONLY.test(text)) continue;
    if (GENERATED.has(file) || ALLOWED.has(file)) continue;
    offenders.push(file);
  }
  assert.deepEqual(offenders, [], 'make these flag-aware or true in both states');

  // main.js: every hit is a comment or sits in a SETTLEMENT_LIVE branch.
  const main = readFileSync(join(root, 'apps/portal/main.js'), 'utf8').replace(/\r\n/g, '\n');
  const lines = main.split('\n');
  lines.forEach((line, index) => {
    if (!PREVIEW_ONLY.test(line) || line.trim().startsWith('//')) return;
    const window = lines.slice(Math.max(0, index - 10), index + 1).join('\n');
    assert.match(window, /SETTLEMENT_LIVE/, `main.js:${index + 1} is guarded by the flag`);
  });
  // The pinned preview phrase stays in the preview branch only (ship-readiness).
  for (const match of main.matchAll(/verified on-chain publishing remains disabled/gi)) {
    const before = main.slice(Math.max(0, match.index - 400), match.index);
    assert.match(before, /!SETTLEMENT_LIVE|SETTLEMENT_LIVE\s*\?/, 'preview branch');
  }
  // The icon legend that keeps its preview label is never rendered.
  assert.doesNotMatch(main, /\brenderUiQualityGuide\(\);/);
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
