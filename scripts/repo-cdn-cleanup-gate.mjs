import { spawnSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const portalRoot = path.join(repoRoot, 'apps/portal');
const assetsRoot = path.join(portalRoot, 'assets');
const outputDir = path.join(repoRoot, 'docs/cleanup');
const referenceMapPath = path.join(outputDir, 'asset-reference-map.json');
const jsonOutputPath = path.join(outputDir, 'repo-cdn-cleanup-gate.json');
const markdownOutputPath = path.join(outputDir, 'repo-cdn-cleanup-gate.md');

const SKIP_DIRS = new Set(['.git', 'node_modules', '.vercel', 'dist', 'build']);
const MEDIA_EXTENSIONS = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.mp4', '.webm', '.mov', '.gif']);
const CDN_SIZE_THRESHOLD_BYTES = 1024 * 1024;

function slash(value) {
  return value.split(path.sep).join('/');
}

function humanBytes(bytes = 0) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

async function walkFiles(dir) {
  const files = [];
  if (!existsSync(dir)) return files;
  async function walk(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const abs = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(abs);
      else if (entry.isFile()) files.push(abs);
    }
  }
  await walk(dir);
  return files;
}

function gitBytes() {
  const result = spawnSync('git', ['count-objects', '-vH'], { cwd: repoRoot, encoding: 'utf8' });
  if (result.status !== 0) return null;
  const match = result.stdout.match(/^size-pack:\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

async function runtimeReferenceSet() {
  if (!existsSync(referenceMapPath)) return new Set();
  const map = JSON.parse(await readFile(referenceMapPath, 'utf8'));
  const runtime = new Set();
  for (const value of Object.values(map.referencedAssets ?? {})) {
    for (const asset of value ?? []) runtime.add(asset);
  }
  for (const [asset, meta] of Object.entries(map.references ?? {})) {
    if (meta?.classification === 'runtime') runtime.add(asset);
  }
  return runtime;
}

export function classifyCdnCandidate(file) {
  const ext = path.extname(file.path).toLowerCase();
  const isMedia = MEDIA_EXTENSIONS.has(ext);
  if (isMedia && file.sizeBytes >= CDN_SIZE_THRESHOLD_BYTES) {
    return Object.freeze({
      ...file,
      action: 'cdn-candidate',
      destructive: false,
      requiresApproval: true,
      rationale: file.runtimeReferenced
        ? 'Runtime-referenced media can move only after MEDIA_BASE/CDN URL support, production URL upload, and live fetch verification.'
        : 'Large media should move to the vault/CDN path before any repo deletion.',
    });
  }
  if (file.runtimeReferenced) {
    return Object.freeze({ ...file, action: 'keep-runtime', destructive: false, requiresApproval: false, rationale: 'Runtime-referenced repo asset.' });
  }
  return Object.freeze({ ...file, action: 'audit-before-removal', destructive: false, requiresApproval: true, rationale: 'Needs exact reference/vault verification before any removal.' });
}

export function buildRepoCdnCleanupGate(input) {
  const cdnCandidates = [...(input.cdnCandidates ?? [])]
    .map(classifyCdnCandidate)
    .filter((candidate) => candidate.action === 'cdn-candidate')
    .sort((a, b) => b.sizeBytes - a.sizeBytes);
  return Object.freeze({
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    status: 'approval-gated',
    summary: Object.freeze({
      workingTreeBytes: input.totals?.workingTreeBytes ?? 0,
      gitBytes: input.totals?.gitBytes ?? null,
      assetBytes: input.totals?.assetBytes ?? 0,
      cdnCandidateCount: cdnCandidates.length,
      cdnCandidateBytes: cdnCandidates.reduce((sum, file) => sum + file.sizeBytes, 0),
      vaultExists: Boolean(input.vault?.exists),
      vaultRemoteConfigured: Boolean(input.vault?.remoteConfigured),
    }),
    largestFiles: Object.freeze([...(input.largestFiles ?? [])].slice(0, 20).map(Object.freeze)),
    cdnCandidates: Object.freeze(cdnCandidates.map(Object.freeze)),
    safeActions: Object.freeze([
      Object.freeze({ id: 'audit-current-assets', label: 'Run repo:audit/repo:health and commit generated reports', destructive: false }),
      Object.freeze({ id: 'configure-remote-vault', label: 'Configure rclone vault remote, then vault-sync push/check', destructive: false }),
      Object.freeze({ id: 'prepare-media-base', label: 'Add MEDIA_BASE/CDN URL indirection before moving runtime media', destructive: false }),
      Object.freeze({ id: 'verify-cdn-fetches', label: 'Fetch every CDN URL and run production smoke after cutover', destructive: false }),
    ]),
    destructiveActions: Object.freeze([
      Object.freeze({ id: 'delete-runtime-media', label: 'Delete or git-rm runtime-referenced audio/video/assets', requiresExplicitApproval: true }),
      Object.freeze({ id: 'history-rewrite', label: 'Rewrite Git history to shrink .git', requiresExplicitApproval: true }),
      Object.freeze({ id: 'fresh-repo-reseed', label: 'Create a fresh slim repository and reseed production branch', requiresExplicitApproval: true }),
      Object.freeze({ id: 'cdn-cutover', label: 'Replace production asset URLs with CDN URLs', requiresExplicitApproval: true }),
    ]),
    verdict: 'No destructive action performed. CDN migration and history rewrite remain explicit approval gates.',
  });
}

export function renderRepoCdnCleanupMarkdown(report) {
  const lines = [];
  lines.push('# Repo CDN cleanup gate');
  lines.push('');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Status: **${report.status}**`);
  lines.push('');
  lines.push('## Verdict');
  lines.push('');
  lines.push(`**${report.verdict}**`);
  lines.push('');
  lines.push('## Current metrics');
  lines.push('');
  lines.push(`- Working tree bytes: ${humanBytes(report.summary.workingTreeBytes)}`);
  lines.push(`- Portal asset bytes: ${humanBytes(report.summary.assetBytes)}`);
  lines.push(`- Git pack size: ${typeof report.summary.gitBytes === 'number' ? humanBytes(report.summary.gitBytes) : report.summary.gitBytes ?? 'unknown'}`);
  lines.push(`- CDN candidate media: ${report.summary.cdnCandidateCount} files / ${humanBytes(report.summary.cdnCandidateBytes)}`);
  lines.push(`- Vault exists: ${report.summary.vaultExists ? 'yes' : 'no'}`);
  lines.push(`- Vault remote configured: ${report.summary.vaultRemoteConfigured ? 'yes' : 'no'}`);
  lines.push('');
  lines.push('## Top CDN candidates');
  lines.push('');
  lines.push('| Path | Size | Runtime referenced | Gate |');
  lines.push('| --- | ---: | --- | --- |');
  for (const candidate of report.cdnCandidates.slice(0, 25)) {
    lines.push(`| ${candidate.path} | ${humanBytes(candidate.sizeBytes)} | ${candidate.runtimeReferenced ? 'yes' : 'no'} | ${candidate.rationale} |`);
  }
  if (report.cdnCandidates.length === 0) lines.push('| — | — | — | No media candidates over threshold. |');
  lines.push('');
  lines.push('## Largest files');
  lines.push('');
  lines.push('| Path | Size | Runtime referenced |');
  lines.push('| --- | ---: | --- |');
  for (const file of report.largestFiles.slice(0, 20)) lines.push(`| ${file.path} | ${humanBytes(file.sizeBytes)} | ${file.runtimeReferenced ? 'yes' : 'no'} |`);
  lines.push('');
  lines.push('## Safe next actions');
  lines.push('');
  for (const action of report.safeActions) lines.push(`- ${action.label}`);
  lines.push('');
  lines.push('## Explicit approval required');
  lines.push('');
  for (const action of report.destructiveActions) lines.push(`- ${action.label}`);
  lines.push('');
  return `${lines.join('\n')}\n`;
}

async function collectReportInput() {
  const runtimeRefs = await runtimeReferenceSet();
  const assetFiles = await walkFiles(assetsRoot);
  const files = assetFiles.map((abs) => {
    const rel = slash(path.relative(portalRoot, abs));
    return { path: rel, sizeBytes: statSync(abs).size, runtimeReferenced: runtimeRefs.has(rel) };
  });
  const allRepoFiles = await walkFiles(repoRoot);
  const workingTreeBytes = allRepoFiles.reduce((sum, file) => sum + statSync(file).size, 0);
  const assetBytes = files.reduce((sum, file) => sum + file.sizeBytes, 0);
  const vaultRoot = path.join(path.dirname(repoRoot), 'lesters-arcade-vault');
  return {
    totals: { workingTreeBytes, gitBytes: gitBytes(), assetBytes },
    largestFiles: files.map((file) => ({ ...file, path: `apps/portal/${file.path}` })).sort((a, b) => b.sizeBytes - a.sizeBytes),
    cdnCandidates: files,
    vault: {
      exists: existsSync(vaultRoot),
      remoteConfigured: Boolean(process.env.LESTERS_ARCADE_VAULT_REMOTE),
    },
  };
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  const report = buildRepoCdnCleanupGate(await collectReportInput());
  await writeFile(jsonOutputPath, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(markdownOutputPath, renderRepoCdnCleanupMarkdown(report));
  console.log(`Wrote ${slash(path.relative(repoRoot, jsonOutputPath))}`);
  console.log(`Wrote ${slash(path.relative(repoRoot, markdownOutputPath))}`);
  console.log(`CDN candidates: ${report.summary.cdnCandidateCount} files / ${humanBytes(report.summary.cdnCandidateBytes)}`);
  console.log(report.verdict);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
