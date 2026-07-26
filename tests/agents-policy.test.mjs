import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const agents = readFileSync(new URL('../AGENTS.md', import.meta.url), 'utf8');
const syntaxSource = readFileSync(new URL('../scripts/syntax-check.mjs', import.meta.url), 'utf8');

test('WO-67 AGENTS documents render-layer visual verification policy', () => {
  assert.match(agents, /Render-layer visual verification/);
  assert.match(agents, /npm run visual:reboot/);
  assert.match(agents, /npm run visual:reboot:accept/);
  assert.match(agents, /ground plane|ground-plane/);
  assert.match(agents, /prop grounding/);
  assert.match(agents, /depth sort|depth sorting/);
  assert.match(agents, /VISUAL_BASELINES/);
  assert.match(agents, /do not rely on screenshots alone/i);
  assert.match(agents, /commit.*baseline/i);
});

test('WO-67 AGENTS policy test is included in the explicit syntax gate', () => {
  assert.match(syntaxSource, /tests\/agents-policy\.test\.mjs/);
});
