// Drives the real weekly-jackpot cron handler on the in-process chain with a
// PGlite database (jackpot-server API and profile tests): plays Ranked runs
// the way settle stores them, moves the chain and server clocks together,
// and walks a week to paid.

import assert from 'node:assert/strict';
import * as cronApi from '../../../api/cron/weekly-jackpot.mjs';
import { setChainTime } from '../../../scripts/lib/local-jackpot.mjs';
import { readWeekRow } from '../../../server/jackpot/store.mjs';
import { weekKeyOfIndex } from '../../../server/jackpot/weeks.mjs';
import { invoke } from '../../helpers/fake-http.mjs';
import { fixtureEnv, SETTLE_CRON_VALUE, SETTLE_SESSION_VALUE } from '../../helpers/settle-fixtures.mjs';
import { DAY, HOUR } from './chain-harness.mjs';
import { pilotCutEvidence, seedJackpotRun, seedTicketRow } from './helpers.mjs';

export function createCronDriver(h, db) {
  const d = { h, db, clockMs: 0, contract: h.contract, jackpotDeployment: h.jackpotDeployment };
  d.env = (extra = {}) => fixtureEnv({ registry: h.deployment.addresses.scoreSubmissionRegistry, extra: { JACKPOT_KEEPER_PRIVATE_KEY: h.keeperKey, JACKPOT_CONTRACT_ADDRESS: d.contract, ...extra } });
  d.overrides = (extra = {}) => ({
    db, provider: h.provider, deployment: h.deployment, jackpotDeployment: d.jackpotDeployment, nowMs: () => d.clockMs,
    fetchImpl: async () => { throw Object.assign(new Error('offline'), { code: 'ENOTFOUND' }); }, ...extra,
  });
  d.advance = async (seconds) => {
    const latest = (await h.provider.getBlock('latest')).timestamp;
    if (seconds > latest) await setChainTime(h.provider, seconds);
    d.clockMs = Math.max(seconds, latest) * 1000;
  };
  d.cron = async (extraEnv = {}) => invoke(cronApi.createHandler(() => cronApi.buildDeps(d.env(extraEnv), d.overrides({ fundingLookup: null }))), { url: '/api/cron/weekly-jackpot', headers: { authorization: `Bearer ${SETTLE_CRON_VALUE}` } });
  d.week = (index) => readWeekRow(db, { contract: d.contract, weekKey: weekKeyOfIndex(index) });
  d.play = async (player, { openAt, untilTick = 3600, weekIndex }) => {
    const run = await seedJackpotRun(db, {
      wallet: player.address, openedAt: openAt * 1000, ticket: true, replay: true, secret: SETTLE_SESSION_VALUE,
      registry: h.deployment.addresses.scoreSubmissionRegistry, evidenceFor: (seed) => pilotCutEvidence(seed, { untilTick }),
      beforeInsert: async ({ sessionId32, fields }) => {
        const done = await h.settle({ player, sessionId: sessionId32, score: BigInt(fields.score), survivalSeconds: BigInt(fields.survivalSeconds), kills: BigInt(fields.kills), maxCombo: BigInt(fields.maxCombo), openAt, settleAt: openAt + fields.survivalSeconds + 60 });
        return { confirmedAt: done.submittedAt * 1000 };
      },
    });
    await seedTicketRow(db, { wallet: run.wallet, sessionHandle: run.sessionHandle, ticket: run.ticket, weekKey: weekKeyOfIndex(weekIndex) });
    return run;
  };
  // Runs the cron every 5 minutes until `predicate` holds.
  d.until = async (predicate, max = 4) => {
    for (let n = 0; n < max; n += 1) {
      // eslint-disable-next-line no-await-in-loop
      const response = await d.cron();
      assert.equal(response.status, 200, JSON.stringify(response.body));
      // eslint-disable-next-line no-await-in-loop
      if (await predicate()) return n + 1;
      // eslint-disable-next-line no-await-in-loop
      await d.advance(Math.floor(d.clockMs / 1000) + 300);
    }
    throw new Error('the cron did not reach the expected state');
  };
  // From the close of `index` to paid (the leader must pass the screen).
  d.walkToPaid = async (index) => {
    const bounds = h.bounds(index);
    await d.advance(bounds.close + 2 * HOUR + 60);
    await d.until(async () => (await d.week(index)).status === 'selecting' && (await h.jackpot.candidatesOf(index)).length > 0 && await pendingDone(index), 5);
    await d.advance(bounds.settleCutoff + 11 * 60);
    await d.until(async () => (await d.week(index)).status === 'review');
    await d.advance(bounds.payoutAt + 60);
    await d.until(async () => ['paid', 'claim-pending'].includes((await d.week(index)).status), 4);
  };
  async function pendingDone(index) {
    const rows = await db.query("SELECT count(*)::int AS n FROM jackpot_actions WHERE week_key = $1 AND status IN ('pending', 'signed', 'submitted', 'failed')", [weekKeyOfIndex(index)]);
    return Number(rows[0].n) === 0;
  }
  d.DAY = DAY;
  d.HOUR = HOUR;
  return d;
}
