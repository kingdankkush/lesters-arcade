// Free share card element, E12 (plan docs/handoffs/free-share-20260926.md §6).
//
// buildFreeCardElement({ run, background, heroPortrait }) returns a Satori
// element tree of plain objects (no JSX) for a 1200×630 card: the game's key
// art, a big score, the hero or lap line, one flag chip, three gold-glyph stat
// tiles, the HMH hero portrait when the token names one, and a rotated
// "FREE PLAY · SELF-REPORTED" ribbon across the top-right corner. It shares
// the Ranked card's type ladder and tile shape but never its colours of
// trust: the frame, eyebrow, glow and ribbon are magenta, never the verified
// green, and the strings VERIFIED, LITVM, RANKED and PUBLISH never appear.
//
// Satori rules this file follows: every element with more than one child is
// display:flex; images are data URIs (a URL would make Satori fetch); text is
// restricted to glyphs the bundled Geist font covers (cardText), so Satori
// never loads a fallback font or emoji from a CDN; icons are inline SVG paths
// (there is no emoji font), and the root clips the ribbon's overflow.
import { FREE_GAMES, chipText, count, identityText, tiles } from './free-run.mjs';
import { SHARE_CARD_HEIGHT, SHARE_CARD_WIDTH, cardText } from './render-card.mjs';

export const FREE_CARD_ACCENT = '#ff3df2';
export const FREE_CARD_RIBBON = 'FREE PLAY · SELF-REPORTED';
// The portrait is the 384-px front rest frame drawn at 442 px, bottom-anchored
// so the thigh cut of the source frame sits off the card.
export const PORTRAIT_BOX = Object.freeze({ left: 738, top: 188, size: 442 });
// Rotated 45° about its centre (1030, 170): its centre line runs (860, 0) →
// (1200, 340), clear of the title, the score row and every hero head.
export const RIBBON_BOX = Object.freeze({ left: 750, top: 142, width: 560, height: 56 });

const CYAN = '#19f7ff';
const GOLD = '#ffe84d';
const AMBER = '#ffb347';
const INK = '#f9f7ff';
const MUTED = '#b4c4df';
const DEEP = '#05070f';
const MAGENTA_EDGE = 'rgba(255, 61, 242, 0.55)';
const MAGENTA_GLOW = 'rgba(255, 61, 242, 0.7)';
const CHIP_COLOURS = Object.freeze({ 'lester-blaster': GOLD, chikun: CYAN, stacked: AMBER });
const CHIP_FILLS = Object.freeze({ 'lester-blaster': 'rgba(40, 30, 4, 0.85)', chikun: 'rgba(4, 34, 40, 0.85)', stacked: 'rgba(48, 30, 4, 0.85)' });

const node = (type, style, children) => ({ type, props: { style, ...(children === undefined ? {} : { children }) } });
const flex = (style, children) => node('div', { display: 'flex', ...style }, children);
const text = (style, value) => node('div', { display: 'flex', ...style }, cardText(value, 80));

// Gold line icons on a 24-unit grid, drawn at 28 px inside each tile.
const path = (d, extra = {}) => ({ type: 'path', props: { d, fill: 'none', stroke: GOLD, strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', ...extra } });
const svg = (children) => Object.freeze({ type: 'svg', props: { width: 28, height: 28, viewBox: '0 0 24 24', children } });
const CIRCLE = 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z';
export const GLYPHS = Object.freeze({
  skull: svg([path('M12 3a7 7 0 0 0-7 7c0 2.6 1.4 4.6 3 5.7V19h8v-3.3c1.6-1.1 3-3.1 3-5.7a7 7 0 0 0-7-7z'), path('M9.5 11h.01M14.5 11h.01', { strokeWidth: 3 }), path('M10 19v2m4-2v2')]),
  clock: svg([path(CIRCLE), path('M12 7v5l3.5 2')]),
  flame: svg([path('M13 2c2 5-2 6 1 9 1-2 3-3 4-3 2 5 1 12-6 13-6 0-9-7-5-11 1 2 2 3 3 3-1-4 1-7 3-11z')]),
  fork: svg([path('M12 21v-8M12 13L6 6M12 13l6-7M6 6h4M6 6v4M18 6h-4M18 6v4')]),
  bolt: svg([path('M13 2L5 13h6l-1 9 9-12h-6l1-8z')]),
  // A drawn Ł: Geist has no U+0141.
  coin: svg([path(CIRCLE), path('M10 7v10h5M8.5 13.5l4-2.5')]),
  chart: svg([path('M4 19h16M5 15l4-4 4 3 5-6 2 2')]),
  arrow: svg([path('M12 4l7 7h-4v9H9v-9H5l7-7z')]),
  halving: svg([path(CIRCLE), path('M12 4v16'), path('M12 4a8 8 0 0 0 0 16z', { fill: GOLD })]),
});

// Geist digits are about 0.663 em wide and separators 0.201 em; the score row
// also holds "PTS" and its gap (118 px). The largest rung that fits wins.
export function scoreFontSize(scoreText, maxWidth) {
  const chars = [...String(scoreText ?? '')];
  const digits = chars.filter((char) => char >= '0' && char <= '9').length;
  const em = digits * 0.663 + (chars.length - digits) * 0.201;
  for (const size of [148, 140, 120, 104, 88, 72, 60]) if (em * size + 118 <= maxWidth) return size;
  return 60;
}

function chipNode(label, colour, fill) {
  return text({ alignSelf: 'flex-start', marginTop: 12, padding: '6px 16px', borderRadius: 999, border: `3px solid ${colour}`, backgroundColor: fill, color: colour, fontSize: 22, letterSpacing: 2 }, label);
}

function tileNode({ glyph, label, value }, index) {
  const wide = [...String(value)].length >= 8;
  return flex({
    flexDirection: 'column', minWidth: 190, marginLeft: index === 0 ? 0 : 14, padding: '12px 20px', borderRadius: 14,
    border: '2px solid rgba(255, 232, 77, 0.4)', backgroundColor: 'rgba(5, 7, 18, 0.78)',
  }, [
    flex({ alignItems: 'center' }, [GLYPHS[glyph] ?? GLYPHS.clock, text({ fontSize: 18, color: MUTED, letterSpacing: 3, marginLeft: 10, textTransform: 'uppercase' }, label)]),
    text({ fontSize: wide ? 36 : 40, color: INK, marginTop: 2 }, value),
  ]);
}

const isDataImage = (value) => typeof value === 'string' && value.startsWith('data:image/');

export function buildFreeCardElement({ run, background = null, heroPortrait = null } = {}) {
  if (!run || typeof run !== 'object' || !run.values || typeof run.values !== 'object') throw new TypeError('buildFreeCardElement needs a run');
  const gameId = run.gameId;
  const v = run.values;
  const title = cardText(run.title ?? FREE_GAMES[gameId]?.title ?? 'Free run', 32);
  const portrait = gameId === 'lester-blaster' && typeof v.hero === 'string' && v.hero !== '' && isDataImage(heroPortrait) ? heroPortrait : null;
  const score = count(v.score);
  const size = scoreFontSize(score, portrait ? 724 : 1088);
  const chip = chipText(run);
  const identity = identityText(run);

  const layers = [];
  if (isDataImage(background)) {
    layers.push({ type: 'img', props: { src: background, width: SHARE_CARD_WIDTH, height: SHARE_CARD_HEIGHT, style: { position: 'absolute', top: 0, left: 0, width: SHARE_CARD_WIDTH, height: SHARE_CARD_HEIGHT } } });
  }
  if (portrait) {
    // A soft magenta pool under the hero's feet, then the portrait itself.
    layers.push(flex({ position: 'absolute', left: 760, top: 470, width: 420, height: 160, borderRadius: 999, backgroundImage: 'radial-gradient(rgba(255, 61, 242, 0.32), rgba(255, 61, 242, 0) 70%)' }));
    layers.push({ type: 'img', props: { src: portrait, width: PORTRAIT_BOX.size, height: PORTRAIT_BOX.size, style: { position: 'absolute', left: PORTRAIT_BOX.left, top: PORTRAIT_BOX.top, width: PORTRAIT_BOX.size, height: PORTRAIT_BOX.size } } });
  }
  layers.push(flex({
    position: 'absolute', top: 0, left: 0, width: SHARE_CARD_WIDTH, height: SHARE_CARD_HEIGHT, flexDirection: 'column', justifyContent: 'space-between',
    padding: '44px 56px 40px', border: `4px solid ${MAGENTA_EDGE}`,
  }, [
    flex({ flexDirection: 'column', alignItems: 'flex-start' }, [
      text({ fontSize: 22, color: FREE_CARD_ACCENT, letterSpacing: 6 }, "LESTER'S ARCADE · FREE PLAY"),
      text({ fontSize: 44, color: INK, marginTop: 6 }, title),
      text({ fontSize: 22, color: GOLD, marginTop: 8, letterSpacing: 2 }, 'lestersarcade.io · play free'),
      ...(chip ? [chipNode(chip, CHIP_COLOURS[gameId] ?? GOLD, CHIP_FILLS[gameId] ?? CHIP_FILLS['lester-blaster'])] : []),
    ]),
    flex({ flexDirection: 'column' }, [
      flex({ alignItems: 'flex-end' }, [
        text({ fontSize: size, color: '#ffffff', lineHeight: 1, textShadow: `0 0 24px ${MAGENTA_GLOW}` }, score),
        text({ fontSize: Math.max(24, Math.round(size * 0.27)), color: FREE_CARD_ACCENT, marginLeft: 18, marginBottom: Math.round(size * 0.135), letterSpacing: 6 }, 'PTS'),
      ]),
      flex({ alignItems: 'center', marginTop: 10 }, [
        flex({ width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundImage: `linear-gradient(135deg, ${CYAN}, ${FREE_CARD_ACCENT})`, color: DEEP, fontSize: 22 }, 'LA'),
        text({ fontSize: 32, color: CYAN, marginLeft: 16 }, identity),
      ]),
    ]),
    flex({ alignItems: 'flex-end' }, tiles(run).map(tileNode)),
  ]));
  layers.push(flex({
    position: 'absolute', left: RIBBON_BOX.left, top: RIBBON_BOX.top, width: RIBBON_BOX.width, height: RIBBON_BOX.height,
    transform: 'rotate(45deg)', transformOrigin: 'center', alignItems: 'center', justifyContent: 'center',
    backgroundColor: FREE_CARD_ACCENT, color: '#14021a', fontSize: 26, letterSpacing: 3, boxShadow: '0 0 24px rgba(255, 61, 242, 0.6)',
  }, FREE_CARD_RIBBON));

  return flex({ position: 'relative', width: SHARE_CARD_WIDTH, height: SHARE_CARD_HEIGHT, overflow: 'hidden', backgroundColor: '#070512', fontFamily: 'Geist', color: INK }, layers);
}
