// Vercel production secrets for Ranked (runbook step 6, contract A28, A13, §9.2, §11 rule 13).
//
//   node scripts/vercel-secrets.mjs --key-file <vault keys.json> --cron-secret-out <new file>
//        [--verifier-field verifier] [--relayer-field relayer] [--rotate-session-secret]
//        [--deployment <module.mjs>] [--scope <team>] [--vercel-bin <command>]
//        [--apply --confirm SET_PRODUCTION_SECRETS]
//
// Sets, in the PRODUCTION environment only:
//   RANKED_VERIFIER_PRIVATE_KEY    from the key file field (its address must equal the module's trustedVerifier)
//   RANKED_RELAYER_PRIVATE_KEY     from the key file field (its address must equal the module's relayer)
//   RANKED_SCORE_REGISTRY_ADDRESS  from the DEPLOYED address module
//   CRON_SECRET                    fresh 32 random bytes (hex), also written to --cron-secret-out (a NEW
//                                  file, mode 0600 where supported) for scripts/live-cron.mjs
//   SESSION_SECRET                 with --rotate-session-secret: a fresh random value (kills 1.7.0 tokens)
//
// Every value travels to `vercel env add <NAME> production --sensitive --force --yes` on STDIN (a spawn
// with piped stdio), never as an argument, and is never printed. Before anything is written it runs
// `vercel env ls` for production, preview and development and refuses to continue if a legacy name
// (VERIFIER_PRIVATE_KEY, RELAYER_PRIVATE_KEY, SCORE_REGISTRY_ADDRESS) exists anywhere, printing only the
// names (the listings are `--format json`, and a listing that cannot be read stops the run). The dry
// run (default) reads and checks the inputs and prints names only. After applying, it lists production
// again and checks every new name is there and no legacy name is. --deployment is for dry runs only:
// --apply always uses the committed address module.
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ethers } from 'ethers';
import { flagValue, hasFlag, readSecret } from './lib/key-source.mjs';
import { loadLitvmDeployment } from './generate-litvm-addresses.mjs';

export const VERCEL_APPLY_CONFIRM = 'SET_PRODUCTION_SECRETS';
export const LEGACY_SECRET_NAMES = Object.freeze(['VERIFIER_PRIVATE_KEY', 'RELAYER_PRIVATE_KEY', 'SCORE_REGISTRY_ADDRESS']);
export const RANKED_SECRET_NAMES = Object.freeze(['RANKED_VERIFIER_PRIVATE_KEY', 'RANKED_RELAYER_PRIVATE_KEY', 'RANKED_SCORE_REGISTRY_ADDRESS', 'CRON_SECRET']);
export const CHECKED_ENVIRONMENTS = Object.freeze(['production', 'preview', 'development']);

// `vercel env ls <environment> --format json` (Vercel CLI 59.15+) prints { envs: [{ key, ... }] } on
// stdout. The human table is not parsed: its names are bold (ANSI) whenever colour is forced, and its
// layout changes between versions, so a table that parses to nothing would let a legacy name through.
export const ENV_LS_ARGS = Object.freeze(['--format', 'json']);

export class VercelListingError extends Error {}

// Names from one JSON listing. Fails closed: anything but a well-formed listing throws, and the
// message never quotes the output (plain-text env values appear in it).
export function envNamesFromLsJson(stdout) {
  const text = String(stdout ?? '');
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  let listing = null;
  if (start >= 0 && end > start) {
    try {
      listing = JSON.parse(text.slice(start, end + 1));
    } catch {
      listing = null;
    }
  }
  if (!listing || !Array.isArray(listing.envs)) throw new VercelListingError('the output is not a --format json env listing');
  const names = new Set();
  for (const entry of listing.envs) {
    if (typeof entry?.key !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(entry.key)) throw new VercelListingError('the listing holds an entry without a valid name');
    names.add(entry.key);
  }
  return names;
}

// Default command: `npx vercel` (through the shell on Windows, where npx is a .cmd file). Arguments
// are fixed names and flags only; values never reach the command line.
export function defaultVercelCommand(bin = null) {
  if (bin) return { command: bin, baseArgs: [], shell: process.platform === 'win32' };
  return process.platform === 'win32' ? { command: 'npx.cmd', baseArgs: ['vercel'], shell: true } : { command: 'npx', baseArgs: ['vercel'], shell: false };
}

// Runs one Vercel CLI command with piped stdio; `stdin` (a secret) is written to the child's stdin.
export function createVercelRunner({ spawnImpl = spawn, command, baseArgs = [], shell = false, scope = null } = {}) {
  if (scope !== null && !/^[A-Za-z0-9_-]+$/.test(scope)) throw new Error('--scope must be a Vercel team slug');
  return (args, { stdin = null } = {}) => new Promise((resolveRun, rejectRun) => {
    const fullArgs = [...baseArgs, ...args, ...(scope ? ['--scope', scope] : [])];
    // No colour or decoration in the child's output.
    const options = { stdio: ['pipe', 'pipe', 'pipe'], shell, windowsHide: true, env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' } };
    let child;
    if (shell) {
      // Through the shell (npx.cmd on Windows) the command line is one string of fixed, validated
      // tokens; values never appear in it.
      for (const token of fullArgs) if (!/^[A-Za-z0-9_.:-]+$/.test(token)) throw new Error(`unsafe Vercel CLI argument ${JSON.stringify(token)}`);
      child = spawnImpl([/\s/.test(command) ? `"${command}"` : command, ...fullArgs].join(' '), [], options);
    } else {
      child = spawnImpl(command, fullArgs, options);
    }
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (chunk) => { stdout += chunk; });
    child.stderr?.on('data', (chunk) => { stderr += chunk; });
    child.on('error', rejectRun);
    child.on('close', (code) => resolveRun({ code, stdout, stderr }));
    if (stdin !== null) child.stdin.write(stdin);
    child.stdin.end();
  });
}

function redact(text, secrets) {
  let out = String(text ?? '');
  for (const secret of secrets) if (secret) out = out.split(secret).join('[redacted]');
  return out.slice(-400);
}

function checkOutputPath(path) {
  if (!path) throw new Error('--cron-secret-out <path> is required: the new CRON_SECRET is written there for scripts/live-cron.mjs');
  const target = resolve(path);
  if (existsSync(target)) throw new Error(`--cron-secret-out ${target} already exists; choose a new file (an existing secret is never overwritten)`);
  if (!existsSync(dirname(target))) throw new Error(`the directory of --cron-secret-out ${target} does not exist`);
  return target;
}

// Everything except the Vercel calls: returns the planned entries (values held in memory only).
export async function prepareVercelSecrets({ argv, env = process.env, deployment, readFile } = {}) {
  const keyFile = flagValue(argv, '--key-file');
  if (!keyFile) throw new Error('--key-file <path> is required (the JSON file holding the verifier and relayer keys)');
  const fields = { verifier: flagValue(argv, '--verifier-field') ?? 'verifier', relayer: flagValue(argv, '--relayer-field') ?? 'relayer' };
  const readField = (field, label) => readSecret({ env, argv: ['--key-file', keyFile, '--key-field', field], label, ...(readFile ? { readFile } : {}) });
  const verifierKey = readField(fields.verifier, 'verifier key');
  const relayerKey = readField(fields.relayer, 'relayer key');
  const verifierAddress = new ethers.Wallet(verifierKey).address.toLowerCase();
  const relayerAddress = new ethers.Wallet(relayerKey).address.toLowerCase();
  if (verifierAddress !== deployment.trustedVerifier) throw new Error(`the verifier key (field "${fields.verifier}") is for ${verifierAddress}, but the address module's trustedVerifier is ${deployment.trustedVerifier}`);
  if (relayerAddress !== deployment.relayer) throw new Error(`the relayer key (field "${fields.relayer}") is for ${relayerAddress}, but the address module's relayer is ${deployment.relayer}`);
  const registry = deployment.addresses.scoreSubmissionRegistry;
  return [
    { name: 'RANKED_VERIFIER_PRIVATE_KEY', source: `--key-file field "${fields.verifier}" (address ${verifierAddress})`, value: verifierKey },
    { name: 'RANKED_RELAYER_PRIVATE_KEY', source: `--key-file field "${fields.relayer}" (address ${relayerAddress})`, value: relayerKey },
    { name: 'RANKED_SCORE_REGISTRY_ADDRESS', source: `address module (${deployment.status})`, value: registry, isPublic: true },
  ];
}

// Returns an exit code. `runVercel(args, { stdin })` -> { code, stdout, stderr }.
export async function runVercelSecrets({
  argv = process.argv.slice(2),
  env = process.env,
  runVercel = null,
  spawnImpl = spawn,
  randomBytesImpl = randomBytes,
  writeSecretFile = (path, value) => writeFileSync(path, `${value}\n`, { flag: 'wx', mode: 0o600 }),
  readFile = null,
  log = console.log,
  // Tests only (the CLI never sets it): lets --apply use a --deployment module against a fake Vercel.
  allowDeploymentOverride = false,
} = {}) {
  const apply = hasFlag(argv, '--apply');
  const rotateSession = hasFlag(argv, '--rotate-session-secret');
  if (apply && flagValue(argv, '--confirm') !== VERCEL_APPLY_CONFIRM) {
    log(`Apply blocked: add --confirm ${VERCEL_APPLY_CONFIRM}.`);
    return 2;
  }
  if (apply && flagValue(argv, '--deployment') !== null && !allowDeploymentOverride) {
    log('Apply blocked: --deployment is for dry runs. --apply always takes RANKED_SCORE_REGISTRY_ADDRESS from the committed address module (LITVM_DEPLOYMENT).');
    return 2;
  }
  const deployment = await loadLitvmDeployment(flagValue(argv, '--deployment'));
  if (apply && deployment.status !== 'deployed') {
    log(`Apply blocked: the address module is '${deployment.status}', not 'deployed'. RANKED_SCORE_REGISTRY_ADDRESS must come from the deployed record.`);
    return 2;
  }
  const cronOut = apply ? checkOutputPath(flagValue(argv, '--cron-secret-out')) : (flagValue(argv, '--cron-secret-out') ? resolve(flagValue(argv, '--cron-secret-out')) : null);
  // A dry run without --key-file still lists the names; --apply always reads and checks the keys.
  const entries = (!apply && !flagValue(argv, '--key-file'))
    ? ['RANKED_VERIFIER_PRIVATE_KEY', 'RANKED_RELAYER_PRIVATE_KEY'].map((name) => ({ name, source: '--key-file not given, not checked', value: null }))
      .concat([{ name: 'RANKED_SCORE_REGISTRY_ADDRESS', source: `address module (${deployment.status})`, value: deployment.addresses.scoreSubmissionRegistry, isPublic: true }])
    : await prepareVercelSecrets({ argv, env, deployment, readFile });
  const vercel = runVercel ?? createVercelRunner({ spawnImpl, ...defaultVercelCommand(flagValue(argv, '--vercel-bin')), scope: flagValue(argv, '--scope') });
  const secrets = () => entries.map((entry) => entry.value);

  // Legacy names must not exist in any environment (A28). Names only are printed.
  const existing = {};
  for (const environment of CHECKED_ENVIRONMENTS) {
    const command = `vercel env ls ${environment} ${ENV_LS_ARGS.join(' ')}`;
    const listed = await vercel(['env', 'ls', environment, ...ENV_LS_ARGS]);
    if (listed.code !== 0) {
      log(`${command} failed (exit ${listed.code}); nothing was changed. The JSON listing needs Vercel CLI 59.15 or newer.`);
      return 1;
    }
    try {
      existing[environment] = envNamesFromLsJson(listed.stdout);
    } catch (error) {
      log(`Refusing to continue: could not read the names from ${command} (${error.message}); nothing was changed.`);
      return 1;
    }
  }
  const legacy = CHECKED_ENVIRONMENTS.flatMap((environment) => LEGACY_SECRET_NAMES.filter((name) => existing[environment].has(name)).map((name) => `${environment}:${name}`));
  if (legacy.length > 0) {
    log(`Refusing to continue: legacy secret names exist in Vercel: ${legacy.join(', ')}. Remove them first (vercel env rm <NAME> <environment>); they must never be set (contract A28).`);
    return 3;
  }
  log(`Preview SESSION_SECRET: ${existing.preview.has('SESSION_SECRET') ? 'present (its own value; never copy production)' : 'absent'}.`);

  const planned = [...entries.map(({ name, source }) => ({ name, source })), { name: 'CRON_SECRET', source: `fresh 32 random bytes (hex), written to ${cronOut ?? '--cron-secret-out <new file>'}` }];
  if (rotateSession) planned.push({ name: 'SESSION_SECRET', source: 'fresh 32 random bytes (hex), rotated' });
  for (const entry of planned) log(`${apply ? 'set' : 'would set'} ${entry.name} in production (${entry.source})${existing.production.has(entry.name) ? ', replacing the existing value' : ''}`);
  if (!apply) {
    log(`DRY RUN: names only, nothing was written. Apply with --apply --confirm ${VERCEL_APPLY_CONFIRM} and --cron-secret-out <new file>.`);
    return 0;
  }

  const cronSecret = randomBytesImpl(32).toString('hex');
  writeSecretFile(cronOut, cronSecret);
  log(`CRON_SECRET written to ${cronOut}.`);
  entries.push({ name: 'CRON_SECRET', value: cronSecret });
  if (rotateSession) entries.push({ name: 'SESSION_SECRET', value: randomBytesImpl(32).toString('hex') });
  for (const entry of entries) {
    const added = await vercel(['env', 'add', entry.name, 'production', '--sensitive', '--force', '--yes'], { stdin: entry.value });
    if (added.code !== 0) {
      log(`vercel env add ${entry.name} production failed (exit ${added.code}): ${redact(added.stderr, secrets().concat(entries.map((item) => item.value)))}`);
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
  const missing = entries.map((entry) => entry.name).filter((name) => !names.has(name));
  const stillLegacy = LEGACY_SECRET_NAMES.filter((name) => names.has(name));
  if (after.code !== 0 || missing.length > 0 || stillLegacy.length > 0) {
    log(`Verification failed: missing ${missing.join(', ') || 'none'}; legacy present ${stillLegacy.join(', ') || 'none'}.`);
    return 1;
  }
  log(`Verified: production has ${entries.map((entry) => entry.name).join(', ')} and no legacy name. Redeploy for the values to take effect.`);
  return 0;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isMain) {
  try {
    process.exitCode = await runVercelSecrets();
  } catch (error) {
    console.error(`vercel-secrets: ${error?.shortMessage ?? error?.message ?? error}`);
    process.exitCode = 1;
  }
}
