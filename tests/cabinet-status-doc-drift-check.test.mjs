import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  assertCabinetStatusDocs,
  checkDocForStaleClaims,
  checkRosterRow,
  loadCabinetManifests,
  parseReadmeRoster,
} from '../scripts/cabinet-status-doc-drift-check.mjs';

const CHIKUN = {
  id: 'chikun',
  name: "Chikun's Escape",
  version: '0.5.0',
  status: 'playable',
  rankedEligible: true,
};

const TEMPLATE = {
  id: 'template-cabinet',
  name: 'Template Cabinet',
  version: '1.0.0',
  status: 'disabled',
  rankedEligible: false,
};

function roster(stateCell = 'Public playable, Ranked-eligible (`0.5.0`)') {
  return [
    '## Current game roster',
    '',
    '| Cabinet | Game ID | State | Summary |',
    '| --- | --- | --- | --- |',
    `| Chikun's Escape | \`chikun\` | ${stateCell} | Third-party one-button arcade |`,
    '| Future cabinets | Various | Coming Soon | Portal expansion slots |',
    '',
  ].join('\n');
}

async function scaffold(readmeSource, extraDocs = {}) {
  const repoRoot = await mkdtemp(path.join(tmpdir(), 'lesters-cabinet-doc-gate-'));
  const manifestDir = path.join(repoRoot, 'apps', 'portal', 'games');
  await mkdir(path.join(manifestDir, 'chikun'), { recursive: true });
  await mkdir(path.join(manifestDir, 'template-cabinet'), { recursive: true });
  await writeFile(
    path.join(manifestDir, 'chikun', 'game.manifest.json'),
    JSON.stringify(CHIKUN),
    'utf8',
  );
  await writeFile(
    path.join(manifestDir, 'template-cabinet', 'game.manifest.json'),
    JSON.stringify(TEMPLATE),
    'utf8',
  );
  await writeFile(path.join(repoRoot, 'README.md'), readmeSource, 'utf8');
  for (const [relative, contents] of Object.entries(extraDocs)) {
    const target = path.join(repoRoot, relative);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, contents, 'utf8');
  }
  return { repoRoot, manifestDir };
}

test('roster parsing keys rows by cabinet name and skips the header separator', () => {
  const rows = parseReadmeRoster(roster());
  assert.deepEqual([...rows.keys()], ["Chikun's Escape", 'Future cabinets']);
  assert.equal(rows.get("Chikun's Escape").gameId, '`chikun`');
  assert.equal(rows.get('Future cabinets').state, 'Coming Soon');
});

test('roster parsing fails closed when the table is absent', () => {
  assert.throws(() => parseReadmeRoster('# Lesters Arcade\n\nNo table here.\n'), /Current game roster/);
});

test('a playable cabinet described as Coming Soon is a roster failure', () => {
  const problems = checkRosterRow(CHIKUN, { state: 'Coming Soon' });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /manifest status `playable`/);
});

test('a non-playable cabinet described as shipped is a roster failure', () => {
  const problems = checkRosterRow(TEMPLATE, { state: 'Public playable' });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /not `playable`/);
});

test('a stated roster version must match the manifest, and an absent one is allowed', () => {
  assert.deepEqual(checkRosterRow(CHIKUN, { state: 'Public playable (`0.5.0`)' }), []);
  assert.deepEqual(checkRosterRow(CHIKUN, { state: 'Public playable' }), []);
  const problems = checkRosterRow(CHIKUN, { state: 'Public playable (`0.4.0`)' });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /records version `0\.4\.0`.*manifest is `0\.5\.0`/);
});

test('a missing roster row for a cabinet is reported by name and manifest id', () => {
  const problems = checkRosterRow(CHIKUN, undefined);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /no row for cabinet "Chikun's Escape" \(manifest `chikun`\)/);
});

// This is the exact prose that sat in docs/THIRD_PARTY_GAME_ONBOARDING.md for
// six days after Chikun went public. The gate exists to make it impossible.
test('the historical stale onboarding claim is caught by name and by section heading', () => {
  const stale = [
    '## 5. Chikun\'s Escape — Reference Implementation',
    '',
    "Chikun's Escape is the first third-party game being onboarded, but it is **not public-playable yet**.",
    '3. Public users without the flag see a desaturated COMING SOON cabinet and no leaderboard filter.',
  ].join('\n');
  const problems = checkDocForStaleClaims('docs/THIRD_PARTY_GAME_ONBOARDING.md', stale, [CHIKUN]);
  assert.equal(problems.length, 2);
  assert.match(problems[0], /:3 claims `chikun` is not public/);
  // Line 4 never names Chikun; it inherits its subject from the heading, which
  // is precisely why the six-day rot went unnoticed.
  assert.match(problems[1], /:4 claims `chikun` is not public.*\(scoped by heading/);
});

test('a coming-soon line under an unrelated heading is not a failure', () => {
  const benign = [
    '## Current game roster',
    '',
    '| Future cabinets | Various | Coming Soon | Portal expansion slots |',
  ].join('\n');
  assert.deepEqual(checkDocForStaleClaims('README.md', benign, [CHIKUN]), []);
});

test('a heading resets scope so an earlier cabinet section does not leak forward', () => {
  const doc = [
    "## Chikun's Escape",
    '',
    'Public playable.',
    '',
    '## Future cabinets',
    '',
    'These are Coming Soon.',
  ].join('\n');
  assert.deepEqual(checkDocForStaleClaims('README.md', doc, [CHIKUN]), []);
});

test('manifests load sorted by id and reject a manifest missing its canonical fields', async (t) => {
  const { repoRoot, manifestDir } = await scaffold(roster());
  t.after(() => rm(repoRoot, { recursive: true, force: true }));

  const manifests = await loadCabinetManifests(manifestDir);
  assert.deepEqual(manifests.map((manifest) => manifest.id), ['chikun', 'template-cabinet']);

  await mkdir(path.join(manifestDir, 'broken'), { recursive: true });
  await writeFile(
    path.join(manifestDir, 'broken', 'game.manifest.json'),
    JSON.stringify({ name: 'No ID Cabinet' }),
    'utf8',
  );
  await assert.rejects(() => loadCabinetManifests(manifestDir), /missing its canonical/);
});

test('the full gate passes truthful docs and rejects the stale onboarding doc', async (t) => {
  const onboardingPath = path.join('docs', 'THIRD_PARTY_GAME_ONBOARDING.md');
  const truthful = {
    'AGENTS.md': "Chikun's Escape is public playable and Ranked-eligible.\n",
    [onboardingPath]: "Chikun's Escape is public-playable and Ranked-eligible.\n",
  };
  const { repoRoot, manifestDir } = await scaffold(roster(), truthful);
  t.after(() => rm(repoRoot, { recursive: true, force: true }));

  const governedDocs = ['README.md', 'AGENTS.md', onboardingPath];
  const result = await assertCabinetStatusDocs({ repoRoot, manifestDir, governedDocs });
  assert.deepEqual(result.playableManifests.map((manifest) => manifest.id), ['chikun']);

  await writeFile(
    path.join(repoRoot, onboardingPath),
    "Chikun's Escape is the first third-party game being onboarded, but it is **not public-playable yet**.\n",
    'utf8',
  );
  await assert.rejects(
    () => assertCabinetStatusDocs({ repoRoot, manifestDir, governedDocs }),
    /Cabinet status documentation drift[\s\S]*not public/,
  );
});

test('the gate rejects a README roster that regresses a playable cabinet to Coming Soon', async (t) => {
  const { repoRoot, manifestDir } = await scaffold(roster('Coming Soon'), {
    'AGENTS.md': 'No cabinet claims here.\n',
  });
  t.after(() => rm(repoRoot, { recursive: true, force: true }));

  await assert.rejects(
    () => assertCabinetStatusDocs({ repoRoot, manifestDir, governedDocs: ['README.md', 'AGENTS.md'] }),
    /manifest status `playable`/,
  );
});

test('the repository as committed satisfies its own cabinet status gate', async () => {
  const result = await assertCabinetStatusDocs();
  assert.equal(result.playableManifests.length >= 1, true);
  const ids = result.playableManifests.map((manifest) => manifest.id).sort();
  assert.deepEqual(ids, ['chikun', 'hard-money-heroes']);
});
