import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  deriveRunCeilings,
  INTEGRITY_TOLERANCE,
  MIN_BOSS_CLEAR_SECONDS,
} from '../apps/portal/src/hmh-run-integrity.mjs';

export const INTEGRITY_RULESET_VERSION = 'hmh-level-1-integrity-v2';
export const CERTIFICATION_WINDOWS_SECONDS = Object.freeze([60, 300, 900, 2700]);

export function buildIntegrityBoundsArtifact() {
  return Object.freeze({
    version: INTEGRITY_RULESET_VERSION,
    gameId: 'hard-money-heroes',
    levelId: 'level-1-crypto-wasteland',
    minBossClearSeconds: MIN_BOSS_CLEAR_SECONDS,
    tolerance: INTEGRITY_TOLERANCE,
    windows: CERTIFICATION_WINDOWS_SECONDS.map((survivalSeconds) => Object.freeze({
      survivalSeconds,
      ceilings: deriveRunCeilings({ survivalSeconds, level: 1 }),
    })),
  });
}

export function writeIntegrityBoundsArtifact({ repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..') } = {}) {
  const output = path.join(repoRoot, 'docs', 'security', 'hmh-integrity-bounds.json');
  mkdirSync(path.dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(buildIntegrityBoundsArtifact(), null, 2)}\n`, 'utf8');
  return output;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(`Integrity bounds written: ${writeIntegrityBoundsArtifact()}`);
}
