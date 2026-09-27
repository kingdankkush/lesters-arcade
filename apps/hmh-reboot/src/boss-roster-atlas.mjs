/**
 * Dark district-boss atlases (art wave 2b): the Lockkeeper and the 51% Foreman.
 *
 * Each entry is keyed by its v7 boss role id (the `bosses` catalogue of
 * sdk/hmh-run-summary-schema-v7.mjs), so the boss simulation binds art by role
 * id and never by a file name. The atlases carry a boss clip set that the
 * six-state roster contract cannot: a full phase-1 kit (idle, walk, a tell
 * and a strike per attack kind, hit, halt, staggers), reduced re-baked subsets
 * for phases 2 and 3 that fall back to earlier phases, and south-only intro,
 * transition and death clips, across as many 2048 px pages as the boss needs,
 * with a `@0.5x` half-resolution page per page for the phone tier.
 *
 * DARK: the shipped runtime does not import this module, and
 * `bossRosterArtEnabled` answers false unless an evidence-safe (Free) run
 * explicitly asks for `?bossArtPilot=1`; a Ranked run can never enable it.
 * Projection-only: frame selection and page URLs. Collision, damage, AI,
 * spawning, RNG, progression and results never read atlas metadata.
 */
import { directionNameForRosterIndex } from './enemy-roster-atlas.mjs';

export const BOSS_ROSTER_PIPELINE_ID = 'hmh-reboot-boss-roster-v1';
export const BOSS_ROSTER_FLAG = 'bossArtPilot';
export const BOSS_ROSTER_DIRECTIONS = Object.freeze([
  'south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west',
]);
// Role ids present in the v7 bosses catalogue that have dark art. The
// Liquidator keeps the shipped roster atlas; the Rug Pull Baron is wave 1's.
export const BOSS_ROSTER_ROLES = Object.freeze(['lockkeeper', 'fifty-one-percent-foreman']);
const ROOT = '../assets/generated/hmh-boss-roster';
// Budgets. Pages share the native roster page cap
// (scripts/hmh-reboot-production-asset-qa.mjs maxNativeRosterAtlasBytes).
// Only one boss is resident at a time (LEVEL-1-DESIGN-PACKAGE 4.1), so a boss
// is budgeted on its own rather than inside the 16 MiB resident roster total;
// phones load the @0.5x tier, a quarter of the decoded bytes.
export const BOSS_ROSTER_MAX_PAGE_BYTES = 4 * 1024 * 1024;
export const BOSS_ROSTER_MAX_BYTES_PER_BOSS = 16 * 1024 * 1024;
export const BOSS_ROSTER_MAX_DECODED_BYTES = 4 * 2048 * 2048 * 4;
export const BOSS_ROSTER_MAX_HALF_RES_DECODED_BYTES = 4 * 1024 * 1024 * 4;
const TICKS_PER_SECOND = 60;

/**
 * The only switch. Off by default; only an evidence-safe (Free) run with the
 * explicit query flag turns it on, and Ranked always answers false.
 */
export function bossRosterArtEnabled({ evidenceSafe = false, ranked = false, params = null } = {}) {
  if (ranked || evidenceSafe !== true) return false;
  const value = typeof params?.get === 'function' ? params.get(BOSS_ROSTER_FLAG) : null;
  return value === '1';
}

export function bossRosterAsset(roleId) {
  if (!BOSS_ROSTER_ROLES.includes(roleId)) throw new TypeError(`no dark boss art for role: ${String(roleId)}`);
  return Object.freeze({
    roleId,
    metadataUrl: `${ROOT}/${roleId}/${roleId}-boss-roster.json`,
  });
}

/** Page URLs for a validated index; phones take the `@0.5x` tier. */
export function bossRosterPageUrls(index, { mobile = false } = {}) {
  const base = `${ROOT}/${index.roleId}/`;
  return index.pages.map((page) => base + (mobile ? page.halfRes.image : page.image).replace(/^\.\//, ''));
}

function assertInteger(value, label) {
  if (!Number.isInteger(value) || value < 0) throw new TypeError(`${label} must be a non-negative integer`);
}

export function createBossRosterAtlasIndex(metadata, expectedRoleId) {
  if (!metadata || typeof metadata !== 'object') throw new TypeError('boss roster metadata is required');
  if (metadata.pipelineId !== BOSS_ROSTER_PIPELINE_ID) throw new TypeError(`unexpected boss pipeline: ${String(metadata.pipelineId)}`);
  if (metadata.runtimeAuthority !== 'projection-only') throw new TypeError('boss art must remain projection-only');
  if (!BOSS_ROSTER_ROLES.includes(metadata.roleId)) throw new TypeError(`unknown boss role: ${String(metadata.roleId)}`);
  if (expectedRoleId && metadata.roleId !== expectedRoleId) {
    throw new TypeError(`boss role mismatch: expected ${expectedRoleId}, received ${metadata.roleId}`);
  }
  if (!['human', 'zombie'].includes(metadata.identityForm)) throw new TypeError('boss must read as a human or a zombie');
  if (!Array.isArray(metadata.pages) || metadata.pages.length === 0) throw new TypeError('boss roster has no pages');
  for (const page of metadata.pages) {
    if (!page?.image || !page?.halfRes?.image) throw new TypeError('boss page needs a full and a half-resolution image');
  }
  if (!Number.isFinite(metadata.runtimeScale) || metadata.runtimeScale <= 0) throw new TypeError('boss runtimeScale is invalid');
  const phases = metadata.phases;
  if (!Array.isArray(phases) || phases.length === 0) throw new TypeError('boss roster has no phases');
  const byKey = new Map();
  for (const frame of metadata.frames ?? []) {
    assertInteger(frame.page, 'frame page');
    if (frame.page >= metadata.pages.length) throw new TypeError(`frame ${frame.id} names a missing page`);
    const page = metadata.pages[frame.page];
    if (frame.frame.x + frame.frame.w > page.width || frame.frame.y + frame.frame.h > page.height) {
      throw new TypeError(`frame ${frame.id} falls outside its page`);
    }
    const key = `${frame.phase}|${frame.clip}|${frame.direction}|${frame.frameIndex}`;
    if (byKey.has(key)) throw new TypeError(`duplicate boss frame ${key}`);
    byKey.set(key, frame);
  }
  // Every clip a phase declares must be complete for each of its directions.
  for (const phase of phases) {
    for (const clipId of metadata.phaseClips?.[phase] ?? []) {
      const clip = metadata.clips?.[clipId];
      if (!clip) throw new TypeError(`phase ${phase} names unknown clip ${clipId}`);
      for (const direction of clip.directions) {
        for (let frameIndex = 0; frameIndex < clip.frames; frameIndex += 1) {
          if (!byKey.has(`${phase}|${clipId}|${direction}|${frameIndex}`)) {
            throw new TypeError(`boss ${metadata.roleId} is missing ${phase}/${clipId}/${direction}/${frameIndex}`);
          }
        }
      }
    }
  }
  // The first phase carries the full kit, so every clip resolves somewhere.
  for (const clipId of Object.keys(metadata.clips ?? {})) {
    if (!phases.some((phase) => metadata.phaseClips[phase].includes(clipId))) {
      throw new TypeError(`clip ${clipId} is rendered in no phase`);
    }
  }

  // A clip missing from a later phase falls back to the nearest earlier phase
  // that rendered it, then to the nearest later one (cinematics authored in
  // the phase whose dressing they show).
  function resolvePhase(clipId, phase) {
    const at = Math.max(0, phases.indexOf(phase));
    for (let i = at; i >= 0; i -= 1) if (metadata.phaseClips[phases[i]].includes(clipId)) return phases[i];
    for (let i = at + 1; i < phases.length; i += 1) if (metadata.phaseClips[phases[i]].includes(clipId)) return phases[i];
    return undefined;
  }

  return Object.freeze({
    roleId: metadata.roleId,
    actorId: metadata.actorId,
    identityForm: metadata.identityForm,
    runtimeScale: metadata.runtimeScale,
    phases: Object.freeze([...phases]),
    clipIds: Object.freeze(Object.keys(metadata.clips)),
    pages: Object.freeze(metadata.pages.map((page) => Object.freeze({ ...page, halfRes: Object.freeze({ ...page.halfRes }) }))),
    frameCount: byKey.size,
    hasClip(clipId) {
      return Object.hasOwn(metadata.clips, clipId);
    },
    clipFor(clipId, phase = phases[0]) {
      const clip = metadata.clips[clipId];
      if (!clip) return undefined;
      return Object.freeze({ clipId, phase: resolvePhase(clipId, phase), frames: clip.frames, fps: clip.fps, loop: clip.loop,
        kind: clip.kind, attackKind: clip.attackKind, directions: Object.freeze([...clip.directions]) });
    },
    /** Tell and strike clip ids for an attack kind (for example 'windlass-sweep'). */
    clipsForAttack(attackKind) {
      const found = { tell: undefined, attack: undefined };
      for (const [clipId, clip] of Object.entries(metadata.clips)) {
        if (clip.attackKind === attackKind && (clip.kind === 'tell' || clip.kind === 'attack')) found[clip.kind] = clipId;
      }
      return Object.freeze(found);
    },
    frameFor(clipId, direction, frameIndex, phase = phases[0]) {
      const clip = metadata.clips[clipId];
      if (!clip) return undefined;
      const resolved = resolvePhase(clipId, phase);
      const facing = clip.directions.includes(direction) ? direction : clip.directions[0];
      const index = clip.loop
        ? ((Math.trunc(frameIndex) % clip.frames) + clip.frames) % clip.frames
        : Math.min(clip.frames - 1, Math.max(0, Math.trunc(frameIndex)));
      return byKey.get(`${resolved}|${clipId}|${facing}|${index}`);
    },
  });
}

/**
 * Pure frame choice for a boss view: clip, simulation heading index (0 = +x,
 * clockwise), boss phase and either the ticks since the clip started or, for
 * tells and strikes driven by the simulation's own windows, `progress` in
 * [0, 1] (LEVEL-1-DESIGN-PACKAGE 7.12: frame = floor(progress x N), so poses
 * are baked and timing is not). Loops wrap; one-shot clips hold their last
 * frame.
 */
export function resolveBossRosterPose(index, { clip, direction = 2, phase, elapsedTicks = 0, progress }) {
  const definition = index.clipFor(clip, phase ?? index.phases[0]);
  if (!definition) throw new TypeError(`unknown boss clip: ${String(clip)}`);
  const compass = directionNameForRosterIndex(direction);
  const frameIndex = Number.isFinite(progress)
    ? Math.min(definition.frames - 1, Math.floor(Math.max(0, progress) * definition.frames))
    : Math.floor((Math.max(0, elapsedTicks) * definition.fps) / TICKS_PER_SECOND);
  return index.frameFor(clip, compass, frameIndex, phase ?? index.phases[0]);
}
