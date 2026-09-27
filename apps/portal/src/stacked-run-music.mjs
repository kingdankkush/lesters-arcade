// Parent presentation only. STACKED run music never reads or writes the run,
// its seed, input evidence or result; it only decides when the shared arcade
// player starts a song. One instance per mounted STACKED session.
//
//   mount()           the cabinet mounted: start a fresh random song (music on)
//                     or just follow the queue context (music off / muted).
//   observe(state)    the child's game:state. The first `running` of a run is
//                     the run start: keep a song that is already playing
//                     (switching the queue context), otherwise start a fresh
//                     random one. A `terminal` state arms the next run for a
//                     fresh random song, like a new Hard Money Heroes run.
//   dispose()         the session closed; later calls do nothing.
//
// Callbacks: start() picks a random track (never the previous one) and plays
// it; adopt() keeps the current song and switches the queue context;
// isPlaying() and musicOn() read the parent player.
export function createStackedRunMusic({ start = () => {}, adopt = () => {}, isPlaying = () => false, musicOn = () => true } = {}) {
  let awaitingRun = true, freshNext = false, closed = false;
  return Object.freeze({
    mount() {
      if (closed) return 'closed';
      awaitingRun = true; freshNext = false;
      if (!musicOn()) { adopt(); return 'adopt'; }
      start();
      return 'start';
    },
    observe(state = {}) {
      if (closed) return 'closed';
      if (state?.status === 'terminal') { awaitingRun = true; freshNext = true; return 'armed'; }
      if (state?.status !== 'running' || !awaitingRun) return 'idle';
      awaitingRun = false;
      const fresh = freshNext;
      freshNext = false;
      if (!musicOn()) return 'off';
      if (!fresh && isPlaying()) { adopt(); return 'adopt'; }
      start();
      return 'start';
    },
    dispose() { closed = true; },
  });
}
