// Free run text tables shared by the Free card (render-free-card.mjs) and
// the Free page (render-free-page.mjs), so the two surfaces can never
// disagree on a label (plan docs/handoffs/free-share-20260926.md §6.1, J13).
//
// decodeFreeRun() wraps the shared token decoder; every value it hands out is
// a bounded integer, a boolean or an id from an enum the token pins, and
// every string built here is ASCII/Latin-1 (`×`, `·`, `'`, `—`): no emoji, so
// the card never needs a fallback font and the page needs no special casing.
// Both surfaces still escape or glyph-filter everything.
import { decodeFreeShareToken } from '../../apps/portal/src/free-share-token.mjs';

export const FREE_GAMES = Object.freeze({
  'lester-blaster': Object.freeze({ title: 'Hard Money Heroes', slug: 'hard-money-heroes' }),
  chikun: Object.freeze({ title: "Chikun's Escape", slug: 'chikun' }),
  stacked: Object.freeze({ title: 'STACKED', slug: 'stacked' }),
});
export const HERO_LABELS = Object.freeze({ '': 'Survivor', 'lit-commando': 'Lit Commando', 'lit-valkyrie': 'Lit Valkyrie', 'lester-original': 'Lester', lilly: 'Lilly' });
export const REGION_LABELS = Object.freeze({ farmland: 'Farmland', forest: 'Forest', town: 'Town', city: 'City', industrial: 'Industrial', suburbs: 'Suburbs', coast: 'Coast' });
// The URL fully determines a Free page and card, so both are cached for a day
// at the edge (an hour in browsers) and served stale for a week while
// revalidating; a renderer change reaches viewers within a day, a layout
// change bumps the token version. A deterministic 400 (bad slug or token)
// is held a minute at the edge so repeated probes of one URL cost nothing.
export const FREE_SHARE_CACHE = 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800';
export const FREE_SHARE_INVALID_CACHE = 'public, max-age=0, s-maxage=60';

export function decodeFreeRun(slug, token) {
  const decoded = decodeFreeShareToken(slug, token);
  if (!decoded.ok) return decoded;
  const game = FREE_GAMES[decoded.gameId];
  return { ok: true, run: Object.freeze({ gameId: decoded.gameId, slug: game.slug, title: game.title, token, values: decoded.values }) };
}

function whole(value) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.round(value)) : null;
}

export function count(value) {
  const number = whole(value);
  return number === null ? '—' : number.toLocaleString('en-US');
}

// m:ss, or h:mm:ss past an hour (the Ranked card and page clock).
export function clock(value) {
  const seconds = whole(value);
  if (seconds === null) return '—';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = String(seconds % 60).padStart(2, '0');
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${rest}` : `${minutes}:${rest}`;
}

function heroLabel(hero) {
  return typeof hero === 'string' && Object.hasOwn(HERO_LABELS, hero) ? HERO_LABELS[hero] : HERO_LABELS[''];
}

function regionLabel(region) {
  return typeof region === 'string' && Object.hasOwn(REGION_LABELS, region) ? REGION_LABELS[region] : REGION_LABELS.farmland;
}

function halvings(value) {
  return `${count(value)} ${whole(value) === 1 ? 'Halving' : 'Halvings'}`;
}

const valuesOf = (run) => (run?.values && typeof run.values === 'object' ? run.values : {});

// The line under the score: who or where, never a handle (nothing personal
// exists in a Free run).
export function identityText(run) {
  const v = valuesOf(run);
  switch (run?.gameId) {
    case 'lester-blaster': return `${heroLabel(v.hero)} · Level ${count(v.level)}`;
    case 'chikun': return `Lap ${count((whole(v.laps) ?? 0) + 1)} · ${regionLabel(v.region)}`;
    case 'stacked': return `${clock(v.survivalSeconds)} played · ×${count(v.maxCombo)} best combo`;
    default: return '';
  }
}

// The one flag chip per game, upper case for the card; '' when unset.
export function chipText(run) {
  const v = valuesOf(run);
  switch (run?.gameId) {
    case 'lester-blaster': return v.bossDefeated === true ? 'LIQUIDATOR LIQUIDATED' : '';
    case 'chikun': return v.daily === true ? 'DAILY COURSE' : '';
    case 'stacked': return v.assisted === true ? 'ASSISTED' : '';
    default: return '';
  }
}

// The same chip in sentence case for the page description and stat rows.
export function chipLabel(run) {
  const chip = chipText(run);
  return chip ? chip.charAt(0) + chip.slice(1).toLowerCase() : '';
}

// The three headline tiles, in the Ranked card's order, each with the glyph
// id render-free-card.mjs draws.
export function tiles(run) {
  const v = valuesOf(run);
  switch (run?.gameId) {
    case 'lester-blaster': return [{ glyph: 'skull', label: 'KILLS', value: count(v.kills) }, { glyph: 'clock', label: 'TIME', value: clock(v.survivalSeconds) }, { glyph: 'flame', label: 'COMBO', value: `×${count(v.maxCombo)}` }];
    case 'chikun': return [{ glyph: 'fork', label: 'FORKS', value: count(v.forksPassed) }, { glyph: 'bolt', label: 'NEAR-MISSES', value: count(v.nearMisses) }, { glyph: 'coin', label: 'COINS', value: count(v.coinsCollected) }];
    case 'stacked': return [{ glyph: 'chart', label: 'LINES', value: count(v.lines) }, { glyph: 'arrow', label: 'LEVEL', value: count(v.level) }, { glyph: 'halving', label: 'HALVINGS', value: count(v.quadClears) }];
    default: return [];
  }
}

// One line of stats for og:description (the Ranked page's wording).
export function summaryText(run) {
  const v = valuesOf(run);
  switch (run?.gameId) {
    case 'lester-blaster': return `${count(v.kills)} kills · ${clock(v.survivalSeconds)} survived · ×${count(v.maxCombo)} combo`;
    case 'chikun': return `${count(v.forksPassed)} forks · ${count(v.nearMisses)} near-misses · ${count(v.coinsCollected)} coins`;
    case 'stacked': return `${count(v.lines)} lines · level ${count(v.level)} · ${halvings(v.quadClears)}`;
    default: return '';
  }
}

export function pageTitle(run) {
  return `${count(valuesOf(run).score)} pts in ${run?.title ?? 'a Free run'} · Free Play`;
}

export function pageDescription(run) {
  const label = chipLabel(run);
  return `Free Play · self-reported · ${identityText(run)}${label ? ` · ${label}` : ''} · ${summaryText(run)}. Can you beat it? Play free or Ranked at Lester's Arcade.`;
}

export function imageAlt(run) {
  return `${run?.title ?? 'Free run'} Free Play score card: ${count(valuesOf(run).score)} points (self-reported)`;
}

// [label, value] rows for the page's stat list.
export function statRows(run) {
  const v = valuesOf(run);
  switch (run?.gameId) {
    case 'lester-blaster':
      return [['Hero', heroLabel(v.hero)], ['Level', count(v.level)], ['Kills', count(v.kills)], ['Time', clock(v.survivalSeconds)], ['Best combo', `×${count(v.maxCombo)}`], ['Boss', v.bossDefeated === true ? 'Defeated' : 'Not defeated']];
    case 'chikun':
      return [['Region', regionLabel(v.region)], ['Laps', count(v.laps)], ['Forks', count(v.forksPassed)], ['Near-misses', count(v.nearMisses)], ['Coins', count(v.coinsCollected)], ['Best combo', `×${count(v.bestCombo)}`], ['Time', clock(v.survivalSeconds)], ...(v.daily === true ? [['Course', 'Daily']] : [])];
    case 'stacked':
      return [['Lines', count(v.lines)], ['Level', count(v.level)], ['Halvings', count(v.quadClears)], ['Best combo', `×${count(v.maxCombo)}`], ['Time', clock(v.survivalSeconds)], ...(v.assisted === true ? [['Assisted', 'Yes']] : [])];
    default: return [];
  }
}
