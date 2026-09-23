// Ranked and Free share templates for the parent Ranked results screen
// (contract §7.4; guide §5.12, decisions D12 and D13). Portal-only: the lazy
// results chunk imports this module through ranked-results-model.mjs, so the
// Chikun and STACKED children never ship the template data. The helpers the
// children share (buildShareLinks, the one-liners, the row) stay in
// share-links.mjs, which also owns the fragment scrubber these templates use.
import { X_MENTION, safeShareFragment, shareClock } from './share-links.mjs';

function number(value) {
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

// Stats display at most 9,999,999 (no real run gets near it) and scores at
// most 999,999,999,999, which keeps every template inside X's limit.
function count(value, cap = 9_999_999) {
  return Math.min(number(value), cap).toLocaleString('en-US');
}

// Guide §5.12 templates, minus the URL line (X appends the url parameter).
const TEMPLATES = Object.freeze({
  'lester-blaster': Object.freeze({
    icon: '🏆',
    title: 'Hard Money Heroes',
    detail: () => '',
    stats: (s) => `☠ ${count(s.kills)} kills · 🔥 ×${count(s.maxCombo)} combo · ⏱ ${shareClock(s.survivalSeconds)}`,
    call: 'Can you beat it?',
  }),
  chikun: Object.freeze({
    icon: '🐔',
    title: "Chikun's Escape",
    detail: (s) => {
      const region = safeShareFragment(s.regionName ?? s.regionReached ?? '', 12);
      return ` · Lap ${count(number(s.laps) + 1)}${region ? ` · ${region[0].toUpperCase()}${region.slice(1)}` : ''}`;
    },
    stats: (s) => `🌾 ${count(s.forksPassed)} forks · ⚡ ${count(s.nearMisses)} near-misses · 🪙 ${count(s.coinsCollected)} coins`,
    call: 'Beat my flight',
  }),
  stacked: Object.freeze({
    icon: '🧱',
    title: 'STACKED',
    detail: () => '',
    stats: (s) => `📈 ${count(s.lines)} lines · Lv ${count(Math.max(1, number(s.level)))} · ${count(s.quadClears)} ${number(s.quadClears) === 1 ? 'Halving' : 'Halvings'}`,
    call: 'Stack higher',
  }),
});

function templateFor(gameId) {
  const template = TEMPLATES[gameId];
  if (!template) throw new TypeError(`no share template for ${gameId}`);
  return template;
}

// Used only for a published (confirmed) run: it carries the verification line.
export function buildRankedShareText(gameId, { score = 0, standingLabel = '', stats = {}, personalBest = false } = {}) {
  const template = templateFor(gameId);
  const standing = safeShareFragment(standingLabel);
  return [
    `${template.icon} RANKED · ${template.title}`,
    `${count(score, 999_999_999_999)} pts${standing ? ` · ${standing}` : ''}${template.detail(stats ?? {})}`,
    template.stats(stats ?? {}),
    ...(personalBest ? ['🔥 New personal best!'] : []),
    '⛓ Verified on LitVM',
    `${template.call} ${X_MENTION}`,
  ].join('\n');
}

// Free, preview and practice runs: no verification line (guide §5.12).
export function buildFreeShareText(gameId, { score = 0, stats = {} } = {}) {
  const template = templateFor(gameId);
  return [
    `🕹 FREE PLAY · ${template.title}`,
    `${count(score, 999_999_999_999)} pts${template.detail(stats ?? {})}`,
    template.stats(stats ?? {}),
    `Practising on ${X_MENTION}`,
  ].join('\n');
}
