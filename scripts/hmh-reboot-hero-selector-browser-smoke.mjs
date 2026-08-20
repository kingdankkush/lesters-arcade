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
  { id: 'phone-landscape', viewport: { width: 844, height: 390 }, mobile: null },
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
      assert.ok(evidence.cards.every((card) => Math.abs(card.layoutTop - evidence.cards[0].layoutTop) <= 1));
    } else if (profile.mobile === false) {
      assert.equal(swipeHintVisible, false);
      assert.equal(jukeboxVisible, false, 'desktop jukebox must not cover locked hero cards');
      assert.ok(evidence.roster.scrollWidth <= evidence.roster.clientWidth + 2, 'desktop roster must not scroll horizontally');
      assert.ok(evidence.cards.every((card) => Math.abs(card.layoutTop - evidence.cards[0].layoutTop) <= 1));
    }
    assert.deepEqual(errors, []);
    await page.screenshot({ path: path.join(evidenceRoot, `${profile.id}.png`), fullPage: true });

    const selectedHero = page.locator('#officialCharacterRoster .hero-card.active').first();
    await selectedHero.click();
    await page.waitForSelector('#officialLevelIntro:not([hidden])');
    await page.waitForTimeout(100);
    const startTransition = await page.evaluate(() => {
      const intro = document.querySelector('#officialLevelIntro');
      const begin = document.querySelector('#officialBeginLevelButton');
      const jukebox = document.querySelector('#arcadeMusicPlayer');
      const introRect = intro?.getBoundingClientRect();
      const beginRect = begin?.getBoundingClientRect();
      const jukeboxRect = jukebox?.getBoundingClientRect();
      return {
        activeView: [...document.querySelectorAll('.official-view')].find((node) => !node.hidden)?.id ?? null,
        scrollY,
        viewportWidth: innerWidth,
        viewportHeight: innerHeight,
        introTop: introRect?.top ?? null,
        beginTop: beginRect?.top ?? null,
        beginBottom: beginRect?.bottom ?? null,
        beginLeft: beginRect?.left ?? null,
        beginRight: beginRect?.right ?? null,
        jukeboxVisible: Boolean(jukebox && getComputedStyle(jukebox).display !== 'none' && jukeboxRect?.width && jukeboxRect?.height),
        jukeboxTop: jukeboxRect?.top ?? null,
        jukeboxBottom: jukeboxRect?.bottom ?? null,
        jukeboxLeft: jukeboxRect?.left ?? null,
        jukeboxRight: jukeboxRect?.right ?? null,
      };
    });
    assert.equal(startTransition.activeView, 'officialLevelIntro', `${profile.id}: hero selection did not advance to level intro`);
    assert.ok(
      Number.isFinite(startTransition.beginTop)
        && Number.isFinite(startTransition.beginBottom)
        && Number.isFinite(startTransition.beginLeft)
        && Number.isFinite(startTransition.beginRight)
        && startTransition.beginTop >= 0
        && startTransition.beginBottom <= startTransition.viewportHeight
        && startTransition.beginLeft >= 0
        && startTransition.beginRight <= startTransition.viewportWidth,
      `${profile.id}: Begin Level CTA must be fully visible immediately after hero selection: ${JSON.stringify(startTransition)}`,
    );
    if (startTransition.jukeboxVisible) {
      const overlapsJukebox = !(
        startTransition.beginBottom <= startTransition.jukeboxTop
        || startTransition.beginTop >= startTransition.jukeboxBottom
        || startTransition.beginRight <= startTransition.jukeboxLeft
        || startTransition.beginLeft >= startTransition.jukeboxRight
      );
      assert.equal(overlapsJukebox, false, `${profile.id}: jukebox obscures Begin Level CTA: ${JSON.stringify(startTransition)}`);
    }
    await page.screenshot({ path: path.join(evidenceRoot, `${profile.id}-level-intro.png`) });
    await page.click('#officialBeginLevelButton');
    await page.waitForSelector('#officialGameplay:not([hidden])', { timeout: 15_000 });
    await page.waitForSelector('#officialCombatMount iframe[data-runtime="hmh-reboot"]', { timeout: 20_000 });
    const childDeadline = Date.now() + 45_000;
    let childStatus = '';
    while (Date.now() < childDeadline) {
      const child = page.frames().find((frame) => {
        try { return new URL(frame.url()).pathname === '/hmh-reboot/index.html'; } catch { return false; }
      });
      if (child) {
        try {
          childStatus = await child.locator('#hmhRebootStatus').textContent({ timeout: 1_000 }) ?? '';
          if (childStatus === 'Portal session connected') break;
        } catch {
          childStatus = 'frame-transition';
        }
      }
      await page.waitForTimeout(250);
    }
    assert.equal(childStatus, 'Portal session connected', `${profile.id}: Begin Level did not connect the HMH child runtime`);
    assert.deepEqual(errors, []);
    report.push({ id: profile.id, evidence, startTransition, childStatus, errors });
    await page.close();
  }
  console.log(JSON.stringify({ status: 'PASS', profiles: report }, null, 2));
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
