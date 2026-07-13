import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const shipDocs = [
  'README.md',
  'AGENTS.md',
  'CHANGELOG.md',
  'sdk/README.md',
  'contracts/README.md',
  'docs/THIRD_PARTY_GAME_ONBOARDING.md',
  'docs/design/BRAND_KIT.md',
  'docs/game-design/SHIP_ART_CENSUS_LOCK.md',
];
const failures = [];
const linkPattern = /\[[^\]]*\]\(([^)]+)\)/g;

for (const relative of shipDocs) {
  const sourcePath = path.join(root, relative);
  if (!existsSync(sourcePath)) {
    failures.push(`${relative}: file missing`);
    continue;
  }
  const source = readFileSync(sourcePath, 'utf8');
  for (const match of source.matchAll(linkPattern)) {
    const raw = match[1].trim().replace(/^<|>$/g, '');
    if (!raw || raw.startsWith('#') || /^(?:https?:|mailto:)/i.test(raw)) continue;
    const target = decodeURIComponent(raw.split('#')[0].split('?')[0]);
    const resolved = path.resolve(path.dirname(sourcePath), target);
    if (!existsSync(resolved)) failures.push(`${relative}: dead local link ${raw}`);
  }
}

if (failures.length) {
  console.error(`Ship documentation link check failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log(`Ship documentation link check passed: ${shipDocs.length} current/public documents.`);
