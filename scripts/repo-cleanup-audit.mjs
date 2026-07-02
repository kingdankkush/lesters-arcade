import { access, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const portalRoot = path.join(repoRoot, 'apps/portal');
const outputDir = path.join(repoRoot, 'docs/cleanup');
const outputPath = path.join(outputDir, 'asset-reference-map.json');

const SKIP_DIRS = new Set(['.git', 'node_modules', '.vercel', 'dist', 'build']);
const TEXT_EXTENSIONS = new Set(['.js', '.mjs', '.json', '.html', '.css', '.md', '.py']);
const ASSET_REFERENCE_RE = /(?:(?:\.\.?\/)+|\/)?(?:apps\/portal\/)?assets\/[A-Za-z0-9._~:/?#[\]@!$&'()*+,;=%-]+/g;
const TRAILING_JUNK_RE = /["'`),;\]}]+$/;

function slash(rel) {
  return rel.split(path.sep).join('/');
}

function relFromRoot(abs) {
  return slash(path.relative(repoRoot, abs));
}

function portalAssetFsPath(assetPath) {
  return path.join(portalRoot, assetPath);
}

function normalizeAssetReference(raw) {
  if (!raw) return null;
  let value = String(raw).trim().replace(/\\/g, '/').replace(TRAILING_JUNK_RE, '');
  value = value.replace(/^url\((['"]?)/, '').replace(/(['"]?)\)$/, '');
  value = value.replace(/^(?:\.\.\/)+/, '').replace(/^\.\//, '').replace(/^\//, '');
  value = value.replace(/^apps\/portal\//, '');
  const assetIndex = value.indexOf('assets/');
  if (assetIndex < 0) return null;
  value = value.slice(assetIndex);
  value = value.split('#')[0].split('?')[0];
  value = value.replace(/\/+$/, '');
  if (!value || value.includes('${') || value.includes('`')) return null;
  return value;
}

async function pathExists(abs) {
  try {
    await access(abs);
    return true;
  } catch {
    return false;
  }
}

async function walkFiles(root, options = {}) {
  const files = [];
  if (!(await pathExists(root))) return files;
  async function walk(current) {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') && entry.name !== '.github') continue;
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        await walk(path.join(current, entry.name));
      } else if (entry.isFile()) {
        const abs = path.join(current, entry.name);
        if (!options.extensions || options.extensions.has(path.extname(entry.name).toLowerCase())) files.push(abs);
      }
    }
  }
  await walk(root);
  return files;
}

async function listConcreteFiles(assetPath) {
  const abs = portalAssetFsPath(assetPath);
  if (!(await pathExists(abs))) return [];
  const info = await stat(abs);
  if (info.isFile()) return [{ assetPath, sizeBytes: info.size }];
  if (!info.isDirectory()) return [];
  const files = await walkFiles(abs);
  const concrete = [];
  for (const file of files) {
    const rel = slash(path.relative(portalRoot, file));
    const fileInfo = await stat(file);
    concrete.push({ assetPath: rel, sizeBytes: fileInfo.size });
  }
  return concrete;
}

function lineForOffset(text, offset) {
  let line = 1;
  for (let i = 0; i < offset; i += 1) if (text.charCodeAt(i) === 10) line += 1;
  return line;
}

async function extractAssetReferences(abs) {
  const text = await readFile(abs, 'utf8');
  const refs = [];
  for (const match of text.matchAll(ASSET_REFERENCE_RE)) {
    const assetPath = normalizeAssetReference(match[0]);
    if (!assetPath) continue;
    refs.push({ assetPath, line: lineForOffset(text, match.index ?? 0), raw: match[0] });
  }
  return refs;
}

function packageScriptFiles(packageJson) {
  const files = new Set();
  for (const command of Object.values(packageJson.scripts ?? {})) {
    for (const match of String(command).matchAll(/scripts\/[A-Za-z0-9._\/-]+/g)) files.add(match[0]);
  }
  return files;
}

async function discoverScanFiles() {
  const files = new Set();
  const addIfExists = async (rel) => {
    const abs = path.join(repoRoot, rel);
    if (await pathExists(abs)) files.add(abs);
  };

  for (const rel of ['package.json', 'README.md', 'AGENTS.md']) await addIfExists(rel);
  for (const rel of ['apps/portal/main.js', 'apps/portal/index.html', 'apps/portal/editor.html', 'apps/portal/sw.js']) await addIfExists(rel);

  for (const abs of await walkFiles(path.join(portalRoot, 'src'), { extensions: new Set(['.mjs', '.js']) })) files.add(abs);
  for (const abs of await walkFiles(path.join(portalRoot, 'games'), { extensions: new Set(['.json', '.mjs', '.js']) })) files.add(abs);
  for (const abs of await walkFiles(path.join(portalRoot, 'assets'), { extensions: new Set(['.json', '.mjs']) })) files.add(abs);
  for (const abs of await walkFiles(path.join(repoRoot, 'docs'), { extensions: new Set(['.md']) })) files.add(abs);

  const packagePath = path.join(repoRoot, 'package.json');
  if (await pathExists(packagePath)) {
    const packageJson = JSON.parse(await readFile(packagePath, 'utf8'));
    for (const rel of packageScriptFiles(packageJson)) await addIfExists(rel);
  }

  return [...files].sort((a, b) => relFromRoot(a).localeCompare(relFromRoot(b)));
}

function initialSourceKind(rel) {
  if (rel === 'package.json' || rel.startsWith('scripts/')) return 'pipeline';
  if (rel.startsWith('docs/') || rel === 'README.md' || rel === 'AGENTS.md') return 'docs-only';
  if (rel.startsWith('apps/portal/assets/')) return 'manifest';
  if (
    rel === 'apps/portal/main.js' ||
    rel === 'apps/portal/index.html' ||
    rel === 'apps/portal/editor.html' ||
    rel === 'apps/portal/sw.js' ||
    rel.startsWith('apps/portal/src/') ||
    rel.startsWith('apps/portal/games/')
  ) return 'runtime';
  return 'pipeline';
}

function classifySource(rel, runtimeManifestAssets) {
  const kind = initialSourceKind(rel);
  if (kind !== 'manifest') return kind;
  const assetRel = rel.replace(/^apps\/portal\//, '');
  if (runtimeManifestAssets.has(assetRel)) return 'runtime';
  return 'pipeline';
}

function classificationRank(kind) {
  if (kind === 'runtime') return 3;
  if (kind === 'pipeline') return 2;
  if (kind === 'docs-only') return 1;
  return 0;
}

function mergeClassification(current, next) {
  return classificationRank(next) > classificationRank(current) ? next : current;
}

function assetBucket(assetPath) {
  const parts = assetPath.split('/');
  if (parts[0] !== 'assets') return parts[0] ?? assetPath;
  if (parts[1] === 'generated' && parts[2]) return `assets/generated/${parts[2]}`;
  if (parts[1] === 'audio' && parts[2]) return `assets/audio/${parts[2]}`;
  if (parts[1] === 'hard-money-heroes' && parts[2]) return `assets/hard-money-heroes/${parts[2]}`;
  if (parts[1] === 'hmh-curated-level-kit') return 'assets/hmh-curated-level-kit';
  if (parts[1] === 'video') return 'assets/video';
  if (parts[1] === 'reference') return 'assets/reference';
  return parts.slice(0, 2).join('/');
}

async function folderStats(assetFolder) {
  const abs = portalAssetFsPath(assetFolder);
  if (!(await pathExists(abs))) return { exists: false, fileCount: 0, sizeBytes: 0 };
  const info = await stat(abs);
  if (info.isFile()) return { exists: true, fileCount: 1, sizeBytes: info.size };
  let fileCount = 0;
  let sizeBytes = 0;
  for (const file of await walkFiles(abs)) {
    const fileInfo = await stat(file);
    fileCount += 1;
    sizeBytes += fileInfo.size;
  }
  return { exists: true, fileCount, sizeBytes };
}

async function discoverAssetFolders() {
  const folders = new Set();
  const assetsRoot = path.join(portalRoot, 'assets');
  if (!(await pathExists(assetsRoot))) return folders;
  for (const entry of await readdir(assetsRoot, { withFileTypes: true })) {
    if (entry.isDirectory()) folders.add(`assets/${entry.name}`);
  }
  for (const parent of ['generated', 'audio', 'hard-money-heroes']) {
    const parentAbs = path.join(assetsRoot, parent);
    if (!(await pathExists(parentAbs))) continue;
    for (const entry of await readdir(parentAbs, { withFileTypes: true })) {
      if (entry.isDirectory()) folders.add(`assets/${parent}/${entry.name}`);
    }
  }
  return folders;
}

function humanBytes(bytes) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

const scanFiles = await discoverScanFiles();
const preliminaryRefs = [];
for (const abs of scanFiles) {
  const rel = relFromRoot(abs);
  if (!TEXT_EXTENSIONS.has(path.extname(rel).toLowerCase())) continue;
  const refs = await extractAssetReferences(abs);
  for (const ref of refs) preliminaryRefs.push({ ...ref, source: rel, sourceKind: initialSourceKind(rel) });
}

const runtimeManifestAssets = new Set(
  preliminaryRefs
    .filter((ref) => ref.sourceKind === 'runtime' && /\.(?:json|mjs)$/i.test(ref.assetPath))
    .map((ref) => ref.assetPath),
);

const referenceMap = new Map();
for (const abs of scanFiles) {
  const rel = relFromRoot(abs);
  if (!TEXT_EXTENSIONS.has(path.extname(rel).toLowerCase())) continue;
  const sourceKind = classifySource(rel, runtimeManifestAssets);
  for (const ref of await extractAssetReferences(abs)) {
    const key = ref.assetPath;
    const current = referenceMap.get(key) ?? {
      assetPath: key,
      bucket: assetBucket(key),
      classification: 'docs-only',
      exists: false,
      isDirectory: false,
      directSizeBytes: 0,
      concreteFileCount: 0,
      concreteSizeBytes: 0,
      sources: [],
    };
    current.classification = mergeClassification(current.classification, sourceKind);
    current.sources.push({ file: rel, line: ref.line, kind: sourceKind });
    referenceMap.set(key, current);
  }
}

const concreteReferencedFiles = new Map();
for (const ref of referenceMap.values()) {
  const abs = portalAssetFsPath(ref.assetPath);
  if (await pathExists(abs)) {
    const info = await stat(abs);
    ref.exists = true;
    ref.isDirectory = info.isDirectory();
    ref.directSizeBytes = info.size;
  }
  const concrete = await listConcreteFiles(ref.assetPath);
  ref.concreteFileCount = concrete.length;
  ref.concreteSizeBytes = concrete.reduce((sum, file) => sum + file.sizeBytes, 0);
  for (const file of concrete) {
    const existing = concreteReferencedFiles.get(file.assetPath) ?? { assetPath: file.assetPath, sizeBytes: file.sizeBytes, classification: 'docs-only', buckets: new Set() };
    existing.classification = mergeClassification(existing.classification, ref.classification);
    existing.buckets.add(assetBucket(file.assetPath));
    concreteReferencedFiles.set(file.assetPath, existing);
  }
}

const assetFolders = await discoverAssetFolders();
for (const ref of referenceMap.values()) assetFolders.add(ref.bucket);

const folderSummaries = [];
for (const folder of [...assetFolders].sort()) {
  const stats = await folderStats(folder);
  let referencedFileCount = 0;
  let runtimeFileCount = 0;
  let pipelineFileCount = 0;
  let docsOnlyFileCount = 0;
  let referencedSizeBytes = 0;
  for (const concrete of concreteReferencedFiles.values()) {
    if (concrete.assetPath === folder || concrete.assetPath.startsWith(`${folder}/`)) {
      referencedFileCount += 1;
      referencedSizeBytes += concrete.sizeBytes;
      if (concrete.classification === 'runtime') runtimeFileCount += 1;
      else if (concrete.classification === 'pipeline') pipelineFileCount += 1;
      else docsOnlyFileCount += 1;
    }
  }
  folderSummaries.push({
    folder,
    exists: stats.exists,
    sizeBytes: stats.sizeBytes,
    size: humanBytes(stats.sizeBytes),
    fileCount: stats.fileCount,
    referencedFileCount,
    runtimeFileCount,
    pipelineFileCount,
    docsOnlyFileCount,
    unreferencedFileEstimate: Math.max(0, stats.fileCount - referencedFileCount),
    referencedSizeBytes,
    referencedSize: humanBytes(referencedSizeBytes),
  });
}

const references = [...referenceMap.values()].sort((a, b) => a.assetPath.localeCompare(b.assetPath));
const referencedAssets = {
  runtime: references.filter((ref) => ref.classification === 'runtime').map((ref) => ref.assetPath),
  pipeline: references.filter((ref) => ref.classification === 'pipeline').map((ref) => ref.assetPath),
  docsOnly: references.filter((ref) => ref.classification === 'docs-only').map((ref) => ref.assetPath),
};
const missingReferences = references
  .filter((ref) => !ref.exists)
  .map((ref) => ({
    assetPath: ref.assetPath,
    classification: ref.classification,
    sampleSources: ref.sources
      .sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)
      .slice(0, 3),
  }));

const result = {
  generatedAt: new Date().toISOString(),
  repoRoot: slash(repoRoot),
  method: {
    note: 'Static Phase 1 audit. Runtime classification means referenced by portal/app/editor source or by a manifest imported from that source. It must be paired with browser network capture before destructive removals.',
    scannedFiles: scanFiles.map(relFromRoot),
    runtimeManifestAssets: [...runtimeManifestAssets].sort(),
  },
  totals: {
    scannedFileCount: scanFiles.length,
    uniqueAssetReferenceCount: references.length,
    existingAssetReferenceCount: references.filter((ref) => ref.exists).length,
    missingAssetReferenceCount: references.filter((ref) => !ref.exists).length,
    concreteReferencedFileCount: concreteReferencedFiles.size,
    runtimeConcreteFileCount: [...concreteReferencedFiles.values()].filter((file) => file.classification === 'runtime').length,
    pipelineConcreteFileCount: [...concreteReferencedFiles.values()].filter((file) => file.classification === 'pipeline').length,
    docsOnlyConcreteFileCount: [...concreteReferencedFiles.values()].filter((file) => file.classification === 'docs-only').length,
  },
  folderSummaries,
  referencedAssets,
  missingReferences,
};

await mkdir(outputDir, { recursive: true });
await writeFile(outputPath, `${JSON.stringify(result)}\n`);

console.log(`Wrote ${relFromRoot(outputPath)}`);
console.log(`Scanned ${result.totals.scannedFileCount} files; found ${result.totals.uniqueAssetReferenceCount} unique asset references.`);
console.log(`Concrete referenced files: ${result.totals.concreteReferencedFileCount} (${result.totals.runtimeConcreteFileCount} runtime, ${result.totals.pipelineConcreteFileCount} pipeline, ${result.totals.docsOnlyConcreteFileCount} docs-only).`);
console.log('Largest asset buckets:');
for (const folder of [...folderSummaries].filter((row) => row.exists).sort((a, b) => b.sizeBytes - a.sizeBytes).slice(0, 12)) {
  console.log(`- ${folder.folder}: ${folder.size}, ${folder.fileCount} files, referenced ${folder.referencedFileCount} (${folder.runtimeFileCount} runtime)`);
}
