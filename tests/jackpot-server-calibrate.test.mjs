import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  CALIBRATION_VERSION, FIXTURE_PATHS, HUMAN_GATE, clopperPearsonUpper, parseCalibrateArgs, parseVouched, playDecider, runCalibration,
} from '../scripts/chikun-plausibility-calibrate.mjs';
import { pilotFor } from '../scripts/chikun-difficulty-harness.mjs';
import { EVASION_PILOTS, HUMAN_MIN_PRESS_GAP_TICKS } from '../scripts/lib/chikun-evasion-pilots.mjs';
import { createPgliteClient } from './helpers/pglite-client.mjs';
import { humanLikeEvidence, seedJackpotRun } from './fixtures/jackpot-server/helpers.mjs';

/**
 * jackpot-server AC17 (design §B.4, §C.8): the calibration tool re-runs every
 * hold rule over the named populations. Set (a) (the scripted pilots, the
 * solver, a truncated client and late evidence) is gated at 100% held; set
 * (b) (the humanised solver and the widened-view pilot) is REPORTED, a miss
 * being expected; the bot human models show the H4-H6 separation of B.4;
 * unvouched Neon rows never enter a gate denominator and no wallet reaches
 * the receipt. Pilot inputs are capped at 3 minutes to keep the file fast, the solver's included: the
 * suite's one 60-minute (H1) replay of the committed solver fixture is in jackpot-server-screen.test.mjs.
 */

const MODELS = JSON.parse(readFileSync(new URL(`../${FIXTURE_PATHS.botModels}`, import.meta.url), 'utf8')).runs;
const VOUCHED = `0x${'a1'.repeat(20)}`;
const STRANGER = `0x${'b2'.repeat(20)}`;

test('calibration tool gates the must-hold set and reports the known-evasion set', async () => {
  const humanDir = mkdtempSync(join(tmpdir(), 'chikun-human-calibration-'));
  const db = createPgliteClient();
  try {
    // Set (c) from files: one replay-file-v1, one bare evidence file, one broken file.
    writeFileSync(join(humanDir, 'person-a-landscape-1.json'), JSON.stringify({ format: 'chikun-replay-file-v1', game: 'chikun', evidence: MODELS[0].evidence }));
    writeFileSync(join(humanDir, 'person-b-portrait-1.json'), JSON.stringify(MODELS[2].evidence));
    writeFileSync(join(humanDir, 'broken.json'), '{"format":"chikun-replay-file-v1","game":"chikun","evidence":{"version":"nope"}}');
    // Set (c) from Neon: one vouched wallet and one stranger (reported apart, never gated).
    await seedJackpotRun(db, { wallet: VOUCHED, seed: 4242, evidence: humanLikeEvidence(4242), replay: false });
    await seedJackpotRun(db, { wallet: STRANGER, seed: 4343, evidence: humanLikeEvidence(4343), replay: false });

    const solver = { evidence: playDecider(pilotFor('routePilotFullSnapshot'), { seed: 1, capTicks: 3 * 3600 }).evidence, source: 'test: inputs capped at 3 min' };
    const receipt = await runCalibration({ probe: true, capMinutes: 3, pilotSeeds: [1], humanDir, fromNeon: true, db, vouched: new Set([VOUCHED]), nowMs: Date.parse('2026-09-25T12:00:00.000Z'), solver });
    assert.equal(receipt.version, CALIBRATION_VERSION);

    // (a) must-hold: 100% held, each for the reason B.4 gives.
    const a = receipt.sets.a;
    assert.deepEqual([a.gated, a.pass, a.held, a.n], [true, true, a.n, 5]);
    const codesOf = (prefix) => a.runs.find((run) => run.label.startsWith(prefix)).codes;
    for (const pilot of ['routePilotLandscape', 'routePilotPortrait', 'routePilotFullSnapshot']) {
      assert.ok(codesOf(pilot).some((code) => ['H4', 'H5', 'H6'].includes(code)), `${pilot} holds on H4-H6 (${codesOf(pilot)})`);
      assert.ok(codesOf(pilot).includes('H5'), `${pilot} is machine-regular`);
    }
    assert.equal(a.runs.find((run) => run.label.startsWith('routePilotFullSnapshot')).source, 'test: inputs capped at 3 min', 'no second 60-minute replay');
    assert.ok(codesOf('truncated client').includes('H7'), 'a non-stock maxTicks is an integrity hold');
    assert.deepEqual(codesOf('late evidence'), ['H9'], 'late evidence alone');

    // The B.4 separation on H4-H6: the bot human models never hold on them.
    const models = receipt.probe.find((population) => population.name.startsWith('Bot "human models"'));
    assert.equal(models.n, MODELS.length);
    for (const rule of ['H4', 'H5', 'H6']) assert.equal(models.holdsByRule[rule].holds, 0, `models on ${rule}`);
    assert.deepEqual(models.fastPairs, [0, 0]);
    assert.ok(models.minDelta[0] >= 6 && models.entropyBits[0] > 4 && models.topShare[1] < 0.3, JSON.stringify(models));
    const scripted = receipt.probe.find((population) => population.name.startsWith('Scripted pilots'));
    assert.equal(scripted.holdsByRule.H5.holds, scripted.n);

    // (b) known evasion: reported with miss rates, never gated (a miss is expected, not a failure).
    const b = receipt.sets.b;
    assert.equal(b.gated, false);
    assert.ok(b.n >= 2);
    assert.equal(typeof b.missRate, 'number');
    assert.deepEqual(Object.keys(b.byPilot), ['exceptional bot', 'humanisedSolver', 'widenedViewPilot']);
    for (const name of Object.keys(EVASION_PILOTS)) assert.ok(b.byPilot[name].n >= 1, name);
    for (const run of b.runs) assert.ok(run.features.minDelta >= HUMAN_MIN_PRESS_GAP_TICKS && run.features.fastPairs === 0, `${run.label} is humanised`);
    const widened = b.runs.find((run) => run.label.startsWith('widenedViewPilot'));
    assert.ok(widened.features.unexplainedDescents >= 2, 'S8 sees the widened view (the H11 input) even when the run is missed');

    // (c) human: files and vouched Neon rows only; the stranger is reported apart.
    const c = receipt.sets.c;
    assert.deepEqual([c.n, c.fromDir, c.fromNeonVouched, c.rejectedFiles.length], [3, 2, 1, 1]);
    assert.equal(receipt.sets.neonUnvouched.n, 1);
    assert.equal(receipt.sets.neonUnvouched.note.includes('Never in a gate denominator'), true);
    assert.equal(c.holdsByRule.H4.upper95, clopperPearsonUpper(c.holdsByRule.H4.holds, 3));
    assert.equal(c.runs.find((run) => run.label.includes('portrait')).orientation, 'portrait');
    // Not ready: the human set is far below 40 runs; the note says so.
    assert.equal(receipt.gate.setAAllHeld, true);
    assert.equal(receipt.gate.ready, false);
    assert.match(receipt.gate.notes.join(' '), /The human set is incomplete \(3 of 40 runs/);
    const text = JSON.stringify(receipt);
    for (const wallet of [VOUCHED, STRANGER]) assert.equal(text.includes(wallet.slice(2)), false, 'no wallet in the receipt');
    assert.doesNotMatch(text, /postgres|NEON_DATABASE_URL=/);
  } finally {
    rmSync(humanDir, { recursive: true, force: true });
    await db.close();
  }
});

test('calibration statistics, vouched lists and arguments', () => {
  // One-sided Clopper-Pearson 95%: 0 of 40 still allows about 7%.
  const zero = clopperPearsonUpper(0, 40);
  assert.ok(zero > 0.07 && zero < 0.075, String(zero));
  assert.equal(zero, Number((1 - 0.05 ** (1 / 40)).toFixed(4)));
  assert.ok(clopperPearsonUpper(1, 40) > zero);
  assert.deepEqual([clopperPearsonUpper(5, 5), clopperPearsonUpper(0, 0)], [1, null]);
  assert.deepEqual(HUMAN_GATE, { minRuns: 40, minLongRuns: 15, longRunMinutes: 8, minPeople: 5, zeroHoldRules: ['H4', 'H5', 'H6'] });

  assert.deepEqual([...parseVouched(JSON.stringify([VOUCHED.toUpperCase().replace('0X', '0x')]))], [VOUCHED]);
  assert.deepEqual([...parseVouched(JSON.stringify({ wallets: [VOUCHED, STRANGER] }))], [VOUCHED, STRANGER]);
  assert.deepEqual([...parseVouched(`# owner-vouched\n${VOUCHED}\n\n${STRANGER}\n`)], [VOUCHED, STRANGER]);
  assert.throws(() => parseVouched('not-an-address'), /not an address/);

  assert.deepEqual(parseCalibrateArgs(['--probe', '--bots', '4', '--cap-minutes', '3', '--no-write']).bots, 4);
  for (const argv of [['--vouched', 'x.json'], ['--bots', '-1'], ['--cap-minutes', '0'], ['--nope'], ['--out']]) assert.throws(() => parseCalibrateArgs(argv), JSON.stringify(argv));
});
