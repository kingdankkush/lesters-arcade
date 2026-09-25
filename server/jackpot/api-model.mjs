// The public read model of the Chikun Weekly Jackpot: GET /api/jackpot and
// GET /api/jackpot/replay (design §C.5).
//
// Neon only: the mirrors (weeks, candidates, rules) plus the provisional
// open-week leader through the selection query. No RPC call, so the answer is
// cheap and CDN-cached, and every amount comes from the indexed events: a
// lagging index can only under-report, never show an unfunded amount (J13).
//
// Honesty rules the model enforces for the UI (design §D.1):
//   - pot.prizeWei is what the winner can actually receive: min(total, cap);
//     carryOverWei is the rest; funded = total >= the week's minFundWei;
//   - the open week's leader carries only its score (never a wallet or name),
//     and is always provisional;
//   - review values in public are cleared | in-review | disqualified, with a
//     reason only for disqualified rows;
//   - every previous/history row carries its own token and contract from its
//     week row, never the current module;
//   - names go through publicDisplay (a hidden wallet shows only walletShort).

import { isoSql } from '../neon/queries.mjs';
import { publicDisplay, walletShort } from '../neon/rows.mjs';
import { jackpotInstances } from './indexer.mjs';
import { LEADER_SELECT_LIMIT, roleWallets, selectCandidates } from './select.mjs';
import { jackpotStream, readRules, readWalletFlags, rulesForWeek, weekRowFrom } from './store.mjs';
import { boundsIsoOf, weekIndexOfMs, weekKeyOfIndex } from './weeks.mjs';

export const JACKPOT_CACHE_CONTROL = 'public, s-maxage=30, stale-while-revalidate=120';
export const REPLAY_CACHE_CONTROL = 'public, s-maxage=3600, stale-while-revalidate=86400';
export const REPLAY_MISSING_CACHE_CONTROL = 'public, s-maxage=60';
export const JACKPOT_QUERY = Object.freeze(['game', 'history']);
export const REPLAY_QUERY = Object.freeze(['session']);
export const DEFAULT_HISTORY = 8;
export const MAX_HISTORY = 26;
export const EXPLORER_ORIGIN = 'https://liteforge.explorer.caldera.xyz';
export const RULES_URL = '/jackpot/chikun';
export const PUBLIC_WEEK_STATUSES = Object.freeze(['open', 'review', 'awaiting-admin', 'paid', 'claim-pending', 'rolled', 'unfunded']);
const SESSION = /^0x[0-9a-f]{64}$/;

// Internal week status → the public vocabulary (design §C.5). A week that
// has closed but that the cron has not moved yet reads as in review.
export function publicWeekStatus(status, { closed = true } = {}) {
  if (status === 'open') return closed ? 'review' : 'open';
  if (['paid', 'claim-pending', 'rolled', 'unfunded', 'awaiting-admin'].includes(status)) return status;
  return 'review'; // closed, selecting, review, finalizing, failed
}

export function publicReview(review) {
  if (review === 'cleared') return 'cleared';
  if (review === 'disqualified') return 'disqualified';
  return 'in-review';
}

export function replayUrl(sessionId32) {
  return SESSION.test(String(sessionId32 ?? '')) ? `/api/jackpot/replay?session=${sessionId32}` : null;
}

// The pot fields of design §C.5 rev. 2.
export function potFields({ fundedWei = '0', carriedInWei = '0', rules = null }) {
  const funded = BigInt(fundedWei ?? 0);
  const carried = BigInt(carriedInWei ?? 0);
  const total = funded + carried;
  const cap = rules && BigInt(rules.maxPrizeWei ?? 0) > 0n ? BigInt(rules.maxPrizeWei) : null;
  const prize = cap !== null && total > cap ? cap : total;
  const minFund = rules ? BigInt(rules.minFundWei ?? 0) : null;
  return {
    fundedWei: funded.toString(),
    carriedInWei: carried.toString(),
    totalWei: total.toString(),
    prizeCapWei: cap === null ? null : cap.toString(),
    prizeWei: prize.toString(),
    carryOverWei: (total - prize).toString(),
    funded: minFund !== null && minFund > 0n && total >= minFund,
  };
}

function tokenOf(row) {
  return { symbol: row.token.symbol, decimals: row.token.decimals, testnet: row.token.testnet };
}

async function readWeeksWithWinners(db, contracts) {
  const rows = await db.query(
    `SELECT w.contract, w.game_id, w.week_key, w.week_index, w.token_address, w.token_symbol, w.token_decimals, w.token_testnet,
            ${isoSql('w.starts_at')} AS starts_at, ${isoSql('w.closes_at')} AS closes_at, ${isoSql('w.settle_cutoff_at')} AS settle_cutoff_at,
            ${isoSql('w.candidate_until')} AS candidate_until, ${isoSql('w.payout_at')} AS payout_at, w.status, w.funded_wei, w.carried_in_wei,
            w.prize_wei, w.unclaimed_wei, w.winner, w.winning_session, w.winning_score::text AS winning_score, w.finalize_tx_hash,
            ${isoSql('w.finalized_at')} AS finalized_at, w.rolled_to_week, w.held, w.extension_s, w.last_error,
            ${isoSql('w.admin_waiting_since')} AS admin_waiting_since, ${isoSql('w.updated_at')} AS updated_at,
            wp.display_name, wp.avatar_uri, coalesce(wp.hidden, false) AS hidden
     FROM jackpot_weeks w LEFT JOIN wallet_profiles wp ON wp.wallet = w.winner
     WHERE w.contract IN (SELECT jsonb_array_elements_text($1::jsonb))
     ORDER BY w.week_index DESC, w.contract ASC`,
    [JSON.stringify(contracts)],
  );
  return rows.map((raw) => ({ row: weekRowFrom(raw), display: publicDisplay({ hidden: raw.hidden === true, displayName: raw.display_name ?? null, avatarUri: raw.avatar_uri ?? null }) }));
}

async function readPublicCandidates(db, { contract, weekKey }) {
  const rows = await db.query(
    `SELECT c.session_id32, c.wallet, c.score::text AS score, c.on_chain, c.was_listed, c.chain_rank, c.review, c.review_reason,
            wp.display_name, coalesce(wp.hidden, false) AS hidden
     FROM jackpot_candidates c LEFT JOIN wallet_profiles wp ON wp.wallet = c.wallet
     WHERE c.contract = $1 AND c.week_key = $2 AND (c.on_chain OR (c.was_listed AND c.review = 'disqualified'))
     ORDER BY c.on_chain DESC, c.chain_rank ASC NULLS LAST, c.score DESC, c.session_id32 ASC`,
    [contract, weekKey],
  );
  return rows.map((raw, index) => {
    const display = publicDisplay({ hidden: raw.hidden === true, displayName: raw.display_name ?? null });
    const review = publicReview(raw.review);
    return {
      rank: raw.on_chain ? Number(raw.chain_rank ?? index + 1) : null,
      walletShort: walletShort(raw.wallet),
      displayName: display.displayName,
      score: Number(raw.score),
      review,
      ...(review === 'disqualified' ? { reason: raw.review_reason ?? 'other' } : {}),
      replay: replayUrl(raw.session_id32),
    };
  });
}

function winnerOf(entry) {
  const { row, display } = entry;
  if (!row.winner || !['paid', 'claim-pending'].includes(row.status)) return null;
  return { walletShort: walletShort(row.winner), wallet: row.winner, displayName: display.displayName };
}

function historyRow(entry) {
  const { row } = entry;
  const won = winnerOf(entry);
  return {
    weekKey: row.weekKey,
    startsAt: row.startsAt,
    closesAt: row.closesAt,
    status: publicWeekStatus(row.status),
    token: tokenOf(row),
    contract: row.contract,
    winner: won,
    score: won ? row.winningScore : null,
    prizeWei: won ? row.prizeWei : null,
    unclaimedWei: row.unclaimedWei,
    finalizeTx: row.finalizeTxHash,
    replay: won ? replayUrl(row.winningSession) : null,
    rolledTo: row.status === 'rolled' ? row.rolledToWeek : null,
  };
}

// The provisional open-week leader: the selection query with no cutoff and
// the code checks; score only (design §C.5, Appendix K F9).
async function openLeader(db, { instance, weekKey, rules, deployment }) {
  if (!rules) return null;
  const flags = await readWalletFlags(db, { contract: instance.contract });
  const staff = roleWallets({ deployment, jackpotInstance: instance });
  for (const flag of flags) if (flag.staffEver) staff.add(flag.wallet);
  const { rows } = await selectCandidates(db, { contract: instance.contract, weekKey, rules, cutoffIso: null, staff, limit: LEADER_SELECT_LIMIT, keep: 1 });
  const leader = rows[0];
  if (!leader) return null;
  const screened = await db.query("SELECT screen FROM jackpot_candidates WHERE contract = $1 AND session_id32 = $2 AND screen <> 'pending'", [instance.contract, leader.sessionId32]);
  return { score: leader.score, provisional: true, screened: screened.length > 0 };
}

// → the GET /api/jackpot body (live) or null when not live.
export async function jackpotApiBody(db, { config, deployment = null, nowMs, history = DEFAULT_HISTORY, chainId = 4441 }) {
  const instances = jackpotInstances(config.jackpot.deployment);
  const active = instances[0];
  const now = Number(nowMs);
  const currentIndex = weekIndexOfMs(now);
  const currentKey = weekKeyOfIndex(currentIndex);
  const rulesList = await readRules(db, { contract: active.contract });
  const rules = rulesForWeek(rulesList, currentIndex);
  const weeks = await readWeeksWithWinners(db, instances.map((instance) => instance.contract));
  const currentEntry = weeks.find((entry) => entry.row.contract === active.contract && entry.row.weekIndex === currentIndex);
  const bounds = boundsIsoOf(currentIndex, currentEntry?.row.extensionSeconds ?? 0);
  const cursor = await db.query('SELECT last_block::text AS last_block FROM indexer_state WHERE stream = $1', [jackpotStream(active.contract, chainId)]);
  const current = {
    weekKey: currentKey,
    weekIndex: currentIndex,
    status: 'open',
    startsAt: bounds.startsAt,
    closesAt: bounds.closesAt,
    settleCutoffAt: bounds.settleCutoffAt,
    candidateUntil: bounds.candidateUntil,
    payoutAt: bounds.payoutAt,
    rules: rules ? { minPaidWei: rules.minPaidWei, maxSurvivalSeconds: rules.maxSurvivalSeconds, minFundWei: rules.minFundWei, adminClearOnly: rules.adminClearOnly } : null,
    pot: potFields({ fundedWei: currentEntry?.row.fundedWei ?? '0', carriedInWei: currentEntry?.row.carriedInWei ?? '0', rules }),
    leader: await openLeader(db, { instance: active, weekKey: currentKey, rules, deployment }),
  };
  const closed = weeks.filter((entry) => entry.row.weekIndex < currentIndex);
  const previousEntry = closed.find((entry) => entry.row.contract === active.contract && entry.row.weekIndex === currentIndex - 1) ?? null;
  let previous = null;
  if (previousEntry) {
    const row = previousEntry.row;
    const previousRules = rulesForWeek(rulesList, row.weekIndex);
    const won = winnerOf(previousEntry);
    previous = {
      weekKey: row.weekKey,
      status: publicWeekStatus(row.status),
      payoutAt: row.payoutAt,
      token: tokenOf(row),
      pot: potFields({ fundedWei: row.fundedWei, carriedInWei: row.carriedInWei, rules: previousRules }),
      candidates: await readPublicCandidates(db, { contract: row.contract, weekKey: row.weekKey }),
      winner: won,
      prizeWei: won ? row.prizeWei : null,
      unclaimedWei: row.unclaimedWei,
      finalizeTx: row.finalizeTxHash,
    };
  }
  const older = closed.filter((entry) => entry !== previousEntry).slice(0, Math.max(0, Math.min(MAX_HISTORY, Number(history))));
  const token = active.token;
  return {
    ok: true,
    live: true,
    game: 'chikun',
    chainId,
    contract: active.contract,
    explorer: EXPLORER_ORIGIN,
    token: { address: token.address, symbol: token.symbol, decimals: token.decimals, testnet: token.testnet },
    serverTime: new Date(now).toISOString(),
    indexedBlock: cursor.length ? Number(cursor[0].last_block) : null,
    current,
    previous,
    history: older.map(historyRow),
    rulesUrl: RULES_URL,
  };
}

// The replay of a candidate of a closed week, or null (design §C.5).
export async function jackpotReplayBody(db, { sessionId32, nowMs, contracts }) {
  if (!SESSION.test(String(sessionId32 ?? ''))) return null;
  const rows = await db.query(
    `SELECT e.evidence, e.encoding
     FROM jackpot_candidates c
     JOIN jackpot_weeks w ON w.contract = c.contract AND w.week_key = c.week_key
     JOIN session_evidence e ON e.session_id32 = c.session_id32
     WHERE c.session_id32 = $1 AND w.closes_at <= $2::timestamptz AND c.contract IN (SELECT jsonb_array_elements_text($3::jsonb))
     LIMIT 1`,
    [sessionId32, new Date(Number(nowMs)).toISOString(), JSON.stringify(contracts)],
  );
  const row = rows[0];
  if (!row || row.encoding !== 'chikun-flap-evidence-v6+json') return null;
  let evidence;
  try {
    evidence = JSON.parse(row.evidence);
  } catch {
    return null;
  }
  return { format: 'chikun-replay-file-v1', game: 'chikun', evidence };
}
