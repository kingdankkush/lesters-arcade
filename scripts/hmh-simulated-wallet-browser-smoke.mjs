// U11a browser check.
//
// The reboot visual gate screenshots the canvas only, so it is blind to every
// DOM surface in the portal shell. This slice is entirely DOM, which means
// without a check of its own it would ship unverified. Headless Chrome injects
// no EIP-1193 provider, so simply clicking Connect Wallet exercises the exact
// fallback path a real visitor without a wallet hits.
import assert from 'node:assert/strict';
import { chromium } from '../benchmarks/hmh-engine-bakeoff/node_modules/playwright/index.mjs';

const origin = process.env.HMH_PORTAL_ORIGIN ?? 'http://127.0.0.1:8899';

const browser = await chromium.launch({
  executablePath: String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`,
  headless: true,
});

const findings = {};

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const consoleWarnings = [];
  page.on('console', (message) => {
    if (message.type() === 'warning') consoleWarnings.push(message.text());
  });

  await page.goto(`${origin}/`, { waitUntil: 'networkidle' });

  // Precondition: no injected provider, so this really is the fallback path and
  // not an accidental pass against some stubbed wallet.
  const hasProvider = await page.evaluate(() => Boolean(globalThis.ethereum?.request));
  assert.equal(hasProvider, false, 'expected no injected provider in headless Chrome');

  await page.click('#officialConnectButton');
  await page.waitForFunction(
    () => document.querySelector('#walletStatus')?.dataset.simulatedWallet === 'true',
    { timeout: 10_000 },
  );

  findings.headerChip = await page.textContent('#walletStatus');
  assert.match(findings.headerChip, /simulated/i, 'header wallet chip must name the simulated state');

  findings.systemStatus = await page.textContent('#systemStatus');
  assert.match(findings.systemStatus, /simulated wallet/i);
  assert.match(findings.systemStatus, /not on-chain/i);

  // The shell banner carries the full disclosure. Deliberately NOT the wallet
  // rail panel: that lives in the legacy login terminal, which is hidden once
  // you are connected, so a notice rendered only there is in the DOM and
  // invisible. The visibility assertions below are what caught that.
  const notice = page.locator('#simulatedWalletBanner');
  await notice.waitFor({ state: 'visible', timeout: 10_000 });
  findings.noticeText = (await notice.innerText()).replace(/\s+/g, ' ').trim();
  assert.match(findings.noticeText, /simulated/i);
  assert.match(findings.noticeText, /blockchain|on-chain/i);
  assert.match(findings.noticeText, /does not carry over|reconnect|install/i);

  findings.noticeRole = await notice.getAttribute('role');
  assert.equal(findings.noticeRole, 'status', 'disclosure must be announced to assistive tech');

  // It has to be visible, not merely present. A notice rendered into a
  // collapsed or hidden container would pass a textContent assertion while
  // telling the user nothing.
  findings.noticeVisible = await notice.isVisible();
  assert.equal(findings.noticeVisible, true, 'disclosure must be visible, not just in the DOM');
  const box = await notice.boundingBox();
  assert.ok(box && box.width > 100 && box.height > 20, `disclosure has no readable box: ${JSON.stringify(box)}`);

  // Amber, not the green of a real connection.
  findings.noticeBorder = await notice.evaluate((node) => getComputedStyle(node).borderTopColor);
  assert.match(findings.noticeBorder, /^rgba?\(/);
  const [r, g, b] = findings.noticeBorder.match(/[\d.]+/g).map(Number);
  assert.ok(r > 200 && g > 120 && g < 220 && b < 120, `expected an amber warning border, got ${findings.noticeBorder}`);

  findings.consoleWarned = consoleWarnings.some((text) => /simulated local identity/i.test(text));
  assert.equal(findings.consoleWarned, true, 'connectMockWallet must warn on the console');

  // The eyebrow must not still claim a real connection while the banner says
  // otherwise. Two surfaces disagreeing is the mixed message U11a removes.
  findings.eyebrow = await page.textContent('#officialProfileEyebrow');
  assert.match(findings.eyebrow, /simulated/i);
  assert.doesNotMatch(findings.eyebrow, /profile connected/i);

  // Profile route: the wallet card notice has to be reachable too. The rail
  // panel version was not, and asserting presence alone would not have caught
  // it -- so check the rendered box here as well.
  await page.click('[data-official-nav="profile"], #officialNavTabs button:has-text("Profile")');
  const profileNotice = page.locator('.profile-simulated-wallet-notice');
  await profileNotice.waitFor({ state: 'visible', timeout: 10_000 });
  const profileBox = await profileNotice.boundingBox();
  assert.ok(
    profileBox && profileBox.width > 100 && profileBox.height > 20,
    `profile disclosure has no readable box: ${JSON.stringify(profileBox)}`,
  );
  findings.profileNoticeBox = profileBox;
  findings.profileConnectorFact = await page.textContent('.profile-wallet-facts');
  assert.match(findings.profileConnectorFact, /simulated \(no real wallet\)/i);

  // No surface on this card may still assert a connection.
  findings.profileCardText = (await page.textContent('.profile-wallet-rail-card')).replace(/\s+/g, ' ');
  assert.doesNotMatch(
    findings.profileCardText,
    /wallet connected/i,
    'the chain-guard line must not claim a connection over the simulated identity',
  );

  console.log(JSON.stringify({ status: 'PASS', ...findings }, null, 2));
} finally {
  await browser.close();
}
