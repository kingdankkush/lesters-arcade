import { STACKED_FREE_MEDALS_KEY } from '../../portal/src/stacked-contracts.mjs';
import { zoneForTick } from '../../portal/src/stacked-sim.mjs';

// Practice-only projection. Never import the parent profile or persistence code here.
export const FREE_MEDALS = Object.freeze([
  ['first-seal', 'First Seal', 'lines', 1],
  ['first-quad', 'Halving Day', 'quadClears', 1],
  ['first-spin', 'Torque Ledger', 'spinClears', 1],
  ['combo-5', 'Chain of Five', 'maxCombo', 5],
  ['survive-180', 'Three-Minute Block', 'tick', 10800],
  ['lines-40', 'Forty Rows', 'lines', 40],
  ['combo-10', 'Chain Reaction', 'maxCombo', 10],
  ['zone-3', 'Third Epoch', 'zone', 3],
  ['survive-360', 'Six-Minute Miner', 'tick', 21600],
  ['quad-10', 'Ten Halvings', 'quadClears', 10],
  ['perfect-clear', 'Empty Ledger', 'perfectClears', 1],
  ['lines-150', 'Hundred-Fifty Block', 'lines', 150],
  ['zone-6', 'Full Chain', 'zone', 6],
  ['survive-900', 'Fifteen-Minute Validator', 'tick', 54000],
  ['b2b-10', 'Difficulty Adjustment', 'maxBackToBack', 10],
  ['ranked-25', 'Practice Stacker', 'runs', 25],
].map(([id, title, field, threshold]) => Object.freeze({ id: 'stacked-' + id, title, field, threshold })));

export function completeFreeMedals(storage, run) {
  const empty = { newMedals: [], medals: [], total: 0, runs: 0, saved: false };
  if (run?.mode !== 'free' || run.assisted || !run.snapshot || typeof run.sessionId !== 'string' || !run.sessionId || run.sessionId.length > 128) return empty;
  try {
    const raw = storage.getItem(STACKED_FREE_MEDALS_KEY);
    if (raw && raw.length > 24000) return empty;
    const previous = raw ? JSON.parse(raw) : { version: 1, medals: [], runs: 0, sessions: [] };
    if (previous?.version !== 1 || !Array.isArray(previous.medals) || !Array.isArray(previous.sessions) || !Number.isSafeInteger(previous.runs) || previous.runs < 0) return empty;
    const earned = new Set(previous.medals.filter(id => FREE_MEDALS.some(medal => medal.id === id)));
    const sessions = previous.sessions.filter(id => typeof id === 'string' && id.length <= 128).slice(-128);
    const repeated = sessions.includes(run.sessionId);
    const runs = Math.min(1000000, previous.runs + (repeated ? 0 : 1));
    const values = { ...run.snapshot, spinClears: run.spinClears, zone: zoneForTick(run.snapshot.tick) + 1, runs };
    const newMedals = repeated ? [] : FREE_MEDALS.filter(medal => !earned.has(medal.id) && Number.isFinite(values[medal.field]) && values[medal.field] >= medal.threshold);
    for (const medal of newMedals) earned.add(medal.id);
    const medals = FREE_MEDALS.filter(medal => earned.has(medal.id));
    if (!repeated) {
      const encoded = JSON.stringify({ version: 1, medals: medals.map(medal => medal.id), runs, sessions: [...sessions, run.sessionId].slice(-128) });
      storage.setItem(STACKED_FREE_MEDALS_KEY, encoded);
      if (storage.getItem(STACKED_FREE_MEDALS_KEY) !== encoded) return empty;
    }
    return { newMedals, medals, total: medals.length, runs, saved: true };
  } catch { return empty; }
}
