import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

/**
 * Cycle 073 (P-4 follow-up): the enemy roster reproducibility gate compares
 * the two cold passes in the hero pipeline's budget form, measured on the
 * premultiplied, UNquantised normalised frames.
 *
 * Why the old gate could never pass under EEVEE: `canonicalize_rendered_rgb`
 * (nearest-8 bucketing, offset 4) ran BEFORE the in-place save, so a one-LSB
 * raw flip that happened to sit on a bucket edge (123 -> 124) became exactly 8
 * (120 -> 128), and `frames_within_lsb_tolerance` then rejected anything above
 * 1. A visible RGB channel could therefore only match exactly or fail. On the
 * preserved Cycle 072 passes all 71 eight-step drifts were adjacent multiples
 * of 8 and the 13 "large" deltas were one LSB in premultiplied space at alpha
 * 1-23. The quantiser manufactured the failure it was meant to absorb, and it
 * posterised EEVEE's gradients to 32 levels per channel on the way.
 *
 * These tests exercise the pure comparison and normalisation helpers of the
 * Python pipeline directly, without Blender, so the contract is pinned by
 * behaviour rather than by regex alone.
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRootPosix = repoRoot.replaceAll('\\', '/');
const pipelinePath = path.join(repoRoot, 'scripts', 'run-hmh-enemy-roster-pipeline.py');
const pipelineSource = readFileSync(pipelinePath, 'utf8');
const manifest = JSON.parse(readFileSync(path.join(repoRoot, 'apps', 'hmh-reboot', 'assets', 'source', 'blender', 'hmh-enemy-roster.json'), 'utf8'));
const heroManifest = JSON.parse(readFileSync(path.join(repoRoot, 'apps', 'hmh-reboot', 'assets', 'source', 'blender', 'hmh-production-heroes.json'), 'utf8'));

const HERO_BUDGET = Object.freeze({ maxChangedVisiblePixels: 8, maxChannelDelta: 2, maxTotalChannelDelta: 32 });

const scratchRoot = path.join(repoRoot, '.tmp', 'enemy-roster-reproducibility-test');

function runPipelinePython(body) {
  const preamble = [
    'import importlib.util, json, sys',
    'from pathlib import Path',
    'from PIL import Image',
    `root = Path(${JSON.stringify(repoRootPosix)})`,
    "sys.path.insert(0, str(root / 'scripts'))",
    "spec = importlib.util.spec_from_file_location('roster_pipeline', root / 'scripts' / 'run-hmh-enemy-roster-pipeline.py')",
    'pipe = importlib.util.module_from_spec(spec)',
    'spec.loader.exec_module(pipe)',
    `budget = json.loads(${JSON.stringify(JSON.stringify(HERO_BUDGET))})`,
  ].join('\n');
  const result = spawnSync('python', ['-c', `${preamble}\n${body}`], { cwd: repoRoot, encoding: 'utf8' });
  assert.equal(result.status, 0, `python helper failed:\n${result.stderr}`);
  const lastLine = result.stdout.trim().split(/\r?\n/).at(-1);
  return JSON.parse(lastLine);
}

function freshScratch(name) {
  const dir = path.join(scratchRoot, name);
  rmSync(dir, { force: true, recursive: true });
  mkdirSync(dir, { recursive: true });
  return dir.replaceAll('\\', '/');
}

test('a one-LSB raw flip on a nearest-8 bucket edge is a one-LSB difference in the compared space', () => {
  const dir = freshScratch('bucket-edge');
  const result = runPipelinePython([
    `first = Path(${JSON.stringify(`${dir}/first`)}); second = Path(${JSON.stringify(`${dir}/second`)})`,
    'first.mkdir(); second.mkdir()',
    'a = Image.new("RGBA", (4, 4), (123, 90, 40, 255))',
    'b = a.copy(); b.putpixel((1, 1), (124, 90, 40, 255))',
    'a.save(first / "f.png"); b.save(second / "f.png")',
    'report = pipe.compare_frames_premultiplied(first, second, ["f.png"])',
    'exceeded = pipe.frames_exceeding_budget(report, budget)',
    'print(json.dumps({"report": report, "exceeded": exceeded}))',
  ].join('\n'));
  assert.deepEqual(result.report, { 'f.png': { changed: 1, maxDelta: 1, totalDelta: 1 } });
  assert.deepEqual(result.exceeded, [], 'a single LSB on one opaque pixel is inside the hero budget');
});

test('a large raw RGB delta under near-zero alpha is one LSB premultiplied and stays inside the budget', () => {
  // Preserved Cycle 072 evidence: [0,0,128,2] vs [128,0,128,2] read as a
  // delta of 128 in straight RGB. Composited over anything, both pixels
  // contribute at most one level, and the premultiplied compare says so.
  const dir = freshScratch('fringe');
  const result = runPipelinePython([
    `first = Path(${JSON.stringify(`${dir}/first`)}); second = Path(${JSON.stringify(`${dir}/second`)})`,
    'first.mkdir(); second.mkdir()',
    'a = Image.new("RGBA", (4, 4), (0, 0, 0, 0))',
    'a.putpixel((2, 2), (0, 0, 128, 2))',
    'b = a.copy(); b.putpixel((2, 2), (128, 0, 128, 2))',
    'a.save(first / "f.png"); b.save(second / "f.png")',
    'report = pipe.compare_frames_premultiplied(first, second, ["f.png"])',
    'print(json.dumps({"report": report, "exceeded": pipe.frames_exceeding_budget(report, budget)}))',
  ].join('\n'));
  assert.deepEqual(result.report, { 'f.png': { changed: 1, maxDelta: 1, totalDelta: 1 } });
  assert.deepEqual(result.exceeded, []);
});

test('a genuine geometry change still fails the budget on every axis it exceeds', () => {
  const dir = freshScratch('geometry');
  const result = runPipelinePython([
    `first = Path(${JSON.stringify(`${dir}/first`)}); second = Path(${JSON.stringify(`${dir}/second`)})`,
    'first.mkdir(); second.mkdir()',
    'a = Image.new("RGBA", (8, 8), (60, 60, 60, 255))',
    'b = a.copy()',
    'for index in range(30):',
    '    b.putpixel((index % 8, index // 8), (100, 60, 60, 255))',
    'a.save(first / "f.png"); b.save(second / "f.png")',
    'c = a.copy(); c.putpixel((7, 7), (63, 60, 60, 255))',
    'c.save(second / "g.png"); a.save(first / "g.png")',
    'report = pipe.compare_frames_premultiplied(first, second, ["f.png", "g.png"])',
    'observed = pipe.summarize_observed_drift(report)',
    'print(json.dumps({"report": report, "exceeded": pipe.frames_exceeding_budget(report, budget), "observed": observed}))',
  ].join('\n'));
  assert.deepEqual(result.report['f.png'], { changed: 30, maxDelta: 40, totalDelta: 1200 });
  assert.deepEqual(result.report['g.png'], { changed: 1, maxDelta: 3, totalDelta: 3 });
  // f exceeds every axis; g exceeds only maxChannelDelta (3 > 2). Both fail.
  assert.deepEqual(result.exceeded, ['f.png', 'g.png']);
  assert.deepEqual(result.observed, {
    maxChangedVisiblePixels: 30,
    maxChannelDelta: 40,
    maxTotalChannelDelta: 1200,
    driftedFrameCount: 2,
    worstFrameId: 'f',
  });
});

test('the roster publishes the hero budget policy under its own name and the quantiser is gone', () => {
  assert.deepEqual(manifest.reproducibilityBudget, HERO_BUDGET);
  assert.deepEqual(manifest.reproducibilityBudget, heroManifest.reproducibilityBudget, 'heroes and enemies share one budget');
  assert.match(pipelineSource, /def compare_frames_premultiplied\(/);
  assert.match(pipelineSource, /def frames_exceeding_budget\(/);
  assert.match(pipelineSource, /def summarize_observed_drift\(/);
  assert.match(pipelineSource, /def build_reproducibility_policy\(/);
  assert.match(pipelineSource, /manifest\["reproducibilityBudget"\]/);
  assert.match(pipelineSource, /compare_frames_premultiplied\(repro_snapshot, raw_dir, drifted_frames\)/);
  for (const removed of ['canonicalize_rendered_rgb', 'rgbCanonicalization', 'RGB_CANONICALIZATION', 'LSB_TOLERANCE', 'frames_within_lsb_tolerance', 'exact-or-single-lsb']) {
    assert.ok(!pipelineSource.includes(removed), `${removed} must not survive in the pipeline`);
  }

  const result = runPipelinePython([
    'report = {"x.png": {"changed": 2, "maxDelta": 1, "totalDelta": 2}}',
    'policy = pipe.build_reproducibility_policy(budget, report, verified=True)',
    'unverified = pipe.build_reproducibility_policy(budget, None, verified=False)',
    'print(json.dumps({"policy": policy, "unverified": unverified}))',
  ].join('\n'));
  assert.deepEqual(result.policy, {
    kind: 'bounded-premultiplied-rgba-v1',
    budget: HERO_BUDGET,
    comparedSpace: 'premultiplied-rgba-8bit-unquantised',
    coldSceneRebuild: true,
    metadataExactExceptDerivedPixelSha: true,
    observed: { maxChangedVisiblePixels: 2, maxChannelDelta: 1, maxTotalChannelDelta: 2, driftedFrameCount: 1, worstFrameId: 'x' },
    toleratedFrames: { 'x.png': { changed: 2, maxDelta: 1, totalDelta: 2 } },
  });
  assert.equal(result.unverified.kind, 'bounded-premultiplied-rgba-v1');
  assert.equal(result.unverified.observed, null);
  assert.equal(result.unverified.toleratedFrames, null);
});

test('normalisation preserves the supersampled frame beside the runtime frame so raw drift stays measurable', () => {
  const dir = freshScratch('supersampled');
  const result = runPipelinePython([
    `raw = Path(${JSON.stringify(`${dir}/raw`)}); raw.mkdir()`,
    'manifest = {"render": {"renderScale": 2, "frameSize": [4, 4], "alphaThreshold": 8, "minAlphaComponentPixels": 1},',
    '            "clips": {"idle": {"frames": 1, "fps": 1}}, "directions": ["south"], "actors": [{"actorId": "probe"}]}',
    'image = Image.new("RGBA", (8, 8), (0, 0, 0, 0))',
    'for y in range(8):',
    '    for x in range(8):',
    '        image.putpixel((x, y), (30 * x, 30 * y, 120, 255))',
    'name = "probe__body__idle__south__000.png"',
    'image.save(raw / name)',
    'before = (raw / name).read_bytes()',
    'pipe.normalize_rendered_frames(manifest, raw)',
    'snapshot = raw / "supersampled" / name',
    'normalised = Image.open(raw / name)',
    'print(json.dumps({"snapshotExists": snapshot.exists(), "snapshotIdentical": snapshot.exists() and snapshot.read_bytes() == before,',
    '                  "snapshotSize": list(Image.open(snapshot).size) if snapshot.exists() else None, "normalisedSize": list(normalised.size)}))',
  ].join('\n'));
  assert.equal(result.snapshotExists, true);
  assert.equal(result.snapshotIdentical, true, 'the supersampled copy must be the byte-exact Blender output');
  assert.deepEqual(result.snapshotSize, [8, 8]);
  assert.deepEqual(result.normalisedSize, [4, 4]);
  // The copy has to happen before the resize, or a failing run destroys the
  // only evidence that can distinguish renderer jitter from scene-build drift.
  assert.match(pipelineSource, /supersampled[\s\S]*?normalized = image\.resize\(target_size, Image\.Resampling\.LANCZOS\)/);
});

test('canonical_rgba zeroes colour under alpha 0 and leaves every visible channel untouched', () => {
  // EEVEE writes undefined RGB under alpha 0 on a transparent film. Lanczos
  // would smear it into the visible edge and the compare reads all four
  // channels, so the zeroing lives in the one funnel every read goes through.
  const result = runPipelinePython([
    'image = Image.new("RGBA", (2, 1), (200, 100, 50, 0))',
    'image.putpixel((1, 0), (201, 101, 51, 7))',
    'out = pipe.canonical_rgba(image)',
    'print(json.dumps({"pixels": [list(out.getpixel((0, 0))), list(out.getpixel((1, 0)))]}))',
  ].join('\n'));
  assert.deepEqual(result.pixels, [[0, 0, 0, 0], [201, 101, 51, 7]]);
});

test('the raw supersampled frames of both passes are measured in straight RGBA before Lanczos', () => {
  // This is the number Cycle 072 could not produce: the renderer's own jitter
  // on the byte-exact Blender output, before any resize can spread or hide it.
  const dir = freshScratch('supersampled-histogram');
  const result = runPipelinePython([
    `first = Path(${JSON.stringify(`${dir}/first`)}); second = Path(${JSON.stringify(`${dir}/second`)})`,
    'first.mkdir(); second.mkdir()',
    'a = Image.new("RGBA", (8, 8), (90, 80, 70, 255))',
    'b = a.copy(); b.putpixel((1, 1), (91, 80, 70, 255)); b.putpixel((2, 2), (90, 80, 70, 252))',
    'a.save(first / "x__body__idle__south__000.png"); b.save(second / "x__body__idle__south__000.png")',
    'a.save(first / "x__body__idle__south__001.png"); a.save(second / "x__body__idle__south__001.png")',
    // A frame whose drift is RGB-only under full alpha: Pillow's getbbox()
    // defaults to alpha_only=True on RGBA, which would silently miss it.
    'c = a.copy(); c.putpixel((3, 3), (90, 84, 70, 255))',
    'a.save(first / "x__body__run__south__000.png"); c.save(second / "x__body__run__south__000.png")',
    'print(json.dumps(pipe.supersampled_drift_histogram(first, second)))',
  ].join('\n'));
  assert.deepEqual(result, {
    framesCompared: 3,
    driftedFrames: 2,
    rgbDeltaHistogram: { 1: 1, 4: 1 },
    alphaDeltaHistogram: { 3: 1 },
    maxRgbDelta: 4,
    differingRgbSubpixels: 2,
    differingAlphaSubpixels: 1,
  });
  // The second pass's supersampled frames survive a PASSING gate too, so the
  // numbers can be re-derived after the first pass is restored.
  assert.match(pipelineSource, /hmh-enemy-roster-repro-second-supersampled/);
  assert.match(pipelineSource, /supersampled_drift_histogram\(repro_snapshot \/ SUPERSAMPLED_DIRNAME, raw_dir \/ SUPERSAMPLED_DIRNAME\)/);
});

test('a failed gate leaves a machine-readable drift report before raising', () => {
  const dir = freshScratch('drift-report');
  const result = runPipelinePython([
    `first = Path(${JSON.stringify(`${dir}/first`)}); second = Path(${JSON.stringify(`${dir}/second`)})`,
    'first.mkdir(); second.mkdir()',
    'a = Image.new("RGBA", (4, 4), (60, 60, 60, 255))',
    'b = a.copy(); b.putpixel((0, 0), (63, 60, 60, 255)); b.putpixel((1, 0), (60, 61, 60, 255))',
    'a.save(first / "gas-bomber__body__idle__south__000.png"); b.save(second / "gas-bomber__body__idle__south__000.png")',
    'names = ["gas-bomber__body__idle__south__000.png"]',
    'report = pipe.compare_frames_premultiplied(first, second, names)',
    `out = Path(${JSON.stringify(`${dir}/drift.json`)})`,
    'written = pipe.write_drift_report(out, first, second, names, report, budget)',
    'print(json.dumps(json.loads(out.read_text(encoding="utf-8"))))',
  ].join('\n'));
  assert.deepEqual(result.budget, HERO_BUDGET);
  assert.deepEqual(result.observed, { maxChangedVisiblePixels: 2, maxChannelDelta: 3, maxTotalChannelDelta: 4, driftedFrameCount: 1, worstFrameId: 'gas-bomber__body__idle__south__000' });
  assert.deepEqual(result.exceededFrames, ['gas-bomber__body__idle__south__000.png']);
  assert.deepEqual(result.premultipliedDeltaHistogram, { 1: 1, 3: 1 });
  assert.deepEqual(result.perActor, { 'gas-bomber': 1 });
  assert.deepEqual(result.alphaBandOfDriftedSubpixels, { '255': 2 });
  assert.match(pipelineSource, /write_drift_report\(DRIFT_REPORT_PATH,[\s\S]*?raise RuntimeError\(/);
});
