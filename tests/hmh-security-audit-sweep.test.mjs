import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { buildSecurityAuditSweep } from '../scripts/hmh-security-audit-sweep.mjs';

function repoText(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

test('WO-39 security audit sweep passes static checks without findings', () => {
  const audit = buildSecurityAuditSweep();
  assert.equal(audit.summary.status, 'PASS', JSON.stringify(audit, null, 2));
  assert.equal(audit.summary.findingCount, 0);
  assert.ok(audit.scope.filesScanned > 20);
});

test('WO-39 sign-out modal avoids innerHTML and uses safe DOM construction', () => {
  const main = repoText('apps/portal/main.js');
  const modalStart = main.indexOf('function showSignOutConfirmModal()');
  const modalEnd = main.indexOf('function executeSignOut()');
  const modal = main.slice(modalStart, modalEnd);
  assert.equal(modal.includes('.innerHTML'), false);
  assert.equal(modal.includes('appendText(content'), true);
  assert.equal(modal.includes('modal.append(content)'), true);
});

test('WO-39 security report covers XSS, dynamic code, secrets, wallet, service worker, and avatars', () => {
  const script = repoText('scripts/hmh-security-audit-sweep.mjs');
  for (const marker of ['dom-xss-innerhtml', 'dynamic-code-eval', 'inline-secret-assignment', 'wallet-provider-readiness', 'service-worker-network-first-scripts', 'avatar-sanitization']) {
    assert.equal(script.includes(marker), true, `${marker} missing`);
  }
});

test('WO-39 syntax and verification gates include security audit sweep', () => {
  const packageJson = repoText('package.json');
  const syntaxCheck = repoText('scripts/syntax-check.mjs');
  assert.equal(packageJson.includes('design:security-audit'), true);
  assert.equal(syntaxCheck.includes('scripts/hmh-security-audit-sweep.mjs'), true);
  assert.equal(syntaxCheck.includes('tests/hmh-security-audit-sweep.test.mjs'), true);
});
