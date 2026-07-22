import Phaser from 'phaser';
import { createSimulation, simulationChecksum, stepSimulation } from './shared/simulation.mjs';
import { createRecorder, installResultPanel } from './shared/recorder.mjs';

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') || 1987);
const scale = Number(params.get('scale') || 1);
const simulation = createSimulation(seed, scale);
let recorder = null;
let accumulator = 0;
const fixedMs = 1000 / 60;

function makeTexture(scene, key, color, radius, square = false) {
  const graphic = scene.make.graphics({ add: false });
  graphic.fillStyle(color, 1);
  if (square) graphic.fillRoundedRect(0, 0, radius * 2, radius * 2, 3);
  else graphic.fillCircle(radius, radius, radius);
  graphic.generateTexture(key, radius * 2, radius * 2);
  graphic.destroy();
}

const scene = {
  create() {
    makeTexture(this, 'enemy', 0xf04f78, 12);
    makeTexture(this, 'projectile', 0xffd166, 3);
    makeTexture(this, 'particle', 0x35d0e8, 2);
    makeTexture(this, 'prop', 0x3e5f58, 9, true);
    const spritesFor = (pool, key, alpha = 1) => {
      const sprites = [];
      for (let index = 0; index < pool.count; index += 1) {
        const sprite = this.add.image(0, 0, key).setAlpha(alpha);
        sprites.push(sprite);
      }
      return sprites;
    };
    this.layers = [
      { pool: simulation.props, sprites: spritesFor(simulation.props, 'prop', 0.7) },
      { pool: simulation.particles, sprites: spritesFor(simulation.particles, 'particle', 0.65) },
      { pool: simulation.projectiles, sprites: spritesFor(simulation.projectiles, 'projectile') },
      { pool: simulation.enemies, sprites: spritesFor(simulation.enemies, 'enemy') },
    ];
    const updatePanel = installResultPanel('Phaser 4.2.1 — HMH engine bakeoff');
    recorder = createRecorder('phaser@4.2.1', simulation.counts, updatePanel);
  },
  update(_time, delta) {
    accumulator += Math.min(delta, 100);
    let steps = 0;
    while (accumulator >= fixedMs && steps < 4) {
      stepSimulation(simulation, fixedMs / 1000);
      accumulator -= fixedMs;
      steps += 1;
    }
    const capped = accumulator >= fixedMs;
    if (capped) accumulator %= fixedMs;
    recorder.markFixedSteps(steps, capped);
    const width = this.scale.width;
    const height = this.scale.height;
    for (const layer of this.layers) {
      for (let index = 0; index < layer.pool.count; index += 1) {
        layer.sprites[index].setPosition(layer.pool.x[index] * width, layer.pool.y[index] * height);
      }
    }
    const gl = this.game.renderer.gl;
    recorder.frame(performance.now(), {
      simulationChecksum: simulationChecksum(simulation),
      renderer: this.game.renderer.constructor.name,
      webglVersion: gl?.getParameter(gl.VERSION) ?? null,
      webglRenderer: gl?.getParameter(gl.RENDERER) ?? null,
      renderedObjects: this.children.length,
    });
  },
};

new Phaser.Game({
  type: Phaser.WEBGL,
  parent: 'game',
  backgroundColor: '#071019',
  antialias: false,
  pixelArt: false,
  roundPixels: false,
  powerPreference: 'high-performance',
  width: window.innerWidth,
  height: window.innerHeight,
  scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene,
  banner: false,
  fps: { target: 60, forceSetTimeOut: false },
});
