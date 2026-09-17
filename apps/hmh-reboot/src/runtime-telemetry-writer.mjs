// Optional diagnostic projection. Loaded only by debug and release evidence views.
export function writeRuntimeTelemetry({
  LEVEL_ONE_WORLD,
  MAX_ACTIVE_PROJECTILES,
  MAX_COMBAT_VISUAL_EVENTS,
  MAX_WEAPON_VFX_SPRITES,
  WORLD_BOUNDS,
  activeEnemyCount,
  activeGrenadeWarningRadius,
  activeGrenadeWarningUrgent,
  activeGrenadeWarnings,
  activeProjectiles,
  actorVisual,
  aimIntent,
  aimState,
  animatedEnemyCount,
  atmosphereGrade,
  atmosphereReport,
  bearMarketBurnerEventPlacement,
  bossTelegraphPrimitiveCount,
  bossVisual,
  camera,
  collectibleSnapshot,
  collectibleState,
  combatAudio,
  combatVisualEvents,
  contactShadowPool,
  dashState,
  dashStatus,
  dataset,
  drawnGrenadeFxParticles,
  drawnKillFx,
  drawnKillFxShards,
  droppedProjectiles,
  encounterDirector,
  endurancePressurePilotEnabled,
  enemyDeathMarkers,
  enemyMarkers,
  enemyPopulation,
  enemyRosterIndexes,
  enemyRosterLoadError,
  enemyTellCount,
  forkedStandardEventPlacement,
  getActiveWeaponState,
  getLevelOneDistrictAt,
  getRunProgressionSnapshot,
  grayboxEnemies,
  grenadeFxEvents,
  grenadeSystem,
  lastBearMarketBurnerPulse,
  lastBossPunishWindow,
  lastBossRoleCheck,
  lastCollectibleEvent,
  lastCollision,
  lastDirectorStep,
  lastEnemyAttack,
  lastEnemyStep,
  lastEnemyStrike,
  lastForkedStandardStrike,
  lastGrenadeDetonation,
  lastGround,
  lastImpactSurface,
  lastInputWeaponSlot,
  lastLightningLedgerPulse,
  lastMeleeAttack,
  lastProjectileHit,
  lastProjectileResolution,
  lastTraversal,
  lastWeaponFire,
  lightningLedgerEventPlacement,
  liquidatorBoss,
  loadedProductionHeroId,
  mannequinDisplay,
  performanceProfile,
  playerHealth,
  powerupPresentation,
  productionHeroDisplay,
  productionHeroLoadError,
  projectEnemyScreenRects,
  renderState,
  revealSnapshot,
  rosterPreviewEnabled,
  runProgression,
  runtimeEncounterSnapshot,
  simulation,
  suppressedGroundImpacts,
  terrainTileLoadError,
  terrainTiles,
  timedEffectIdentity,
  weaponLoadout,
  weaponStatus,
  weaponVfxPool,
  world,
  worldArtReport,
  zeroDisplacementFrames
}) {
  dataset.actorX = renderState.x.toFixed(3);
  dataset.actorY = renderState.y.toFixed(3);
  dataset.targetX = grayboxEnemies[0]?.x.toFixed(3) ?? '';
  dataset.aimSource = aimIntent?.source ?? 'none';
  dataset.aimDirectionX = String(aimState?.stableDirection?.x ?? 0);
  dataset.aimDirectionY = String(aimState?.stableDirection?.y ?? 0);
  dataset.firing = String(aimIntent?.fire === true);
  dataset.collisionBlocker = lastCollision?.contacts.at(-1)?.blockerId ?? '';
  dataset.collisionStalls = String(zeroDisplacementFrames);
  dataset.surfaceId = lastGround?.surfaceId ?? '';
  dataset.groundZ = String(lastGround?.groundZ ?? 0);
  dataset.traversal = lastTraversal?.reason ?? '';
  dataset.projectileCount = String(activeProjectiles.length);
  dataset.projectileDrops = String(droppedProjectiles);
  dataset.projectileHit = lastProjectileHit?.targetId ?? '';
  dataset.lastImpactSurface = lastImpactSurface;
  dataset.weaponId = weaponLoadout?.activeWeaponId ?? '';
  dataset.weaponClipSize = String(weaponStatus?.clipSize ?? 0);
  dataset.weaponStatus = weaponStatus?.mode ?? 'unavailable';
  dataset.weaponReloadTicksRemaining = String(weaponStatus?.mode === 'reloading' ? weaponStatus.ticksRemaining : 0);
  dataset.actorArt = actorVisual.label ?? '';
  // Report what actually rendered, not what was requested: a failed
  // atlas load falls back to the prototype and must say so.
  dataset.actorArtSource = productionHeroDisplay ? productionHeroDisplay.artSource : mannequinDisplay ? 'blender-atlas-v1' : 'pixi-graybox';
  dataset.actorArtActor = productionHeroDisplay && loadedProductionHeroId ? loadedProductionHeroId : mannequinDisplay ? 'neutral-mannequin' : 'prototype-human';
  dataset.actorArtFallbackReason = productionHeroLoadError ?? '';
  dataset.heroMotionStatus = productionHeroDisplay?.container.motionStatus ?? 'pending';
  dataset.heroMotionAction = productionHeroDisplay?.container.motionAction ?? '';
  dataset.heroMotionError = productionHeroDisplay?.container.motionError ?? '';
  dataset.heldWeaponStatus = productionHeroDisplay?.container.heldWeaponStatus ?? '';
  dataset.heldWeaponFrameId = productionHeroDisplay?.container.heldWeaponFrameId ?? '';
  dataset.heldWeaponError = productionHeroDisplay?.container.heldWeaponError ?? '';
  dataset.actorArtLayers = productionHeroDisplay?.layerOrder.join(',') ?? mannequinDisplay?.layerOrder.join(',') ?? 'graybox';
  dataset.actorArtFrameIds = actorVisual.frameIds ?? '';
  // Projection-only evidence uses the actual rendered anchor, including shake.
  dataset.actorScreenX = String(actorVisual.x + world.position.x);
  dataset.actorScreenY = String(actorVisual.y + world.position.y);
  dataset.actorScreenScale = String(actorVisual.scale.x);
  // Report the art actually in use: the authored roster only applies to
  // archetypes whose atlas has resolved.
  dataset.enemyArt = enemyRosterIndexes.size > 0 ? 'production-roster-atlas-v1' : 'production-vector-enemies-v1';
  dataset.bossArt = enemyRosterIndexes.has('the-liquidator') ? 'production-roster-atlas-v1' : 'production-vector-liquidator-v1';
  dataset.enemyRosterLoaded = [...enemyRosterIndexes.keys()].sort().join(',');
  dataset.enemyRosterError = enemyRosterLoadError ?? '';
  dataset.rosterPreview = String(rosterPreviewEnabled);
  dataset.rosterPreviewAutoFire = String(aimState?.autoFireEnabled === true);
  dataset.terrainTiles = terrainTiles.ready ? 'authored-tiles-v1' : 'flat-colour-fallback';
  dataset.terrainTilesLoaded = terrainTiles.loadedIds.join(',');
  dataset.terrainTilesError = terrainTileLoadError ?? '';
  dataset.worldArt = 'production-vector-world-v1';
  dataset.worldShader = worldArtReport?.shaderIds.join(',') ?? '';
  dataset.worldParticles = String(worldArtReport?.particleCount ?? 0);
  dataset.worldRenderedParticles = String(worldArtReport?.renderedParticleCount ?? 0);
  dataset.worldBlockers = String(worldArtReport?.blockerCount ?? 0);
  dataset.worldLandmarks = String(worldArtReport?.landmarkCount ?? 0);
  dataset.performanceProfile = performanceProfile.id;
  dataset.renderResolution = String(performanceProfile.resolution);
  dataset.animatedEnemies = String(animatedEnemyCount);
  dataset.contactShadows = String(contactShadowPool?.count ?? 0);
  dataset.contactShadowsDropped = String(contactShadowPool?.dropped ?? 0);
  dataset.atmosphereSprites = String(atmosphereReport.fog + atmosphereReport.motes);
  dataset.atmosphereDropped = String(atmosphereReport.dropped);
  dataset.atmosphereTint = `${atmosphereGrade.color.toString(16).padStart(6, '0')}@${atmosphereGrade.alpha.toFixed(3)}`;
  const runSnapshot = runProgression ? getRunProgressionSnapshot(runProgression) : null;
  const audioSnapshot = combatAudio.status();
  dataset.runScore = String(runSnapshot?.score ?? 0);
  dataset.runXp = String(runSnapshot?.xp ?? 0);
  dataset.runLevel = String(runSnapshot?.level ?? 1);
  dataset.runPendingLevels = String(runSnapshot?.pendingLevels ?? 0);
  dataset.musicEnabled = String(audioSnapshot.musicEnabled);
  dataset.musicActive = String(audioSnapshot.musicActive);
  dataset.bossVisualState = bossVisual.visible ? bossVisual.visualState ?? 'idle' : 'hidden';
  dataset.inputWeaponSlot = String(lastInputWeaponSlot);
  dataset.simulationTick = String(simulation?.tick ?? 0);
  dataset.weaponAmmo = weaponLoadout ? String(getActiveWeaponState(weaponLoadout).ammoInClip) : '';
  dataset.weaponHeat = weaponLoadout ? String(getActiveWeaponState(weaponLoadout).heat) : '';
  dataset.weaponOverheated = String(weaponLoadout ? getActiveWeaponState(weaponLoadout).overheated : false);
  dataset.weaponChargeStartedTick = String(weaponLoadout ? getActiveWeaponState(weaponLoadout).chargeStartedTick ?? '' : '');
  dataset.weaponChargeReady = String(weaponLoadout ? getActiveWeaponState(weaponLoadout).chargeReadyAnnounced : false);
  dataset.lightningLedgerPulses = String(weaponLoadout?.weapons['lightning-ledger']?.channelState?.pulses ?? 0);
  dataset.lightningLedgerRamp = String(weaponLoadout?.weapons['lightning-ledger']?.channelState?.maxRampPermille ?? 1000);
  dataset.lightningLedgerCells = String(weaponLoadout?.weapons['lightning-ledger']?.channelState?.cellsRemaining ?? 0);
  dataset.lightningLedgerActive = String(weaponLoadout?.weapons['lightning-ledger']?.channelState?.active === true);
  dataset.lightningLedgerLastHits = String(lastLightningLedgerPulse?.hits ?? 0);
  dataset.lightningLedgerLastRamp = String(lastLightningLedgerPulse?.rampPermille ?? 1000);
  dataset.lightningLedgerEventId = String(lightningLedgerEventPlacement?.id ?? '');
  dataset.lightningLedgerEventTick = String(lightningLedgerEventPlacement?.availableTick ?? '');
  dataset.lightningLedgerEventCollected = String(Boolean(lightningLedgerEventPlacement && collectibleState?.collectedIds.has(lightningLedgerEventPlacement.id)));
  dataset.bearMarketBurnerEventId = String(bearMarketBurnerEventPlacement?.id ?? '');
  dataset.bearMarketBurnerEventTick = String(bearMarketBurnerEventPlacement?.availableTick ?? '');
  dataset.bearMarketBurnerEventCollected = String(Boolean(bearMarketBurnerEventPlacement && collectibleState?.collectedIds.has(bearMarketBurnerEventPlacement.id)));
  dataset.bearMarketBurnerFuel = String(weaponLoadout?.weapons['bear-market-burner']?.ammoInClip ?? 0);
  dataset.bearMarketBurnerPulses = String(weaponLoadout?.weapons['bear-market-burner']?.burnerState?.pulses ?? 0);
  dataset.bearMarketBurnerLastHits = String(lastBearMarketBurnerPulse?.hits ?? 0);
  dataset.bearMarketBurnerActiveBurns = String(weaponLoadout?.weapons['bear-market-burner']?.burnerState?.burns?.size ?? 0);
  dataset.bearMarketBurnerScorchZones = String(weaponLoadout?.weapons['bear-market-burner']?.burnerState?.scorchZones?.length ?? 0);
  dataset.bearMarketBurnerFlameVisuals = String(combatVisualEvents.filter((event) => event.type === 'bear-market-burner').length);
  dataset.forkedStandardEventId = String(forkedStandardEventPlacement?.id ?? '');
  dataset.forkedStandardEventTick = String(forkedStandardEventPlacement?.availableTick ?? '');
  dataset.forkedStandardEventCollected = String(Boolean(forkedStandardEventPlacement && collectibleState?.collectedIds.has(forkedStandardEventPlacement.id)));
  dataset.forkedStandardAttacks = String(weaponLoadout?.weapons['forked-standard']?.standardState?.attacks ?? 0);
  dataset.forkedStandardLastForm = String(lastForkedStandardStrike?.form ?? '');
  dataset.forkedStandardLastHits = String(lastForkedStandardStrike?.hits ?? 0);
  dataset.forkedStandardWhiffs = String(weaponLoadout?.weapons['forked-standard']?.standardState?.whiffs ?? 0);
  dataset.forkedStandardVisuals = String(combatVisualEvents.filter((event) => event.type === 'forked-standard').length);
  dataset.grenadeCount = String(grenadeSystem?.active.length ?? 0);
  dataset.activeGrenadeWarnings = String(activeGrenadeWarnings);
  dataset.activeGrenadeWarningRadius = String(activeGrenadeWarningRadius);
  dataset.activeGrenadeWarningUrgent = String(activeGrenadeWarningUrgent);
  dataset.handGrenades = String(grenadeSystem?.handCharges ?? 0);
  // grenade feedback (V-3): new keys only; the grenade keys above and
  // worldRenderedParticles stay byte-identical for the browser smokes.
  dataset.grenadeFxParticles = String(drawnGrenadeFxParticles);
  dataset.killFxDrawn = String(drawnKillFx);
  dataset.killFxShards = String(drawnKillFxShards);
  dataset.grenadeFxEvents = String(grenadeFxEvents.length);
  dataset.dashReadyTick = dashState ? String(dashState.cooldownReadyTick) : '';
  dataset.dashActive = String(dashStatus?.active === true);
  dataset.dashInvulnerable = String(dashStatus?.invulnerable === true);
  dataset.dashStopReason = dashStatus?.lastStopReason ?? '';
  dataset.playerHealth = String(playerHealth);
  dataset.collectibleCount = String(collectibleSnapshot?.collectedCount ?? 0);
  dataset.collectibleRemaining = String(collectibleSnapshot?.remainingCount ?? 9);
  dataset.collectibleLast = lastCollectibleEvent?.effectId ?? '';
  // The pickup's own award, so evidence can separate it from kill XP.
  dataset.collectibleLastXp = String(lastCollectibleEvent?.xpGain ?? 0);
  dataset.collectibleActive = collectibleSnapshot?.activeEffects.map((effect) => effect.effectId).join(',') ?? '';
  dataset.collectibleCountdown = powerupPresentation.hudLabel;
  dataset.collectibleRefreshCount = String(powerupPresentation.effects.reduce((total, effect) => total + effect.refreshCount, 0));
  dataset.timedEffectSilhouettes = timedEffectIdentity.effects.map((effect) => effect.silhouette).join(',');
  dataset.timedEffectAudioCues = timedEffectIdentity.effects.map((effect) => effect.audioCue).join(',');
  dataset.collectibleDamageMultiplier = String(collectibleSnapshot?.damageMultiplier ?? 1);
  dataset.collectibleSpeedMultiplier = String(collectibleSnapshot?.speedMultiplier ?? 1);
  dataset.audioVoices = String(combatAudio.status().activeVoices);
  dataset.audioUnknownCues = String(combatAudio.status().unknownCues);
  dataset.lastWeaponFire = lastWeaponFire?.weaponId ?? '';
  dataset.lastMeleeTick = lastMeleeAttack ? String(lastMeleeAttack.tick) : '';
  dataset.lastMeleeHits = String(lastMeleeAttack?.hits ?? 0);
  dataset.lastGrenadeReason = lastGrenadeDetonation?.reason ?? '';
  dataset.lastGrenadeTick = lastGrenadeDetonation ? String(lastGrenadeDetonation.tick) : '';
  dataset.projectileCover = lastProjectileResolution?.resolutions
    ?.find((resolution) => resolution.coverHit)?.coverHit?.blockerId ?? '';
  dataset.targetHealth = String(grayboxEnemies[0]?.health ?? 0);
  dataset.enemyCount = String(activeEnemyCount);
  dataset.enemyArchetypes = grayboxEnemies.map((enemy) => enemy.archetypeId).join(',');
  dataset.enemyScreenRects = JSON.stringify(projectEnemyScreenRects(grayboxEnemies));
  dataset.enemyTells = String(enemyTellCount);
  // Tell-to-strike measured from the authoritative event, alongside the
  // zoom it was read at, so the browser gate can prove the archetype's
  // tell length survives to gameplay zoom.
  dataset.enemyTellToStrikeTicks = String(lastEnemyStrike ? lastEnemyStrike.tick - lastEnemyStrike.tellStartedTick : '');
  dataset.enemyTellToStrikeArchetype = lastEnemyStrike?.archetypeId ?? '';
  dataset.cameraZoom = String(camera?.zoom ?? '');
  dataset.enemyDecisions = String(lastEnemyStep?.decisions ?? 0);
  dataset.enemyDecisionBudget = String(lastEnemyStep?.decisionBudget ?? 0);
  dataset.enemyDeferredDecisions = String(lastEnemyStep?.deferredDecisions ?? 0);
  dataset.enemySafetySteps = String(lastEnemyStep?.safetySteps ?? 0);
  dataset.enemyCollisionContacts = String(lastEnemyStep?.collisionContacts ?? 0);
  dataset.enemyTraversalBlocks = String(lastEnemyStep?.traversalBlocks ?? 0);
  dataset.enemyRouteReplans = String(lastEnemyStep?.routeReplans ?? 0);
  dataset.enemyStuckRecoveries = String(lastEnemyStep?.stuckRecoveries ?? 0);
  dataset.enemyHazardAvoiding = String(lastEnemyStep?.hazardAvoiding ?? 0);
  dataset.enemyChokepointSeeking = String(lastEnemyStep?.chokepointSeeking ?? 0);
  dataset.enemyChokepointHolding = String(lastEnemyStep?.chokepointHolding ?? 0);
  dataset.enemyFlankLaneSeeking = String(lastEnemyStep?.flankLaneSeeking ?? 0);
  dataset.enemyFormationAdjusted = String(lastEnemyStep?.formationAdjusted ?? 0);
  dataset.enemyPoolPressure = `${lastEnemyStep?.activeCount ?? 0}/${enemyPopulation?.capacity ?? 0}`;
  dataset.enemyThreatPressure = `${enemyPopulation?.activeThreat ?? 0}/${enemyPopulation?.threatCapacity ?? 0}`;
  dataset.projectilePoolPressure = `${activeProjectiles.length}/${MAX_ACTIVE_PROJECTILES}`;
  dataset.effectPoolPressure = `${combatVisualEvents.length}/${MAX_COMBAT_VISUAL_EVENTS}`;
  dataset.weaponVfxPoolPressure = `${weaponVfxPool?.placed ?? 0}/${MAX_WEAPON_VFX_SPRITES}`;
  dataset.weaponVfxDropped = String(weaponVfxPool?.dropped ?? 0);
  dataset.weaponVfxSuppressed = String(suppressedGroundImpacts);
  const tokenFamilies = Object.fromEntries(['melee', 'ranged', 'area', 'support'].map((family) => [
    family,
    lastEnemyAttack?.tokens.filter((token) => token.family === family).length ?? 0,
  ]));
  dataset.enemyAttackTokens = String(lastEnemyAttack?.tokens.length ?? 0);
  dataset.enemyAttackTokensMelee = String(tokenFamilies.melee);
  dataset.enemyAttackTokensRanged = String(tokenFamilies.ranged);
  dataset.enemyAttackTokensArea = String(tokenFamilies.area);
  dataset.enemyAttackTokensSupport = String(tokenFamilies.support);
  dataset.enemyAttackDrops = String(lastEnemyAttack?.droppedEvents ?? 0);
  dataset.enemyDeathVisuals = String(enemyDeathMarkers.size);
  dataset.enemyEliteVisuals = String([...enemyMarkers.values()].filter((enemyMarker) => enemyMarker.eliteProjection).length);
  const encounterSnapshot = runtimeEncounterSnapshot(simulation?.tick ?? 0);
  dataset.encounterBand = encounterSnapshot.bandId;
  dataset.endurancePressurePilot = String(endurancePressurePilotEnabled);
  dataset.directorInsertions = String(encounterDirector?.insertedCount ?? 0);
  dataset.directorRejections = String(encounterDirector?.rejectedCount ?? 0);
  dataset.directorLastReason = lastDirectorStep?.reason ?? '';
  dataset.directorBodyCap = String(encounterSnapshot.bodyCap);
  dataset.directorThreatCap = String(encounterSnapshot.threatCap);
  dataset.bossActive = String(liquidatorBoss?.active === true && (simulation?.tick ?? 0) >= liquidatorBoss.startTick);
  dataset.bossPhase = liquidatorBoss?.phaseId ?? '';
  dataset.bossHealth = String(liquidatorBoss?.health ?? 0);
  dataset.bossPendingTells = String(liquidatorBoss?.pendingAttacks.length ?? 0);
  dataset.bossPendingAttackIds = liquidatorBoss?.pendingAttacks.map((pending) => pending.attackId).join(',') ?? '';
  const pendingSafeSector = liquidatorBoss?.pendingAttacks.find((pending) => pending.geometry?.sectorId);
  dataset.bossSafeSector = pendingSafeSector?.geometry.sectorId ?? '';
  dataset.bossSafeZoneCount = String(pendingSafeSector?.geometry.zones.length ?? 0);
  dataset.bossTelegraphPrimitives = String(bossTelegraphPrimitiveCount);
  dataset.bossAttackDrops = String(liquidatorBoss?.droppedEvents ?? 0);
  dataset.bossLastRoleCheck = lastBossRoleCheck?.roleId ?? '';
  dataset.bossLastRoleCheckTick = String(lastBossRoleCheck?.tick ?? -1);
  dataset.bossPunishWindow = lastBossPunishWindow?.windowId ?? '';
  dataset.bossPunishMultiplier = String(lastBossPunishWindow?.multiplier ?? 1);
  dataset.worldId = LEVEL_ONE_WORLD.id;
  dataset.worldWidth = String(WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX);
  dataset.worldHeight = String(WORLD_BOUNDS.maxY - WORLD_BOUNDS.minY);
  dataset.districtId = getLevelOneDistrictAt(renderState.x, renderState.y)?.id ?? '';
  dataset.revealedCells = String(revealSnapshot.revealedCellIds.length);
  dataset.revealTotalCells = String(revealSnapshot.totalCells);

}
