#!/usr/bin/env node
/**
 * Source-model Git LFS policy check (roadmap P-5).
 *
 * External GLB/FBX actors committed under `apps/hmh-reboot/assets/source/models/`
 * are repo-owned source, but they are large opaque binaries: they must travel
 * through Git LFS, stay under the per-file cap, and pack textures no larger than
 * the atlas exporter can consume. This script proves the policy offline against
 * the working repository, and, on request, proves that a clean clone can pull
 * every model back byte-for-byte.
 *
 *   node scripts/hmh-source-model-lfs-check.mjs                 # offline proof
 *   node scripts/hmh-source-model-lfs-check.mjs --clean-clone <empty-dir>
 *
 * Offline proof, in order:
 *   1. `.gitattributes` carries every rule in LFS_MODEL_RULES verbatim.
 *   2. `git check-attr` resolves `filter: lfs` for a probe path per extension.
 *   3. every tracked file under the models root with a policy extension is
 *      listed by `git lfs ls-files` (skipped with a note when git-lfs is absent).
 *   4. the HEAD blob of each such file is an LFS pointer, not the raw binary.
 *   5. the smudged working-tree file is <= SOURCE_MODEL_MAX_BYTES (40 MB).
 *   6. every PNG texture's IHDR width and height are <= MAX_TEXTURE_DIMENSION.
 *
 * `trackedModels: 0` is a PASS and is printed as such: the policy is in force
 * before the first model lands, which is the whole point.
 *
 * Clean-clone proof (`--clean-clone <dir>`): `GIT_LFS_SKIP_SMUDGE=1 git clone`
 * of this repository into <dir>, `git lfs pull`, then SHA-256 of every model
 * against the `sourceModel.sourceSha256` recorded in the actor manifests. It
 * is a first-commit ritual to run before pushing a new model, not a CI gate.
 *
 * Exit code 0 on PASS, 1 on any problem, 2 on bad usage.
 */
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SOURCE_MODEL_ROOT = 'apps/hmh-reboot/assets/source/models';
export const LFS_MODEL_EXTENSIONS = Object.freeze(['glb', 'fbx', 'bin', 'png', 'jpg', 'jpeg']);
export const LFS_MODEL_RULES = Object.freeze(
  LFS_MODEL_EXTENSIONS.map((extension) => `${SOURCE_MODEL_ROOT}/**/*.${extension} filter=lfs diff=lfs merge=lfs -text`),
);
// Per-file cap for one committed source model (roadmap P-5: 40 MB). A Tripo or
// Mixamo GLB with packed 2048 textures lands well under this; anything above
// it is almost always an unpacked texture set or an un-decimated scan.
export const SOURCE_MODEL_MAX_BYTES = 40 * 1024 * 1024;
// Largest texture edge the atlas exporter will consume (roadmap P-5: <= 2048).
export const MAX_TEXTURE_DIMENSION = 2048;
export const LFS_POINTER_FIRST_LINE = 'version https://git-lfs.github.com/spec/v1';

const MANIFEST_PATHS = Object.freeze([
  'apps/hmh-reboot/assets/source/blender/hmh-production-heroes.json',
  'apps/hmh-reboot/assets/source/blender/hmh-enemy-roster.json',
]);

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export function isLfsPointer(bytes) {
  if (!bytes || bytes.length < LFS_POINTER_FIRST_LINE.length) return false;
  const firstLine = bytes.subarray(0, LFS_POINTER_FIRST_LINE.length).toString('utf8');
  return firstLine === LFS_POINTER_FIRST_LINE;
}

export function readPngDimensions(bytes) {
  if (!bytes || bytes.length < 24) return null;
  if (!bytes.subarray(0, 8).equals(PNG_SIGNATURE)) return null;
  if (bytes.subarray(12, 16).toString('ascii') !== 'IHDR') return null;
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

export function missingLfsRules(gitattributesText) {
  const lines = String(gitattributesText ?? '').split(/\r?\n/).map((line) => line.trim());
  return LFS_MODEL_RULES.filter((rule) => !lines.includes(rule));
}

export function modelExtension(relativePath) {
  const extension = path.posix.extname(relativePath).slice(1).toLowerCase();
  return LFS_MODEL_EXTENSIONS.includes(extension) ? extension : null;
}

export function evaluateSourceModelFile({ path: relativePath, sizeBytes, pngDimensions = null } = {}) {
  const problems = [];
  if (!Number.isFinite(sizeBytes) || sizeBytes < 0) {
    problems.push(`${relativePath}: size is not measurable`);
  } else if (sizeBytes > SOURCE_MODEL_MAX_BYTES) {
    problems.push(`${relativePath}: ${sizeBytes.toLocaleString('en-US')} bytes exceeds the 40 MB per-file cap (${SOURCE_MODEL_MAX_BYTES.toLocaleString('en-US')} bytes)`);
  }
  const extension = modelExtension(relativePath ?? '');
  if (extension === 'png') {
    if (!pngDimensions) {
      problems.push(`${relativePath}: PNG IHDR could not be read`);
    } else if (pngDimensions.width > MAX_TEXTURE_DIMENSION || pngDimensions.height > MAX_TEXTURE_DIMENSION) {
      problems.push(`${relativePath}: texture ${pngDimensions.width}x${pngDimensions.height} exceeds ${MAX_TEXTURE_DIMENSION} px per edge`);
    }
  }
  return { path: relativePath, sizeBytes, pngDimensions, problems };
}

function git(root, args, { env = process.env } = {}) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', env, maxBuffer: 64 * 1024 * 1024 });
  return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '', error: result.error };
}

function gitBinary(root, args) {
  const result = spawnSync('git', args, { cwd: root, maxBuffer: 256 * 1024 * 1024 });
  return { status: result.status, stdout: result.stdout ?? Buffer.alloc(0), stderr: result.stderr?.toString('utf8') ?? '' };
}

function parseCheckAttr(stdout) {
  const attributes = {};
  for (const line of stdout.split(/\r?\n/)) {
    const match = /^(.*?): ([a-z]+): (.*)$/.exec(line.trim());
    if (match) attributes[match[2]] = match[3];
  }
  return attributes;
}

export async function runOfflineCheck({ root = process.cwd() } = {}) {
  const notes = [];
  const problems = [];
  const gitattributesPath = path.join(root, '.gitattributes');
  const gitattributes = existsSync(gitattributesPath) ? readFileSync(gitattributesPath, 'utf8') : '';
  const missingRules = missingLfsRules(gitattributes);
  for (const rule of missingRules) problems.push(`.gitattributes is missing: ${rule}`);

  const checkAttr = [];
  for (const extension of LFS_MODEL_EXTENSIONS) {
    const probe = `${SOURCE_MODEL_ROOT}/probe/probe.${extension}`;
    const result = git(root, ['check-attr', 'filter', 'diff', 'merge', 'text', '--', probe]);
    const attributes = result.status === 0 ? parseCheckAttr(result.stdout) : {};
    const entry = { probe, filter: attributes.filter ?? null, diff: attributes.diff ?? null, merge: attributes.merge ?? null, text: attributes.text ?? null };
    checkAttr.push(entry);
    if (entry.filter !== 'lfs') problems.push(`git check-attr resolves filter=${entry.filter} (expected lfs) for ${probe}`);
    if (entry.text !== 'unset') problems.push(`git check-attr resolves text=${entry.text} (expected unset via -text) for ${probe}`);
  }

  const lfsVersion = git(root, ['lfs', 'version']);
  const lfsAvailable = lfsVersion.status === 0;
  if (!lfsAvailable) notes.push('git-lfs is not installed on this host: the `git lfs ls-files` subset check was skipped; pointer detection still ran through git cat-file.');

  const tracked = git(root, ['ls-files', '--', SOURCE_MODEL_ROOT]);
  const trackedModelPaths = tracked.status === 0
    ? tracked.stdout.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && modelExtension(line))
    : [];
  if (tracked.status !== 0) problems.push(`git ls-files failed: ${tracked.stderr.trim()}`);

  let lfsListed = new Set();
  if (lfsAvailable) {
    const listed = git(root, ['lfs', 'ls-files', '--name-only']);
    if (listed.status === 0) lfsListed = new Set(listed.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean));
    else problems.push(`git lfs ls-files failed: ${listed.stderr.trim()}`);
  }

  const headExists = git(root, ['rev-parse', '--verify', '--quiet', 'HEAD']).status === 0;
  const models = [];
  for (const relativePath of trackedModelPaths) {
    const absolute = path.join(root, relativePath);
    const sizeBytes = existsSync(absolute) ? statSync(absolute).size : NaN;
    const bytes = existsSync(absolute) ? readFileSync(absolute) : null;
    const workingTreeIsPointer = bytes ? isLfsPointer(bytes) : false;
    const pngDimensions = bytes && modelExtension(relativePath) === 'png' && !workingTreeIsPointer ? readPngDimensions(bytes) : null;
    const evaluation = workingTreeIsPointer
      ? { path: relativePath, sizeBytes, pngDimensions: null, problems: [] }
      : evaluateSourceModelFile({ path: relativePath, sizeBytes, pngDimensions });
    if (workingTreeIsPointer) notes.push(`${relativePath} is an unsmudged pointer in this working tree (GIT_LFS_SKIP_SMUDGE or missing object); size and texture checks need \`git lfs pull\`.`);
    let pointerInHead = null;
    if (headExists) {
      const head = gitBinary(root, ['cat-file', '-p', `HEAD:${relativePath}`]);
      if (head.status === 0) pointerInHead = isLfsPointer(head.stdout);
      else {
        const index = gitBinary(root, ['cat-file', '-p', `:${relativePath}`]);
        pointerInHead = index.status === 0 ? isLfsPointer(index.stdout) : null;
        if (pointerInHead !== null) notes.push(`${relativePath} is staged but not yet in HEAD; the index blob was inspected instead.`);
      }
    }
    if (pointerInHead === false) evaluation.problems.push(`${relativePath}: the committed blob is the raw binary, not an LFS pointer (was it added before the .gitattributes rule?)`);
    if (lfsAvailable && !lfsListed.has(relativePath)) evaluation.problems.push(`${relativePath}: tracked in Git but not listed by \`git lfs ls-files\``);
    models.push({ ...evaluation, pointerInHead, lfsListed: lfsAvailable ? lfsListed.has(relativePath) : null });
    problems.push(...evaluation.problems);
  }

  let endpoint = null;
  if (lfsAvailable) {
    const env = git(root, ['lfs', 'env']);
    const match = /^Endpoint=(\S+)/m.exec(env.stdout);
    endpoint = match ? match[1] : null;
  }

  return {
    ok: problems.length === 0,
    root,
    rules: [...LFS_MODEL_RULES],
    missingRules,
    checkAttr,
    lfsAvailable,
    lfsVersion: lfsAvailable ? lfsVersion.stdout.trim() : null,
    endpoint,
    trackedModels: models.length,
    models,
    maxBytesPerFile: SOURCE_MODEL_MAX_BYTES,
    maxTextureDimension: MAX_TEXTURE_DIMENSION,
    notes,
    problems,
  };
}

async function readManifestShas(root) {
  const expected = new Map();
  for (const manifestPath of MANIFEST_PATHS) {
    const absolute = path.join(root, manifestPath);
    if (!existsSync(absolute)) continue;
    const manifest = JSON.parse(await readFile(absolute, 'utf8'));
    const entries = Array.isArray(manifest.actors) ? manifest.actors : Array.isArray(manifest.enemies) ? manifest.enemies : Object.values(manifest).find(Array.isArray) ?? [];
    for (const entry of entries) {
      const source = entry?.sourceModel;
      if (source?.path && source?.sourceSha256) expected.set(source.path.replace(/\\/g, '/'), { sha256: String(source.sourceSha256).toLowerCase(), manifest: manifestPath, actorId: entry.actorId ?? entry.id ?? null });
    }
  }
  return expected;
}

async function walkModels(rootDir) {
  const found = [];
  const modelsDir = path.join(rootDir, SOURCE_MODEL_ROOT);
  if (!existsSync(modelsDir)) return found;
  const visit = async (dir) => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) await visit(absolute);
      else if (modelExtension(entry.name)) found.push(path.relative(rootDir, absolute).split(path.sep).join('/'));
    }
  };
  await visit(modelsDir);
  return found;
}

function run(command, args, { cwd, env }) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', (error) => resolve({ status: -1, stdout, stderr: `${stderr}\n${error.message}` }));
    child.on('close', (status) => resolve({ status, stdout, stderr }));
  });
}

export async function runCleanCloneProof({ root = process.cwd(), targetDir } = {}) {
  if (!targetDir) throw new TypeError('targetDir is required');
  const target = path.resolve(targetDir);
  if (existsSync(target) && (await readdir(target)).length > 0) throw new Error(`clean-clone target must be empty: ${target}`);
  const problems = [];
  const env = { ...process.env, GIT_LFS_SKIP_SMUDGE: '1' };
  const clone = await run('git', ['clone', '--quiet', '--no-local', root, target], { cwd: path.dirname(target), env });
  if (clone.status !== 0) return { ok: false, target, problems: [`git clone failed: ${clone.stderr.trim()}`] };
  const pull = await run('git', ['lfs', 'pull'], { cwd: target, env: process.env });
  if (pull.status !== 0) problems.push(`git lfs pull failed: ${pull.stderr.trim()}`);
  const expected = await readManifestShas(root);
  const files = await walkModels(target);
  const verified = [];
  for (const relativePath of files) {
    const bytes = await readFile(path.join(target, relativePath));
    const pointer = isLfsPointer(bytes);
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const sizeBytes = (await stat(path.join(target, relativePath))).size;
    const manifest = expected.get(relativePath) ?? null;
    const entry = { path: relativePath, sizeBytes, sha256, stillPointer: pointer, manifestSha256: manifest?.sha256 ?? null, actorId: manifest?.actorId ?? null, problems: [] };
    if (pointer) entry.problems.push(`${relativePath}: still an LFS pointer after git lfs pull (object missing on the remote?)`);
    if (manifest && manifest.sha256 !== sha256) entry.problems.push(`${relativePath}: sha256 ${sha256} does not match manifest sourceSha256 ${manifest.sha256}`);
    if (!manifest) entry.problems.push(`${relativePath}: no manifest entry declares this file as a sourceModel`);
    entry.problems.push(...evaluateSourceModelFile({ path: relativePath, sizeBytes, pngDimensions: modelExtension(relativePath) === 'png' ? readPngDimensions(bytes) : null }).problems);
    problems.push(...entry.problems);
    verified.push(entry);
  }
  for (const [manifestPath, manifest] of expected) {
    if (!files.includes(manifestPath)) problems.push(`${manifestPath} is declared by ${manifest.manifest} but absent from the clean clone`);
  }
  return { ok: problems.length === 0, target, cloned: true, lfsPulled: pull.status === 0, files: verified, expectedFromManifests: expected.size, problems };
}

function usage() {
  console.error('usage: node scripts/hmh-source-model-lfs-check.mjs [--clean-clone <empty-dir>] [--root <repo>]');
}

async function main(argv) {
  let root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  let cleanCloneDir = null;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--clean-clone') {
      cleanCloneDir = argv[index + 1];
      index += 1;
      if (!cleanCloneDir) { usage(); return 2; }
    } else if (argument === '--root') {
      root = path.resolve(argv[index + 1] ?? '');
      index += 1;
    } else {
      usage();
      return 2;
    }
  }
  const offline = await runOfflineCheck({ root });
  const report = { mode: cleanCloneDir ? 'offline+clean-clone' : 'offline', offline };
  if (cleanCloneDir) report.cleanClone = await runCleanCloneProof({ root, targetDir: cleanCloneDir });
  const ok = offline.ok && (report.cleanClone ? report.cleanClone.ok : true);
  console.log(JSON.stringify(report, null, 2));
  console.log(ok
    ? `PASS source-model LFS policy: trackedModels=${offline.trackedModels}, rules=${offline.rules.length}/${LFS_MODEL_RULES.length}, lfs=${offline.lfsAvailable ? offline.lfsVersion : 'absent'}${report.cleanClone ? `, cleanClone=${report.cleanClone.files.length} files verified` : ''}`
    : `FAIL source-model LFS policy: ${[...offline.problems, ...(report.cleanClone?.problems ?? [])].join(' | ')}`);
  return ok ? 0 : 1;
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; }, (error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
