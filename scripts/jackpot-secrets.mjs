// Vercel production secrets for the Chikun Weekly Jackpot keeper (design §C.1, J9, runbook step E6;
// contract §11 rule 13).
//
//   node scripts/jackpot-secrets.mjs --key-file <vault jackpot-keeper.json> [--key-field privateKey]
//        [--jackpot <module.mjs>] [--scope <team>] [--vercel-bin <command>]
//        [--apply --confirm SET_JACKPOT_SECRETS]
//
// Sets, in the PRODUCTION environment only:
//   JACKPOT_KEEPER_PRIVATE_KEY  from the key file field (scripts/jackpot-keeper-key.mjs writes
//                               { address, privateKey }); its address must equal the jackpot module's
//                               keeper, and must not be the settle relayer or verifier (J9)
//   JACKPOT_CONTRACT_ADDRESS    the chikun instance address from LITVM_JACKPOT (the committed module)
//
// Every value travels to `vercel env add <NAME> production --sensitive --force --yes` on STDIN (the
// runner from scripts/vercel-secrets.mjs, piped stdio), never as an argument, and is never printed.
// The operator key never goes into Vercel: a --key-field named like the operator's, the deployer's, the
// admin's or the owner's is refused before the file is read. The dry run (default) reads and checks the
// inputs and prints names only. --apply needs the confirm phrase and the committed module in state
// 'deployed' (--jackpot is for dry runs only). After applying it lists production again and checks
// both names are there. JACKPOT_PAUSED, JACKPOT_UI_HIDDEN and the client flag JACKPOT_LIVE are never
// touched here: flipping them is a separate, owner-approved runbook step.
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ethers } from 'ethers';
import { LITVM_DEPLOYMENT } from '../apps/portal/src/generated/litvm-addresses.mjs';
import { LITVM_JACKPOT } from '../apps/portal/src/generated/litvm-jackpot.mjs';
import { flagValue, hasFlag, readSecret } from './lib/key-source.mjs';
import { ENV_LS_ARGS, createVercelRunner, defaultVercelCommand, envNamesFromLsJson } from './vercel-secrets.mjs';

export const JACKPOT_APPLY_CONFIRM = 'SET_JACKPOT_SECRETS';
export const JACKPOT_SECRET_NAMES = Object.freeze(['JACKPOT_KEEPER_PRIVATE_KEY', 'JACKPOT_CONTRACT_ADDRESS']);
export const DEFAULT_KEEPER_FIELD = 'privateKey';
// Key-file fields that name another role's key. The keeper key is its own file (jackpot-keeper-key.mjs).
export const OPERATOR_LIKE_FIELD = /operator|deployer|owner|admin|verifier|relayer|mnemonic|seed/i;
const ADDRESS = /^0x[0-9a-f]{40}$/;
const KNOWN_OPTIONS = new Set(['--key-file', '--key-field', '--jackpot', '--scope', '--vercel-bin', '--apply', '--confirm']);
const VALUE_OPTIONS = new Set(['--key-file', '--key-field', '--jackpot', '--scope', '--vercel-bin', '--confirm']);

function unknownOption(argv) {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = String(argv[index]);
    const flag = arg.includes('=') ? arg.slice(0, arg.indexOf('=')) : arg;
    if (!KNOWN_OPTIONS.has(flag)) return arg.startsWith('--') ? flag : 'a positional argument';
    if (VALUE_OPTIONS.has(flag) && !arg.includes('=')) index += 1;
  }
  return null;
}

function redact(text, secrets) {
  let out = String(text ?? '');
  for (const secret of secrets) if (secret) out = out.split(secret).join('[redacted]');
  return out.slice(-400);
}

async function loadJackpotModule(path) {
  if (!path) return LITVM_JACKPOT;
  const module = await import(pathToFileURL(resolve(path)).href);
  if (!module.LITVM_JACKPOT) throw new Error(`${path} does not export LITVM_JACKPOT`);
  return module.LITVM_JACKPOT;
}

// The planned entries (values held in memory only). Throws on any mismatch.
export function prepareJackpotSecrets({ argv, env = process.env, jackpot, deployment = LITVM_DEPLOYMENT, readFile = null }) {
  const instance = jackpot?.instances?.chikun ?? null;
  const contract = String(instance?.address ?? '').toLowerCase();
  const keeper = String(instance?.keeper ?? '').toLowerCase();
  const entries = [];
  const keyFile = flagValue(argv, '--key-file');
  if (keyFile) {
    const field = flagValue(argv, '--key-field') ?? DEFAULT_KEEPER_FIELD;
    if (OPERATOR_LIKE_FIELD.test(field)) throw new Error(`refusing --key-field "${field}": it names another role's key. Only the keeper key (scripts/jackpot-keeper-key.mjs) goes into Vercel; the operator key never does.`);
    const key = readSecret({ env, argv: ['--key-file', keyFile, '--key-field', field], label: 'keeper key', ...(readFile ? { readFile } : {}) });
    const address = new ethers.Wallet(key).address.toLowerCase();
    for (const [role, other] of [['settle relayer', deployment?.relayer], ['trusted verifier', deployment?.trustedVerifier], ['jackpot admin', instance?.admin], ['residual recipient', instance?.residualRecipient]]) {
      if (typeof other === 'string' && other.toLowerCase() === address) throw new Error(`the key (field "${field}") is the ${role}'s (${address}); the keeper key must be its own (J9)`);
    }
    if (ADDRESS.test(keeper) && address !== keeper) throw new Error(`the key (field "${field}") is for ${address}, but the jackpot module's keeper is ${keeper}`);
    entries.push({ name: 'JACKPOT_KEEPER_PRIVATE_KEY', source: `--key-file field "${field}" (address ${address})`, value: key });
  } else {
    entries.push({ name: 'JACKPOT_KEEPER_PRIVATE_KEY', source: '--key-file not given, not checked', value: null });
  }
  entries.push({ name: 'JACKPOT_CONTRACT_ADDRESS', source: `jackpot module (${jackpot?.status ?? 'unavailable'})`, value: ADDRESS.test(contract) ? contract : null, isPublic: true });
  return entries;
}

// Returns an exit code. `runVercel(args, { stdin })` → { code, stdout, stderr }.
export async function runJackpotSecrets({
  argv = process.argv.slice(2),
  env = process.env,
  runVercel = null,
  spawnImpl = spawn,
  readFile = null,
  log = console.log,
  deployment = LITVM_DEPLOYMENT,
  // Tests only (the CLI never sets them): a jackpot module in place of the committed one, also for --apply.
  jackpotModule = null,
  allowJackpotOverride = false,
} = {}) {
  const unknown = unknownOption(argv);
  if (unknown) {
    log(`Blocked: unknown option ${unknown}.`);
    return 2;
  }
  const apply = hasFlag(argv, '--apply');
  if (apply && flagValue(argv, '--confirm') !== JACKPOT_APPLY_CONFIRM) {
    log(`Apply blocked: add --confirm ${JACKPOT_APPLY_CONFIRM}.`);
    return 2;
  }
  if (apply && flagValue(argv, '--jackpot') !== null) {
    log('Apply blocked: --jackpot is for dry runs. --apply always takes JACKPOT_CONTRACT_ADDRESS from the committed module (LITVM_JACKPOT).');
    return 2;
  }
  const jackpot = (allowJackpotOverride && jackpotModule) ? jackpotModule : await loadJackpotModule(flagValue(argv, '--jackpot'));
  if (apply && jackpot?.status !== 'deployed') {
    log(`Apply blocked: the jackpot module is '${jackpot?.status ?? 'unavailable'}', not 'deployed'. JACKPOT_CONTRACT_ADDRESS must come from the deployed record.`);
    return 2;
  }
  if (apply && !flagValue(argv, '--key-file')) {
    log('Apply blocked: --key-file <vault jackpot-keeper.json> is required.');
    return 2;
  }
  const entries = prepareJackpotSecrets({ argv, env, jackpot, deployment, readFile });
  if (apply && entries.some((entry) => entry.value === null)) {
    log('Apply blocked: the keeper key or the contract address is missing.');
    return 2;
  }
  const vercel = runVercel ?? createVercelRunner({ spawnImpl, ...defaultVercelCommand(flagValue(argv, '--vercel-bin')), scope: flagValue(argv, '--scope') });
  const secrets = () => entries.map((entry) => entry.value).filter(Boolean);

  const listed = await vercel(['env', 'ls', 'production', ...ENV_LS_ARGS]);
  if (listed.code !== 0) {
    log(`vercel env ls production ${ENV_LS_ARGS.join(' ')} failed (exit ${listed.code}); nothing was changed.`);
    return 1;
  }
  let existing;
  try {
    existing = envNamesFromLsJson(listed.stdout);
  } catch (error) {
    log(`Refusing to continue: could not read the production names (${error.message}); nothing was changed.`);
    return 1;
  }
  for (const entry of entries) log(`${apply ? 'set' : 'would set'} ${entry.name} in production (${entry.source})${existing.has(entry.name) ? ', replacing the existing value' : ''}`);
  if (!apply) {
    log(`DRY RUN: names only, nothing was written. Apply with --apply --confirm ${JACKPOT_APPLY_CONFIRM}. JACKPOT_PAUSED and JACKPOT_UI_HIDDEN are not touched.`);
    return 0;
  }
  for (const entry of entries) {
    const added = await vercel(['env', 'add', entry.name, 'production', '--sensitive', '--force', '--yes'], { stdin: entry.value });
    if (added.code !== 0) {
      log(`vercel env add ${entry.name} production failed (exit ${added.code}): ${redact(added.stderr, secrets())}`);
      return 1;
    }
    log(`set ${entry.name} in production.`);
  }
  const after = await vercel(['env', 'ls', 'production', ...ENV_LS_ARGS]);
  let names;
  try {
    names = envNamesFromLsJson(after.stdout);
  } catch (error) {
    log(`Verification failed: could not read the production listing (${error.message}). Check it by hand with vercel env ls production.`);
    return 1;
  }
  const missing = JACKPOT_SECRET_NAMES.filter((name) => !names.has(name));
  if (after.code !== 0 || missing.length > 0) {
    log(`Verification failed: missing ${missing.join(', ') || 'none'}.`);
    return 1;
  }
  log(`Verified: production has ${JACKPOT_SECRET_NAMES.join(', ')}. Redeploy for the values to take effect.`);
  return 0;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isMain) {
  try {
    process.exitCode = await runJackpotSecrets();
  } catch (error) {
    // The message never carries a key: readSecret and the checks above quote names and addresses only.
    console.error(`jackpot-secrets: ${error?.shortMessage ?? error?.message ?? error}`);
    process.exitCode = 1;
  }
}
