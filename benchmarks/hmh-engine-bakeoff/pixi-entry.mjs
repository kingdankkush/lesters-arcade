import { Application, Container, Graphics, Sprite } from 'pixi.js';
import { createSimulation, simulationChecksum, stepSimulation } from './shared/simulation.mjs';
import { createRecorder, installResultPanel } from './shared/recorder.mjs';

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') || 1987);
const scale = Number(params.get('scale') || 1);
const simulation = createSimulation(seed, scale);
const app = new Application();
await app.init({
  resizeTo: window,
  background: '#071019',
  antialias: false,
  preference: 'webgl',
  powerPreference: 'high-performance',
  resolution: Math.min(devicePixelRatio, 2),
  autoDensity: true,
});
document.body.prepend(app.canvas);

function texture(color, radius, square = false) {
  const graphic = new Graphics();
  if (square) graphic.roundRect(0, 0, radius * 2, radius * 2, 3).fill(color);
  else graphic.circle(radius, radius, radius).fill(color);
  const result = app.renderer.generateTexture(graphic);
  graphic.destroy();
  return result;
}

const textures = {
  enemy: texture(0xf04f78, 12),
  projectile: texture(0xffd166, 3),
  particle: texture(0x35d0e8, 2),
  prop: texture(0x3e5f58, 9, true),
};
const world = new Container();
app.stage.addChild(world);

function spritesFor(pool, sourceTexture, alpha = 1) {
  const sprites = [];
  for (let index = 0; index < pool.count; index += 1) {
    const sprite = new Sprite(sourceTexture);
    sprite.anchor.set(0.5);
    sprite.alpha = alpha;
    world.addChild(sprite);
    sprites.push(sprite);
  }
  return sprites;
}
const layers = [
  { pool: simulation.props, sprites: spritesFor(simulation.props, textures.prop, 0.7) },
  { pool: simulation.particles, sprites: spritesFor(simulation.particles, textures.particle, 0.65) },
  { pool: simulation.projectiles, sprites: spritesFor(simulation.projectiles, textures.projectile) },
  { pool: simulation.enemies, sprites: spritesFor(simulation.enemies, textures.enemy) },
];

const updatePanel = installResultPanel('PixiJS 8.19.0 — HMH engine bakeoff');
const recorder = createRecorder('pixi.js@8.19.0', simulation.counts, updatePanel);
let accumulator = 0;
const fixedMs = 1000 / 60;
app.ticker.add((ticker) => {
  accumulator += Math.min(ticker.deltaMS, 100);
  let steps = 0;
  while (accumulator >= fixedMs && steps < 4) {
    stepSimulation(simulation, fixedMs / 1000);
    accumulator -= fixedMs;
    steps += 1;
  }
  const capped = accumulator >= fixedMs;
  if (capped) accumulator %= fixedMs;
  recorder.markFixedSteps(steps, capped);
  const width = app.screen.width;
  const height = app.screen.height;
  for (const layer of layers) {
    for (let index = 0; index < layer.pool.count; index += 1) {
      layer.sprites[index].position.set(layer.pool.x[index] * width, layer.pool.y[index] * height);
    }
  }
  const gl = app.renderer.gl;
  recorder.frame(performance.now(), {
    simulationChecksum: simulationChecksum(simulation),
    renderer: app.renderer.constructor.name,
    webglVersion: gl?.getParameter(gl.VERSION) ?? null,
    webglRenderer: gl?.getParameter(gl.RENDERER) ?? null,
    renderedObjects: world.children.length,
  });
});
