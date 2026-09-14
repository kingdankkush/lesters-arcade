// Parent presentation only. Music never consumes the course RNG or input evidence.
export function createChikunRunMusic(startTrack) {
  let awaitingFlight=true,closed=false;
  return Object.freeze({
    observe(state={}) {
      if(closed)return;
      if(state.status==='game-over')awaitingFlight=true;
      if(state.status==='running' && awaitingFlight && state.survivalTicks===0) {
        awaitingFlight=false;
        void startTrack('chikun');
      }
    },
    dispose(){closed=true;},
  });
}
