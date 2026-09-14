import assert from 'node:assert/strict';
import test from 'node:test';

import {
  auditSelectStylesheet,
  declarationsFor,
  declaredPx,
  emittedClassNames,
  extractMediaBlock,
  orphanedClassNames,
  parseRules,
  selectorClassNames,
} from '../scripts/lib/select-stylesheet-audit.mjs';

// A miniature of the Cycle 013 defect: the carousel block styles two class
// names the renderer never emits and floors the stage above the narrow-phone
// height by ID specificity.
const DEFECTIVE_SHEET = `
.hero-card { padding: 22px; gap: 18px; }
@media (max-width: 720px) {
  .hero-card-stage { height: 200px; }
}
@media (max-width: 420px) {
  .hero-card-stage { height: 132px; padding-bottom: 16px; }
  /* comment with a brace { inside */
  .hero-card-stage .hmh-cabinet-rotator { width: 108px; }
}
@media (max-width: 700px) {
  #officialCharacterRoster .hero-card { min-width: 0; scroll-snap-align: center; }
  #officialCharacterRoster .hero-card-stage { min-height: 168px; }
  #officialCharacterRoster .hero-card-inner { padding: 16px; gap: 10px; }
  #officialCharacterRoster .hero-card-bio {
    display: -webkit-box;
    -webkit-line-clamp: 4;
  }
  @supports (scroll-snap-type: inline mandatory) {
    #officialCharacterRoster .hero-stats { gap: 7px; }
  }
  .hero-carousel-dots { margin: -26px 0 -4px; }
}
`;

const FIXED_SHEET = DEFECTIVE_SHEET
  .replace('#officialCharacterRoster .hero-card-stage { min-height: 168px; }\n', '')
  .replace('.hero-card-inner', '.hero-card')
  .replace(/#officialCharacterRoster \.hero-card-bio \{[\s\S]*?\}\n/u, '');

const RENDERER = `
  const card = el('button', { className: \`hero-card \${hero.locked ? 'locked' : 'active'}\` });
  const stage = el('div', { className: 'hero-card-stage' });
  const statBox = el('div', { className: 'hero-stats' });
  dots = el('div', { className: 'hero-carousel-dots' });
`;

test('extractMediaBlock returns the brace-matched body of the named block only', () => {
  const block = extractMediaBlock(DEFECTIVE_SHEET, 'max-width: 700px');
  assert.ok(block.includes('.hero-card-inner'));
  assert.ok(block.includes('.hero-carousel-dots'), 'nested @supports must not end the block early');
  assert.ok(!block.includes('height: 132px'), 'the <=420 block is a different block');
  assert.equal(extractMediaBlock(DEFECTIVE_SHEET, 'max-width: 999px'), null);
});

test('extractMediaBlock ignores braces inside comments', () => {
  const narrow = extractMediaBlock(DEFECTIVE_SHEET, 'max-width: 420px');
  assert.ok(narrow.includes('.hmh-cabinet-rotator'), 'a brace in a comment must not open a rule');
  assert.deepEqual(declaredPx(narrow, /\.hero-card-stage$/u, 'height'), [132]);
});

test('parseRules flattens nested at-rules and keeps the last declaration per property', () => {
  const rules = parseRules(extractMediaBlock(DEFECTIVE_SHEET, 'max-width: 700px'));
  const stats = rules.find(({ selector }) => selector.endsWith('.hero-stats'));
  assert.deepEqual(stats.declarations, { gap: '7px' });
  assert.deepEqual(parseRules('.a { color: red; color: blue }')[0].declarations, { color: 'blue' });
});

test('selectorClassNames and emittedClassNames agree on prefix filtering', () => {
  const block = extractMediaBlock(DEFECTIVE_SHEET, 'max-width: 700px');
  assert.deepEqual(selectorClassNames(block, 'hero-'), [
    'hero-card', 'hero-card-bio', 'hero-card-inner', 'hero-card-stage', 'hero-carousel-dots', 'hero-stats',
  ]);
  assert.deepEqual(emittedClassNames([RENDERER, '<div class="hero-carousel-hint"></div>'], 'hero-'), [
    'hero-card', 'hero-card-stage', 'hero-carousel-dots', 'hero-carousel-hint', 'hero-stats',
  ]);
});

test('orphanedClassNames names the Cycle 013 dead selectors and nothing else', () => {
  const block = extractMediaBlock(DEFECTIVE_SHEET, 'max-width: 700px');
  assert.deepEqual(orphanedClassNames(block, [RENDERER], 'hero-'), ['hero-card-bio', 'hero-card-inner']);
  assert.deepEqual(orphanedClassNames(extractMediaBlock(FIXED_SHEET, 'max-width: 700px'), [RENDERER], 'hero-'), []);
});

test('declaredPx and declarationsFor read lengths under matching selectors only', () => {
  const block = extractMediaBlock(DEFECTIVE_SHEET, 'max-width: 700px');
  assert.deepEqual(declaredPx(block, /\.hero-card-stage$/u, 'min-height'), [168]);
  assert.deepEqual(declaredPx(block, /\.hero-card-stage$/u, 'height'), [], 'a property the block never sets reads as empty');
  assert.deepEqual(declaredPx('.a { width: 50% }', /\.a$/u, 'width'), [], 'non-px lengths are not numbers');
  assert.equal(declarationsFor(block, /\.hero-card$/u).padding, undefined);
  assert.equal(declarationsFor(extractMediaBlock(FIXED_SHEET, 'max-width: 700px'), /\.hero-card$/u).padding, '16px');
  assert.equal(declarationsFor(block, /\.nope$/u), null);
});

test('auditSelectStylesheet flags every defect in the Cycle 013 shape and clears on the fix', () => {
  const defective = auditSelectStylesheet({ polish: DEFECTIVE_SHEET, sources: [RENDERER] });
  assert.deepEqual(defective.orphanedClassNames, ['hero-card-bio', 'hero-card-inner']);
  assert.deepEqual(defective.lineClampSelectors, ['#officialCharacterRoster .hero-card-bio']);
  assert.equal(defective.narrowStageHeight, 132);
  assert.deepEqual(defective.carouselStageMinHeights, [168]);
  assert.equal(defective.carouselStageOverridesNarrowHeight, true);
  assert.equal(defective.phoneCard.padding, undefined);

  const fixed = auditSelectStylesheet({ polish: FIXED_SHEET, sources: [RENDERER] });
  assert.deepEqual(fixed.orphanedClassNames, []);
  assert.deepEqual(fixed.lineClampSelectors, []);
  assert.deepEqual(fixed.carouselStageMinHeights, []);
  assert.equal(fixed.carouselStageOverridesNarrowHeight, false);
  assert.equal(fixed.phoneCard.padding, '16px');
  assert.equal(fixed.phoneCard.gap, '10px');
});

test('auditSelectStylesheet tolerates a sheet without the phone blocks', () => {
  const audit = auditSelectStylesheet({ polish: '.hero-card { padding: 22px }', sources: [RENDERER] });
  assert.deepEqual(audit.orphanedClassNames, []);
  assert.equal(audit.narrowStageHeight, null);
  assert.equal(audit.carouselStageOverridesNarrowHeight, false);
  assert.equal(audit.phoneCard, null);
});
