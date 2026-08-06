import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const repoFile = (relative) => readFileSync(fileURLToPath(new URL(`../${relative}`, import.meta.url)), 'utf8');

test('P6 retires the hidden developer backstage and duplicate canvas sandbox from public markup', () => {
  const html = repoFile('apps/portal/index.html');
  assert.doesNotMatch(html, /id="developerBackstage(?:Toggle)?"/);
  assert.doesNotMatch(html, /id="combatCanvas"/);
  assert.doesNotMatch(html, /Local Combat Sandbox/);
});

test('P6 removes legacy runtime roots while preserving the isolated HMH Reboot mount', () => {
  const main = repoFile('apps/portal/main.js');
  assert.doesNotMatch(main, /applyRouteFromLocation\(\);\s*requestAnimationFrame\(drawCombatScene\);/);
  assert.doesNotMatch(main, /dom\.combatCanvas\.addEventListener/);
  assert.doesNotMatch(main, /dom\.developerBackstageToggle\.addEventListener/);
  assert.doesNotMatch(main, /HMH_REBOOT_ENABLED/);
  assert.match(main, /combatStatus: document\.querySelector\('#officialGameStateCopy'\)/);
  assert.match(main, /mountHmhRebootSession\(\)/);
  assert.match(main, /createHmhRebootHost/);
});

test('P6 removes the obsolete legacy browser soak command from the supported release surface', () => {
  const pkg = JSON.parse(repoFile('package.json'));
  assert.equal(pkg.scripts['test:soak:legacy'], undefined);
});
