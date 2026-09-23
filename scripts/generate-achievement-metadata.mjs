// Writes ERC-721 metadata for every available achievement (contract §6.6):
//   apps/portal/achievements/<gameId>/<id>.json
// The files are published with the site in phase 2 (baseTokenUri
// https://lestersarcade.io/achievements/<gameId>/), so the NFT subset can change
// without new paths. Output is deterministic (sorted keys, trailing newline).
//
//   npm run achievements:metadata            write the files, drop stale ones
//   node scripts/generate-achievement-metadata.mjs --check   fail if the committed files differ
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ACHIEVEMENT_GAME_IDS, catalogFor } from '../apps/portal/src/achievements/index.mjs';
import { achievementMetadataFile, buildAchievementMetadata, serializeAchievementMetadata } from '../apps/portal/src/achievements/metadata.mjs';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
export const ACHIEVEMENT_METADATA_ROOT = 'apps/portal/achievements';

// Repo-relative path → file content, for every available achievement.
export function achievementMetadataFiles() {
  const files = new Map();
  for (const gameId of ACHIEVEMENT_GAME_IDS) {
    for (const entry of catalogFor(gameId)) {
      if (entry.available) files.set(achievementMetadataFile(entry), serializeAchievementMetadata(buildAchievementMetadata(entry)));
    }
  }
  return files;
}

// Repo-relative paths of the JSON files currently committed under the metadata root.
export function committedAchievementMetadataFiles(root = repoRoot) {
  const base = join(root, ACHIEVEMENT_METADATA_ROOT);
  if (!existsSync(base)) return [];
  return readdirSync(base, { withFileTypes: true })
    .filter((dir) => dir.isDirectory())
    .flatMap((dir) => readdirSync(join(base, dir.name)).filter((name) => name.endsWith('.json')).map((name) => `${ACHIEVEMENT_METADATA_ROOT}/${dir.name}/${name}`))
    .sort();
}

function main() {
  const check = process.argv.includes('--check');
  const files = achievementMetadataFiles();
  const problems = [];
  for (const [path, content] of files) {
    const absolute = join(repoRoot, path);
    const current = existsSync(absolute) ? readFileSync(absolute, 'utf8') : null;
    if (current === content) continue;
    if (check) problems.push(`${current === null ? 'missing' : 'stale'}: ${path}`);
    else { mkdirSync(dirname(absolute), { recursive: true }); writeFileSync(absolute, content); }
  }
  for (const path of committedAchievementMetadataFiles()) {
    if (files.has(path)) continue;
    if (check) problems.push(`unexpected: ${path}`);
    else rmSync(join(repoRoot, path));
  }
  if (problems.length) {
    console.error(`Achievement metadata is out of date (run npm run achievements:metadata):\n${problems.join('\n')}`);
    process.exitCode = 1;
    return;
  }
  console.log(`${check ? 'Checked' : 'Wrote'} ${files.size} achievement metadata files under ${ACHIEVEMENT_METADATA_ROOT}/.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
