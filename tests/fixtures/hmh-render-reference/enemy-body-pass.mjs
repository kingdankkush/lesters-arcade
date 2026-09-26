// Verbatim copy of the 1.8.1 release (60ea173a) enemy body loop from
// apps/hmh-reboot/src/main.mjs renderWorld (lines 1670-1822) and its health-pip
// overlay (lines 2670-2680), kept as the reference for
// tests/hmh-enemy-render-pass.test.mjs. Only the closure's free variables became
// parameters; every statement between the markers is unchanged. Do not edit.
export function referenceEnemyBodyPass({
  grayboxEnemies, enemyMarkers, enemyVisualFacing, enemyHitFeedback, enemyHitFeedbackById,
  simulation, camera, view, screen, performanceProfile, releaseTelemetryEnabled, dataset, settings,
  particleScale, contactShadowPool, enemyTelegraphs, runtimeEncounterSnapshot, worldToScreen,
  isScreenPointVisible, resolveEnemyRuntimeVisualState, isEliteEnemyProjection, selectAnimatedEnemyIds,
  ENEMY_ARCHETYPES, resolveEnemyVisualDirection, resolveEnemyRosterPoseSelection,
  prepareWorldDesignEnemyPose, creatureAnimationTick, placeWeaponGlow, worldDepthKey,
  contactShadowFootY, drawEliteGroundRing, projectGasBomberCanister,
}) {
      // ---- 1.8.1 main.mjs:1670-1822 ----
      const encounterAnimationCap = runtimeEncounterSnapshot(simulation?.tick ?? 0).animationCap;
      const animationBudget = Math.min(performanceProfile.maxAnimatedEnemies, encounterAnimationCap);
      const animationCandidates = grayboxEnemies.map((enemy) => {
        const enemyScreen = worldToScreen({ ...enemy, z: enemy.groundZ ?? 0 }, camera, view);
        const state = resolveEnemyRuntimeVisualState(enemy, simulation?.tick ?? 0);
        return {
          id: enemy.id,
          visible: enemy.active && isScreenPointVisible(enemyScreen, view, performanceProfile.enemyCullMargin),
          distance: Math.hypot(enemyScreen.x - screen.x, enemyScreen.y - screen.y),
          state,
          spawnCue: Number.isInteger(enemy.spawnedTick) && (simulation?.tick ?? 0) - enemy.spawnedTick <= 30,
          elite: isEliteEnemyProjection(enemy.id),
        };
      });
      const animatedEnemyIds = selectAnimatedEnemyIds(animationCandidates, animationBudget);
      let animatedEnemyCount = 0;
      let bossTelegraphPrimitiveCount = 0;
      const enemyHealthPips = [];
      for (const enemy of grayboxEnemies) {
        const enemyMarker = enemyMarkers.get(enemy.id);
        if (!enemyMarker) continue;
        if (!enemy.active) {
          enemyMarker.visible = false;
          enemyVisualFacing.delete(enemy.id);
          continue;
        }
        const archetype = ENEMY_ARCHETYPES[enemy.archetypeId];
        const enemyScreen = worldToScreen({ ...enemy, z: enemy.groundZ ?? 0 }, camera, view);
        const markerVisible = isScreenPointVisible(enemyScreen, view, performanceProfile.enemyCullMargin);
        enemyMarker.visible = markerVisible;
        if (markerVisible) {
          const animate = animatedEnemyIds.has(enemy.id);
          if(animate) animatedEnemyCount += 1;
          const facingState = enemyVisualFacing.get(enemy.id) ?? { direction: 0 };
          enemyVisualFacing.set(enemy.id, facingState);
          const enemyDirection = resolveEnemyVisualDirection(facingState, enemy.velocity);
          const poseSelection = resolveEnemyRosterPoseSelection(enemy, simulation?.tick ?? 0);
          const enemyPose = prepareWorldDesignEnemyPose(enemyMarker, animate, {
            // Roster bodies follow the simulation's tell / strike / recovery
            // windows (Cycle 074); the vector fallback keeps the six-state map.
            state: enemyMarker.phaseRelativePoses ? poseSelection.state : resolveEnemyRuntimeVisualState(enemy, simulation?.tick ?? 0),
            tick: creatureAnimationTick(enemy.id, simulation?.tick ?? 0, poseSelection.state, (enemy.hitUntilTick ?? 6) - 6),
            direction: enemyDirection,
            elite: isEliteEnemyProjection(enemy.id),
            phaseTick: enemyMarker.phaseRelativePoses ? poseSelection.phaseTick : null,
          });
          enemyMarker.position.set(enemyScreen.x, enemyScreen.y);
          enemyMarker.scale.set((enemyMarker.rosterScale ?? 1) * camera.zoom);
          enemyMarker.rotation = 0;
          if (releaseTelemetryEnabled && enemy === grayboxEnemies[0]) {
            dataset.targetArtVisible = 'true';
            dataset.targetArtFrameId = enemyMarker.frameId ?? '';
            dataset.targetArtState = enemyMarker.visualState ?? '';
            dataset.targetArtScreenX = String(enemyMarker.x);
            dataset.targetArtScreenY = String(enemyMarker.y);
            dataset.targetArtScale = String(enemyMarker.scale.y);
          }
          // Hit reaction on the body itself, layered over whatever pose the
          // precedence chose, so a hit inside a tell or strike still lands
          // visibly. Position and squash are applied after the pinned
          // scale.set above; the tint hands back to the display's own base
          // tint when there is nothing to show.
          const hit = enemyHitFeedback && enemyHitFeedbackById.get(enemy.id);
          const hitAge = hit ? (simulation?.tick ?? 0) - hit.tick : 6;
          const reaction = hitAge < 6 ? enemyHitFeedback.resolveEnemyHitReaction({
            ...hit,
            age: hitAge,
            zoom: camera.zoom,
            particleScale,
            reduceMotion: settings.reduceMotion || performanceProfile.particlesPerHazard === 0,
            reduceFlash: settings.reduceFlash,
            seed: `${enemy.id}:${hit.tick}`,
          }) : null;
          if (reaction) {
            enemyMarker.position.set(enemyScreen.x + reaction.offsetX, enemyScreen.y + reaction.offsetY);
            enemyMarker.scale.x *= reaction.squashX;
            enemyMarker.scale.y *= reaction.squashY;
            // Shards sit at chest height; the impact burst already owns the
            // hit point itself, so no second ring is drawn here.
            for (const shard of reaction.shards) placeWeaponGlow(enemyScreen.x + shard.dx, enemyScreen.y - 24 * camera.zoom + shard.dy, shard.radius, shard.color, shard.alpha);
          }
          enemyMarker.setTint(reaction?.tint ?? null);
          // Health is shown on a pip below the body. It used to drive alpha,
          // which made the highest-priority target the hardest one to see and
          // turned dense fights into overlapping ghosts.
          enemyMarker.alpha = 1;
          // Depth: an enemy standing further south must draw in front.
          enemyMarker.zIndex = worldDepthKey(enemy.y);
          // Ground contact. Placed inside the animated-marker branch so the
          // shadow count can never exceed the bodies actually drawn.
          if (enemyMarker.contactShadowFootprint) {
            contactShadowPool?.place({
              x: enemyScreen.x,
              y: contactShadowFootY(enemyMarker, enemyPose, enemyScreen.y, camera.zoom),
              footprintPx: enemyMarker.contactShadowFootprint * camera.zoom,
            });
          }
          if (enemyMarker.eliteProjection) {
            drawEliteGroundRing(
              enemyScreen.x,
              contactShadowFootY(enemyMarker, enemyPose, enemyScreen.y, camera.zoom),
              archetype.radius * camera.zoom,
              simulation?.tick ?? 0,
            );
          }
          const healthRatio = Math.max(0, Math.min(1, enemy.health / enemy.maxHealth));
          enemyHealthPips.push({ screen: enemyScreen, ratio: healthRatio, radius: enemy.radius, color: archetype.visual.color });
        }
        if (enemy.attackPhase !== 'tell' || !enemy.telegraphTarget || !simulation) continue;
        const targetScreen = worldToScreen({ ...enemy.telegraphTarget, z: enemy.telegraphTarget.groundZ }, camera, view);
        const tellRatio = Math.max(0, Math.min(1, (enemy.attackPhaseUntilTick - simulation.tick) / archetype.attack.tellTicks));
        const alpha = 0.38 + (1 - tellRatio) * 0.5;
        // Several archetype tell colours sit within a few points of their own
        // district's ground palette (gas-bomber orange on rugpull-ravine, boss
        // red on liquidation-yard). A dark contour under every stroke
        // guarantees the tell separates from whatever it is drawn over.
        const CONTOUR = { color: 0x080d12, alpha: alpha * 0.72 };
        if (archetype.attack.tokenFamily === 'area') {
          enemyTelegraphs.circle(targetScreen.x, targetScreen.y, 96 * camera.zoom)
            .fill({ color: archetype.visual.color, alpha: 0.08 })
            .stroke({ ...CONTOUR, width: 10 })
            .stroke({ color: archetype.visual.color, width: 4, alpha });
          const canister = projectGasBomberCanister({ enemy, tick: simulation.tick });
          if (canister) {
            const canisterScreen = worldToScreen(canister, camera, view);
            const stripeX = Math.cos(canister.rotation) * 6 * camera.zoom;
            const stripeY = Math.sin(canister.rotation) * 6 * camera.zoom;
            enemyTelegraphs.circle(canisterScreen.x, canisterScreen.y, 8 * camera.zoom)
              .fill({ color: archetype.visual.color, alpha: 0.98 })
              .stroke({ color: 0x080d12, width: 3 * camera.zoom, alpha: 1 });
            enemyTelegraphs.moveTo(canisterScreen.x - stripeX, canisterScreen.y - stripeY)
              .lineTo(canisterScreen.x + stripeX, canisterScreen.y + stripeY)
              .stroke({ color: 0xfff4c7, width: 2 * camera.zoom, alpha: 0.92 });
            if (releaseTelemetryEnabled) dataset.gasCanisterProgress = canister.progress.toFixed(3);
          }
        } else if (archetype.attack.tokenFamily === 'support') {
          enemyTelegraphs.circle(targetScreen.x, targetScreen.y, 140 * camera.zoom)
            .stroke({ ...CONTOUR, width: 11 })
            .stroke({ color: archetype.visual.color, width: 5, alpha });
        } else if (archetype.attack.tokenFamily === 'melee') {
          enemyTelegraphs.circle(enemyScreen.x, enemyScreen.y, archetype.attack.range * camera.zoom)
            .stroke({ ...CONTOUR, width: 10 })
            .stroke({ color: archetype.visual.color, width: 4, alpha });
          enemyTelegraphs.moveTo(enemyScreen.x, enemyScreen.y).lineTo(targetScreen.x, targetScreen.y)
            .stroke({ ...CONTOUR, width: 9 })
            .stroke({ color: archetype.visual.color, width: 3, alpha });
        } else {
          enemyTelegraphs.moveTo(enemyScreen.x, enemyScreen.y).lineTo(targetScreen.x, targetScreen.y)
            .stroke({ color: archetype.visual.color, width: 18 * camera.zoom, alpha: alpha * 0.22, cap: 'round' })
            .stroke({ ...CONTOUR, width: 9, cap: 'round' })
            .stroke({ color: archetype.visual.color, width: 3, alpha, cap: 'round' });
        }
      }
      // ---- end ----
  return { animatedEnemyCount, enemyHealthPips };
}

export function referenceHealthPips({ enemyHealthPips, camera, world, overlayVisuals }) {
      // ---- 1.8.1 main.mjs:2670-2680 ----
      for (const pip of enemyHealthPips) {
        if (pip.ratio >= 1) continue;
        const width = Math.max(18, pip.radius * 1.9) * camera.zoom;
        // overlayVisuals sits on the stage and is not shake-offset, so carry
        // the world offset across or pips detach from their bodies mid-shake.
        const pipX = pip.screen.x + world.position.x;
        const y = pip.screen.y + world.position.y + Math.max(14, pip.radius * 0.9) * camera.zoom;
        overlayVisuals.roundRect(pipX - width / 2, y, width, 4, 2).fill({ color: 0x0a0f14, alpha: 0.72 });
        overlayVisuals.roundRect(pipX - width / 2, y, width * pip.ratio, 4, 2)
          .fill({ color: pip.ratio > 0.5 ? 0x8ef5a8 : pip.ratio > 0.25 ? 0xffd166 : 0xff5c7a, alpha: 0.96 });
      }
      // ---- end ----
}
