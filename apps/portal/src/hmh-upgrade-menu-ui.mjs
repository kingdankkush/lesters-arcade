const CATEGORY_STYLES = Object.freeze({
  offense: Object.freeze({ iconId: 'offense', tone: 'red', label: 'Offense' }),
  defense: Object.freeze({ iconId: 'defense', tone: 'cyan', label: 'Defense' }),
  mobility: Object.freeze({ iconId: 'mobility', tone: 'green', label: 'Mobility' }),
  utility: Object.freeze({ iconId: 'utility', tone: 'gold', label: 'Utility' }),
  economy: Object.freeze({ iconId: 'economy', tone: 'gold', label: 'Economy' }),
  control: Object.freeze({ iconId: 'control', tone: 'cyan', label: 'Control' }),
  throwable: Object.freeze({ iconId: 'throwable', tone: 'orange', label: 'Throwable' }),
  status: Object.freeze({ iconId: 'status', tone: 'orange', label: 'Status' }),
  weapon: Object.freeze({ iconId: 'weapon', tone: 'weapon', label: 'Weapon Branch' }),
  'weapon-evolution': Object.freeze({ iconId: 'star', tone: 'gold', label: 'Golden Evolution' }),
  fallback: Object.freeze({ iconId: 'augment', tone: 'cyan', label: 'Augment' }),
});

const SEMANTIC_CATEGORY_ALIASES = Object.freeze({
  damage: 'offense',
  'crit-chance': 'offense',
  'crit-damage': 'offense',
  'projectile-speed': 'offense',
  pierce: 'offense',
  'spread-control': 'control',
  'max-hp': 'defense',
  armor: 'defense',
  'movement-speed': 'mobility',
  'reload-speed': 'utility',
  'pickup-magnet': 'utility',
  'magazine-size': 'weapon',
  'fire-rate': 'weapon',
  'grenade-capacity': 'throwable',
  'grenade-damage': 'throwable',
  'grenade-radius': 'throwable',
});

function semanticCategoryForChoice(choice = {}) {
  const raw = String(choice.category ?? 'fallback');
  return SEMANTIC_CATEGORY_ALIASES[raw] ?? raw;
}

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

const LEVEL_UP_EDGE_GAP_PX = 8;
const LEVEL_UP_INPUT_SHIELD_MS = 420;

function finiteNonNegative(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : fallback;
}

export function buildLevelUpViewportLayout({
  width = 1280,
  height = 720,
  safeAreaTop = 0,
  safeAreaRight = 0,
  safeAreaBottom = 0,
  safeAreaLeft = 0,
  cardCount = 2,
  isTouch = false,
} = {}) {
  const viewportWidth = Math.max(240, finiteNonNegative(width, 1280));
  const viewportHeight = Math.max(240, finiteNonNegative(height, 720));
  const baseInsetTop = finiteNonNegative(safeAreaTop) + LEVEL_UP_EDGE_GAP_PX;
  const insetRight = finiteNonNegative(safeAreaRight) + LEVEL_UP_EDGE_GAP_PX;
  const insetBottom = finiteNonNegative(safeAreaBottom) + LEVEL_UP_EDGE_GAP_PX;
  const insetLeft = finiteNonNegative(safeAreaLeft) + LEVEL_UP_EDGE_GAP_PX;
  const shortLandscape = viewportWidth > viewportHeight && viewportHeight <= 560;
  const touchTablet = Boolean(isTouch && viewportHeight >= viewportWidth && viewportWidth >= 640);
  const portraitSheet = viewportHeight >= viewportWidth && !touchTablet && (viewportWidth <= 720 || isTouch);
  const mode = shortLandscape
    ? 'landscape-grid'
    : touchTablet
      ? 'tablet-grid'
      : portraitSheet
        ? 'portrait-sheet'
        : 'desktop-grid';
  const availableWidth = Math.max(224, viewportWidth - insetLeft - insetRight);
  const availableHeight = Math.max(224, viewportHeight - baseInsetTop - insetBottom);
  const spaciousDesktop = mode === 'desktop-grid' && viewportWidth >= 1600 && viewportHeight >= 800;
  const phone = mode === 'portrait-sheet' && viewportWidth < 420;
  const density = shortLandscape ? 'short' : phone ? 'phone' : spaciousDesktop ? 'spacious' : 'standard';
  const widthCap = mode === 'portrait-sheet' ? 480 : spaciousDesktop ? 1040 : 792;
  const maxWidth = Math.min(widthCap, availableWidth);
  const boundedPanelHeight = mode === 'tablet-grid' ? 520 : spaciousDesktop ? 660 : availableHeight;
  const maxHeight = Math.min(boundedPanelHeight, availableHeight);
  const centeredPanel = mode === 'tablet-grid' || spaciousDesktop;
  const insetTop = baseInsetTop + (centeredPanel ? Math.max(0, (availableHeight - maxHeight) / 2) : 0);
  const columns = Math.max(1, Number(cardCount) > 1 && mode !== 'portrait-sheet' ? 2 : 1);

  return Object.freeze({
    version: 'responsive-level-up-layout-v2',
    mode,
    density,
    columns,
    compact: shortLandscape,
    insetTop,
    insetRight,
    insetBottom,
    insetLeft,
    maxWidth,
    maxHeight,
    cardMinHeight: shortLandscape ? 132 : phone ? 152 : spaciousDesktop ? 224 : 176,
    descriptionLines: spaciousDesktop ? 3 : shortLandscape ? 1 : 2,
    minimumActionSize: 44,
    cardsScrollable: true,
  });
}

export function buildLevelUpInteractionGate({
  openedAt = 0,
  shieldMs = LEVEL_UP_INPUT_SHIELD_MS,
  activePointerIds = [],
} = {}) {
  const normalizedOpenedAt = finiteNonNegative(openedAt);
  const normalizedShield = finiteNonNegative(shieldMs, LEVEL_UP_INPUT_SHIELD_MS);
  return Object.freeze({
    version: 'release-to-select-v1',
    openedAt: normalizedOpenedAt,
    armedAt: normalizedOpenedAt + normalizedShield,
    blockedPointerIds: Object.freeze([...new Set(activePointerIds)].map(String)),
  });
}

export function isLevelUpInteractionReady(gate, { now = 0, activePointerIds = [] } = {}) {
  if (!gate || finiteNonNegative(now) < gate.armedAt) return false;
  const active = new Set([...activePointerIds].map(String));
  return !gate.blockedPointerIds.some((pointerId) => active.has(pointerId));
}

export function canActivateLevelUpChoice(gate, {
  now = 0,
  activePointerIds = [],
  interactionStartedAt = 0,
} = {}) {
  if (!isLevelUpInteractionReady(gate, { now, activePointerIds })) return false;
  return finiteNonNegative(interactionStartedAt) >= gate.armedAt;
}

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

function buildXpProgress(xp, xpToNextLevel) {
  const current = Math.floor(finiteNonNegative(xp));
  const required = Math.floor(finiteNonNegative(xpToNextLevel));
  if (required <= 0) {
    return Object.freeze({ current, required: 0, percent: 100, readyAfterDraft: false, label: 'MAX LEVEL // XP PAYS SCORE' });
  }
  const readyAfterDraft = current >= required;
  return Object.freeze({
    current,
    required,
    percent: Math.min(100, Math.round((current / required) * 100)),
    readyAfterDraft,
    label: readyAfterDraft ? `NEXT DRAFT BANKED // ${current} XP` : `BANKED ${current} / ${required} XP`,
  });
}

function buildCard(choice, index, options) {
  const semanticCategory = semanticCategoryForChoice(choice);
  const category = upgradeCategoryStyle(semanticCategory, options);
  const rankPips = buildRankPips(choice);
  const rarity = choice.rarity ?? 'common';
  const branchLabel = choice.category === 'weapon' ? 'Weapon Branch' : category.label;
  const tone = choice.presentation?.tone ?? (rarity === 'golden' ? 'gold' : category.tone);
  const rarityLabel = choice.presentation?.label ?? String(rarity).toUpperCase();
  const slotRole = choice.slotRole ?? (index === 0 ? 'continuation' : 'new');
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
    iconId: choice.presentation?.iconId ?? category.iconId,
    gainLabel: choiceGainLabel(choice),
    effectLabel: choiceGainLabel(choice),
    rarityLabel,
    decisionLabel: slotRole === 'foundation' || (Number(choice.currentLevel ?? 0) === 0 && choice.slotLabel === 'START CORE')
      ? 'COMMIT'
      : slotRole === 'continuation' ? 'STAY COURSE' : 'DIVERSIFY',
    rankLabel: `Rank ${choice.currentLevel ?? 0} → ${choice.nextLevel ?? 1}`,
    completionLabel: completionLabel(choice),
    rankPips,
    slotRole,
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
  xp = 0,
  xpToNextLevel = 0,
} = {}) {
  const cards = freezeArray(choices.map((choice, index) => buildCard(choice, index, { colorblindTags })));
  const lockedPreviewRail = freezeArray(lockedPreviews.map((preview) => ({
    id: preview.id,
    title: preview.title ?? preview.id,
    gateHint: preview.gateHint ?? 'LOCKED',
  })));
  const remaining = Math.max(0, Number(rerollsRemaining ?? 0) || 0);
  return Object.freeze({
    version: 'tactical-upgrade-draft-v4',
    title: 'Choose Your Edge',
    subtitle: level ? `Level ${level} // build decision` : 'Build decision',
    instructions: 'Compare the effect, then press 1 or 2.',
    shell: Object.freeze({
      layout: 'tactical-two-card-draft',
      accessibility: 'Compact 44px-minimum tap targets with icons, rarity labels, rank pips, and tooltip/ARIA details instead of visible description clutter.',
      cardCount: cards.length,
      chrome: LEVEL_UP_CARD_CHROME,
      className: LEVEL_UP_CARD_CHROME.className,
    }),
    xpProgress: buildXpProgress(xp, xpToNextLevel),
    cards,
    lockedPreviewRail,
    reroll: Object.freeze({
      enabled: remaining > 0,
      remaining,
      label: `Reroll Both (${remaining})`,
    }),
  });
}
