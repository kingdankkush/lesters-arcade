import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildNetworkConsoleAuditReport,
  sanitizeAuditUrl,
} from '../scripts/hmh-reboot-network-console-audit-lib.mjs';

test('network audit URLs preserve identity while redacting query values', () => {
  assert.equal(
    sanitizeAuditUrl('https://lestersarcade.io/hmh-reboot/?seed=424242&token=secret&mode=free'),
    'https://lestersarcade.io/hmh-reboot/?mode=[REDACTED]&seed=[REDACTED]&token=[REDACTED]',
  );
  assert.equal(sanitizeAuditUrl('data:text/plain,secret'), 'data:[REDACTED]');
});

test('network audit fail-closes on exact HTTP, request, console, and page failures', () => {
  const report = buildNetworkConsoleAuditReport({
    scenario: 'local-portal-clean',
    responses: [
      { url: 'http://127.0.0.1:8791/', status: 200, contentType: 'text/html', resourceType: 'document', fromServiceWorker: false },
      { url: 'http://127.0.0.1:8791/_vercel/insights/script.js', status: 404, contentType: 'text/html;charset=utf-8', resourceType: 'script', fromServiceWorker: false },
    ],
    requestFailures: [{ url: 'http://127.0.0.1:8791/broken.ogg', resourceType: 'media', errorText: 'net::ERR_FAILED' }],
    consoleMessages: [{ type: 'error', text: 'Failed to load resource' }],
    pageErrors: [{ message: 'boom' }],
    serviceWorkers: [{ scope: 'http://127.0.0.1:8791/', scriptUrl: 'http://127.0.0.1:8791/sw.js', state: 'activated' }],
  });
  assert.equal(report.ok, false);
  assert.deepEqual(report.summary, {
    responses: 2,
    httpErrors: 1,
    requestFailures: 1,
    consoleErrors: 1,
    pageErrors: 1,
    serviceWorkers: 1,
  });
  assert.equal(report.httpErrors[0].url, 'http://127.0.0.1:8791/_vercel/insights/script.js');
  assert.equal(report.httpErrors[0].status, 404);
  assert.equal(report.httpErrors[0].contentType, 'text/html;charset=utf-8');
});

test('network audit records a successful media metadata-range abort without hiding other failures', () => {
  const url = 'http://127.0.0.1:8791/assets/audio/playlist/theme.mp3';
  const report = buildNetworkConsoleAuditReport({
    scenario: 'portal-warm',
    responses: [{ url, status: 206, contentType: 'audio/mpeg', resourceType: 'media', fromServiceWorker: true }],
    requestFailures: [{ url, resourceType: 'media', errorText: 'net::ERR_ABORTED' }],
  });
  assert.equal(report.ok, true);
  assert.equal(report.failures.length, 0);
  assert.equal(report.expectedCancellations.length, 1);
  assert.equal(report.expectedCancellations[0].matchingResponseStatus, 206);
});

test('network audit accepts a normal-mode-safe response and service-worker set', () => {
  const report = buildNetworkConsoleAuditReport({
    scenario: 'production-hmh-warm',
    responses: [
      { url: 'https://lestersarcade.io/hmh-reboot/', status: 200, contentType: 'text/html; charset=utf-8', resourceType: 'document', fromServiceWorker: true },
      { url: 'https://lestersarcade.io/dist/hmh-reboot/game.js', status: 200, contentType: 'application/javascript', resourceType: 'script', fromServiceWorker: false },
    ],
    serviceWorkers: [{ scope: 'https://lestersarcade.io/', scriptUrl: 'https://lestersarcade.io/sw.js', state: 'activated' }],
  });
  assert.equal(report.ok, true);
  assert.equal(report.httpErrors.length, 0);
  assert.equal(report.failures.length, 0);
});
