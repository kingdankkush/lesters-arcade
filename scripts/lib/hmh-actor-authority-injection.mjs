// Local diagnostic build transform, using the repository's declared Acorn
// dev dependency. It does not edit source or participate in release builds.
import { parse } from 'acorn';

const omissions = new Map();
const omit = (names, reason) => { for (const name of names.trim().split(/\s+/)) omissions.set(name, reason); };
omit(`startupGate lazyRuntimeModules lazyRuntimeModulesLoad startupPanel startupCopy startupContinue dataset navGridStartedAt
  stageElement statusElement sessionElement combatStatusElement dashStatusElement
  textureAssets claimTouchOnboarding adaptiveResolution runtimeParams bridge tourModule telemetryWriter
  enemyDisplayPoolModule staticWorldBakeModule enemyRenderPassModule createEnemyDisplayPool createCombatAudio buildEnduranceEncounterCandidates
  groundFallbackLoad nativeBarrierModule pickupBannerModule pickupBannerRequested pickupPresentationRequested
  goreRequested enemyHitFeedbackRequested silverRequested pickupPresentationRequested pressureArtRequested
  requestedProductionHeroActorId productionHeroLoadToken enemyRosterRequested enemyRosterFailed loadSelectedHeroRenderer
  terrainTileLoadError enemyRosterLoadError productionHeroLoadError authoredPropLoadError`, 'presentation startup, asset loading, telemetry or transport; authority is captured from live state');
omit(`app world backdrop worldDepthLayer worldProduction worldLife worldDecalLayer contactShadowPool groundShadowLayer
  weaponVfxPool weaponVfxLayer atmospherePool atmosphereLayer atmosphereBudget atmosphereTint authoredPropLayer heldWeaponLayer
  grid collisionDebug debugLabels shadow aimLine projectileTrails projectileImpacts grenadeVisuals combatVisuals pickupSignals
  overlayVisuals enemyVisuals enemyDeathVisuals enemyTelegraphs enemyMarkers enemyVisualFacing enemyDeathMarkers bossTelegraphs
  eliteGroundLayer bossVisual marker label bossLabel actorVisual productionHeroDisplay mannequinDisplay mannequinRuntimeScale
  prototypeDescriptor prototypeMinimumBodyHeight prototypePoseScale atlasActorEnabled goreGround goreAir gorePresentation
  enemyHitFeedback enemyHitFeedbackById worldBake authoredPropDisplay tripoPropAppearance worldDesignBlockerIds
  nativeBarrierPlacements authoredHeldWeaponDisplay terrainTiles enemyRosterIndexes enemyRosterTextures enemyDisplayPool
  enemyRenderPass debugOverlay combatAudio cockpit upgradePanel hud silverPresentation pickupBanner pickupPresentation
  pendingPickupAnnouncements weaponWheel weaponWheelLoading hudWeaponCard focusPoints focusPool focusWorld
  worldArtReport nativeBlockers worldDecals lastAccessibleCombatStatus combatVisualEvents grenadeFxEvents
  lastImpactSurface suppressedGroundImpacts shakeStartTick shakeMagnitude deathCamera bombletFeedback
  actor3dPilot actor3dDisposed actor3dHeroAction actor3dHeroTick`, 'presentation displays, effects, resource caches or UI only');
omit(`inputController touchController previousActor renderActor renderAlpha bossPreviousX bossPreviousY
  pointerReticleScreen bossHitVisualUntilTick bossDeathVisualUntilTick lastReloadComplete reloadPresentation
  lastLevelUpBeat lightningLedgerEventPlacement bearMarketBurnerEventPlacement forkedStandardEventPlacement
  authoredPropPlacements productionHeroSelection loadedProductionHeroId`, 'presentation interpolation/pose, asset selection or input event bindings; InputState and camera are captured');
omit('summaryV7 queryGround', 'immutable imported code/catalogues or ground-query callback; live summary catalogue and nav/ground data are captured');
omit('terrainAreaStreaming terrainPinnedPropTextures terrainStreamingBootController', 'presentation texture resource ownership and cancellation; no simulation/input/evidence data');

function names(pattern) {
  if (pattern.type === 'Identifier') return [pattern.name];
  if (pattern.type === 'ObjectPattern') return pattern.properties.flatMap(p => names(p.type === 'RestElement' ? p.argument : p.value));
  if (pattern.type === 'ArrayPattern') return pattern.elements.filter(Boolean).flatMap(names);
  if (pattern.type === 'AssignmentPattern') return names(pattern.left);
  if (pattern.type === 'RestElement') return names(pattern.argument);
  throw new TypeError('unsupported binding pattern');
}

export function inventoryAuthorityBindings(source) {
  const program = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
  const boots = program.body.filter(n => n.type === 'FunctionDeclaration' && n.id.name === 'boot');
  if (boots.length !== 1) throw new TypeError('exactly one boot function required');
  const boot = boots[0], importedLazy = new Set();
  const loader = program.body.find(n => n.type === 'FunctionDeclaration' && n.id.name === 'loadLazyRuntimeModules');
  const walk = node => { if (!node || typeof node !== 'object') return;
    if (node.type === 'AssignmentExpression' && node.left.type === 'ObjectPattern') for (const name of names(node.left)) importedLazy.add(name);
    for (const value of Object.values(node)) if (Array.isArray(value)) value.forEach(walk); else if (value && typeof value === 'object') walk(value);
  }; walk(loader);
  const captured = [], omitted = [];
  for (const scope of [program.body, boot.body.body]) for (const node of scope) if (node.type === 'VariableDeclaration') {
    for (const declaration of node.declarations) for (const name of names(declaration.id)) {
      const callback = ['ArrowFunctionExpression', 'FunctionExpression'].includes(declaration.init?.type);
      const reason = omissions.get(name) ?? (importedLazy.has(name) ? 'immutable lazy-imported code/catalogue binding' : callback ? 'callback code; surrounding mutable data remains captured' : null);
      if (reason) omitted.push({ name, reason }); else captured.push(name);
    }
  }
  if (new Set(captured).size !== captured.length) throw new TypeError('shadowed authority binding needs an explicit scope adapter');
  return { captured, omitted, bootEnd: boot.body.end - 1 };
}

export function injectAuthorityProbe(source) {
  if (source.includes('__actor3dAuthority')) throw new TypeError('authority probe already present');
  const inventory = inventoryAuthorityBindings(source);
  for (const name of ['simulation','input','enemyPopulation','runSummaryAccumulator']) {
    if (!inventory.captured.includes(name)) throw new TypeError(`required core authority ${name} absent`);
  }
  const data = `{${inventory.captured.join(',')}}`, required = JSON.stringify(inventory.captured);
  const probe = `
  globalThis.__actor3dAuthority = Object.freeze({
    inventory: Object.freeze(${JSON.stringify(inventory)}),
    read: () => __captureAuthority(${data}, ${required}),
    evidence: () => {
      const copied = structuredClone(runSummaryAccumulator);
      const snapshot = getRunProgressionSnapshot(runProgression);
      return JSON.stringify(finalizeRunSummary(copied, {
        endTick: simulation.tick, elapsedMs: simulation.timeMs, terminalReason: 'abandoned',
        score: snapshot.score, level: snapshot.level, xp: snapshot.xp,
        currentCombo: runCombo, maxCombo: maxRunCombo,
        revealedCells: revealSnapshot.revealedCellIds.length, totalCells: revealSnapshot.totalCells,
        v7: summaryV7.runSummaryV7Rows({ mission: missionState, bossSlots, progression: runProgression }),
      }));
    },
    presentation: () => Object.freeze({ status: actor3dPilot?.status ?? 'disabled',
      heroRenderable: actorVisual.renderable, weaponRenderable: heldWeaponLayer.renderable,
      enemyOriginals: Object.freeze([...enemyMarkers].map(([id,display]) => Object.freeze({ id,renderable:display.renderable,visible:display.visible }))),
      actorDisplays: world.children.filter(child => child.pilotId).length,
      depthActors: worldDepthLayer.renderLayerChildren?.filter(child => child.pilotId).length ?? 0,
      shaderCacheEntries: Object.keys(app.renderer.shader._programDataHash ?? {}).length,
    }),
  });
`;
  return { source: `import { captureAuthority as __captureAuthority } from '../../../scripts/lib/hmh-actor-authority-snapshot.mjs';\n${source.slice(0, inventory.bootEnd)}${probe}${source.slice(inventory.bootEnd)}`, inventory };
}
