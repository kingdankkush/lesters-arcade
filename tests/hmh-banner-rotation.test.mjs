// Level 1 intro and loading-screen art rotation (docs/art/HMH-BANNERS-20260926.md 5.4-5.6).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import {
  HMH_ROTATION_STORAGE_KEY, createBannerRotation, readRotationResume, writeRotationResume,
} from '../apps/portal/src/hmh-banner-rotation.mjs';
import { HMH_HERO_LOADING, HMH_LOADING_POOL } from '../apps/portal/src/generated/hmh-loading-art.mjs';
import { bannerTipsFrom, mountBannerStage } from '../apps/portal/src/hmh-banner-stage.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const HEROES = Object.keys(HMH_HERO_LOADING);

function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

test('the opening image is a random draw; no immediate repeat; about half the draws feature the hero', () => {
  const byId = new Map(HMH_LOADING_POOL.map((entry) => [entry.id, entry]));
  for (const [index, hero] of HEROES.entries()) {
    const rotation = createBannerRotation({ pool: HMH_LOADING_POOL, heroLoading: HMH_HERO_LOADING, heroId: hero, random: seeded(17 + index) });
    assert.ok(byId.has(rotation.current()), `${hero} opens on a pool image`);
    let previous = rotation.current();
    let featured = 0;
    const seen = new Set([previous]);
    for (let draw = 0; draw < 1000; draw += 1) {
      const next = rotation.next();
      assert.notEqual(next, previous, `draw ${draw} repeats ${previous}`);
      if (byId.get(next).heroes.includes(hero)) featured += 1;
      seen.add(next);
      previous = next;
    }
    assert.ok(featured / 1000 >= 0.4 && featured / 1000 <= 0.6, `${hero} share ${featured / 1000}`);
    assert.equal(seen.size, HMH_LOADING_POOL.length, `${hero}: every pool image appears`);
  }
});

test('an unknown hero falls back to Lit Commando; the loading screen opens on a different image than the intro', () => {
  const unknown = createBannerRotation({ pool: HMH_LOADING_POOL, heroLoading: HMH_HERO_LOADING, heroId: 'nobody' });
  assert.equal(unknown.hero, 'lit-commando');
  for (let seed = 1; seed <= 40; seed += 1) {
    const resumed = createBannerRotation({ pool: HMH_LOADING_POOL, heroLoading: HMH_HERO_LOADING, heroId: 'lilly', resume: { hero: 'lilly', current: 'hmh-extra3' }, random: seeded(seed) });
    assert.notEqual(resumed.current(), 'hmh-extra3', `seed ${seed}: the loading screen repeats the intro image`);
  }
});

test('consecutive games open on different images, and openings vary across games (owner request 2026-09-27)', () => {
  for (const hero of HEROES) {
    const openings = new Set();
    let last = null;
    for (let game = 0; game < 60; game += 1) {
      const rotation = createBannerRotation({ pool: HMH_LOADING_POOL, heroLoading: HMH_HERO_LOADING, heroId: hero, avoid: last ? [last] : [], random: seeded(1000 + game) });
      assert.notEqual(rotation.current(), last, `${hero} game ${game} repeats the previous opening`);
      last = rotation.current();
      openings.add(last);
    }
    assert.ok(openings.size >= 8, `${hero}: only ${openings.size} distinct openings over 60 games`);
  }
});

test('the intro-to-loading handoff survives missing, throwing and stale storage', () => {
  const store = new Map();
  const storage = { getItem: (key) => store.get(key) ?? null, setItem: (key, value) => store.set(key, value), removeItem: (key) => store.delete(key) };
  writeRotationResume(storage, { hero: 'lilly', current: 'hmh-extra', source: 'intro', at: 1000 });
  assert.equal(readRotationResume(storage, 'lilly', { now: 2000 }).current, 'hmh-extra');
  assert.equal(readRotationResume(storage, 'lit-valkyrie', { now: 2000 }), null, 'another hero never resumes');
  assert.equal(readRotationResume(storage, 'lilly', { now: 1000 + 11 * 60 * 1000 }), null, 'stale state is ignored');
  assert.equal(readRotationResume(storage, 'lilly', { source: 'loading', now: 2000 }), null);
  const throwing = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.equal(readRotationResume(throwing, 'lilly'), null);
  assert.doesNotThrow(() => writeRotationResume(throwing, { hero: 'lilly' }));
  assert.equal(readRotationResume(null, 'lilly'), null);
  assert.equal(HMH_ROTATION_STORAGE_KEY, 'hmh-banner-rotation');
});

function fakeDom() {
  const timers = [];
  const element = (tag) => {
    const node = {
      tagName: tag, dataset: {}, attributes: new Map(), children: [], style: { props: new Map(), setProperty(k, v) { this.props.set(k, v); }, removeProperty(k) { this.props.delete(k); } },
      setAttribute(k, v) { this.attributes.set(k, String(v)); }, removeAttribute(k) { this.attributes.delete(k); },
      prepend(child) { this.children.unshift(child); child.parent = this; }, remove() { this.parent?.children.splice(this.parent.children.indexOf(this), 1); },
      decode: () => Promise.resolve(), textContent: '',
    };
    return node;
  };
  const documentRef = { hidden: false, createElement: element };
  const windowRef = { setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; }, clearTimeout: () => {}, sessionStorage: null };
  return { documentRef, windowRef, timers, frame: element('figure'), caption: element('figcaption'), host: element('section') };
}

test('the stage opens on a pool image with its caption; reduced motion shows only that image and schedules nothing', async () => {
  const dom = fakeDom();
  const stage = mountBannerStage({ frame: dom.frame, caption: dom.caption, backdropHost: dom.host, heroId: 'lit-valkyrie', reduceMotion: true, documentRef: dom.documentRef, windowRef: dom.windowRef });
  await new Promise((resolve) => setImmediate(resolve));
  const opening = HMH_LOADING_POOL.find((entry) => entry.id === dom.frame.dataset.artId);
  assert.ok(opening, 'the opening image comes from the pool');
  assert.equal(dom.frame.dataset.artMotion, 'reduced');
  assert.equal(dom.frame.dataset.artState, 'ready');
  assert.equal(dom.caption.textContent, opening.caption);
  assert.equal(dom.host.style.props.get('--hmh-art-backdrop'), `url("${opening.thumb}")`);
  assert.equal(dom.timers.length, 0, 'no rotation under reduced motion');
  assert.equal(dom.frame.children.filter((child) => child.dataset.active === 'true').length, 1);
  stage.stop();
  assert.equal(dom.frame.children.length, 0, 'stop removes the images so their bitmaps are released');
  assert.equal(dom.frame.dataset.artState, 'idle');
  assert.equal(dom.host.style.props.has('--hmh-art-backdrop'), false);
});

test('with motion, the stage rotates to a different image after the hold, and waits for its gate', async () => {
  const dom = fakeDom();
  let open = false;
  mountBannerStage({ frame: dom.frame, heroId: 'lilly', gate: () => open, documentRef: dom.documentRef, windowRef: dom.windowRef, random: seeded(3) });
  await new Promise((resolve) => setImmediate(resolve));
  const first = dom.frame.dataset.artId;
  assert.ok(first);
  assert.equal(dom.timers.at(-1).ms, 7000);
  await dom.timers.at(-1).fn();
  assert.equal(dom.frame.dataset.artId, first, 'a closed gate holds the first image');
  assert.equal(dom.timers.at(-1).ms, 1000);
  open = true;
  await dom.timers.at(-1).fn();
  assert.notEqual(dom.frame.dataset.artId, first);
});

test('tips for the ticker come from the panel tip articles, touch lines only on touch screens', () => {
  const paragraph = (text, touch = false) => ({ textContent: text, classList: { contains: (name) => touch && name === 'hmh-startup-touch' } });
  const panel = { querySelectorAll: () => [paragraph('Walk close to collect them. Cyan marks weapons and gold marks power-ups.'), paragraph('On touch: move with the left stick of the screen.', true)] };
  assert.deepEqual(bannerTipsFrom(panel), ['Walk close to collect them.', 'Cyan marks weapons and gold marks power-ups.']);
  assert.equal(bannerTipsFrom(panel, { coarsePointer: true }).length, 3);
});

test('the rotation stays out of the simulation: no apps/hmh-reboot/src module imports it', () => {
  const dir = join(root, 'apps/hmh-reboot/src');
  const files = readdirSync(dir, { recursive: true }).filter((file) => String(file).endsWith('.mjs'));
  for (const file of files) {
    const source = readFileSync(join(dir, String(file)), 'utf8');
    assert.doesNotMatch(source, /hmh-banner-(?:rotation|stage)|hmh-loading-art|hmh-startup-art/, String(file));
  }
});

test('the host page loads the startup art as its own module, and the panel has the art frame and action bar', () => {
  const html = readFileSync(join(root, 'apps/portal/hmh-reboot/index.html'), 'utf8');
  assert.match(html, /<script type="module" src="\.\.\/dist\/hmh-reboot\/game\.js"><\/script>\s*<script type="module" src="\.\.\/dist\/hmh-reboot\/startup-art\.js"><\/script>/);
  assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/, 'no inline script under the route CSP');
  assert.match(html, /<figure class="hmh-startup-art hmh-art-frame" data-art-state="idle">/);
  assert.match(html, /<div class="hmh-startup-actions">\s*<div class="hmh-startup-progress"/);
  assert.match(html, /<h1>The Forked Frontier<\/h1>/);
  const build = readFileSync(join(root, 'build.mjs'), 'utf8');
  assert.match(build, /'hmh-reboot\/startup-art': resolve\(__dirname, 'apps\/portal\/src\/hmh-startup-art\.mjs'\)/);
  const css = readFileSync(join(root, 'apps/portal/hmh-reboot/styles.css'), 'utf8');
  assert.match(css, /\.hmh-startup-actions \{ position:sticky; bottom:0;/, 'phones pin progress and Enter to the bottom');
  assert.match(css, /@media\(prefers-reduced-motion:reduce\) \{ \.hmh-art-layer \{ transition:none; animation:none; \}/);
  const source = readFileSync(join(root, 'apps/portal/src/hmh-banner-stage.mjs'), 'utf8');
  assert.doesNotMatch(source, /setAttribute\('style'|\.style\s*=|cssText/, 'CSP: CSSOM custom properties only');
});

test('the portal Level 1 intro names The Forked Frontier and loads the rotation lazily', () => {
  const html = readFileSync(join(root, 'apps/portal/index.html'), 'utf8');
  assert.match(html, /<figure id="officialLevelIntroArt" class="level-intro-art hmh-art-frame" data-art-state="idle">/);
  assert.match(html, /<h2>Level 1: The Forked Frontier<\/h2>/);
  const main = readFileSync(join(root, 'apps/portal/main.js'), 'utf8');
  assert.match(main, /import\('\.\/src\/hmh-banner-stage\.mjs'\)/);
  assert.doesNotMatch(main, /^import[^\n]*hmh-banner-(?:stage|rotation)/m, 'never a static import in the portal entry');
});
