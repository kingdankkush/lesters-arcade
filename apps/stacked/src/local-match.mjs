import { createStackedMatch } from '../../portal/src/stacked-match.mjs';
import { STACKED_ATTACK_TABLE } from '../../portal/src/stacked-versus-table.mjs';

const TICK_MS = 1000 / 60;
export { localVersusAllowed } from './local-access.mjs';

// Separate local Free driver. It cannot produce canonical evidence, profile
// progress or a parent result. Existing solo and Ranked entry points do not
// import it; the one table import here is explicitly audited.
export function createLocalStackedMatch({ seed, mode, input } = {}) {
  if (mode !== 'free' || !Number.isSafeInteger(seed) || seed < 1 || seed > 0xffffffff) throw new TypeError('local Free mode and an unsigned nonzero seed required');
  if (!input || !['activate','deactivate','pollTick','destroy'].every(name => typeof input[name] === 'function')) throw new TypeError('local input adapter required');
  const match = createStackedMatch({seed,playerConfigs:[{},{}],attackTable:STACKED_ATTACK_TABLE});
  let phase = 'ready', last = null, accumulator = 0, outcome = null;
  const snapshot = () => Object.freeze({phase,match:match.snapshot(),stateHash:match.stateHash(),outcome});
  const pause = () => {
    if (phase !== 'running') return;
    input.deactivate();phase='paused';last=null;accumulator=0;
  };
  return Object.freeze({
    snapshot,
    resume() {
      if (phase === 'running') return true;
      if (phase === 'complete' || phase === 'disposed' || !input.activate()) return false;
      phase='running';last=null;accumulator=0;return true;
    },
    pause,
    advance(now) {
      if (typeof now !== 'number' || !Number.isFinite(now)) throw new TypeError('finite frame timestamp required');
      if (phase !== 'running') return snapshot();
      if (!input.active) {pause();return snapshot();}
      if (last === null) {last=now;return snapshot();}
      if (now < last) return snapshot();
      accumulator += Math.min(100,now-last);last=now;
      let steps=0;
      while (accumulator >= TICK_MS && steps < 4) {
        const masks=input.pollTick(match.snapshot().boards);
        // A disconnected device must stop time, not play a neutral input tick.
        if (!input.active) {pause();break;}
        match.stepAll(masks);steps++;accumulator-=TICK_MS;
        if (match.terminal) {
          const boards=match.snapshot().boards;
          outcome=Object.freeze(boards.every(board=>board.terminal)
            ? {resolution:'draw',winner:null}
            : {resolution:'decided',winner:boards[0].terminal?1:0});
          phase='complete';input.deactivate();accumulator=0;last=null;break;
        }
      }
      if (steps === 4 && accumulator >= TICK_MS) accumulator=0;
      return snapshot();
    },
    destroy() {if(phase === 'disposed')return;input.destroy();phase='disposed';last=null;accumulator=0;},
  });
}
