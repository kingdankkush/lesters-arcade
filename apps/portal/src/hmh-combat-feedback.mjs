export const COMBAT_FEEDBACK_CHANNELS = Object.freeze([
  'text',
  'damage-number',
  'sfx',
  'shake',
  'vfx',
  'flash',
  'state',
  'accessibility',
]);

export const COMBAT_FEEDBACK_MOMENTS = Object.freeze({
  'enemy-hit': Object.freeze({
    title: 'Enemy hit confirmation',
    requiredChannels: Object.freeze(['damage-number', 'sfx', 'vfx', 'flash', 'shake']),
    cues: Object.freeze({ sfxCue: 'enemy-hit', vfx: Object.freeze(['hit-sparks']), shake: 1.6, flashFrames: 8 }),
  }),
  'enemy-kill': Object.freeze({
    title: 'Enemy kill / reward confirmation',
    requiredChannels: Object.freeze(['text', 'sfx', 'vfx', 'shake', 'state']),
    cues: Object.freeze({ sfxCue: 'enemy-death', vfx: Object.freeze(['death-dust-burst', 'gore-pixel-splatter']), shake: 3.2, flashFrames: 0 }),
  }),
  'player-hit': Object.freeze({
    title: 'Player took damage',
    requiredChannels: Object.freeze(['text', 'sfx', 'vfx', 'flash', 'shake', 'state', 'accessibility']),
    cues: Object.freeze({ sfxCue: 'player-hit', vfx: Object.freeze(['hit-sparks', 'damage-vignette']), shake: 6, flashFrames: 9 }),
  }),
  'powerup-collect': Object.freeze({
    title: 'Power-up collected',
    requiredChannels: Object.freeze(['text', 'sfx', 'vfx', 'state', 'accessibility']),
    cues: Object.freeze({ sfxCue: 'pickup', vfx: Object.freeze(['coin-pickup-pop', 'pickup-rarity-beams']), shake: 1.2, flashFrames: 3 }),
  }),
  'xp-collect': Object.freeze({
    title: 'XP collected',
    requiredChannels: Object.freeze(['text', 'sfx', 'vfx', 'state']),
    cues: Object.freeze({ sfxCue: 'xp-pickup', vfx: Object.freeze(['coin-pickup-pop']), shake: 0.4, flashFrames: 0 }),
  }),
  'grenade-detonate': Object.freeze({
    title: 'Grenade detonation',
    requiredChannels: Object.freeze(['text', 'sfx', 'vfx', 'shake', 'flash']),
    cues: Object.freeze({ sfxCue: 'grenade-boom', vfx: Object.freeze(['grenade-explosion-ring', 'level-up-burst']), shake: 8, flashFrames: 8 }),
  }),
  'level-up': Object.freeze({
    title: 'Level-up draft opened',
    requiredChannels: Object.freeze(['text', 'sfx', 'vfx', 'state', 'accessibility']),
    cues: Object.freeze({ sfxCue: 'level-up', vfx: Object.freeze(['level-up-burst']), shake: 2.2, flashFrames: 5 }),
  }),
  'boss-clear': Object.freeze({
    title: 'Boss clear',
    requiredChannels: Object.freeze(['text', 'sfx', 'vfx', 'shake', 'state', 'accessibility']),
    cues: Object.freeze({ sfxCue: 'boss-warning', vfx: Object.freeze(['death-dust-burst', 'level-up-burst']), shake: 7, flashFrames: 10 }),
  }),
});

function freezeTexts(texts) {
  return Object.freeze(texts.filter(Boolean).map((entry) => Object.freeze(entry)));
}

function clampShake(value, { reduceMotion = false } = {}) {
  if (reduceMotion) return 0;
  return Math.max(0, Number(value ?? 0) || 0);
}

function clampFlash(value, { reduceFlash = false } = {}) {
  const frames = Math.max(0, Math.round(Number(value ?? 0) || 0));
  return reduceFlash ? Math.min(4, Math.ceil(frames * 0.42)) : frames;
}

function textEntry(text, color = '#ffe84d', dx = 0, dy = 0) {
  return Object.freeze({ text: String(text), color, dx, dy });
}

function planTexts(momentId, context = {}) {
  if (momentId === 'enemy-hit') {
    return [textEntry(context.label ?? `${Math.round(Number(context.amount ?? 0) || 0)}${context.crit ? '!' : ''}`, context.color ?? (context.crit ? '#ffe84d' : '#f9f7ff'), 0, -40)];
  }
  if (momentId === 'enemy-kill') {
    return [textEntry(`+${Number(context.score ?? 100).toLocaleString()}`, '#ffe84d', 0, -70)];
  }
  if (momentId === 'player-hit') {
    const amount = Math.round(Number(context.amount ?? context.applied ?? 0) || 0);
    const source = context.sourceLabel ? ` // ${context.sourceLabel}` : '';
    return [textEntry(`-${amount}% HP`, '#ff476f', 0, -80), source ? textEntry(`HIT${source}`, '#ffe84d', 24, -96) : null];
  }
  if (momentId === 'powerup-collect') {
    const title = context.title ?? 'POWER-UP';
    const rarity = context.rarity ? textEntry(String(context.rarity).toUpperCase(), '#ffe84d', 0, -62) : null;
    return [textEntry(title, '#45ff8a', 0, -46), rarity];
  }
  if (momentId === 'xp-collect') {
    return [textEntry(`XP +${Math.round(Number(context.value ?? 0) || 0)}`, '#19f7ff', 22, -46)];
  }
  if (momentId === 'grenade-detonate') {
    return [textEntry('BOOM', '#ff7b2f', 0, -30)];
  }
  if (momentId === 'level-up') {
    const level = context.level ?? '?';
    return [textEntry(`LEVEL ${level} UP`, '#ffe84d', -88, -78), textEntry(`REROLLS ${context.rerollsRemaining ?? 0}`, '#19f7ff', -80, -52)];
  }
  if (momentId === 'boss-clear') {
    const title = context.title ? ` // ${String(context.title).toUpperCase()}` : '';
    return [textEntry(`BOSS CLEAR${title}`, '#45ff8a', -112, -78)];
  }
  return [];
}

export function buildCombatFeedbackPlan(momentId, context = {}, accessibility = {}) {
  const moment = COMBAT_FEEDBACK_MOMENTS[momentId];
  if (!moment) throw new Error(`Unknown combat feedback moment: ${momentId}`);
  const cues = moment.cues;
  const shakeMul = Number(context.shakeMul ?? 1) || 1;
  return Object.freeze({
    id: momentId,
    title: moment.title,
    channels: moment.requiredChannels,
    texts: freezeTexts(planTexts(momentId, context)),
    sfxCue: context.sfxCue ?? cues.sfxCue,
    sfxVolume: Number.isFinite(Number(context.sfxVolume)) ? Number(context.sfxVolume) : 0.055,
    shake: clampShake((Number(cues.shake ?? 0) || 0) * shakeMul, accessibility),
    flashFrames: clampFlash(cues.flashFrames, accessibility),
    vfx: Object.freeze([...(cues.vfx ?? [])]),
    stateTags: Object.freeze([momentId, ...(context.stateTags ?? [])]),
    accessibilityNote: accessibility.reduceMotion || accessibility.reduceFlash
      ? 'Accessibility damping applied: reduced shake and/or flash while preserving text/SFX/state feedback.'
      : 'Full feedback enabled with text/SFX/VFX/state channels.',
  });
}

export function buildCombatFeedbackScorecard({ moments = COMBAT_FEEDBACK_MOMENTS } = {}) {
  const rows = Object.entries(moments).map(([id, moment]) => {
    const channels = [...(moment.requiredChannels ?? [])];
    const missing = channels.filter((channel) => !COMBAT_FEEDBACK_CHANNELS.includes(channel));
    return Object.freeze({ id, title: moment.title, channels: Object.freeze(channels), channelCount: channels.length, missing: Object.freeze(missing) });
  });
  const totalRequired = rows.reduce((sum, row) => sum + row.channelCount, 0);
  const totalMissing = rows.reduce((sum, row) => sum + row.missing.length, 0);
  return Object.freeze({
    version: 'wo-32-combat-feedback-v1',
    rows: Object.freeze(rows),
    totalMoments: rows.length,
    totalRequiredChannels: totalRequired,
    totalMissingChannels: totalMissing,
    overallScore: totalRequired === 0 ? 0 : Math.round(((totalRequired - totalMissing) / totalRequired) * 100),
  });
}

export function validateCombatFeedbackCompleteness(scorecard = buildCombatFeedbackScorecard()) {
  const gaps = [];
  for (const row of scorecard.rows) {
    if (row.channelCount < 4) gaps.push(`${row.id} has fewer than four feedback channels`);
    for (const missing of row.missing) gaps.push(`${row.id} references unknown channel ${missing}`);
  }
  for (const id of ['enemy-hit', 'enemy-kill', 'player-hit', 'powerup-collect', 'xp-collect', 'grenade-detonate', 'level-up', 'boss-clear']) {
    if (!scorecard.rows.some((row) => row.id === id)) gaps.push(`${id} missing from scorecard`);
  }
  return Object.freeze({ ok: gaps.length === 0, gaps: Object.freeze(gaps), score: scorecard.overallScore });
}
