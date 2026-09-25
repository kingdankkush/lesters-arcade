// The owner review model behind GET /api/jackpot/review?week= (design §C.6).
//
// Served only to the live on-chain admin() (and JACKPOT_ADMIN_WALLET when set;
// api/jackpot-review.mjs gates it). It returns every candidate of the week
// (listed, displaced and disqualified) with its features and hold codes with
// the rule text, the soft signals S1-S11 (evidence delay, seed provenance,
// cross-wallet funding), the integrity results, the on-chain review state
// with adminReviewed and wasListed (read live, with the mirror as fallback),
// the keeper's action states, explorer links, the wallet's last 20 Chikun
// Ranked runs and the server-computed flap timeline; plus nextEligible, the
// next 10 selection rows that are not listed, for adminSubmit.
//
// There are no owner write endpoints: every decision is an on-chain
// transaction from the admin wallet (the owner page), which Neon mirrors.

import { isoSql } from '../neon/queries.mjs';
import { explorerUrlFor, publicDisplay, walletShort } from '../neon/rows.mjs';
import { readStoredEvidence } from '../settle/store.mjs';
import { EXPLORER_ORIGIN, potFields } from './api-model.mjs';
import { jackpotInstances } from './indexer.mjs';
import { HOLD_RULE_TEXT, SOFT_SIGNAL_TEXT, analyzeChikunEvidence, reviewTimeline } from './plausibility.mjs';
import { KEEPER_SELECT_LIMIT, roleWallets, selectCandidates } from './select.mjs';
import { readCandidates, readRules, readWalletFlags, readWeekActions, readWeekRow, rulesForWeek } from './store.mjs';
import { boundsIsoOf, weekIndexOfKey } from './weeks.mjs';

// The written rubric the owner page links next to Clear and Disqualify.
export const REVIEW_RUBRIC_DOC = 'docs/web3/weekly-jackpot-operations.md#admin-review-rubric';
export const RECENT_RUNS = 20;
export const NEXT_ELIGIBLE = 10;
// Timelines not stored by a screen are computed here, at most this many per
// request (a 60-minute replay takes about 5 s; the function allows 30 s).
export const MAX_REVIEW_REPLAYS = 3;

export const addressUrl = (wallet) => `${EXPLORER_ORIGIN}/address/${wallet}`;

// The live admin() of an instance, one eth_call cached in memory for 60 s
// (design §C.6): after an emergency forceAdmin the old admin loses access
// within a minute, without a redeploy.
export const ADMIN_CACHE_MS = 60_000;
const adminCache = new Map();
export async function liveAdmin(chain, { nowMs = Date.now(), cache = adminCache } = {}) {
  const hit = cache.get(chain.address);
  if (hit && Number(nowMs) - hit.at < ADMIN_CACHE_MS) return hit.admin;
  const admin = await chain.admin();
  cache.set(chain.address, { admin, at: Number(nowMs) });
  return admin;
}
export function clearAdminCache() {
  adminCache.clear();
}

async function recentRuns(db, wallet) {
  const rows = await db.query(
    `SELECT session_id32, score::text AS score, survival_seconds::text AS survival_seconds, week_key, status, source,
            ${isoSql('coalesce(opened_at, verified_at)')} AS played_at
     FROM verified_sessions WHERE wallet = $1 AND game_id = 'chikun'
     ORDER BY coalesce(opened_at, verified_at) DESC, session_id32 DESC LIMIT $2::int`,
    [wallet, String(RECENT_RUNS)],
  );
  return rows.map((row) => ({ sessionId32: row.session_id32, score: Number(row.score), survivalSeconds: Number(row.survival_seconds), weekKey: row.week_key, status: row.status, source: row.source, playedAt: row.played_at }));
}

async function displayNames(db, wallets) {
  if (!wallets.length) return new Map();
  const rows = await db.query('SELECT wallet, display_name, hidden FROM wallet_profiles WHERE wallet IN (SELECT jsonb_array_elements_text($1::jsonb))', [JSON.stringify(wallets)]);
  return new Map(rows.map((row) => [row.wallet, publicDisplay({ hidden: row.hidden === true, displayName: row.display_name ?? null }).displayName]));
}

async function liveReview(chain, sessionId32) {
  if (!chain) return null;
  try {
    const [review, adminReviewed, wasListed] = await Promise.all([chain.reviewOf(sessionId32), chain.adminReviewed(sessionId32), chain.wasListed(sessionId32)]);
    return { review, adminReviewed, wasListed, source: 'chain' };
  } catch {
    return null;
  }
}

// → the review payload, or null for a week the instance never had.
export async function jackpotReviewBody(db, { config, deployment = null, weekKey, chain = null, nowMs = Date.now() }) {
  const instance = jackpotInstances(config.jackpot.deployment)[0];
  const weekIndex = weekIndexOfKey(weekKey);
  if (!instance || weekIndex === null) return null;
  const contract = instance.contract;
  const row = await readWeekRow(db, { contract, weekKey });
  const rulesList = await readRules(db, { contract });
  const rules = rulesForWeek(rulesList, weekIndex);
  const bounds = boundsIsoOf(weekIndex, row?.extensionSeconds ?? 0);
  const candidates = await readCandidates(db, { contract, weekKey });
  const actions = await readWeekActions(db, { contract, weekKey });
  const names = await displayNames(db, [...new Set(candidates.map((candidate) => candidate.wallet))]);
  let replays = 0;
  const outCandidates = [];
  for (const candidate of candidates) {
    const stored = candidate.features && typeof candidate.features === 'object' ? candidate.features : {};
    let timeline = stored.timeline ?? null;
    if (!timeline && replays < MAX_REVIEW_REPLAYS) {
      // eslint-disable-next-line no-await-in-loop
      const evidence = await readStoredEvidence(db, candidate.sessionId32).catch(() => null);
      if (evidence?.encoding === 'chikun-flap-evidence-v6+json') {
        replays += 1;
        try {
          timeline = reviewTimeline(analyzeChikunEvidence(JSON.parse(evidence.text)));
        } catch {
          timeline = null;
        }
      }
    }
    // eslint-disable-next-line no-await-in-loop
    const live = await liveReview(chain, candidate.sessionId32);
    // eslint-disable-next-line no-await-in-loop
    const runs = await recentRuns(db, candidate.wallet);
    const codes = candidate.screenCodes;
    outCandidates.push({
      sessionId32: candidate.sessionId32,
      wallet: candidate.wallet,
      walletShort: walletShort(candidate.wallet),
      displayName: names.get(candidate.wallet) ?? null,
      score: candidate.score,
      source: candidate.source,
      onChain: candidate.onChain,
      chainRank: candidate.chainRank,
      listing: candidate.onChain ? 'listed' : (candidate.review === 'disqualified' ? 'disqualified' : (candidate.wasListed ? 'displaced' : 'selected')),
      review: live?.review ?? candidate.review,
      reviewReason: candidate.reviewReason,
      adminReviewed: live?.adminReviewed ?? candidate.adminReviewed,
      wasListed: live?.wasListed ?? candidate.wasListed,
      reviewSource: live ? 'chain' : 'mirror',
      screen: candidate.screen,
      screenedAt: candidate.screenedAt,
      holdCodes: codes.map((code) => ({ code, text: HOLD_RULE_TEXT[code] ?? code })),
      features: stored.features ?? null,
      soft: stored.soft ?? null,
      integrity: stored.integrity ?? null,
      provenance: stored.provenance ?? null,
      eligibility: stored.eligibility ?? null,
      flagReason: stored.flagReason ?? null,
      timeline,
      actions: actions.filter((action) => action.sessionId32 === candidate.sessionId32).map((action) => ({
        id: action.id, kind: action.kind, status: action.status, reason: action.reason, attempts: action.attempts, lastError: action.lastError,
        txHash: action.txHash, explorerUrl: explorerUrlFor(action.txHash), nextAttemptAt: action.nextAttemptAt,
      })),
      explorer: { wallet: addressUrl(candidate.wallet) },
      recentRuns: runs,
    });
  }
  // nextEligible: the next selection rows for the week that are not listed.
  let nextEligible = [];
  if (rules) {
    const flags = await readWalletFlags(db, { contract });
    const staff = roleWallets({ deployment, jackpotInstance: instance });
    for (const flag of flags) if (flag.staffEver) staff.add(flag.wallet);
    const listed = new Set(candidates.filter((candidate) => candidate.onChain).map((candidate) => candidate.sessionId32));
    const { rows } = await selectCandidates(db, { contract, weekKey, rules, cutoffIso: bounds.settleCutoffAt, staff, limit: KEEPER_SELECT_LIMIT + listed.size + NEXT_ELIGIBLE, keep: KEEPER_SELECT_LIMIT + listed.size + NEXT_ELIGIBLE });
    const byId = new Map(candidates.map((candidate) => [candidate.sessionId32, candidate]));
    nextEligible = rows.filter((selected) => !listed.has(selected.sessionId32)).slice(0, NEXT_ELIGIBLE).map((selected) => ({
      sessionId32: selected.sessionId32, wallet: selected.wallet, walletShort: walletShort(selected.wallet), score: selected.score,
      confirmedAt: selected.confirmedAt, screen: byId.get(selected.sessionId32)?.screen ?? 'unscreened', explorer: { wallet: addressUrl(selected.wallet) },
    }));
  }
  const finalize = actions.find((action) => action.kind === 'finalize') ?? null;
  return {
    ok: true,
    contract,
    token: { address: instance.token.address, symbol: row?.token.symbol ?? instance.token.symbol, decimals: row?.token.decimals ?? instance.token.decimals, testnet: row?.token.testnet ?? instance.token.testnet },
    weekKey,
    weekIndex,
    serverTime: new Date(Number(nowMs)).toISOString(),
    week: {
      status: row?.status ?? 'open',
      startsAt: bounds.startsAt,
      closesAt: bounds.closesAt,
      settleCutoffAt: bounds.settleCutoffAt,
      candidateUntil: bounds.candidateUntil,
      payoutAt: bounds.payoutAt,
      held: row?.held ?? false,
      extensionSeconds: row?.extensionSeconds ?? 0,
      adminWaitingSince: row?.adminWaitingSince ?? null,
      lastError: row?.lastError ?? null,
      pot: potFields({ fundedWei: row?.fundedWei ?? '0', carriedInWei: row?.carriedInWei ?? '0', rules }),
      winner: row?.winner ?? null,
      winningSession: row?.winningSession ?? null,
      prizeWei: row?.prizeWei ?? null,
      unclaimedWei: row?.unclaimedWei ?? '0',
      finalizeTx: row?.finalizeTxHash ?? null,
      finalizeTxUrl: explorerUrlFor(row?.finalizeTxHash),
      finalizeAction: finalize ? { status: finalize.status, lastError: finalize.lastError, txHash: finalize.txHash } : null,
    },
    rules,
    candidates: outCandidates,
    nextEligible,
    holdRuleText: HOLD_RULE_TEXT,
    softSignalText: SOFT_SIGNAL_TEXT,
    rubric: REVIEW_RUBRIC_DOC,
  };
}
