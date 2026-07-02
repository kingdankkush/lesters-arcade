import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildGroundPlan } from '../apps/portal/src/hmh-ground-plan.mjs';
import { HMH_LEVEL_ONE_ID } from '../apps/portal/src/hmh-level-one-ground.mjs';
import { auditPaletteCompliance, readRgbaPng } from './sprite-qa.mjs';

const DEFAULT_EDGE_THRESHOLD = 18;
const DEFAULT_MIN_RESOLUTION = 128;
const DEFAULT_SAMPLE_SEED = 1337;
const TEMP_APPROVED_KEEP_KEYS = new Set([
  'final-paint/dirt-handpaint-01',
  'final-paint/grass-handpaint-01',
  'final-paint/road-asphalt-handpaint-01',
  'final-paint/rocky-handpaint-01',
  'final-paint/sand-handpaint-01',
  'final-paint/shore-grass-water-handpaint-01',
  'final-paint/water-ripple-handpaint-01',
]);

function repoRootFromHere() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
}

function repoRelative(repoRoot, absPath) {
  return path.relative(repoRoot, absPath).replaceAll('\\', '/');
}

function assetPath(repoRoot, asset) {
  const cleanSrc = String(asset?.src ?? '').replace(/^\.\//, '');
  return path.join(repoRoot, 'apps/portal', cleanSrc);
}

function pixel(frame, x, y) {
  const i = ((y * frame.width) + x) * 4;
  return [frame.pixels[i], frame.pixels[i + 1], frame.pixels[i + 2], frame.pixels[i + 3]];
}

function meanEdgeDifference(frame) {
  let lrTotal = 0;
  let lrChannels = 0;
  for (let y = 0; y < frame.height; y += 1) {
    const left = pixel(frame, 0, y);
    const right = pixel(frame, frame.width - 1, y);
    for (let c = 0; c < 3; c += 1) {
      lrTotal += Math.abs(left[c] - right[c]);
      lrChannels += 1;
    }
  }

  let tbTotal = 0;
  let tbChannels = 0;
  for (let x = 0; x < frame.width; x += 1) {
    const top = pixel(frame, x, 0);
    const bottom = pixel(frame, x, frame.height - 1);
    for (let c = 0; c < 3; c += 1) {
      tbTotal += Math.abs(top[c] - bottom[c]);
      tbChannels += 1;
    }
  }

  const leftRight = lrChannels ? lrTotal / lrChannels : Number.POSITIVE_INFINITY;
  const topBottom = tbChannels ? tbTotal / tbChannels : Number.POSITIVE_INFINITY;
  return Object.freeze({
    leftRight: Number(leftRight.toFixed(2)),
    topBottom: Number(topBottom.toFixed(2)),
    worst: Number(Math.max(leftRight, topBottom).toFixed(2)),
  });
}

function statusFor(checks) {
  return checks.every(Boolean) ? 'pass' : 'fail';
}

function decisionForTextureKey(textureKey) {
  return TEMP_APPROVED_KEEP_KEYS.has(textureKey)
    ? Object.freeze({ decision: 'TEMP_KEEP_APPROVED', approvedForPlan: true, notes: 'Justin approved continuing with this repo-owned final-paint texture as a temporary runtime keep; regenerate true 128x128 square seamless replacement in WO-14.' })
    : Object.freeze({ decision: 'REGENERATE', approvedForPlan: false, notes: 'Not approved for continued runtime reference by WO-4; reassign the zone to an approved same-role texture until WO-14 regeneration.' });
}

function collectPlanTextureReferences(plan) {
  const references = new Map();
  for (const zone of plan.zones) {
    const current = references.get(zone.textureKey) ?? {
      key: zone.textureKey,
      roles: new Set(),
      zoneIds: [],
    };
    current.roles.add(zone.role);
    current.zoneIds.push(zone.zoneId);
    references.set(zone.textureKey, current);
  }
  return [...references.values()].map((entry) => Object.freeze({
    key: entry.key,
    roles: [...entry.roles].sort(),
    zoneIds: [...entry.zoneIds].sort(),
  })).sort((a, b) => a.key.localeCompare(b.key));
}

export function auditGroundTextures({ repoRoot = repoRootFromHere(), levelId = HMH_LEVEL_ONE_ID, seed = DEFAULT_SAMPLE_SEED } = {}) {
  const plan = buildGroundPlan({ levelId, seed });
  const references = collectPlanTextureReferences(plan);
  const rows = references.map((reference) => {
    const asset = plan.textureForKey(reference.key);
    if (!asset) {
      return Object.freeze({
        ...reference,
        ...decisionForTextureKey(reference.key),
        status: 'fail',
        reason: 'texture-key-missing-from-manifest',
        path: null,
      });
    }

    const absPath = assetPath(repoRoot, asset);
    try {
      const frame = readRgbaPng(absPath);
      const edge = meanEdgeDifference(frame);
      const palette = auditPaletteCompliance(frame, undefined, { distanceThreshold: 46, maxOffPaletteRatio: 0.08 });
      const resolutionPass = frame.width >= DEFAULT_MIN_RESOLUTION && frame.height >= DEFAULT_MIN_RESOLUTION;
      const seamlessPass = edge.worst <= DEFAULT_EDGE_THRESHOLD;
      const palettePass = palette.status === 'pass';
      return Object.freeze({
        ...reference,
        ...decisionForTextureKey(reference.key),
        status: statusFor([resolutionPass, seamlessPass, palettePass]),
        role: asset.role ?? reference.roles[0] ?? 'unknown',
        path: repoRelative(repoRoot, absPath),
        width: frame.width,
        height: frame.height,
        seamless: Object.freeze({ status: seamlessPass ? 'pass' : 'fail', threshold: DEFAULT_EDGE_THRESHOLD, ...edge }),
        palette,
        resolution: Object.freeze({ status: resolutionPass ? 'pass' : 'fail', minWidth: DEFAULT_MIN_RESOLUTION, minHeight: DEFAULT_MIN_RESOLUTION }),
      });
    } catch (error) {
      return Object.freeze({
        ...reference,
        ...decisionForTextureKey(reference.key),
        status: 'fail',
        role: asset.role ?? reference.roles[0] ?? 'unknown',
        path: repoRelative(repoRoot, absPath),
        readError: error.message,
      });
    }
  });

  return Object.freeze({
    generatedBy: 'scripts/ground-texture-audit.mjs',
    levelId,
    seed,
    threshold: Object.freeze({ seamlessMeanChannelDiff: DEFAULT_EDGE_THRESHOLD, minResolution: `${DEFAULT_MIN_RESOLUTION}x${DEFAULT_MIN_RESOLUTION}` }),
    textureCount: rows.length,
    passCount: rows.filter((row) => row.status === 'pass').length,
    failCount: rows.filter((row) => row.status === 'fail').length,
    approvedForPlanCount: rows.filter((row) => row.approvedForPlan).length,
    rows: Object.freeze(rows),
  });
}

function markdownStatus(status) {
  return status === 'pass' ? 'KEEP candidate' : 'REGENERATE';
}

export function renderGroundKeepListMarkdown(report) {
  const generatedAt = new Date().toISOString();
  const keepRows = report.rows.filter((row) => row.approvedForPlan);
  const regenerateRows = report.rows.filter((row) => row.status !== 'pass');
  const lines = [
    '# HMH Ground Texture Keep-List',
    '',
    `Generated by \`${report.generatedBy}\` at ${generatedAt}.`,
    '',
    '## Approval status',
    '',
    '**Justin approval applied from “Please continue”:** all runtime plan references are now assigned to repo-owned final-paint textures marked `TEMP_KEEP_APPROVED`; every listed texture still needs a true square seamless replacement in WO-14 unless Justin later marks it KEEP permanently.',
    '',
    '## Audit thresholds',
    '',
    `- Seamlessness: left/right and top/bottom mean RGB channel diff <= ${report.threshold.seamlessMeanChannelDiff}`,
    `- Resolution: >= ${report.threshold.minResolution}`,
    '- Palette: Wave-3 `sprite-qa` ART_BIBLE nearest-palette check, max off-palette ratio 0.08',
    '',
    '## Summary',
    '',
    `- Textures referenced by the WO-2 ground plan: ${report.textureCount}`,
    `- Audit-pass KEEP candidates: ${report.passCount}`,
    `- Approved temporary runtime keeps: ${report.approvedForPlanCount}`,
    `- REGENERATE candidates: ${report.failCount}`,
    '',
    '## KEEP candidates',
    '',
  ];

  if (!keepRows.length) {
    lines.push('_None yet. Current plan textures need regeneration or explicit Justin override._', '');
  } else {
    lines.push('| Texture key | Decision | Role(s) | Zones | Resolution | Edge worst | Off-palette | Path |', '| --- | --- | --- | ---: | --- | ---: | ---: | --- |');
    for (const row of keepRows) {
      lines.push(`| \`${row.key}\` | ${row.decision} | ${row.roles.join(', ')} | ${row.zoneIds.length} | ${row.width}x${row.height} | ${row.seamless.worst} | ${row.palette.offPaletteRatio} | \`${row.path}\` |`);
    }
    lines.push('');
  }

  lines.push('## REGENERATE', '', '| Texture key | Role(s) | Zones | Failed checks | Resolution | Edge L/R | Edge T/B | Off-palette | Path |', '| --- | --- | ---: | --- | --- | ---: | ---: | ---: | --- |');
  for (const row of regenerateRows) {
    const failed = [];
    if (row.readError) failed.push(`read: ${row.readError}`);
    if (row.resolution?.status === 'fail') failed.push('resolution');
    if (row.seamless?.status === 'fail') failed.push('seamless');
    if (row.palette?.status === 'fail') failed.push('palette');
    if (row.reason) failed.push(row.reason);
    lines.push(`| \`${row.key}\` | ${row.roles.join(', ')} | ${row.zoneIds.length} | ${failed.join(', ') || 'unknown'} | ${row.width ?? '?'}x${row.height ?? '?'} | ${row.seamless?.leftRight ?? '?'} | ${row.seamless?.topBottom ?? '?'} | ${row.palette?.offPaletteRatio ?? '?'} | ${row.path ? `\`${row.path}\`` : ''} |`);
  }
  lines.push('', '## Full per-texture notes', '');
  for (const row of report.rows) {
    lines.push(`### ${markdownStatus(row.status)}: \`${row.key}\``);
    lines.push('');
    lines.push(`- Role(s): ${row.roles.join(', ')}`);
    lines.push(`- Zones: ${row.zoneIds.join(', ')}`);
    if (row.path) lines.push(`- Path: \`${row.path}\``);
    if (row.readError) lines.push(`- Read error: ${row.readError}`);
    lines.push(`- Decision: ${row.decision}; approved for plan: ${row.approvedForPlan ? 'yes' : 'no'}; ${row.notes}`);
    if (row.width && row.height) lines.push(`- Resolution: ${row.width}x${row.height} (${row.resolution.status})`);
    if (row.seamless) lines.push(`- Seamlessness: ${row.seamless.status}; L/R ${row.seamless.leftRight}, T/B ${row.seamless.topBottom}, worst ${row.seamless.worst}`);
    if (row.palette) lines.push(`- Palette: ${row.palette.status}; off-palette ratio ${row.palette.offPaletteRatio}; top offenders ${row.palette.offendingHexes.map((item) => `${item.hex}->${item.nearest} (${item.count})`).join(', ') || 'none'}`);
    lines.push('');
  }

  lines.push('## Justin decision log', '', '| Texture key | Decision | Notes |', '| --- | --- | --- |');
  for (const row of report.rows) lines.push(`| \`${row.key}\` | ${row.decision} | ${row.notes} |`);
  lines.push('');
  return `${lines.join('\n')}\n`;
}

export function writeGroundKeepList({ repoRoot = repoRootFromHere(), outPath = path.join(repoRoot, 'docs/art/GROUND_KEEPLIST.md') } = {}) {
  const report = auditGroundTextures({ repoRoot });
  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, renderGroundKeepListMarkdown(report), 'utf8');
  return report;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const repoRoot = repoRootFromHere();
  const outArg = process.argv.find((arg) => arg.startsWith('--out='));
  const outPath = outArg ? path.resolve(outArg.slice('--out='.length)) : path.join(repoRoot, 'docs/art/GROUND_KEEPLIST.md');
  const report = writeGroundKeepList({ repoRoot, outPath });
  console.log(`Ground texture keep-list written: ${report.textureCount} textures (${report.approvedForPlanCount} approved temporary keeps, ${report.failCount} regenerate candidates).`);
  if (report.failCount) console.log('WO-4 approval applied: regeneration remains queued for WO-14; no art regenerated in this WO.');
}
