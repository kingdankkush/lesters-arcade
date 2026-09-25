// Shared fixtures of the jackpot-server tests (tests/jackpot-server-*.test.mjs).
//
// Keys: Hardhat's public test mnemonic only (scripts/lib/local-chain.mjs and
// scripts/lib/local-jackpot.mjs); PGlite in memory; no network.

import { randomUUID } from 'node:crypto';
import { ethers } from 'ethers';

import { createCanonicalSessionIdentity } from '../../../apps/portal/src/session-integrity.mjs';
import { deriveRankedSeed } from '../../../apps/portal/src/session-seed.mjs';
import { canonicalSessionJson, sha256Hex } from '../../../apps/portal/src/session-integrity.mjs';
import { createChikunRuntime, simulateChikunRun } from '../../../apps/portal/src/chikun-cabinet.mjs';
import { routePilot } from '../../../scripts/chikun-course-pilot.mjs';
import { humanise, widenedView } from '../../../scripts/lib/chikun-evasion-pilots.mjs';
import { reverifyStoredRun } from '../../../server/verify/index.mjs';
import { issueSeedTicket } from '../../../server/verify/seed-ticket.mjs';
import { migrate } from '../../../server/neon/migrations.mjs';
import { periodKeysFor } from '../../../server/neon/period-keys.mjs';
import { INDEX_GAMES } from '../../../server/neon/rows.mjs';
import { upsertRules } from '../../../server/jackpot/store.mjs';
import { randomHex32 } from '../../helpers/pglite-client.mjs';

export const CHIKUN = INDEX_GAMES.chikun;
export const CHIKUN_BUILD_HASH = 'site-1.8.1:game-1.8.1:cabinet-0.9.0';
export const FIXTURE_SESSION_SECRET = `jackpot-fixture-${'5e'.repeat(16)}`;
export const MIN_PAID_WEI = '100000000000000000';
export const MIN_FUND_WEI = '100000000000000000000';
export const TOKEN = 10n ** 18n;

const migrated = new WeakSet();
export async function ensureMigrated(db) {
  if (migrated.has(db)) return;
  await migrate(db);
  migrated.add(db);
}

// The design §A.5 launch rules as a jackpot_rules row.
export function launchRulesRow({ fromWeek, adminClearOnly = false, maxPrizeWei = '0', minFundWei = MIN_FUND_WEI, minPaidWei = MIN_PAID_WEI, maxSurvivalSeconds = 3599, altSeasonId32 = null } = {}) {
  return { fromWeek, seasonId32: CHIKUN.seasonId32, altSeasonId32, minPaidWei, maxSurvivalSeconds, maxScore: '0', maxPrizeWei, minFundWei, adminClearOnly };
}

export async function seedRules(db, contract, rules) {
  await ensureMigrated(db);
  await upsertRules(db, { contract, rules });
}

// Flap evidence of a real (replayable) v6 run: 30 ticks, then `gap` ticks
// between flaps, `flaps` flaps, in a run of maxTicks.
export function flapEvidence({ seed, flapDeltas = null, flaps = 40, gap = 20, maxTicks = 216_000 } = {}) {
  return {
    version: 'chikun-flap-evidence-v6',
    seed,
    fixedStepHz: 60,
    maxTicks,
    flapDeltas: flapDeltas ?? Array.from({ length: flaps }, (_, index) => (index === 0 ? 30 : gap)),
  };
}

function iso(value) {
  return value === null || value === undefined ? null : new Date(value).toISOString();
}

// A short, human-like v6 run at the given seed: seeded irregular gaps (8-40 ticks),
// stock maxTicks, so it ends in a crash within a minute or so and trips no
// hold rule (entropy well over 3 bits, no fast pairs, too short for H6).
export function humanLikeEvidence(seed, { flaps = 60, rngSeed = 7 } = {}) {
  let state = (rngSeed ^ seed) >>> 0 || 1;
  const next = () => {
    state ^= state << 13; state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5; state >>>= 0;
    return state / 4294967296;
  };
  const ticks = [];
  for (let index = 0, tick = 20; index < flaps; index += 1, tick += 8 + Math.floor(next() * 33)) ticks.push(tick);
  // The canonical evidence keeps only the flaps applied before the crash.
  return simulateChikunRun({ seed, taps: ticks, maxTicks: 216_000 }).evidence;
}

// One Chikun Ranked row with stored evidence, as settle stores it: the
// canonical identity (with its sessionKey = session_id32), the canonical
// evidence text and digest. `replay: true` replays the evidence so the row's
// score, stats and contract fields are the real ones; otherwise the given
// numbers are stored as they are (selection tests).
export async function seedJackpotRun(db, overrides = {}) {
  await ensureMigrated(db);
  const wallet = String(overrides.wallet ?? `0x${'11'.repeat(20)}`).toLowerCase();
  const uuid = overrides.uuid ?? randomUUID();
  const sessionHandle = `game-session-${uuid}`;
  const openedAt = iso(overrides.openedAt ?? '2026-09-30T10:00:00.000Z');
  const registry = String(overrides.registry ?? `0x${'c5'.repeat(20)}`).toLowerCase();
  const buildHash = overrides.buildHash ?? CHIKUN_BUILD_HASH;
  const seasonId = overrides.seasonId ?? CHIKUN.seasonId;
  let seed = overrides.seed ?? 12345;
  let ticket = null;
  if (overrides.ticket) {
    const issued = await issueSeedTicket({
      secret: overrides.secret ?? FIXTURE_SESSION_SECRET,
      nowMs: Date.parse(overrides.ticketIssuedAt ?? openedAt) - (overrides.ticketIssuedAt ? 0 : 60_000),
      sessionId: sessionHandle, wallet, gameId: 'chikun', seasonId, buildHash,
    });
    ticket = issued.seedTicket;
    seed = issued.seed;
  }
  const identity = await createCanonicalSessionIdentity({ sessionId: sessionHandle, chainId: 4441, scoreRegistryAddress: registry, wallet, gameId: 'chikun', seasonId, buildHash, seed, nonce: uuid });
  const evidence = overrides.evidence ?? (typeof overrides.evidenceFor === 'function' ? overrides.evidenceFor(seed) : flapEvidence({ seed, ...(overrides.evidenceOptions ?? {}) }));
  let score = overrides.score ?? 1000;
  let survivalSeconds = overrides.survivalSeconds ?? 120;
  let kills = overrides.kills ?? 0;
  let maxCombo = overrides.maxCombo ?? 0;
  let stats = overrides.stats ?? { score, survivalSeconds, nearMisses: 0, flapCount: evidence.flapDeltas.length, terminalReason: 'forest', forksPassed: 10 };
  let envelopeHash = overrides.envelopeHash ?? randomHex32();
  if (overrides.replay) {
    // Exactly what settle stores: the real verifier's VerifiedRun.
    const fresh = await reverifyStoredRun({ gameId: 'chikun', identity, evidence: { encoding: 'chikun-flap-evidence-v6+json', text: canonicalSessionJson(evidence) } });
    if (!fresh.ok) throw new Error(`fixture evidence does not verify: ${fresh.error}`);
    score = fresh.score;
    survivalSeconds = fresh.contract.survivalSeconds;
    kills = fresh.contract.kills;
    maxCombo = fresh.contract.maxCombo;
    stats = fresh.stats;
    envelopeHash = overrides.envelopeHash ?? fresh.envelopeHash;
  }
  // The chain side of the same run (the cron tests): open and settle it on
  // the in-process chain at the given times, with the replayed fields.
  // It may answer { confirmedAt } (the publishing block's time, unix ms).
  let chainFacts = {};
  if (typeof overrides.beforeInsert === 'function') {
    chainFacts = (await overrides.beforeInsert({ identity, sessionId32: identity.sessionKey, wallet, fields: { score, kills, maxCombo, survivalSeconds }, openedAt })) ?? {};
  }
  const verifiedAt = iso(overrides.verifiedAt ?? Date.parse(openedAt) + survivalSeconds * 1000 + 30_000);
  const status = overrides.status ?? 'confirmed';
  const confirmedAt = chainFacts.confirmedAt !== undefined ? iso(chainFacts.confirmedAt)
    : Object.hasOwn(overrides, 'confirmedAt') ? iso(overrides.confirmedAt) : (status === 'confirmed' ? iso(Date.parse(verifiedAt) + 30_000) : null);
  const keys = periodKeysFor(Date.parse(openedAt));
  const sessionId32 = overrides.sessionId32 ?? identity.sessionKey;
  await db.query(
    `INSERT INTO verified_sessions (session_id32, session_handle, wallet, game_id, season_id, runtime_id, build_hash, seed,
        score, kills, max_combo, survival_seconds, boss_id, stats, envelope_hash, day_key, week_key, month_key, status, source,
        tx_hash, block_number, verified_at, confirmed_at, opened_at, entry_amount_wei, chain_mismatch)
     VALUES ($1,$2,$3,'chikun',$4,$5,$6,$7::bigint,$8::bigint,$9::bigint,$10::bigint,$11::bigint,NULL,$12::jsonb,$13,$14,$15,$16,$17,$18,
        $19,$20::bigint,$21::timestamptz,$22::timestamptz,$23::timestamptz,$24,$25::boolean)`,
    [sessionId32, sessionHandle, wallet, seasonId, overrides.runtimeId ?? CHIKUN.runtimeId, buildHash, String(seed), String(score), String(kills),
      String(maxCombo), String(survivalSeconds), JSON.stringify(stats), envelopeHash, keys.day, keys.week, keys.month, status,
      overrides.source ?? 'settle', ['confirmed', 'submitted'].includes(status) ? (overrides.txHash ?? randomHex32()) : null, status === 'confirmed' ? '100' : null,
      verifiedAt, confirmedAt, openedAt, Object.hasOwn(overrides, 'entryAmountWei') ? overrides.entryAmountWei : '102000000000000000',
      overrides.chainMismatch ? 'true' : 'false'],
  );
  if (overrides.withEvidence !== false) {
    const text = canonicalSessionJson(evidence);
    await db.query(
      `INSERT INTO session_evidence (session_id32, encoding, evidence, evidence_bytes, evidence_digest, identity)
       VALUES ($1, 'chikun-flap-evidence-v6+json', $2, $3::int, $4, $5::jsonb)`,
      [sessionId32, text, String(Buffer.byteLength(text)), await sha256Hex(evidence), JSON.stringify(identity)],
    );
  }
  return { sessionId32, sessionHandle, wallet, identity, evidence, seed, score, survivalSeconds, openedAt, verifiedAt, confirmedAt, ticket, buildHash, seasonId, kills, maxCombo, stats, envelopeHash };
}

// A ticket-log row as server/settle/seed.mjs writes it (logSeedTicket).
export async function seedTicketRow(db, { wallet, sessionHandle, seasonId = CHIKUN.seasonId, buildHash = CHIKUN_BUILD_HASH, ticket, weekKey }) {
  await db.query(
    `INSERT INTO seed_ticket_log (mac, wallet, session_handle, game_id, season_id, build_hash, salt, issued_at, week_key)
     VALUES ($1, $2, $3, 'chikun', $4, $5, $6, to_timestamp($7::double precision), $8)`,
    [ticket.mac, wallet, sessionHandle, seasonId, buildHash, ticket.salt, String(ticket.issuedAt), weekKey],
  );
}

export async function seedDerivedSeed({ sessionHandle, wallet, seasonId = CHIKUN.seasonId, buildHash = CHIKUN_BUILD_HASH, salt }) {
  return deriveRankedSeed({ sessionId: sessionHandle, wallet, gameId: 'chikun', seasonId, buildHash, salt });
}

export { ethers };

// A longer human-like run at the given seed whose score grows with
// `untilTick`: the naively humanised routePilot on the stock landscape view
// (scripts/lib/chikun-evasion-pilots.mjs) flies until `untilTick`, then stops
// flapping and crashes. Keep untilTick at or above 1,800 (a shorter run can
// trip H5) and under 3 minutes (10,800 ticks, H6).
export function pilotCutEvidence(seed, { untilTick = 3600 } = {}) {
  const pilot = humanise(widenedView(routePilot, { widen: 1, delay: 8 }), { seed, label: 'fixture' });
  const runtime = createChikunRuntime({ seed, maxTicks: 216_000 });
  while (!runtime.terminal) {
    const snapshot = runtime.snapshot();
    runtime.step({ flap: snapshot.tick < untilTick ? pilot(snapshot) : false });
  }
  return runtime.result().evidence;
}
