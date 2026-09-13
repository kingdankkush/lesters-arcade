import { createStackedRuntime, createStackedInputRecorder } from '../../portal/src/stacked-sim.mjs';

// Owns committed input/time only. Audio, rendering and wall clocks never enter this module.
export function createStackedPlaySession({ seed, mode, startLevel = 1, buildHash = 'stacked-local', seasonId = 'stacked-season-preview-1' }) {
  if (!['free', 'ranked'].includes(mode)) throw new TypeError('Unknown play mode');
  if (mode === 'ranked' && startLevel !== 1) throw new Error('Ranked starts at level 1');
  const config = { startLevel, buildHash, seasonId };
  let runtime = createStackedRuntime({ seed, config });
  let recorder = createStackedInputRecorder({ seed });
  let snapshot = runtime.snapshot(), paused = false, assisted = false, spawnTick = 0;
  const history = [], checkpoints = [];
  const step = mask => {
    if (paused || runtime.terminal) return snapshot;
    recorder.sample(snapshot.tick + 1, mask);
    const committed = recorder.commit();
    const before = snapshot;
    snapshot = runtime.step(committed);
    if (mode === 'free') {
      history.push(committed);
      if (snapshot.piecesLocked > before.piecesLocked) {
        checkpoints.push(spawnTick);
        if (checkpoints.length > 3) checkpoints.shift();
        spawnTick = snapshot.tick;
      }
    }
    return snapshot;
  };
  return Object.freeze({
    step,
    pause() { if (!paused) recorder.stop('pause'); paused = true; },
    resume() { paused = false; },
    undo() {
      if (mode !== 'free' || checkpoints.length === 0) return false;
      const target = checkpoints.pop();
      runtime = createStackedRuntime({ seed, config });
      recorder = createStackedInputRecorder({ seed });
      snapshot = runtime.snapshot();
      for (let i = 0; i < target; i++) {
        recorder.sample(i + 1, history[i]);
        snapshot = runtime.step(recorder.commit());
      }
      history.length = target; spawnTick = target; assisted = true;
      return true;
    },
    evidence: () => recorder.encode(),
    get snapshot() { return snapshot; },
    get result() { return runtime.result(); },
    get paused() { return paused; },
    get assisted() { return assisted; },
  });
}
