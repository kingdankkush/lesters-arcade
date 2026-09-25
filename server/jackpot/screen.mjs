// The jackpot screen of one candidate (design §B.3 item 2, §B.4, §C.4
// "Screen"). → { result, codes, features, soft, timeline, integrity,
// provenance, eligibility }
//
//   1. the Neon row and its stored evidence (readStoredEvidence);
//   2. reverifyStoredRun, then the jackpot-local copy of settle's sameRun
//      (it is module-private in server/settle/attestation.mjs);
//   3. the chain cross-check through the jackpot-local full getSession
//      decoder and getPaidSession, plus checkEligibility on the jackpot;
//   4. the stock-client check (maxTicks === 216,000) and the seed-provenance
//      check against seed_ticket_log (the MAC recomputed with SESSION_SECRET,
//      the seed re-derived, issuedAt inside the A26 bounds);
//   5. features and hold rules H1-H11 (plausibility.mjs);
//   6. soft signals S1-S11;
//   7. the review timeline.
//
// result: 'integrity-fail' (H7: flag 'integrity'), 'hold' (flag with a
// reason), 'pass' (clear), or 'error' (infrastructure: RPC, the verifier, the
// secret; the row stays pending and is retried, and is NEVER flagged).

import { createHmac, timingSafeEqual } from 'node:crypto';
import { ethers } from 'ethers';
import { deriveRankedSeed } from '../../apps/portal/src/session-seed.mjs';
import { isoSql } from '../neon/queries.mjs';
import { INDEX_GAMES, parseJsonText } from '../neon/rows.mjs';
import { readStoredEvidence } from '../settle/store.mjs';
import { seedTicketMacInput } from '../verify/seed-ticket.mjs';
import { classifyJackpotError } from './errors.mjs';
import {
  analyzeChikunEvidence, computeFeatures, flagReasonFor, holdCodes, pureSoftSignals, reviewTimeline, STOCK_MAX_TICKS, THRESHOLDS,
} from './plausibility.mjs';
import { countWalletTickets, readSessionTickets } from './ticket-log.mjs';
import { weekIndexOf } from './weeks.mjs';

export const TICKET_EARLY_SECONDS = 120; // openedAt >= issuedAt - 120 (A26)
export const TICKET_LATE_SECONDS = 1800; // openedAt <= issuedAt + 1800 (A26)
export const S10_TIME_BUDGET_MS = 10_000;
const CHIKUN = INDEX_GAMES.chikun;

// The jackpot-local copy of settle's sameRun (server/settle/attestation.mjs,
// module-private there). tests/jackpot-server-screen.test.mjs pins its parity
// with the re-sign rule's behaviour.
export function sameRun(fresh, row) {
  return fresh.sessionId32 === row.sessionId32
    && String(fresh.wallet).toLowerCase() === row.wallet
    && fresh.gameId === row.gameId
    && fresh.seasonId === row.seasonId
    && fresh.runtimeId === row.runtimeId
    && Number(fresh.score) === Number(row.score)
    && Number(fresh.contract?.kills) === Number(row.kills)
    && Number(fresh.contract?.maxCombo) === Number(row.maxCombo)
    && Number(fresh.contract?.survivalSeconds) === Number(row.survivalSeconds)
    && (fresh.contract?.bossId ?? null) === (row.bossId ?? null)
    && String(fresh.envelopeHash).toLowerCase() === row.envelopeHash;
}

// Everything the screen reads of one verified_sessions row, with the board
// exclusion (A15: text, int4 and bool only).
export async function readScreenRow(db, sessionId32) {
  const rows = await db.query(
    `SELECT vs.session_id32, vs.session_handle, vs.wallet, vs.game_id, vs.season_id, vs.runtime_id, vs.build_hash, vs.seed::text AS seed,
            vs.score::text AS score, vs.kills::text AS kills, vs.max_combo::text AS max_combo, vs.survival_seconds::text AS survival_seconds,
            vs.boss_id, vs.stats::text AS stats, vs.envelope_hash, vs.status, vs.source, vs.chain_mismatch, vs.entry_amount_wei, vs.week_key,
            ${isoSql('vs.opened_at')} AS opened_at, ${isoSql('vs.verified_at')} AS verified_at, ${isoSql('vs.confirmed_at')} AS confirmed_at,
            coalesce(wp.board_excluded, false) AS board_excluded
     FROM verified_sessions vs LEFT JOIN wallet_profiles wp ON wp.wallet = vs.wallet
     WHERE vs.session_id32 = $1`,
    [String(sessionId32).toLowerCase()],
  );
  const raw = rows[0];
  if (!raw) return null;
  return {
    sessionId32: raw.session_id32,
    sessionHandle: raw.session_handle ?? null,
    wallet: raw.wallet,
    gameId: raw.game_id,
    seasonId: raw.season_id,
    runtimeId: raw.runtime_id,
    buildHash: raw.build_hash ?? null,
    seed: raw.seed === null || raw.seed === undefined ? null : Number(raw.seed),
    score: Number(raw.score),
    kills: Number(raw.kills),
    maxCombo: Number(raw.max_combo),
    survivalSeconds: Number(raw.survival_seconds),
    bossId: raw.boss_id ?? null,
    stats: parseJsonText(raw.stats, {}),
    envelopeHash: raw.envelope_hash,
    status: raw.status,
    source: raw.source,
    chainMismatch: raw.chain_mismatch === true,
    entryAmountWei: raw.entry_amount_wei ?? null,
    weekKey: raw.week_key,
    openedAt: raw.opened_at ?? null,
    verifiedAt: raw.verified_at ?? null,
    confirmedAt: raw.confirmed_at ?? null,
    boardExcluded: raw.board_excluded === true,
  };
}

// The seed-provenance check (design §B.3): a logged ticket whose MAC
// recomputes with SESSION_SECRET, whose salt re-derives the stored identity's
// seed, and whose issuedAt bounds openedAt (A26). → { status, ... }
//   'ok' | 'missing' (H10) | 'invalid' (integrity) ; throws when no secret.
export async function checkSeedProvenance(db, { row, identity, openedAtSeconds, secret }) {
  const key = typeof secret === 'function' ? secret() : secret;
  if (typeof key !== 'string' || key.length < 32) throw Object.assign(new Error('session secret unavailable'), { code: 'SECRET_UNAVAILABLE' });
  const handle = identity?.sessionId ?? row.sessionHandle;
  const tickets = await readSessionTickets(db, { wallet: row.wallet, sessionHandle: handle, gameId: row.gameId, seasonId: identity?.seasonId ?? row.seasonId, buildHash: identity?.buildHash ?? row.buildHash });
  if (!tickets.length) return { status: 'missing', tickets: 0 };
  const expectedSeed = Number(identity?.seed ?? row.seed);
  let macValid = false;
  for (const ticket of tickets) {
    const fields = { sessionId: handle, wallet: row.wallet, gameId: row.gameId, seasonId: ticket.seasonId, buildHash: ticket.buildHash, salt: ticket.salt, issuedAt: ticket.issuedAtSeconds };
    const expected = Buffer.from(createHmac('sha256', key).update(seedTicketMacInput(fields), 'utf8').digest('hex'), 'hex');
    const stored = Buffer.from(ticket.mac, 'hex');
    if (expected.length !== stored.length || !timingSafeEqual(expected, stored)) continue;
    macValid = true;
    // eslint-disable-next-line no-await-in-loop
    const seed = await deriveRankedSeed({ sessionId: handle, wallet: row.wallet, gameId: row.gameId, seasonId: ticket.seasonId, buildHash: ticket.buildHash, salt: ticket.salt });
    if (seed !== expectedSeed) continue;
    const inBounds = Number.isFinite(openedAtSeconds)
      && openedAtSeconds >= ticket.issuedAtSeconds - TICKET_EARLY_SECONDS && openedAtSeconds <= ticket.issuedAtSeconds + TICKET_LATE_SECONDS;
    return inBounds
      ? { status: 'ok', tickets: tickets.length, issuedAt: ticket.issuedAt, ticketToPaySeconds: openedAtSeconds - ticket.issuedAtSeconds }
      : { status: 'invalid', detail: 'issued-at', tickets: tickets.length, issuedAt: ticket.issuedAt, ticketToPaySeconds: openedAtSeconds - ticket.issuedAtSeconds };
  }
  return { status: 'invalid', detail: macValid ? 'seed' : 'mac', tickets: tickets.length };
}

// The chain cross-check (design §B.3): the on-chain record and paid entry
// must match the Neon row. → { ok, code?, facts }
export function crossCheck({ row, record, paid, weekIndex, minPaidWei }) {
  const facts = {
    exists: record.exists, verified: record.verified, player: record.player, openedAt: paid.openedAt, amountWei: paid.amountWei.toString(),
    week: paid.exists ? weekIndexOf(paid.openedAt) : null, submittedAt: record.submittedAt,
  };
  const checks = [
    record.exists && record.verified,
    record.player === row.wallet,
    record.gameId32 === CHIKUN.gameId32,
    record.seasonId32 === ethers.id(row.seasonId).toLowerCase(),
    record.runtimeId32 === ethers.id(row.runtimeId).toLowerCase(),
    record.score === BigInt(row.score),
    record.kills === row.kills && record.maxCombo === row.maxCombo && record.survivalSeconds === row.survivalSeconds,
    paid.exists && paid.player === row.wallet && paid.gameId32 === CHIKUN.gameId32,
    paid.exists && weekIndexOf(paid.openedAt) === Number(weekIndex),
    paid.amountWei >= BigInt(minPaidWei ?? 0),
    !row.openedAt || Math.floor(Date.parse(row.openedAt) / 1000) === paid.openedAt,
  ];
  return { ok: checks.every(Boolean), failed: checks.map((ok, index) => (ok ? null : index)).filter((index) => index !== null), facts };
}

// The funding lookup of S10: the first address that sent zkLTC to a wallet,
// through the LiteForge explorer's Etherscan-compatible API. Best effort:
// every call has a timeout, and any failure makes S10 null.
export function createFundingLookup({ fetchImpl = globalThis.fetch, baseUrl = 'https://liteforge.explorer.caldera.xyz', timeoutMs = 8_000 } = {}) {
  return async function firstFunder(wallet) {
    const url = `${baseUrl}/api?module=account&action=txlist&address=${String(wallet).toLowerCase()}&sort=asc&page=1&offset=10`;
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = setTimeout(() => controller?.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, { headers: { accept: 'application/json' }, signal: controller?.signal });
      if (!response?.ok) throw Object.assign(new Error('explorer'), { code: 'SERVER_ERROR' });
      const body = await response.json();
      const list = Array.isArray(body?.result) ? body.result : [];
      const first = list.find((tx) => String(tx?.to ?? '').toLowerCase() === String(wallet).toLowerCase() && BigInt(tx?.value ?? 0) > 0n);
      return first ? String(first.from).toLowerCase() : null;
    } finally {
      clearTimeout(timer);
    }
  };
}

// S10: other candidate or flagged wallets of the last 8 weeks that got their
// first zkLTC from the same address within 2 hops. At most 20 lookups per
// candidate and a 10 s budget; null on any failure (never a verdict).
export async function crossWalletFunding(db, { wallet, weekKeys, firstFunder, maxCalls = THRESHOLDS.S10.maxCalls, budgetMs = S10_TIME_BUDGET_MS, cache = new Map() }) {
  if (typeof firstFunder !== 'function') return null;
  const started = Date.now();
  let calls = 0;
  const lookup = async (address) => {
    if (cache.has(address)) return cache.get(address);
    if (calls >= maxCalls || Date.now() - started > budgetMs) throw Object.assign(new Error('s10 budget'), { code: 'BUDGET' });
    calls += 1;
    const funder = await firstFunder(address);
    cache.set(address, funder);
    return funder;
  };
  const chainOf = async (address) => {
    const out = [];
    let current = address;
    for (let hop = 0; hop < THRESHOLDS.S10.hops && current; hop += 1) {
      // eslint-disable-next-line no-await-in-loop
      current = await lookup(current);
      if (current) out.push(current);
    }
    return out;
  };
  try {
    const rows = await db.query(
      `SELECT DISTINCT wallet FROM jackpot_candidates
       WHERE wallet <> $1 AND (week_key IN (SELECT jsonb_array_elements_text($2::jsonb)) OR review IN ('flagged', 'disqualified'))
       ORDER BY wallet LIMIT 50`,
      [wallet, JSON.stringify(weekKeys)],
    );
    const mine = new Set(await chainOf(wallet));
    if (!mine.size) return { on: false, matches: [], calls };
    const matches = [];
    for (const { wallet: other } of rows) {
      if (calls >= maxCalls) break;
      // eslint-disable-next-line no-await-in-loop
      const theirs = await chainOf(other);
      if (theirs.some((funder) => mine.has(funder))) matches.push(other);
    }
    return { on: matches.length > 0, matches, calls };
  } catch {
    return null;
  }
}

async function neonSoftSignals(db, { row, weekKey, nowMs }) {
  const [[first], [previous], [weekly], [flagged]] = await Promise.all([
    db.query(`SELECT ${isoSql('min(coalesce(opened_at, verified_at))')} AS first_at FROM verified_sessions WHERE wallet = $1`, [row.wallet]),
    db.query(
      `SELECT count(*)::int AS runs, coalesce(max(score), 0)::text AS best FROM verified_sessions
       WHERE wallet = $1 AND game_id = 'chikun' AND status = 'confirmed' AND session_id32 <> $2 AND coalesce(opened_at, verified_at) < $3::timestamptz`,
      [row.wallet, row.sessionId32, row.openedAt ?? row.verifiedAt],
    ),
    db.query("SELECT count(*)::int AS runs FROM verified_sessions WHERE wallet = $1 AND game_id = 'chikun' AND week_key = $2 AND status <> 'pending'", [row.wallet, weekKey]),
    db.query("SELECT count(*)::int AS n FROM jackpot_candidates WHERE wallet = $1 AND session_id32 <> $2 AND review IN ('flagged', 'disqualified')", [row.wallet, row.sessionId32]),
  ]);
  const firstMs = Date.parse(first?.first_at ?? '');
  const ageSeconds = Number.isFinite(firstMs) ? Math.round((Number(nowMs) - firstMs) / 1000) : null;
  const runs = Number(previous?.runs ?? 0);
  const best = Number(previous?.best ?? 0);
  const tickets = await countWalletTickets(db, { wallet: row.wallet, weekKey });
  const settled = Number(weekly?.runs ?? 0);
  return {
    S1: { value: ageSeconds, on: ageSeconds !== null && ageSeconds < THRESHOLDS.S1 },
    S2: { value: { previousBest: best, earlierRuns: runs }, on: runs >= THRESHOLDS.S2.minRuns && best > 0 && row.score > THRESHOLDS.S2.ratio * best },
    S3: { value: settled, on: settled > THRESHOLDS.S3 },
    S7: { value: Number(flagged?.n ?? 0), on: Number(flagged?.n ?? 0) > 0 },
    S11: { value: settled > 0 ? Math.round((tickets / settled) * 100) / 100 : tickets, tickets, settledRuns: settled, on: false },
  };
}

function integrityFail(code, extra = {}) {
  return { ok: false, code, ...extra };
}

// Screens one candidate. `chain` is createJackpotChain(); `verify` is the
// verify module (reverifyStoredRun). Never throws for an infrastructure
// fault: it answers result 'error' with an allowlisted code.
export async function screenCandidate({
  db, chain, verify, secret, candidate, weekIndex, weekKey, rules, nowMs = Date.now(), h11Active = false,
  firstFunder = null, fundingCache = new Map(), recentWeekKeys = [], orientation = 'landscape',
}) {
  const now = typeof nowMs === 'function' ? nowMs() : Number(nowMs);
  const out = { result: 'error', codes: [], features: null, soft: null, timeline: null, integrity: null, provenance: null, eligibility: null, code: null, flagReason: null };
  const fail = (code) => ({ ...out, result: 'error', code });
  const sessionId32 = String(candidate.sessionId32).toLowerCase();
  let row;
  let stored;
  try {
    row = await readScreenRow(db, sessionId32);
    stored = row ? await readStoredEvidence(db, sessionId32) : null;
  } catch {
    return fail('unknown-error');
  }
  // H7: no Neon row, a chain-index row or no stored evidence (a forged
  // attestation or data loss) is an integrity failure, always flagged.
  let integrity = { ok: true, code: null };
  if (!row) integrity = integrityFail('evidence-missing', { detail: 'no-row' });
  else if (row.source === 'chain-index') integrity = integrityFail('evidence-missing', { detail: 'chain-index' });
  else if (row.chainMismatch) integrity = integrityFail('chain-mismatch', { detail: 'index-mismatch' });
  else if (!stored || !stored.identity) integrity = integrityFail('evidence-missing', { detail: 'no-evidence' });
  if (!integrity.ok) {
    return { ...out, result: 'integrity-fail', codes: ['H7'], integrity, code: integrity.code, flagReason: 'integrity' };
  }

  // 2. The re-replay and the jackpot-local sameRun.
  if (!verify || typeof verify.reverifyStoredRun !== 'function') return fail('verify-unavailable');
  let fresh;
  try {
    fresh = await verify.reverifyStoredRun({ gameId: row.gameId, identity: stored.identity, evidence: { encoding: stored.encoding, text: stored.text } }, { nowMs: now });
  } catch {
    return fail('verify-unavailable');
  }
  if (!fresh || fresh.ok === false || !sameRun(fresh, row) || String(fresh.evidence?.digest ?? stored.digest).toLowerCase() !== String(stored.digest).toLowerCase()) {
    integrity = integrityFail('replay-mismatch', { detail: fresh?.ok === false ? String(fresh.error ?? 'replay') : 'fields' });
  }

  let evidence = null;
  try {
    evidence = JSON.parse(stored.text);
  } catch {
    integrity = integrity.ok ? integrityFail('replay-mismatch', { detail: 'evidence-json' }) : integrity;
  }
  // 4a. The stock client: the verifier accepts 1-216,000 ticks; only 216,000 is stock.
  if (integrity.ok && Number(evidence?.maxTicks) !== STOCK_MAX_TICKS) integrity = integrityFail('non-stock-client', { detail: String(evidence?.maxTicks ?? '') });

  // 3. The chain cross-check and on-chain eligibility.
  let paid;
  let eligibility;
  try {
    const [record, paidSession, check] = await Promise.all([chain.getSession(sessionId32), chain.getPaidSession(sessionId32), chain.checkEligibility(sessionId32)]);
    paid = paidSession;
    eligibility = check;
    const cross = crossCheck({ row, record, paid, weekIndex, minPaidWei: rules?.minPaidWei ?? 0 });
    if (integrity.ok && !cross.ok) integrity = integrityFail('chain-mismatch', { detail: `checks:${cross.failed.join(',')}` });
    integrity = { ...integrity, chain: cross.facts };
  } catch (error) {
    return fail(classifyJackpotError(error).code === 'rpc-timeout' ? 'rpc-timeout' : 'chain-read-failed');
  }

  // 4b. Seed provenance.
  let provenance;
  try {
    provenance = await checkSeedProvenance(db, { row, identity: stored.identity, openedAtSeconds: paid.openedAt, secret });
  } catch (error) {
    return fail(error?.code === 'SECRET_UNAVAILABLE' ? 'verify-unavailable' : 'unknown-error');
  }
  if (integrity.ok && provenance.status === 'invalid') integrity = integrityFail('ticket-invalid', { detail: provenance.detail, chain: integrity.chain });

  // 5-7. Features, holds, soft signals and the timeline (when the evidence replays).
  let analysis = null;
  let features = null;
  let codes = [];
  let timeline = null;
  if (evidence) {
    try {
      analysis = analyzeChikunEvidence(evidence, { orientation });
      features = computeFeatures({ evidence, analysis, row });
      codes = holdCodes(features, { boardExcluded: row.boardExcluded, ticketMissing: provenance.status === 'missing', h11Active });
      timeline = reviewTimeline(analysis);
    } catch {
      if (integrity.ok) return fail('verify-unavailable');
    }
  }
  let soft = features ? pureSoftSignals(features) : {};
  try {
    soft = { ...soft, ...(await neonSoftSignals(db, { row, weekKey, nowMs: now })) };
  } catch {
    // Soft signals never decide anything; a failed read leaves them out.
  }
  soft.S10 = await crossWalletFunding(db, { wallet: row.wallet, weekKeys: recentWeekKeys, firstFunder, cache: fundingCache });

  const result = !integrity.ok ? 'integrity-fail' : (codes.length ? 'hold' : 'pass');
  const allCodes = !integrity.ok ? ['H7', ...codes] : codes;
  return {
    result,
    codes: allCodes,
    features,
    soft,
    timeline,
    integrity,
    provenance,
    eligibility,
    code: !integrity.ok ? integrity.code : (codes.includes('H9') ? 'late-evidence' : (codes.includes('H10') ? 'ticket-missing' : null)),
    flagReason: result === 'pass' ? null : flagReasonFor({ result, codes: allCodes }),
  };
}
