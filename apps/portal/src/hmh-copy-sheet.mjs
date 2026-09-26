import { RANKED_FACTS, RANKED_WORDING } from './ranked-facts.mjs';

const freezeArray = (items) => Object.freeze(items.map((item) => Object.freeze(item)));

// The mode-select fallback lines (arcade-core's HMH descriptor; the SPA shows the per-game site copy
// of portal-content.mjs over them). Numbers come from ranked-facts.mjs (ranked-onboarding, 2026-09-26).
const FREE_MODE_COPY = `${RANKED_WORDING.free} It costs nothing, and runs are not ranked.`;
const RANKED_MODE_COPY = `Ranked costs ${RANKED_FACTS.totalZkLtc} testnet zkLTC per run. Get zkLTC free from the ${RANKED_FACTS.faucetName}. The arcade server checks your run and publishes it on LitVM.`;

export const HMH_COPY_STYLE_RULES = Object.freeze({
  maxHeadlineChars: 42,
  maxBodyChars: 190,
  bannedPlayerFacingPatterns: Object.freeze([
    Object.freeze({ id: 'em-dash', pattern: /—/, reason: 'Justin prefers no em dashes in player-facing copy.' }),
    Object.freeze({ id: 'paid-testnet', pattern: /\bpaid\b/i, reason: 'Ranked costs free testnet zkLTC; name the price instead of paid-mode language.' }),
    Object.freeze({ id: 'prototype-mode', pattern: /\bprototype\b/i, reason: 'Player-facing copy should read as game copy, not implementation status.' }),
  ]),
});

export const HMH_COPY_SHEET = Object.freeze({
  version: 'wo-30-copy-v1',
  voice: Object.freeze({
    pillars: Object.freeze([
      'short arcade verbs',
      'clear testnet cost language',
      'Crypto Wasteland nouns over generic roguelike jargon',
      'tell the player what to do next',
    ]),
    avoid: Object.freeze(['real-money framing on testnet', 'implementation-status language', 'em dashes', 'long lore paragraphs in buttons']),
  }),
  modeSelect: Object.freeze({
    free: Object.freeze({
      label: 'Free Mode',
      eyebrow: 'Practice Run',
      copy: FREE_MODE_COPY,
      cta: 'Start Free Run',
    }),
    ranked: Object.freeze({
      label: 'Play Ranked',
      eyebrow: 'Official Testnet Run',
      copy: RANKED_MODE_COPY,
      cta: 'Start Ranked Run',
    }),
  }),
  levelIntro: Object.freeze({
    title: 'Level 1 // Crypto Wasteland',
    controlsSummary: 'Move: WASD or arrows · Aim: mouse · Fire: left click · Grenade: right click or F',
    goalCopy: 'Survive the open route, harvest XP, break boss beats, and submit an official score only after game over.',
  }),
  readyOverlay: Object.freeze({
    title: 'READY',
    hint: 'PRESS SPACE OR CLICK TO START THE RUN',
  }),
  combatStatus: Object.freeze({
    levelReady: 'Level ready. Press Space or click READY to start the run.',
    runLive: 'Run live. Survive the Crypto Wasteland, harvest XP, break boss beats, and chase a higher score.',
    paused: 'Paused. Resume the run or exit to the arcade to abandon it.',
    resumed: 'Run resumed.',
  }),
  hud: Object.freeze({
    survived: 'SURVIVED',
    objective: 'OBJECTIVE',
    combo: 'COMBO',
    bossBeat: 'BOSS BEAT',
  }),
  glossary: freezeArray([
    { id: 'free-mode', term: 'Free Mode', approved: 'Free play. No wallet, never touches the chain, never ranks.' },
    { id: 'ranked', term: 'Play Ranked', approved: `A testnet run for ${RANKED_FACTS.totalZkLtc} zkLTC, checked by the arcade server and published on LitVM.` },
    { id: 'gas', term: 'zkLTC', approved: `The LitVM LiteForge testnet token, free from the ${RANKED_FACTS.faucetName}. ${RANKED_WORDING.value}` },
    { id: 'level-one', term: 'Crypto Wasteland', approved: 'Open survival route with boss beats.' },
    { id: 'boss-beat', term: 'Boss beat', approved: 'Scheduled mini-boss or major boss pressure spike.' },
  ]),
  surfaces: freezeArray([
    { id: 'mode-free', file: 'apps/portal/src/arcade-core.mjs', surface: 'Mode select card', text: FREE_MODE_COPY },
    { id: 'mode-ranked', file: 'apps/portal/src/arcade-core.mjs', surface: 'Mode select card', text: RANKED_MODE_COPY },
    { id: 'level-intro-goal', file: 'apps/portal/src/arcade-core.mjs', surface: 'Level intro', text: 'Survive the open route, harvest XP, break boss beats, and submit an official score only after game over.' },
    { id: 'ready-hint', file: 'apps/portal/main.js', surface: 'READY overlay', text: 'PRESS SPACE OR CLICK TO START THE RUN' },
    { id: 'combat-live-status', file: 'apps/portal/main.js', surface: 'Combat status', text: 'Run live. Survive the Crypto Wasteland, harvest XP, break boss beats, and chase a higher score.' },
  ]),
});

export function collectHmhCopyTexts(sheet = HMH_COPY_SHEET) {
  const texts = [];
  const visit = (value, path = []) => {
    if (typeof value === 'string') {
      texts.push(Object.freeze({ path: path.join('.'), text: value }));
      return;
    }
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, [...path, String(index)]));
      return;
    }
    for (const [key, child] of Object.entries(value)) visit(child, [...path, key]);
  };
  visit(sheet);
  return Object.freeze(texts);
}

export function hmhCopy(path, fallback = '') {
  const parts = String(path).split('.').filter(Boolean);
  let cursor = HMH_COPY_SHEET;
  for (const part of parts) cursor = cursor?.[part];
  return typeof cursor === 'string' ? cursor : fallback;
}

export function validateHmhCopySheet(sheet = HMH_COPY_SHEET, rules = HMH_COPY_STYLE_RULES) {
  const gaps = [];
  const texts = collectHmhCopyTexts(sheet);
  for (const entry of texts) {
    const text = entry.text.trim();
    if (!text) gaps.push(`${entry.path} is empty`);
    if (/label$|title$|eyebrow$|term$/.test(entry.path) && text.length > rules.maxHeadlineChars) {
      gaps.push(`${entry.path} headline too long (${text.length})`);
    }
    if (/copy$|goalCopy$|hint$|approved$|text$|levelReady$|runLive$|paused$|resumed$/.test(entry.path) && text.length > rules.maxBodyChars) {
      gaps.push(`${entry.path} body too long (${text.length})`);
    }
    for (const banned of rules.bannedPlayerFacingPatterns) {
      if (banned.pattern.test(text)) gaps.push(`${entry.path} violates ${banned.id}: ${banned.reason}`);
    }
  }
  const surfaceIds = new Set();
  for (const surface of sheet.surfaces ?? []) {
    if (surfaceIds.has(surface.id)) gaps.push(`duplicate surface id ${surface.id}`);
    surfaceIds.add(surface.id);
    if (!surface.file || !surface.surface || !surface.text) gaps.push(`${surface.id} missing file/surface/text`);
  }
  return Object.freeze({ ok: gaps.length === 0, gaps: Object.freeze(gaps), textCount: texts.length, surfaceCount: sheet.surfaces?.length ?? 0 });
}
