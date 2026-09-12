// Pure stylesheet audit for the hero select screen.
//
// Cycle 013 shipped phone-tightening rules against `.hero-card-inner` and
// `.hero-card-bio`, names the roster renderer never emits, so the rules sat
// dead for sixty cycles while the mobile document crept up to the 1800 px
// smoke pin. Nothing in the unit suite could see that: a class selector that
// matches nothing is not a CSS error. This module gives tests a way to hold a
// media block against the class names the DOM actually produces, and to read
// the lengths a block declares, without a browser and without pinning source
// text. Node-only; never imported by the portal bundle.

const CLASS_TOKEN = /\.([A-Za-z_][\w-]*)/gu;
const LENGTH = /^(-?\d+(?:\.\d+)?)px$/u;

function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//gu, '');
}

// Returns the body of the first `@media (<query>) { ... }` block, brace-matched
// so nested rules survive, or null when the sheet has no such block.
export function extractMediaBlock(css, query) {
  const source = stripComments(css);
  const head = `@media (${query})`;
  let start = source.indexOf(head);
  while (start !== -1) {
    const open = source.indexOf('{', start + head.length);
    const between = source.slice(start + head.length, open);
    if (open !== -1 && between.trim() === '') {
      let depth = 0;
      for (let index = open; index < source.length; index += 1) {
        if (source[index] === '{') depth += 1;
        else if (source[index] === '}') {
          depth -= 1;
          if (depth === 0) return source.slice(open + 1, index);
        }
      }
      return null;
    }
    start = source.indexOf(head, start + head.length);
  }
  return null;
}

// Splits a block body into { selector, declarations } rules. Nested at-rules
// are flattened one level so a `@supports` inside a media block still yields
// its rules; declarations are `{ property: value }` with the last write winning,
// which is how the cascade reads them too.
export function parseRules(block) {
  const rules = [];
  const source = stripComments(block);
  let cursor = 0;
  while (cursor < source.length) {
    const open = source.indexOf('{', cursor);
    if (open === -1) break;
    const selector = source.slice(cursor, open).trim();
    let depth = 1;
    let close = open + 1;
    while (close < source.length && depth > 0) {
      if (source[close] === '{') depth += 1;
      else if (source[close] === '}') depth -= 1;
      close += 1;
    }
    const body = source.slice(open + 1, close - 1);
    if (selector.startsWith('@')) {
      rules.push(...parseRules(body));
    } else if (selector) {
      const declarations = {};
      for (const entry of body.split(';')) {
        const colon = entry.indexOf(':');
        if (colon === -1) continue;
        const property = entry.slice(0, colon).trim().toLowerCase();
        const value = entry.slice(colon + 1).trim();
        if (property) declarations[property] = value;
      }
      rules.push({ selector, declarations });
    }
    cursor = close;
  }
  return rules;
}

// Every class name a block's selectors reference, filtered by prefix.
export function selectorClassNames(block, prefix = '') {
  const names = new Set();
  for (const { selector } of parseRules(block)) {
    for (const match of selector.matchAll(CLASS_TOKEN)) {
      if (match[1].startsWith(prefix)) names.add(match[1]);
    }
  }
  return [...names].sort();
}

// Class names a set of sources (renderer modules, HTML) can put on the DOM.
// Any prefixed token counts: `className: 'hero-card'`, `class="hero-x"`, and
// template strings like `hero-card ${state}` all name a class the page emits.
export function emittedClassNames(sources, prefix) {
  const token = new RegExp(`(?<![\\w-])${prefix}[\\w-]*`, 'gu');
  const names = new Set();
  for (const source of sources) {
    for (const match of source.matchAll(token)) names.add(match[0]);
  }
  return [...names].sort();
}

// Selector class names the block styles that no source emits: dead rules.
export function orphanedClassNames(block, sources, prefix) {
  const emitted = new Set(emittedClassNames(sources, prefix));
  return selectorClassNames(block, prefix).filter((name) => !emitted.has(name));
}

// Pixel values a block declares for `property` on rules whose selector matches
// `selectorPattern`. Non-px values are skipped; callers asserting a bound
// should also assert the list is non-empty when they expect a declaration.
export function declaredPx(block, selectorPattern, property) {
  const values = [];
  for (const { selector, declarations } of parseRules(block)) {
    if (!selectorPattern.test(selector)) continue;
    const value = declarations[property.toLowerCase()];
    const match = value ? LENGTH.exec(value) : null;
    if (match) values.push(Number(match[1]));
  }
  return values;
}

// Declarations across every rule whose selector matches `selectorPattern`,
// merged in source order the way equal-specificity rules cascade; null when
// no rule matches.
export function declarationsFor(block, selectorPattern) {
  const matching = parseRules(block).filter(({ selector }) => selectorPattern.test(selector));
  if (matching.length === 0) return null;
  return Object.assign({}, ...matching.map(({ declarations }) => declarations));
}

export const PHONE_CAROUSEL_QUERY = 'max-width: 700px';
export const NARROW_PHONE_QUERY = 'max-width: 420px';

// The whole select-screen audit in one call: which phone-carousel rules are
// dead, whether any bio line clamp crept back (the smoke forbids clipped
// bios), and whether the carousel block's stage min-height silently overrides
// the narrow-phone stage height by ID specificity.
export function auditSelectStylesheet({ polish, sources, prefix = 'hero-' }) {
  const carousel = extractMediaBlock(polish, PHONE_CAROUSEL_QUERY) ?? '';
  const narrow = extractMediaBlock(polish, NARROW_PHONE_QUERY) ?? '';
  const stageHeights = declaredPx(narrow, /\.hero-card-stage$/u, 'height');
  const narrowStageHeight = stageHeights.length ? Math.min(...stageHeights) : null;
  const carouselStageMinHeights = declaredPx(carousel, /\.hero-card-stage$/u, 'min-height');
  return {
    orphanedClassNames: orphanedClassNames(carousel, sources, prefix),
    lineClampSelectors: parseRules(carousel)
      .filter(({ declarations }) => Object.keys(declarations).some((property) => property.endsWith('line-clamp')))
      .map(({ selector }) => selector),
    narrowStageHeight,
    carouselStageMinHeights,
    carouselStageOverridesNarrowHeight: narrowStageHeight !== null
      && carouselStageMinHeights.some((value) => value > narrowStageHeight),
    phoneCard: declarationsFor(carousel, /#officialCharacterRoster \.hero-card$/u),
  };
}
