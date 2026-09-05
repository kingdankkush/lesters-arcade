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
  // Cycle 074 (U-6): the rotator must stand still on its south rest frame when
  // the viewer prefers reduced motion; the three default profiles keep asserting
  // that it animates, so the guard is proven to key off the media query only.
  { id: 'reduced-motion-desktop', viewport: { width: 1440, height: 900 }, mobile: false, reducedMotion: 'reduce' },
];
const SELECTOR_FRAME_SIZE = 384;
const HERO_COUNT = 4;
const REST_FRAME_INDEX = 6;

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
    const page = await browser.newPage({ viewport: profile.viewport, deviceScaleFactor: 1, reducedMotion: profile.reducedMotion ?? 'no-preference' });
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
    if (profile.reducedMotion === 'reduce') {
      assert.equal(evidence.reducedMotion, true, `${profile.id}: page must see prefers-reduced-motion`);
      assert.equal(firstFrame.equals(secondFrame), true, `${profile.id}: rotator must stand still under reduced motion`);
      for (const card of evidence.cards) {
        assert.equal(card.restFrameIndex, REST_FRAME_INDEX, `${profile.id}: ${card.id} rest frame must be south`);
        assert.deepEqual(card.visibleFrameIndexes, [REST_FRAME_INDEX], `${profile.id}: ${card.id} must show only the rest frame`);
      }
    } else {
      assert.equal(evidence.reducedMotion, false);
      assert.equal(firstFrame.equals(secondFrame), false, `${profile.id}: rotator pixels did not animate`);
    }

    // Cycle 074 (C-2 / U-6): crisp 384 px per-hero turntables, identity and
    // comparison attributes on every card, exactly one pressed card, four dots.
    assert.equal(evidence.cards.length, HERO_COUNT);
    for (const card of evidence.cards) {
      assert.deepEqual(card.frameSize, [SELECTOR_FRAME_SIZE, SELECTOR_FRAME_SIZE], `${profile.id}: ${card.id} canvases must be ${SELECTOR_FRAME_SIZE} px`);
      assert.equal(card.restFrameIndex, REST_FRAME_INDEX, `${profile.id}: ${card.id} must mark the south rest frame`);
      assert.ok(typeof card.id === 'string' && card.id.length > 0, `${profile.id}: hero card without data-character-id`);
      assert.equal(card.comparisonChips, 4, `${profile.id}: ${card.id} needs one comparison chip per stat`);
      assert.ok(card.ariaPressed === 'true' || card.ariaPressed === 'false', `${profile.id}: ${card.id} aria-pressed`);
    }
    assert.equal(new Set(evidence.cards.map((card) => card.id)).size, HERO_COUNT, `${profile.id}: hero ids must be unique`);
    assert.equal(evidence.cards.filter((card) => card.ariaPressed === 'true').length, 1, `${profile.id}: exactly one pressed hero card`);
    assert.equal(evidence.cards.filter((card) => card.compareRole === 'reference').length, 1, `${profile.id}: exactly one comparison reference`);
    assert.equal(evidence.dots.count, HERO_COUNT, `${profile.id}: one carousel dot per hero`);

    let keyboard = null;
    if (profile.mobile === false && !profile.reducedMotion) {
      // Arrow-key roving focus (U-6): ArrowRight advances to the next unlocked
      // card, Home returns to the first, and Enter selects it below.
      const unlocked = evidence.cards.filter((card) => !card.locked).map((card) => card.id);
      assert.ok(unlocked.length >= 2, `${profile.id}: keyboard step needs two unlocked heroes`);
      await page.locator('#officialCharacterRoster .hero-card:not([disabled])').first().focus();
      const focusedBefore = await page.evaluate(() => document.activeElement?.dataset?.characterId ?? null);
      await page.keyboard.press('ArrowRight');
      const focusedAfterRight = await page.evaluate(() => document.activeElement?.dataset?.characterId ?? null);
      await page.keyboard.press('Home');
      const focusedAfterHome = await page.evaluate(() => document.activeElement?.dataset?.characterId ?? null);
      keyboard = { focusedBefore, focusedAfterRight, focusedAfterHome };
      assert.equal(focusedBefore, unlocked[0], `${profile.id}: first unlocked card did not take focus`);
      assert.equal(focusedAfterRight, unlocked[1], `${profile.id}: ArrowRight did not advance focus`);
      assert.equal(focusedAfterHome, unlocked[0], `${profile.id}: Home did not return focus`);
    }

    if (profile.mobile) {
      assert.equal(swipeHintVisible, true, 'mobile selector needs an explicit swipe affordance');
      assert.equal(evidence.roster.gridAutoFlow, 'column');
      assert.ok(evidence.roster.scrollWidth > evidence.roster.clientWidth * 2, 'mobile roster must scroll horizontally');
      assert.equal(evidence.roster.overflowX, 'auto');
      assert.ok(evidence.documentHeight < 1800, `mobile selector too tall: ${evidence.documentHeight}`);
      assert.ok(evidence.cards.every((card) => card.rect.width <= 340 && card.rect.width >= 300));
      assert.ok(evidence.cards.every((card) => Math.abs(card.layoutTop - evidence.cards[0].layoutTop) <= 1));
      // Dot indicator (U-6): visible on the carousel, the active dot follows the
      // roster's real scroll position.
      assert.equal(evidence.dots.visible, true, 'mobile carousel needs a visible dot indicator');
      assert.equal(evidence.dots.activeIndex, 0, `mobile dots must start on the first hero, got ${evidence.dots.activeIndex}`);
      await page.evaluate(() => {
        const roster = document.querySelector('#officialCharacterRoster');
        const card = roster.querySelector('.hero-card');
        roster.scrollBy({ left: card.getBoundingClientRect().width, behavior: 'instant' });
      });
      await page.waitForTimeout(400);
      const scrolled = await readHeroSelectorEvidence(page);
      assert.equal(scrolled.dots.activeIndex, 1, `active dot must follow the carousel scroll, got ${scrolled.dots.activeIndex}`);
      await page.evaluate(() => document.querySelector('#officialCharacterRoster').scrollTo({ left: 0, behavior: 'instant' }));
      await page.waitForTimeout(400);
    } else if (profile.mobile === false) {
      assert.equal(swipeHintVisible, false);
      assert.equal(evidence.dots.visible, false, 'desktop must not show the carousel dots');
      assert.equal(jukeboxVisible, false, 'desktop jukebox must not cover locked hero cards');
      assert.ok(evidence.roster.scrollWidth <= evidence.roster.clientWidth + 2, 'desktop roster must not scroll horizontally');
      assert.ok(evidence.cards.every((card) => Math.abs(card.layoutTop - evidence.cards[0].layoutTop) <= 1));
    }
    assert.deepEqual(errors, []);
    await page.screenshot({ path: path.join(evidenceRoot, `${profile.id}.png`), fullPage: true });

    const selectedHero = page.locator('#officialCharacterRoster .hero-card.active').first();
    if (keyboard) {
      // Enter on the focused (first unlocked) card is native button activation.
      await selectedHero.focus();
      await page.keyboard.press('Enter');
    } else {
      await selectedHero.click();
    }
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
    report.push({ id: profile.id, evidence, keyboard, startTransition, childStatus, errors });
    await page.close();
  }
  console.log(JSON.stringify({ status: 'PASS', profiles: report }, null, 2));
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
