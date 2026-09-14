// Local render fixture only. This file is never imported by the playable game.
import { Application, Container, Graphics, Text } from 'pixi.js';
import { createStackedRenderer } from '../apps/stacked/src/render/renderer.mjs';
import { createStackedRuntime, PIECE_CELLS, cellsFor, collides } from '../apps/portal/src/stacked-sim.mjs';
import { defaultStackedSettings } from '../apps/portal/src/stacked-player-settings.mjs';
const app = new Application(), stage = document.querySelector('#stackedStage');
await app.init({ resizeTo: stage, backgroundAlpha: 0, resolution: 1, preference: 'webgl', antialias: false });
app.ticker.stop(); stage.append(app.canvas);
const renderer = createStackedRenderer({ app, stageElement: stage, geometry: { PIECE_CELLS, cellsFor, collides }, Container, Graphics, Text });
let snapshot = structuredClone(createStackedRuntime({ seed: 424242 }).snapshot());
for (let y = 0; y < 5; y++) for (let x = 0; x < 10; x++) if ((x + y) % 4 !== 0) snapshot.board[y * 10 + x] = (x + y) % 7 + 1;
const settings = defaultStackedSettings();
window.visualizerQa = {
  present(now, energy = 0.5) {
    renderer.audio({ available: true, level: energy * 1000, bass: energy * 1000, high: energy * 600 }, now);
    return renderer.frame(snapshot, now, settings);
  },
  clear(lines) { snapshot = { ...snapshot, lines: snapshot.lines + lines }; },
  reduced(value) { settings.accessibility.reduceMotion = value; },
  destroy() { renderer.destroy(); app.destroy(true, { children: true }); },
};
window.visualizerQa.present(1000);
