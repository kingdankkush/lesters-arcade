import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { readHeroSelectorEvidence } from './hmh-reboot-hero-selector-browser-contract.mjs';
import { startPortalStaticServer } from './hmh-reboot-portal-e2e.mjs';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const portalRoot = path.join(repoRoot, 'apps', 'portal');
const evidenceRoot = path.join(repoRoot, '.hermes', 'evidence', 'hmh-hero-selector-cycle-013');
await mkdir(evidenceRoot, { recursive: true });

const profiles = [
  { id: 'desktop', viewport: { width: 1440, height: 900 }, mobile: false },
  { id: 'mobile-portrait', viewport: { width: 390, height: 844 }, mobile: true },
];

const { chromium } = await import('../benchmarks/hmh-engine-bakeoff/node_modules/playwright/index.mjs');
const { server, origin } = await startPortalStaticServer({ rootDir: portalRoot });
const browser = await chromium.launch({
  executablePath: String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`,
  headless: true,
  args: ['--enable-gpu', '--ignore-gpu-blocklist'],
});

const report = [];
try {
  for (const profile of profiles) {
    const page = await browser.newPage({ viewport: profile.viewport, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', (error) => errors.push(`page: ${error.message}`));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
    await page.goto(`${origin}/`, { waitUntil: 'domcontentloaded' });
    await page.click('#officialGuestEnterButton');
    await page.waitForSelector('#officialArcadeFloor:not([hidden])');
    await page.locator('#officialCabinetGrid .official-cabinet-card.playable').first().click();
    await page.waitForSelector('#officialModeSelect:not([hidden])');
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.click('#officialFreeModeButton');
    await page.waitForSelector('#officialCharacterSelect:not([hidden])');
    const evidence = await readHeroSelectorEvidence(page);
    const swipeHintVisible = await page.locator('.hero-carousel-hint').isVisible();
    const jukeboxVisible = await page.locator('#arcadeMusicPlayer').isVisible();

    const rotator = page.locator('#officialCharacterRoster .hero-card').first().locator('.hmh-cabinet-rotator');
    const firstFrame = await rotator.screenshot();
    await page.waitForTimeout(320);
    const secondFrame = await rotator.screenshot();
    assert.equal(firstFrame.equals(secondFrame), false, `${profile.id}: rotator pixels did not animate`);

    if (profile.mobile) {
      assert.equal(swipeHintVisible, true, 'mobile selector needs an explicit swipe affordance');
      assert.equal(evidence.roster.gridAutoFlow, 'column');
      assert.ok(evidence.roster.scrollWidth > evidence.roster.clientWidth * 2, 'mobile roster must scroll horizontally');
      assert.equal(evidence.roster.overflowX, 'auto');
      assert.ok(evidence.documentHeight < 1800, `mobile selector too tall: ${evidence.documentHeight}`);
      assert.ok(evidence.cards.every((card) => card.rect.width <= 340 && card.rect.width >= 300));
      assert.ok(evidence.cards.every((card) => Math.abs(card.rect.top - evidence.cards[0].rect.top) <= 1));
    } else {
      assert.equal(swipeHintVisible, false);
      assert.equal(jukeboxVisible, false, 'desktop jukebox must not cover locked hero cards');
      assert.ok(evidence.roster.scrollWidth <= evidence.roster.clientWidth + 2, 'desktop roster must not scroll horizontally');
      assert.ok(evidence.cards.every((card) => Math.abs(card.rect.top - evidence.cards[0].rect.top) <= 1));
    }
    assert.deepEqual(errors, []);
    await page.screenshot({ path: path.join(evidenceRoot, `${profile.id}.png`), fullPage: true });
    report.push({ id: profile.id, evidence, errors });
    await page.close();
  }
  console.log(JSON.stringify({ status: 'PASS', profiles: report }, null, 2));
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
