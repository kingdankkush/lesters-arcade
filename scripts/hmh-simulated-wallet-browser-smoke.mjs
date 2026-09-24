// U11a browser check: the simulated-wallet fallback.
//
// The reboot visual gate screenshots the canvas only, so it is blind to every
// DOM surface in the portal shell. This slice is entirely DOM, which means
// without a check of its own it would ship unverified. Headless Chrome injects
// no EIP-1193 provider, so simply clicking Sign in exercises the exact
// fallback path a real visitor without a wallet hits: with no wallet at all
// (no EIP-6963 announcement, no window.ethereum, and WalletConnect not offered
// on localhost), the portal signs in the simulated local identity directly and
// never opens the wallet picker (signin-entry slice, contract §7.6).
//
// Serve apps/portal as the web root, then:
//   HMH_PORTAL_ORIGIN=http://127.0.0.1:8809 node scripts/hmh-simulated-wallet-browser-smoke.mjs
import assert from 'node:assert/strict';
import { chromium } from '../benchmarks/hmh-engine-bakeoff/node_modules/playwright/index.mjs';

const origin = process.env.HMH_PORTAL_ORIGIN ?? 'http://127.0.0.1:8899';

// The settlement flag the served portal carries (apps/portal/src/settlement.mjs is served as a static
// file): true, false, or null when it cannot be read. The preview assertions hold only while it is false.
async function servedSettlementLive(origin) {
  try {
    const response = await fetch(new URL('/src/settlement.mjs', origin), { cache: 'no-store' });
    if (!response.ok) return null;
    const match = /export const SETTLEMENT_LIVE = (true|false);/.exec(await response.text());
    return match ? match[1] === 'true' : null;
  } catch {
    return null;
  }
}
if (await servedSettlementLive(origin) === true) {
  console.error(`${origin} serves SETTLEMENT_LIVE = true. This smoke checks the preview fallback (both flags off) only.`);
  process.exit(2);
}

const browser = await chromium.launch({
  executablePath: String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`,
  headless: true,
});

const findings = {};

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const consoleWarnings = [];
  const issues = [];
  const apiRequests = [];
  page.on('console', (message) => {
    if (message.type() === 'warning') consoleWarnings.push(message.text());
    if (message.type() === 'error') issues.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => issues.push(`pageerror: ${error.message}`));
  page.on('response', (response) => {
    if (response.status() >= 400) issues.push(`http ${response.status()} ${response.url()}`);
  });
  page.on('requestfailed', (request) => {
    const failure = request.failure()?.errorText ?? 'failed';
    // A view that drops an image or media load cancels it (ERR_ABORTED); that is not a failed request.
    if (/ERR_ABORTED/.test(failure) && request.method() === 'GET' && !new URL(request.url()).pathname.startsWith('/api/')) return;
    issues.push(`requestfailed: ${request.url()} ${failure}`);
  });
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/')) apiRequests.push(request.url());
  });

  await page.goto(`${origin}/`, { waitUntil: 'networkidle' });

  // Precondition: no injected provider, so this really is the fallback path and
  // not an accidental pass against some stubbed wallet.
  const hasProvider = await page.evaluate(() => Boolean(globalThis.ethereum?.request));
  assert.equal(hasProvider, false, 'expected no injected provider in headless Chrome');

  findings.signInLabel = (await page.textContent('#officialConnectButton'))?.trim();
  assert.equal(findings.signInLabel, 'Sign in', 'the splash offers Sign in');
  assert.doesNotMatch(await page.locator('body').innerText(), /Connect Wallet/i, 'the shell says Sign in, not Connect Wallet');

  // Before signing in, the preview Profile is the guest card with its 'Sign in to Save Progress' call
  // (the hosted profile, with both flags on, says 'Sign in to open your verified profile' instead).
  await page.click('#officialNavTabs a.official-nav-tab[href="/profile"]');
  const guestCard = page.locator('.profile-guest-card');
  await guestCard.waitFor({ state: 'visible', timeout: 10_000 });
  findings.guestProfileCta = (await guestCard.locator('button.profile-action-primary').textContent())?.trim();
  assert.equal(findings.guestProfileCta, 'Sign in to Save Progress');
  assert.doesNotMatch(await guestCard.innerText(), /verified profile/i);
  await page.goto(`${origin}/`, { waitUntil: 'networkidle' });
  await page.click('#officialConnectButton');

  // The shell names the simulated session (the old #walletStatus header chip is gone).
  await page.waitForFunction(
    () => /simulated wallet session/i.test(document.querySelector('#officialProfileEyebrow')?.textContent ?? ''),
    null,
    { timeout: 10_000 },
  );
  findings.eyebrow = await page.textContent('#officialProfileEyebrow');
  assert.match(findings.eyebrow, /simulated/i);
  // The eyebrow must not still claim a real connection while the banner says
  // otherwise. Two surfaces disagreeing is the mixed message U11a removes.
  assert.doesNotMatch(findings.eyebrow, /profile connected/i);

  // With no wallet at all the portal never opens the picker (signin-entry).
  findings.pickerShown = await page.locator('.wallet-picker').count();
  assert.equal(findings.pickerShown, 0, 'no wallet picker without a wallet');

  // The shell copy carries the disclosure while the cabinet row loads (official-app-routes). The old
  // shell banner (#simulatedWalletBanner) is no longer rendered: its renderer, renderLogin(), has had
  // no caller since the legacy canvas backstage was retired, so the banner stays hidden (reported as a
  // follow-up); the eyebrow, this copy, the console warning and the profile notice below remain.
  await page.waitForFunction(() => /simulated local identity, not a real wallet/i.test(document.querySelector('#officialProfileCopy')?.textContent ?? ''), null, { timeout: 10_000 });
  findings.shellCopy = (await page.textContent('#officialProfileCopy')).replace(/\s+/g, ' ').trim();
  assert.match(findings.shellCopy, /0x[0-9a-f]{4,}…?[0-9a-f]* is a simulated local identity, not a real wallet/i);
  await page.locator('.official-cabinet-card.playable').first().waitFor({ state: 'visible', timeout: 10_000 });
  findings.bannerHidden = await page.locator('#simulatedWalletBanner').isHidden();

  findings.consoleWarned = consoleWarnings.some((text) => /simulated local identity/i.test(text));
  assert.equal(findings.consoleWarned, true, 'connectMockWallet must warn on the console');

  // Profile route: the wallet card notice has to be reachable too. The rail
  // panel version was not, and asserting presence alone would not have caught
  // it -- so check the rendered box here as well.
  await page.click('#officialNavTabs a.official-nav-tab[href="/profile"]');
  const profileNotice = page.locator('.profile-simulated-wallet-notice');
  await profileNotice.waitFor({ state: 'visible', timeout: 10_000 });
  const profileBox = await profileNotice.boundingBox();
  assert.ok(
    profileBox && profileBox.width > 100 && profileBox.height > 20,
    `profile disclosure has no readable box: ${JSON.stringify(profileBox)}`,
  );
  findings.profileNoticeBox = profileBox;
  // The full disclosure, announced to assistive tech, in amber rather than a connection's green.
  findings.noticeText = (await profileNotice.innerText()).replace(/\s+/g, ' ').trim();
  assert.match(findings.noticeText, /simulated/i);
  assert.match(findings.noticeText, /blockchain|on-chain/i);
  assert.match(findings.noticeText, /does not carry over|reconnect|install/i);
  findings.noticeRole = await profileNotice.getAttribute('role');
  assert.equal(findings.noticeRole, 'status', 'disclosure must be announced to assistive tech');
  findings.noticeBorder = await profileNotice.evaluate((node) => getComputedStyle(node).borderTopColor);
  assert.match(findings.noticeBorder, /^rgba?\(/);
  const [r, g, b] = findings.noticeBorder.match(/[\d.]+/g).map(Number);
  assert.ok(r > 200 && g > 120 && g < 220 && b < 120, `expected an amber warning border, got ${findings.noticeBorder}`);
  findings.profileConnectorFact = await page.textContent('.profile-wallet-facts');
  assert.match(findings.profileConnectorFact, /simulated \(no real wallet\)/i);

  // No surface on this card may still assert a connection.
  findings.profileCardText = (await page.textContent('.profile-wallet-rail-card')).replace(/\s+/g, ' ');
  assert.doesNotMatch(
    findings.profileCardText,
    /wallet connected/i,
    'the chain-guard line must not claim a connection over the simulated identity',
  );

  // Preview (both flags false): nothing reaches /api, and the console stays clean.
  assert.deepEqual(apiRequests, [], `preview must not call /api: ${apiRequests.join(', ')}`);
  assert.deepEqual(issues, [], `browser console/network issues:\n${issues.join('\n')}`);
  console.log(JSON.stringify({ status: 'PASS', ...findings }, null, 2));
} finally {
  await browser.close();
}
