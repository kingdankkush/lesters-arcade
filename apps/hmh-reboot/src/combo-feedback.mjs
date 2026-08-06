export const COMBO_MILESTONES = Object.freeze([5, 10, 20, 30]);

const count = (value) => Math.max(0, Math.min(1_000_000, Math.floor(Number(value) || 0)));

export function resolveComboPresentation(value) {
  const combo = count(value);
  const tier = combo >= 30 ? 'legend'
    : combo >= 20 ? 'overload'
      : combo >= 10 ? 'surge'
        : combo >= 5 ? 'hot'
          : combo > 0 ? 'building'
            : 'idle';
  return Object.freeze({
    count: combo,
    text: `×${combo}`,
    tier,
    label: combo > 0 ? `${combo} hit combo` : 'Combo reset',
  });
}

export function resolveComboFeedback({ previous = 0, current = 0, bossDefeated = false } = {}) {
  const before = count(previous);
  const after = count(current);
  const milestone = COMBO_MILESTONES.filter((value) => value > before && value <= after).at(-1) ?? null;
  const cue = bossDefeated && after >= 20
    ? 'combo-boss-threshold'
    : milestone
      ? 'combo-milestone'
      : before > 0 && after === 0
        ? 'combo-reset'
        : null;
  return Object.freeze({ previous: before, current: after, milestone, cue, presentation: resolveComboPresentation(after) });
}
