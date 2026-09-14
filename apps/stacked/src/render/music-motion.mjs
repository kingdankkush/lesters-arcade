const unit = value => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;

// Presentation clock and audio envelopes. No simulation or random-number access.
export function createMusicMotion() {
  const state = { time: 0, bass: 0, high: 0, level: 0, beat: 0, available: false };
  let frame = null, receivedAt = -10000, previous = null, onsetPending = false;
  return {
    state,
    audio(value, now) { frame = value; receivedAt = now; onsetPending ||= value?.available && value.onset === true; },
    update(now, reducedMotion, reactive = true) {
      const dt = previous === null ? 0 : Math.max(0, Math.min(0.1, (now - previous) / 1000)); previous = now;
      state.available = !!(reactive && frame?.available && now - receivedAt < 500);
      if (reducedMotion) {
        state.time = state.beat = state.bass = state.high = state.level = 0; onsetPending = false; return state;
      }
      state.time += dt;
      for (const [key, idle, attack, release] of [['bass',.05,0.08,0.28],['high',.02,0.06,0.2],['level',.08,0.12,0.35]]) {
        const target = state.available ? unit(frame[key] / 1000) : idle;
        state[key] += (target-state[key]) * (1-Math.exp(-dt/(target>state[key]?attack:release)));
      }
      state.beat *= Math.exp(-dt/0.26);
      if (state.available && onsetPending) state.beat = Math.max(state.beat,0.35+state.bass*0.5);
      onsetPending = false;
      return state;
    },
  };
}
