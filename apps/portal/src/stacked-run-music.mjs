// Parent presentation only. STACKED run music never reads or writes the run,
// its seed, input evidence or result; it only decides when the shared arcade
// player plays. One instance per mounted STACKED session (a Run Again or a new
// Free/Ranked click remounts, so every game gets its own instance).
//
// The random starting track is normally already playing: the Free click starts
// it synchronously, inside the click's user activation (like Hard Money
// Heroes' beginOfficialLevel). This machine is the safety net for the cases
// where that start could not happen or was rejected (a Ranked entry that went
// through the wallet modal, a strict autoplay policy, a Run Again relayed from
// the child).
//
//   mount()          the cabinet mounted. A song that is already playing is
//                    kept (the queue context moves to STACKED); a paused player
//                    with music on starts a random track; music off or muted
//                    only follows the queue context.
//   observe(state)   the child's game:state. On the first `running` of the
//                    session the player is started only if it is still paused
//                    and music is on. A playing track is never switched; later
//                    states (pause, resume, score ticks, game over) do nothing.
//   dispose()        the session closed; later calls do nothing.
//
// Callbacks: start() picks a random track (never the previous one) and plays
// it; adopt() keeps the current song and switches the queue context;
// isPlaying() and musicOn() read the parent player.
export function createStackedRunMusic({ start = () => {}, adopt = () => {}, isPlaying = () => false, musicOn = () => true } = {}) {
  let awaitingRun = true, closed = false;
  return Object.freeze({
    mount() {
      if (closed) return 'closed';
      awaitingRun = true;
      if (!musicOn() || isPlaying()) { adopt(); return 'adopt'; }
      start();
      return 'start';
    },
    observe(state = {}) {
      if (closed) return 'closed';
      if (state?.status !== 'running' || !awaitingRun) return 'idle';
      awaitingRun = false;
      if (!musicOn()) return 'off';
      if (isPlaying()) return 'keep';
      start();
      return 'start';
    },
    dispose() { closed = true; },
  });
}
