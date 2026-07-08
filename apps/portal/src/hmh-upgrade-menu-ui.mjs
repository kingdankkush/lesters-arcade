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
  'weapon-evolution': Object.freeze({ icon: '★', tone: 'gold', label: 'Golden Evolution' }),
  fallback: Object.freeze({ icon: '▲', tone: 'cyan', label: 'Augment' }),
});

const LEVEL_UP_CARD_CHROME = Object.freeze({
  id: 'level-up-card-frame',
  priority: 'P0',
  assetPath: './assets/generated/hmh-vfx-ui-chrome/level-up-card-frame.png',
  className: 'level-up-shell hmh-level-up-card-frame',
  cardClassName: 'level-up-upgrade-card hmh-upgrade-card-frame',
});

const RARITY_CORNER_PIPS = Object.freeze({
  common: 2,
  uncommon: 2,
  rare: 3,
  golden: 4,
  'super-rare': 4,
  'post-cap': 3,
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
  const rarity = choice.rarity ?? 'common';
  const branchLabel = choice.category === 'weapon' ? 'Weapon Branch' : category.label;
  const tone = choice.presentation?.tone ?? (rarity === 'golden' ? 'gold' : category.tone);
  const rarityLabel = choice.presentation?.label ?? String(rarity).toUpperCase();
  return Object.freeze({
    id: choice.id,
    title: choice.title,
    description: choice.description ?? '',
    index,
    category,
    branchLabel,
    rarity,
    presentation: choice.presentation ?? Object.freeze({ tone, label: rarity.toUpperCase() }),
    tone,
    chrome: Object.freeze({
      id: LEVEL_UP_CARD_CHROME.id,
      priority: LEVEL_UP_CARD_CHROME.priority,
      assetPath: LEVEL_UP_CARD_CHROME.assetPath,
      className: `${LEVEL_UP_CARD_CHROME.cardClassName} hmh-upgrade-card-tone-${tone} hmh-upgrade-card-rarity-${rarity}`,
      rarityLabel,
      cornerPips: RARITY_CORNER_PIPS[rarity] ?? 2,
    }),
    icon: choice.presentation?.icon ?? category.icon,
    gainLabel: choiceGainLabel(choice),
    rankLabel: `Rank ${choice.currentLevel ?? 0} → ${choice.nextLevel ?? 1}`,
    completionLabel: completionLabel(choice),
    rankPips,
    slotRole: choice.slotRole ?? (index === 0 ? 'continuation' : 'new'),
    slotLabel: choice.slotLabel ?? (index === 0 ? 'CONTINUE YOUR BUILD' : 'NEW TREE'),
    slotReason: choice.slotReason ?? null,
    dataset: Object.freeze({ skill: choice.id, tone, category: choice.category ?? 'unknown', rarity, slot: choice.slotRole ?? (index === 0 ? 'continuation' : 'new'), uiChrome: LEVEL_UP_CARD_CHROME.id, chromeTone: tone }),
    tooltip: choice.description ?? '',
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
    version: 'compact-upgrade-menu-ui-v3',
    title: 'Choose One Upgrade',
    subtitle: level ? `Level ${level} draft` : 'Upgrade draft',
    shell: Object.freeze({
      layout: 'compact-two-card-tooltip-draft',
      accessibility: 'Compact 44px-minimum tap targets with icons, rarity labels, rank pips, and tooltip/ARIA details instead of visible description clutter.',
      cardCount: cards.length,
      chrome: LEVEL_UP_CARD_CHROME,
      className: LEVEL_UP_CARD_CHROME.className,
    }),
    cards,
    lockedPreviewRail,
    reroll: Object.freeze({
      enabled: remaining > 0,
      remaining,
      label: `Reroll Both (${remaining})`,
    }),
  });
}
