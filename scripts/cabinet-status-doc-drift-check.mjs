// Cabinet publish-status documentation gate for Lester's Arcade.
//
// `production-doc-drift-check.mjs` proves the README cache marker against the
// live service worker. Nothing proved the other half: what the docs claim about
// whether a cabinet is public-playable. That gap let
// `docs/THIRD_PARTY_GAME_ONBOARDING.md` keep telling third-party developers that
// Chikun's Escape "is not public-playable yet" for six days after it shipped
// public and Ranked-eligible.
//
// This gate reads the canonical cabinet manifests and asserts two things:
//
//   1. The README roster row for each cabinet agrees with its manifest
//      `status` and, when the row states one, its `version`.
//   2. No governed doc claims a currently playable cabinet is coming soon.
//
// Ranked eligibility is deliberately NOT asserted here. `rankedEligible` in the
// manifest and `leaderboardEligible` on the arcade-core cartridge are set
// independently today, so there is no single canonical source to prove prose
// against. Publish status has one, which is why it is the contract.
//
// Offline and deterministic, so it runs in the ordinary test suite.
// Run: `npm run docs:cabinets`.

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const MANIFEST_DIR = path.join(root, 'apps', 'portal', 'games');

// Docs that make public-facing publish-status claims and must not go stale.
const GOVERNED_DOCS = [
  'README.md',
  'AGENTS.md',
  path.join('docs', 'THIRD_PARTY_GAME_ONBOARDING.md'),
];

// Phrases that assert a cabinet is not yet public. Matched case-insensitively.
const COMING_SOON_PHRASES = [
  'coming soon',
  'coming-soon',
  'not public-playable',
  'not public playable',
  'not yet playable',
  'not yet public',
];

export async function loadCabinetManifests(manifestDir = MANIFEST_DIR) {
  const entries = await readdir(manifestDir, { withFileTypes: true });
  const manifests = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const manifestPath = path.join(manifestDir, entry.name, 'game.manifest.json');
    let source;
    try {
      source = await readFile(manifestPath, 'utf8');
    } catch {
      continue;
    }
    const manifest = JSON.parse(source);
    if (!manifest?.id || !manifest?.name) {
      throw new Error(`Cabinet manifest ${manifestPath} is missing its canonical \`id\` or \`name\`.`);
    }
    manifests.push({ ...manifest, manifestPath });
  }
  if (manifests.length === 0) {
    throw new Error(`No cabinet manifests found under ${manifestDir}.`);
  }
  return manifests.sort((a, b) => a.id.localeCompare(b.id));
}

// The README roster is a Markdown table keyed by the cabinet's display name.
// The second column carries a runtime game ID (`lester-blaster`) that is not
// always the manifest ID (`hard-money-heroes`), so the name is the stable join.
export function parseReadmeRoster(source) {
  const rows = new Map();
  const rowPattern = /^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/gm;
  for (const match of source.matchAll(rowPattern)) {
    const cabinet = match[1];
    if (cabinet === 'Cabinet' || /^-+$/.test(cabinet)) continue;
    rows.set(cabinet, { cabinet, gameId: match[2], state: match[3] });
  }
  if (rows.size === 0) {
    throw new Error('README is missing the `## Current game roster` table rows.');
  }
  return rows;
}

function includesPhrase(haystack, phrases) {
  const lowered = haystack.toLowerCase();
  return phrases.some((phrase) => lowered.includes(phrase));
}

export function checkRosterRow(manifest, row) {
  if (!row) {
    return [`README roster has no row for cabinet "${manifest.name}" (manifest \`${manifest.id}\`).`];
  }

  const problems = [];
  const { state } = row;
  const playable = manifest.status === 'playable';

  if (playable && includesPhrase(state, COMING_SOON_PHRASES)) {
    problems.push(
      `README roster calls "${manifest.name}" "${state}", but \`${manifest.id}\` has manifest status \`playable\`.`,
    );
  }
  if (!playable && !includesPhrase(state, COMING_SOON_PHRASES)) {
    problems.push(
      `README roster calls "${manifest.name}" "${state}", but \`${manifest.id}\` has manifest status \`${manifest.status}\`, not \`playable\`.`,
    );
  }
  // Only enforce the version when the row actually states one, so a roster row
  // stays free to describe a cabinet without pinning a release number.
  const statedVersion = state.match(/`?([0-9]+\.[0-9]+\.[0-9]+)`?/)?.[1];
  if (statedVersion && manifest.version && statedVersion !== manifest.version) {
    problems.push(
      `README roster row for "${manifest.name}" records version \`${statedVersion}\`, but its manifest is \`${manifest.version}\`.`,
    );
  }
  return problems;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function cabinetMentionPatterns(manifest) {
  const patterns = [new RegExp(`\\b${escapeRegExp(manifest.name)}`, 'i')];
  // A short alias catches prose that names the cabinet without its full title,
  // e.g. "the Chikun cabinet remains COMING SOON".
  const alias = manifest.id.includes('-') ? null : manifest.id;
  if (alias) patterns.push(new RegExp(`\\b${escapeRegExp(alias)}\\b`, 'i'));
  return patterns;
}

export function checkDocForStaleClaims(docPath, source, playableManifests) {
  const problems = [];
  // The claim that actually rotted read "public users ... see a desaturated
  // COMING SOON cabinet" and never named Chikun — it inherited its subject from
  // the section heading. So a cabinet named in the enclosing heading scopes
  // every line under it, not just lines that repeat the name.
  let heading = '';
  source.split(/\r?\n/).forEach((line, index) => {
    if (/^#{1,6}\s/.test(line)) {
      heading = line;
      return;
    }
    if (!includesPhrase(line, COMING_SOON_PHRASES)) return;
    for (const manifest of playableManifests) {
      const patterns = cabinetMentionPatterns(manifest);
      const named = patterns.some((pattern) => pattern.test(line));
      const scoped = patterns.some((pattern) => pattern.test(heading));
      if (!named && !scoped) continue;
      const where = named ? '' : ` (scoped by heading "${heading.replace(/^#+\s*/, '').trim()}")`;
      problems.push(
        `${docPath}:${index + 1} claims \`${manifest.id}\` is not public, but its manifest status is \`playable\`${where}: ${line.trim()}`,
      );
    }
  });
  return problems;
}

export async function assertCabinetStatusDocs({
  repoRoot = root,
  manifestDir = MANIFEST_DIR,
  governedDocs = GOVERNED_DOCS,
} = {}) {
  const manifests = await loadCabinetManifests(manifestDir);
  const playableManifests = manifests.filter((manifest) => manifest.status === 'playable');
  const problems = [];

  const readmeSource = await readFile(path.join(repoRoot, 'README.md'), 'utf8');
  const roster = parseReadmeRoster(readmeSource);
  for (const manifest of manifests) {
    // A manifest with no roster row is only a problem once it is playable.
    // `template-cabinet` is SDK scaffolding, not a product commitment.
    if (manifest.status !== 'playable' && !roster.has(manifest.name)) continue;
    problems.push(...checkRosterRow(manifest, roster.get(manifest.name)));
  }

  for (const relativeDoc of governedDocs) {
    const source = await readFile(path.join(repoRoot, relativeDoc), 'utf8');
    problems.push(...checkDocForStaleClaims(relativeDoc, source, playableManifests));
  }

  if (problems.length > 0) {
    throw new Error(`Cabinet status documentation drift:\n- ${problems.join('\n- ')}`);
  }

  return { manifests, playableManifests, checkedDocs: governedDocs };
}

async function main() {
  const result = await assertCabinetStatusDocs();
  const names = result.playableManifests.map((manifest) => `${manifest.id}@${manifest.version}`);
  console.log(
    `Cabinet status documentation matches ${result.manifests.length} manifests across ${result.checkedDocs.length} docs. Playable: ${names.join(', ') || 'none'}.`,
  );
}

const isMain = process.argv[1]
  && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isMain) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
