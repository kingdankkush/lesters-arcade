const CATEGORY_STYLES = Object.freeze({
  offense: Object.freeze({ icon: '⚔', tone: 'red', label: 'Offense' }),
  defense: Object.freeze({ icon: '🛡', tone: 'cyan', label: 'Defense' }),
  mobility: Object.freeze({ icon: '🥾', tone: 'green', label: 'Mobility' }),
  utility: Object.freeze({ icon: '✦', tone: 'gold', label: 'Utility' }),
  economy: Object.freeze({ icon: '💎', tone: 'gold', label: 'Economy' }),
  control: Object.freeze({ icon: '🌀', tone: 'cyan', label: 'Control' }),
  throwable: Object.freeze({ icon: '💣', tone: 'orange', label: 'Throwable' }),
  status: Object.freeze({ icon: '🔥', tone: 'orange', label: 'Status' }),
  weapon: Object.freeze({ icon: '🔫', tone: 'weapon', label: 'Weapon Branch' }),
  fallback: Object.freeze({ icon: '▲', tone: 'cyan', label: 'Augment' }),
});

function freezeArray(items) {
  return Object.freeze(items.map((item) => Object.freeze(item)));
}

export function upgradeCategoryStyle(category, { colorblindTags = false } = {}) {
  const base = CATEGORY_STYLES[category] ?? CATEGORY_STYLES.fallback;
  return Object.freeze({
    ...base,
    colorblindTag: colorblindTags ? `TONE ${String(base.tone).toUpperCase()}` : null,
  });
}

function buildRankPips(choice) {
  const maxLevel = Math.max(1, Number(choice.maxLevel ?? choice.maxRank ?? 5) || 5);
  const currentLevel = Math.max(0, Number(choice.currentLevel ?? 0) || 0);
  const nextLevel = Math.max(1, Number(choice.nextLevel ?? currentLevel + 1) || currentLevel + 1);
  return freezeArray(Array.from({ length: maxLevel }, (_, index) => {
    const rank = index + 1;
    const state = rank <= currentLevel ? 'filled' : (rank === nextLevel ? 'next' : 'empty');
    return { rank, state, label: state === 'next' ? `Rank ${rank} next` : `Rank ${rank} ${state}` };
  }));
}

function choiceGainLabel(choice) {
  if (Number.isFinite(Number(choice.perLevelPercent))) return `+${choice.perLevelPercent}%`;
  if (Number.isFinite(Number(choice.delta))) return `+${choice.delta}`;
  return 'UPGRADE';
}

function completionLabel(choice) {
  const nextLevel = Number(choice.nextLevel ?? 0);
  const maxLevel = Number(choice.maxLevel ?? choice.maxRank ?? 0);
  if (maxLevel > 0 && nextLevel >= maxLevel) return 'MAX THIS PICK';
  if (nextLevel <= 1) return 'NEW BRANCH';
  return `RANK ${Math.max(0, nextLevel - 1)} → ${nextLevel}`;
}

function buildCard(choice, index, options) {
  const category = upgradeCategoryStyle(choice.category, options);
  const rankPips = buildRankPips(choice);
  const branchLabel = choice.category === 'weapon' ? 'Weapon Branch' : category.label;
  return Object.freeze({
    id: choice.id,
    title: choice.title,
    description: choice.description ?? '',
    index,
    category,
    branchLabel,
    tone: category.tone,
    icon: category.icon,
    gainLabel: choiceGainLabel(choice),
    rankLabel: `Rank ${choice.currentLevel ?? 0} → ${choice.nextLevel ?? 1}`,
    completionLabel: completionLabel(choice),
    rankPips,
    dataset: Object.freeze({ skill: choice.id, tone: category.tone, category: choice.category ?? 'unknown' }),
    ariaLabel: `${choice.title}. ${branchLabel}. ${choice.description ?? ''}`.trim(),
  });
}

export function buildUpgradeMenuPresentation({
  choices = [],
  rerollsRemaining = 0,
  colorblindTags = false,
  lockedPreviews = [],
  level = null,
} = {}) {
  const cards = freezeArray(choices.map((choice, index) => buildCard(choice, index, { colorblindTags })));
  const lockedPreviewRail = freezeArray(lockedPreviews.map((preview) => ({
    id: preview.id,
    title: preview.title ?? preview.id,
    gateHint: preview.gateHint ?? 'LOCKED',
  })));
  const remaining = Math.max(0, Number(rerollsRemaining ?? 0) || 0);
  return Object.freeze({
    version: 'wo-40-upgrade-menu-ui-v1',
    title: 'Choose One Augment',
    subtitle: level ? `Level ${level} upgrade draft` : 'Ranked tree draft',
    shell: Object.freeze({
      layout: 'focused-card-stack',
      accessibility: 'Mobile-safe 44px minimum tap targets, text labels for color and category, reduced card clutter.',
      cardCount: cards.length,
    }),
    cards,
    lockedPreviewRail,
    reroll: Object.freeze({
      enabled: remaining > 0,
      remaining,
      label: `Reroll (${remaining})`,
    }),
  });
}
