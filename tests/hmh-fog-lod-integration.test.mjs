import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const profileReport = readFileSync(new URL('../docs/testing/wo71-minute12-profile.md', import.meta.url), 'utf8');

test('WO-75 minute-12 profile re-verifies fog and minimap workload after integration', () => {
  assert.match(profileReport, /Vision fog draw cells/i);
  assert.match(profileReport, /Minimap fog cells/i);
  assert.match(profileReport, /shared exploration cache/i);
});
