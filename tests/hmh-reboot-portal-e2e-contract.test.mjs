import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  auditPortalE2eFlowContract,
  PORTAL_E2E_FLOW_SCHEMA,
  PORTAL_E2E_FLOWS,
  PORTAL_E2E_REQUIRED_AREAS,
} from '../scripts/hmh-reboot-portal-e2e.mjs';

const CORE_IMPLEMENTED_FLOWS = [
  'guest-boot',
  'guest-free-run',
  'pause-resume',
  'mid-run-restart',
  'settings-persistence-reload',
  'guest-exit-to-splash',
];

test('portal E2E flow manifest passes its own audit and covers every master-plan area', () => {
  assert.equal(PORTAL_E2E_FLOW_SCHEMA, 'hmh-reboot-portal-e2e-flows-v1');
  const audit = auditPortalE2eFlowContract();
  assert.deepEqual(audit.errors, []);
  assert.equal(audit.ok, true);
  assert.ok(PORTAL_E2E_REQUIRED_AREAS.length >= 11, 'required area list must not silently shrink');
});

test('core guest flows are implemented, not deferred', () => {
  const implemented = new Set(PORTAL_E2E_FLOWS.filter((flow) => flow.status === 'implemented').map((flow) => flow.id));
  for (const id of CORE_IMPLEMENTED_FLOWS) {
    assert.ok(implemented.has(id), `core flow ${id} must be implemented`);
  }
});

test('every deferred flow states a substantive reason and claims real coverage areas', () => {
  for (const flow of PORTAL_E2E_FLOWS.filter((entry) => entry.status === 'deferred')) {
    assert.ok(flow.reason.length >= 20, `${flow.id} reason too thin`);
    assert.ok(flow.covers.every((area) => PORTAL_E2E_REQUIRED_AREAS.includes(area)));
  }
});

test('flow contract audit fails closed on duplicate ids, missing reasons, and unclaimed areas', () => {
  const duplicate = auditPortalE2eFlowContract({
    flows: [
      { id: 'a', status: 'implemented', description: 'x', covers: ['free-run'] },
      { id: 'a', status: 'implemented', description: 'x', covers: ['free-run'] },
    ],
    requiredAreas: ['free-run'],
  });
  assert.equal(duplicate.ok, false);
  assert.ok(duplicate.errors.some((error) => error.includes('duplicate flow id')));

  const thinReason = auditPortalE2eFlowContract({
    flows: [{ id: 'a', status: 'deferred', reason: 'later', covers: ['free-run'] }],
    requiredAreas: ['free-run'],
  });
  assert.equal(thinReason.ok, false);
  assert.ok(thinReason.errors.some((error) => error.includes('substantive reason')));

  const unclaimed = auditPortalE2eFlowContract({
    flows: [{ id: 'a', status: 'implemented', description: 'x', covers: ['free-run'] }],
    requiredAreas: ['free-run', 'ranked'],
  });
  assert.equal(unclaimed.ok, false);
  assert.ok(unclaimed.errors.some((error) => error.includes('required area ranked')));
});

test('harness module import stays side-effect free for the test runner', async () => {
  const source = await readFile(new URL('../scripts/hmh-reboot-portal-e2e.mjs', import.meta.url), 'utf8');
  assert.match(source, /const isMain = process\.argv\[1\]/, 'harness must gate execution behind a main-module check');
  assert.match(source, /await import\('\.\.\/benchmarks\/hmh-engine-bakeoff\/node_modules\/playwright\/index\.mjs'\)/, 'playwright must be imported lazily inside the main gate');
  assert.doesNotMatch(source.split('const isMain')[0], /chromium|launch\(/, 'no browser access before the main gate');
});
