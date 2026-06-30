export const HMH_LEVEL_EDITOR_SCHEMA_VERSION = 1;

export const HMH_LEVEL_EDITOR_DEFAULTS = Object.freeze({
  access: 'local-dev-only',
  replacesProceduralLevels: true,
  minimapPhase: 'later-after-levels-are-built',
  timeline: Object.freeze({
    bossSpawnSeconds: 360,
    extractionAppearsSeconds: 480,
    extractionAlsoAppearsAfterBossDefeat: true,
  }),
  extractionSequence: Object.freeze({
    type: 'helicopter-cinematic',
    steps: Object.freeze([
      'fly-to-near-player',
      'land',
      'player-enters',
      'take-off',
      'fly-away-out-of-view',
      'level-complete-screen',
      'load-next-level-ready-screen',
    ]),
    locksPlayerControl: true,
  }),
});

export const HMH_LEVEL_EDITOR_LAYERS = Object.freeze([
  Object.freeze({ id: 'ground', label: 'Ground Tiles', visible: true, locked: false }),
  Object.freeze({ id: 'roads-paths', label: 'Roads / Paths', visible: true, locked: false }),
  Object.freeze({ id: 'water', label: 'Water / Shoreline', visible: true, locked: false }),
  Object.freeze({ id: 'props', label: 'Level Assets / Props', visible: true, locked: false }),
  Object.freeze({ id: 'barriers', label: 'Barriers / Collision', visible: true, locked: false }),
  Object.freeze({ id: 'enemies', label: 'Enemies / Bosses', visible: true, locked: false }),
  Object.freeze({ id: 'objectives', label: 'Objectives / Extraction', visible: true, locked: false }),
  Object.freeze({ id: 'notes', label: 'Design Notes', visible: true, locked: false }),
]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function cleanNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeId(value, fallback = 'draft') {
  return String(value || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || fallback;
}

const PLAYER_SPAWN_TYPES = new Set(['player-start', 'player-spawn', 'player-spawn-candidate']);

function isPlayerSpawnMarker(marker = {}) {
  return PLAYER_SPAWN_TYPES.has(marker.type);
}

function isPrimaryPlayerSpawn(marker = {}) {
  return marker.type === 'player-start' || marker.type === 'player-spawn' || marker.primary === true;
}

function playerSpawnMarkers(draft = {}) {
  return (draft.markers ?? [])
    .filter(isPlayerSpawnMarker)
    .map((marker) => Object.freeze({
      id: marker.id,
      type: marker.type,
      label: marker.label,
      x: marker.x,
      y: marker.y,
      primary: isPrimaryPlayerSpawn(marker),
      notes: marker.notes ?? '',
    }));
}

export function hmhLevelDraftFileName(input = {}, kind = 'level') {
  const draft = normalizeHmhLevelDraft(input);
  const slug = normalizeId(draft.slug || draft.title || draft.levelId, 'authored-draft');
  const suffix = kind === 'handoff' ? 'hermes-handoff' : 'hmh-level';
  return `${normalizeId(draft.levelId, 'hmh-level')}-${slug}.${suffix}.json`;
}

export function hmhLevelDraftRepoPath(input = {}, kind = 'level') {
  return `apps/portal/assets/levels/${hmhLevelDraftFileName(input, kind)}`;
}

export function createBlankHmhLevelDraft({
  levelId = 'level-1-crypto-wasteland',
  title = 'HMH Authored Level Draft',
  width = 160,
  height = 96,
} = {}) {
  return Object.freeze({
    schemaVersion: HMH_LEVEL_EDITOR_SCHEMA_VERSION,
    editor: Object.freeze({
      id: 'hard-money-heroes-level-builder',
      access: HMH_LEVEL_EDITOR_DEFAULTS.access,
      savedAt: null,
    }),
    levelId,
    title,
    slug: normalizeId(title),
    replacesProceduralLevel: true,
    grid: Object.freeze({
      type: 'isometric-2to1',
      tileWidth: 64,
      tileHeight: 32,
      width: cleanNumber(width, 160),
      height: cleanNumber(height, 96),
      snap: 'tile',
    }),
    camera: Object.freeze({ x: 0, y: 0, zoom: 1 }),
    layers: HMH_LEVEL_EDITOR_LAYERS.map((layer) => Object.freeze({ ...layer })),
    placements: Object.freeze([]),
    markers: Object.freeze([]),
    notes: Object.freeze([]),
    objectives: Object.freeze({
      boss: Object.freeze({
        enabled: true,
        spawnAtSeconds: HMH_LEVEL_EDITOR_DEFAULTS.timeline.bossSpawnSeconds,
        proceduralFallback: true,
      }),
      extraction: Object.freeze({
        enabled: true,
        appearsAtSeconds: HMH_LEVEL_EDITOR_DEFAULTS.timeline.extractionAppearsSeconds,
        alsoAppearsAfterBossDefeat: HMH_LEVEL_EDITOR_DEFAULTS.timeline.extractionAlsoAppearsAfterBossDefeat,
        sequence: clone(HMH_LEVEL_EDITOR_DEFAULTS.extractionSequence),
      }),
      minimap: Object.freeze({ enabled: false, phase: HMH_LEVEL_EDITOR_DEFAULTS.minimapPhase }),
    }),
  });
}

function normalizePlacement(item = {}, index = 0) {
  const layer = String(item.layer || item.groupId || 'props');
  const id = item.id || `placement-${index + 1}`;
  return {
    id,
    layer,
    groupId: item.groupId ?? null,
    assetKey: item.assetKey ?? null,
    src: item.src ?? null,
    label: item.label ?? item.assetKey ?? id,
    x: cleanNumber(item.x),
    y: cleanNumber(item.y),
    z: cleanNumber(item.z),
    width: item.width == null ? null : cleanNumber(item.width, 1),
    height: item.height == null ? null : cleanNumber(item.height, 1),
    imageWidth: item.imageWidth ?? item.width ?? null,
    imageHeight: item.imageHeight ?? item.height ?? null,
    frameWidth: item.frameWidth ?? item.width ?? null,
    frameHeight: item.frameHeight ?? item.height ?? null,
    frames: item.frames ?? null,
    animated: Boolean(item.animated),
    rotation: cleanNumber(item.rotation),
    scale: item.scale == null ? 1 : cleanNumber(item.scale, 1),
    flipX: Boolean(item.flipX),
    flipY: Boolean(item.flipY),
    solid: Boolean(item.solid),
    shape: item.shape ?? null,
    notes: item.notes ?? '',
  };
}

function normalizeMarker(item = {}, index = 0) {
  const type = String(item.type || 'note');
  return {
    id: item.id || `${type}-${index + 1}`,
    type,
    label: item.label ?? type,
    enemyId: item.enemyId ?? null,
    x: cleanNumber(item.x),
    y: cleanNumber(item.y),
    radius: item.radius == null ? null : cleanNumber(item.radius, 1),
    primary: item.primary == null ? (type === 'player-start' || type === 'player-spawn') : Boolean(item.primary),
    spawnAtSeconds: item.spawnAtSeconds == null ? null : cleanNumber(item.spawnAtSeconds),
    appearsAtSeconds: item.appearsAtSeconds == null ? null : cleanNumber(item.appearsAtSeconds),
    notes: item.notes ?? '',
  };
}

export function normalizeHmhLevelDraft(input = {}) {
  const base = createBlankHmhLevelDraft({
    levelId: input.levelId,
    title: input.title,
    width: input.grid?.width,
    height: input.grid?.height,
  });
  const placements = Array.isArray(input.placements) ? input.placements.map(normalizePlacement) : [];
  const markers = Array.isArray(input.markers) ? input.markers.map(normalizeMarker) : [];
  return {
    ...clone(base),
    ...input,
    schemaVersion: HMH_LEVEL_EDITOR_SCHEMA_VERSION,
    slug: normalizeId(input.slug ?? input.title ?? base.title),
    grid: { ...clone(base.grid), ...(input.grid ?? {}) },
    layers: Array.isArray(input.layers) && input.layers.length ? input.layers : clone(base.layers),
    placements,
    markers,
    notes: Array.isArray(input.notes) ? input.notes : [],
    objectives: {
      ...clone(base.objectives),
      ...(input.objectives ?? {}),
      boss: { ...clone(base.objectives.boss), ...(input.objectives?.boss ?? {}) },
      extraction: { ...clone(base.objectives.extraction), ...(input.objectives?.extraction ?? {}) },
    },
  };
}

export function validateHmhLevelDraft(input = {}) {
  const draft = normalizeHmhLevelDraft(input);
  const errors = [];
  const warnings = [];
  const hasMarker = (type) => draft.markers.some((marker) => marker.type === type);
  const spawnMarkers = playerSpawnMarkers(draft);
  if (draft.schemaVersion !== HMH_LEVEL_EDITOR_SCHEMA_VERSION) errors.push('schema-version-mismatch');
  if (!draft.levelId) errors.push('missing-level-id');
  if (!draft.grid || draft.grid.type !== 'isometric-2to1') errors.push('missing-isometric-grid');
  if (!spawnMarkers.length) errors.push('missing-player-start');
  else if (!spawnMarkers.some((marker) => marker.primary)) errors.push('missing-primary-player-spawn');
  if (!hasMarker('boss')) errors.push('missing-boss-marker');
  if (!hasMarker('extraction-helicopter')) errors.push('missing-extraction-marker');
  if (!draft.placements.some((item) => item.layer === 'barriers' || item.solid)) warnings.push('no-barriers-authored');
  if (!draft.placements.some((item) => item.layer === 'ground' || item.groupId === 'ground-tiles')) warnings.push('no-ground-tiles-authored');
  if (!draft.markers.some((marker) => marker.type === 'enemy-spawn')) warnings.push('no-manual-enemy-spawns-authored-procedural-only');
  return Object.freeze({
    valid: errors.length === 0,
    errors: Object.freeze(errors),
    warnings: Object.freeze(warnings),
    counts: Object.freeze({
      placements: draft.placements.length,
      markers: draft.markers.length,
      barriers: draft.placements.filter((item) => item.layer === 'barriers' || item.solid).length,
    }),
  });
}

export function createHermesHandoffReport(input = {}) {
  const draft = normalizeHmhLevelDraft(input);
  const validation = validateHmhLevelDraft(draft);
  const groups = {};
  for (const placement of draft.placements) {
    const key = placement.groupId || placement.layer || 'unknown';
    groups[key] = (groups[key] || 0) + 1;
  }
  const markerTypes = {};
  for (const marker of draft.markers) markerTypes[marker.type] = (markerTypes[marker.type] || 0) + 1;
  const spawns = playerSpawnMarkers(draft);
  const primarySpawn = spawns.find((spawn) => spawn.primary) ?? null;
  return Object.freeze({
    schemaVersion: HMH_LEVEL_EDITOR_SCHEMA_VERSION,
    generatedBy: 'hard-money-heroes-level-builder',
    levelId: draft.levelId,
    title: draft.title,
    validation,
    assetUsage: Object.freeze({
      totalPlacements: draft.placements.length,
      groups: Object.freeze(groups),
      uniqueAssets: Object.freeze([...new Set(draft.placements.map((item) => item.assetKey).filter(Boolean))]),
    }),
    blockers: Object.freeze({
      solidBarrierCount: draft.placements.filter((item) => item.layer === 'barriers' || item.solid).length,
      missingCollisionWarnings: validation.warnings.filter((warning) => warning.includes('barrier')),
    }),
    objectives: Object.freeze({
      hasPlayerStart: Boolean(primarySpawn),
      primaryPlayerSpawn: primarySpawn,
      playerSpawns: Object.freeze(spawns),
      hasBoss: draft.markers.some((marker) => marker.type === 'boss'),
      hasExtraction: draft.markers.some((marker) => marker.type === 'extraction-helicopter'),
      bossSpawnSeconds: draft.objectives.boss.spawnAtSeconds,
      extractionAppearsSeconds: draft.objectives.extraction.appearsAtSeconds,
      extractionSequence: draft.objectives.extraction.sequence,
    }),
    markerTypes: Object.freeze(markerTypes),
    nextPolishChecklist: Object.freeze([
      'scan route continuity and dead ends',
      'add or repair collision barriers',
      'validate boss spawn timing at 6:00',
      'validate helicopter extraction appears at 8:00 or after boss defeat',
      'wire authored map into runtime importer when ready',
    ]),
  });
}

export function createHmhLevelExportBundle(input = {}) {
  const draft = normalizeHmhLevelDraft(input);
  const hermesHandoff = createHermesHandoffReport(draft);
  const fileName = hmhLevelDraftFileName(draft);
  return Object.freeze({
    fileName,
    handoffFileName: hmhLevelDraftFileName(draft, 'handoff'),
    suggestedRepoPath: hmhLevelDraftRepoPath(draft),
    payload: Object.freeze({
      ...draft,
      exportedAt: new Date().toISOString(),
      hermesHandoff,
    }),
  });
}
