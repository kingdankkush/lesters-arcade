import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { buildIntegrityBoundsArtifact } from '../scripts/write-hmh-integrity-bounds.mjs';

test('generated integrity bounds are byte-stable with the runtime-derived ruleset', () => {
  const saved = readFileSync(new URL('../docs/security/hmh-integrity-bounds.json', import.meta.url), 'utf8');
  assert.equal(saved, `${JSON.stringify(buildIntegrityBoundsArtifact(), null, 2)}\n`);
});
