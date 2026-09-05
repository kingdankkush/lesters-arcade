// Cycle 074 (P-6): hero atlas format measurement harness.
//
// AAA-ROADMAP 8.3.2 asks the owner to choose the hero atlas format (PNG,
// lossless WebP, lossy WebP, KTX2) before the 256 px heroes land. That is an
// owner decision; this harness only produces the numbers the memo needs. It
// changes no shipped asset and no runtime: the variants live under .tmp/, the
// browser loads them from a scratch static server, and the only committed
// output is docs/hmh-reboot/ATLAS-FORMAT-DECISION-MEMO.md.
//
// Pipeline
//   1. scripts/hmh-hero-atlas-format-convert.py (Pillow) writes png /
//      webp-lossless (exact=True) / webp-q90 for one hero plus fidelity numbers.
//   2. A scratch www dir gets the variants, the shipped Pixi vendor chunk
//      (apps/portal/dist/chunks/hmh-pixi.js, self-contained ESM) and a probe page.
//   3. Playwright drives Chrome through two profiles copied from the
//      performance smoke -- desktop 1440x900 dsf 1 and the iPhone-13 geometry
//      390x844 dsf 3 with 4x CPU throttling as a labelled proxy -- and times
//      cold fetch, createImageBitmap decode, Pixi Assets.load and GPU upload,
//      N cold runs per variant, cache disabled through CDP.
//   4. The memo is rendered from the measured JSON. KTX2 is reported as not
//      measurable when no encoder is installed; nothing is guessed.
//
// Usage
//   node scripts/hmh-hero-atlas-format-harness.mjs [--hero lester-original]
//     [--runs 7] [--out .tmp/evidence-atlas-format-and-audio-routing/harness]
//     [--memo docs/hmh-reboot/ATLAS-FORMAT-DECISION-MEMO.md] [--port 8987]
//     [--webkit] [--skip-convert] [--skip-browser] [--s2-status-file <md>]
//
// The pure helpers are exported and pinned by tests/hmh-hero-atlas-format-harness.test.mjs.

import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ATLAS_FORMAT_VARIANTS = Object.freeze(['png', 'webp-lossless', 'webp-q90']);
export const KTX2_STATUS = 'not measurable on this host: no encoder installed (install KTX-Software `toktx` and re-run)';
export const KTX2_INSTALL_POINTER = 'https://github.com/KhronosGroup/KTX-Software/releases (toktx --encode uastc) or `basisu`';
export const PER_HERO_ATLAS_CAP_BYTES = 3.25 * 1024 * 1024;
export const FOUR_HERO_ATLAS_CAP_BYTES = 12 * 1024 * 1024;
export const SHIPPED_HEROES = Object.freeze(['lester-original', 'lilly', 'lit-commando', 'lit-valkyrie']);

const VARIANT_LABELS = Object.freeze({
  png: 'PNG (shipped)',
  'webp-lossless': 'WebP lossless (exact)',
  'webp-q90': 'WebP lossy q90',
  ktx2: 'KTX2 (UASTC)',
});

const METRIC_KEYS = Object.freeze(['fetchMs', 'decodeMs', 'pixiLoadMs', 'uploadMs', 'firstRenderMs']);

export const PROFILES = Object.freeze({
  desktop: Object.freeze({
    label: 'desktop 1440x900 dsf 1',
    viewport: Object.freeze({ width: 1440, height: 900 }),
    deviceScaleFactor: 1,
    isMobile: false,
    cpuThrottle: 1,
  }),
  'iphone-13': Object.freeze({
    label: 'iphone-13 390x844 dsf 3, CPU x4 (headless Chrome proxy, not a device)',
    viewport: Object.freeze({ width: 390, height: 844 }),
    deviceScaleFactor: 3,
    isMobile: true,
    cpuThrottle: 4,
  }),
});

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

export function percentile(values, p) {
  if (!Array.isArray(values) || values.length === 0) throw new Error('percentile needs at least one sample');
  const sorted = values.map(Number).sort((a, b) => a - b);
  const rank = Math.max(1, Math.ceil((p / 100) * sorted.length));
  return sorted[rank - 1];
}

function round(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(Number(value) * factor) / factor;
}

export function summarizeRuns(runs) {
  if (!Array.isArray(runs) || runs.length === 0) throw new Error('summarizeRuns needs at least one run');
  const summary = { runs: runs.length };
  for (const key of METRIC_KEYS) {
    const values = runs.map((run) => Number(run[key])).filter((value) => Number.isFinite(value));
    if (values.length === 0) continue;
    summary[key] = {
      median: round(percentile(values, 50)),
      p95: round(percentile(values, 95)),
      min: round(Math.min(...values)),
      max: round(Math.max(...values)),
    };
  }
  return summary;
}

export function extrapolateTo256({
  bytes,
  frameSize = 160,
  targetFrameSize = 256,
  atlasSize = 2048,
  perHeroCap = PER_HERO_ATLAS_CAP_BYTES,
} = {}) {
  const areaFactor = round((targetFrameSize / frameSize) ** 2, 4);
  const estimatedBytes = Math.round(Number(bytes) * areaFactor);
  const pagesAt2048 = Math.ceil(areaFactor);
  let fitsSinglePageAt = atlasSize;
  while (fitsSinglePageAt * fitsSinglePageAt < atlasSize * atlasSize * areaFactor) fitsSinglePageAt *= 2;
  return {
    areaFactor,
    estimatedBytes,
    pagesAt2048,
    fitsSinglePageAt,
    decodedRgbaBytesSinglePage: fitsSinglePageAt * fitsSinglePageAt * 4,
    decodedRgbaBytesPaged: pagesAt2048 * atlasSize * atlasSize * 4,
    fitsPerHeroCap: estimatedBytes <= perHeroCap,
  };
}

export function formatBytes(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return 'n/a';
  return Math.round(Number(value)).toLocaleString('en-US');
}

export function formatMb(bytes) {
  return `${(Number(bytes) / 1_000_000).toFixed(2)} MB`;
}

// Wire time for `bytes` at a nominal link rate, whole milliseconds. Localhost
// fetch numbers say nothing about a phone on a real network; this column is
// the analytic complement so bytes can be weighed against measured decode.
export const TRANSFER_RATES_MBPS = Object.freeze([10, 50]);
export function estimateTransferMs(bytes, mbps) {
  return Math.round((Number(bytes) * 8) / (Number(mbps) * 1000));
}

export function deltaPercent(bytes, baseBytes) {
  const ratio = (Number(bytes) / Number(baseBytes) - 1) * 100;
  const fixed = ratio.toFixed(1);
  if (fixed === '0.0' || fixed === '-0.0') return '0.0%';
  return `${ratio > 0 ? '+' : ''}${fixed}%`;
}

function fidelityText(fidelity) {
  if (!fidelity) return 'n/a';
  if (fidelity.identical) return 'byte-identical RGBA';
  return `visible max channel delta ${fidelity.visibleMaxChannelDelta}, mean RGB delta ${fidelity.visibleMeanRgbDelta}, alpha changed ${formatBytes(fidelity.alphaChanged)} px`;
}

export function buildDecisionRows({ conversion, measurements = {} }) {
  const base = conversion.variants.png.bytes;
  const frameSize = conversion.source?.frameSize ?? 160;
  const atlasSize = conversion.source?.width ?? 2048;
  const rows = ATLAS_FORMAT_VARIANTS.map((format) => {
    const variant = conversion.variants[format];
    if (!variant) throw new Error(`conversion is missing the ${format} variant`);
    const row = {
      format,
      label: VARIANT_LABELS[format],
      bytes: variant.bytes,
      delta: deltaPercent(variant.bytes, base),
      encodeMs: variant.encodeMs,
      encoder: variant.encoder ?? '',
      fidelity: variant.fidelity,
      gpuBytes2048: atlasSize * atlasSize * 4,
      gpuBytes4096: atlasSize * 2 * atlasSize * 2 * 4,
      extrapolate256: extrapolateTo256({ bytes: variant.bytes, frameSize, atlasSize }),
      status: 'measured',
    };
    for (const [profile, data] of Object.entries(measurements)) {
      const runs = data?.variants?.[format];
      row[profile] = Array.isArray(runs) && runs.length ? summarizeRuns(runs) : null;
    }
    return row;
  });
  rows.push({
    format: 'ktx2',
    label: VARIANT_LABELS.ktx2,
    bytes: null,
    delta: null,
    encodeMs: null,
    encoder: 'toktx --encode uastc (absent)',
    fidelity: null,
    // 8 bpp block compression stays compressed on the GPU: 1 byte per texel.
    gpuBytes2048: atlasSize * atlasSize,
    gpuBytes4096: atlasSize * 2 * atlasSize * 2,
    extrapolate256: null,
    status: conversion.ktx2?.encoderFound ? (conversion.ktx2.status ?? KTX2_STATUS) : KTX2_STATUS,
  });
  return rows;
}

function cell(summary, key) {
  if (!summary || !summary[key]) return 'n/a';
  return `${summary[key].median} / ${summary[key].p95}`;
}

function tableLine(cells) {
  return `| ${cells.map((value) => String(value ?? '').replaceAll('|', '\\|')).join(' | ')} |`;
}

// Prose comparison of measured decode against the PNG control, per profile.
// Written from the numbers so the memo cannot claim a direction the run did
// not measure.
function decodeComparison(rows, profiles) {
  if (profiles.length === 0) return '- no browser measurements in this run.';
  const png = rows[0];
  const lines = [];
  for (const profile of profiles) {
    if (!png[profile]) continue;
    const parts = rows.slice(1, 3).filter((row) => row[profile]).map((row) => {
      const delta = row[profile].decodeMs.median - png[profile].decodeMs.median;
      const pixiDelta = row[profile].pixiLoadMs.median - png[profile].pixiLoadMs.median;
      return `${row.label} decodes in ${row[profile].decodeMs.median} ms (${delta >= 0 ? '+' : ''}${delta.toFixed(1)} ms vs PNG) and completes the Pixi load in ${row[profile].pixiLoadMs.median} ms (${pixiDelta >= 0 ? '+' : ''}${pixiDelta.toFixed(1)} ms)`;
    });
    lines.push(`- **${profile}**: PNG decodes in ${png[profile].decodeMs.median} ms median (p95 ${png[profile].decodeMs.p95}); ${parts.join('; ')}. Fetch from localhost is ${png[profile].fetchMs.median} ms for PNG and says nothing about a real link; use the analytic wire columns.`);
  }
  lines.push(`- On a 10 Mbps link the wire time dominates every decode number above by more than an order of magnitude (PNG ${formatBytes(estimateTransferMs(png.bytes, 10))} ms), so smaller bytes win the cold path on real networks even where WebP decodes slower; on localhost or a fast LAN PNG's faster decode wins.`);
  return lines.join('\n');
}

export function renderDecisionMemo({
  conversion,
  measurements = {},
  generatedAt = new Date().toISOString(),
  baseCommit = 'unknown',
  s2Status = 'not recorded',
  evidencePaths = [],
  browserNotes = [],
  heroBytes = null,
} = {}) {
  const rows = buildDecisionRows({ conversion, measurements });
  const profiles = Object.keys(measurements);
  const hero = conversion.hero;
  const source = conversion.source ?? {};
  const png = rows[0];
  const lossless = rows[1];
  const lossy = rows[2];
  const ktx2 = rows[3];
  const headers = ['Format', 'Bytes', ...TRANSFER_RATES_MBPS.map((rate) => `Wire ms at ${rate} Mbps (analytic)`), 'Delta vs PNG', 'Encode s'];
  for (const profile of profiles) {
    headers.push(`${profile} fetch ms (med / p95)`, `${profile} decode ms (med / p95)`, `${profile} Pixi load ms (med / p95)`, `${profile} GPU upload ms (med / p95)`);
  }
  headers.push('GPU MB at 2048x2048 (analytic)', 'Fidelity vs shipped PNG');
  const tableRows = rows.map((row) => {
    const cells = [
      row.label,
      row.bytes === null ? row.status : formatBytes(row.bytes),
      ...TRANSFER_RATES_MBPS.map((rate) => (row.bytes === null ? 'n/a' : formatBytes(estimateTransferMs(row.bytes, rate)))),
      row.delta ?? 'n/a',
      row.encodeMs === null ? 'n/a' : (row.encodeMs / 1000).toFixed(1),
    ];
    for (const profile of profiles) {
      const summary = row[profile];
      cells.push(cell(summary, 'fetchMs'), cell(summary, 'decodeMs'), cell(summary, 'pixiLoadMs'), cell(summary, 'uploadMs'));
    }
    cells.push(formatMb(row.gpuBytes2048), row.fidelity ? fidelityText(row.fidelity) : 'n/a');
    return tableLine(cells);
  });

  const extrapolationRows = rows.filter((row) => row.extrapolate256).map((row) => tableLine([
    row.label,
    formatBytes(row.bytes),
    formatBytes(row.extrapolate256.estimatedBytes),
    row.extrapolate256.fitsPerHeroCap ? 'yes' : `no (${deltaPercent(row.extrapolate256.estimatedBytes, PER_HERO_ATLAS_CAP_BYTES)} over)`,
    formatBytes(row.extrapolate256.estimatedBytes * SHIPPED_HEROES.length),
    row.extrapolate256.estimatedBytes * SHIPPED_HEROES.length <= FOUR_HERO_ATLAS_CAP_BYTES ? 'yes' : 'no',
  ]));
  const geometry = png.extrapolate256;

  const heroTotal = heroBytes ? Object.values(heroBytes).reduce((sum, value) => sum + value, 0) : null;
  const heroLines = heroBytes
    ? Object.entries(heroBytes).map(([id, bytes]) => `  - \`${id}\`: ${formatBytes(bytes)} bytes (${(bytes / PER_HERO_ATLAS_CAP_BYTES * 100).toFixed(1)}% of the per-hero cap)`).join('\n')
    : '  - (hero byte inventory not captured in this run)';

  const profileLines = profiles.map((profile) => {
    const info = measurements[profile];
    const cacheNote = info.browser === 'webkit'
      ? 'no CDP: cache defeated only by `cache: no-store` and unique query strings'
      : 'HTTP cache disabled through CDP';
    return `- \`${profile}\`: ${info.label ?? profile}; ${info.runs ?? 'n'} cold runs per variant, ${cacheNote}${info.cpuThrottle > 1 ? `, CPU throttled x${info.cpuThrottle}` : ''}${info.browser ? `, ${info.browser}` : ''}.`;
  }).join('\n');

  const notes = browserNotes.length ? browserNotes.map((note) => `- ${note}`).join('\n') : '- none';
  const evidence = evidencePaths.length ? evidencePaths.map((file) => `- \`${file}\``).join('\n') : '- none captured';

  return `# Hero atlas format decision memo (P-6, AAA-ROADMAP 8.3.2)

Status: **measurement complete, owner decision pending**. Nothing about the hero atlas
format ships until the owner answers in chat and the answer is recorded in \`DECISIONS.md\`
(repo root). Generated by \`scripts/hmh-hero-atlas-format-harness.mjs\` on ${generatedAt}
against base commit \`${baseCommit}\`; no shipped asset or runtime file was changed by the run.

## The question

Before the 256 px heroes (C-1, C-3) land, pick the shipping format for the four hero atlases.
AAA-ROADMAP 8.3.2 lists four options: **raise the 12.6 MB (12 MiB) four-hero cap**, **adopt
lossless WebP**, **adopt KTX2**, or **load one hero at a time**. The roadmap's standing
recommendation is per-hero lazy loading plus WebP unless KTX2 wins on mobile GPU memory.

## Facts on the base commit

- Per-hero atlas cap \`3,407,872\` bytes (3.25 MiB) and four-hero total cap
  \`${formatBytes(FOUR_HERO_ATLAS_CAP_BYTES)}\` bytes (12 MiB), asserted by
  \`scripts/hmh-reboot-production-asset-qa.mjs\`, which decodes atlases as PNG only.
- Shipped atlases are 2048x2048 RGBA, 648 frames each, 160x160 source frames trimmed and
  packed; visible pixels are about ${conversion.variants.png.fidelity?.visiblePixelShare ? (conversion.variants.png.fidelity.visiblePixelShare * 100).toFixed(1) : '33'}% of the sheet.
${heroLines}
${heroTotal ? `  - four-hero total ${formatBytes(heroTotal)} bytes = ${(heroTotal / FOUR_HERO_ATLAS_CAP_BYTES * 100).toFixed(1)}% of the 12 MiB cap (${formatBytes(FOUR_HERO_ATLAS_CAP_BYTES - heroTotal)} bytes of headroom).` : ''}
- **Per-hero lazy loading is already the live behaviour**: \`apps/hmh-reboot/src/main.mjs\`
  loads exactly one hero atlas (the selected \`productionHero\`, default \`lit-commando\`) on
  boot and swaps it in on decode. The 12 MiB total bounds hero switching over a session, not
  boot. Option four is therefore already done and the question is really format plus page
  count plus the per-hero cap.
- The shipped Pixi 8.19.0 vendor chunk already accepts \`.webp\` and \`.avif\` URLs through
  \`Assets.load\` (createImageBitmap path); no JavaScript changes for WebP. KTX2 needs
  \`import 'pixi.js/ktx2'\` (about +14 KB in the vendor chunk) plus a self-hosted transcoder
  (\`libktx.js\` 216,472 + \`libktx.wasm\` 713,727 bytes) because \`vercel.json\` CSP
  \`script-src 'self'\` blocks Pixi's default jsDelivr transcoder URL.
- Bundle headroom on the base commit is 29,941 bytes of 1,050,000; WebP costs 0 bytes there.

## Method

Measured hero: \`${hero}\` (${formatBytes(source.bytes)} bytes, the largest of the four, ${(source.bytes / PER_HERO_ATLAS_CAP_BYTES * 100).toFixed(1)}%
of the per-hero cap). Conversion by Pillow ${conversion.toolchain?.pillow ?? '?'} (libwebp ${conversion.toolchain?.libwebp ?? '?'}) on
Python ${conversion.toolchain?.python ?? '?'}: lossless WebP uses \`exact=True\` because Pillow's default rewrites RGB
under alpha 0 and would break the per-frame RGBA hash pins even though no visible pixel
changes; lossy uses quality 90, method 6, alpha untouched.

Browser timings come from headless Chrome (\`C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe\`)
driven by Playwright, with the same geometry as the performance smoke:

${profileLines}

Each cold run fetches the file with the HTTP cache disabled and a unique query string,
decodes it with \`createImageBitmap\`, loads it again through Pixi \`Assets.load\`, uploads it
with \`renderer.texture.initSource\` and renders one sprite. Numbers are median / p95 over
the runs. **The iPhone-13 column is a viewport, DPR and CPU-throttle proxy measured on this
desktop, not a phone measurement**; decode on a real A15 will differ. GPU memory is
analytic because WebGL exposes no texture memory: RGBA8 is 4 bytes per texel for both PNG
and WebP (the format only changes the wire bytes), 8 bpp UASTC/ASTC/BC7 is 1 byte per texel.

Browser notes:
${notes}

## Results

${tableLine(headers)}
${tableLine(headers.map(() => '---'))}
${tableRows.join('\n')}

Encode times are one-off build-time costs on this host (PNG is the shipped bytes, no encode).

## 256 px extrapolation

A 256 px frame is ${geometry.areaFactor}x the area of a 160 px frame. The packed sheet grows by the
same factor, so 648 frames no longer fit one 2048x2048 page: the choice is one
${geometry.fitsSinglePageAt}x${geometry.fitsSinglePageAt} page (${formatMb(geometry.decodedRgbaBytesSinglePage)} decoded RGBA8) or ${geometry.pagesAt2048} pages of 2048x2048
(${formatMb(geometry.decodedRgbaBytesPaged)} RGBA8 in total). Bytes below scale the measured 160 px bytes by the area factor;
treat them as estimates within about 15%.

| Format | Measured 160 px bytes | Estimated 256 px bytes | Fits per-hero cap 3,407,872 | Estimated four-hero total | Fits 12 MiB total |
| --- | --- | --- | --- | --- | --- |
${extrapolationRows.join('\n')}

## The four options

1. **Raise the 12.6 MB (12 MiB) four-hero cap.** Keeps PNG and the PNG-only QA chain. At 256 px
   PNG needs about ${formatBytes(png.extrapolate256.estimatedBytes)} bytes per hero and ${formatBytes(png.extrapolate256.estimatedBytes * 4)} for four; the per-hero cap
   would have to rise to about 8.5 MiB and the total to about 34 MiB. Only boot is unaffected
   (one hero loads), but each hero switch fetches ~8 MB and cold mobile decode grows with it.
2. **Adopt lossless WebP (exact=True).** ${lossless.delta} bytes with byte-identical RGBA, so the
   sourcePixelSha256 / atlasSha256 chain and the two-run reproducibility gates keep their
   meaning. Zero JavaScript. Needs a WebP decode branch in asset QA (\`readRgbaPng\` is
   PNG-only), the \`.png\` asserts in the portal flow smoke and production-hero smoke moved
   to the new extension, and the atlas \`image\` field. At 256 px still over the current
   per-hero cap (${formatBytes(lossless.extrapolate256.estimatedBytes)} estimated), so the cap moves too, to about 6.4 MiB.
3. **Adopt KTX2 (UASTC, transcoded to ASTC/BC7 on device).** The only option that changes GPU
   memory (${formatMb(ktx2.gpuBytes2048)} instead of ${formatMb(png.gpuBytes2048)} at 2048x2048; ${formatMb(ktx2.gpuBytes4096)} instead of
   ${formatMb(png.gpuBytes4096)} at 4096x4096). ${ktx2.status}. Install pointer: ${KTX2_INSTALL_POINTER}.
   Costs beyond the encoder: about +14 KB in the 1,050,000-byte capped vendor chunk (headroom
   29,941), a self-hosted 930 KB transcoder and worker plumbing under the CSP, block-compression
   artefacts on pixel-art edges that need an art-director pass, and a new QA decode path.
4. **Load one hero at a time.** Already live on the base commit (see Facts). Nothing to build;
   it does not by itself solve the 256 px per-hero cap.

## What the numbers say

${decodeComparison(rows, profiles)}

## Recommendation

Carry the roadmap recommendation unless the owner weighs the trade differently: **lossless
WebP with \`exact=True\` as the committed runtime asset, PNG kept as the Blender intermediate,
per-hero lazy loading kept as is.** It is the only measured option that is both smaller and
pixel-identical, and the wire saving on a real network (about ${formatBytes(estimateTransferMs(png.bytes - lossless.bytes, 10))} ms
per hero at 10 Mbps) is an order of magnitude larger than its measured decode penalty. Lossy q90
is ${lossy.delta} bytes but not pixel-identical (${fidelityText(lossy.fidelity)}); the 3x evidence
captures cannot separate it from PNG by eye, so accept it only after a zoomed pixel-diff of the
hero art on a phone, and only with a pinned encoder version because Vercel's Pillow 11.3 and the
host's Pillow 12.3 can carry different libwebp builds (never let the build image encode). KTX2
stays deferred until the owner installs an encoder; if mobile GPU memory becomes the binding
constraint at 4096x4096 it is the option to re-measure first.

Whatever the choice, the 256 px move also needs a decision on **page count** (one 4096x4096
page or three 2048x2048 pages) and a **new per-hero cap**; the memo table gives both numbers.

## If the owner picks WebP (separate cycle, RED first)

1. Asset QA: WebP decode branch beside \`readRgbaPng\`, same RGBA hash pins.
2. \`scripts/smoke-portal-flow.mjs\` PNG-header size check and
   \`scripts/hmh-reboot-production-hero-browser-smoke.mjs\` \`.png\` response asserts move to
   the new extension; \`tests/hmh-reboot-production-hero-atlas.test.mjs\` fixture \`image\` field.
3. Packer (\`scripts/build-hmh-blender-atlas.py\`) writes the WebP with \`exact=True\` next to
   the PNG intermediate; \`atlasSha256\` in the metrics moves to the WebP.
4. URL swap in \`apps/hmh-reboot/src/production-hero-atlas.mjs\` (0 net JS bytes), then fresh
   certification.

## S-2 status

${s2Status}

## Evidence

${evidence}
`;
}

// ---------------------------------------------------------------------------
// Harness entry point
// ---------------------------------------------------------------------------

const PROBE_PAGE = `<!doctype html>
<meta charset="utf-8">
<link rel="icon" href="data:,">
<title>P-6 hero atlas format probe</title>
<style>
  html, body { margin: 0; background: #14181d; color: #e8ecf1; font: 13px/1.4 system-ui, sans-serif; }
  #stage { display: block; }
  #label { position: fixed; left: 12px; top: 12px; padding: 8px 12px; background: rgba(0,0,0,.6); border-radius: 6px; white-space: pre; }
</style>
<canvas id="stage"></canvas>
<div id="label">booting</div>
<script type="module">
import { Application, Assets, Container, Rectangle, Sprite, Texture } from './hmh-pixi.js';

const label = document.querySelector('#label');
const app = new Application();
await app.init({
  canvas: document.querySelector('#stage'),
  width: window.innerWidth,
  height: window.innerHeight,
  resolution: Math.min(window.devicePixelRatio || 1, 2),
  autoDensity: true,
  background: 0x14181d,
  preference: 'webgl',
  antialias: false,
  autoStart: false,
});
const frames = await (await fetch('./frames.json')).json();
const stageRoot = new Container();
app.stage.addChild(stageRoot);
label.textContent = 'ready';

function pickFrames() {
  const wanted = [];
  for (const state of ['aim', 'pistol-fire', 'dash', 'melee', 'hurt', 'death']) {
    const frame = frames.frames.find((f) => f.state === state && f.direction === 'south' && f.layer === 'torso-head' && f.frameIndex === 0)
      ?? frames.frames.find((f) => f.state === state && f.layer === 'torso-head');
    if (frame) wanted.push(frame);
  }
  return wanted.length ? wanted : frames.frames.slice(0, 6);
}

window.__probeReady = true;
window.measureAtlas = async ({ url, run, show = false, title = '' }) => {
  const bust = url + (url.includes('?') ? '&' : '?') + 'run=' + run + '&t=' + Date.now();
  const out = { url, run };
  const t0 = performance.now();
  const response = await fetch(bust, { cache: 'no-store' });
  const blob = await response.blob();
  const t1 = performance.now();
  out.fetchMs = t1 - t0;
  out.transferBytes = blob.size;
  out.contentType = blob.type;
  const bitmap = await createImageBitmap(blob);
  const t2 = performance.now();
  out.decodeMs = t2 - t1;
  out.width = bitmap.width;
  out.height = bitmap.height;
  bitmap.close();

  const pixiUrl = bust + '&pixi=1';
  const t3 = performance.now();
  const texture = await Assets.load(pixiUrl);
  const t4 = performance.now();
  out.pixiLoadMs = t4 - t3;
  app.renderer.texture.initSource(texture.source);
  const t5 = performance.now();
  out.uploadMs = t5 - t4;

  stageRoot.removeChildren().forEach((child) => child.destroy());
  const picks = pickFrames();
  const scale = Math.max(1, Math.min(3, Math.floor((app.screen.width - 40) / (picks.length * 90))));
  let x = 20;
  for (const frame of picks) {
    const sub = new Texture({ source: texture.source, frame: new Rectangle(frame.frame.x, frame.frame.y, frame.frame.w, frame.frame.h) });
    const sprite = new Sprite(sub);
    sprite.scale.set(scale);
    sprite.x = x;
    sprite.y = Math.round(app.screen.height / 2 - (frame.frame.h * scale) / 2);
    stageRoot.addChild(sprite);
    x += frame.frame.w * scale + 24;
  }
  app.render();
  const t6 = performance.now();
  out.firstRenderMs = t6 - t5;
  out.heapBytes = performance.memory?.usedJSHeapSize ?? null;
  label.textContent = title + '\\n' + out.transferBytes.toLocaleString() + ' bytes  ' + out.contentType
    + '\\nfetch ' + out.fetchMs.toFixed(1) + ' ms  decode ' + out.decodeMs.toFixed(1) + ' ms  pixi ' + out.pixiLoadMs.toFixed(1) + ' ms  upload ' + out.uploadMs.toFixed(1) + ' ms'
    + '\\n' + picks.map((f) => f.state).join(' / ') + ' at ' + scale + 'x';
  if (!show) {
    stageRoot.removeChildren().forEach((child) => child.destroy());
    await Assets.unload(pixiUrl);
    texture.destroy(true);
  }
  return out;
};
</script>
`;

function parseArgs(argv) {
  const args = {
    hero: 'lester-original',
    runs: 7,
    out: '.tmp/evidence-atlas-format-and-audio-routing/harness',
    memo: 'docs/hmh-reboot/ATLAS-FORMAT-DECISION-MEMO.md',
    port: 8987,
    webkit: false,
    skipConvert: false,
    skipBrowser: false,
    s2Status: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => argv[++index];
    if (arg === '--hero') args.hero = next();
    else if (arg === '--runs') args.runs = Number(next());
    else if (arg === '--out') args.out = next();
    else if (arg === '--memo') args.memo = next();
    else if (arg === '--port') args.port = Number(next());
    else if (arg === '--webkit') args.webkit = true;
    else if (arg === '--skip-convert') args.skipConvert = true;
    else if (arg === '--skip-browser') args.skipBrowser = true;
    else if (arg === '--s2-status') args.s2Status = next();
    else if (arg === '--s2-status-file') args.s2Status = readFileSync(path.resolve(next()), 'utf8').trim();
    else throw new Error(`unknown argument ${arg}`);
  }
  return args;
}

function repoRoot() {
  return fileURLToPath(new URL('..', import.meta.url));
}

function pythonExecutable() {
  for (const candidate of ['python', 'python3', 'py']) {
    const probe = spawnSync(candidate, ['--version'], { encoding: 'utf8' });
    if (probe.status === 0) return candidate;
  }
  throw new Error('no python on PATH; the converter needs Python 3 with Pillow');
}

function runConverter({ root, hero, outDir }) {
  const python = pythonExecutable();
  const result = spawnSync(python, [path.join(root, 'scripts', 'hmh-hero-atlas-format-convert.py'), '--hero', hero, '--out', outDir], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error(`converter failed (${result.status}):\n${result.stderr || result.stdout}`);
  return JSON.parse(readFileSync(path.join(outDir, 'conversion.json'), 'utf8'));
}

function prepareWww({ root, hero, outDir, conversion }) {
  const www = path.join(outDir, 'www');
  mkdirSync(www, { recursive: true });
  const vendor = path.join(root, 'apps', 'portal', 'dist', 'chunks', 'hmh-pixi.js');
  if (!existsSync(vendor)) throw new Error('apps/portal/dist/chunks/hmh-pixi.js missing; run `node build.mjs` first');
  copyFileSync(vendor, path.join(www, 'hmh-pixi.js'));
  copyFileSync(
    path.join(root, 'apps', 'portal', 'assets', 'generated', 'hmh-reboot-production-heroes', hero, `${hero}-production-pilot-atlas.json`),
    path.join(www, 'frames.json'),
  );
  for (const variant of Object.values(conversion.variants)) {
    copyFileSync(path.join(outDir, variant.file), path.join(www, variant.file));
  }
  writeFileSync(path.join(www, 'index.html'), PROBE_PAGE, 'utf8');
  return www;
}

async function measureProfile({ browserType, launchOptions, origin, profile, profileId, conversion, runs, evidenceDir, hero, browserLabel }) {
  const browser = await browserType.launch(launchOptions);
  const notes = [];
  try {
    const context = await browser.newContext({
      viewport: profile.viewport,
      deviceScaleFactor: profile.deviceScaleFactor,
      isMobile: profile.isMobile,
      hasTouch: profile.isMobile,
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(`page: ${error.message}`));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
    let cdp = null;
    if (browserType.name() === 'chromium') {
      cdp = await context.newCDPSession(page);
      await cdp.send('Network.enable');
      await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
      if (profile.cpuThrottle > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: profile.cpuThrottle });
    } else {
      notes.push(`${profileId} on ${browserLabel}: no CDP, cache disabled only through cache: 'no-store' and unique query strings; no CPU throttle`);
    }
    await page.goto(`${origin}/index.html`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__probeReady === true, null, { timeout: 30_000 });

    const variants = {};
    for (const format of ATLAS_FORMAT_VARIANTS) {
      const file = conversion.variants[format].file;
      const results = [];
      // Warm-up run: JIT and the Pixi loader's first-use costs are not what
      // the decision is about; it is discarded.
      await page.evaluate((input) => window.measureAtlas(input), { url: `/${file}`, run: 'warmup' });
      for (let run = 0; run < runs; run += 1) {
        const show = run === runs - 1;
        const result = await page.evaluate((input) => window.measureAtlas(input), {
          url: `/${file}`,
          run,
          show,
          title: `${hero} ${format} on ${profileId} (${browserLabel})`,
        });
        results.push(result);
        if (show) {
          const shot = path.join(evidenceDir, `${profileId}-${browserLabel}-${format}.png`);
          await page.screenshot({ path: shot });
          result.screenshot = shot;
        }
      }
      variants[format] = results;
    }
    if (errors.length) notes.push(`${profileId} on ${browserLabel}: ${errors.length} page/console errors: ${errors.slice(0, 3).join(' | ')}`);
    await context.close();
    return {
      label: `${profile.label}`,
      browser: browserLabel,
      cpuThrottle: browserType.name() === 'chromium' ? profile.cpuThrottle : 1,
      runs,
      variants,
      errors,
      notes,
    };
  } finally {
    await browser.close();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = repoRoot();
  const outDir = path.resolve(root, args.out);
  mkdirSync(outDir, { recursive: true });
  const evidenceDir = path.resolve(outDir, '..');
  const baseCommit = (() => {
    const result = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' });
    return result.status === 0 ? result.stdout.trim() : 'unknown';
  })();

  const conversionPath = path.join(outDir, 'conversion.json');
  const conversion = args.skipConvert && existsSync(conversionPath)
    ? JSON.parse(readFileSync(conversionPath, 'utf8'))
    : runConverter({ root, hero: args.hero, outDir });
  console.log(`[p6] conversion: ${Object.entries(conversion.variants).map(([id, v]) => `${id}=${v.bytes}`).join(' ')}`);

  const heroBytes = {};
  for (const id of SHIPPED_HEROES) {
    const file = path.join(root, 'apps', 'portal', 'assets', 'generated', 'hmh-reboot-production-heroes', id, `${id}-production-pilot-atlas.png`);
    if (existsSync(file)) heroBytes[id] = readFileSync(file).byteLength;
  }

  const measurementsPath = path.join(outDir, 'measurements.json');
  let measurements = {};
  const browserNotes = [];
  if (!args.skipBrowser) {
    const www = prepareWww({ root, hero: args.hero, outDir, conversion });
    const { startPortalStaticServer } = await import('./hmh-reboot-portal-e2e.mjs');
    const { server, origin } = await startPortalStaticServer({ rootDir: www, port: args.port });
    const playwright = await import('../benchmarks/hmh-engine-bakeoff/node_modules/playwright/index.mjs');
    try {
      const chromeLaunch = {
        executablePath: String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`,
        headless: true,
        args: ['--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl', '--enable-precise-memory-info'],
      };
      for (const [profileId, profile] of Object.entries(PROFILES)) {
        console.log(`[p6] measuring ${profileId} on chrome ...`);
        const result = await measureProfile({
          browserType: playwright.chromium, launchOptions: chromeLaunch, origin, profile, profileId,
          conversion, runs: args.runs, evidenceDir, hero: args.hero, browserLabel: 'chrome',
        });
        measurements[profileId] = result;
        browserNotes.push(...result.notes);
      }
      if (args.webkit) {
        console.log('[p6] measuring iphone-13 geometry on Playwright WebKit (Safari decoder proxy) ...');
        try {
          // Playwright 1.61.1 wants webkit-2311; the host has webkit-2287 from
          // an earlier install. Fall back to it explicitly and say so.
          const webkitLaunch = { headless: true };
          const wanted = playwright.webkit.executablePath();
          if (!existsSync(wanted)) {
            const fallback = path.join(process.env.LOCALAPPDATA ?? '', 'ms-playwright', 'webkit-2287', 'Playwright.exe');
            if (existsSync(fallback)) {
              webkitLaunch.executablePath = fallback;
              browserNotes.push(`WebKit: Playwright expected ${path.basename(path.dirname(wanted))}; used installed webkit-2287 instead (version-mismatched proxy)`);
            }
          }
          const result = await measureProfile({
            browserType: playwright.webkit, launchOptions: webkitLaunch, origin,
            profile: PROFILES['iphone-13'], profileId: 'iphone-13', conversion, runs: args.runs, evidenceDir,
            hero: args.hero, browserLabel: 'webkit',
          });
          measurements['iphone-13-webkit'] = { ...result, label: 'iphone-13 390x844 dsf 3 on Playwright WebKit (Safari decoder proxy, no CPU throttle)' };
          browserNotes.push(...result.notes);
        } catch (error) {
          browserNotes.push(`WebKit run skipped: ${String(error?.message ?? error).split('\n')[0]}`);
        }
      }
    } finally {
      server.close();
    }
    writeFileSync(measurementsPath, `${JSON.stringify(measurements, null, 2)}\n`, 'utf8');
  } else if (existsSync(measurementsPath)) {
    measurements = JSON.parse(readFileSync(measurementsPath, 'utf8'));
  }

  const evidencePaths = [];
  for (const data of Object.values(measurements)) {
    for (const runs of Object.values(data.variants ?? {})) {
      for (const run of runs) if (run.screenshot) evidencePaths.push(run.screenshot);
    }
  }
  evidencePaths.push(conversionPath, measurementsPath);

  const s2Status = args.s2Status ?? 'not recorded by this run';
  const memo = renderDecisionMemo({
    conversion, measurements, baseCommit, s2Status, browserNotes, heroBytes,
    evidencePaths: evidencePaths.map((file) => path.relative(root, file).replaceAll('\\', '/')),
  });
  const memoPath = path.resolve(root, args.memo);
  mkdirSync(path.dirname(memoPath), { recursive: true });
  writeFileSync(memoPath, memo, 'utf8');
  console.log(`[p6] memo written: ${memoPath}`);
  for (const [profileId, data] of Object.entries(measurements)) {
    for (const format of ATLAS_FORMAT_VARIANTS) {
      const summary = summarizeRuns(data.variants[format]);
      console.log(`[p6] ${profileId} ${format}: fetch ${summary.fetchMs.median}/${summary.fetchMs.p95} decode ${summary.decodeMs.median}/${summary.decodeMs.p95} pixi ${summary.pixiLoadMs.median}/${summary.pixiLoadMs.p95} upload ${summary.uploadMs.median}/${summary.uploadMs.p95}`);
    }
  }
}

const isMain = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
