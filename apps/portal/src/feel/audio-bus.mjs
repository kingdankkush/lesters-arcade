// Shared feel module (2.1, upgrade guide §2.4.1 / §5.1): master-bus dynamics.
//
// STACKED's synthesized SFX already run through a master DynamicsCompressor
// (stacked/src/sound-effects.mjs, STACKED_SFX_COMPRESSOR). These are the same
// values, shared so HMH (and later Chikun) master their buses the same way,
// plus a gentle per-bus compressor that only catches stacked SFX transients.
// Audio is projection-only: nothing here reaches a simulation.

// -16 dB threshold, knee 10, ratio 3.5, attack 3 ms, release 220 ms.
export const MASTER_BUS_COMPRESSOR = Object.freeze({ threshold: -16, knee: 10, ratio: 3.5, attack: 0.003, release: 0.22 });
// Gentle: a higher threshold and a 2:1 ratio, so single cues pass untouched
// and only a pile-up (minigun + impacts + a blast) is levelled before master.
export const SFX_BUS_COMPRESSOR = Object.freeze({ threshold: -10, knee: 8, ratio: 2, attack: 0.005, release: 0.15 });

export const dbToGain = (db) => 10 ** (db / 20);

// A DynamicsCompressor with `values`, or null where the context has none (the
// caller then wires straight through).
export function createBusCompressor(context, values) {
  if (typeof context?.createDynamicsCompressor !== 'function') return null;
  const node = context.createDynamicsCompressor();
  const when = Number.isFinite(context.currentTime) ? context.currentTime : 0;
  for (const key of Object.keys(values)) {
    const param = node[key];
    if (param && typeof param.setValueAtTime === 'function') param.setValueAtTime(values[key], when);
    else if (param && typeof param === 'object') param.value = values[key];
  }
  return node;
}
