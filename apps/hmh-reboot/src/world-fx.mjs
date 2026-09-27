// 1.9.0 world pass orchestrator (lazy chunk; main.mjs imports it on the first
// camera frame). Projection only: it reads the camera, the simulation tick,
// authored placements, the corpses already queued for display and the enemy
// display objects, and writes display objects, the DOM cockpit's CSS custom
// properties and (under telemetry) dataset strings. Nothing here is read back
// by the simulation, collision, AI, spawning, RNG, progression or evidence.
//
// A4 mood       multiply grade + mood vignette + lamp glow strength, blended
//               over the district seam window with an exponential rate.
// H4            the active mood mirrored as --hmh-mood-* on the cockpit root.
// C1b weather   rain and ash in the shared 64-slot atmosphere pool; wet-ground
//               sparkle on roads and roofs while it rains.
// C2 water      shore-field foam, caustics over the shallows, deep tint,
//               sun glints when the mood is bright.
// C4 ambient    7.5 Hz smoke and signage, kill-thresholded scorch, lamp glows.
// D2 micro-life 1 px idle bobs on enemy bodies from co-prime cycles.
import {
  buildWetSparkleAnchors, createMoodState, microLifeBob, moodCssProperties, renderWeather, renderWetSparkle,
  resolveMoodGrade, resolveMoodTarget, resolveWeatherBudget, stepMood,
} from './world-mood.mjs';
import { causticPixels, glowPixels, puffPixels, scorchPixels, texturesFromPixels, vignettePixels } from './world-fx-textures.mjs';
import { createWaterFx } from './world-water-fx.mjs';
import { createAmbientFx } from './world-ambient-fx.mjs';

export const WORLD_FX_ART_ID = 'projection-world-fx-v1';
export const MOOD_VIGNETTE_MAX_ALPHA = 0.5;
const ATMOSPHERE_POOL_CAP = 64;
// Enemy states that must never move a pixel: the tell and strike read.
const STILL_STATES = /tell|attack|strike|hit|death|recover/u;

export function createWorldFx({
  app, world, stage = app?.stage, Container, Sprite, Texture, TilingSprite, Graphics,
  level, placements = [], profile, atmospherePool = null, grade = null, hud = null,
  layers = {}, documentRef = globalThis.document,
} = {}) {
  const textures = texturesFromPixels({
    TextureClass: Texture,
    documentRef,
    images: {
      vignette: vignettePixels(),
      glow: glowPixels(),
      puff: puffPixels(),
      scorch: scorchPixels(64, 0),
      debris: scorchPixels(64, 1),
      caustic: causticPixels(),
    },
  });
  const moodState = createMoodState();
  const weatherBudget = resolveWeatherBudget(profile);
  const sparkleAnchors = buildWetSparkleAnchors({ world: level, placements });
  const water = createWaterFx({ ContainerClass: Container, GraphicsClass: Graphics, TilingSpriteClass: TilingSprite, causticTexture: textures.caustic, world: level, profile });
  const ambient = createAmbientFx({ ContainerClass: Container, SpriteClass: Sprite, textures, world: level, placements, profile });
  const insertBelow = (child, anchor) => {
    const at = anchor && anchor.parent === world ? world.getChildIndex(anchor) : world.children.length;
    world.addChildAt(child, at);
  };
  if (water) insertBelow(water.container, layers.water);
  insertBelow(ambient.ground, layers.ground);
  insertBelow(ambient.air, layers.air);
  const vignette = new Sprite({ texture: textures.vignette });
  vignette.label = 'world-mood-vignette';
  vignette.visible = false;
  // The runtime hides the grade on a frame without a camera (menus, between
  // runs) and never calls this pass then; the vignette follows the grade.
  if (grade) vignette.onRender = () => { if (!grade.visible) vignette.visible = false; };
  if (grade?.parent === stage) stage.addChildAt(vignette, stage.getChildIndex(grade) + 1);
  else stage.addChild(vignette);
  let cssKey = '';
  const report = { mood: null, rain: 0, ash: 0, sparkle: 0, water: null, ambient: null, bobs: 0 };

  const render = ({ camera, view, tick = 0, worldToScreen, queryGround, reduceMotion = false, deaths = null, markers = null, dataset = null } = {}) => {
    if (!camera || !view) {
      vignette.visible = false;
      return report;
    }
    const current = stepMood(moodState, resolveMoodTarget({ districts: level.districts, x: camera.x }), { tick, x: camera.x });
    report.mood = current;
    // A4: the grade quad the runtime already owns, switched to multiply.
    if (grade) {
      const moodGrade = resolveMoodGrade(current);
      grade.blendMode = moodGrade.blendMode;
      grade.tint = moodGrade.color;
      grade.alpha = moodGrade.alpha;
      grade.visible = moodGrade.alpha > 0.002;
    }
    vignette.width = view.width;
    vignette.height = view.height;
    vignette.alpha = Math.min(MOOD_VIGNETTE_MAX_ALPHA, current.vignette);
    vignette.tint = current.night > 0.5 ? 0x05030c : 0x02060a;
    vignette.visible = vignette.alpha > 0.01;
    // H4: mirror into the cockpit only when a quantised value moved.
    if (hud?.style) {
      const properties = moodCssProperties(current);
      const key = properties.map((entry) => entry[1]).join('|');
      if (key !== cssKey) {
        cssKey = key;
        for (const [name, value] of properties) hud.style.setProperty(name, value);
      }
    }
    // C1b: weather after the fog and motes in the same pool, never past it.
    const weatherOn = !reduceMotion && weatherBudget.weather > 0 && Boolean(atmospherePool);
    report.rain = report.ash = report.sparkle = 0;
    if (weatherOn) {
      const room = Math.max(0, ATMOSPHERE_POOL_CAP - atmospherePool.placed);
      const sparkleBudget = Math.min(weatherBudget.sparkle, room);
      report.sparkle = renderWetSparkle({ pool: atmospherePool, anchors: sparkleAnchors, camera, view, tick, worldToScreen, current, budget: { sparkle: sparkleBudget }, queryGround });
      const weather = renderWeather({
        pool: atmospherePool, districts: level.districts, camera, view, tick, worldToScreen, current,
        budget: { weather: Math.min(weatherBudget.weather, Math.max(0, ATMOSPHERE_POOL_CAP - atmospherePool.placed)) },
      });
      report.rain = weather.rain;
      report.ash = weather.ash;
    }
    // C2 water; its glints borrow what is left of the atmosphere pool.
    const glintBudget = weatherOn ? Math.min(weatherBudget.sparkle, Math.max(0, ATMOSPHERE_POOL_CAP - atmospherePool.placed)) : 0;
    report.water = water?.render({
      camera, view, tick, worldToScreen, current, reduceMotion, sparkleBudget: glintBudget,
      place: (x, y, size, tint, alpha) => atmospherePool.place({ mote: true, x, y, width: size, height: size, tint, alpha }),
    }) ?? null;
    // C4 ambient life.
    report.ambient = ambient.render({ camera, view, tick, worldToScreen, queryGround, current, reduceMotion, deaths });
    // D2: a 1 px idle bob through the pivot, so the render pass keeps sole
    // ownership of position and scale. Attack reads never move.
    report.bobs = 0;
    if (markers) {
      for (const [id, marker] of markers) {
        if (!marker?.pivot) continue;
        const scale = Math.abs(marker.scale?.y ?? 1) || 1;
        const bob = !reduceMotion && marker.visible && !STILL_STATES.test(marker.visualState ?? '') ? microLifeBob(id, tick) : 0;
        const pivotY = bob / scale;
        if (marker.pivot.y !== pivotY) marker.pivot.y = pivotY;
        report.bobs += bob;
      }
    }
    // A pooled body retired into a corpse keeps no bob.
    if (deaths) for (const death of deaths.values()) if (death.graphic?.pivot && death.graphic.pivot.y !== 0) death.graphic.pivot.y = 0;
    if (dataset) {
      dataset.worldMood = `${current.r.toFixed(0)},${current.g.toFixed(0)},${current.b.toFixed(0)}@${current.tintAlpha.toFixed(3)} v${current.vignette.toFixed(2)} g${current.glow.toFixed(2)} n${current.night.toFixed(2)}`;
      dataset.worldWeather = `rain:${report.rain} ash:${report.ash} sparkle:${report.sparkle}`;
      dataset.worldWater = report.water ? `visible:${report.water.visible} foam:${report.water.foamSegments} glints:${report.water.sparkles}` : 'none';
      dataset.worldAmbient = `glows:${report.ambient.glows} smoke:${report.ambient.smoke} scorch:${report.ambient.scorch}`;
    }
    return report;
  };
  return Object.freeze({ artId: WORLD_FX_ART_ID, runtimeAuthority: 'projection-only', render, water, ambient, vignette });
}
