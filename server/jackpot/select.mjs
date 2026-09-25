// Keeper selection of the Chikun Weekly Jackpot (design §B.3 item 1, §C.4
// "Selection query").
//
// Stricter than the weekly board: only rows the server itself settled with
// stored evidence (source 'settle', never chain-index), no chain mismatch,
// confirmed by the settle cutoff, opened inside the week, in the week's
// seasons, under the survival cap, paid at least minPaidWei (compared as
// numeric in SQL), and never from a staff, blocked, board-excluded or
// disqualified wallet or session. Ordering is the board's, on the numeric
// columns in every ORDER BY (revision 1 cast the score to text first, so
// '9999' ranked above '48213'); the cast to text happens only in the final
// projection. Every parameter is a string (A15).
//
// Code checks after the query: rows whose stored evidence has maxTicks other
// than 216,000 (a non-stock client, H7) are dropped. The keeper asks for 10
// rows and keeps the first 5; the open-week leader asks for 3 and uses the
// first that passes.
//
// Test seam (J2 → J3; never read from env): deps.jackpotSelect(rows) → rows,
// applied by the cron to the selection result (rehearsal R2 simulates keeper
// censorship with it). It defaults to the identity.

import { isoSql } from '../neon/queries.mjs';
import { periodKeyResetAt, periodStartMs } from '../neon/period-keys.mjs';
import { INDEX_GAMES } from '../neon/rows.mjs';

export const STOCK_MAX_TICKS = 216_000;
export const KEEPER_SELECT_LIMIT = 10;
export const KEEPER_KEEP = 5;
export const LEADER_SELECT_LIMIT = 3;
// maxSurvivalSeconds 0 means no cap; the column is bounded by 86,400 anyway.
export const NO_SURVIVAL_CAP_SECONDS = 86_400;

export const SELECTION_SQL = `WITH best AS (
  SELECT DISTINCT ON (vs.wallet) vs.session_id32, vs.wallet, vs.score, vs.confirmed_at, vs.opened_at, vs.entry_amount_wei
  FROM verified_sessions vs
  JOIN session_evidence e ON e.session_id32 = vs.session_id32
  WHERE vs.game_id = 'chikun' AND vs.week_key = $1
    AND vs.season_id = ANY(string_to_array($2, ','))
    AND vs.status = 'confirmed' AND vs.source = 'settle' AND NOT vs.chain_mismatch
    AND vs.opened_at >= $3::timestamptz AND vs.opened_at < $4::timestamptz
    AND ($5::timestamptz IS NULL OR vs.confirmed_at <= $5::timestamptz)
    AND vs.survival_seconds <= $6::bigint
    AND vs.entry_amount_wei IS NOT NULL AND vs.entry_amount_wei::numeric >= $7::numeric
    AND vs.wallet <> ALL(string_to_array($8, ','))
    AND NOT EXISTS (SELECT 1 FROM wallet_profiles p WHERE p.wallet = vs.wallet AND p.board_excluded)
    AND NOT EXISTS (SELECT 1 FROM jackpot_wallet_flags f WHERE f.contract = $9 AND f.wallet = vs.wallet AND (f.blocked OR f.staff_ever))
    AND NOT EXISTS (SELECT 1 FROM jackpot_candidates c WHERE c.contract = $9 AND c.session_id32 = vs.session_id32 AND c.review = 'disqualified')
  ORDER BY vs.wallet, vs.score DESC, vs.confirmed_at ASC, vs.session_id32 ASC
)
SELECT b.session_id32, b.wallet, b.score::text AS score,
       ${isoSql('b.confirmed_at')} AS confirmed_at, ${isoSql('b.opened_at')} AS opened_at, b.entry_amount_wei
FROM best b
ORDER BY b.score DESC, b.confirmed_at ASC, b.session_id32 ASC
LIMIT $10::int`;

const ADDRESS = /^0x[0-9a-f]{40}$/;
const HASH = /^0x[0-9a-f]{64}$/;

// bytes32 season id (ethers.id(text)) → season text, from the index game table
// (INDEX_GAMES; retired Chikun seasons stay listed there).
export function chikunSeasonCatalog() {
  const out = new Map();
  for (const game of Object.values(INDEX_GAMES)) {
    if (game.gameId === 'chikun') out.set(game.seasonId32.toLowerCase(), game.seasonId);
  }
  return out;
}

// The week's season texts from its rules (season and alt season), or null
// when a hash is unknown (the cron then records 'unknown-season').
export function seasonTextsFor(rules, catalog = chikunSeasonCatalog()) {
  if (!rules) return null;
  const hashes = [rules.seasonId32, rules.altSeasonId32].filter((hash) => typeof hash === 'string' && HASH.test(hash.toLowerCase()) && !/^0x0{64}$/.test(hash));
  if (!hashes.length) return null;
  const texts = [];
  for (const hash of hashes) {
    const text = catalog.get(hash.toLowerCase());
    if (!text || text.includes(',')) return null;
    texts.push(text);
  }
  return texts;
}

// Role wallets that can never win, from the deployment modules (design §C.4
// $8): verifier, relayer, operator, the developer wallet and vaults when the
// record has them, and the jackpot's admin, keeper and residual recipient.
export function roleWallets({ deployment = null, jackpotInstance = null } = {}) {
  const out = new Set();
  const add = (value) => {
    const text = String(value ?? '').toLowerCase();
    if (ADDRESS.test(text) && !/^0x0{40}$/.test(text)) out.add(text);
  };
  add(deployment?.trustedVerifier);
  add(deployment?.relayer);
  add(deployment?.relayerVault);
  add(deployment?.deployer);
  add(deployment?.developerWallet);
  for (const vault of Object.values(deployment?.vaults ?? {})) add(vault);
  add(jackpotInstance?.admin);
  add(jackpotInstance?.keeper);
  add(jackpotInstance?.operator);
  add(jackpotInstance?.residualRecipient);
  return out;
}

// The stored evidence's maxTicks for each session (null when unreadable).
export async function readEvidenceMaxTicks(db, sessionIds) {
  const ids = [...new Set(sessionIds)].filter((id) => HASH.test(String(id)));
  if (!ids.length) return new Map();
  const rows = await db.query(
    `SELECT session_id32, CASE WHEN jsonb_typeof(evidence::jsonb -> 'maxTicks') = 'number' THEN (evidence::jsonb ->> 'maxTicks') ELSE NULL END AS max_ticks
     FROM session_evidence WHERE session_id32 IN (SELECT jsonb_array_elements_text($1::jsonb)) AND encoding = 'chikun-flap-evidence-v6+json'`,
    [JSON.stringify(ids)],
  );
  return new Map(rows.map((row) => [row.session_id32, row.max_ticks === null ? null : Number(row.max_ticks)]));
}

function rowFrom(raw) {
  return Object.freeze({
    sessionId32: raw.session_id32,
    wallet: raw.wallet,
    score: Number(raw.score),
    confirmedAt: raw.confirmed_at,
    openedAt: raw.opened_at,
    entryAmountWei: raw.entry_amount_wei,
  });
}

// The raw selection (the §C.4 SQL) for a week. `cutoffIso` null = no cutoff.
// → rows in board order.
export async function querySelection(db, { contract, weekKey, seasons, cutoffIso = null, maxSurvivalSeconds, minPaidWei, staff = [], limit }) {
  if (!ADDRESS.test(String(contract))) throw new TypeError('contract must be a lowercase address');
  const startMs = periodStartMs('weekly', weekKey);
  const resetAt = periodKeyResetAt('weekly', weekKey);
  if (!Number.isFinite(startMs) || !resetAt) throw new TypeError(`bad week key ${weekKey}`);
  const cap = Number(maxSurvivalSeconds) > 0 ? Number(maxSurvivalSeconds) : NO_SURVIVAL_CAP_SECONDS;
  const staffList = [...new Set([...staff].map((wallet) => String(wallet).toLowerCase()).filter((wallet) => ADDRESS.test(wallet)))];
  const params = [
    String(weekKey),
    seasons.join(','),
    new Date(startMs).toISOString(),
    resetAt,
    cutoffIso === null || cutoffIso === undefined ? null : String(cutoffIso),
    String(Math.floor(cap)),
    BigInt(minPaidWei ?? 0).toString(),
    staffList.join(','),
    String(contract),
    String(Math.max(1, Math.floor(Number(limit) || 1))),
  ];
  const rows = await db.query(SELECTION_SQL, params);
  return rows.map(rowFrom);
}

// Selection plus the code checks. → { rows, dropped: [{ sessionId32, code }] }
//   keep   how many passing rows to return (the keeper keeps 5 of 10)
export async function selectCandidates(db, { contract, weekKey, rules, seasons = undefined, cutoffIso = null, staff = [], limit = KEEPER_SELECT_LIMIT, keep = KEEPER_KEEP }) {
  const seasonTexts = seasons ?? seasonTextsFor(rules);
  if (!seasonTexts) return { rows: [], dropped: [], unknownSeason: true };
  const raw = await querySelection(db, {
    contract, weekKey, seasons: seasonTexts, cutoffIso, maxSurvivalSeconds: rules.maxSurvivalSeconds, minPaidWei: rules.minPaidWei, staff, limit,
  });
  const maxTicks = await readEvidenceMaxTicks(db, raw.map((row) => row.sessionId32));
  const rows = [];
  const dropped = [];
  for (const row of raw) {
    if (maxTicks.get(row.sessionId32) !== STOCK_MAX_TICKS) {
      dropped.push({ sessionId32: row.sessionId32, code: 'non-stock-client' });
      continue;
    }
    if (rows.length < keep) rows.push(row);
  }
  return { rows, dropped, unknownSeason: false };
}
