// Pure presentation model for the Hard Money Heroes character-select screen.
// Portal-only: imported by main.js and the official play routes, never by the
// HMH child, so nothing here spends child bundle headroom. No DOM, no state.

const NAVIGATION_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'Home', 'End']);
const STAT_MAX = 5;

export { STAT_MAX as HERO_SELECT_STAT_MAX };

function statPairs(entry) {
  const stats = entry?.stats;
  if (!Array.isArray(stats)) return [];
  return stats
    .filter((pair) => Array.isArray(pair) && typeof pair[0] === 'string' && Number.isFinite(Number(pair[1])))
    .map(([label, value]) => [label, Number(value)]);
}

/** The hero every other card is compared against: selected, else first unlocked, else first. */
export function referenceHeroId(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return null;
  const selected = entries.find((entry) => entry?.selected);
  if (selected) return selected.id ?? null;
  const unlocked = entries.find((entry) => !entry?.locked);
  return (unlocked ?? entries[0])?.id ?? null;
}

/**
 * Side-by-side stat comparison. Every hero gets, per stat, its value, the
 * reference hero's value, the signed delta, whether it is the roster best,
 * and whether that best is shared.
 */
export function compareHeroStats(entries, referenceId) {
  if (!Array.isArray(entries) || entries.length === 0) return [];
  const reference = entries.find((entry) => entry?.id === referenceId) ?? entries[0];
  const referenceStats = new Map(statPairs(reference));
  const bestByLabel = new Map();
  for (const entry of entries) {
    for (const [label, value] of statPairs(entry)) {
      const current = bestByLabel.get(label);
      if (!current || value > current.value) bestByLabel.set(label, { value, count: 1 });
      else if (value === current.value) current.count += 1;
    }
  }
  return entries.map((entry) => ({
    id: entry?.id ?? null,
    isReference: entry === reference,
    stats: statPairs(entry).map(([label, value]) => {
      const referenceValue = referenceStats.has(label) ? referenceStats.get(label) : value;
      const best = bestByLabel.get(label);
      return {
        label,
        value,
        referenceValue,
        delta: value - referenceValue,
        best: Boolean(best && best.value === value),
        tie: Boolean(best && best.value === value && best.count > 1),
      };
    }),
  }));
}

/** Compact signed delta label; U+2212 minus so the chip reads as typography, not a hyphen. */
export function formatStatDelta(delta) {
  const value = Number(delta);
  if (!Number.isFinite(value) || value === 0) return '=';
  return value > 0 ? `+${value}` : `−${Math.abs(value)}`;
}

/**
 * Roving-focus target for a keyboard event on the roster. Returns the next
 * card index, or null when the key is not a navigation key or no card can take
 * focus. Locked cards are skipped; arrows wrap; Home/End jump to the first and
 * last unlocked card. A negative `currentIndex` means no card is focused yet.
 */
export function nextHeroIndex(currentIndex, key, count, { locked = [] } = {}) {
  if (!NAVIGATION_KEYS.has(key) || !Number.isInteger(count) || count <= 0) return null;
  const lockedSet = new Set(locked);
  const unlocked = [];
  for (let index = 0; index < count; index += 1) if (!lockedSet.has(index)) unlocked.push(index);
  if (unlocked.length === 0) return null;
  if (key === 'Home') return unlocked[0];
  if (key === 'End') return unlocked[unlocked.length - 1];
  const step = key === 'ArrowRight' ? 1 : -1;
  const hasCurrent = Number.isInteger(currentIndex) && currentIndex >= 0 && currentIndex < count;
  if (!hasCurrent) return step > 0 ? unlocked[0] : unlocked[unlocked.length - 1];
  let index = currentIndex;
  for (let attempts = 0; attempts < count; attempts += 1) {
    index = (index + step + count) % count;
    if (!lockedSet.has(index)) return index;
  }
  return null;
}

/**
 * Which carousel card is "current" for the dot indicator: the card whose
 * centre is nearest the visible centre, computed from real offsets so the
 * portrait and landscape snap geometries agree.
 */
export function activeCarouselIndex({ scrollLeft, clientWidth, cards } = {}) {
  if (!Array.isArray(cards) || cards.length === 0) return 0;
  const left = Number.isFinite(Number(scrollLeft)) ? Number(scrollLeft) : 0;
  const width = Number.isFinite(Number(clientWidth)) ? Number(clientWidth) : 0;
  const centre = left + width / 2;
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  cards.forEach((card, index) => {
    const cardCentre = Number(card?.offsetLeft ?? 0) + Number(card?.width ?? 0) / 2;
    const distance = Math.abs(cardCentre - centre);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });
  return bestIndex;
}

/** Index of the rest frame (shown when motion is reduced) inside the spin order. */
export function restFrameIndex(directions, restDirection = 'south') {
  if (!Array.isArray(directions)) return 0;
  const index = directions.indexOf(restDirection);
  return index >= 0 ? index : 0;
}
