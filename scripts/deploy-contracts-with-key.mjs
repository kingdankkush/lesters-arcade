// Runbook step 3 launcher (contract §11 rule 13, §13): runs scripts/deploy-contracts.mjs --broadcast
// with the deployer key read inside this process and handed ONLY to that one child process.
//
//   node scripts/deploy-contracts-with-key.mjs --key-file <vault keys.json> --key-field keys.operator
//   node scripts/deploy-contracts-with-key.mjs --key-file <vault keys.json> --key-field keys.operator \
//        --broadcast --confirm DEPLOY_HARDENED_NATIVE_FEE_RANKED_4441
//
// scripts/deploy-contracts.mjs reads DEPLOYER_PRIVATE_KEY and LITVM_DEPLOY_CONFIRM from its environment
// (its pinned literals stay untouched). This launcher reads the key through scripts/lib/key-source.mjs
// (--key-file <path> --key-field <field>, or --key-env <NAME>), checks that it is the configured
// deployer's key, and spawns `node scripts/deploy-contracts.mjs --broadcast` with both variables set in
// the child's environment only: never on a command line, never in the shell, never printed. The
// parent's own environment is not changed, so nothing is left behind when the child exits.
//
// Without --broadcast it only checks the key and prints what it would run (the deploy dry run itself is
// `node scripts/deploy-contracts.mjs`). --broadcast needs --confirm with the deploy script's phrase, and
// that is checked before the key is read.
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ethers } from 'ethers';
import { flagValue, hasFlag, readSecret } from './lib/key-source.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));

// The same phrase as BROADCAST_CONFIRM in scripts/deploy-contracts.mjs (a test pins that they match).
export const DEPLOY_BROADCAST_CONFIRM = 'DEPLOY_HARDENED_NATIVE_FEE_RANKED_4441';
export const DEPLOY_SCRIPT_PATH = join(root, 'scripts', 'deploy-contracts.mjs');

export function configuredDeployer() {
  return JSON.parse(readFileSync(join(root, 'contracts', 'deploy-config.testnet.json'), 'utf8')).deployer;
}

// Returns the exit code. `spawnImpl`, `deployer` and `deployScript` are injectable for tests.
export async function runDeployWithKey({
  argv = process.argv.slice(2),
  env = process.env,
  log = console.log,
  spawnImpl = spawn,
  deployer = configuredDeployer(),
  deployScript = DEPLOY_SCRIPT_PATH,
} = {}) {
  const broadcast = hasFlag(argv, '--broadcast');
  if (broadcast && flagValue(argv, '--confirm') !== DEPLOY_BROADCAST_CONFIRM) {
    log(`Broadcast blocked: add --confirm ${DEPLOY_BROADCAST_CONFIRM} after the dry-run manifest is approved.`);
    return 2;
  }
  const key = readSecret({ env, argv, label: 'deployer key' });
  const address = new ethers.Wallet(key).address;
  if (address.toLowerCase() !== String(deployer).toLowerCase()) {
    log(`Blocked: the key is for ${address}, but the configured deployer is ${deployer}. Nothing was started.`);
    return 2;
  }
  if (!broadcast) {
    log(`Key checked: it belongs to the configured deployer ${address}. Nothing was started.`);
    log(`With --broadcast --confirm ${DEPLOY_BROADCAST_CONFIRM} this runs: node scripts/deploy-contracts.mjs --broadcast, with DEPLOYER_PRIVATE_KEY and LITVM_DEPLOY_CONFIRM set in that process only.`);
    return 0;
  }
  log(`Deployer ${address}: starting node scripts/deploy-contracts.mjs --broadcast (the key is in its environment only).`);
  const childEnv = { ...env, DEPLOYER_PRIVATE_KEY: key, LITVM_DEPLOY_CONFIRM: DEPLOY_BROADCAST_CONFIRM };
  return new Promise((resolveRun, rejectRun) => {
    const child = spawnImpl(process.execPath, [deployScript, '--broadcast'], { cwd: root, env: childEnv, stdio: 'inherit', windowsHide: true });
    child.on('error', rejectRun);
    child.on('close', (code) => resolveRun(code ?? 1));
  });
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isMain) {
  try {
    process.exitCode = await runDeployWithKey();
  } catch (error) {
    console.error(`deploy-contracts-with-key: ${error?.shortMessage ?? error?.message ?? error}`);
    process.exitCode = 1;
  }
}
