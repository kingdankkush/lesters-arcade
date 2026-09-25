// The Ranked results screen's jackpot line (design §D.3), loaded by ranked-results.mjs for Chikun only
// while JACKPOT_LIVE. It compares the run with the jackpot's own provisional leader, never the board
// rank (the board also ranks staff, over-cap, late and chain-index rows):
//   - the run is jackpot-eligible (verified by the server, paid at least the week's minPaidWei in the
//     current week, survival within the week's cap) and at or above the leader's score:
//     "You'd lead this week's jackpot race (pending review)", and the share label
//     "Jackpot lead (pending)" (22 characters, the existing standingLabel; share-links.mjs unchanged);
//   - eligible and below: "{n} points behind the jackpot leader (provisional)";
//   - anything else, an unfunded or closed week, or a failed read: nothing.
// The leader can be up to 150 s stale, so a new record compares against the run's own score first.
import { currentPrize, fetchJackpot, jackpotEntryFor, phaseOf } from './jackpot-client.mjs';
import { ensureJackpotStylesheet, node } from './jackpot-view.mjs';

export const JACKPOT_LEAD_LABEL = 'Jackpot lead (pending)';
export const JACKPOT_LEAD_TEXT = "You'd lead this week's jackpot race (pending review)";
const VERIFIED_STATES = new Set(['queued', 'publishing', 'published']);

function wei(value) {
  try { return BigInt(String(value ?? '')); } catch { return null; }
}

// Pure: { text, label } or null.
export function jackpotStanding({ api, correctedNowMs, gameId, state, server, entry }) {
  const week = api?.live === true ? api.current : null;
  if (gameId !== 'chikun' || !week || !currentPrize(api) || phaseOf(week, correctedNowMs) !== 'open') return null;
  if (!VERIFIED_STATES.has(state) || !server || !Number.isSafeInteger(server.score)) return null;
  // The run's own eligibility: paid in this week, at least the week's minimum, within the survival cap.
  const seenAt = entry?.seenAtMs;
  if (!Number.isFinite(seenAt) || seenAt < Date.parse(week.startsAt) || seenAt >= Date.parse(week.closesAt)) return null;
  const paid = wei(entry.session?.entryReceipt?.amountWei);
  if (paid === null || paid < BigInt(week.rules.minPaidWei)) return null;
  const survival = server.contract?.survivalSeconds;
  if (!Number.isFinite(survival) || (week.rules.maxSurvivalSeconds > 0 && survival > week.rules.maxSurvivalSeconds)) return null;
  const leader = week.leader;
  if (!leader || server.score >= leader.score) return Object.freeze({ text: JACKPOT_LEAD_TEXT, label: JACKPOT_LEAD_LABEL });
  return Object.freeze({ text: `${(leader.score - server.score).toLocaleString('en-US')} points behind the jackpot leader (provisional)`, label: null });
}

// The loader's entry (ranked-results.mjs): positional, so the results chunk's glue stays small.
export default (mount, context, documentRef, fetchImpl, onChange) => createJackpotResultsLine({ mount, context, documentRef, fetchImpl, onChange });

export function createJackpotResultsLine({
  mount,
  context = {},
  documentRef = mount?.ownerDocument ?? globalThis.document,
  fetchImpl = globalThis.fetch,
  now = () => Date.now(),
  onChange = () => {},
} = {}) {
  const line = node(documentRef, 'p', 'rr-jackpot');
  line.setAttribute('role', 'status');
  line.hidden = true;
  mount?.append(line);
  ensureJackpotStylesheet(documentRef);
  let answer = null;
  let requested = false;
  let current = null;
  let last = { model: null, snapshot: null };

  function apply() {
    const next = answer ? jackpotStanding({
      api: answer.api,
      correctedNowMs: answer.clock.now(now()),
      gameId: last.model?.gameId ?? context.gameId,
      state: last.model?.state,
      server: last.snapshot?.server ?? null,
      entry: jackpotEntryFor(context.sessionId),
    }) : null;
    const changed = next?.text !== current?.text || next?.label !== current?.label;
    current = next;
    line.textContent = next?.text ?? '';
    line.hidden = !next;
    if (changed) onChange();
  }

  return Object.freeze({
    element: line,
    get label() { return current?.label ?? null; },
    get text() { return current?.text ?? null; },
    update(model, snapshot) {
      last = { model, snapshot };
      if (!requested) {
        requested = true;
        void fetchJackpot({ fetchImpl, now }).then((result) => { answer = result; apply(); });
      }
      if (answer) apply();
    },
  });
}
