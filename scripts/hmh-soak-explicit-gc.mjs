import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export function ensureExplicitGc(moduleUrl, {
  gc = globalThis.gc,
  execPath = process.execPath,
  env = process.env,
  spawn = spawnSync,
  exit = process.exit,
} = {}) {
  if (typeof gc === 'function') return { relaunched: false };
  const child = spawn(execPath, ['--expose-gc', fileURLToPath(moduleUrl)], {
    stdio: 'inherit',
    env,
  });
  if (child.error) throw child.error;
  const status = child.status ?? 1;
  exit(status);
  return { relaunched: true, status };
}
