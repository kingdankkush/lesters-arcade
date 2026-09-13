// The parent owns the only music element. Its graph lives for the page lifetime;
// cabinet disposal only stops sampling, never disconnects or replaces the music.
const graphs = new WeakMap();
export function spectrumFrame(bytes, sampleRate, fftSize, now) {
  const band = (low, high) => {
    const first = Math.max(0, Math.floor(low * fftSize / sampleRate));
    const last = Math.min(bytes.length, Math.max(first + 1, Math.ceil(high * fftSize / sampleRate)));
    let sum = 0; for (let i = first; i < last; i++) sum += bytes[i];
    return Math.round(1000 * sum / Math.max(1, last - first) / 255);
  };
  return { t: Math.floor(now) % 1048576, sub: band(20, 60), bass: band(60, 250), lowMid: band(250, 500), mid: band(500, 2000), high: band(2000, 12000), level: band(20, 12000), onset: false, beatPhase: 0, bpm: 0, available: true };
}
export function createStackedAudioSampler(media, { contextFactory = () => new (globalThis.AudioContext || globalThis.webkitAudioContext)() } = {}) {
  if (!media) return { sample: () => null, resume: () => {} };
  let graph = graphs.get(media);
  if (!graph) {
    try {
      const context = contextFactory(), analyser = context.createAnalyser();
      analyser.fftSize = 2048; analyser.smoothingTimeConstant = 0.65;
      graph = { context, analyser, source: null, activating: null, bytes: new Uint8Array(analyser.frequencyBinCount) };
      const current = graph;
      graph.activate = () => {
        if (current.activating) return current.activating;
        current.activating = (async () => {
          try {
            await context.resume();
            // Do not steal a playing element's direct output until audio is unlocked.
            if (context.state !== 'running' || current.source) return;
            const source = context.createMediaElementSource(media);
            source.connect(context.destination); source.connect(analyser);
            current.source = source;
          } catch { /* The existing media path remains audible if activation is blocked. */ }
        })().finally(() => { current.activating = null; });
        return current.activating;
      };
      graphs.set(media, graph);
      media.addEventListener('play', () => { void current.activate(); });
    } catch { return { sample: () => null, resume: () => {} }; }
  }
  let average = 0, lastOnset = -1000, beatInterval = 500;
  return {
    resume() { return graph.activate(); },
    sample(now) {
      if (!graph.source) return null;
      graph.analyser.getByteFrequencyData(graph.bytes);
      const frame = spectrumFrame(graph.bytes, graph.context.sampleRate, graph.analyser.fftSize, now);
      frame.available = !media.paused && graph.context.state === 'running';
      const energy = (frame.bass + frame.sub) / 2;
      const delta = now - lastOnset;
      frame.onset = frame.available && energy > Math.max(110, average * 1.25) && delta >= 333;
      average += (energy - average) * 0.05;
      if (frame.onset) {
        if (delta >= 333 && delta <= 1000) beatInterval = beatInterval * 0.75 + delta * 0.25;
        lastOnset = now;
      }
      frame.beatPhase = Math.min(1000, Math.round((now - lastOnset) % beatInterval / beatInterval * 1000));
      frame.bpm = lastOnset > 0 ? Math.max(600, Math.min(2000, Math.round(600000 / beatInterval))) : 0;
      return frame;
    },
  };
}
