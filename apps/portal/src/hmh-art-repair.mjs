import { HMH_ANIMATED_ROSTER } from '../assets/generated/hmh-animated-roster/hmh-animated-roster.mjs';

export const HMH_ART_AUTO_REPAIR_MAP = Object.freeze({
  'crypto-bro-rusher': Object.freeze({ to: 'fud-goblin', action: 'auto-repair', reason: 'Level 1 runtime-spawnable humanoid rusher currently has zero frames; fud-goblin keeps readable melee/run/hit/death states.' }),
  'evil-banker-ranged': Object.freeze({ to: 'gas-fee-wisp', action: 'auto-repair', reason: 'Level 1 ranged banker proxy currently has zero frames; gas-fee-wisp provides idle/walk/run/attack/readable ranged pressure frames.' }),
  'gas-beast-tank': Object.freeze({ to: 'wild-boar', action: 'auto-repair', reason: 'Warehouse tank proxy currently has zero frames; wild-boar gives a large readable charger silhouette until bespoke tank art lands.' }),
  'liquidation-cascade-golem': Object.freeze({ to: 'wild-boar', action: 'auto-repair', reason: 'Level 1 late armored elite is spawnable but has zero frames; wild-boar keeps slow heavy collision readable instead of invisible.' }),
  'warren-spear-rider': Object.freeze({ to: 'coyote-pack-runner', action: 'auto-repair', reason: 'Handoff keep candidate has zero frames; coyote-pack-runner preserves fast pressure readability.' }),
  'chain-reaper-boss': Object.freeze({ to: 'whale-dumper-boss', action: 'defer-or-purge', reason: 'Not proven in current Level 1 runtime scope; keep out of live selection unless a future boss beat explicitly needs it.' }),
  'bit-whale-boss': Object.freeze({ to: 'whale-dumper-boss', action: 'defer-or-purge', reason: 'Not proven in current Level 1 runtime scope; existing whale-dumper-boss is the renderable boss fallback.' }),
  'rugpull-summoner': Object.freeze({ to: 'scam-cult-zealot', action: 'defer-or-purge', reason: 'Not proven in current Level 1 runtime scope; defer until a summoner encounter is authored.' }),
});

export function actorHasRenderableAnimations(actor = null) {
  return Object.values(actor?.animations ?? {}).some((dirMap) => (
    Object.values(dirMap ?? {}).some((frames) => Array.isArray(frames) && frames.length > 0)
  ));
}

export function repairRuntimeActorKey(candidateKey, roster = {}) {
  const key = String(candidateKey ?? '');
  if (!key) return Object.freeze({ key, originalKey: key, repaired: false, action: 'missing-key', reason: 'No actor key supplied.' });
  const actor = roster[key];
  if (actorHasRenderableAnimations(actor)) {
    return Object.freeze({ key, originalKey: key, repaired: false, action: 'keep', reason: 'Actor has renderable animations.' });
  }
  const repair = HMH_ART_AUTO_REPAIR_MAP[key];
  if (repair && actorHasRenderableAnimations(roster[repair.to])) {
    return Object.freeze({
      key: repair.to,
      originalKey: key,
      repaired: true,
      action: repair.action,
      reason: repair.reason,
    });
  }
  return Object.freeze({
    key,
    originalKey: key,
    repaired: false,
    action: actor ? 'zero-unrepaired' : 'missing-actor',
    reason: actor ? 'Actor has no renderable frames and no valid repair target.' : 'Actor key is not present in the roster.',
  });
}

export function repairRuntimeVisualKitSpec(spec = {}, roster = {}) {
  const repaired = repairRuntimeActorKey(spec.rosterKey, roster);
  return Object.freeze({
    ...spec,
    rosterKey: repaired.key || spec.rosterKey,
    autoRepair: repaired.repaired
      ? Object.freeze({ from: repaired.originalKey, to: repaired.key, action: repaired.action, reason: repaired.reason })
      : null,
  });
}

export function buildArtPurgeRepairPlan({ roster = HMH_ANIMATED_ROSTER, zeroAnimationActors = Object.keys(HMH_ART_AUTO_REPAIR_MAP) } = {}) {
  const repairs = Object.freeze(zeroAnimationActors.map((from) => {
    const repair = HMH_ART_AUTO_REPAIR_MAP[from] ?? null;
    const resolved = repairRuntimeActorKey(from, roster);
    return Object.freeze({
      from,
      to: repair?.to ?? null,
      resolvedKey: resolved.key,
      action: resolved.action === 'keep' ? resolved.action : (repair?.action ?? resolved.action),
      repaired: resolved.repaired,
      sourceRenderable: actorHasRenderableAnimations(roster[from]),
      targetRenderable: repair ? actorHasRenderableAnimations(roster[repair.to]) : false,
      reason: repair?.reason ?? resolved.reason,
    });
  }));
  const runtimeGuardrails = Object.freeze(repairs
    .filter((entry) => entry.action === 'auto-repair')
    .map((entry) => Object.freeze({ originalKey: entry.from, resolvedKey: entry.resolvedKey, reason: entry.reason })));
  return Object.freeze({
    version: 'wo-18-art-purge-repair-v1',
    generatedBy: 'apps/portal/src/hmh-art-repair.mjs',
    summary: Object.freeze({
      inspectedZeroAnimationActorCount: repairs.length,
      keptRenderableCount: repairs.filter((entry) => entry.action === 'keep' && entry.sourceRenderable).length,
      autoRepairCount: repairs.filter((entry) => entry.action === 'auto-repair' && entry.repaired).length,
      deferOrPurgeCount: repairs.filter((entry) => entry.action === 'defer-or-purge').length,
      unresolvedCount: repairs.filter((entry) => !entry.sourceRenderable && !entry.repaired && entry.action !== 'defer-or-purge').length,
    }),
    repairs,
    runtimeGuardrails,
    purgePolicy: Object.freeze([
      'Auto-repair only runtime-spawnable actor keys that would otherwise render invisible.',
      'Defer-or-purge zero-animation actors that are not proven in the current Level 1 runtime scope.',
      'Keep provenance on every repaired visual kit so future bespoke art can replace the fallback deliberately.',
    ]),
  });
}
