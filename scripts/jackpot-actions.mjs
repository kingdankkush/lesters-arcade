// Operator and funder actions on the Chikun Weekly Jackpot (design §A.18; runbook §E, emergency stops).
// A sibling of scripts/operator-actions.mjs with the same guards.
//
//   node scripts/jackpot-actions.mjs <action> [args] [options]
//
// Every action but `status` is a DRY RUN unless --broadcast and --confirm <PHRASE> are both given; the dry
// run reads the chain and prints the exact calls. A broadcast also needs a DEPLOYED jackpot module and a
// key read inside the process from --key-env <NAME> or --key-file <path> --key-field <field> (never
// printed). The signer is checked against the on-chain role before anything is sent.
//
// Actions (confirm phrase; who signs):
//   status                                  read-only: roles, pauses, weeks, pots, candidates, liabilities,
//                                           rules and the keeper balance
//   mint-test --to <addr> --amount <n>      tCHIKUN mint (test token only)            MINT_TCHIKUN_4441; minter
//   fund --week current|<YYYY-Www> --amount <n>   approve(exact) + fund(week, amount)  FUND_JACKPOT_4441; any key
//   set-keeper <addr|none>                  setKeeper (then block the outgoing keeper) SET_JACKPOT_KEEPER_4441; operator
//   schedule-rules --from-week <week> [--rules launch|<json>] [overrides]
//                                           scheduleRules for a future week           SCHEDULE_JACKPOT_RULES_4441; operator
//   force-admin <addr>                      one-step admin replacement (stop 5)        FORCE_JACKPOT_ADMIN_4441; operator
//   operator-pause | operator-unpause       the operator's own pause flag              PAUSE_JACKPOT_4441; operator
//   schedule-end <YYYY-Www> | cancel-end    end of life (at least one week's notice)   END_JACKPOT_4441; operator
//   recover-residual | sweep-stray <token>  residue / stray tokens to the recipient     RECOVER_JACKPOT_4441; operator
//   finalize <YYYY-Www>                     manual payout fallback                     FINALIZE_JACKPOT_4441; any key
//   refund-after-end <YYYY-Www>             a funder's own funding after an end        REFUND_JACKPOT_4441; the funder
//
// schedule-rules starts from the epoch that would otherwise apply to --from-week (or --rules launch|<json>)
// and applies --admin-clear-only true|false, --max-prize <tokens>, --min-fund <tokens>, --min-paid-wei <wei>,
// --max-survival <seconds>, --max-score <n>, --season <name|0x…> and --alt-season <name|0x…|none>. A rules
// file must state adminClearOnly, maxSurvivalSeconds, minPaidWei and minFundWei (the flags count), and on an
// instance whose token is not a test token every epoch needs adminClearOnly and a prize cap (J16, OJ6).
// The admin's own actions (clear, flag, disqualify, reinstate, adminSubmit, block, hold, extend, pause,
// transferAdmin) are on the owner page, because the admin is a browser wallet.
//
// Options: --instance <address> (the active instance by default; a retired one for its refunds and
// finalizes), --from <address> (dry-run balance checks), --json. --rpc and --deployment <litvm-jackpot
// module> are honoured only with a loopback --rpc (the local chain). Every run first asks the RPC node for
// its eth_chainId and stops unless it is 4441.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ethers } from 'ethers';
import { SecretSourceError, flagValue, hasFlag, readSecret } from './lib/key-source.mjs';
import { isLoopbackRpc, rpcChainId } from './operator-actions.mjs';
import {
  JACKPOT_CHAIN_ID,
  MAX_FUND_AHEAD_WEEKS,
  launchRulesFor,
  loadContractArtifact,
  loadLitvmJackpot,
  normalizeRules,
  realValueRuleProblems,
  rulesFromChain,
  rulesToJson,
  seasonId32,
  weekBoundsOf,
  weekIndexOf,
  weekIndexOfKey,
  weekKeyOf,
} from './generate-litvm-jackpot.mjs';

export const DEFAULT_RPC_URL = 'https://liteforge.rpc.caldera.xyz/http';
export const SET_KEEPER_REMINDER = 'Reminder: block the outgoing keeper wallet from the owner page (setBlocked, reason "staff") so the change is public; it is already staffEver and can never win.';

export const JACKPOT_ACTIONS = Object.freeze({
  status: Object.freeze({ confirm: null, role: null, usage: 'status [--json]', summary: 'read-only jackpot state' }),
  'mint-test': Object.freeze({ confirm: 'MINT_TCHIKUN_4441', role: 'minter', usage: 'mint-test --to <address> --amount <tokens>', summary: 'mint tCHIKUN (test token only)' }),
  fund: Object.freeze({ confirm: 'FUND_JACKPOT_4441', role: 'any', usage: 'fund --week current|<YYYY-Www> --amount <tokens>', summary: 'approve the exact amount, then fund(week, amount)' }),
  'set-keeper': Object.freeze({ confirm: 'SET_JACKPOT_KEEPER_4441', role: 'operator', usage: 'set-keeper <address|none>', summary: 'setKeeper (the new keeper becomes staffEver)' }),
  'schedule-rules': Object.freeze({ confirm: 'SCHEDULE_JACKPOT_RULES_4441', role: 'operator', usage: 'schedule-rules --from-week next|<YYYY-Www> [--rules launch|<json>] [overrides]', summary: 'scheduleRules for a week that has not started' }),
  'force-admin': Object.freeze({ confirm: 'FORCE_JACKPOT_ADMIN_4441', role: 'operator', usage: 'force-admin <address>', summary: 'forceAdmin: one step, uncontestable (emergency stop 5)' }),
  'operator-pause': Object.freeze({ confirm: 'PAUSE_JACKPOT_4441', role: 'operator', usage: 'operator-pause', summary: "operatorPause (the admin cannot lift it)" }),
  'operator-unpause': Object.freeze({ confirm: 'PAUSE_JACKPOT_4441', role: 'operator', usage: 'operator-unpause', summary: 'operatorUnpause' }),
  'schedule-end': Object.freeze({ confirm: 'END_JACKPOT_4441', role: 'operator', usage: 'schedule-end <YYYY-Www>', summary: 'scheduleEnd(lastWeek), at least one full week ahead' }),
  'cancel-end': Object.freeze({ confirm: 'END_JACKPOT_4441', role: 'operator', usage: 'cancel-end', summary: 'cancelEnd, while the last week has not passed' }),
  'recover-residual': Object.freeze({ confirm: 'RECOVER_JACKPOT_4441', role: 'operator', usage: 'recover-residual', summary: 'recoverResidual to the residual recipient (30 days after the end)' }),
  'sweep-stray': Object.freeze({ confirm: 'RECOVER_JACKPOT_4441', role: 'operator', usage: 'sweep-stray <token address>', summary: 'sweepStray: only the balance above liabilities' }),
  finalize: Object.freeze({ confirm: 'FINALIZE_JACKPOT_4441', role: 'any', usage: 'finalize <YYYY-Www>', summary: 'finalize(week), the manual payout fallback' }),
  'refund-after-end': Object.freeze({ confirm: 'REFUND_JACKPOT_4441', role: 'funder', usage: 'refund-after-end <YYYY-Www>', summary: "refundAfterEnd(week) from the funder's own key" }),
});

const VALUE_FLAGS = new Set(['--rpc', '--deployment', '--instance', '--from', '--confirm', '--key-env', '--key-file', '--key-field', '--to', '--amount', '--week', '--from-week', '--rules', '--admin-clear-only', '--max-prize', '--min-fund', '--min-paid-wei', '--max-survival', '--max-score', '--season', '--alt-season']);
const BOOLEAN_FLAGS = new Set(['--broadcast', '--json']);
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

export class ActionBlocked extends Error {
  constructor(message) {
    super(message);
    this.name = 'ActionBlocked';
  }
}

function blocked(message) {
  throw new ActionBlocked(message);
}

export function jackpotHelp() {
  const rows = Object.entries(JACKPOT_ACTIONS).map(([, action]) => `  ${action.usage.padEnd(62)} ${action.summary}${action.confirm ? `  [--confirm ${action.confirm}]` : ''}`);
  return [
    'usage: node scripts/jackpot-actions.mjs <action> [args] [--instance <address>] [--from <address>] [--json]',
    '       [--broadcast --confirm <PHRASE> (--key-env <NAME> | --key-file <path> --key-field <field>)]',
    '',
    'Actions (dry run unless --broadcast and the confirm phrase are given):',
    ...rows,
  ].join('\n');
}

function contractAt(name, target, runner) {
  return new ethers.Contract(target, loadContractArtifact(name).abi, runner);
}

function parseAddress(value, label, { allowNone = false } = {}) {
  if (allowNone && value === 'none') return ethers.ZeroAddress;
  if (typeof value !== 'string' || !ADDRESS_RE.test(value) || /^0x0{40}$/.test(value)) blocked(`${label} must be a non-zero 0x address${allowNone ? ' (or none)' : ''}`);
  return ethers.getAddress(value);
}

// 'current' | 'next' | 'previous' | 'YYYY-Www' | a week index -> week index.
export function parseWeekArg(value, currentWeek, label = 'week') {
  if (value === 'current') return currentWeek;
  if (value === 'next') return currentWeek + 1;
  if (value === 'previous') return currentWeek - 1;
  if (/^\d+$/.test(String(value ?? ''))) return Number(value);
  try {
    return weekIndexOfKey(value);
  } catch {
    blocked(`${label} must be current, next, previous, a YYYY-Www key or a week index (got ${JSON.stringify(value)})`);
  }
  return null;
}

function parseAmount(value, decimals, label = '--amount') {
  if (typeof value !== 'string' || !/^\d+(\.\d+)?$/.test(value)) blocked(`${label} must be a positive decimal token amount`);
  let amount;
  try {
    amount = ethers.parseUnits(value, decimals);
  } catch {
    blocked(`${label} has more than ${decimals} decimals`);
  }
  if (amount <= 0n) blocked(`${label} must be above 0`);
  return amount;
}

function parseBool(value, label) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  blocked(`${label} must be true or false`);
  return null;
}

// Loads the instance an action targets: the active one, or a retired one named with --instance.
export function resolveInstance(module, instanceAddress = null) {
  const active = module.instances.chikun;
  if (instanceAddress === null) return { ...active, retired: false };
  const wanted = String(instanceAddress).toLowerCase();
  if (wanted === active.address) return { ...active, retired: false };
  const retired = active.retired.find((entry) => entry.address === wanted);
  if (!retired) blocked(`--instance ${instanceAddress} is neither the active nor a retired instance of the jackpot module`);
  return { ...retired, retired: true };
}

async function nowWeek(provider) {
  const block = await provider.getBlock('latest');
  return { timestamp: block.timestamp, week: weekIndexOf(block.timestamp) };
}

function formatUnits(value, decimals) {
  return ethers.formatUnits(value, decimals);
}

// Read-only snapshot of an instance (works for the undeployed module too).
export async function readJackpotStatus({ provider, module, instanceAddress = null }) {
  const chainId = await rpcChainId(provider);
  if (module.status !== 'deployed') return { chainId, module: module.status, deployed: false, note: 'the jackpot module is undeployed: there is no contract to read yet (runbook E4 deploys it)' };
  const instance = resolveInstance(module, instanceAddress);
  const jackpot = contractAt('WeeklyJackpot', instance.address, provider);
  const token = contractAt('TestChikunToken', instance.token.address, provider);
  const code = await provider.getCode(instance.address);
  if (!code || code === '0x') return { chainId, module: module.status, deployed: false, note: `no contract code at ${instance.address} on this chain` };
  const { timestamp, week: current } = await nowWeek(provider);
  const [operator, pendingOperator, admin, pendingAdmin, keeper, residualRecipient, pendingResidualRecipient, adminPaused, operatorPaused, liabilities, residual, residualAvailableAt, endAfterWeek, firstWeek, rulesCount, balance] = await Promise.all([
    jackpot.operator(), jackpot.pendingOperator(), jackpot.admin(), jackpot.pendingAdmin(), jackpot.keeper(), jackpot.residualRecipient(), jackpot.pendingResidualRecipient(),
    jackpot.adminPaused(), jackpot.operatorPaused(), jackpot.liabilities(), jackpot.residual(), jackpot.residualAvailableAt(), jackpot.endAfterWeek(), jackpot.firstWeek(), jackpot.rulesCount(),
    token.balanceOf(instance.address),
  ]);
  const weekView = async (week) => {
    const [pot, state, candidates, rules] = await Promise.all([jackpot.potOf(week), jackpot.weekState(week), jackpot.candidatesOf(week), jackpot.rulesFor(week)]);
    const minFundWei = rules.minFundWei;
    const cap = rules.maxPrizeWei;
    const reviews = await Promise.all(candidates.map((row) => Promise.all([jackpot.reviewOf(row.sessionId), jackpot.adminReviewed(row.sessionId)])));
    return {
      week,
      key: weekKeyOf(week),
      bounds: weekBoundsOf(week, Number(state.extension)),
      status: ['open', 'paid', 'rolled-over'][Number(state.status)],
      held: state.held,
      funded: pot.funded.toString(),
      carriedIn: pot.carriedIn.toString(),
      pot: pot.total.toString(),
      fundedEnough: pot.total >= minFundWei,
      payable: (cap !== 0n && pot.total > cap ? cap : pot.total).toString(),
      prize: state.prize.toString(),
      winner: state.winner === ethers.ZeroAddress ? null : state.winner.toLowerCase(),
      unclaimed: state.unclaimed.toString(),
      candidates: candidates.map((row, index) => ({
        rank: index + 1,
        sessionId: row.sessionId,
        player: row.player.toLowerCase(),
        score: row.score.toString(),
        submittedAt: Number(row.submittedAt),
        review: ['none', 'cleared', 'flagged', 'disqualified'][Number(reviews[index][0])],
        adminReviewed: reviews[index][1],
      })),
    };
  };
  const epochs = [];
  for (let index = 0; index < Number(rulesCount); index += 1) epochs.push(rulesToJson(rulesFromChain(await jackpot.rulesAt(index))));
  const weeks = [await weekView(current)];
  if (current - 1 >= Number(firstWeek)) weeks.push(await weekView(current - 1));
  const keeperBalance = keeper === ethers.ZeroAddress ? null : (await provider.getBalance(keeper)).toString();
  return {
    chainId,
    module: module.status,
    deployed: true,
    instance: instance.address,
    retiredInstance: instance.retired,
    blockTimestamp: timestamp,
    token: { ...instance.token, jackpotBalance: balance.toString() },
    roles: {
      operator: operator.toLowerCase(),
      pendingOperator: pendingOperator === ethers.ZeroAddress ? null : pendingOperator.toLowerCase(),
      admin: admin.toLowerCase(),
      pendingAdmin: pendingAdmin === ethers.ZeroAddress ? null : pendingAdmin.toLowerCase(),
      keeper: keeper === ethers.ZeroAddress ? null : keeper.toLowerCase(),
      residualRecipient: residualRecipient.toLowerCase(),
      pendingResidualRecipient: pendingResidualRecipient === ethers.ZeroAddress ? null : pendingResidualRecipient.toLowerCase(),
    },
    paused: { admin: adminPaused, operator: operatorPaused, any: adminPaused || operatorPaused },
    firstWeek: { index: Number(firstWeek), key: weekKeyOf(Number(firstWeek)) },
    currentWeek: { index: current, key: weekKeyOf(current) },
    weeks,
    liabilities: liabilities.toString(),
    residual: residual.toString(),
    residualAvailableAt: Number(residualAvailableAt),
    endAfterWeek: Number(endAfterWeek) === 0 ? null : { index: Number(endAfterWeek), key: weekKeyOf(Number(endAfterWeek)) },
    rules: { inForce: rulesToJson(rulesFromChain(await jackpot.rulesFor(current))), epochs },
    keeperBalanceWei: keeperBalance,
    retired: module.instances.chikun.retired.map((entry) => ({ address: entry.address, endAfterWeek: entry.endAfterWeek, endAfterWeekKey: weekKeyOf(entry.endAfterWeek) })),
  };
}

function call(contract, target, method, args, extra = {}) {
  return { contract, to: String(target.target).toLowerCase(), method, args, data: target.interface.encodeFunctionData(method, args), ...extra };
}

// Reads the chain and returns the calls an action would send (no-ops are left out, with a note).
export async function planJackpotAction({ action, args = [], argv = [], provider, module, instanceAddress = null, from = null }) {
  const spec = JACKPOT_ACTIONS[action];
  if (!spec || action === 'status') blocked(`unknown action ${JSON.stringify(action)}\n${jackpotHelp()}`);
  if (module.status !== 'deployed') blocked(`the jackpot module is '${module.status}': there is no contract to act on yet`);
  const instance = resolveInstance(module, instanceAddress);
  const code = await provider.getCode(instance.address);
  if (!code || code === '0x') blocked(`no contract code at the jackpot ${instance.address}: it is not deployed on this chain`);
  const jackpot = contractAt('WeeklyJackpot', instance.address, provider);
  const token = contractAt('TestChikunToken', instance.token.address, provider);
  const decimals = instance.token.decimals;
  const { week: current } = await nowWeek(provider);
  const calls = [];
  const notes = [];
  let week = null;
  if (action === 'mint-test') {
    if (instance.token.testnet !== true || instance.token.symbol !== 'tCHIKUN') blocked('mint-test only mints the tCHIKUN test token; this instance has another token');
    const to = parseAddress(flagValue(argv, '--to'), '--to');
    const amount = parseAmount(flagValue(argv, '--amount'), decimals);
    if (amount > (await token.MAX_MINT_PER_CALL())) blocked('--amount is above the per-call mint cap (10,000,000 tCHIKUN)');
    calls.push(call('TestChikunToken', token, 'mint', [to, amount]));
    notes.push(`mint ${formatUnits(amount, decimals)} tCHIKUN (no value) to ${to.toLowerCase()}; minter on chain ${String(await token.minter()).toLowerCase()}`);
  } else if (action === 'fund') {
    week = parseWeekArg(flagValue(argv, '--week') ?? 'current', current, '--week');
    const amount = parseAmount(flagValue(argv, '--amount'), decimals);
    const firstWeek = Number(await jackpot.firstWeek());
    const end = Number(await jackpot.endAfterWeek());
    if (week < Math.max(firstWeek, current) || week > current + MAX_FUND_AHEAD_WEEKS) blocked(`--week ${weekKeyOf(week)} cannot be funded now: only ${weekKeyOf(Math.max(firstWeek, current))} to ${weekKeyOf(current + MAX_FUND_AHEAD_WEEKS)}`);
    if (end !== 0 && week > end) blocked(`--week ${weekKeyOf(week)} is after the scheduled end ${weekKeyOf(end)} (FUNDED_AFTER_END)`);
    const minFund = (await jackpot.rulesFor(week)).minFundWei;
    if (amount < minFund) blocked(`--amount is below the week's minFundWei ${formatUnits(minFund, decimals)} (BELOW_MIN_FUND)`);
    if (week > current + 2) notes.push('design §E11: fund at most one or two weeks ahead; the rules of a future week can still change before it starts');
    if (from) {
      const balance = await token.balanceOf(from);
      if (balance < amount) notes.push(`${from.toLowerCase()} holds only ${formatUnits(balance, decimals)} ${instance.token.symbol}`);
    }
    calls.push(call(instance.token.symbol, token, 'approve', [ethers.getAddress(instance.address), amount]));
    calls.push(call('WeeklyJackpot', jackpot, 'fund', [week, amount], { week: weekKeyOf(week) }));
  } else if (action === 'set-keeper') {
    const next = parseAddress(args[0], 'set-keeper <address|none>', { allowNone: true });
    const previous = await jackpot.keeper();
    if (previous === next) notes.push(`the keeper is already ${next}`);
    else calls.push(call('WeeklyJackpot', jackpot, 'setKeeper', [next]));
    if (previous !== ethers.ZeroAddress && previous !== next) notes.push(`${SET_KEEPER_REMINDER} Outgoing keeper: ${previous.toLowerCase()}.`);
  } else if (action === 'schedule-rules') {
    week = parseWeekArg(flagValue(argv, '--from-week'), current, '--from-week');
    const firstWeek = Number(await jackpot.firstWeek());
    if (week <= current) blocked(`--from-week ${weekKeyOf(week)} has started (RULES_NOT_FUTURE): the rules of a started week never change`);
    if (week > current + MAX_FUND_AHEAD_WEEKS) blocked(`--from-week ${weekKeyOf(week)} is more than ${MAX_FUND_AHEAD_WEEKS} weeks ahead (RULES_TOO_FAR)`);
    if (week < firstWeek) blocked(`--from-week ${weekKeyOf(week)} is before the instance's first week ${weekKeyOf(firstWeek)}`);
    const base = flagValue(argv, '--rules');
    const fromFile = base !== null && base !== 'launch';
    let rules;
    if (base === 'launch') rules = launchRulesFor({ fromWeek: week });
    else if (fromFile) {
      let json;
      try { json = JSON.parse(readFileSync(base, 'utf8')); } catch (error) { blocked(`--rules ${base}: ${error?.code ?? 'not valid JSON'}`); }
      rules = json;
    } else rules = rulesFromChain(await jackpot.rulesFor(week));
    const overrides = {};
    const value = (flag) => flagValue(argv, flag);
    if (value('--admin-clear-only') !== null) overrides.adminClearOnly = parseBool(value('--admin-clear-only'), '--admin-clear-only');
    if (value('--max-prize') !== null) overrides.maxPrizeWei = value('--max-prize') === '0' ? 0n : parseAmount(value('--max-prize'), decimals, '--max-prize');
    if (value('--min-fund') !== null) overrides.minFundWei = parseAmount(value('--min-fund'), decimals, '--min-fund');
    if (value('--min-paid-wei') !== null) overrides.minPaidWei = value('--min-paid-wei');
    if (value('--max-survival') !== null) overrides.maxSurvivalSeconds = value('--max-survival');
    if (value('--max-score') !== null) overrides.maxScore = value('--max-score');
    if (value('--season') !== null) overrides.seasonId = seasonId32(value('--season'));
    if (value('--alt-season') !== null) overrides.altSeasonId = value('--alt-season') === 'none' ? ethers.ZeroHash : seasonId32(value('--alt-season'));
    try {
      // A rules file (with the flags on top) must state every safety field: no silent weakest defaults.
      rules = normalizeRules({ ...rules, ...overrides }, { fromWeek: week, strict: fromFile });
    } catch (error) {
      blocked(`the rules are invalid: ${error.message}`);
    }
    // Design J16 / OJ6: on a real-value token instance every epoch keeps adminClearOnly and a prize cap.
    const problems = instance.token.testnet === true ? [] : realValueRuleProblems(rules);
    if (problems.length) blocked(`this instance's token ${instance.token.symbol} is not a test token, and design J16/OJ6 make ${problems.join(' and ')} mandatory for real-value prizes`);
    const pending = [];
    for (let index = 0; index < Number(await jackpot.rulesCount()); index += 1) {
      const epoch = await jackpot.rulesAt(index);
      if (Number(epoch.fromWeek) >= week) pending.push(weekKeyOf(Number(epoch.fromWeek)));
    }
    if (pending.length) notes.push(`replaces the pending epoch(s) from ${pending.join(', ')}`);
    notes.push(`rules from ${weekKeyOf(week)}: ${JSON.stringify(rulesToJson(rules))}`);
    calls.push(call('WeeklyJackpot', jackpot, 'scheduleRules', [rules], { week: weekKeyOf(week) }));
  } else if (action === 'force-admin') {
    const next = parseAddress(args[0], 'force-admin <address>');
    const previous = await jackpot.admin();
    if (previous === next) notes.push(`the admin is already ${next}`);
    else calls.push(call('WeeklyJackpot', jackpot, 'forceAdmin', [next]));
    notes.push('Emergency stop 5: operator-pause first, force-admin, then the new admin reviews every decision the old one made; operator-unpause last.');
  } else if (action === 'operator-pause' || action === 'operator-unpause') {
    const wanted = action === 'operator-pause';
    if ((await jackpot.operatorPaused()) === wanted) notes.push(`the operator pause is already ${wanted ? 'on' : 'off'}`);
    else calls.push(call('WeeklyJackpot', jackpot, wanted ? 'operatorPause' : 'operatorUnpause', []));
    if (wanted) notes.push('The pause stops payouts and keeper clears only; funding, submissions and claims continue. The admin cannot lift it.');
    else if (await jackpot.adminPaused()) notes.push('the admin pause is still on: payouts stay stopped until the admin unpauses');
  } else if (action === 'schedule-end') {
    week = parseWeekArg(args[0], current, 'schedule-end <week>');
    const end = Number(await jackpot.endAfterWeek());
    if (week <= current) blocked(`schedule-end ${weekKeyOf(week)} gives less than one full week's notice (END_TOO_SOON)`);
    if (end !== 0 && current > end) blocked(`the end after ${weekKeyOf(end)} is final (END_FINAL)`);
    calls.push(call('WeeklyJackpot', jackpot, 'scheduleEnd', [week], { week: weekKeyOf(week) }));
    notes.push(`After ${weekKeyOf(week)}: no funding or submissions for later weeks; carries go to the residue; funders refund-after-end their later-week funding once ${weekKeyOf(week)} is over. Announce it.`);
  } else if (action === 'cancel-end') {
    const end = Number(await jackpot.endAfterWeek());
    if (end === 0) blocked('no end is scheduled');
    if (current > end) blocked(`the end after ${weekKeyOf(end)} is final (END_FINAL)`);
    calls.push(call('WeeklyJackpot', jackpot, 'cancelEnd', []));
  } else if (action === 'recover-residual') {
    const [residual, availableAt, recipient] = await Promise.all([jackpot.residual(), jackpot.residualAvailableAt(), jackpot.residualRecipient()]);
    const { timestamp } = await nowWeek(provider);
    if (residual === 0n) blocked('there is no residue to recover');
    if (timestamp < Number(availableAt)) blocked(`the residue is available from ${new Date(Number(availableAt) * 1000).toISOString()} (TOO_EARLY)`);
    calls.push(call('WeeklyJackpot', jackpot, 'recoverResidual', []));
    notes.push(`sends ${formatUnits(residual, decimals)} ${instance.token.symbol} to the residual recipient ${recipient.toLowerCase()}`);
  } else if (action === 'sweep-stray') {
    const stray = parseAddress(args[0], 'sweep-stray <token address>');
    const isPrize = stray.toLowerCase() === instance.token.address;
    const balance = await contractAt('TestChikunToken', stray, provider).balanceOf(instance.address);
    const liabilities = await jackpot.liabilities();
    const amount = isPrize ? (balance > liabilities ? balance - liabilities : 0n) : balance;
    if (amount === 0n) notes.push('nothing to sweep: the balance is all owed');
    else calls.push(call('WeeklyJackpot', jackpot, 'sweepStray', [stray]));
    notes.push(`sweeps ${amount} base units of ${stray.toLowerCase()} to the residual recipient ${String(await jackpot.residualRecipient()).toLowerCase()} (never a liability)`);
  } else if (action === 'finalize') {
    week = parseWeekArg(args[0], current, 'finalize <week>');
    calls.push(call('WeeklyJackpot', jackpot, 'finalize', [week], { week: weekKeyOf(week) }));
    try {
      await jackpot.finalize.staticCall(week, { from: from ?? ethers.ZeroAddress });
      notes.push(`finalize(${weekKeyOf(week)}) would succeed now`);
    } catch (error) {
      notes.push(`finalize(${weekKeyOf(week)}) would revert now: ${error?.reason ?? error?.shortMessage ?? 'unknown'}`);
    }
  } else if (action === 'refund-after-end') {
    week = parseWeekArg(args[0], current, 'refund-after-end <week>');
    const end = Number(await jackpot.endAfterWeek());
    if (end === 0 || week <= end || current <= end) blocked(`refund-after-end ${weekKeyOf(week)} is not possible: it needs a final end before that week (NOT_AFTER_END)`);
    if (from) {
      const owed = await jackpot.fundedBy(week, from);
      if (owed === 0n) blocked(`${from.toLowerCase()} funded nothing in ${weekKeyOf(week)} (NOTHING_TO_REFUND)`);
      notes.push(`refunds ${formatUnits(owed, decimals)} ${instance.token.symbol} to ${from.toLowerCase()}`);
    }
    calls.push(call('WeeklyJackpot', jackpot, 'refundAfterEnd', [week], { week: weekKeyOf(week) }));
  }
  return { action, confirm: spec.confirm, role: spec.role, instance: instance.address, retiredInstance: instance.retired, week: week === null ? null : weekKeyOf(week), calls, notes };
}

// Checks that `signer` may send the planned calls (the on-chain role), before anything is sent.
async function checkSignerRole({ plan, provider, signerAddress, module, instanceAddress, args }) {
  const instance = resolveInstance(module, instanceAddress);
  const jackpot = contractAt('WeeklyJackpot', instance.address, provider);
  if (plan.role === 'operator') {
    const onChain = String(await jackpot.operator()).toLowerCase();
    if (onChain !== signerAddress) blocked(`the signer ${signerAddress} is not the jackpot operator (${onChain})`);
  } else if (plan.role === 'minter') {
    const minter = String(await contractAt('TestChikunToken', instance.token.address, provider).minter()).toLowerCase();
    if (minter !== signerAddress) blocked(`the signer ${signerAddress} is not the tCHIKUN minter (${minter})`);
  } else if (plan.role === 'funder') {
    const { week: current } = await nowWeek(provider);
    const week = parseWeekArg(args[0], current);
    if ((await jackpot.fundedBy(week, signerAddress)) === 0n) blocked(`the signer ${signerAddress} funded nothing in ${weekKeyOf(week)}: refund-after-end runs from the funder's own key`);
  } else if (plan.role === 'any' && plan.action === 'fund') {
    const amount = plan.calls.find((entry) => entry.method === 'fund')?.args[1] ?? 0n;
    const balance = await contractAt('TestChikunToken', instance.token.address, provider).balanceOf(signerAddress);
    if (balance < amount) blocked(`the signer ${signerAddress} holds less than the amount to fund`);
  }
}

// Dry run unless `broadcast`; a broadcast needs the confirm phrase, a deployed module and the role.
export async function runJackpotAction({ action, args = [], argv = [], provider, module, signer = null, broadcast = false, confirm = null, instanceAddress = null, from = null, log = () => {} }) {
  const spec = JACKPOT_ACTIONS[action];
  if (!spec) blocked(`unknown action ${JSON.stringify(action)}\n${jackpotHelp()}`);
  const chainId = await rpcChainId(provider);
  if (chainId !== JACKPOT_CHAIN_ID) blocked(`the RPC is on chain ${chainId}, expected ${JACKPOT_CHAIN_ID}`);
  if (action === 'status') return { action, status: await readJackpotStatus({ provider, module, instanceAddress }) };
  if (broadcast) {
    if (confirm !== spec.confirm) blocked(`broadcast blocked: ${action} needs --confirm ${spec.confirm}`);
    if (module.status !== 'deployed') blocked(`broadcast blocked: the jackpot module is '${module.status}', not 'deployed'`);
    if (!signer) blocked('broadcast blocked: no signer');
  }
  const signerAddress = signer ? (await signer.getAddress()).toLowerCase() : null;
  const plan = await planJackpotAction({ action, args, argv, provider, module, instanceAddress, from: signerAddress ?? from });
  for (const note of plan.notes) log(note);
  if (!broadcast) return { action, dryRun: true, plan, receipts: [] };
  await checkSignerRole({ plan, provider, signerAddress, module, instanceAddress, args });
  const receipts = [];
  for (const entry of plan.calls) {
    const tx = await signer.sendTransaction({ to: entry.to, data: entry.data });
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) blocked(`${entry.method} failed in ${tx.hash}`);
    log(`sent ${entry.contract}.${entry.method}${entry.week ? ` (${entry.week})` : ''}: ${tx.hash}`);
    receipts.push({ method: entry.method, txHash: tx.hash, blockNumber: receipt.blockNumber });
  }
  return { action, dryRun: false, plan, receipts };
}

const toJson = (value) => JSON.stringify(value, (_key, item) => (typeof item === 'bigint' ? item.toString() : item), 2);

function printStatus(status, log) {
  if (!status.deployed) {
    log(`chain ${status.chainId} · jackpot module ${status.module} · ${status.note}`);
    return;
  }
  const units = (value) => `${ethers.formatUnits(value, status.token.decimals)} ${status.token.symbol}`;
  log(`chain ${status.chainId} · jackpot ${status.instance}${status.retiredInstance ? ' (retired)' : ''} · token ${status.token.address} (${status.token.symbol}${status.token.testnet ? ', test token, no value' : ''})`);
  const roles = status.roles;
  log(`roles: operator ${roles.operator}${roles.pendingOperator ? ` (pending ${roles.pendingOperator})` : ''} · admin ${roles.admin}${roles.pendingAdmin ? ` (pending ${roles.pendingAdmin})` : ''} · keeper ${roles.keeper ?? 'none'} · residual recipient ${roles.residualRecipient}${roles.pendingResidualRecipient ? ` (nominee ${roles.pendingResidualRecipient})` : ''}`);
  log(`paused: admin ${status.paused.admin} · operator ${status.paused.operator}`);
  log(`current week ${status.currentWeek.key} (${status.currentWeek.index}) · first week ${status.firstWeek.key} · end ${status.endAfterWeek ? `after ${status.endAfterWeek.key}` : 'none scheduled'}`);
  for (const week of status.weeks) {
    log(`  ${week.key}: ${week.status}${week.held ? ' (held)' : ''} · pot ${units(week.pot)} (funded ${units(week.funded)}, carried ${units(week.carriedIn)}) · ${week.fundedEnough ? `winner can receive ${units(week.payable)}` : 'below minFundWei (unfunded)'}${week.winner ? ` · winner ${week.winner} prize ${units(week.prize)}` : ''}${week.unclaimed !== '0' ? ` · CLAIM PENDING ${units(week.unclaimed)}` : ''}`);
    for (const row of week.candidates) log(`     #${row.rank} ${row.player} score ${row.score} ${row.review}${row.adminReviewed ? ' (admin)' : ''} ${row.sessionId}`);
  }
  log(`liabilities ${units(status.liabilities)} · jackpot balance ${units(status.token.jackpotBalance)} · residual ${units(status.residual)}${status.residual !== '0' ? ` (available ${new Date(status.residualAvailableAt * 1000).toISOString()})` : ''}`);
  const rules = status.rules.inForce;
  log(`rules in force: minPaidWei ${rules.minPaidWei} · minFund ${units(rules.minFundWei)} · prize cap ${rules.maxPrizeWei === '0' ? 'none' : units(rules.maxPrizeWei)} · survival cap ${rules.maxSurvivalSeconds || 'none'} s · score cap ${rules.maxScore === '0' ? 'none' : rules.maxScore} · adminClearOnly ${rules.adminClearOnly} · ${status.rules.epochs.length} epoch(s)`);
  log(`keeper balance ${status.keeperBalanceWei === null ? 'n/a' : `${ethers.formatEther(status.keeperBalanceWei)} zkLTC${BigInt(status.keeperBalanceWei) < 50_000_000_000_000_000n ? ' (BELOW 0.05: top it up)' : ''}`}`);
  for (const entry of status.retired) log(`retired instance ${entry.address} (ended after ${entry.endAfterWeekKey})`);
}

function printPlan(result, log) {
  if (result.dryRun) log(`DRY RUN: ${result.action} would send ${result.plan.calls.length} transaction(s). Nothing was signed or sent.`);
  for (const entry of result.plan.calls) log(`  ${entry.contract} ${entry.to} ${entry.method}(${entry.args.map((arg) => (typeof arg === 'object' ? JSON.stringify(rulesToJson(arg)) : String(arg))).join(', ')})${entry.week ? ` [${entry.week}]` : ''}`);
  if (result.dryRun && result.plan.calls.length > 0) log(`To send: add --broadcast --confirm ${result.plan.confirm} and the key (--key-env <NAME> or --key-file <path> --key-field <field>).`);
  if (!result.dryRun) log(`Sent ${result.receipts.length} transaction(s).`);
}

// CLI body, injectable for tests. Returns an exit code.
export async function runJackpotCli({
  argv = process.argv.slice(2),
  env = process.env,
  log = console.log,
  providerFactory = (url) => new ethers.JsonRpcProvider(url, JACKPOT_CHAIN_ID, { staticNetwork: true, cacheTimeout: -1 }),
} = {}) {
  const [action, ...rest] = argv;
  if (!action || action === '--help' || action === 'help' || !JACKPOT_ACTIONS[action]) {
    log(jackpotHelp());
    return action && action !== '--help' && action !== 'help' ? 2 : 0;
  }
  let provider = null;
  try {
    const positional = [];
    for (let index = 0; index < rest.length; index += 1) {
      const flag = rest[index].split('=')[0];
      if (rest[index].startsWith('--')) {
        if (!VALUE_FLAGS.has(flag) && !BOOLEAN_FLAGS.has(flag)) blocked(`unknown option ${rest[index]}`);
        if (VALUE_FLAGS.has(flag) && !rest[index].includes('=')) index += 1;
        continue;
      }
      positional.push(rest[index]);
    }
    const broadcast = hasFlag(argv, '--broadcast');
    const confirm = flagValue(argv, '--confirm');
    const rpcFlag = flagValue(argv, '--rpc');
    const loopback = rpcFlag !== null && isLoopbackRpc(rpcFlag);
    if (rpcFlag !== null && !loopback) blocked('--rpc is honoured only for a loopback RPC (the local chain)');
    const deploymentOverride = flagValue(argv, '--deployment');
    if (deploymentOverride !== null && !loopback) blocked('--deployment is honoured only with a loopback --rpc; against LiteForge the committed jackpot module is used');
    const fromFlag = flagValue(argv, '--from');
    const from = fromFlag === null ? null : parseAddress(fromFlag, '--from');
    const module = await loadLitvmJackpot(deploymentOverride);
    if (broadcast && action !== 'status') {
      // All guards before the key is read.
      if (confirm !== JACKPOT_ACTIONS[action].confirm) blocked(`broadcast blocked: ${action} needs --confirm ${JACKPOT_ACTIONS[action].confirm}`);
      if (module.status !== 'deployed') blocked(`broadcast blocked: the jackpot module is '${module.status}', not 'deployed'`);
    }
    provider = providerFactory(rpcFlag ?? DEFAULT_RPC_URL);
    const chainId = await rpcChainId(provider);
    if (chainId !== JACKPOT_CHAIN_ID) blocked(`the RPC is on chain ${chainId}, expected ${JACKPOT_CHAIN_ID}. Nothing was read or sent.`);
    const signer = broadcast && action !== 'status' ? new ethers.Wallet(readSecret({ env, argv, label: `${action} key` }), provider) : null;
    if (signer) log(`Signer ${signer.address}.`);
    const result = await runJackpotAction({ action, args: positional, argv, provider, module, signer, broadcast, confirm, instanceAddress: flagValue(argv, '--instance'), from, log });
    if (action === 'status') {
      if (hasFlag(argv, '--json')) log(toJson(result.status));
      else printStatus(result.status, log);
      return 0;
    }
    if (hasFlag(argv, '--json')) log(toJson({ dryRun: result.dryRun, plan: { ...result.plan, calls: result.plan.calls.map(({ data, ...entry }) => ({ ...entry, data })) }, receipts: result.receipts }));
    else printPlan(result, log);
    if (action === 'set-keeper' && result.plan.calls.length > 0) log(SET_KEEPER_REMINDER);
    return 0;
  } catch (error) {
    if (error instanceof ActionBlocked || error instanceof SecretSourceError) {
      log(`Blocked: ${error.message}`);
      return 2;
    }
    throw error;
  } finally {
    provider?.destroy?.();
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isMain) {
  try {
    process.exitCode = await runJackpotCli();
  } catch (error) {
    console.error(`jackpot-actions: ${error?.shortMessage ?? error?.message ?? error}`);
    process.exitCode = 1;
  }
}
