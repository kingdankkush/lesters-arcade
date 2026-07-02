import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const vaultRoot = process.env.LESTERS_ARCADE_VAULT ?? path.join(process.env.HOME ?? process.env.USERPROFILE ?? '.', 'lesters-arcade-vault');
const remote = process.env.LESTERS_ARCADE_VAULT_REMOTE;
const action = process.argv[2] ?? 'status';

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', shell: false, ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function printStatus() {
  console.log(`Vault root: ${vaultRoot}`);
  console.log(`Vault exists: ${existsSync(vaultRoot) ? 'yes' : 'no'}`);
  console.log(`Remote: ${remote || '(not configured; set LESTERS_ARCADE_VAULT_REMOTE)'}`);
  console.log('Commands:');
  console.log('  node scripts/vault-sync.mjs status');
  console.log('  LESTERS_ARCADE_VAULT_REMOTE=<rclone-remote:path> node scripts/vault-sync.mjs push');
  console.log('  LESTERS_ARCADE_VAULT_REMOTE=<rclone-remote:path> node scripts/vault-sync.mjs check');
}

if (action === 'status') {
  printStatus();
} else if (action === 'push') {
  if (!remote) throw new Error('Set LESTERS_ARCADE_VAULT_REMOTE before pushing the vault.');
  run('rclone', ['sync', vaultRoot, remote, '--checksum', '--progress']);
} else if (action === 'check') {
  if (!remote) throw new Error('Set LESTERS_ARCADE_VAULT_REMOTE before checking the vault.');
  run('rclone', ['check', vaultRoot, remote, '--checksum']);
} else {
  console.error(`Unknown vault-sync action: ${action}`);
  process.exit(1);
}
