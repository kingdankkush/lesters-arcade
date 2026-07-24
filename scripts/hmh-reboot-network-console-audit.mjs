import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '../benchmarks/hmh-engine-bakeoff/node_modules/playwright/index.mjs';
import { buildNetworkConsoleAuditReport, sanitizeAuditUrl } from './hmh-reboot-network-console-audit-lib.mjs';

const origin = new URL(process.env.HMH_REBOOT_ORIGIN ?? 'http://127.0.0.1:8791').origin;
const executablePath = process.env.HMH_REBOOT_BROWSER_EXECUTABLE
  ?? String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`;
const evidenceRoot = path.resolve(process.env.HMH_REBOOT_NETWORK_EVIDENCE_ROOT ?? '.hermes/evidence/hmh-aaa-cycle-001/network');
const settleMs = Number(process.env.HMH_REBOOT_NETWORK_SETTLE_MS ?? 1_500);

await mkdir(evidenceRoot, { recursive: true });
const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl'],
});

function attachCollector(page) {
  const responses = [];
  const requestFailures = [];
  const consoleMessages = [];
  const pageErrors = [];

  page.on('response', async (response) => {
    const request = response.request();
    const redirectedFrom = request.redirectedFrom();
    const headers = await response.allHeaders().catch(() => ({}));
    responses.push({
      url: sanitizeAuditUrl(response.url()),
      status: response.status(),
      contentType: headers['content-type'] ?? '',
      resourceType: request.resourceType(),
      fromServiceWorker: response.fromServiceWorker(),
      redirectedFrom: redirectedFrom ? sanitizeAuditUrl(redirectedFrom.url()) : null,
    });
  });
  page.on('requestfailed', (request) => {
    requestFailures.push({
      url: sanitizeAuditUrl(request.url()),
      resourceType: request.resourceType(),
      errorText: request.failure()?.errorText ?? 'unknown',
    });
  });
  page.on('console', (message) => {
    consoleMessages.push({ type: message.type(), text: message.text() });
  });
  page.on('pageerror', (error) => pageErrors.push({ message: error.message, stack: error.stack ?? '' }));

  return { responses, requestFailures, consoleMessages, pageErrors };
}

async function snapshotServiceWorkers(page) {
  return page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return [];
    const registrations = await navigator.serviceWorker.getRegistrations();
    return registrations.map((registration) => {
      const worker = registration.active ?? registration.waiting ?? registration.installing;
      return {
        scope: registration.scope,
        scriptUrl: worker?.scriptURL ?? '',
        state: worker?.state ?? 'missing',
        controlled: Boolean(navigator.serviceWorker.controller),
      };
    });
  });
}

async function auditPage({ context, scenario, pathname, waitFor }) {
  const page = await context.newPage();
  const collected = attachCollector(page);
  try {
    const response = await page.goto(`${origin}${pathname}`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    assert.ok(response, `${scenario} did not receive a navigation response`);
    assert.equal(response.status(), 200, `${scenario} navigation returned ${response.status()}`);
    if (waitFor) await page.waitForSelector(waitFor, { timeout: 30_000 });
    await page.waitForTimeout(settleMs);
    const serviceWorkers = await snapshotServiceWorkers(page);
    return buildNetworkConsoleAuditReport({ scenario, ...collected, serviceWorkers });
  } finally {
    await page.close();
  }
}

try {
  const reports = [];

  const cleanPortalContext = await browser.newContext({ serviceWorkers: 'allow' });
  try {
    reports.push(await auditPage({ context: cleanPortalContext, scenario: 'portal-clean', pathname: '/', waitFor: '#officialApp' }));
    const readinessPage = await cleanPortalContext.newPage();
    try {
      await readinessPage.goto(`${origin}/`, { waitUntil: 'domcontentloaded' });
      await readinessPage.evaluate(async () => {
        if ('serviceWorker' in navigator) await navigator.serviceWorker.ready;
      });
    } finally {
      await readinessPage.close();
    }
    reports.push(await auditPage({ context: cleanPortalContext, scenario: 'portal-warm', pathname: '/', waitFor: '#officialApp' }));
    reports.push(await auditPage({
      context: cleanPortalContext,
      scenario: 'hmh-warm',
      pathname: '/hmh-reboot/?evidenceSafe=1&combatPilot=1&telemetry=1&seed=424242',
      waitFor: '#hmhRebootStage canvas',
    }));
  } finally {
    await cleanPortalContext.close();
  }

  const cleanHmhContext = await browser.newContext({ serviceWorkers: 'block' });
  try {
    reports.push(await auditPage({
      context: cleanHmhContext,
      scenario: 'hmh-clean',
      pathname: '/hmh-reboot/?evidenceSafe=1&combatPilot=1&telemetry=1&seed=424242',
      waitFor: '#hmhRebootStage canvas',
    }));
  } finally {
    await cleanHmhContext.close();
  }

  const report = {
    generatedAt: new Date().toISOString(),
    origin,
    browserExecutable: executablePath,
    ok: reports.every((entry) => entry.ok),
    reports,
  };
  const reportPath = path.join(evidenceRoot, 'report.json');
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ reportPath, ok: report.ok, scenarios: reports.map((entry) => ({ scenario: entry.scenario, ok: entry.ok, summary: entry.summary, failures: entry.failures })) }, null, 2));
  assert.equal(report.ok, true, `network/console audit failed; inspect ${reportPath}`);
} finally {
  await browser.close();
}
