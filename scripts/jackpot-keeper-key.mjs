// Generates the Chikun Weekly Jackpot keeper key (design J9, §A.18; runbook step E2):
//
//   node scripts/jackpot-keeper-key.mjs --out C:/Users/just_/lesters-arcade-vault/keys/jackpot-keeper.json
//
// Writes a fresh random key as { "address": "0x…", "privateKey": "0x…" } to a NEW file (mode 0600 where the
// file system supports it) and prints only the address, which the owner then funds with 0.1 testnet zkLTC.
// It never overwrites an existing file, never writes inside this repository (a key must never be
// committed), and never prints the private key. The keeper key is separate from the settle relayer's key.
import { chmodSync, existsSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ethers } from 'ethers';
import { flagValue } from './lib/key-source.mjs';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

// True when `target` is `root` itself or below it. Only a relative path that climbs out ('..' or '../…') or
// lands on another drive is outside: a directory NAMED '..keys' inside the repository is inside.
export function isInside(root, target) {
  const rel = relative(root, target);
  if (rel === '') return true;
  if (isAbsolute(rel)) return false;
  return !(rel === '..' || rel.startsWith(`..${sep}`));
}

// Returns the exit code. `createWallet` and `root` are injectable for tests.
export function runKeeperKeyCli({ argv = process.argv.slice(2), log = console.log, createWallet = () => ethers.Wallet.createRandom(), root = repoRoot } = {}) {
  const unknown = argv.filter((arg, index) => !(arg === '--out' || arg.startsWith('--out=') || (index > 0 && argv[index - 1] === '--out')));
  if (unknown.length) {
    log(`Blocked: unknown option ${unknown[0]}. usage: node scripts/jackpot-keeper-key.mjs --out <path outside the repository>`);
    return 2;
  }
  let out;
  try {
    out = flagValue(argv, '--out');
  } catch {
    out = null;
  }
  if (!out) {
    log('Blocked: --out <path> is required (for example C:/Users/just_/lesters-arcade-vault/keys/jackpot-keeper.json).');
    return 2;
  }
  const target = resolve(out);
  if (isInside(resolve(root), target)) {
    log(`Blocked: ${target} is inside the repository; write the key to the vault, never to a file that could be committed.`);
    return 2;
  }
  if (!existsSync(dirname(target)) || !statSync(dirname(target)).isDirectory()) {
    log(`Blocked: the directory ${dirname(target)} does not exist.`);
    return 2;
  }
  // The same check on the real paths, so a junction or symlink into the repository is refused too.
  let realTarget;
  let realRoot;
  try {
    realRoot = realpathSync.native(resolve(root));
    realTarget = join(realpathSync.native(dirname(target)), basename(target));
  } catch (error) {
    log(`Blocked: cannot resolve ${dirname(target)} (${error?.code ?? 'error'}).`);
    return 2;
  }
  if (isInside(realRoot, realTarget)) {
    log(`Blocked: ${target} resolves to ${realTarget}, inside the repository; write the key to the vault, never to a file that could be committed.`);
    return 2;
  }
  if (existsSync(target)) {
    log(`Blocked: ${target} already exists; a keeper key file is never overwritten. Nothing was written.`);
    return 2;
  }
  const wallet = createWallet();
  try {
    // 'wx' fails if the file appeared in the meantime: never overwrite.
    writeFileSync(target, `${JSON.stringify({ address: wallet.address, privateKey: wallet.privateKey }, null, 2)}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
  } catch (error) {
    log(`Blocked: cannot create ${target} (${error?.code ?? 'write error'}). Nothing was written.`);
    return 2;
  }
  try {
    chmodSync(target, 0o600);
  } catch {
    // Best effort: Windows keeps its own ACLs.
  }
  log(`Wrote a new keeper key file: ${target}`);
  log(`Keeper address: ${wallet.address}`);
  log('Fund it with 0.1 testnet zkLTC (runbook E2), pass it as --keeper to deploy-weekly-jackpot.mjs, and pipe the key to Vercel with jackpot-secrets.mjs. The key itself was not printed.');
  return 0;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isMain) {
  process.exitCode = runKeeperKeyCli();
}
