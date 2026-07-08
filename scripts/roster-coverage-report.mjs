import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { HMH_ANIMATED_ROSTER } from '../apps/portal/assets/generated/hmh-animated-roster/hmh-animated-roster.mjs';
import {
  LESTER_BLASTER_ENEMY_CATALOG,
  HMH_LEVEL_ONE_BOSS_PROXY_ROSTER,
} from '../apps/portal/src/arcade-core.mjs';
import { HMH_PLAYABLE_CHARACTER_VISUAL_KITS } from '../apps/portal/src/hmh-character-config.mjs';

export const ISO_8_DIRECTIONS = Object.freeze([
  'south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west',
]);

export const HERO_REQUIRED_STATES = Object.freeze([
  'idle', 'walk', 'run', 'shoot', 'melee', 'throw', 'dash', 'hurt', 'death', 'victory',
]);

export const ENEMY_REQUIRED_STATES = Object.freeze([
  'idle', 'walk', 'run', 'attack-tell', 'attack', 'hit', 'death', 'spawn-in',
]);

export const RANGED_REQUIRED_STATES = Object.freeze(['shoot']);
export const MINIBOSS_EXTRA_STATES = Object.freeze(['enrage']);
export const BOSS_EXTRA_STATES = Object.freeze(['special', 'phase-transition']);

const ZERO_TIER_HANDOFF_ACTORS = Object.freeze([
  'chain-reaper-boss',
  'bit-whale-boss',
  'warren-spear-rider',
  'rugpull-summoner',
  'gas-beast-tank',
  'crypto-bro-rusher',
  'evil-banker-ranged',
  'liquidation-cascade-golem',
]);

const HANDOFF_RECOMMENDED_KEEP = Object.freeze([
  'gas-beast-tank',
  'crypto-bro-rusher',
  'evil-banker-ranged',
  'warren-spear-rider',
]);

const HandoffRecommendedDeferred = Object.freeze([
  'chain-reaper-boss',
  'bit-whale-boss',
  'rugpull-summoner',
]);

const ENEMY_KEY_TO_ROSTER_KEY = Object.freeze({
  trenchDegen: 'trench-degen',
  evilBanker: 'evil-banker-ranged',
  cryptoBro: 'crypto-bro-rusher',
  gasBeast: 'gas-beast-tank',
  warrenSpearRider: 'warren-spear-rider',
});

const STATE_ALIASES = Object.freeze({
  idle: Object.freeze(['idle', 'hover', 'float', 'cloak', 'idle-cast', 'fake-loot', 'stomp']),
  walk: Object.freeze(['walk', 'run', 'skate', 'scurry', 'hover', 'float', 'bank', 'cloak']),
  run: Object.freeze(['run', 'walk', 'skate', 'scurry', 'dash-flank', 'panic-charge', 'bank']),
  shoot: Object.freeze(['shoot', 'attack-ranged', 'attack', 'clamp-fire', 'laser-ping', 'popup-lure']),
  melee: Object.freeze(['melee', 'attack', 'wild-swing', 'rug-drag', 'slide-rush', 'dive']),
  throw: Object.freeze(['throw', 'attack', 'tar-drop']),
  hurt: Object.freeze(['hurt', 'hit', 'crack']),
  hit: Object.freeze(['hit', 'hurt', 'crack']),
  death: Object.freeze(['death', 'pop', 'explode', 'crumple', 'shatter', 'wipeout', 'fade', 'cascade-collapse']),
  'attack-tell': Object.freeze(['attack-tell', 'tell', 'telegraph', 'snap-open', 'burrow']),
  attack: Object.freeze(['attack', 'shoot', 'melee', 'tax-pulse', 'tar-drop', 'laser-ping', 'dive', 'shockwave']),
  'spawn-in': Object.freeze(['spawn-in', 'spawn', 'revive', 'unburrow']),
  enrage: Object.freeze(['enrage', 'phase-2', 'phase-3-enrage']),
  special: Object.freeze(['special', 'super', 'super-move']),
  'phase-transition': Object.freeze(['phase-transition', 'intro', 'phase-1', 'phase-2', 'phase-3-enrage']),
  dash: Object.freeze(['dash', 'roll']),
  victory: Object.freeze(['victory', 'levelup']),
});

function repoRootFromHere() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
}

function sortedUnique(values) {
  return Object.freeze([...new Set(values.filter(Boolean))].sort());
}

function framesForState(animations = {}, state) {
  const candidates = STATE_ALIASES[state] ?? [state];
  let best = null;
  for (const candidate of candidates) {
    const dirs = animations[candidate];
    if (!dirs || typeof dirs !== 'object') continue;
    const directionEntries = Object.entries(dirs).filter(([, frames]) => Array.isArray(frames) && frames.length > 0);
    const directionCount = directionEntries.length;
    const frameCounts = directionEntries.map(([, frames]) => frames.length);
    const score = directionCount * 1000 + frameCounts.reduce((sum, count) => sum + count, 0);
    if (!best || score > best.score) {
      best = {
        matchedState: candidate,
        directionCount,
        directions: sortedUnique(directionEntries.map(([direction]) => direction)),
        minFrames: frameCounts.length ? Math.min(...frameCounts) : 0,
        maxFrames: frameCounts.length ? Math.max(...frameCounts) : 0,
        score,
      };
    }
  }
  return best;
}

function derivedFramesForState(animations = {}, state) {
  const candidates = state === 'spawn-in'
    ? ['spawn-in', 'idle', 'walk', 'run', 'attack']
    : state === 'attack-tell'
      ? ['attack-tell', 'attack', 'walk', 'run', 'idle']
      : [];
  if (!candidates.length) return null;
  if (framesForState(animations, candidates[0])) return null;
  for (const sourceState of candidates.slice(1)) {
    const source = framesForState(animations, sourceState);
    if (!source) continue;
    return Object.freeze({
      ...source,
      matchedState: `derived:${state}<-${source.matchedState}`,
      derived: true,
    });
  }
  return null;
}

function stateCoverage(animations = {}, state) {
  const match = framesForState(animations, state) ?? derivedFramesForState(animations, state);
  if (!match || match.directionCount <= 0) {
    return Object.freeze({ state, status: 'missing', matchedState: null, derived: false, directionCount: 0, directions: Object.freeze([]), minFrames: 0, maxFrames: 0 });
  }
  const status = match.directionCount >= ISO_8_DIRECTIONS.length ? 'complete' : 'partial-direction';
  return Object.freeze({
    state,
    status,
    matchedState: match.matchedState,
    derived: Boolean(match.derived),
    directionCount: match.directionCount,
    directions: match.directions,
    minFrames: match.minFrames,
    maxFrames: match.maxFrames,
  });
}

function roleRequiredStates(role, { ranged = false } = {}) {
  if (role === 'hero') return HERO_REQUIRED_STATES;
  if (role === 'boss') return Object.freeze([...ENEMY_REQUIRED_STATES, ...RANGED_REQUIRED_STATES, ...BOSS_EXTRA_STATES]);
  if (role === 'miniboss') return Object.freeze([...ENEMY_REQUIRED_STATES, ...(ranged ? RANGED_REQUIRED_STATES : []), ...MINIBOSS_EXTRA_STATES]);
  return Object.freeze([...ENEMY_REQUIRED_STATES, ...(ranged ? RANGED_REQUIRED_STATES : [])]);
}

function actorCoverage(key, actor, options = {}) {
  const role = actor?.role ?? options.role ?? 'enemy';
  const animations = actor?.animations ?? {};
  const actualStates = sortedUnique(Object.keys(animations));
  const requiredStates = roleRequiredStates(role, options);
  const states = Object.fromEntries(requiredStates.map((state) => [state, stateCoverage(animations, state)]));
  const gaps = Object.values(states).filter((entry) => entry.status !== 'complete');
  const status = actualStates.length === 0
    ? 'zero-animation'
    : gaps.length === 0
      ? 'complete'
      : 'partial';
  return Object.freeze({
    key,
    role,
    actualStates,
    requiredStates,
    states: Object.freeze(states),
    summary: Object.freeze({
      status,
      missingStates: Object.freeze(Object.values(states).filter((entry) => entry.status === 'missing').map((entry) => entry.state)),
      partialStates: Object.freeze(Object.values(states).filter((entry) => entry.status === 'partial-direction').map((entry) => entry.state)),
    }),
  });
}

function bossProxyByEnemyId() {
  return new Map(HMH_LEVEL_ONE_BOSS_PROXY_ROSTER.map((entry) => [entry.enemyId, entry]));
}

function rosterKeyFromAssetKey(assetKey = '') {
  return String(assetKey).split('/').filter(Boolean).at(-1) ?? '';
}

function actorKeyForEnemy(enemy, bossProxy = null) {
  const proxyKey = rosterKeyFromAssetKey(bossProxy?.animatedCuratedAssetKey);
  if (proxyKey && HMH_ANIMATED_ROSTER[proxyKey]) return proxyKey;
  if (HMH_ANIMATED_ROSTER[enemy.id]) return enemy.id;
  if (enemy.enemyKey && ENEMY_KEY_TO_ROSTER_KEY[enemy.enemyKey]) return ENEMY_KEY_TO_ROSTER_KEY[enemy.enemyKey];
  if (String(enemy.id).includes('cave') && HMH_ANIMATED_ROSTER['trench-degen']) return 'trench-degen';
  return proxyKey || enemy.id;
}

function isRangedEnemy(enemy = {}) {
  return enemy.preferredRangeMode === 'ranged'
    || String(enemy.class ?? '').includes('ranged')
    || String(enemy.class ?? '').includes('sniper')
    || String(enemy.class ?? '').includes('rifle')
    || (enemy.attackPatterns ?? []).some((pattern) => String(pattern).match(/shot|rifle|laser|hook|volley|spread|burst|lure/i));
}

function levelOneShipScopeRows(actorReports) {
  const proxyMap = bossProxyByEnemyId();
  return Object.freeze(LESTER_BLASTER_ENEMY_CATALOG
    .filter((enemy) => Number(enemy.spawnAfterSeconds ?? 0) <= 480)
    .map((enemy) => {
      const proxy = proxyMap.get(enemy.id) ?? null;
      const actorKey = actorKeyForEnemy(enemy, proxy);
      const actor = actorReports[actorKey] ?? actorCoverage(actorKey, HMH_ANIMATED_ROSTER[actorKey] ?? { role: 'enemy', animations: {} }, { ranged: isRangedEnemy(enemy) });
      const role = proxy?.role ?? (String(enemy.class ?? '').includes('miniboss') ? 'mini-boss' : 'enemy');
      return Object.freeze({
        enemyId: enemy.id,
        title: enemy.title,
        actorKey,
        source: proxy ? `boss-proxy:${proxy.zoneId}` : enemy.enemyKey ? `enemyKey:${enemy.enemyKey}` : 'catalog-id',
        role,
        spawnAfterSeconds: enemy.spawnAfterSeconds ?? 0,
        ranged: isRangedEnemy(enemy),
        coverageStatus: actor.summary.status,
        missingStates: actor.summary.missingStates,
        partialStates: actor.summary.partialStates,
      });
    }));
}

function lesterFragmentation(repoRoot) {
  const lesterDir = path.join(repoRoot, 'apps/portal/assets/generated/hmh-animated-roster/lester');
  const splinterDirs = existsSync(lesterDir)
    ? readdirSync(lesterDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((name) => /^anim\d+$/.test(name) || /^(idle|walk|victory)-\d+$/.test(name))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    : [];
  const lesterFrames = Object.values(HMH_ANIMATED_ROSTER.lester?.animations ?? {})
    .flatMap((dirMap) => Object.values(dirMap ?? {}).flat());
  const manifestReferencesSplinterDirs = sortedUnique(splinterDirs.filter((dir) => lesterFrames.some((frame) => String(frame).includes(`/lester/${dir}/`))));
  return Object.freeze({
    splinterDirs: Object.freeze(splinterDirs),
    manifestReferencesSplinterDirs,
    recommendation: splinterDirs.length && manifestReferencesSplinterDirs.length === 0 ? 'vault-splinter-dirs' : splinterDirs.length ? 'reconcile-before-vault' : 'clean',
  });
}

function buildScopeRuling(levelOneShipScope) {
  const shipActorKeys = new Set(levelOneShipScope.map((row) => row.actorKey));
  const zeroTierInRuntimeScope = ZERO_TIER_HANDOFF_ACTORS.filter((actor) => shipActorKeys.has(actor));
  const currentRuntimeDeferredCandidates = HandoffRecommendedDeferred.filter((actor) => !shipActorKeys.has(actor));
  const handoffKeepNotInCurrentCatalog = HANDOFF_RECOMMENDED_KEEP.filter((actor) => !shipActorKeys.has(actor));
  return Object.freeze({
    recommendedKeep: HANDOFF_RECOMMENDED_KEEP,
    zeroTierInRuntimeScope: Object.freeze(zeroTierInRuntimeScope),
    handoffKeepNotInCurrentCatalog: Object.freeze(handoffKeepNotInCurrentCatalog),
    deferred: Object.freeze(currentRuntimeDeferredCandidates),
    note: 'Current runtime catalog proves liquidation-cascade-golem is Level-1-spawnable; do not defer it without cutting or replacing that catalog entry.',
  });
}

export function buildRosterCoverageReport({ repoRoot = repoRootFromHere() } = {}) {
  const actors = Object.freeze(Object.fromEntries(Object.entries(HMH_ANIMATED_ROSTER).map(([key, actor]) => [key, actorCoverage(key, actor)])));
  const levelOneShipScope = levelOneShipScopeRows(actors);
  const scopeRuling = buildScopeRuling(levelOneShipScope);
  const zeroAnimationActors = Object.freeze(Object.values(actors).filter((actor) => actor.summary.status === 'zero-animation').map((actor) => actor.key).sort());
  const partialActors = Object.freeze(Object.values(actors).filter((actor) => actor.summary.status === 'partial').map((actor) => actor.key).sort());
  const completeActors = Object.freeze(Object.values(actors).filter((actor) => actor.summary.status === 'complete').map((actor) => actor.key).sort());
  return Object.freeze({
    generatedBy: 'scripts/roster-coverage-report.mjs',
    canonicalManifest: 'apps/portal/assets/generated/hmh-animated-roster/hmh-animated-roster.mjs',
    visualKitConfig: Object.freeze(Object.fromEntries(Object.entries(HMH_PLAYABLE_CHARACTER_VISUAL_KITS).map(([key, kit]) => [key, kit.manifestPath]))),
    summary: Object.freeze({
      actorCount: Object.keys(HMH_ANIMATED_ROSTER).length,
      completeActorCount: completeActors.length,
      partialActorCount: partialActors.length,
      zeroAnimationActorCount: zeroAnimationActors.length,
      levelOneShipEnemyCount: levelOneShipScope.length,
    }),
    actors,
    levelOneShipScope,
    scopeRuling,
    fragmentation: Object.freeze({ lester: lesterFragmentation(repoRoot) }),
    zeroAnimationActors,
    partialActors,
    completeActors,
  });
}

function table(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map((cell) => String(cell ?? '').replaceAll('\n', ' ').replaceAll('|', '\\|')).join(' | ')} |`),
  ].join('\n');
}

function summarizeStateList(actor) {
  return actor.requiredStates.map((state) => {
    const entry = actor.states[state];
    if (!entry || entry.status === 'missing') return `${state}:missing`;
    const suffix = entry.matchedState === state ? '' : `→${entry.matchedState}`;
    return `${state}:${entry.directionCount}d${suffix}`;
  }).join(', ');
}

export function renderRosterCoverageMarkdown(report) {
  const actorRows = Object.values(report.actors)
    .sort((a, b) => `${a.role}:${a.key}`.localeCompare(`${b.role}:${b.key}`))
    .map((actor) => [
      actor.key,
      actor.role,
      actor.summary.status,
      actor.actualStates.join(', ') || 'none',
      actor.summary.missingStates.join(', ') || 'none',
      actor.summary.partialStates.join(', ') || 'none',
      summarizeStateList(actor),
    ]);

  const shipRows = report.levelOneShipScope.map((row) => [
    row.enemyId,
    row.title,
    row.role,
    row.actorKey,
    row.source,
    row.coverageStatus,
    row.missingStates.join(', ') || 'none',
    row.partialStates.join(', ') || 'none',
  ]);

  return `# Hard Money Heroes Roster Coverage\n\nGenerated by \`${report.generatedBy}\`. This is the Wave 3 Slice 1 scoreboard for canonical sprite coverage.\n\n## Summary\n\n- Canonical roster manifest: \`${report.canonicalManifest}\`\n- Actors in manifest: ${report.summary.actorCount}\n- Complete actors against the current role matrix: ${report.summary.completeActorCount}\n- Partial actors: ${report.summary.partialActorCount}\n- Zero-animation actors: ${report.summary.zeroAnimationActorCount}\n- Level 1 runtime-spawnable enemy rows: ${report.summary.levelOneShipEnemyCount}\n\n## Runtime-derived readability policy\n\nRows marked \`derived:<state><-<source>\` reuse existing native animation frames at runtime for short readability beats such as spawn-in and missing telegraphs. This is not counted as new native art and adds no placeholder PNGs; it only prevents visible snap-to-idle gaps while future bespoke frames are produced.\n\n## Canonical actor matrix\n\n${table(['Actor', 'Role', 'Status', 'Manifest states', 'Missing states', 'Partial direction states', 'Required-state coverage'], actorRows)}\n\n## Level 1 ship-scope actor ruling\n\nThe rows below are derived from \`LESTER_BLASTER_ENEMY_CATALOG\` plus \`HMH_LEVEL_ONE_BOSS_PROXY_ROSTER\`; they are not inferred from folder names.\n\n${table(['Enemy ID', 'Title', 'Role', 'Actor key', 'Source', 'Coverage', 'Missing states', 'Partial states'], shipRows)}\n\n### Scope decision needed before Slice 5 generation\n\n- Recommended keeps from the Wave 3 handoff: ${report.scopeRuling.recommendedKeep.join(', ')}\n- Zero-animation actors currently proven in Level 1 runtime scope: ${report.scopeRuling.zeroTierInRuntimeScope.join(', ') || 'none'}\n- Handoff keep candidates not currently found in the Level 1 spawn catalog/proxy rows: ${report.scopeRuling.handoffKeepNotInCurrentCatalog.join(', ') || 'none'}\n- Deferred candidates not currently proven in the Level 1 runtime spawn list: ${report.scopeRuling.deferred.join(', ') || 'none'}\n- Note: ${report.scopeRuling.note}\n\n## Lester fragmentation audit\n\n- Splinter/raw-fragment dirs under \`hmh-animated-roster/lester/\`: ${report.fragmentation.lester.splinterDirs.join(', ') || 'none'}\n- Manifest references to those splinter dirs: ${report.fragmentation.lester.manifestReferencesSplinterDirs.join(', ') || 'none'}\n- Recommendation: ${report.fragmentation.lester.recommendation}\n\n## Slice 1 resolution\n\n1. Lester splinter/raw-fragment dirs are vaulted and removed from the repo; the manifest references none of them.\n2. Lester's playable visual-kit metadata now points at the canonical animated-roster manifest instead of the separate \`lester-production\` manifest.\n3. Legacy stills remain as a deprecated compatibility layer until atlas/runtime replacement is proven.\n\n## Next actions\n\n1. Justin scope ruling before Slice 5 generation: approve the keep/defer list above, especially \`liquidation-cascade-golem\`, which the current runtime catalog still spawns in Level 1.\n2. Build Slice 2 automated Sprite QA and wire \`assets:qa\` into the art gate.\n3. Regenerate this scoreboard after every sprite batch.\n`;
}

export function writeRosterCoverageReport({ repoRoot = repoRootFromHere() } = {}) {
  const report = buildRosterCoverageReport({ repoRoot });
  const md = renderRosterCoverageMarkdown(report);
  const outPath = path.join(repoRoot, 'docs/art/ROSTER_COVERAGE.md');
  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, md, 'utf8');
  return Object.freeze({ report, outPath });
}

const isMain = process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  const { report, outPath } = writeRosterCoverageReport();
  console.log(`Roster coverage report written: ${outPath}`);
  console.log(`Actors: ${report.summary.actorCount}; L1 ship rows: ${report.summary.levelOneShipEnemyCount}; zero-animation actors: ${report.summary.zeroAnimationActorCount}`);
}
