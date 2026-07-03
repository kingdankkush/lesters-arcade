import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  FABLE_MARKDOWN_CROSSWALK,
  renderFableMarkdownCrosswalk,
} from '../scripts/hmh-fable-markdown-crosswalk.mjs';

function repoText(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('Fable markdown crosswalk distinguishes completed WO sweep from remaining gated waves', () => {
  const markdown = renderFableMarkdownCrosswalk();
  assert.match(markdown, /^# Hard Money Heroes Fable Markdown Crosswalk/m);
  assert.match(markdown, /WO-30/);
  assert.match(markdown, /WO-41/);
  assert.match(markdown, /Wave 2 \/ EPIC 1/);
  assert.match(markdown, /remaining-major-work/);
  assert.match(markdown, /approval-gated/);
  assert.equal(FABLE_MARKDOWN_CROSSWALK.completedLocalWorkOrders.length >= 11, true);
});

test('Fable crosswalk is wired into design reports and syntax gate', () => {
  const packageJson = repoText('package.json');
  const syntaxCheck = repoText('scripts/syntax-check.mjs');

  assert.equal(packageJson.includes('design:fable-crosswalk'), true);
  assert.equal(syntaxCheck.includes('scripts/hmh-fable-markdown-crosswalk.mjs'), true);
  assert.equal(syntaxCheck.includes('tests/hmh-fable-markdown-crosswalk.test.mjs'), true);
});
