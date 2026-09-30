// Shared builders for the per-game achievement catalogs (contract §6.1).
// Pure ESM: no DOM, clock, randomness or environment access. The catalogs are
// read by the browser, the share-card renderer and the settle server alike.
//
// A rule turns stats (contract §6.3) plus verified history (§6.5) into
// `criteria` and `progress`, and names the stats paths it reads from history so
// historyFieldsFor can build the index SQL from catalog-owned paths only.
export const ACHIEVEMENT_TIERS = Object.freeze(['bronze', 'silver', 'gold', 'platinum', 'diamond', 'mythic']);
export const HISTORY_PATH_PATTERN = /^[a-zA-Z][a-zA-Z0-9]*(\.[a-zA-Z][a-zA-Z0-9]*)?$/;
const ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,63}$/;
const CATEGORY_PATTERN = /^[a-z-]{2,24}$/;
const IMAGE_PATTERN = /^\/assets\/[a-z0-9/._-]+\.png$/;

// A stats value at a one- or two-segment path; anything that is not a finite
// number reads as 0, so a malformed run can only fail a threshold.
export function statAt(stats, path) {
  const dot = path.indexOf('.');
  const holder = dot < 0 ? stats : stats?.[path.slice(0, dot)];
  const value = holder && typeof holder === 'object' ? holder[dot < 0 ? path : path.slice(dot + 1)] : undefined;
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}
const tally = (bucket, path) => {
  const value = bucket?.[path];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
};
const runsOf = (history) => (Number.isInteger(history?.runs) && history.runs > 0 ? history.runs : 0);
const checkPath = (path) => {
  if (!HISTORY_PATH_PATTERN.test(path)) throw new Error(`invalid stats path ${path}`);
  return path;
};
const checkTarget = (target) => {
  if (!Number.isFinite(target) || target <= 0) throw new Error(`invalid achievement target ${target}`);
  return target;
};

// Best single run: this run reaches `target`. Progress shows the best verified run.
export function best(path, target) {
  checkPath(path); checkTarget(target);
  return Object.freeze({
    criteria: (run) => statAt(run?.stats, path) >= target,
    progress: (run, history) => ({ current: Math.min(target, Math.max(tally(history?.maxima, path), run ? statAt(run.stats, path) : 0)), target }),
    sum: [], max: [path],
  });
}

// Cumulative: verified history plus this run reaches `target`.
export function total(path, target) {
  checkPath(path); checkTarget(target);
  return Object.freeze({
    criteria: (run, history) => tally(history?.sums, path) + statAt(run?.stats, path) >= target,
    progress: (run, history) => ({ current: Math.min(target, tally(history?.sums, path) + (run ? statAt(run.stats, path) : 0)), target }),
    sum: [path], max: [],
  });
}

// Verified runs for this wallet and game, including this one (history excludes it).
export function runs(target) {
  checkTarget(target);
  return Object.freeze({
    criteria: (run, history) => runsOf(history) + 1 >= target,
    progress: (run, history) => ({ current: Math.min(target, runsOf(history) + (run ? 1 : 0)), target }),
    sum: [], max: [],
  });
}

// A single-run condition over several stats. `max` names the paths whose
// verified best feeds `progress`, when the condition has a meaningful one.
export function when(test, { max = [], progress = null } = {}) {
  max.forEach(checkPath);
  return Object.freeze({ criteria: (run, history) => test(run?.stats ?? {}, history ?? {}) === true, progress, sum: [], max });
}

const UNAVAILABLE = Object.freeze({ criteria: () => false, progress: null, sum: [], max: [] });

// Builds one frozen catalog. `images(spec)` returns { image, lockedImage }.
export function defineCatalog(gameId, specs, images) {
  const sum = new Set();
  const max = new Set();
  const ids = new Set();
  const entries = specs.map((spec, index) => {
    const { id, title, description, tier, category, nft = false, rule = null } = spec;
    if (!ID_PATTERN.test(id) || ids.has(id)) throw new Error(`invalid or duplicate achievement id ${id}`);
    ids.add(id);
    if (typeof title !== 'string' || !title || title.length > 40) throw new Error(`${id}: title must be 1-40 characters`);
    if (typeof description !== 'string' || !description || description.length > 140) throw new Error(`${id}: description must be 1-140 characters`);
    if (!ACHIEVEMENT_TIERS.includes(tier)) throw new Error(`${id}: unknown tier ${tier}`);
    if (!CATEGORY_PATTERN.test(category)) throw new Error(`${id}: invalid category ${category}`);
    if (typeof nft !== 'boolean') throw new Error(`${id}: nft must be boolean`);
    const available = rule !== null;
    if (nft && !available) throw new Error(`${id}: an unavailable achievement cannot be an NFT candidate`);
    const { image, lockedImage } = images(spec);
    if (!IMAGE_PATTERN.test(image) || !IMAGE_PATTERN.test(lockedImage)) throw new Error(`${id}: images must be site-root /assets/ PNG paths`);
    const { criteria, progress, sum: sumPaths, max: maxPaths } = rule ?? UNAVAILABLE;
    for (const path of sumPaths) sum.add(path);
    for (const path of maxPaths) max.add(path);
    return Object.freeze({
      id, gameId, title, description, tier, category, nft, available, order: index + 1,
      image, lockedImage, criteria, progress,
    });
  });
  return Object.freeze({
    entries: Object.freeze(entries),
    historyFields: Object.freeze({ sum: Object.freeze([...sum].sort()), max: Object.freeze([...max].sort()) }),
  });
}
